import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { axiosInstance } from '../../lib/axios';
import { Users, FileText, RefreshCw, UserPlus, ArrowUp, ArrowDown, Clock, TrendingUp } from 'lucide-react';

export default function AdminHome() {
  const { authUser } = useAuthStore();
  const [dashboardData, setDashboardData] = useState({
    activeLecturers: { count: 0, change: 0 },
    pendingContracts: { count: 0, change: 0 },
    renewals: { count: 0, change: 0 },
    recruitmentInProgress: { count: 0, change: 0 },
    totalUsers: { count: 0, change: 0 },
    recentActivities: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get('/dashboard/stats');
        setDashboardData(response.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setDashboardData({
          activeLecturers: { count: 90, change: 4 },
          pendingContracts: { count: 5, change: -1 },
          renewals: { count: 11, change: 2 },
          recruitmentInProgress: { count: 7, change: 3 },
          totalUsers: { count: 150, change: 6 },
          recentActivities: []
        });
      } finally { setIsLoading(false); }
    };
    fetchDashboardData();
  }, []);

  const getChangeColor = (c) => c>0?'text-green-500':c<0?'text-red-500':'text-gray-500';
  const getChangeIcon = (c) => c>0? <ArrowUp className='w-4 h-4' /> : c<0? <ArrowDown className='w-4 h-4' /> : null;

  return (
    <div className='p-8'>
      <h1 className='text-3xl font-bold text-gray-800 mb-2'>Dashboard</h1>
      <p className='text-gray-600 mb-6'>
        Welcome back,<br/>
        <span className='font-semibold text-gray-900'>
          {authUser?.fullName || authUser?.name || (authUser?.email ? authUser.email.split('@')[0] : '')}
        </span><br/>
        <span>
          Here's what's happening in your department
          {authUser?.department && (
            <strong className='font-semibold text-gray-900'> {authUser.department}</strong>
          )}
        </span>
      </p>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8'>
        <div className='bg-white p-5 rounded-lg shadow-sm border border-gray-200'>
          <div className='flex justify-between items-center mb-2'>
            <h2 className='text-sm font-medium text-gray-700'>Active Lecturers</h2>
            <Users className='w-5 h-5 text-blue-500' />
          </div>
          <span className='text-2xl font-bold text-gray-900'>{dashboardData.activeLecturers.count}</span>
          <p className='text-xs text-gray-600 mt-1'>Currently teaching</p>
          <div className={`flex items-center mt-2 ${getChangeColor(dashboardData.activeLecturers.change)}`}>
            {getChangeIcon(dashboardData.activeLecturers.change)}
            <span className='text-xs ml-1'>+{Math.abs(dashboardData.activeLecturers.change)}%</span>
          </div>
        </div>

        <div className='bg-white p-5 rounded-lg shadow-sm border border-gray-200'>
          <div className='flex justify-between items-center mb-2'>
            <h2 className='text-sm font-medium text-gray-700'>Pending Contracts</h2>
            <FileText className='w-5 h-5 text-blue-500' />
          </div>
          <span className='text-2xl font-bold text-gray-900'>{dashboardData.pendingContracts.count}</span>
          <p className='text-xs text-gray-600 mt-1'>Awaiting signatures</p>
          <div className={`flex items-center mt-2 ${getChangeColor(dashboardData.pendingContracts.change)}`}>
            {getChangeIcon(dashboardData.pendingContracts.change)}
            <span className='text-xs ml-1'>{dashboardData.pendingContracts.change}</span>
          </div>
        </div>

        <div className='bg-white p-5 rounded-lg shadow-sm border border-gray-200'>
          <div className='flex justify-between items-center mb-2'>
            <h2 className='text-sm font-medium text-gray-700'>Renewals</h2>
            <RefreshCw className='w-5 h-5 text-blue-500' />
          </div>
            <span className='text-2xl font-bold text-gray-900'>{dashboardData.renewals.count}</span>
            <p className='text-xs text-gray-600 mt-1'>Due this month</p>
            <div className={`flex items-center mt-2 ${getChangeColor(dashboardData.renewals.change)}`}>
              {getChangeIcon(dashboardData.renewals.change)}
              <span className='text-xs ml-1'>+{Math.abs(dashboardData.renewals.change)}</span>
            </div>
        </div>

        <div className='bg-white p-5 rounded-lg shadow-sm border border-gray-200'>
          <div className='flex justify-between items-center mb-2'>
            <h2 className='text-sm font-medium text-gray-700'>Recruitment in Progress</h2>
            <UserPlus className='w-5 h-5 text-blue-500' />
          </div>
          <span className='text-2xl font-bold text-gray-900'>{dashboardData.recruitmentInProgress.count}</span>
          <p className='text-xs text-gray-600 mt-1'>Active candidates</p>
          <div className={`flex items-center mt-2 ${getChangeColor(dashboardData.recruitmentInProgress.change)}`}>
            {getChangeIcon(dashboardData.recruitmentInProgress.change)}
            <span className='text-xs ml-1'>+{Math.abs(dashboardData.recruitmentInProgress.change)}</span>
          </div>
        </div>

        <div className='bg-white p-5 rounded-lg shadow-sm border border-gray-200'>
          <div className='flex justify-between items-center mb-2'>
            <h2 className='text-sm font-medium text-gray-700'>Total Users</h2>
            <Users className='w-5 h-5 text-blue-500' />
          </div>
          <span className='text-2xl font-bold text-gray-900'>{dashboardData.totalUsers.count}</span>
          <p className='text-xs text-gray-600 mt-1'>All system users</p>
          <div className={`flex items-center mt-2 ${getChangeColor(dashboardData.totalUsers.change)}`}>
            {getChangeIcon(dashboardData.totalUsers.change)}
            <span className='text-xs ml-1'>+{Math.abs(dashboardData.totalUsers.change)}%</span>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
          <div className='flex items-center mb-4'>
            <Clock className='w-5 h-5 text-blue-500 mr-2' />
            <h2 className='text-lg font-semibold text-gray-800'>Recent Activities</h2>
          </div>
          <p className='text-sm text-gray-600 mb-4'>Latest system activities</p>
          <div className='text-sm text-gray-500'>No activities yet.</div>
        </div>

        <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
          <div className='flex items-center mb-4'>
            <TrendingUp className='w-5 h-5 text-blue-500 mr-2' />
            <h2 className='text-lg font-semibold text-gray-800'>Quick Actions</h2>
          </div>
          <p className='text-sm text-gray-600 mb-4'>Common tasks</p>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='p-4 bg-purple-50 rounded-lg flex items-center hover:bg-purple-100 transition-colors cursor-pointer' onClick={() => window.location.href='/superadmin/users'}>
              <div className='p-2 bg-purple-100 rounded-full mr-3'>
                <Users className='w-5 h-5 text-purple-600' />
              </div>
              <div>
                <h3 className='font-medium text-purple-700'>Manage Users</h3>
                <p className='text-xs text-purple-600'>User administration</p>
              </div>
            </div>
            <div className='p-4 bg-blue-50 rounded-lg flex items-center transition-colors opacity-60 pointer-events-none'>
              <div className='p-2 bg-blue-100 rounded-full mr-3'>
                <FileText className='w-5 h-5 text-blue-600' />
              </div>
              <div>
                <h3 className='font-medium text-blue-700'>Generate Contract</h3>
                <p className='text-xs text-blue-600'>Coming Soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
