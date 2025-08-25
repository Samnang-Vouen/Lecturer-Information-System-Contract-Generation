import { Op, Sequelize } from 'sequelize';
import { LecturerProfile, User, Department } from '../model/user.model.js';
import LecturerCourse from '../model/lecturerCourse.model.js';
import Course from '../model/course.model.js';

/**
 * GET /api/lecturers
 * Returns lecturers sourced directly from Lecturer_Profiles + joined User.
 * Query params: page (1-based), limit (default 10), search
 */
export const getLecturers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const statusFilter = (req.query.status || '').trim();
    const departmentFilter = (req.query.department || '').trim();

    let where = undefined;
    if (search) {
      const like = `%${search}%`;
      where = {
        [Op.or]: [
          // search stored full-name fields on LecturerProfile
          { full_name_english: { [Op.like]: like } },
          { full_name_khmer: { [Op.like]: like } },
          // also allow searching the user's display name or email
          Sequelize.where(Sequelize.col('User.display_name'), { [Op.like]: like }),
          Sequelize.where(Sequelize.col('User.email'), { [Op.like]: like })
        ]
      };
    }

    // Filters that apply to User (status, department_name)
    const userWhere = {};
    if (statusFilter && ['active','inactive'].includes(statusFilter)) userWhere.status = statusFilter;
    // Department scoping: if requester is an admin (this route already admin-only) force to their own department
    // Ignore any client-supplied department filter to prevent data leakage across departments.
    if (req.user?.role === 'admin' && req.user.department_name) {
      userWhere.department_name = req.user.department_name;
    } else if (departmentFilter) {
      // Fallback (should not happen for admin without dept) – allow explicit filter only when not overriding
      userWhere.department_name = departmentFilter;
    }

    const { rows, count } = await LecturerProfile.findAndCountAll({
      attributes: ['id','employee_id','position','status','join_date','cv_uploaded','research_fields','qualifications','full_name_english','full_name_khmer','cv_file_path'],
      include: [{
        model: User,
        attributes: ['id','email','status','last_login','department_name','created_at'],
        where: Object.keys(userWhere).length ? userWhere : undefined,
        required: true
      }],
      where,
      limit,
      offset,
      distinct: true,
  order: [['id','DESC']]
    });

    // Optionally compute course counts (always for now—cheap single grouped query)
    const profileIds = rows.map(r=> r.id);
    let countsMap = new Map();
    if (profileIds.length) {
      const counts = await LecturerCourse.findAll({
        attributes: ['lecturer_profile_id', [Sequelize.fn('COUNT', Sequelize.col('LecturerCourse.id')), 'cnt']],
        where: { lecturer_profile_id: { [Op.in]: profileIds } },
        group: ['lecturer_profile_id']
      });
      counts.forEach(c=> countsMap.set(c.lecturer_profile_id, parseInt(c.get('cnt'),10)||0));
    }

    // Fetch LecturerCourse rows with Course include so we can attach course objects per profile
    let coursesMap = new Map();
    if (profileIds.length) {
      const lcRows = await LecturerCourse.findAll({
        where: { lecturer_profile_id: { [Op.in]: profileIds } },
        include: [{ model: Course, attributes: ['id','course_code','course_name'] }],
        order: [['id','ASC']]
      });
      lcRows.forEach(lc => {
        const pid = lc.lecturer_profile_id;
        const courseObj = lc.Course ? { id: lc.Course.id, course_code: lc.Course.course_code, course_name: lc.Course.course_name } : null;
        if (!coursesMap.has(pid)) coursesMap.set(pid, []);
        if (courseObj) coursesMap.get(pid).push(courseObj);
      });
    }

  const data = rows.map(lp => {
      const name = lp.full_name_english || lp.full_name_khmer || lp.User?.display_name || (lp.User?.email ? lp.User.email.split('@')[0].replace(/\./g,' ') : 'Unknown');
      return {
        id: lp.User?.id,
        lecturerProfileId: lp.id,
        name,
        email: lp.User?.email,
        role: 'lecturer',
        department: lp.User?.department_name || 'General',
        status: lp.User?.status || 'active',
        lastLogin: lp.User?.last_login || 'Never',
        employeeId: lp.employee_id,
        position: lp.position,
        joinedAt: lp.join_date,
        cvUploaded: lp.cv_uploaded,
  coursesCount: countsMap.get(lp.id) || 0,
  // attach course objects when available so UI can show names
  courses: (coursesMap && coursesMap.get(lp.id)) || [],
  specializations: lp.research_fields ? lp.research_fields.split(',').map(s=>s.trim()).filter(Boolean).slice(0,5) : []
      };
    });

  const totalPages = Math.ceil(count / limit) || 1;
  return res.status(200).json({ data, meta: { page, limit, total: count, totalPages } });
  } catch (error) {
  console.error('[getLecturers] error', error.message, error.stack);
    if (error.parent) {
      console.error('[getLecturers] parent', error.parent.message);
      console.error('[getLecturers] sql', error.sql);
    }
    return res.status(500).json({ message: 'Failed to fetch lecturers', error: error.message });
  }
};

/**
 * GET /api/lecturers/:id/detail
 * Returns extended lecturer info including departments & assigned courses.
 * :id is User.id for consistency with existing routes.
 */
export const getLecturerDetail = async (req, res) => {
  try {
    const userId = parseInt(req.params.id,10);
    if(!userId) return res.status(400).json({ message: 'Invalid id' });
    const profile = await LecturerProfile.findOne({
      where: { user_id: userId },
      include: [
        { model: User, attributes: ['id','email','status','department_name','last_login'] },
        { model: Department, attributes: ['id','dept_name'], through: { attributes: [] } },
        { model: LecturerCourse, include: [{ model: Course, attributes: ['id','course_code','course_name','dept_id','hours','credits'] }] }
      ]
    });
    if(!profile) return res.status(404).json({ message: 'Lecturer not found' });
    // Department access control: admin can only view lecturers in their own department
    if (req.user?.role === 'admin' && req.user.department_name && profile.User?.department_name !== req.user.department_name) {
      return res.status(403).json({ message: 'Access denied: different department' });
    }
    const departments = profile.Departments?.map(d=> ({ id: d.id, name: d.dept_name })) || [];
    const courses = profile.LecturerCourses?.map(lc=> ({
      id: lc.Course?.id,
      course_id: lc.Course?.id,
      course_code: lc.Course?.course_code,
      course_name: lc.Course?.course_name,
      hours: lc.Course?.hours,
      credits: lc.Course?.credits,
      dept_id: lc.Course?.dept_id
    })) || [];
    return res.json({
      id: profile.User?.id,
      lecturerProfileId: profile.id,
      name: `${profile.first_name} ${profile.last_name}`.trim(),
      email: profile.User?.email,
      status: profile.User?.status,
      department: profile.User?.department_name,
      phone: profile.phone_number || null,
      departments,
      courses,
      coursesCount: courses.length,
      // Derive a single education entry from normalized profile columns so UI (which expects an array) can render it
      education: (profile.latest_degree || profile.university || profile.major || profile.degree_year) ? [
        {
          id: `edu-${profile.id}`,
          degree: profile.latest_degree || null,
          institution: profile.university || null,
          major: profile.major || null,
          year: profile.degree_year || null
        }
      ] : [],
      // Placeholder experience array (no dedicated schema yet). Extend later if/when experience history is modeled.
      experience: [],
      qualifications: profile.qualifications || null,
      research_fields: profile.research_fields || null,
      researchFields: profile.research_fields ? profile.research_fields.split(',').map(s=>s.trim()).filter(Boolean) : [],
      cvUploaded: profile.cv_uploaded,
      cvFilePath: profile.cv_file_path ? String(profile.cv_file_path).replace(/\\/g,'/').replace(/^\//,'') : null,
      syllabusUploaded: profile.upload_syllabus || false,
      syllabusFilePath: profile.course_syllabus ? String(profile.course_syllabus).replace(/\\/g,'/').replace(/^\//,'') : null,
  // Bank / payroll fields (read from Lecturer_Profiles)
      bank_name: profile.bank_name || null,
      account_name: profile.account_name || null,
      account_number: profile.account_number || null,
      payrollPath: profile.pay_roll_in_riel ? String(profile.pay_roll_in_riel).replace(/\\/g,'/').replace(/^\//,'') : null,
      lastLogin: profile.User?.last_login || 'Never'
    });
  } catch (e) {
    console.error('[getLecturerDetail] error', e);
    return res.status(500).json({ message: 'Failed to get detail', error: e.message });
  }
};

/**
 * PUT /api/lecturers/:id/courses { course_ids: number[] }
 * Replaces lecturer's assigned courses.
 */
export const updateLecturerCourses = async (req, res) => {
  try {
    const userId = parseInt(req.params.id,10);
    const courseIdsRaw = req.body.course_ids;
    if(!Array.isArray(courseIdsRaw)) return res.status(400).json({ message: 'course_ids array required' });
    const courseIds = courseIdsRaw.map(n=> parseInt(n,10)).filter(n=> Number.isInteger(n));
    if(!courseIds.length) {
      return res.status(400).json({ message: 'At least one course id required' });
    }
    const profile = await LecturerProfile.findOne({ where: { user_id: userId } });
    if(!profile) return res.status(404).json({ message: 'Lecturer not found' });
    const courses = await Course.findAll({ where: { id: courseIds } });
    await LecturerCourse.destroy({ where: { lecturer_profile_id: profile.id } });
    await LecturerCourse.bulkCreate(courses.map(c=> ({ lecturer_profile_id: profile.id, course_id: c.id })));
    return res.json({ message: 'Courses updated', count: courses.length, course_ids: courses.map(c=>c.id) });
  } catch (e) {
    console.error('[updateLecturerCourses] error', e);
    return res.status(500).json({ message: 'Failed to update courses', error: e.message });
  }
};

/**
 * PATCH /api/lecturers/:id/profile
 * Body: { qualifications?, research_fields? (array|string) }
 */
export const updateLecturerProfile = async (req, res) => {
  try {
    const userId = parseInt(req.params.id,10);
    if(!userId) return res.status(400).json({ message: 'Invalid id' });
    const profile = await LecturerProfile.findOne({ where: { user_id: userId } });
    if(!profile) return res.status(404).json({ message: 'Lecturer not found' });
  const { qualifications, research_fields, phone_number } = req.body;
    const patch = {};
    if(typeof qualifications === 'string') patch.qualifications = qualifications;
    if(research_fields) {
      if(Array.isArray(research_fields)) patch.research_fields = research_fields.map(s=> String(s).trim()).filter(Boolean).join(',');
      else if(typeof research_fields === 'string') patch.research_fields = research_fields;
    }
  if(typeof phone_number === 'string') patch.phone_number = phone_number.trim();
  if(Object.keys(patch).length === 0) return res.status(400).json({ message: 'No updatable fields supplied' });
    await profile.update(patch);
    return res.json({ message: 'Profile updated', qualifications: profile.qualifications, research_fields: profile.research_fields });
  } catch (e) {
    console.error('[updateLecturerProfile] error', e);
    return res.status(500).json({ message: 'Failed to update lecturer profile', error: e.message });
  }
};
