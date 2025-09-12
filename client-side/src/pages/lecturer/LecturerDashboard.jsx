import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { axiosInstance } from '../../lib/axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Calendar, Bell, RefreshCw, FileText, ArrowUp, ArrowDown, Clock,
  Activity, BarChart3, PieChart as PieChartIcon, CheckCircle, AlertCircle, XCircle, Info,
  Zap, Settings, GraduationCap, Eye
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  Bar, Line, PieChart, Pie, Cell
} from 'recharts';

export default function LecturerDashboard() {
  const { authUser } = useAuthStore();

  // UI/Chart color scheme (kept identical style to AdminHome)
  const chartColors = {
    primary: '#3B82F6',
    secondary: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#06B6D4',
    purple: '#A855F7'
  };

  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const bellRef = useRef(null);
  const panelRef = useRef(null);
  const NOTIF_KEY = 'lis:notifications';
  const [realTimeStats, setRealTimeStats] = useState({
    activeContracts: 0,
    expiredContracts: 0,
    systemHealth: 'good'
  });

  const [dashboardData, setDashboardData] = useState({
    assignedCourses: { count: 0, change: 0, trend: [] },
    totalContracts: { count: 0, change: 0, trend: [] },
    signedContracts: { count: 0, change: 0, trend: [] },
    pendingSignatures: { count: 0, change: 0, trend: [] },
  waitingManagement: { count: 0, change: 0, trend: [] },
  syllabusReminder: { needed: false, uploaded: true, message: '' },
    recentActivities: [],
    weeklyOverview: [],
  gradeDistribution: [],
  courseHoursDist: [],
  courseMappings: []
  });
  const [salaryAnalysis, setSalaryAnalysis] = useState({ totals: { khr: 0, usd: 0, hours: 0, contracts: 0 }, byContract: [], byMonth: [] });

  // Helpers to persist notifications immediately (avoid losing them on fast navigations)
  const persistNotifications = useCallback((list) => {
    try { localStorage.setItem(NOTIF_KEY, JSON.stringify(list)); } catch {}
    setNotifications(list);
  }, []);
  const markNotificationRead = useCallback((idOrKey) => {
    setNotifications((prev) => {
      const updated = (prev || []).map((x) => (x.id === idOrKey ? { ...x, read: true } : x));
      try { localStorage.setItem(NOTIF_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // Format hours text: remove any multiplier like "× 2" while keeping the hours info
  const formatHoursText = (text) => {
    if (!text || typeof text !== 'string') return '—';
    // Remove occurrences of the multiplication sign with following number, e.g., "× 2" (with optional spaces)
    const cleaned = text.replace(/×\s*\d+/g, '').replace(/\s{2,}/g, ' ').trim();
    return cleaned || '—';
  };

  // Parse hours text into separate parts (Theory Xh, Lab Yh) after cleaning
  const parseHoursParts = (text) => {
    const cleaned = formatHoursText(text);
    if (cleaned === '—') return { theory: null, lab: null, raw: cleaned };
    const theoryMatch = cleaned.match(/(Theory|Lecture)\s*\d+\s*h/i);
    const labMatch = cleaned.match(/Lab\s*\d+\s*h/i);
    const theory = theoryMatch ? theoryMatch[0].replace(/\s+/g, ' ').trim() : null;
    const lab = labMatch ? labMatch[0].replace(/\s+/g, ' ').trim() : null;
    return { theory, lab, raw: cleaned };
  };

  // Compute total hours for the contract using mapping fields
  const computeTotalHours = (m) => {
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const theoryH = num(m?.theory_hours);
    const labH = num(m?.lab_hours);
    const theoryGroups = num(m?.theory_groups) ?? 0;
    const labGroups = num(m?.lab_groups) ?? 0;
    const isCombined15h = Boolean(m?.theory_15h_combined);

    let theoryTotal = null;
    if (theoryH !== null) {
      if (isCombined15h && theoryH === 15 && (theoryGroups ?? 0) >= 2) {
        // Combined two 15h theory groups count as a single 15h load
        theoryTotal = 15;
      } else {
        const factor = theoryGroups && theoryGroups > 0 ? theoryGroups : 1;
        theoryTotal = theoryH * factor;
      }
    }

    let labTotal = null;
    if (labH !== null) {
      const factor = labGroups && labGroups > 0 ? labGroups : 1;
      labTotal = labH * factor;
    }

    // Fallback: if we don't have numeric fields, try parsing text
    if (theoryTotal === null || labTotal === null) {
      const text = String(m?.hours_text || '').trim();
      if (text) {
        // Extract numbers even if 'h' is missing
        const theoryMatch = text.match(/(Theory|Lecture)\s*(\d+)/i);
        const labMatch = text.match(/Lab\s*(\d+)/i);
        if (theoryTotal === null && theoryMatch) {
          const th = Number(theoryMatch[2]);
          const tg = Number(m?.theory_groups) || 1;
          theoryTotal = Number.isFinite(th) ? th * tg : null;
        }
        if (labTotal === null && labMatch) {
          const lh = Number(labMatch[1]);
          const lg = Number(m?.lab_groups) || 1;
          labTotal = Number.isFinite(lh) ? lh * lg : null;
        }
      }
    }

    return { theoryTotal, labTotal };
  };

  // Pretty-print helpers for table values
  const formatTerm = (t) => {
    if (!t) return '-';
    const s = String(t);
    return /^term\s*/i.test(s) ? s : `Term ${s}`;
  };
  const formatYearLevel = (y) => {
    if (y === null || y === undefined || y === '') return '-';
    return String(y).toLowerCase().startsWith('year') ? String(y) : `Year ${y}`;
  };

  // Sample datasets (fallbacks/mocks for identical visuals)
  const weeklyOverviewData = [
    { day: 'Mon', hours: 3, sessions: 2 },
    { day: 'Tue', hours: 4, sessions: 3 },
    { day: 'Wed', hours: 2, sessions: 1 },
    { day: 'Thu', hours: 5, sessions: 3 },
    { day: 'Fri', hours: 3, sessions: 2 },
    { day: 'Sat', hours: 1, sessions: 1 }
  ];

  const gradeDistributionData = [
    { name: 'A', value: 35, color: chartColors.success },
    { name: 'B', value: 30, color: chartColors.primary },
    { name: 'C', value: 20, color: chartColors.secondary },
    { name: 'D', value: 10, color: chartColors.warning },
    { name: 'F', value: 5, color: chartColors.error }
  ];

  // Task breakdown removed per request

  const generateTrend = (base, vol = 4, len = 10) =>
    Array.from({ length: len }, () => Math.max(1, Math.round(base + (Math.random() * vol * 2 - vol))));

  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true); else setIsLoading(true);

      const [coursesRes, lecturerDashRes, realtimeRes, activitiesRes, mappingsRes, salaryRes, contractsRes] = await Promise.allSettled([
        axiosInstance.get('/lecturer/courses'),
        axiosInstance.get('/lecturer-dashboard/summary'),
        axiosInstance.get('/lecturer-dashboard/realtime'),
        axiosInstance.get('/lecturer-dashboard/activities'),
        axiosInstance.get('/lecturer/course-mappings'),
        axiosInstance.get('/lecturer-dashboard/salary-analysis'),
        axiosInstance.get('/teaching-contracts', { params: { page: 1, limit: 100 } })
      ]);

      const nextData = { ...dashboardData };

      // Courses
      if (coursesRes.status === 'fulfilled') {
        const arr = Array.isArray(coursesRes.value.data) ? coursesRes.value.data : (coursesRes.value.data?.data || []);
        nextData.assignedCourses.count = arr.length;
        nextData.assignedCourses.change = Math.floor(Math.random() * 6) - 2;
        nextData.assignedCourses.trend = generateTrend(arr.length || 3, 3);

        // Build Course Hours Distribution dynamically
        try {
          const byCourse = new Map();
          for (const row of arr) {
            const name = row.course_name || 'Unknown';
            const hours = Number(row.hours) || 0;
            if (!hours) continue;
            byCourse.set(name, (byCourse.get(name) || 0) + hours);
          }
          const palette = [chartColors.success, chartColors.primary, chartColors.secondary, chartColors.warning, chartColors.error, chartColors.info, chartColors.purple];
          nextData.courseHoursDist = Array.from(byCourse.entries()).map(([name, value], idx) => ({ name, value, color: palette[idx % palette.length] }));
        } catch {
          nextData.courseHoursDist = [];
        }
      } else {
        nextData.assignedCourses = { count: 4, change: 1, trend: generateTrend(4) };
        nextData.courseHoursDist = [];
      }

  // Keep weeklyOverview mock to preserve charts visual, if desired by design
  nextData.weeklyOverview = weeklyOverviewData;

      // Contract-related metrics (from lecturer dashboard summary)
      if (lecturerDashRes.status === 'fulfilled') {
        const d = lecturerDashRes.value.data || {};
        nextData.totalContracts = { count: d.totalContracts || 0, change: 0, trend: generateTrend(Math.max(1, d.totalContracts || 1), 3) };
        nextData.signedContracts = { count: d.signedContracts || 0, change: 0, trend: generateTrend(Math.max(1, d.signedContracts || 1), 3) };
        nextData.pendingSignatures = { count: d.pendingSignatures || 0, change: 0, trend: generateTrend(Math.max(1, d.pendingSignatures || 1), 3) };
        nextData.waitingManagement = { count: d.waitingManagement || 0, change: 0, trend: generateTrend(Math.max(1, d.waitingManagement || 1), 3) };
        // estimate days left until end of current period if available
  nextData.syllabusReminder = d.syllabusReminder || { needed: false, uploaded: true, message: '' };

        // derive contractDaysLeft from nearest contract end date if present via another endpoint later; placeholder stays
      }

      // Build notifications from contracts: new items when a contract needs lecturer signature
      // or when management has signed a contract since last fetch
      if (contractsRes.status === 'fulfilled') {
        const list = Array.isArray(contractsRes.value?.data?.data)
          ? contractsRes.value.data.data
          : (Array.isArray(contractsRes.value?.data) ? contractsRes.value.data : []);

        const loadStatusMap = () => {
          try {
            const raw = localStorage.getItem('lis:lastContractStatuses');
            return raw ? JSON.parse(raw) : {};
          } catch {
            return {};
          }
        };
        const saveStatusMap = (m) => {
          try { localStorage.setItem('lis:lastContractStatuses', JSON.stringify(m)); } catch {}
        };
        const formatContractId = (c) => {
          const year = c?.created_at ? new Date(c.created_at).getFullYear() : new Date().getFullYear();
          return `CTR-${year}-${String(c?.id ?? '').padStart(3, '0')}`;
        };

  const prevMap = loadStatusMap();
  const nextMap = { ...prevMap };
  const newNotifs = [];

        for (const c of (list || [])) {
          const id = c?.id;
          if (!id) continue;
          const prev = prevMap[id];
          const cur = c?.status;

          // New or changed to a state requiring lecturer attention
          if (cur === 'DRAFT') {
            if (prev !== 'DRAFT') {
              newNotifs.push({
    id: `needs-${id}-${Date.now()}`,
                type: 'NEEDS_SIGNATURE',
                contractId: id,
                message: `Contract ${formatContractId(c)} requires your signature`,
    time: new Date().toLocaleString(),
    createdAt: new Date().toISOString(),
    read: false
              });
            }
          } else if (cur === 'MANAGEMENT_SIGNED') {
            if (prev !== 'MANAGEMENT_SIGNED') {
              newNotifs.push({
    id: `mgmt-${id}-${Date.now()}`,
                type: 'MANAGEMENT_SIGNED',
                contractId: id,
                message: `Management has signed ${formatContractId(c)}. Please review & sign`,
    time: new Date().toLocaleString(),
    createdAt: new Date().toISOString(),
    read: false
              });
            }
          }

          nextMap[id] = cur;
        }

        if (newNotifs.length) {
          setNotifications((prev) => {
            // Load persisted notifications to merge reliably
            let base = Array.isArray(prev) ? prev : [];
            try {
              const raw = localStorage.getItem(NOTIF_KEY);
              if (raw) base = JSON.parse(raw);
            } catch {}

            // Deduplicate by id
            const merged = [...newNotifs, ...base].map((n) => ({
              ...n,
              createdAt: n.createdAt || new Date().toISOString(),
              read: Boolean(n.read)
            }));
            const seen = new Set();
            const deduped = [];
            for (const n of merged) {
              if (seen.has(n.id)) continue;
              seen.add(n.id);
              deduped.push(n);
            }
            // Prune older than 30 days and cap to 50 stored items
            const now = Date.now();
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            const pruned = deduped.filter((n) => {
              const ts = Date.parse(n.createdAt || '');
              if (Number.isNaN(ts)) return true; // keep if invalid timestamp
              return (now - ts) <= thirtyDays;
            }).slice(0, 50);
            try { localStorage.setItem(NOTIF_KEY, JSON.stringify(pruned)); } catch {}
            return pruned;
          });
        }
        saveStatusMap(nextMap);
      }

      // Realtime
      if (realtimeRes.status === 'fulfilled') {
        setRealTimeStats(prev => ({ ...prev, ...realtimeRes.value.data }));
      } else {
        setRealTimeStats(prev => ({ ...prev, activeContracts: prev.activeContracts || 0, expiredContracts: prev.expiredContracts || 0, systemHealth: 'good' }));
      }

      // Activities
      if (activitiesRes.status === 'fulfilled') {
        nextData.recentActivities = (activitiesRes.value.data || []).slice(0, 10);
      } else {
  nextData.recentActivities = [
          { type: 'class', title: 'Updated syllabus for CS101', time: new Date().toLocaleString() },
          { type: 'assignment', title: 'Posted Assignment 2 for DS201', time: new Date().toLocaleString() }
        ];
      }

      // Course mappings (for Course/Theory Groups/Lab Groups/Hours)
      if (mappingsRes.status === 'fulfilled') {
        nextData.courseMappings = Array.isArray(mappingsRes.value.data) ? mappingsRes.value.data : [];
      } else {
        nextData.courseMappings = [];
      }

      // Salary analysis
      if (salaryRes.status === 'fulfilled') {
        setSalaryAnalysis(salaryRes.value.data || { totals: { khr: 0, usd: 0, hours: 0, contracts: 0 }, byContract: [], byMonth: [] });
      } else {
        setSalaryAnalysis({ totals: { khr: 0, usd: 0, hours: 0, contracts: 0 }, byContract: [], byMonth: [] });
      }

  // Static datasets
  nextData.gradeDistribution = gradeDistributionData;

      setDashboardData(nextData);
      setLastUpdated(new Date());
    } catch (e) {
      // minimal fallback
      setDashboardData(prev => ({
        ...prev,
  assignedCourses: { count: 4, change: 1, trend: generateTrend(4) },
  // Removed per request
  totalContracts: { count: 0, change: 0, trend: [] },
  signedContracts: { count: 0, change: 0, trend: [] },
  pendingSignatures: { count: 0, change: 0, trend: [] },
  waitingManagement: { count: 0, change: 0, trend: [] },
  syllabusReminder: { needed: false, uploaded: true, message: '' },
  weeklyOverview: weeklyOverviewData,
  gradeDistribution: gradeDistributionData,
  courseMappings: []
      }));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTimeRange]);

  // Load persisted notifications on mount and prune old ones
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (!raw) return;
      const list = JSON.parse(raw);
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const normalized = (Array.isArray(list) ? list : []).map((n) => ({
        ...n,
        createdAt: n.createdAt || new Date().toISOString(),
        read: Boolean(n.read),
        time: n.time || (n.createdAt ? new Date(n.createdAt).toLocaleString() : new Date().toLocaleString())
      })).filter((n) => {
        const ts = Date.parse(n.createdAt || '');
        if (Number.isNaN(ts)) return true;
        return (now - ts) <= thirtyDays;
      });
      setNotifications(normalized);
      // Save back pruned list
      localStorage.setItem(NOTIF_KEY, JSON.stringify(normalized));
    } catch {}
  }, []);

  // Persist notifications when they change (e.g., marking as read)
  useEffect(() => {
    try { localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications)); } catch {}
  }, [notifications]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  // Auto-refresh every 5 minutes (keep parity with AdminHome)
  useEffect(() => {
    const i = setInterval(() => fetchDashboardData(true), 300000);
    return () => clearInterval(i);
  }, [fetchDashboardData]);

  // Lightweight realtime updates
  useEffect(() => {
    const i = setInterval(async () => {
      try {
  const { data } = await axiosInstance.get('/lecturer-dashboard/realtime');
        setRealTimeStats(data);
      } catch {
        setRealTimeStats(prev => ({
          activeContracts: prev.activeContracts || 0,
          expiredContracts: prev.expiredContracts || 0,
          systemHealth: ['good', 'excellent', 'warning'][Math.floor(Math.random() * 3)]
        }));
      }
    }, 30000);
    return () => clearInterval(i);
  }, []);

  // Close notifications when clicking outside or pressing Escape
  useEffect(() => {
    if (!showNotifications) return;
    const onOutside = (e) => {
      const target = e.target;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (bellRef.current && bellRef.current.contains(target)) return;
      setShowNotifications(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setShowNotifications(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [showNotifications]);

  const getChangeColor = (c) => c > 0 ? 'text-green-500' : c < 0 ? 'text-red-500' : 'text-gray-500';
  const getChangeIcon = (c) => c > 0 ? <ArrowUp className='w-4 h-4' /> : c < 0 ? <ArrowDown className='w-4 h-4' /> : null;
  const getSystemHealthColor = (h) => h === 'excellent' ? 'text-green-500' : h === 'good' ? 'text-blue-500' : h === 'warning' ? 'text-yellow-500' : 'text-red-500';
  const getSystemHealthIcon = (h) => h === 'critical' ? <XCircle className='w-4 h-4' /> : h === 'warning' ? <AlertCircle className='w-4 h-4' /> : <CheckCircle className='w-4 h-4' />;

  const StatCard = ({ title, value, change, icon: Icon, description, isLoading, color = 'blue', trend = [], index = 0 }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 group ${isLoading ? 'animate-pulse' : ''} relative overflow-hidden`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br from-${color}-50 to-transparent opacity-50`}></div>
      <div className='relative z-10'>
        <div className='flex justify-between items-start mb-4'>
          <div className='flex-1'>
            <h2 className='text-sm font-semibold text-gray-700 mb-1'>{title}</h2>
            <div className='flex items-baseline gap-2'>
              <motion.span
                key={value}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={`text-3xl font-bold text-gray-900 ${isLoading ? 'bg-gray-200 rounded w-16 h-8' : ''}`}
              >
                {isLoading ? '' : Number(value).toLocaleString()}
              </motion.span>
              {/* Change indicator (percentage and arrows) removed per request */}
            </div>
            <p className='text-xs text-gray-500 mt-1'>{description}</p>
          </div>
          <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className={`p-3 bg-${color}-100 rounded-full group-hover:bg-${color}-200 transition-colors`}>
            <Icon className={`w-6 h-6 text-${color}-600`} />
          </motion.div>
        </div>
        {trend.length > 0 && (
          <div className='flex items-end gap-1 h-12 mt-4'>
            {trend.slice(-10).map((v, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${(v / Math.max(...trend)) * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={`bg-gradient-to-t from-${color}-400 to-${color}-200 rounded-sm flex-1 transition-all duration-300 hover:from-${color}-500 hover:to-${color}-300 min-h-[4px]`}
                style={{ minHeight: '4px' }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50'>
      <div className='p-4 sm:p-6 lg:p-8'>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8'
        >
          <div className='mb-4 lg:mb-0'>
            <div className='flex items-center gap-4 mb-2'>
              <motion.div whileHover={{ scale: 1.05, rotate: 5 }} className='p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white shadow-lg'>
                <BarChart3 className='w-8 h-8' />
              </motion.div>
              <div>
                <h1 className='text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'>
                  Lecturer Dashboard
                </h1>
                <div className='flex items-center gap-2 mt-1'>
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className={`w-2 h-2 rounded-full ${realTimeStats.systemHealth === 'good' ? 'bg-green-400' : 'bg-yellow-400'}`}></motion.div>
                  <span className='text-sm text-gray-600'>System Status: </span>
                  <span className={`text-sm font-medium ${getSystemHealthColor(realTimeStats.systemHealth)}`}>
                    {realTimeStats.systemHealth?.charAt(0).toUpperCase() + realTimeStats.systemHealth?.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            <p className='text-gray-600 max-w-2xl'>
              Welcome back, <span className='font-semibold text-gray-900'>{authUser?.fullName || authUser?.name || (authUser?.email ? authUser.email.split('@')[0] : 'Lecturer')}</span>
              <br />
              <span>Here's a snapshot of your courses and contracts.</span>
            </p>
          </div>

          {/* Header Controls */}
      <div className='flex items-center gap-3 flex-wrap sm:flex-nowrap'>
            <motion.select
              whileHover={{ scale: 1.02 }}
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
        className='px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm w-full sm:w-auto'
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 3 months</option>
              <option value="1y">Last year</option>
            </motion.select>

            {/* Notifications */}
            <div className='relative' ref={bellRef}>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowNotifications((v) => !v)} className='p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors relative shadow-sm' aria-haspopup='dialog' aria-expanded={showNotifications} aria-label='Notifications'>
                <Bell className='w-5 h-5 text-gray-600' />
                {notifications.filter(n => !n.read).length > 0 && (
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }} className='absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center'>
                    {notifications.filter(n => !n.read).length}
                  </motion.span>
                )}
              </motion.button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div ref={panelRef} initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} className='absolute right-0 top-12 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-xl z-50'>
                    <div className='p-4 border-b border-gray-200'>
                      <h3 className='font-semibold text-gray-900'>Notifications</h3>
                    </div>
                    <div className='max-h-64 overflow-y-auto'>
                      {notifications.length > 0 ? (
                        notifications.map((n, i) => (
                          <motion.button
                            key={n.id || i}
                            type='button'
                            onClick={() => {
                              const key = n.id || i;
                              markNotificationRead(key);
                              setShowNotifications(false);
                              // Navigate after persisting
                              window.location.href = '/lecturer/my-contracts';
                            }}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${n.read ? 'bg-white' : 'bg-blue-50/40'}`}
                          >
                            <div className='flex items-start gap-2'>
                              {!n.read && <span className='mt-1 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0' />}
                              <div>
                                <p className={`text-sm ${n.read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>{n.message || 'Notification'}</p>
                                <p className='text-xs text-gray-500 mt-1'>{n.time || new Date().toLocaleString()}</p>
                              </div>
                            </div>
                          </motion.button>
                        ))
                      ) : (
                        <div className='p-4 text-center text-gray-500'>No notifications</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Refresh */}
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => fetchDashboardData(true)} disabled={isRefreshing} className='flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm w-full sm:w-auto'>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </motion.button>

            {lastUpdated && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='text-xs text-gray-500'>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </motion.div>
            )}
          </div>
        </motion.div>

  {/* Real-time bar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className='bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-4 mb-8 shadow-sm'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
            <div className='flex flex-wrap items-center gap-4 md:gap-6'>
              <motion.div whileHover={{ scale: 1.05 }} className='flex items-center gap-2'>
    <Activity className='w-4 h-4 text-green-500' />
    <span className='text-sm text-gray-600'>Active Contracts:</span>
    <span className='font-semibold text-gray-900'>{realTimeStats.activeContracts}</span>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} className='flex items-center gap-2'>
    <Calendar className='w-4 h-4 text-blue-500' />
    <span className='text-sm text-gray-600'>Expired Contracts:</span>
    <span className='font-semibold text-gray-900'>{realTimeStats.expiredContracts}</span>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} className='flex items-center gap-2'>
                {getSystemHealthIcon(realTimeStats.systemHealth)}
                <span className='text-sm text-gray-600'>System Health:</span>
                <span className={`font-semibold ${getSystemHealthColor(realTimeStats.systemHealth)}`}>
                  {realTimeStats.systemHealth?.charAt(0).toUpperCase() + realTimeStats.systemHealth?.slice(1)}
                </span>
              </motion.div>
            </div>
            <div className='flex items-center gap-2 text-xs text-gray-500'>
              <Clock className='w-3 h-3' /> Live updates every 30s
            </div>
          </div>
        </motion.div>

        {/* Stat cards (kept minimal to match request) */}
  <div className='grid grid-cols-1 md:grid-cols-4 gap-6 mb-8'>
          <StatCard
            title='My Courses'
            value={dashboardData.assignedCourses.count}
            change={dashboardData.assignedCourses.change}
            icon={BookOpen}
            description='Assigned this term'
            isLoading={isLoading}
            color='blue'
            trend={dashboardData.assignedCourses.trend}
            index={0}
          />
          <StatCard
            title='Total Contracts'
            value={dashboardData.totalContracts.count}
            change={dashboardData.totalContracts.change}
            icon={FileText}
            description='All teaching contracts'
            isLoading={isLoading}
            color='indigo'
            trend={dashboardData.totalContracts.trend}
            index={1}
          />
          <StatCard
            title='Signed Contracts'
            value={dashboardData.signedContracts.count}
            change={dashboardData.signedContracts.change}
            icon={CheckCircle}
            description='Signed by you'
            isLoading={isLoading}
            color='green'
            trend={dashboardData.signedContracts.trend}
            index={2}
          />
          <StatCard
            title='Waiting Management'
            value={dashboardData.waitingManagement.count}
            change={dashboardData.waitingManagement.change}
            icon={Info}
            description='Awaiting management signature'
            isLoading={isLoading}
            color='amber'
            trend={dashboardData.waitingManagement.trend}
            index={3}
          />
        </div>

        {/* Syllabus reminder (only when not uploaded) */}
        { (dashboardData.syllabusReminder?.needed || dashboardData.syllabusReminder?.uploaded === false) && (
          <div className='mb-4'>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className='p-4 rounded-xl border shadow-sm bg-yellow-50 border-yellow-200'>
              <div className='flex items-center gap-3'>
                <AlertCircle className='w-5 h-5 text-yellow-600' />
                <div className='flex-1'>
                  <p className='text-sm text-yellow-800'>
                    {dashboardData.syllabusReminder?.message || 'Please upload your course syllabus'}
                  </p>
                </div>
                <button onClick={() => (window.location.href = '/lecturer/profile')} className='px-3 py-1 text-xs bg-yellow-600 text-white rounded-md hover:bg-yellow-700'>Upload</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Current Courses removed per request. Keeping Assigned Course Groups table. */}
        <div className='mb-8'>
          {/* Course Mappings table */}
          <div className='bg-white p-5 rounded-xl shadow-sm border border-gray-200'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='p-2 bg-blue-100 rounded-lg'>
                <BookOpen className='w-5 h-5 text-blue-600' />
              </div>
              <div>
                <h3 className='text-lg font-semibold text-gray-900'>Assigned Course Groups</h3>
                <p className='text-sm text-gray-600'>Course • Theory Groups • Lab Groups • Hours</p>
              </div>
            </div>
            {(dashboardData.courseMappings || []).length ? (
              <div className='overflow-x-auto'>
                <table className='min-w-full text-sm'>
                  <thead>
                    <tr className='text-left text-gray-600 sticky top-0 bg-white z-10 border-b border-gray-100'>
                      <th className='py-3 pr-6 text-xs font-semibold uppercase tracking-wide text-gray-500'>Course</th>
                      <th className='py-3 pr-6 text-xs font-semibold uppercase tracking-wide text-gray-500'>Academic Year</th>
                      <th className='py-3 pr-6 text-xs font-semibold uppercase tracking-wide text-gray-500'>Contract End Date</th>
                      <th className='py-3 pr-6 text-xs font-semibold uppercase tracking-wide text-gray-500'>Term</th>
                      <th className='py-3 pr-6 text-xs font-semibold uppercase tracking-wide text-gray-500'>Year Level</th>
                      <th className='py-3 pr-6 text-xs font-semibold uppercase tracking-wide text-gray-500'>Theory Groups</th>
                      <th className='py-3 pr-6 text-xs font-semibold uppercase tracking-wide text-gray-500'>Lab Groups</th>
                      <th className='py-3 pr-6 text-xs font-semibold uppercase tracking-wide text-gray-500'>Hours</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100'>
                    {dashboardData.courseMappings.map((m) => (
                      <tr key={m.id} className='hover:bg-gray-50'>
                        <td className='py-3 pr-6 text-gray-900 font-medium'>{m.course_name}</td>
                        <td className='py-3 pr-6 whitespace-nowrap'>
                          {m.academic_year ? (
                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200'>
                              {m.academic_year}
                            </span>
                          ) : (
                            <span className='text-gray-400'>-</span>
                          )}
                        </td>
                        <td className='py-3 pr-6 whitespace-nowrap'>
                          {m.contract_end_date ? (
                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-md text-xs bg-teal-50 text-teal-700 border border-teal-200'>
                              {new Date(m.contract_end_date).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className='text-gray-400'>-</span>
                          )}
                        </td>
                        <td className='py-3 pr-6 whitespace-nowrap'>
                          {m.term ? (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200'>
                              {formatTerm(m.term)}
                            </span>
                          ) : (
                            <span className='text-gray-400'>-</span>
                          )}
                        </td>
                        <td className='py-3 pr-6 whitespace-nowrap'>
                          {m.year_level !== null && m.year_level !== undefined && m.year_level !== '' ? (
                            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200'>
                              {formatYearLevel(m.year_level)}
                            </span>
                          ) : (
                            <span className='text-gray-400'>-</span>
                          )}
                        </td>
                        <td className='py-3 pr-6'>
                          <span className='inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200'>
                            {m.theory_groups ?? 0}
                          </span>
                        </td>
                        <td className='py-3 pr-6'>
                          <span className='inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200'>
                            {m.lab_groups ?? 0}
                          </span>
                        </td>
                        <td className='py-3 pr-6 text-gray-800 whitespace-nowrap'>
                          {(() => {
                            // Prefer the backend-provided total from contract generation if available
                            const backendTotal = Number.isFinite(+m.contract_total_hours) ? +m.contract_total_hours : null;
                            let total = backendTotal;
                            if (total == null) {
                              const { theoryTotal, labTotal } = computeTotalHours(m);
                              const hasAny = theoryTotal != null || labTotal != null;
                              if (!hasAny) return <span className='text-gray-400'>-</span>;
                              total = 0;
                              if (theoryTotal != null) total += theoryTotal;
                              if (labTotal != null) total += labTotal;
                            }
                            if (!Number.isFinite(total) || total <= 0) return <span className='text-gray-400'>-</span>;
                            return (
                              <span className='inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200'>
                                {`${total}h`}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='text-gray-500'>No assigned course groups.</div>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8'>
          {/* Lecturer Salary Analysis (per contract) */}
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className='bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-gray-200'>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-blue-100 rounded-lg'>
                  <BarChart3 className='w-5 h-5 text-blue-600' />
                </div>
                <div>
                  <h2 className='text-xl font-semibold text-gray-900'>Lecturer Salary Analysis</h2>
                  <p className='text-sm text-gray-600'>Per-contract salary within contract date range (KHR)</p>
                </div>
              </div>
              <div className='text-sm text-gray-600'>Total: <span className='font-semibold text-gray-900'>{salaryAnalysis?.totals?.khr?.toLocaleString?.('en-US') || 0} KHR</span></div>
            </div>
            <div className='h-64 md:h-72 lg:h-80'>
              <ResponsiveContainer width='100%' height='100%'>
                <ComposedChart data={salaryAnalysis.byContract} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                  <XAxis dataKey='label' stroke='#666' fontSize={12} tickLine={false} />
                  <YAxis yAxisId='left' stroke='#666' fontSize={12} tickLine={false} />
                  <YAxis yAxisId='right' orientation='right' stroke='#666' fontSize={12} tickLine={false} />
                  <Tooltip
                    formatter={(val, key)=>{
                      if (key === 'amountKhr') return [`${Number(val).toLocaleString('en-US')} KHR`, 'Salary'];
                      if (key === 'hours') return [`${val}`, 'Hours'];
                      return val;
                    }}
                    labelFormatter={(l, payload)=>{
                      const item = (payload && payload[0] && payload[0].payload) || {};
                      const sd = item.start_date ? new Date(item.start_date).toLocaleDateString() : 'n/a';
                      const ed = item.end_date ? new Date(item.end_date).toLocaleDateString() : 'n/a';
                      return `${l} • ${sd} → ${ed}`;
                    }}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Bar yAxisId='left' dataKey='amountKhr' fill={chartColors.primary} name='Salary (KHR)' radius={[4, 4, 0, 0]} />
                  <Line yAxisId='right' type='monotone' dataKey='hours' stroke={chartColors.secondary} strokeWidth={3} name='Hours' dot={{ fill: chartColors.secondary, strokeWidth: 2, r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Course Hours Distribution */}
          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className='bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-gray-200'>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-purple-100 rounded-lg'>
                  <PieChartIcon className='w-5 h-5 text-purple-600' />
                </div>
                <div>
                  <h2 className='text-xl font-semibold text-gray-900'>Course Hours Distribution</h2>
                  <p className='text-sm text-gray-600'>Total teaching hours per course</p>
                </div>
              </div>
            </div>
            <div className='h-64 md:h-72 lg:h-80'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie data={dashboardData.courseHoursDist} cx='50%' cy='50%' innerRadius={60} outerRadius={120} paddingAngle={3} dataKey='value' nameKey='name'>
                    {dashboardData.courseHoursDist.map((e, i) => (<Cell key={`cell-${i}`} fill={e.color} />))}
                  </Pie>
                  <Tooltip formatter={(val, name)=>[`${Number(val).toLocaleString('en-US')} h`, name]} contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

  {/* Performance Metrics and Task Breakdown removed per request */}

  {/* Syllabus reminder removed from here; now shown conditionally above Assigned Course Groups */}

        {/* Bottom section */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
          {/* Recent activities */}
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.7 }} className='bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-gray-200'>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-blue-100 rounded-lg'>
                  <Clock className='w-5 h-5 text-blue-600' />
                </div>
                <div>
                  <h2 className='text-xl font-semibold text-gray-900'>Recent Activities</h2>
                  <p className='text-sm text-gray-600'>Your latest actions</p>
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className='p-2 text-gray-400 hover:text-gray-600 transition-colors'>
                <Eye className='w-4 h-4' />
              </motion.button>
            </div>
            <div className='space-y-4 max-h-80 overflow-y-auto'>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.1 }} className='flex items-center gap-3 p-3 animate-pulse'>
                    <div className='w-8 h-8 bg-gray-200 rounded-full'></div>
                    <div className='flex-1'>
                      <div className='h-4 bg-gray-200 rounded w-3/4 mb-2'></div>
                      <div className='h-3 bg-gray-200 rounded w-1/2'></div>
                    </div>
                  </motion.div>
                ))
              ) : dashboardData.recentActivities.length > 0 ? (
                dashboardData.recentActivities.map((activity, index) => (
                  <motion.div key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className='flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-all duration-300 group'>
                    <motion.div whileHover={{ scale: 1.1 }} className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        activity.type === 'assignment' ? 'bg-purple-100 text-purple-600' :
                        activity.type === 'class' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                      } group-hover:scale-110 transition-transform`}>
                      {activity.type === 'assignment' ? <FileText className='w-4 h-4' /> : <Calendar className='w-4 h-4' />}
                    </motion.div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm text-gray-900 font-medium group-hover:text-blue-600 transition-colors'>
                        {activity.title || activity.description}
                      </p>
                      <p className='text-xs text-gray-500 mt-1'>{activity.time || new Date(activity.createdAt || Date.now()).toLocaleString()}</p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='text-center py-8'>
                  <Activity className='w-12 h-12 text-gray-300 mx-auto mb-3' />
                  <p className='text-gray-500'>No recent activities</p>
                  <p className='text-xs text-gray-400 mt-1'>New activities will appear here</p>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Quick actions + current teaching courses */}
          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.8 }} className='bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-gray-200'>
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-purple-100 rounded-lg'>
                  <Zap className='w-5 h-5 text-purple-600' />
                </div>
                <div>
                  <h2 className='text-xl font-semibold text-gray-900'>Quick Actions</h2>
                  <p className='text-sm text-gray-600'>Common tasks</p>
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className='p-2 text-gray-400 hover:text-gray-600 transition-colors'>
                <Settings className='w-4 h-4' />
              </motion.button>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} className='group p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-200 hover:from-yellow-100 hover:to-orange-100 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md' onClick={() => (window.location.href = '/lecturer/my-contracts')}>
                <div className='flex items-center gap-3 mb-3'>
                  <motion.div whileHover={{ rotate: 10 }} className='p-2 bg-yellow-100 group-hover:bg-yellow-200 rounded-lg transition-colors'>
                    <GraduationCap className='w-5 h-5 text-yellow-600' />
                  </motion.div>
                  <div>
                    <h3 className='font-semibold text-yellow-700 group-hover:text-yellow-800'>View Contract</h3>
                    <p className='text-xs text-yellow-600'>Status & download</p>
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-yellow-600'>Contract details</span>
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className='w-4 h-4 bg-yellow-200 rounded-full' />
                </div>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} className='group p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 hover:from-purple-100 hover:to-pink-100 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md' onClick={() => (window.location.href = '/lecturer/profile')}>
                <div className='flex items-center gap-3 mb-3'>
                  <motion.div whileHover={{ rotate: 10 }} className='p-2 bg-purple-100 group-hover:bg-purple-200 rounded-lg transition-colors'>
                    <Settings className='w-5 h-5 text-purple-600' />
                  </motion.div>
                  <div>
                    <h3 className='font-semibold text-purple-700 group-hover:text-purple-800'>Update Profile</h3>
                    <p className='text-xs text-purple-600'>Personal details</p>
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-purple-600'>Edit information</span>
                  <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <ArrowUp className='w-4 h-4 text-purple-400 rotate-45' />
                  </motion.div>
                </div>
              </motion.div>
            </div>

            {/* Additional mini stats (trimmed to requested data only) */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className='mt-6 pt-6 border-t border-gray-200'>
              <div className='grid grid-cols-1 sm:grid-cols-4 gap-4'>
                {[
                  { label: 'Courses', value: dashboardData.assignedCourses.count, icon: BookOpen, color: 'blue' },
                  { label: 'Total Contracts', value: dashboardData.totalContracts.count, icon: FileText, color: 'indigo' },
                  { label: 'Signed Contracts', value: dashboardData.signedContracts.count, icon: CheckCircle, color: 'green' },
                  { label: 'Waiting Management', value: dashboardData.waitingManagement.count, icon: Info, color: 'amber' }
                ].map((stat, index) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 + index * 0.1 }} className='text-center group'>
                    <motion.div whileHover={{ scale: 1.1 }} className={`inline-flex items-center justify-center w-8 h-8 bg-${stat.color}-100 rounded-full mb-2 group-hover:bg-${stat.color}-200 transition-colors`}>
                      <stat.icon className={`w-4 h-4 text-${stat.color}-600`} />
                    </motion.div>
                    <div className='text-2xl font-bold text-gray-900'>{stat.value}</div>
                    <div className='text-xs text-gray-500'>{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
