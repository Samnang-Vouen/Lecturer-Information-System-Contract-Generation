import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { axiosInstance } from '../../lib/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardData } from '../../hooks/useDashboardData';
import { 
  Users, FileText, RefreshCw, UserPlus, ArrowUp, ArrowDown, Clock, TrendingUp,
  Activity, Calendar, Bell, Settings, BarChart3, PieChart, Target, Zap,
  AlertCircle, CheckCircle, XCircle, Info, Filter, Download, Eye, TrendingDown,
  Award, BookOpen, GraduationCap, Building
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Cell, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';

export default function AdminHome() {
  const navigate = useNavigate();
  const { authUser } = useAuthStore();
  const { trendData } = useDashboardData();
  const [dashboardData, setDashboardData] = useState({
    activeLecturers: { count: 0, change: 0, trend: [] },
    pendingContracts: { count: 0, change: 0, trend: [] },
  activeContracts: { count: 0, change: 0, trend: [] },
    recruitmentInProgress: { count: 0, change: 0, trend: [] },
    totalUsers: { count: 0, change: 0, trend: [] },
    recentActivities: [],
    departmentStats: {},
    monthlyTrends: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [realTimeStats, setRealTimeStats] = useState({
    onlineUsers: 0,
    activeContracts: 0,
  expiredContracts: 0,
    systemHealth: 'good'
  });
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Chart color schemes
  const chartColors = {
    primary: '#3B82F6',
    secondary: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#06B6D4',
    purple: '#A855F7',
    gradient: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']
  };

  // Monthly trends from server; fallback to sample if unavailable
  const monthlyTrendsData = (dashboardData.monthlyTrends && dashboardData.monthlyTrends.length)
    ? dashboardData.monthlyTrends
    : [
        { month: 'Jan', lecturers: 45, contracts: 32, applications: 78 },
        { month: 'Feb', lecturers: 52, contracts: 38, applications: 85 },
        { month: 'Mar', lecturers: 48, contracts: 35, applications: 92 },
        { month: 'Apr', lecturers: 61, contracts: 42, applications: 105 },
        { month: 'May', lecturers: 58, contracts: 39, applications: 98 },
        { month: 'Jun', lecturers: 65, contracts: 45, applications: 112 }
      ];

  // Department distribution from server (global): lecturers per department across the system
  const distributionList = Array.isArray(dashboardData?.departmentStats?.distribution)
    ? dashboardData.departmentStats.distribution
    : [];
  const colorPalette = [
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#06B6D4', // cyan
    '#A855F7', // violet
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#F97316', // orange
    '#DC2626', // rose
    '#0EA5E9', // sky
  ];
  const departmentDistribution = distributionList.map((item, idx) => ({
    name: String(item.name || ''),
    value: Number(item.value || 0),
    color: colorPalette[idx % colorPalette.length]
  }));

  // Contract status from server (Teaching_Contracts): WAITING_LECTURER, WAITING_MANAGEMENT, COMPLETED
  const statusCounts = dashboardData?.contractStatus || { WAITING_LECTURER: 0, WAITING_MANAGEMENT: 0, COMPLETED: 0 };
  const contractStatusData = [
    { status: 'Waiting Lecturer', key: 'WAITING_LECTURER', count: Number(statusCounts.WAITING_LECTURER || 0), color: chartColors.warning },
    { status: 'Waiting Management', key: 'WAITING_MANAGEMENT', count: Number(statusCounts.WAITING_MANAGEMENT || 0), color: chartColors.info },
    { status: 'Completed', key: 'COMPLETED', count: Number(statusCounts.COMPLETED || 0), color: chartColors.success }
  ];

  const performanceMetrics = [
    { metric: 'Lecturer Satisfaction', value: 94, target: 90, color: chartColors.success },
    { metric: 'Contract Completion', value: 87, target: 85, color: chartColors.primary },
    { metric: 'Onboarding Speed', value: 92, target: 88, color: chartColors.secondary },
    { metric: 'System Uptime', value: 99.8, target: 99.5, color: chartColors.info }
  ];

  // Dynamic data fetching (server-side authority)
  const lastPendingCountRef = useRef(0);

  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const [
        statsRes,
        realtimeRes,
        notificationsRes,
        waitLecturerRes,
        waitManagementRes,
        statusWaitingLecturerRes,
        statusWaitingManagementRes,
        statusCompletedRes
      ] = await Promise.all([
        axiosInstance.get(`/dashboard/stats?timeRange=${selectedTimeRange}`),
        axiosInstance.get('/dashboard/realtime'),
        axiosInstance.get('/dashboard/notifications').catch(() => ({ data: [] })),
        // Use server-side totals for pending statuses; backend maps MANAGEMENT_SIGNED->WAITING_LECTURER and LECTURER_SIGNED->WAITING_MANAGEMENT
        axiosInstance.get('/teaching-contracts', { params: { page: 1, limit: 1, status: 'MANAGEMENT_SIGNED' } }).catch(() => ({ data: { total: 0 } })),
        axiosInstance.get('/teaching-contracts', { params: { page: 1, limit: 1, status: 'LECTURER_SIGNED' } }).catch(() => ({ data: { total: 0 } })),
        // Explicit per-status totals for the Contract Status chart (already dept-scoped by backend)
        axiosInstance.get('/teaching-contracts', { params: { page: 1, limit: 1, status: 'WAITING_LECTURER' } }).catch(() => ({ data: { total: 0 } })),
        axiosInstance.get('/teaching-contracts', { params: { page: 1, limit: 1, status: 'WAITING_MANAGEMENT' } }).catch(() => ({ data: { total: 0 } })),
        axiosInstance.get('/teaching-contracts', { params: { page: 1, limit: 1, status: 'COMPLETED' } }).catch(() => ({ data: { total: 0 } }))
      ]);

      const rawStats = statsRes.data || {};
      const normalizedStats = { ...rawStats };
      if (normalizedStats.renewals && !normalizedStats.activeContracts) {
        normalizedStats.activeContracts = normalizedStats.renewals;
        delete normalizedStats.renewals;
      }

  // Derive Pending Contracts using server totals (already scoped to admin's department by backend)
  const pendingCount = Number(waitLecturerRes?.data?.total || 0) + Number(waitManagementRes?.data?.total || 0);
      const prevCount = Number(lastPendingCountRef.current || 0);
      const changePct = prevCount > 0 ? Math.round(((pendingCount - prevCount) / prevCount) * 100) : 0;
      lastPendingCountRef.current = pendingCount;

      // Compute department-scoped counts for the status chart
      const deptScopedContractStatus = {
        WAITING_LECTURER: Number(statusWaitingLecturerRes?.data?.total || 0),
        WAITING_MANAGEMENT: Number(statusWaitingManagementRes?.data?.total || 0),
        COMPLETED: Number(statusCompletedRes?.data?.total || 0)
      };

      setDashboardData(prev => ({
        ...prev,
        ...normalizedStats,
        // Override pendingContracts with filtered dataset counts
        pendingContracts: {
          ...prev.pendingContracts,
          count: pendingCount,
          change: changePct,
        },
        // Ensure chart uses dept-scoped dynamic counts
        contractStatus: deptScopedContractStatus,
        lastFetch: new Date().toISOString()
      }));

      setRealTimeStats(realtimeRes.data || { onlineUsers: 0, activeContracts: 0, systemHealth: 'good' });
      setNotifications(Array.isArray(notificationsRes.data) ? notificationsRes.data : []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedTimeRange]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Real-time updates every 30 seconds
  useEffect(() => {
    const realtimeInterval = setInterval(async () => {
      try {
        const response = await axiosInstance.get('/dashboard/realtime');
        setRealTimeStats(response.data);
      } catch (error) {
        // keep previous realtime state on transient failures
      }
    }, 30000); // 30 seconds

    return () => clearInterval(realtimeInterval);
  }, []);

  // Presence heartbeat is handled globally in DashboardLayout

  useEffect(() => {
    fetchDashboardData();
  }, [selectedTimeRange]);

  const getChangeColor = (c) => c > 0 ? 'text-green-500' : c < 0 ? 'text-red-500' : 'text-gray-500';
  const getChangeIcon = (c) => c > 0 ? <ArrowUp className='w-4 h-4' /> : c < 0 ? <ArrowDown className='w-4 h-4' /> : null;
  
  const getSystemHealthColor = (health) => {
    switch (health) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getSystemHealthIcon = (health) => {
    switch (health) {
      case 'excellent': return <CheckCircle className='w-4 h-4' />;
      case 'good': return <CheckCircle className='w-4 h-4' />;
      case 'warning': return <AlertCircle className='w-4 h-4' />;
      case 'critical': return <XCircle className='w-4 h-4' />;
      default: return <Info className='w-4 h-4' />;
    }
  };

  // Helper: relative time like `8 hours ago` or `Now`

    // Helper: badge classes for activity status
    const getStatusBadgeClasses = (status) => {
      const s = String(status || '').toLowerCase();
      switch (s) {
        case 'completed':
          return 'bg-green-100 text-green-700 border-green-200';
        case 'pending':
          return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        case 'scheduled':
        case 'in-progress':
          return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'expired':
          return 'bg-red-100 text-red-700 border-red-200';
        default:
          return 'bg-gray-100 text-gray-700 border-gray-200';
      }
    };
  const formatRelativeTime = (input) => {
    try {
      const t = new Date(input).getTime();
      if (!t || Number.isNaN(t)) return '';
      const diffMs = Date.now() - t;
      if (diffMs < 0) return 'Now';
      const sec = Math.floor(diffMs / 1000);
      if (sec < 5) return 'Now';
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hrs = Math.floor(min / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days < 30) return `${days}d ago`;
      const months = Math.floor(days / 30);
      if (months < 12) return `${months}mo ago`;
      const years = Math.floor(months / 12);
      return `${years}y ago`;
    } catch {
      return '';
    }
  };

  const StatCard = ({ title, value, change, icon: Icon, description, isLoading, color = 'blue', trend = [], index = 0 }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 group ${isLoading ? 'animate-pulse' : ''} relative overflow-hidden`}
    >
      {/* Background gradient */}
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
                {isLoading ? '' : value.toLocaleString()}
              </motion.span>
              {!isLoading && change !== 0 && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center ${getChangeColor(change)} text-sm font-medium`}
                >
                  {getChangeIcon(change)}
                  <span className='ml-1'>
                    {change > 0 ? '+' : ''}{change}%
                  </span>
                </motion.div>
              )}
            </div>
            <p className='text-xs text-gray-500 mt-1'>{description}</p>
          </div>
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className={`p-3 bg-${color}-100 rounded-full group-hover:bg-${color}-200 transition-colors`}
          >
            <Icon className={`w-6 h-6 text-${color}-600`} />
          </motion.div>
        </div>
        
        {/* Enhanced mini trend chart */}
        {trend.length > 0 && (
          <div className='flex items-end gap-1 h-12 mt-4'>
            {trend.slice(-10).map((value, index) => (
              <motion.div
                key={index}
                initial={{ height: 0 }}
                animate={{ height: `${(value / Math.max(...trend)) * 100}%` }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
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
      <div className='px-4 sm:px-6 lg:px-8 py-6'>
        {/* Enhanced Header with Real-time Status */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className='flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 sm:mb-8'
        >
          <div className='mb-4 lg:mb-0'>
            <div className='flex items-center gap-3 sm:gap-4 mb-2'>
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 5 }}
                className='p-2.5 sm:p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white shadow-lg'
              >
                <BarChart3 className='w-6 h-6 sm:w-8 sm:h-8' />
              </motion.div>
              <div>
                <h1 className='text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'>
                  Admin Dashboard
                </h1>
                <div className='flex items-center gap-2 mt-1'>
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`w-2 h-2 rounded-full ${realTimeStats.systemHealth === 'good' ? 'bg-green-400' : 'bg-yellow-400'}`}
                  ></motion.div>
                  <span className='text-xs sm:text-sm text-gray-600'>System Status: </span>
                  <span className={`text-xs sm:text-sm font-medium ${getSystemHealthColor(realTimeStats.systemHealth)}`}>
                    {realTimeStats.systemHealth?.charAt(0).toUpperCase() + realTimeStats.systemHealth?.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            <p className='text-gray-600 max-w-2xl text-sm sm:text-base'>
              Welcome back,{' '}
              <span className='font-semibold text-gray-900'>
                {authUser?.fullName || authUser?.name || (authUser?.email ? authUser.email.split('@')[0] : 'Admin')}
              </span>
              <br />
              <span>
                Here's what's happening in your department
                {authUser?.department && (
                  <strong className='font-semibold text-gray-900'> {authUser.department}</strong>
                )}
              </span>
            </p>
          </div>

          {/* Header Controls */}
          <div className='flex flex-wrap items-center gap-3 sm:gap-4'>
            {/* Time Range Selector */}
            <motion.select
              whileHover={{ scale: 1.02 }}
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className='px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm'
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 3 months</option>
              <option value="1y">Last year</option>
            </motion.select>

            {/* Notifications */}
            <div className='relative'>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowNotifications(!showNotifications)}
                className='p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors relative shadow-sm'
              >
                <Bell className='w-4 h-4 sm:w-5 sm:h-5 text-gray-600' />
                {notifications.length > 0 && (
                  <motion.span 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className='absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center'
                  >
                    {notifications.length}
                  </motion.span>
                )}
              </motion.button>
              
              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className='absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50'
                  >
                    <div className='p-4 border-b border-gray-200'>
                      <h3 className='font-semibold text-gray-900'>Notifications</h3>
                    </div>
                    <div className='max-h-64 overflow-y-auto'>
                      {notifications.length > 0 ? (
                        notifications.map((notification, index) => (
                          <motion.div 
                            key={index} 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className='p-4 border-b border-gray-100 hover:bg-gray-50'
                          >
                            <p className='text-sm text-gray-800'>{notification.message}</p>
                            <p className='text-xs text-gray-500 mt-1'>{notification.time}</p>
                          </motion.div>
                        ))
                      ) : (
                        <div className='p-4 text-center text-gray-500'>No new notifications</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Refresh Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing}
              className='flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm'
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </motion.button>

            {/* Last Updated */}
            {lastUpdated && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className='text-xs text-gray-500'
              >
                Last updated: {lastUpdated.toLocaleTimeString()}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Enhanced Real-time Status Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className='bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-4 mb-6 sm:mb-8 shadow-sm'
        >
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div className='flex flex-wrap items-center gap-x-6 gap-y-2'>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className='flex items-center gap-2'
              >
                <Activity className='w-4 h-4 text-green-500' />
                <span className='text-xs sm:text-sm text-gray-600'>Online Users:</span>
                <span className='text-sm font-semibold text-gray-900'>{realTimeStats.onlineUsers}</span>
              </motion.div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className='flex items-center gap-2'
              >
                <FileText className='w-4 h-4 text-blue-500' />
                <span className='text-xs sm:text-sm text-gray-600'>Expired Contracts:</span>
                <span className='text-sm font-semibold text-gray-900'>{realTimeStats.expiredContracts}</span>
              </motion.div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className='flex items-center gap-2'
              >
                {getSystemHealthIcon(realTimeStats.systemHealth)}
                <span className='text-xs sm:text-sm text-gray-600'>System Health:</span>
                <span className={`text-sm font-semibold ${getSystemHealthColor(realTimeStats.systemHealth)}`}>
                  {realTimeStats.systemHealth?.charAt(0).toUpperCase() + realTimeStats.systemHealth?.slice(1)}
                </span>
              </motion.div>
            </div>
            <div className='flex items-center gap-2 text-xs text-gray-500'>
              <Clock className='w-3 h-3' />
              Live updates every 30s
            </div>
          </div>
        </motion.div>

        {/* Enhanced Stats Cards */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8'>
          <StatCard
            title="Active Lecturers"
            value={dashboardData.activeLecturers.count}
            change={dashboardData.activeLecturers.change}
            icon={Users}
            description="Currently teaching"
            isLoading={isLoading}
            color="blue"
            trend={trendData.activeLecturers}
            index={0}
          />
          
          <StatCard
            title="Pending Contracts"
            value={dashboardData.pendingContracts.count}
            change={dashboardData.pendingContracts.change}
            icon={FileText}
            description="Awaiting signatures"
            isLoading={isLoading}
            color="yellow"
            trend={trendData.pendingContracts}
            index={1}
          />
          
          <StatCard
            title="Active Contracts"
            value={dashboardData.activeContracts.count}
            change={dashboardData.activeContracts.change}
            icon={RefreshCw}
            description="Contracts not yet expired"
            isLoading={isLoading}
            color="green"
            trend={trendData.activeContracts}
            index={2}
          />
          
          <StatCard
            title="Recruitment"
            value={dashboardData.recruitmentInProgress.count}
            change={dashboardData.recruitmentInProgress.change}
            icon={UserPlus}
            description="Active candidates"
            isLoading={isLoading}
            color="purple"
            trend={trendData.recruitmentInProgress}
            index={3}
          />
          
          <StatCard
            title="Total Users"
            value={dashboardData.totalUsers.count}
            change={dashboardData.totalUsers.change}
            icon={Users}
            description="All system users"
            isLoading={isLoading}
            color="indigo"
            trend={trendData.totalUsers}
            index={4}
          />
        </div>

        {/* Charts Section */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8'>
          {/* Monthly Trends Chart */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className='bg-white/80 backdrop-blur-sm p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200'
          >
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-blue-100 rounded-lg'>
                  <TrendingUp className='w-5 h-5 text-blue-600' />
                </div>
                <div>
                  <h2 className='text-xl font-semibold text-gray-900'>Monthly Trends</h2>
                  <p className='text-sm text-gray-600'>Lecturers, contracts & applications</p>
                </div>
              </div>
            </div>
            
            <div className='h-64 sm:h-80'>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrendsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#666" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#666" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="lecturers" 
                    fill="#3B82F6" 
                    name="Lecturers"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="contracts" 
                    stroke="#8B5CF6" 
                    strokeWidth={3}
                    name="Contracts"
                    dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="applications" 
                    stroke="#10B981" 
                    strokeWidth={3}
                    name="Applications"
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Department Distribution Pie Chart */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className='bg-white/80 backdrop-blur-sm p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200'
          >
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-purple-100 rounded-lg'>
                  <PieChart className='w-5 h-5 text-purple-600' />
                </div>
                <div>
                  <h2 className='text-xl font-semibold text-gray-900'>Department Distribution</h2>
                  <p className='text-sm text-gray-600'>Lecturers by department</p>
                </div>
              </div>
            </div>
            
            <div className='h-64 sm:h-80'>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={departmentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {departmentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Performance Metrics & Contract Status */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8'>
          {/* Performance Metrics */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className='bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-gray-200'
          >
            <div className='flex items-center gap-3 mb-6'>
              <div className='p-2 bg-green-100 rounded-lg'>
                <Target className='w-5 h-5 text-green-600' />
              </div>
              <div>
                <h2 className='text-xl font-semibold text-gray-900'>Performance Metrics</h2>
                <p className='text-sm text-gray-600'>Key performance indicators</p>
              </div>
            </div>
            
            <div className='space-y-6'>
              {performanceMetrics.map((metric, index) => (
                <motion.div 
                  key={metric.metric}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className='relative'
                >
                  <div className='flex justify-between items-center mb-2'>
                    <span className='text-sm font-medium text-gray-700'>{metric.metric}</span>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-bold' style={{ color: metric.color }}>
                        {metric.value}%
                      </span>
                      <span className='text-xs text-gray-500'>
                        Target: {metric.target}%
                      </span>
                    </div>
                  </div>
                  <div className='w-full bg-gray-200 rounded-full h-2'>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${metric.value}%` }}
                      transition={{ duration: 1, delay: 0.2 + index * 0.1 }}
                      className='h-2 rounded-full'
                      style={{ backgroundColor: metric.color }}
                    />
                  </div>
                  <div 
                    className='absolute top-6 w-0.5 h-2 bg-gray-400'
                    style={{ left: `${metric.target}%` }}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Contract Status Chart */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className='bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-gray-200'
          >
            <div className='flex items-center gap-3 mb-6'>
              <div className='p-2 bg-orange-100 rounded-lg'>
                <FileText className='w-5 h-5 text-orange-600' />
              </div>
              <div>
                <h2 className='text-xl font-semibold text-gray-900'>Contract Status</h2>
                <p className='text-sm text-gray-600'>Current contract distribution</p>
              </div>
            </div>
            
            <div className='h-64'>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contractStatusData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="status" 
                    stroke="#666" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#666" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[4, 4, 0, 0]}
                  >
                    {contractStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Enhanced Bottom Section */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8'>
          {/* Dynamic Recent Activities */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className='bg-white/80 backdrop-blur-sm p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200'
          >
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-blue-100 rounded-lg'>
                  <Clock className='w-5 h-5 text-blue-600' />
                </div>
                <div>
                  <h2 className='text-xl font-semibold text-gray-900'>Recent Activities</h2>
                  <p className='text-sm text-gray-600'>Latest system activities</p>
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className='p-2 text-gray-400 hover:text-gray-600 transition-colors'
              >
                <Filter className='w-4 h-4' />
              </motion.button>
            </div>
            
            <div className='space-y-4 max-h-72 sm:max-h-80 overflow-y-auto'>
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 5 }).map((_, index) => (
                  <motion.div 
                    key={index} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className='flex items-center gap-3 p-3 animate-pulse'
                  >
                    <div className='w-8 h-8 bg-gray-200 rounded-full'></div>
                    <div className='flex-1'>
                      <div className='h-4 bg-gray-200 rounded w-3/4 mb-2'></div>
                      <div className='h-3 bg-gray-200 rounded w-1/2'></div>
                    </div>
                  </motion.div>
                ))
              ) : dashboardData.recentActivities.length > 0 ? (
                dashboardData.recentActivities.map((activity, index) => (
                  <motion.div 
                    key={index} 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className='flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-all duration-300 group'
                  >
                    <motion.div 
                      whileHover={{ scale: 1.1 }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        activity.type === 'contract' ? 'bg-blue-100 text-blue-600' :
                        activity.type === 'user' ? 'bg-green-100 text-green-600' :
                        activity.type === 'lecturer' || activity.type === 'candidate' ? 'bg-purple-100 text-purple-600' :
                        'bg-gray-100 text-gray-600'
                      } group-hover:scale-110 transition-transform`}
                    >
                      {activity.type === 'contract' ? <FileText className='w-4 h-4' /> :
                       activity.type === 'user' ? <Users className='w-4 h-4' /> :
                       activity.type === 'lecturer' || activity.type === 'candidate' ? <UserPlus className='w-4 h-4' /> :
                       <Activity className='w-4 h-4' />}
                    </motion.div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm text-gray-900 font-medium group-hover:text-blue-600 transition-colors flex items-center gap-2'>
                        <span className='truncate'>{activity.title}</span>
                        {activity.status && (
                          <span className={`ml-auto px-2 py-0.5 rounded-full border text-[10px] font-medium ${getStatusBadgeClasses(activity.status)}`}>
                            {String(activity.status).charAt(0).toUpperCase() + String(activity.status).slice(1)}
                          </span>
                        )}
                      </p>
                      {activity.name && (
                        <p className='text-xs text-gray-600 mt-1 truncate'>
                          {activity.name}
                        </p>
                      )}
                      <p className='text-xs text-gray-500 mt-1'>
                        {formatRelativeTime(activity.time || activity.createdAt)}
                      </p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className='text-center py-8'
                >
                  <Activity className='w-12 h-12 text-gray-300 mx-auto mb-3' />
                  <p className='text-gray-500'>No recent activities</p>
                  <p className='text-xs text-gray-400 mt-1'>Activities will appear here as they occur</p>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Enhanced Quick Actions */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className='bg-white/80 backdrop-blur-sm p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200'
          >
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-purple-100 rounded-lg'>
                  <Zap className='w-5 h-5 text-purple-600' />
                </div>
                <div>
                  <h2 className='text-xl font-semibold text-gray-900'>Quick Actions</h2>
                  <p className='text-sm text-gray-600'>Common administrative tasks</p>
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className='p-2 text-gray-400 hover:text-gray-600 transition-colors'
              >
                <Settings className='w-4 h-4' />
              </motion.button>
            </div>
            
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              {/* Recruitment Candidate Action */}
              <motion.div 
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className='group p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 hover:from-purple-100 hover:to-blue-100 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md'
                onClick={() => navigate('/admin/recruitment')}
              >
                <div className='flex items-center gap-3 mb-3'>
                  <motion.div 
                    whileHover={{ rotate: 10 }}
                    className='p-2 bg-purple-100 group-hover:bg-purple-200 rounded-lg transition-colors'
                  >
                    <UserPlus className='w-5 h-5 text-purple-600' />
                  </motion.div>
                  <div>
                    <h3 className='font-semibold text-purple-700 group-hover:text-purple-800'>Recruitment Candidate</h3>
                    <p className='text-xs text-purple-600'>Manage lecturer recruitment candidates</p>
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-purple-600'>Manage recruitment</span>
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <ArrowUp className='w-4 h-4 text-purple-400 transform rotate-45' />
                  </motion.div>
                </div>
              </motion.div>

              {/* Add Lecturer Action */}
              <motion.div 
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className='group p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md'
                onClick={() => navigate('/admin/lecturers')}
              >
                <div className='flex items-center gap-3 mb-3'>
                  <motion.div 
                    whileHover={{ rotate: 10 }}
                    className='p-2 bg-blue-100 group-hover:bg-blue-200 rounded-lg transition-colors'
                  >
                    <Users className='w-5 h-5 text-blue-600' />
                  </motion.div>
                  <div>
                    <h3 className='font-semibold text-blue-700 group-hover:text-blue-800'>Add Lecturer</h3>
                    <p className='text-xs text-blue-600'>Add and manage lecturers</p>
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-600'>Open lecturer management</span>
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <ArrowUp className='w-4 h-4 text-blue-400 transform rotate-45' />
                  </motion.div>
                </div>
              </motion.div>

              {/* Course Mapping Action */}
              <motion.div 
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className='group p-4 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl border border-green-200 hover:from-green-100 hover:to-teal-100 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md'
                onClick={() => navigate('/admin/course-mapping')}
              >
                <div className='flex items-center gap-3 mb-3'>
                  <motion.div 
                    whileHover={{ rotate: 10 }}
                    className='p-2 bg-green-100 group-hover:bg-green-200 rounded-lg transition-colors'
                  >
                    <BookOpen className='w-5 h-5 text-green-600' />
                  </motion.div>
                  <div>
                    <h3 className='font-semibold text-green-700 group-hover:text-green-800'>Course Mapping</h3>
                    <p className='text-xs text-green-600'>Assign and manage course mappings</p>
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-green-600'>Open course mapping</span>
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <ArrowUp className='w-4 h-4 text-green-400 transform rotate-45' />
                  </motion.div>
                </div>
              </motion.div>

              {/* Generate Contract Action */}
              <motion.div 
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className='group p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200 hover:from-orange-100 hover:to-red-100 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md'
                onClick={() => navigate('/admin/contracts')}
              >
                <div className='flex items-center gap-3 mb-3'>
                  <motion.div 
                    whileHover={{ rotate: 10 }}
                    className='p-2 bg-orange-100 group-hover:bg-orange-200 rounded-lg transition-colors'
                  >
                    <FileText className='w-5 h-5 text-orange-600' />
                  </motion.div>
                  <div>
                    <h3 className='font-semibold text-orange-700 group-hover:text-orange-800'>Generate Contract</h3>
                    <p className='text-xs text-orange-600'>Create and manage lecturer contracts</p>
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-orange-600'>Open contract generation</span>
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <ArrowUp className='w-4 h-4 text-orange-400 transform rotate-45' />
                  </motion.div>
                </div>
              </motion.div>
            </div>

            {/* Enhanced Additional Stats */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className='mt-6 pt-6 border-t border-gray-200'
            >
              <div className='grid grid-cols-3 gap-3 sm:gap-4'>
                {[
                  { label: 'Total Users', value: dashboardData.totalUsers.count, icon: Users, color: 'blue' },
                  { label: 'Active Lecturers', value: dashboardData.activeLecturers.count, icon: GraduationCap, color: 'green' },
                  { label: 'Pending Contracts', value: dashboardData.pendingContracts.count, icon: Clock, color: 'orange' }
                ].map((stat, index) => (
                  <motion.div 
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 + index * 0.1 }}
                    className='text-center group'
                  >
                    <motion.div 
                      whileHover={{ scale: 1.1 }}
                      className={`inline-flex items-center justify-center w-8 h-8 bg-${stat.color}-100 rounded-full mb-2 group-hover:bg-${stat.color}-200 transition-colors`}
                    >
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
