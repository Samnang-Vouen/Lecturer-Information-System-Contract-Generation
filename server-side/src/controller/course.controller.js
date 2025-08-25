import { Department } from '../model/user.model.js';
import Course from '../model/course.model.js';

function validateCourse(body){
  const errors = [];
  if(!body.course_code || !body.course_code.trim()) errors.push('course_code required');
  if(!body.course_name || !body.course_name.trim()) errors.push('course_name required');
  return errors;
}

export const listCourses = async (req,res)=>{
  try {
    const { dept_id, dept_name } = req.query;
    let where = {};
    // If superadmin, allow optional filtering by query params
    if(req.user.role === 'superadmin'){
      if(dept_id) where.dept_id = dept_id;
      if(!where.dept_id && dept_name){
        const dept = await Department.findOne({ where: { dept_name: dept_name } });
        if(dept) where.dept_id = dept.id; else return res.json({ data: [], page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false, note: 'Paginated courses list' });
      }
    } else {
      // For admins, always restrict to their own department
      if(req.user.department_name){
        const dept = await Department.findOne({ where: { dept_name: req.user.department_name } });
        if(!dept) return res.status(400).json({ message: 'Your department not found' });
        where.dept_id = dept.id;
      } else {
        return res.status(400).json({ message: 'Department not set on your account' });
      }
    }

    // Pagination params (default page=1, limit=10, max limit=50)
    let page = parseInt(req.query.page || '1', 10);
    let limit = parseInt(req.query.limit || '10', 10);
    if(isNaN(page) || page < 1) page = 1;
    if(isNaN(limit) || limit < 1) limit = 10;
    if(limit > 50) limit = 50;
    const offset = (page - 1) * limit;

    const { rows, count } = await Course.findAndCountAll({ where, order: [['course_code','ASC']], limit, offset });
    const totalPages = Math.ceil(count / limit) || 1;
    const hasMore = page < totalPages;
    return res.json({
      data: rows.map(c=>({
        id: c.id,
        course_code: c.course_code,
        course_name: c.course_name,
        description: c.description,
        hours: c.hours,
        credits: c.credits,
        dept_id: c.dept_id
      })),
      page,
      limit,
      total: count,
      totalPages,
      hasMore,
      note: 'Server-side pagination enabled'
    });
  } catch (e){
    console.error('listCourses error', e);
    return res.status(500).json({ message: 'Failed to list courses' });
  }
};

export const createCourse = async (req,res)=>{
  try {
    const errors = validateCourse(req.body);
    if(errors.length) return res.status(400).json({ message: 'Validation failed', errors });
    // Department enforcement: if superadmin provided dept_id or dept_name use it, else resolve from user
    let deptId = null;
    if(req.user.role === 'superadmin'){
      if(req.body.dept_id){
        deptId = req.body.dept_id;
      } else if(req.body.dept_name){
        const dept = await Department.findOne({ where: { dept_name: req.body.dept_name } });
        if(dept) deptId = dept.id; else return res.status(400).json({ message: 'Unknown department name' });
      }
    }
    if(!deptId){
      if(!req.user.department_name) return res.status(400).json({ message: 'Department not set on your account' });
      const dept = await Department.findOne({ where: { dept_name: req.user.department_name } });
      if(!dept) return res.status(400).json({ message: 'Your department not found' });
      deptId = dept.id;
    }

    const existing = await Course.findOne({ where: { course_code: req.body.course_code, dept_id: deptId } });
    if(existing) return res.status(409).json({ message: 'Course code already exists in department' });

    const created = await Course.create({
      dept_id: deptId,
      course_code: req.body.course_code.trim(),
      course_name: req.body.course_name.trim(),
      description: req.body.description || null,
      hours: req.body.hours || null,
      credits: req.body.credits || null
    });
  return res.status(201).json({ message: 'Course created', course: created });
  } catch (e){
    console.error('createCourse error', e);
    return res.status(500).json({ message: 'Failed to create course' });
  }
};

export const updateCourse = async (req,res)=>{
  try {
    const id = req.params.id;
    const course = await Course.findByPk(id);
    if(!course) return res.status(404).json({ message: 'Course not found' });
    const payload = {};
    ['course_code','course_name','description','hours','credits'].forEach(f=>{
      if(req.body[f] !== undefined) payload[f] = req.body[f];
    });
    if(Object.keys(payload).length===0) return res.status(400).json({ message: 'No fields to update' });
    await course.update(payload);
    return res.json({ message: 'Course updated', course });
  } catch (e){
    console.error('updateCourse error', e);
    return res.status(500).json({ message: 'Failed to update course' });
  }
};

export const deleteCourse = async (req,res)=>{
  try {
    const id = req.params.id;
    const course = await Course.findByPk(id);
    if(!course) return res.status(404).json({ message: 'Course not found' });
    await course.destroy();
    return res.json({ message: 'Course deleted' });
  } catch (e){
    console.error('deleteCourse error', e);
    return res.status(500).json({ message: 'Failed to delete course' });
  }
};
