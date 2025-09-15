import { 
  User, 
  Role, 
  LecturerProfile, 
  Candidate,
  Department,
  TeachingContract,
  TeachingContractCourse,
  Course,
  LecturerCourse
} from '../model/index.js';
import { Op } from 'sequelize';
import sequelize from '../config/db.js';
import { touchPresence, countByDepartment, countAllOnline } from '../utils/presence.js';

/**
 * GET /api/dashboard/stats
 * Scopes data to the authenticated admin's department; superadmin sees global.
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Helper to keep endpoint resilient: return fallback on any sub-error
    const safe = async (fn, fallback) => {
      try { return await fn(); } catch (e) { console.error('[dashboard.stats] block failed:', e.message); return typeof fallback === 'function' ? fallback(e) : fallback; }
    };
    const role = (req.user.role || '').toLowerCase();
    const deptName = req.user.department_name || null;
    const isSuper = role === 'superadmin';

    // Resolve department scope (for admin). Super admin sees global.
    let deptId = null;
    if (!isSuper && deptName) {
      const deptRow = await Department.findOne({ where: { dept_name: deptName } });
      deptId = deptRow?.id || null;
    }

    // Helper where for Users within department (if scoped)
    const scopedUserWhere = !isSuper && deptName ? { department_name: deptName } : undefined;

    // 1) Active lecturers: union of (A) explicit department mapping and (B) actually teaching courses in dept
    let activeLecturersCount = 0;
    if (isSuper) {
      activeLecturersCount = await safe(() => LecturerProfile.count({ where: { status: 'active' } }), 0);
    } else if (deptName && deptId) {
      const [assigned, teaching] = await Promise.all([
        safe(() => LecturerProfile.findAll({
          attributes: ['id'],
          where: { status: 'active' },
          include: [{
            model: Department,
            attributes: [],
            through: { attributes: [] },
            where: { dept_name: deptName },
            required: true
          }],
          raw: true
        }), []),
        safe(() => LecturerProfile.findAll({
          attributes: ['id'],
          where: { status: 'active' },
          include: [{
            model: LecturerCourse,
            attributes: [],
            required: true,
            include: [{
              model: Course,
              attributes: [],
              required: true,
              where: { dept_id: deptId }
            }]
          }],
          raw: true
        }), [])
      ]);
      const set = new Set([ ...assigned.map(r => r.id), ...teaching.map(r => r.id) ]);
      activeLecturersCount = set.size;
    }

    // 2) Total users count (respect scope)
  const totalUsersCount = await safe(() => User.count({ where: scopedUserWhere }), 0);

    // 3a) Active contracts
  // Teaching contracts: active if not ended and in a non-completed state
    const today = new Date();
    const tcWhere = {
      status: { [Op.in]: ['WAITING_LECTURER', 'WAITING_MANAGEMENT'] },
      [Op.or]: [ { end_date: null }, { end_date: { [Op.gte]: today } } ]
    };
    // For admin: scope contracts by courses in their department; superadmin sees all
    const tcIncludeCourses = !isSuper && deptId ? [{
      model: TeachingContractCourse,
      as: 'courses',
      required: true,
      attributes: [],
      include: [{ model: Course, attributes: [], required: true, where: { dept_id: deptId } }]
    }] : [];
    const teachingActive = await safe(() => TeachingContract.count({
      where: tcWhere,
      include: tcIncludeCourses,
      distinct: true,
      col: 'TeachingContract.id'
    }), 0);

  // Contracts data source mandated: teaching_contracts only
  const activeContractsCount = teachingActive;

  // 3b) Pending contracts (awaiting management signature)
    const pendingWhere = { status: { [Op.in]: ['WAITING_MANAGEMENT'] } };
    const pendingContractsCount = await safe(() => TeachingContract.count({
      where: pendingWhere,
      include: tcIncludeCourses,
      distinct: true,
      col: 'TeachingContract.id'
    }), 0);

    // 4) Recruitment in progress (Candidates) — pending/interview/discussion
    const candidateStatuses = ['pending', 'interview', 'discussion'];
    const candWhere = { status: { [Op.in]: candidateStatuses } };
    if (!isSuper && deptId) candWhere.dept_id = deptId;
  const recruitmentInProgressCount = await safe(() => Candidate.count({ where: candWhere }), 0);

    // 4b) Contract status distribution (from teaching_contracts)
  // Use a lean include (attributes: []) to apply department scoping without selecting extra columns
  const tcIncludeLean = (tcIncludeCourses || []).map(i => ({ ...i, attributes: [] }));
  const statusRows = await safe(() => TeachingContract.findAll({
      attributes: [
        'status',
        [
          sequelize.fn(
            'COUNT',
            sequelize.fn('DISTINCT', sequelize.col('TeachingContract.id'))
          ),
          'count'
        ]
      ],
      include: tcIncludeLean,
      group: ['status']
    }), []);
    // Bucket into the requested categories, supporting both legacy and new status names
    const contractStatus = { WAITING_LECTURER: 0, WAITING_MANAGEMENT: 0, COMPLETED: 0 };
    for (const r of statusRows) {
      const raw = String(r.get('status') || '').toUpperCase().replace(/\s+/g, '_');
      const count = Number(r.get('count') || 0);
      let bucket = null;
      switch (raw) {
        case 'WAITING_LECTURER':
        case 'MANAGEMENT_SIGNED': // legacy maps to waiting lecturer
        case 'DRAFT':
          bucket = 'WAITING_LECTURER';
          break;
        case 'WAITING_MANAGEMENT':
        case 'LECTURER_SIGNED': // legacy maps to waiting management
          bucket = 'WAITING_MANAGEMENT';
          break;
        case 'COMPLETED':
          bucket = 'COMPLETED';
          break;
        default:
          break;
      }
      if (bucket) contractStatus[bucket] += count;
    }

    // 5) Applications total (from candidates table)
    // Optionally time-range filter by query param, parse '7d','30d','90d','1y'
    const { timeRange } = req.query || {};
    let since = null;
    if (timeRange === '7d') since = new Date(Date.now() - 7*24*3600*1000);
    else if (timeRange === '30d') since = new Date(Date.now() - 30*24*3600*1000);
    else if (timeRange === '90d') since = new Date(Date.now() - 90*24*3600*1000);
    else if (timeRange === '1y') since = new Date(Date.now() - 365*24*3600*1000);
    const candWhereTotal = { };
    if (since) candWhereTotal.created_at = { [Op.gte]: since };
    if (!isSuper && deptId) candWhereTotal.dept_id = deptId;
  const applicationsCount = await safe(() => Candidate.count({ where: candWhereTotal }), 0);

  // 6) Recent activities (normalized from latest created rows)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentUsers, recentAdminLogins, recentSimpleContracts, recentCandidates] = await Promise.all([
      // 2 recent users
      safe(() => User.findAll({
        where: { ...(scopedUserWhere || {}), created_at: { [Op.gte]: since24h } },
        attributes: ['id','email','display_name','created_at','status','department_name'],
        include: [{ model: Role, attributes: ['role_type'], through: { attributes: [] } }],
        order: [['created_at','DESC']],
        limit: 2
      }), []),
      // 2 recent admin logins (by last_login)
      safe(() => User.findAll({
        where: { 
          ...(scopedUserWhere || {}), 
          last_login: { [Op.gte]: since24h }
        },
        attributes: ['id','email','display_name','last_login','department_name'],
        include: [{ model: Role, attributes: ['role_type'], through: { attributes: [] }, where: { role_type: 'admin' }, required: true }],
        order: [['last_login','DESC']],
        limit: 2
      }), []),
      // 2 recent teaching contracts
      safe(() => TeachingContract.findAll({
        where: { created_at: { [Op.gte]: since24h } },
        attributes: ['id','created_at','updated_at','status','end_date','academic_year','term'],
        include: [
          ...(tcIncludeCourses || []),
          { model: User, as: 'lecturer', attributes: ['display_name','email','department_name'] }
        ],
        order: [['created_at','DESC']],
        limit: 2
      }), []),
      // 1 recent candidate (within scope)
      safe(() => Candidate.findAll({
        where: { ...(candWhere || {}), created_at: { [Op.gte]: since24h } },
        order: [['created_at','DESC']],
        limit: 1
      }), [])
    ]);

    const activities = [];
    for (const u of recentUsers) {
      const roles = Array.isArray(u.Roles) ? u.Roles.map(r => String(r.role_type || '').toLowerCase()) : [];
      const isLecturerUser = roles.includes('lecturer');
      const isAdminUser = roles.includes('admin');
      activities.push({
        id: `user-${u.id}`,
        type: isLecturerUser ? 'lecturer' : 'user',
        title: isLecturerUser ? 'Lecturer Created' : (isAdminUser ? 'Admin Created' : 'User Created'),
        name: u.display_name || u.email,
        time: u.created_at,
        status: u.status === 'active' ? 'completed' : 'pending'
      });
    }
    // Admin login activities
    for (const a of recentAdminLogins) {
      activities.push({
        id: `admin-login-${a.id}-${new Date(a.last_login).getTime()}`,
        type: 'user',
        title: 'Admin Login',
        name: a.display_name || a.email,
        time: a.last_login,
        status: 'completed'
      });
    }
    for (const c of recentSimpleContracts) {
      const rawStatus = String(c.status || '').toUpperCase();
      const contractTitle = rawStatus === 'COMPLETED' ? 'Contract Approved' : 'Contract Created';
      activities.push({
        id: `contract-${c.id}`,
        type: 'contract',
        title: contractTitle,
        name: c.lecturer?.display_name || c.lecturer?.email || 'Lecturer',
        time: c.created_at,
        status: (!c.end_date || new Date(c.end_date) >= today) ? 'in-progress' : 'expired'
      });
    }
    for (const cand of recentCandidates) {
      activities.push({
        id: `candidate-${cand.id}`,
        type: 'candidate',
        title: 'Candidate Application',
        name: cand.fullName,
        time: cand.created_at,
        status: cand.status === 'interview' ? 'scheduled' : (cand.status === 'pending' ? 'pending' : 'completed')
      });
    }

    // 7) Department stats (GLOBAL): lecturers per department across the entire system.
    // A lecturer can be counted in multiple departments if they teach there or are assigned.
    const allDepartments = await safe(() => Department.findAll({ attributes: ['id', 'dept_name'], order: [['dept_name', 'ASC']] }), []);
    const totalDepartments = Array.isArray(allDepartments) ? allDepartments.length : 0;
    const departmentDistribution = [];
    for (const dept of allDepartments) {
      const deptIdIter = dept.id;
      const deptNameIter = dept.dept_name;
      // Collect lecturer IDs assigned to this department via M:N mapping
      const assigned = await safe(() => LecturerProfile.findAll({
        attributes: ['id'],
        include: [{
          model: Department,
          attributes: [],
          through: { attributes: [] },
          where: { id: deptIdIter },
          required: true
        }],
        raw: true
      }), []);
      // Collect lecturer IDs who teach courses that belong to this department
      const teaching = await safe(() => LecturerProfile.findAll({
        attributes: ['id'],
        include: [{
          model: LecturerCourse,
          attributes: [],
          required: true,
          include: [{
            model: Course,
            attributes: [],
            required: true,
            where: { dept_id: deptIdIter }
          }]
        }],
        raw: true
      }), []);
      const uniq = new Set([ ...assigned.map(r => r.id), ...teaching.map(r => r.id) ]);
      departmentDistribution.push({ name: deptNameIter, value: uniq.size });
    }

    // 8) Monthly trends (last 6 months up to current)
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23,59,59,999));
      months.push({ label: start.toLocaleString('en-US', { month: 'short' }), start, end });
    }
    const monthlyTrends = [];
    for (const m of months) {
      const whereRange = (col='created_at') => ({ [col]: { [Op.between]: [m.start, m.end] } });
      // contracts: COMPLETED within month (prefer management_signed_at; fallback to end_date)
      const contractsCompletedWhere = {
        status: 'COMPLETED',
        [Op.or]: [
          { management_signed_at: { [Op.between]: [m.start, m.end] } },
          { end_date: { [Op.between]: [m.start, m.end] } }
        ]
      };
      const contractsCount = await safe(() => TeachingContract.count({
        where: contractsCompletedWhere,
        include: tcIncludeCourses,
        distinct: true,
        col: 'TeachingContract.id'
      }), 0);

      // lecturers: ACTIVE lecturers associated to dept and created in this month
      let lecturersCount = 0;
      if (isSuper) {
        lecturersCount = await safe(() => LecturerProfile.count({
          where: { status: 'active', ...whereRange('created_at') },
          distinct: true,
          col: 'LecturerProfile.id'
        }), 0);
      } else if (deptName && deptId) {
        const [assigned, teaching] = await Promise.all([
          safe(() => LecturerProfile.findAll({
            attributes: ['id'],
            where: { status: 'active', ...whereRange('created_at') },
            include: [{
              model: Department,
              attributes: [],
              through: { attributes: [] },
              where: { dept_name: deptName },
              required: true
            }],
            raw: true
          }), []),
          safe(() => LecturerProfile.findAll({
            attributes: ['id'],
            where: { status: 'active', ...whereRange('created_at') },
            include: [{
              model: LecturerCourse,
              attributes: [],
              required: true,
              include: [{
                model: Course,
                attributes: [],
                required: true,
                where: { dept_id: deptId }
              }]
            }],
            raw: true
          }), [])
        ]);
        const set = new Set([ ...assigned.map(r => r.id), ...teaching.map(r => r.id) ]);
        lecturersCount = set.size;
      }

      // candidates: recruitment candidates created in month (scoped)
      const candWhereMonth = whereRange('created_at');
      if (!isSuper && deptId) candWhereMonth.dept_id = deptId;
      const applicationsMonth = await safe(() => Candidate.count({ where: candWhereMonth }), 0);

      monthlyTrends.push({ month: m.label, lecturers: lecturersCount, contracts: contractsCount, applications: applicationsMonth });
    }

    // Keep only events within last 24 hours, sort by time desc and take top 5
    const activities24h = activities.filter(a => {
      const t = new Date(a.time).getTime();
      return !Number.isNaN(t) && t >= since24h.getTime();
    });
    activities24h.sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const data = {
      scope: isSuper ? 'global' : 'department',
      department: isSuper ? null : deptName,
      activeLecturers: { count: activeLecturersCount, change: 0 },
      pendingContracts: { count: pendingContractsCount, change: 0 },
      activeContracts: { count: activeContractsCount, change: 0 },
      recruitmentInProgress: { count: recruitmentInProgressCount, change: 0 },
      totalUsers: { count: totalUsersCount, change: 0 },
  recentActivities: activities24h.slice(0,5),
      applications: { count: applicationsCount, change: 0 },
      monthlyTrends,
      departmentStats: {
        totalDepartments,
        distribution: departmentDistribution
  },
  contractStatus
    };

    return res.status(200).json(data);
  } catch (error) {
    console.error('Dashboard stats error:', error.message, error.stack);
    return res.status(500).json({ message: 'Error fetching dashboard statistics' });
  }
};

/**
 * GET /api/dashboard/realtime
 * Lightweight snapshot values that can be polled frequently by the client.
 */
export const getDashboardRealtime = async (req, res) => {
  try {
    const role = (req.user.role || '').toLowerCase();
    const deptName = req.user.department_name || null;
    const isSuper = role === 'superadmin';

    // Resolve department ID for scoping (non-super admins)
    let deptId = null;
    if (!isSuper && deptName) {
      try {
        const deptRow = await Department.findOne({ where: { dept_name: deptName } });
        deptId = deptRow?.id || null;
      } catch (e) {
        // Non-fatal: fall back to unscoped if lookup fails
        deptId = null;
      }
    }

  // Department-scoped online users based on active page heartbeat presence
  const onlineUsers = isSuper ? countAllOnline() : countByDepartment(deptName);

  // Reuse active contracts calculation (teaching contracts only)
    const today = new Date();
    const tcWhere = {
      status: { [Op.in]: ['WAITING_LECTURER', 'WAITING_MANAGEMENT'] },
      [Op.or]: [ { end_date: null }, { end_date: { [Op.gte]: today } } ]
    };
    const includeCourseScope = (!isSuper && deptId) ? [{
      model: TeachingContractCourse,
      as: 'courses',
      required: true,
      attributes: [],
      include: [{ model: Course, attributes: [], required: true, where: { dept_id: deptId } }]
    }] : [];
    let teachingActive = 0;
    try {
      teachingActive = await TeachingContract.count({ where: tcWhere, include: includeCourseScope, distinct: true, col: 'TeachingContract.id' });
    } catch {
      teachingActive = 0;
    }

    // Expired contracts: contracts that have an end_date in the past (strictly before today)
    let expiredContracts = 0;
    try {
      const expiredWhere = { end_date: { [Op.lt]: today } };
      expiredContracts = await TeachingContract.count({ where: expiredWhere, include: includeCourseScope, distinct: true, col: 'TeachingContract.id' });
    } catch {
      expiredContracts = 0;
    }

    const payload = {
      onlineUsers,
      activeContracts: teachingActive,
      expiredContracts,
      systemHealth: 'good' // simple placeholder; in real systems compute from dependencies
    };
    return res.json(payload);
  } catch (error) {
    console.error('Dashboard realtime error:', error.message);
    return res.status(500).json({ message: 'Error fetching realtime stats' });
  }
};

/**
 * POST /api/dashboard/presence
 * Body: { department?: string }
 * Marks the current user as online for the specified department (or user's own department by default).
 */
export const postDashboardPresence = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const userDept = req.user.department_name || null;
    // Allow explicit department provided by client (e.g., users with multi-dept access)
    let dept = (typeof req.body?.department === 'string' && req.body.department.trim())
      ? req.body.department.trim()
      : userDept;
    if (!dept) return res.status(400).json({ message: 'Missing department' });
    touchPresence(userId, dept);
    return res.json({ ok: true });
  } catch (e) {
    console.error('Dashboard presence error:', e.message);
    return res.status(500).json({ message: 'Error updating presence' });
  }
};

/**
 * GET /api/dashboard/activities
 * Returns recent activity list similar to stats.recentActivities but larger slice.
 */
export const getDashboardActivities = async (req, res) => {
  try {
    // Leverage existing stats generator for consistency
    const fakeReq = { user: req.user };
    const acc = await new Promise((resolve, reject) => {
      // Reuse getDashboardStats but intercept res.json
      const resShim = {
        status: () => resShim,
        json: (data) => resolve(data)
      };
      getDashboardStats(fakeReq, resShim).catch(reject);
    });
    return res.json(acc.recentActivities || []);
  } catch (e) {
    console.error('Dashboard activities error:', e.message);
    return res.json([]);
  }
};

/**
 * GET /api/dashboard/notifications
 * Simple placeholder notifications based on counts; replace with real table if available.
 */
export const getDashboardNotifications = async (req, res) => {
  try {
    const role = (req.user.role || '').toLowerCase();
    const deptName = req.user.department_name || null;
    const isSuper = role === 'superadmin';

    // Resolve department ID for scoping (non-super admins)
    let deptId = null;
    if (!isSuper && deptName) {
      try {
        const deptRow = await Department.findOne({ where: { dept_name: deptName } });
        deptId = deptRow?.id || null;
      } catch {
        deptId = null;
      }
    }

    const today = new Date();
  const pendingWhere = { status: { [Op.in]: ['WAITING_MANAGEMENT', 'LECTURER_SIGNED'] } };
    const includeLecturerScope = (!isSuper && deptId) ? [{
      model: TeachingContractCourse,
      as: 'courses',
      required: true,
      attributes: [],
      include: [{ model: Course, attributes: [], required: true, where: { dept_id: deptId } }]
    }] : [];
    const pending = await TeachingContract.findAll({
      where: pendingWhere,
      include: includeLecturerScope,
      order: [['updated_at','DESC']],
      limit: 5
    });
    const notifications = pending.map(p => ({
      type: 'contract',
      message: `Contract awaiting management signature for ${p.academic_year} ${p.term}`,
      time: p.updated_at
    }));
    return res.json(notifications);
  } catch (e) {
    console.error('Dashboard notifications error:', e.message);
    return res.json([]);
  }
};
