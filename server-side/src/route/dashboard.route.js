import express from 'express';
import { getDashboardStats } from '../controller/dashboard.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// Protect all dashboard routes - require authentication and appropriate role
router.use(protect);
// Allow both superadmin and admin to view dashboard stats (extend as needed)
router.use(authorizeRoles(['superadmin', 'admin']));

// GET /api/dashboard/stats
router.get('/stats', getDashboardStats);

export default router;
