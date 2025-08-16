import express from 'express';
import { getCandidates, createCandidate, updateCandidate, deleteCandidate } from '../controller/candidate.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// Only admin can manage recruitment
router.use(protect, authorizeRoles('admin'));

router.get('/', getCandidates);
router.post('/', createCandidate);
router.patch('/:id', updateCandidate);
router.delete('/:id', deleteCandidate);

export default router;
