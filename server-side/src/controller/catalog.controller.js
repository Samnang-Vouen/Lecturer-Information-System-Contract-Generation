import { Department } from '../model/user.model.js';
import Course from '../model/course.model.js';
import { Op } from 'sequelize';

// Public (to authenticated roles) catalog endpoints for onboarding etc.
export const catalogDepartments = async (req,res)=>{
  try {
    const depts = await Department.findAll({ 
      where: { dept_name: { [Op.ne]: 'General' } },
      order: [['dept_name','ASC']] 
    });
    return res.json(depts.map(d=>({ id: d.id, dept_name: d.dept_name })));
  } catch(e){
    console.error('catalogDepartments error', e);
    return res.status(500).json({ message: 'Failed to list departments' });
  }
};

export const catalogCourses = async (req,res)=>{
  try {
    const courses = await Course.findAll({ order: [['course_code','ASC']] });
    return res.json(courses.map(c=>({
      id: c.id,
      course_code: c.course_code,
      course_name: c.course_name,
      dept_id: c.dept_id
    })));
  } catch(e){
    console.error('catalogCourses error', e);
    return res.status(500).json({ message: 'Failed to list courses' });
  }
};
