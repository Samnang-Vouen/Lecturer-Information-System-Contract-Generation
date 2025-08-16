import express from 'express';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';
import { getInterviewQuestions, addInterviewQuestion, updateInterviewQuestion, searchInterviewQuestions, addCandidateQuestion } from '../controller/interview.controller.js';

const router = express.Router();

// Apply auth & role only to the defined interview endpoints, avoiding unintended interception of other /api/* paths
router.get('/interview-questions', protect, authorizeRoles(['admin']), getInterviewQuestions);
router.post('/interview-questions', protect, authorizeRoles(['admin']), addInterviewQuestion);
router.put('/interview-questions/:id', protect, authorizeRoles(['admin']), updateInterviewQuestion);
router.get('/interview-questions/search', protect, authorizeRoles(['admin']), searchInterviewQuestions);
router.post('/candidate-questions', protect, authorizeRoles(['admin']), addCandidateQuestion);

export default router;
