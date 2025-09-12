import React, { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import DashboardLayout from "../components/DashboardLayout";
import { 
  Users, FileText, RefreshCw, UserPlus, 
  CheckCircle, Calendar, ArrowUp, ArrowDown, Clock, TrendingUp,
  BookOpen, Award, Building2, BarChart3
} from "lucide-react";
import { axiosInstance } from "../lib/axios";
import { useNavigate } from "react-router-dom";

export default function SuperAdminDashboard() {
  const { authUser, logout, isCheckingAuth } = useAuthStore();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState({
    activeLecturers: { count: 0, change: 0 },
    activeContracts: { count: 0, change: 0 },
    recruitmentInProgress: { count: 0, change: 0 },
    totalUsers: { count: 0, change: 0 },
    recentActivities: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch multiple endpoints concurrently
        const [
          usersResponse,
          lecturersResponse,
          contractsResponse,
          activitiesResponse
        ] = await Promise.allSettled([
          axiosInstance.get('/users'),
          axiosInstance.get('/lecturers'),
          axiosInstance.get('/contracts'),
          axiosInstance.get('/activities/recent')
        ]);

        // Process users data
        const users = usersResponse.status === 'fulfilled' 
          ? (Array.isArray(usersResponse.value.data) ? usersResponse.value.data : usersResponse.value.data?.data || [])
          : [];

        // Process lecturers data
        const lecturers = lecturersResponse.status === 'fulfilled'
          ? (Array.isArray(lecturersResponse.value.data) ? lecturersResponse.value.data : lecturersResponse.value.data?.data || [])
          : [];

        // Process contracts data
        const contracts = contractsResponse.status === 'fulfilled'
          ? (Array.isArray(contractsResponse.value.data) ? contractsResponse.value.data : contractsResponse.value.data?.data || [])
          : [];

        // Process recent activities
        const activities = activitiesResponse.status === 'fulfilled'
          ? (Array.isArray(activitiesResponse.value.data) ? activitiesResponse.value.data : activitiesResponse.value.data?.data || [])
          : [];

        // Calculate metrics
        const activeLecturers = lecturers.filter(l => l.status === 'active' || l.status === 'Active').length;
        const activeContracts = contracts.filter(c => 
          c.status === 'signed' || c.status === 'active' || c.status === 'Active'
        ).length;

        // Recruitment in progress (pending applications or interviews)
        const recruitmentInProgress = lecturers.filter(l => 
          l.status === 'pending' || l.status === 'interview' || l.status === 'reviewing'
        ).length;

        const totalUsers = users.length;

        // Calculate changes with more realistic values (you can replace with actual historical data)
        const getChangePercentage = (current, category) => {
          // Mock historical data - replace with actual API call to get previous period data
          const mockPreviousValues = {
            activeLecturers: Math.max(0, current - Math.floor(Math.random() * 5) + Math.floor(Math.random() * 3)),
            activeContracts: Math.max(0, current - Math.floor(Math.random() * 3) + Math.floor(Math.random() * 4)),
            recruitmentInProgress: Math.max(0, current - Math.floor(Math.random() * 2) + Math.floor(Math.random() * 3)),
            totalUsers: Math.max(1, current - Math.floor(Math.random() * 3) + Math.floor(Math.random() * 2))
          };
          
          const previous = mockPreviousValues[category] || 1;
          const change = previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100);
          return change;
        };

        // Format recent activities
        const formattedActivities = activities.slice(0, 5).map(activity => ({
          id: activity.id,
          type: activity.type || 'general',
          title: activity.title || activity.description || 'System Activity',
          name: activity.userName || activity.user?.name || 'System User',
          time: activity.createdAt ? formatTimeAgo(activity.createdAt) : 'Recently',
          status: activity.status || 'completed'
        }));

        // If no activities from API, create some based on recent user/contract changes
        const fallbackActivities = formattedActivities.length === 0 ? generateFallbackActivities(users, contracts, lecturers) : formattedActivities;

        setDashboardData({
          activeLecturers: { count: activeLecturers, change: getChangePercentage(activeLecturers, 'activeLecturers') },
          activeContracts: { count: activeContracts, change: getChangePercentage(activeContracts, 'activeContracts') },
          recruitmentInProgress: { count: recruitmentInProgress, change: getChangePercentage(recruitmentInProgress, 'recruitmentInProgress') },
          totalUsers: { count: totalUsers, change: getChangePercentage(totalUsers, 'totalUsers') },
          recentActivities: fallbackActivities
        });

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setError("Failed to load dashboard data");
        
        // Fallback to minimal data structure
        setDashboardData({
          activeLecturers: { count: 0, change: 0 },
          activeContracts: { count: 0, change: 0 },
          recruitmentInProgress: { count: 0, change: 0 },
          totalUsers: { count: 0, change: 0 },
          recentActivities: []
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
  };

  const generateFallbackActivities = (users, contracts, lecturers) => {
    const activities = [];
    
    // Recent users
    const recentUsers = users
      .filter(u => u.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2);
    
    recentUsers.forEach((user, index) => {
      activities.push({
        id: `user-${user.id}`,
        type: 'application',
        title: 'New user registered',
        name: user.name || user.email,
        time: formatTimeAgo(user.createdAt),
        status: user.status === 'active' ? 'completed' : 'pending'
      });
    });

    // Recent contracts
    const recentContracts = contracts
      .filter(c => c.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2);
    
    recentContracts.forEach(contract => {
      activities.push({
        id: `contract-${contract.id}`,
        type: 'contract',
        title: contract.status === 'signed' ? 'Contract signed' : 'Contract created',
        name: contract.lecturerName || contract.lecturer?.name || 'Lecturer',
        time: formatTimeAgo(contract.createdAt),
        status: contract.status === 'signed' ? 'completed' : 'pending'
      });
    });

    // Recent lecturers
    const recentLecturers = lecturers
      .filter(l => l.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 1);
    
    recentLecturers.forEach(lecturer => {
      activities.push({
        id: `lecturer-${lecturer.id}`,
        type: 'interview',
        title: 'Lecturer application',
        name: lecturer.name || lecturer.fullName,
        time: formatTimeAgo(lecturer.createdAt),
        status: lecturer.status === 'active' ? 'completed' : 'scheduled'
      });
    });

    return activities.slice(0, 5);
  };

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

  const handleQuickAction = (action) => {
    switch(action) {
      case 'addLecturer':
        navigate('/superadmin/lecturers/new');
        break;
      case 'generateContract':
        navigate('/superadmin/contracts/new');
        break;
      case 'manageUsers':
        navigate('/superadmin/users');
        break;
      case 'viewReports':
        navigate('/superadmin/reports');
        break;
      case 'viewLecturers':
        navigate('/superadmin/lecturers');
        break;
      case 'viewContracts':
        navigate('/superadmin/contracts');
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout
        user={authUser}
        isLoading={isCheckingAuth}
        logout={logout}
      >
        <div className="p-8 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      user={authUser}
      isLoading={isCheckingAuth}
      logout={logout}
    >
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="p-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                  Super Admin Dashboard
                </h1>
                <p className="text-gray-600 text-lg">Manage your institution's lecturer system with ease</p>
              </div>
              <button 
                onClick={() => window.location.reload()} 
                className="flex items-center gap-2 px-6 py-3 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Data
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Stats Cards - Now 4 cards in a row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Active Lecturers */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Active Lecturers</h3>
                <span className="text-3xl font-bold text-gray-900">{dashboardData.activeLecturers.count}</span>
                <p className="text-sm text-gray-500 mt-1">Currently teaching</p>
              </div>
            </div>

            {/* Active Contracts */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Active Contracts</h3>
                <span className="text-3xl font-bold text-gray-900">{dashboardData.activeContracts.count}</span>
                <p className="text-sm text-gray-500 mt-1">Currently active</p>
              </div>
            </div>

            {/* Recruitment in Progress */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <UserPlus className="w-6 h-6 text-purple-600" />
                </div>
                
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Recruitment</h3>
                <span className="text-3xl font-bold text-gray-900">{dashboardData.recruitmentInProgress.count}</span>
                <p className="text-sm text-gray-500 mt-1">In progress</p>
              </div>
            </div>

            {/* Total Users */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="p-3 bg-indigo-100 rounded-xl">
                  <Building2 className="w-6 h-6 text-indigo-600" />
                </div>
               
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Users</h3>
                <span className="text-3xl font-bold text-gray-900">{dashboardData.totalUsers.count}</span>
                <p className="text-sm text-gray-500 mt-1">System users</p>
              </div>
            </div>
          </div>
          
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Activities - Takes 2 columns */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-xl mr-4">
                      <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">Recent Activities</h2>
                      <p className="text-sm text-gray-600">Latest system activities and updates</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {dashboardData.recentActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No recent activities</p>
                    <p className="text-sm">Activities will appear here as they happen</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.recentActivities.map(activity => (
                      <div key={activity.id} className="flex items-start p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <div className="mr-4 mt-1">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{activity.title}</h3>
                          <p className="text-gray-600">{activity.name}</p>
                          <p className="text-xs text-gray-500 mt-2">{activity.time}</p>
                        </div>
                        <div>
                          {getStatusBadge(activity.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions - Takes 1 column */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center">
                  <div className="p-3 bg-indigo-100 rounded-xl mr-4">
                    <TrendingUp className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Quick Actions</h2>
                    <p className="text-sm text-gray-600">Common tasks</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <button 
                  onClick={() => handleQuickAction('addLecturer')}
                  className="w-full p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 group"
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-500 rounded-lg mr-3 group-hover:bg-blue-600 transition-colors">
                      <UserPlus className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-blue-700">Add New Lecturer</h3>
                      <p className="text-xs text-blue-600">Start recruitment process</p>
                    </div>
                  </div>
                </button>

                <button 
                  onClick={() => handleQuickAction('generateContract')}
                  className="w-full p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200 group"
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-green-500 rounded-lg mr-3 group-hover:bg-green-600 transition-colors">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-green-700">Generate Contract</h3>
                      <p className="text-xs text-green-600">Create new contract</p>
                    </div>
                  </div>
                </button>

                <button 
                  onClick={() => handleQuickAction('viewLecturers')}
                  className="w-full p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200 group"
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-500 rounded-lg mr-3 group-hover:bg-purple-600 transition-colors">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-purple-700">View All Lecturers</h3>
                      <p className="text-xs text-purple-600">Manage lecturer profiles</p>
                    </div>
                  </div>
                </button>

                <button 
                  onClick={() => handleQuickAction('manageUsers')}
                  className="w-full p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl hover:from-orange-100 hover:to-orange-200 transition-all duration-200 group"
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-500 rounded-lg mr-3 group-hover:bg-orange-600 transition-colors">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-orange-700">Manage Users</h3>
                      <p className="text-xs text-orange-600">User administration</p>
                    </div>
                  </div>
                </button>

                <button 
                  onClick={() => handleQuickAction('viewReports')}
                  className="w-full p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-xl hover:from-indigo-100 hover:to-indigo-200 transition-all duration-200 group"
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-indigo-500 rounded-lg mr-3 group-hover:bg-indigo-600 transition-colors">
                      <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-indigo-700">View Reports</h3>
                      <p className="text-xs text-indigo-600">Analytics & insights</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}