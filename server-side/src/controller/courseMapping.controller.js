// Course Mapping controller (lecturer-course-class assignments)
import { Op } from 'sequelize';
import CourseMapping from '../model/courseMapping.model.js';
import ClassModel from '../model/class.model.js';
import Course from '../model/course.model.js';
import { LecturerProfile, Department } from '../model/user.model.js';

// Helper to resolve department id based on admin's department
async function resolveDeptId(req) {
  if (req.user?.role === 'admin' && req.user.department_name) {
    const dept = await Department.findOne({ where: { dept_name: req.user.department_name } });
    return dept ? dept.id : null;
  }
  return null;
}

export const listCourseMappings = async (req, res) => {
  try {
    const academicYear = (req.query.academic_year || '').trim();
    const deptId = await resolveDeptId(req);
    const where = {};
    if (deptId) where.dept_id = deptId;
    if (academicYear) where.academic_year = academicYear;

    // Pagination params (default 10 per page for infinite scroll)
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100); // cap at 100
    const offset = (page - 1) * limit;

    const { rows, count } = await CourseMapping.findAndCountAll({
      where,
      include: [
        { model: ClassModel, attributes: ['id','name','term','year_level','academic_year','total_class'] },
        { model: Course, attributes: ['id','course_code','course_name','hours','credits'] },
        { model: LecturerProfile, attributes: ['id','full_name_english','full_name_khmer'] }
      ],
      order: [['updated_at','DESC']],
      limit,
      offset
    });

    const data = rows.map(r => ({
      id: r.id,
      class_id: r.class_id,
      course_id: r.course_id,
      lecturer_profile_id: r.lecturer_profile_id,
      academic_year: r.academic_year,
      term: r.term,
      year_level: r.year_level,
      group_count: r.group_count,
      type_hours: r.type_hours,
      availability: r.availability,
      status: r.status,
      contacted_by: r.contacted_by,
      comment: r.comment,
      class: r.Class ? { id: r.Class.id, name: r.Class.name, term: r.Class.term, year_level: r.Class.year_level, academic_year: r.Class.academic_year, total_class: r.Class.total_class } : null,
      course: r.Course ? { id: r.Course.id, code: r.Course.course_code, name: r.Course.course_name, hours: r.Course.hours, credits: r.Course.credits } : null,
      lecturer: r.LecturerProfile ? { id: r.LecturerProfile.id, name: r.LecturerProfile.full_name_english || r.LecturerProfile.full_name_khmer } : null
    }));

    const totalPages = Math.ceil(count / limit) || 1;
    const hasMore = page < totalPages;
    return res.json({ data, page, limit, total: count, totalPages, hasMore, note: 'Paginated: server-side pagination with page & limit (default 10) for infinite scroll' });
  } catch (e) {
    console.error('[listCourseMappings]', e);
    return res.status(500).json({ message: 'Failed to list course mappings', error: e.message });
  }
};

export const createCourseMapping = async (req, res) => {
  try {
    const { class_id, course_id, lecturer_profile_id, academic_year, term, year_level, group_count, type_hours, availability, status, contacted_by, comment } = req.body;
    console.log('[createCourseMapping] incoming', req.body);
    if (!class_id || !course_id || !academic_year || !term) {
      return res.status(400).json({ message: 'class_id, course_id, academic_year, term required' });
    }
    // Ensure referenced class exists & in same department scope
    const cls = await ClassModel.findByPk(class_id);
    if (!cls) return res.status(400).json({ message: 'Invalid class_id' });
    // course_id may be a numeric id or an embedded object index; only accept integer
    const parsedCourseId = parseInt(course_id,10);
    if (!Number.isInteger(parsedCourseId)) {
      return res.status(400).json({ message: 'course_id must be an existing Course numeric id' });
    }
    const course = await Course.findByPk(parsedCourseId);
    if (!course) return res.status(400).json({ message: 'Invalid course_id (Course not found)' });
    const deptId = await resolveDeptId(req);
    const created = await CourseMapping.create({
      class_id,
      course_id: parsedCourseId,
      lecturer_profile_id: lecturer_profile_id || null,
      academic_year,
      term,
      year_level: year_level || null,
      group_count: group_count || 1,
      type_hours: type_hours || 'Theory (15h)',
      availability: availability || null,
      status: status || 'Pending',
      contacted_by: contacted_by || null,
      comment: comment || null,
      dept_id: deptId
    });
    return res.status(201).json({ id: created.id });
  } catch (e) {
    console.error('[createCourseMapping] error', e?.message, e?.stack, e?.original?.sqlMessage);
    // Provide clearer FK error surface
    if (e?.original?.code === 'ER_NO_REFERENCED_ROW_2' || /a foreign key constraint fails/i.test(e?.original?.sqlMessage||'')) {
      return res.status(400).json({ message: 'Foreign key constraint failed (check class_id and course_id exist)' });
    }
    return res.status(500).json({ message: 'Failed to create mapping', error: e.message });
  }
};

export const updateCourseMapping = async (req, res) => {
  try {
    const id = parseInt(req.params.id,10);
    const mapping = await CourseMapping.findByPk(id);
    if (!mapping) return res.status(404).json({ message: 'Mapping not found' });
    const deptId = await resolveDeptId(req);
    if (deptId && mapping.dept_id !== deptId) return res.status(403).json({ message: 'Access denied' });
    const allowed = ['lecturer_profile_id','group_count','type_hours','availability','status','contacted_by','comment'];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    await mapping.update(patch);
    return res.json({ message: 'Updated' });
  } catch (e) {
    console.error('[updateCourseMapping]', e);
    return res.status(500).json({ message: 'Failed to update mapping', error: e.message });
  }
};

export const deleteCourseMapping = async (req, res) => {
  try {
    const id = parseInt(req.params.id,10);
    const mapping = await CourseMapping.findByPk(id);
    if (!mapping) return res.status(404).json({ message: 'Mapping not found' });
    const deptId = await resolveDeptId(req);
    if (deptId && mapping.dept_id !== deptId) return res.status(403).json({ message: 'Access denied' });
    await mapping.destroy();
    return res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('[deleteCourseMapping]', e);
    return res.status(500).json({ message: 'Failed to delete mapping', error: e.message });
  }
};
