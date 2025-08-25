import express from 'express';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';
import { listCourseMappings, createCourseMapping, updateCourseMapping, deleteCourseMapping } from '../controller/courseMapping.controller.js';

const router = express.Router();
router.use(protect, authorizeRoles('admin'));
router.get('/', listCourseMappings);
router.post('/', createCourseMapping);
router.put('/:id', updateCourseMapping);
router.delete('/:id', deleteCourseMapping);
export default router;
