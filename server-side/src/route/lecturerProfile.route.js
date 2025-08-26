import express from 'express';
import multer from 'multer';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';
import { getMyLecturerProfile, updateMyLecturerProfile, uploadLecturerFiles } from '../controller/lecturerProfile.controller.js';

const router = express.Router();

router.use(protect, authorizeRoles(['lecturer','admin','superadmin']));

router.get('/me', getMyLecturerProfile);
router.put('/me', updateMyLecturerProfile);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.post('/me/files', upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'syllabus', maxCount: 1 }
]), uploadLecturerFiles);

export default router;
