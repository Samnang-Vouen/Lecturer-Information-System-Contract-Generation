import React, { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import DashboardLayout from "../components/DashboardLayout";
import { 
  Users, FileText, RefreshCw, UserPlus, 
  CheckCircle, Calendar, ArrowUp, ArrowDown, Clock, TrendingUp
} from "lucide-react";
import { axiosInstance } from "../lib/axios";

export default function SuperAdminDashboard() {
  const { authUser, logout, isCheckingAuth } = useAuthStore();
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
        // You'll need to implement this endpoint on your server
        const response = await axiosInstance.get('/dashboard/stats');
        setDashboardData(response.data);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        // Use mock data if API fails
        setDashboardData({
          activeLecturers: { count: 142, change: 12 },
          pendingContracts: { count: 8, change: -3 },
          renewals: { count: 23, change: 5 },
          recruitmentInProgress: { count: 15, change: 8 },
          totalUsers: { count: 287, change: 15 },
          recentActivities: [
            { 
              id: 1,
              type: 'application', 
              title: 'New lecturer application',
              name: 'Dr. Sarah Johnson', 
              time: '2 hours ago',
              status: 'pending'
            },
            { 
              id: 2,
              type: 'contract', 
              title: 'Contract signed',
              name: 'Prof. Michael Chen', 
              time: '4 hours ago',
              status: 'completed'
            },
            { 
              id: 3, 
              type: 'interview',
              title: 'Interview scheduled',
              name: 'Dr. Emily Rodriguez', 
              time: '1 day ago',
              status: 'scheduled'
            }
          ]
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getChangeColor = (change) => {
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-gray-500";
  };

  const getChangeIcon = (change) => {
    if (change > 0) return <ArrowUp className="w-4 h-4" />;
    if (change < 0) return <ArrowDown className="w-4 h-4" />;
    return null;
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      scheduled: "bg-blue-100 text-blue-800"
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const getActivityIcon = (type) => {
    switch(type) {
      case 'application': 
        return <UserPlus className="w-5 h-5 text-blue-500" />;
      case 'contract': 
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'interview': 
        return <Calendar className="w-5 h-5 text-indigo-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <DashboardLayout
      user={authUser}
      isLoading={isCheckingAuth}
      logout={logout}
    >
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
        <p className="text-gray-600 mb-6">Welcome back, Super Admin. Here's what's happening in your super admin portal.</p>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Active Lecturers */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-medium text-gray-700">Active Lecturers</h2>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-900">{dashboardData.activeLecturers.count}</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">Currently teaching</p>
            <div className={`flex items-center mt-2 ${getChangeColor(dashboardData.activeLecturers.change)}`}>
              {getChangeIcon(dashboardData.activeLecturers.change)}
              <span className="text-xs ml-1">+{Math.abs(dashboardData.activeLecturers.change)}%</span>
            </div>
          </div>

          {/* Pending Contracts */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-medium text-gray-700">Pending Contracts</h2>
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-900">{dashboardData.pendingContracts.count}</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">Awaiting signatures</p>
            <div className={`flex items-center mt-2 ${getChangeColor(dashboardData.pendingContracts.change)}`}>
              {getChangeIcon(dashboardData.pendingContracts.change)}
              <span className="text-xs ml-1">{dashboardData.pendingContracts.change}</span>
            </div>
          </div>

          {/* Renewals */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-medium text-gray-700">Renewals</h2>
              <RefreshCw className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-900">{dashboardData.renewals.count}</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">Due this month</p>
            <div className={`flex items-center mt-2 ${getChangeColor(dashboardData.renewals.change)}`}>
              {getChangeIcon(dashboardData.renewals.change)}
              <span className="text-xs ml-1">+{Math.abs(dashboardData.renewals.change)}</span>
            </div>
          </div>

          {/* Recruitment in Progress */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-medium text-gray-700">Recruitment in Progress</h2>
              <UserPlus className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-900">{dashboardData.recruitmentInProgress.count}</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">Active candidates</p>
            <div className={`flex items-center mt-2 ${getChangeColor(dashboardData.recruitmentInProgress.change)}`}>
              {getChangeIcon(dashboardData.recruitmentInProgress.change)}
              <span className="text-xs ml-1">+{Math.abs(dashboardData.recruitmentInProgress.change)}</span>
            </div>
          </div>

          {/* Total Users */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-medium text-gray-700">Total Users</h2>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-900">{dashboardData.totalUsers.count}</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">All system users</p>
            <div className={`flex items-center mt-2 ${getChangeColor(dashboardData.totalUsers.change)}`}>
              {getChangeIcon(dashboardData.totalUsers.change)}
              <span className="text-xs ml-1">+{Math.abs(dashboardData.totalUsers.change)}%</span>
            </div>
          </div>
        </div>
        
        {/* Recent Activities and Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center mb-4">
              <Clock className="w-5 h-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-800">Recent Activities</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">Latest system activities and updates</p>

            <div className="space-y-4">
              {dashboardData.recentActivities.map(activity => (
                <div key={activity.id} className="flex items-start p-3 bg-gray-50 rounded-lg">
                  <div className="mr-3 mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">{activity.title}</h3>
                    <p className="text-sm text-gray-600">{activity.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                  <div>
                    {getStatusBadge(activity.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center mb-4">
              <TrendingUp className="w-5 h-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-800">Quick Actions</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">Common tasks and shortcuts</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg flex items-center hover:bg-blue-100 transition-colors cursor-pointer">
                <div className="p-2 bg-blue-100 rounded-full mr-3">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-700">Add Lecturer</h3>
                  <p className="text-xs text-blue-600">Start recruitment</p>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg flex items-center hover:bg-green-100 transition-colors cursor-pointer">
                <div className="p-2 bg-green-100 rounded-full mr-3">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-green-700">Generate Contract</h3>
                  <p className="text-xs text-green-600">Create new contract</p>
                </div>
              </div>

              <div 
                onClick={() => window.location.href = '/superadmin/users'} 
                className="p-4 bg-purple-50 rounded-lg flex items-center hover:bg-purple-100 transition-colors cursor-pointer"
              >
                <div className="p-2 bg-purple-100 rounded-full mr-3">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-purple-700">Manage Users</h3>
                  <p className="text-xs text-purple-600">User administration</p>
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg flex items-center hover:bg-orange-100 transition-colors cursor-pointer">
                <div className="p-2 bg-orange-100 rounded-full mr-3">
                  <RefreshCw className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-medium text-orange-700">Review Renewals</h3>
                  <p className="text-xs text-orange-600">Contract renewals</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
