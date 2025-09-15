import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { axiosInstance } from '../../lib/axios.js';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../../components/ui/Button.jsx';
import {
  BarChart3, FileText, RefreshCw, Bell, ArrowUp, ArrowDown,
  Activity, Clock, AlertCircle, CheckCircle, XCircle, Info,
  Calendar, Building, Shield, Filter, Zap, Users, Settings, ArrowUpRight, FilePlus2, GraduationCap
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Cell, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function ManagementHome() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastViewedAt, setLastViewedAt] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifContainerRef = useRef(null);
  // Refs to avoid stale values inside async/polled fetches
  const lastViewedAtRef = useRef(0);
  const showNotificationsRef = useRef(false);

  // Load persisted last seen timestamp on mount
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem('mgmtNotifLastSeenTs')) || 0;
      if (Number.isFinite(v) && v > 0) setLastViewedAt(v);
    } catch {}
  }, []);

  // Keep refs in sync with latest state (prevents stale closure issues in polling)
  useEffect(() => { lastViewedAtRef.current = lastViewedAt; }, [lastViewedAt]);
  useEffect(() => { showNotificationsRef.current = showNotifications; }, [showNotifications]);

  const [realTimeStats, setRealTimeStats] = useState({
    onlineUsers: 0,
    activeContracts: 0,
    pendingApprovals: 0,
    systemHealth: 'good'
  });
  const [signedLecturersCount, setSignedLecturersCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);

  const [dashboard, setDashboard] = useState({
    totals: { all: 0, lecturerSigned: 0, mgmtSigned: 0, completed: 0 },
    monthly: [],
    recentActivities: []
  });

  const chartColors = useMemo(() => ({
    primary: '#3B82F6',
    secondary: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#06B6D4',
    gradient: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']
  }), []);

  // Map backend statuses to user-friendly labels and UI classes
  const statusToUi = useCallback((rawStatus) => {
    const st = String(rawStatus || '').toUpperCase();
    switch (st) {
      case 'WAITING_LECTURER':
        return { label: 'Waiting Lecturer', chipClass: 'bg-sky-50 text-sky-700 border border-sky-100', dotClass: 'bg-sky-500' };
      case 'WAITING_MANAGEMENT':
        return { label: 'Waiting Management', chipClass: 'bg-amber-50 text-amber-700 border border-amber-100', dotClass: 'bg-amber-500' };
      case 'MANAGEMENT_SIGNED':
        return { label: 'Waiting Lecturer', chipClass: 'bg-sky-50 text-sky-700 border border-sky-100', dotClass: 'bg-sky-500' };
      case 'LECTURER_SIGNED':
        return { label: 'Waiting Management', chipClass: 'bg-amber-50 text-amber-700 border border-amber-100', dotClass: 'bg-amber-500' };
      case 'COMPLETED':
        return { label: 'Completed', chipClass: 'bg-green-50 text-green-700 border border-green-100', dotClass: 'bg-green-500' };
      default:
        return { label: String(rawStatus || '').replaceAll('_', ' ') || 'Updated', chipClass: 'bg-slate-50 text-slate-700 border border-slate-200', dotClass: 'bg-slate-300' };
    }
  }, []);

  const contractStatusData = useMemo(() => ([
    // Rename statuses for clarity: "Waiting Lecturer" = management has signed, waiting on lecturer
    { status: 'Waiting Lecturer', count: dashboard.totals.mgmtSigned, color: chartColors.primary },
    // "Waiting Management" = lecturer has signed, waiting on management
    { status: 'Waiting Management', count: dashboard.totals.lecturerSigned, color: chartColors.warning },
    { status: 'Completed', count: dashboard.totals.completed, color: chartColors.success }
  ]), [dashboard.totals, chartColors]);

  // Mini bar trends for stat cards with a randomized walk to keep visuals lively
  const statTrends = useMemo(() => {
    const m = dashboard.monthly || [];

    // Helper: build a random walk anchored around a base value
    const randomWalk = (base = 5, len = 10, vol = 3) => {
      const arr = [];
      let v = Math.max(0, Math.round(base));
      for (let i = 0; i < len; i++) {
        // step in range [-vol, +vol], bias slightly toward base to avoid drifting too far
        const drift = (base - v) * 0.25; // pull back toward base
        const step = Math.round((Math.random() * 2 - 1) * vol + drift);
        v = Math.max(0, v + step);
        arr.push(v);
      }
      return arr;
    };

    // Get base values from monthly data; if empty/flat, fall back to totals
    const seriesBase = (arr, fallback = 5) => {
      const clean = arr.filter(n => Number.isFinite(Number(n))).map(Number);
      if (!clean.length) return fallback;
      const avg = clean.reduce((a, b) => a + b, 0) / clean.length;
      return Math.max(1, Math.round(avg));
    };

    const submittedSeries = m.map(x => Number(x.submitted || 0));
    const approvedSeries = m.map(x => Number(x.approved || 0));
    const completedSeries = m.map(x => Number(x.completed || 0));
    const waitingMgmtSeries = m.map(x => Math.max(0, Number(x.submitted || 0) - Number(x.approved || 0)));

    const fallbackAll = Number(dashboard?.totals?.all || 5);
    const fallbackMgmtSigned = Number(dashboard?.totals?.mgmtSigned || 3);
    const fallbackLecturerSigned = Number(dashboard?.totals?.lecturerSigned || 2);
    const fallbackCompleted = Number(dashboard?.totals?.completed || 1);

    const baseAll = seriesBase(submittedSeries, fallbackAll);
    const baseMgmtSigned = seriesBase(approvedSeries, fallbackMgmtSigned);
    const baseLecturerAwaitingMgmt = seriesBase(waitingMgmtSeries, fallbackLecturerSigned);
    const baseCompleted = seriesBase(completedSeries, fallbackCompleted);

    // Volatility scales with base (higher base => larger swings), minimum 2 for visible movement
    const volFor = (base) => Math.max(2, Math.round(base * 0.6));

    return {
      all: randomWalk(baseAll, 10, volFor(baseAll)),
      lecturerAwaitingMgmt: randomWalk(baseLecturerAwaitingMgmt, 10, volFor(baseLecturerAwaitingMgmt)),
      mgmtSigned: randomWalk(baseMgmtSigned, 10, volFor(baseMgmtSigned)),
      completed: randomWalk(baseCompleted, 10, volFor(baseCompleted))
    };
  }, [dashboard.monthly, dashboard.totals]);

  const rangeToMonths = useCallback((range) => {
    // return how many months to show based on selected range
    switch (range) {
      case '7d': return 2; // show current + previous month
      case '30d': return 3;
      case '90d': return 6;
      case '1y': return 12;
      default: return 6;
    }
  }, []);

  const buildMonthlySeries = useCallback((contracts, range) => {
    const monthsCount = rangeToMonths(range);
    const now = new Date();
    // Build a map for last N months
    const months = [];
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: d.toLocaleString(undefined, { month: 'short' }), submitted: 0, approved: 0, completed: 0, waitingLecturer: 0, waitingManagement: 0 });
    }
    const idxByKey = Object.fromEntries(months.map((m, i) => [m.key, i]));

    const getKey = (dt) => {
      if (!dt) return null;
      const d = new Date(dt);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    for (const c of (contracts || [])) {
      const kCreated = getKey(c.created_at || c.createdAt);
      if (kCreated && kCreated in idxByKey) months[idxByKey[kCreated]].submitted += 1;

      const kMgmt = getKey(c.management_signed_at || c.managementSignedAt);
      if (kMgmt && kMgmt in idxByKey) months[idxByKey[kMgmt]].approved += 1;

      if ((c.status || '').toUpperCase() === 'COMPLETED') {
        const kComp = getKey(c.management_signed_at || c.managementSignedAt || c.updated_at || c.updatedAt);
        if (kComp && kComp in idxByKey) months[idxByKey[kComp]].completed += 1;
      }
    }

    // Derive waiting states for each month (approximation using monthly event counts)
    for (const m of months) {
      m.waitingManagement = Math.max(0, (m.submitted || 0) - (m.approved || 0));
      m.waitingLecturer = Math.max(0, (m.approved || 0) - (m.completed || 0));
    }

    return months.map(m => ({
      month: m.label,
      // keep raw metrics used elsewhere
      submitted: m.submitted,
      approved: m.approved,
      completed: m.completed,
      // new series for chart
      waitingLecturer: m.waitingLecturer,
      waitingManagement: m.waitingManagement
    }));
  }, [rangeToMonths]);

  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true); else setIsLoading(true);

      // Fetch real data from contracts and users; compute dashboard locally
      const [contractsRes, healthRes, waitMgmtTotalRes, completedTotalRes] = await Promise.allSettled([
        axiosInstance.get('/teaching-contracts', { params: { page: 1, limit: 100 } }),
        axiosInstance.get('/health'),
        // Department-scoped total of contracts waiting management (lecturer signed)
        axiosInstance.get('/teaching-contracts', { params: { page: 1, limit: 1, status: 'WAITING_MANAGEMENT' } }),
        // Department-scoped total of completed contracts (lecturer has signed and management too)
        axiosInstance.get('/teaching-contracts', { params: { page: 1, limit: 1, status: 'COMPLETED' } })
      ]);

      let contracts = [];
      if (contractsRes.status === 'fulfilled') contracts = contractsRes.value.data?.data || [];

      // Totals from real contracts (support new and legacy statuses)
      const totals = contracts.reduce((acc, c) => {
        const st = String(c.status || '').toUpperCase();
        acc.all += 1;
        if (st === 'WAITING_MANAGEMENT' || st === 'LECTURER_SIGNED') acc.lecturerSigned += 1; // awaiting management
        else if (st === 'WAITING_LECTURER' || st === 'MANAGEMENT_SIGNED' || st === 'DRAFT') acc.mgmtSigned += 1; // awaiting lecturer
        else if (st === 'COMPLETED') acc.completed += 1;
        return acc;
      }, { all: 0, lecturerSigned: 0, mgmtSigned: 0, completed: 0 });

      // Monthly trends based on real timestamps
  const monthly = buildMonthlySeries(contracts, selectedTimeRange);

      // Recent activities: latest actions performed by management users in their department(s)
      // Use management_signed_at to infer management-led actions and show lecturer when relevant
      const recent = (() => {
        const events = [];
        for (const c of (contracts || [])) {
          const ms = c.management_signed_at || c.managementSignedAt;
          if (!ms) continue;
          const ts = new Date(ms);
          if (isNaN(ts.getTime())) continue;
          const ui = statusToUi(c.status);
          const who = (c.lecturer?.display_name || c.lecturer?.email || 'Lecturer');
          const time = new Date(c.updated_at || c.created_at).toLocaleString();
          events.push({
            ts: ts.getTime(),
            message: `${who}'s contract`,
            time,
            statusLabel: ui.label,
            chipClass: ui.chipClass,
            dotClass: ui.dotClass
          });
        }
        // Include a login activity on initial load to reflect a management action
        if (!showRefresh) {
          const now = new Date();
          events.push({
            ts: now.getTime(),
            message: 'Management login',
            time: now.toLocaleString(),
            statusLabel: 'Management activity',
            chipClass: 'bg-violet-50 text-violet-700 border border-violet-100',
            dotClass: 'bg-violet-500'
          });
        }
        return events
          .sort((a, b) => (b.ts || 0) - (a.ts || 0))
          .slice(0, 5)
          .map(({ ts, ...rest }) => rest);
      })();

  setDashboard({ totals, monthly, recentActivities: recent });

  // Notifications: last 30 days, with automatic cleanup of older items
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      const since = Date.now() - THIRTY_DAYS;
      const notis = contracts
        .filter(c => new Date(c.updated_at || c.created_at).getTime() >= since)
        .map(c => {
          const d = new Date(c.updated_at || c.created_at);
          const ui = statusToUi(c.status);
          return ({ message: `Contract #${c.id} ${ui.label}.`, time: d.toLocaleString(), ts: d.getTime() });
        })
        .filter(n => (n.ts || 0) >= since)
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setNotifications(notis);
      // Persist/compute read-state using refs to ensure we never regress on auto-refresh
      const sinceViewed = lastViewedAtRef.current || 0;
      const maxTs = notis.reduce((m, n) => Math.max(m, n.ts || 0), sinceViewed);
      if (showNotificationsRef.current) {
        // While viewing, badge should show 0; an effect below marks as read after open.
        setUnreadCount(0);
      } else {
        const unread = notis.filter(n => (n.ts || 0) > sinceViewed).length;
        setUnreadCount(unread);
      }

  // Real-time bar values
  // Online Users: number of lecturers currently signed under this management (management-signed/waiting_lecturer or completed)
      let onlineUsers = 0;
      try {
        const signedLecturerIds = new Set(
          (contracts || [])
            .filter(c => {
              const st = String(c.status || '').toUpperCase();
              return st === 'WAITING_LECTURER' || st === 'MANAGEMENT_SIGNED' || st === 'COMPLETED';
            })
            .map(c =>
              // Try various possible id fields
              c.lecturer_id ?? c.lecturerId ?? c.lecturer?.id ?? c.lecturer?.user_id ?? c.lecturer?.userId ?? c.lecturer?.email ?? null
            )
            .filter(Boolean)
        );
        onlineUsers = signedLecturerIds.size;
      } catch {
        onlineUsers = 0;
      }
  const systemHealth = (healthRes.status === 'fulfilled' && healthRes.value.data?.status === 'ok') ? 'excellent' : 'warning';
  // pendingApprovals here represents contracts waiting on the lecturer's signature
  setRealTimeStats({ onlineUsers, activeContracts: totals.all, pendingApprovals: totals.mgmtSigned, systemHealth });
      // Signed Lecturers: lecturer has signed -> WAITING_MANAGEMENT + COMPLETED
      let totalSigned = 0;
      let gotAny = false;
      if (waitMgmtTotalRes.status === 'fulfilled') {
        totalSigned += Number(waitMgmtTotalRes.value?.data?.total || 0);
        gotAny = true;
      }
      if (completedTotalRes.status === 'fulfilled') {
        totalSigned += Number(completedTotalRes.value?.data?.total || 0);
        gotAny = true;
      }
      if (!gotAny) {
        // Fallback to local computation from current page of contracts
        totalSigned = (contracts || []).reduce((acc, c) => {
          const st = String(c.status || '').toUpperCase();
          return acc + ((st === 'WAITING_MANAGEMENT' || st === 'COMPLETED') ? 1 : 0);
        }, 0);
      }
      setSignedLecturersCount(totalSigned);

      // Expired contracts: end_date earlier than today (dept scoped via backend response)
      const isExpired = (c) => {
        const end = c?.end_date || c?.endDate;
        if (!end) return false;
        try {
          const endD = new Date(end);
          if (isNaN(endD.getTime())) return false;
          const today = new Date();
          endD.setHours(0,0,0,0);
          today.setHours(0,0,0,0);
          return endD < today;
        } catch { return false; }
      };
      setExpiredCount((contracts || []).filter(isExpired).length);

      setLastUpdated(new Date());
    } catch (e) {
      // Keep previous state in case of error
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [buildMonthlySeries, selectedTimeRange]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);
  // Polling for real-time updates (no manual refresh needed)
  useEffect(() => {
    const fiveMin = setInterval(() => fetchDashboardData(true), 300000);
    const thirtySec = setInterval(() => fetchDashboardData(true), 30000);
    return () => { clearInterval(fiveMin); clearInterval(thirtySec); };
  }, [fetchDashboardData]);

  // Close notifications on outside click and on Escape
  useEffect(() => {
    if (!showNotifications) return;
    const onClick = (e) => {
      if (!notifContainerRef.current) return;
      if (!notifContainerRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setShowNotifications(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showNotifications]);

  // If the panel is open and new notifications arrive, mark them read and persist
  useEffect(() => {
    if (!showNotifications || !notifications?.length) return;
    const maxTs = notifications.reduce((m, n) => Math.max(m, n.ts || 0), lastViewedAt || 0);
    if (maxTs > (lastViewedAt || 0)) {
      // Defer marking as read slightly to ensure panel renders with unread styling first
      const t = setTimeout(() => {
        setLastViewedAt(maxTs);
        setUnreadCount(0);
        try { localStorage.setItem('mgmtNotifLastSeenTs', String(maxTs)); } catch {}
      }, 250);
      return () => clearTimeout(t);
    }
  }, [showNotifications, notifications]);

  const getChangeColor = (c) => c > 0 ? 'text-green-500' : c < 0 ? 'text-red-500' : 'text-gray-500';
  const getChangeIcon = (c) => c > 0 ? <ArrowUp className='w-4 h-4' /> : c < 0 ? <ArrowDown className='w-4 h-4' /> : null;
  const getSystemHealthColor = (health) => ({ excellent: 'text-green-500', good: 'text-blue-500', warning: 'text-yellow-500', critical: 'text-red-500' }[health] || 'text-gray-500');
  const getSystemHealthIcon = (health) => ({ excellent: <CheckCircle className='w-4 h-4' />, good: <CheckCircle className='w-4 h-4' />, warning: <AlertCircle className='w-4 h-4' />, critical: <XCircle className='w-4 h-4' /> }[health] || <Info className='w-4 h-4' />);

  // Smooth count-up for big numbers on stat cards
  const AnimatedNumber = ({ value = 0 }) => {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
      const startVal = display;
      const endVal = Number(value) || 0;
      if (startVal === endVal) return;
      const t0 = performance.now();
      const dur = 600;
      let raf;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const v = Math.round(startVal + (endVal - startVal) * p);
        setDisplay(v);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, [value]);
    return <>{Number(display).toLocaleString()}</>;
  };

  const StatCard = ({ title, value, change = 0, icon: Icon, color = 'blue', trend = [], index = 0 }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 group relative overflow-hidden`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br from-${color}-50 to-transparent opacity-50`}></div>
      <div className='relative z-10'>
        <div className='flex justify-between items-start mb-4'>
          <div className='flex-1'>
            <h2 className='text-sm font-semibold text-gray-700 mb-1'>{title}</h2>
            <div className='flex items-baseline gap-2'>
              <motion.span key={value} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }} className='text-3xl font-bold text-gray-900'>
                <AnimatedNumber value={Number(value || 0)} />
              </motion.span>
              {change !== 0 && (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={`flex items-center ${getChangeColor(change)} text-sm font-medium`}>
                  {getChangeIcon(change)}
                  <span className='ml-1'>{change > 0 ? '+' : ''}{change}%</span>
                </motion.div>
              )}
            </div>
            <p className='text-xs text-gray-500 mt-1'>Last {selectedTimeRange}</p>
          </div>
          <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className={`p-3 bg-${color}-100 rounded-full group-hover:bg-${color}-200 transition-colors`}>
            <Icon className={`w-6 h-6 text-${color}-600`} />
          </motion.div>
        </div>
        {(() => {
          // Normalize to exactly 10 bars: pad with zeros on the left if fewer than 10, or take the last 10
          const arr = Array.isArray(trend) ? trend.filter(n => Number.isFinite(Number(n))).map(Number) : [];
          const lastTen = arr.slice(-10);
          const pad = Math.max(0, 10 - lastTen.length);
          const bars = [...Array(pad).fill(0), ...lastTen];
          // Make heights look similar within this card by compressing the range
          const seriesMin = Math.min(...bars, 0);
          const seriesMax = Math.max(...bars, 0);
          const minHeightPct = 30; // floor so the smallest bar is still visible
          return (
            <div className='flex items-end gap-1 h-12 mt-4'>
              {bars.map((v, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{
                    height: `${(() => {
                      if (seriesMax === seriesMin) return minHeightPct; // flat series
                      const normalized = (v - seriesMin) / Math.max(1e-6, (seriesMax - seriesMin));
                      return minHeightPct + normalized * (100 - minHeightPct);
                    })()}%`
                  }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className={`bg-gradient-to-t from-${color}-400 to-${color}-200 rounded-sm flex-1`}
                  style={{ minHeight: '4px' }}
                />
              ))}
            </div>
          );
        })()}
      </div>
    </motion.div>
  );

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50'>
      <div className='p-4 sm:p-6 lg:p-8'>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className='flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8'>
          <div className='mb-4 lg:mb-0'>
            <div className='flex items-center gap-4 mb-2'>
              <motion.div whileHover={{ scale: 1.05, rotate: 5 }} className='p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white shadow-lg'>
                <BarChart3 className='w-8 h-8' />
              </motion.div>
              <div>
                <h1 className='text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'>
                  Management Dashboard
                </h1>
                <div className='flex items-center gap-2 mt-1'>
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className={`w-2 h-2 rounded-full ${['good','excellent'].includes(realTimeStats.systemHealth) ? 'bg-green-400' : 'bg-yellow-400'}`}></motion.div>
                  <span className='text-sm text-gray-600'>System Status: </span>
                  <span className={`text-sm font-medium ${getSystemHealthColor(realTimeStats.systemHealth)}`}>
                    {realTimeStats.systemHealth?.charAt(0).toUpperCase() + realTimeStats.systemHealth?.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            <p className='text-gray-600 max-w-2xl'>
              Welcome back. Here's what's happening in your approval queue and departments.
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4 w-full lg:w-auto mt-2 lg:mt-0'>
            <motion.select whileHover={{ scale: 1.02 }} value={selectedTimeRange} onChange={(e) => setSelectedTimeRange(e.target.value)} className='px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm w-full sm:w-auto min-w-[160px]'>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 3 months</option>
              <option value="1y">Last year</option>
            </motion.select>
            <div ref={notifContainerRef} className='relative'>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowNotifications(prev => !prev)}
                className='p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors relative shadow-sm'>
                <Bell className='w-5 h-5 text-gray-600' />
                {unreadCount > 0 && (
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }} className='absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center'>
                    {unreadCount}
                  </motion.span>
                )}
              </motion.button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} className='absolute right-0 top-12 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-xl z-50'>
                    <div className='p-4 border-b border-gray-200'>
                      <h3 className='font-semibold text-gray-900'>Notifications</h3>
                      <p className='text-xs text-gray-500 mt-0.5'>Last 30 days</p>
                    </div>
                    <div className='max-h-64 overflow-y-auto'>
                      {(() => {
                        const items = [...(notifications || [])].sort((a, b) => (b.ts || 0) - (a.ts || 0));
                        if (!items.length) return <div className='p-4 text-center text-gray-500'>No notifications</div>;
                        return items.map((n, i) => {
                          const isUnread = (n.ts || 0) > (lastViewedAt || 0);
                          return (
                            <motion.div
                              key={`${n.ts || i}-${i}`}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${isUnread ? 'bg-blue-50/40' : ''}`}
                            >
                              <div className='flex items-start gap-2'>
                                <span className={`mt-1 w-2 h-2 rounded-full ${isUnread ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                <div>
                                  <p className={`text-sm ${isUnread ? 'text-gray-900 font-medium' : 'text-gray-800'}`}>{n.message}</p>
                                  <p className='text-xs text-gray-500 mt-1'>{n.time}</p>
                                </div>
                              </div>
                            </motion.div>
                          );
                        });
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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

        {/* Real-time status bar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className='bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-4 mb-8 shadow-sm'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div className='flex flex-wrap items-center gap-3 sm:gap-6'>
              <motion.div whileHover={{ scale: 1.05 }} className='flex items-center gap-2'>
                <Activity className='w-4 h-4 text-green-500' />
                <span className='text-sm text-gray-600'>Signed Lecturers:</span>
                <span className='font-semibold text-gray-900'>{signedLecturersCount}</span>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} className='flex items-center gap-2'>
                <FileText className='w-4 h-4 text-blue-500' />
                <span className='text-sm text-gray-600'>Active Contracts:</span>
                <span className='font-semibold text-gray-900'>{realTimeStats.activeContracts}</span>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} className='flex items-center gap-2'>
                <AlertCircle className='w-4 h-4 text-red-500' />
                <span className='text-sm text-gray-600'>Expired Contracts:</span>
                <span className='font-semibold text-gray-900'>{expiredCount}</span>
              </motion.div>
            </div>
            <div className='flex items-center gap-2'>
              <span className={`text-sm font-medium ${getSystemHealthColor(realTimeStats.systemHealth)} flex items-center gap-1`}>
                {getSystemHealthIcon(realTimeStats.systemHealth)}
                {realTimeStats.systemHealth?.toUpperCase()}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Stat cards */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
          <StatCard index={0} title='All Contracts' value={dashboard.totals.all} icon={FileText} color='blue' trend={statTrends.all} />
          {/* Waiting Lecturer = management signed, awaiting lecturer */}
          <StatCard index={1} title='Waiting Lecturer' value={dashboard.totals.mgmtSigned} icon={Clock} color='amber' trend={statTrends.mgmtSigned} />
          {/* Waiting Management = lecturer signed, awaiting management */}
          <StatCard index={2} title='Waiting Management' value={dashboard.totals.lecturerSigned} icon={AlertCircle} color='sky' trend={statTrends.lecturerAwaitingMgmt} />
          <StatCard index={3} title='Completed' value={dashboard.totals.completed} icon={CheckCircle} color='green' trend={statTrends.completed} />
        </div>

        {/* Charts section */}
    <div className='grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-8'>
          {/* Trends */}
          <div className='bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden xl:col-span-2'>
            <div className='px-6 py-4 border-b border-slate-100'>
              <h2 className='text-xl font-semibold text-slate-900'>Approval Trends</h2>
              <p className='text-sm text-slate-600'>Monthly waiting lecturer, waiting management, and completed</p>
            </div>
      <div className='p-6 h-64 sm:h-72 lg:h-80'>
              <ResponsiveContainer width='100%' height='100%'>
                <LineChart data={dashboard.monthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id='lineBlue' x1='0' y1='0' x2='1' y2='0'>
                      <stop offset='0%' stopColor='#3B82F6' />
                      <stop offset='100%' stopColor='#8B5CF6' />
                    </linearGradient>
                    <linearGradient id='linePurple' x1='0' y1='0' x2='1' y2='0'>
                      <stop offset='0%' stopColor='#8B5CF6' />
                      <stop offset='100%' stopColor='#06B6D4' />
                    </linearGradient>
                    <linearGradient id='lineGreen' x1='0' y1='0' x2='1' y2='0'>
                      <stop offset='0%' stopColor='#10B981' />
                      <stop offset='100%' stopColor='#34D399' />
                    </linearGradient>
                    <filter id='softGlow' x='-50%' y='-50%' width='200%' height='200%'>
                      <feGaussianBlur stdDeviation='2' result='coloredBlur' />
                      <feMerge>
                        <feMergeNode in='coloredBlur' />
                        <feMergeNode in='SourceGraphic' />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='month' />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line name='waiting lecturer' type='monotone' dataKey='waitingLecturer' stroke='url(#lineBlue)' strokeWidth={2} dot={{ r: 3 }} filter='url(#softGlow)' />
                  <Line name='waiting management' type='monotone' dataKey='waitingManagement' stroke='url(#linePurple)' strokeWidth={2} dot={{ r: 3 }} filter='url(#softGlow)' />
                  <Line name='completed' type='monotone' dataKey='completed' stroke='url(#lineGreen)' strokeWidth={2} dot={{ r: 3 }} filter='url(#softGlow)' />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status distribution */}
          <div className='bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden'>
            <div className='px-6 py-4 border-b border-slate-100'>
              <h2 className='text-xl font-semibold text-slate-900'>Contract Status</h2>
              <p className='text-sm text-slate-600'>Distribution of contracts by status</p>
            </div>
            <div className='p-6 h-64 sm:h-72 lg:h-80'>
              <ResponsiveContainer width='100%' height='100%'>
                <RechartsPieChart>
                  <Pie data={contractStatusData} dataKey='count' nameKey='status' cx='50%' cy='50%' innerRadius={60} outerRadius={90} label>
                    {contractStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <text x='50%' y='50%' textAnchor='middle' dominantBaseline='middle' className='fill-slate-700 text-sm font-semibold'>
                    {dashboard?.totals?.all ?? 0} total
                  </text>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent + Quick */}
        <div className='grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-8'>
          <div className='bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden xl:col-span-2'>
            <div className='px-6 py-5 border-b border-slate-100 flex items-start justify-between'>
              <div className='flex items-start gap-3'>
                <div className='w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center'>
                  <Clock className='w-4 h-4' />
                </div>
                <div>
                  <div className='text-base font-semibold text-slate-900'>Recent Activities</div>
                  <div className='text-sm text-slate-500 -mt-0.5'>Latest system activities</div>
                </div>
              </div>
              <button className='inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm px-2 py-1 rounded-md hover:bg-slate-50'>
                <Filter className='w-4 h-4' />
              </button>
            </div>
            <div className='p-6'>
              {dashboard.recentActivities.length ? (
                <ul className='space-y-4'>
                  {dashboard.recentActivities.map((a, i) => (
                    <li key={i} className='relative pl-5 flex items-start gap-3 hover:bg-slate-50/60 rounded-md py-2 transition-colors'>
                      <span className='absolute left-2 top-0 bottom-0 w-px bg-slate-200' />
                      <span className={`absolute left-1.5 top-3 w-2 h-2 rounded-full ${a.dotClass || 'bg-blue-500'}`}></span>
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm font-medium text-slate-900 truncate'>{a.message || 'Contract updated'}</p>
                        <p className='text-xs text-slate-500 mt-0.5'>{a.time || ''}</p>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${a.chipClass || 'bg-blue-50 text-blue-700 border border-blue-100'}`}>{a.statusLabel || 'Activity'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className='flex flex-col items-center justify-center text-center py-10 text-slate-500'>
                  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' className='w-10 h-10 opacity-60'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M3 8.25C3 7.00736 4.00736 6 5.25 6h13.5C19.9926 6 21 7.00736 21 8.25v7.5C21 16.9926 19.9926 18 18.75 18H5.25C4.00736 18 3 16.9926 3 15.75v-7.5z' />
                    <path strokeLinecap='round' strokeLinejoin='round' d='M7.5 9h9m-9 3h9m-9 3h6' />
                  </svg>
                  <div className='mt-3 text-sm font-medium'>No recent activities</div>
                  <div className='text-xs'>Activities will appear here as they occur</div>
                </div>
              )}
            </div>
          </div>
          <div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'>
            <div className='flex items-start justify-between mb-5'>
              <div className='flex items-start gap-3'>
                <div className='w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center'>
                  <Zap className='w-4 h-4' />
                </div>
                <div>
                  <div className='text-lg font-semibold text-slate-900'>Quick Actions</div>
                  <div className='text-sm text-slate-500 -mt-0.5'>Common administrative tasks</div>
                </div>
              </div>
              <Settings className='w-4 h-4 text-slate-400' />
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <motion.button
                onClick={() => (window.location.href = '/management/contracts')}
                whileHover={{ y: -4, rotate: 0.25 }}
                whileTap={{ y: 0, scale: 0.99 }}
                className='group relative text-left rounded-xl p-4 border bg-white/90 backdrop-blur-sm border-blue-200 transition-all shadow-sm hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400'
                role='button'
                aria-label='Open Contract Management'
              >
                <span className='pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(120deg,theme(colors.blue.200),transparent,theme(colors.blue.200))] opacity-0 group-hover:opacity-100 transition-opacity [mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] [mask-composite:exclude] p-px' />
                <div className='w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3'>
                  <FileText className='w-5 h-5' />
                </div>
                <div className='text-blue-700 font-semibold'>Contract Management</div>
                <div className='text-xs text-blue-700/80 mt-0.5'>Manage contracts</div>
                <div className='mt-6 text-xs text-blue-700 inline-flex items-center gap-1'>
                  Open contracts
                  <ArrowUpRight className='w-3.5 h-3.5 translate-x-0 opacity-60 transition-all group-hover:translate-x-0.5 group-hover:opacity-100' />
                </div>
              </motion.button>

              <motion.button
                onClick={() => (window.location.href = '/management/profile')}
                whileHover={{ y: -4, rotate: 0.25 }}
                whileTap={{ y: 0, scale: 0.99 }}
                className='group relative text-left rounded-xl p-4 border bg-white/90 backdrop-blur-sm border-amber-200 transition-all shadow-sm hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400'
                role='button'
                aria-label='Open Profile Settings'
              >
                <span className='pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(120deg,theme(colors.amber.200),transparent,theme(colors.amber.200))] opacity-0 group-hover:opacity-100 transition-opacity [mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] [mask-composite:exclude] p-px' />
                <div className='w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-3'>
                  <Settings className='w-5 h-5' />
                </div>
                <div className='text-amber-700 font-semibold'>Profile Settings</div>
                <div className='text-xs text-amber-700/80 mt-0.5'>Update your profile</div>
                <div className='mt-6 text-xs text-amber-700 inline-flex items-center gap-1'>
                  Open settings
                  <ArrowUpRight className='w-3.5 h-3.5 translate-x-0 opacity-60 transition-all group-hover:translate-x-0.5 group-hover:opacity-100' />
                </div>
              </motion.button>
            </div>

            <div className='mt-6 pt-4 border-t border-slate-100 grid grid-cols-3 text-center gap-4'>
              <div className='flex flex-col items-center gap-1'>
                <div className='w-8 h-8 rounded-full bg-slate-50 text-slate-700 flex items-center justify-center'>
                  <FileText className='w-4 h-4' />
                </div>
                <div className='text-xl font-semibold'>{(dashboard?.totals?.all ?? 0)}</div>
                <div className='text-xs text-slate-500'>Total Contracts</div>
              </div>
              <div className='flex flex-col items-center gap-1'>
                <div className='w-8 h-8 rounded-full bg-green-50 text-green-700 flex items-center justify-center'>
                  <GraduationCap className='w-4 h-4' />
                </div>
                <div className='text-xl font-semibold'>{realTimeStats.onlineUsers}</div>
                <div className='text-xs text-slate-500'>Active Lecturers</div>
              </div>
              <div className='flex flex-col items-center gap-1'>
                <div className='w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center'>
                  <Clock className='w-4 h-4' />
                </div>
                <div className='text-xl font-semibold'>{realTimeStats.pendingApprovals}</div>
                <div className='text-xs text-slate-500'>Waiting Lecturer</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
