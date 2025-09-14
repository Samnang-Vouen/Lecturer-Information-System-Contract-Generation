import { LecturerProfile, TeachingContract, Candidate, User } from '../model/index.js';
import { Op } from 'sequelize';

/**
 * Compute system-wide statistics for Super Admin dashboard.
 * Returns a plain object with numeric counts.
 */
export async function getSuperAdminDashboardData() {
  const today = new Date();

  // Active lecturers: lecturer_profiles with status = 'active'
  const activeLecturers = await LecturerProfile.count({ where: { status: 'active' } });

  // Active contracts: teaching contracts not ended and in active-like states
  const activeContracts = await TeachingContract.count({
    where: {
      status: { [Op.in]: ['WAITING_LECTURER', 'WAITING_MANAGEMENT'] },
      [Op.or]: [
        { end_date: null },
        { end_date: { [Op.gte]: today } }
      ]
    }
  });

  // Candidates: total number of candidates in the system (recruitment)
  const candidates = await Candidate.count();

  // Total users: count of all users
  const totalUsers = await User.count();

  return {
    activeLecturers,
    activeContracts,
    candidates,
    totalUsers
  };
}

// Optional: Express-style route handler for convenience
export async function superAdminDashboardDataHandler(req, res) {
  try {
    const data = await getSuperAdminDashboardData();
    return res.json(data);
  } catch (err) {
    console.error('[superadmin.dashboard.data] error:', err);
    return res.status(500).json({ message: 'Failed to fetch dashboard data' });
  }
}
