// These imports are commented out until needed for actual DB queries
// import Lecturer from '../model/lecturer.model.js';
// import User from '../model/user.model.js';
// import Candidate from '../model/candidate.model.js';

import { User, Role, UserRole, LecturerProfile } from '../model/index.js';
import { Op, Sequelize } from 'sequelize';

/**
 * GET /api/dashboard/stats
 * Scopes data to the authenticated admin's department; superadmin sees global.
 */
export const getDashboardStats = async (req, res) => {
  try {
    const role = req.user.role?.toLowerCase();
    const dept = req.user.department_name || null;
    const isSuper = role === 'superadmin';

    // Active lecturers count
    const lecturerRole = await Role.findOne({ where: { role_type: 'lecturer' } });
    let activeLecturersCount = 0;
    if (lecturerRole) {
      const whereUser = { status: 'active' };
      if (!isSuper && dept) whereUser.department_name = dept;
      activeLecturersCount = await User.count({
        where: whereUser,
        include: [{ model: Role, where: { role_type: 'lecturer' }, through: { attributes: [] }, required: true }]
      });
    }

    // Total users (department scoped for admin)
    const totalUsersWhere = !isSuper && dept ? { department_name: dept } : undefined;
    const totalUsersCount = await User.count({ where: totalUsersWhere });

    // Pending contracts / renewals / recruitment placeholders (scope-aware placeholders)
    // TODO: Replace with real queries once contract & candidate tables exist.
    const multiplier = isSuper ? 1 : 0.2; // smaller numbers for a single department view
    const randomize = (base) => Math.round(base * multiplier);

    const data = {
      scope: isSuper ? 'global' : 'department',
      department: isSuper ? null : dept,
      activeLecturers: { count: activeLecturersCount, change: 0 },
      pendingContracts: { count: randomize(40), change: 0 },
      renewals: { count: randomize(30), change: 0 },
      recruitmentInProgress: { count: randomize(25), change: 0 },
      totalUsers: { count: totalUsersCount, change: 0 },
      recentActivities: []
    };

    return res.status(200).json(data);
  } catch (error) {
    console.error('Dashboard stats error:', error.message, error.stack);
    return res.status(500).json({ message: 'Error fetching dashboard statistics' });
  }
};
