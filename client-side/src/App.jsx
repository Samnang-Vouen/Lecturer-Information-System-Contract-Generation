import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore.js';
import './index.css'
import { Loader } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import RequireRole from './components/RequireRole.jsx';
import AdminDashboardLayout from './pages/Admindashboard.jsx';
import AdminHome from './pages/admin/AdminHome.jsx';
import LecturerDashboard from './pages/LecturerDashboard.jsx';
import ManagementDashboard from './pages/ManagementDashboard.jsx';
import Recruitment from './pages/admin/Recruitment.jsx';
import SuperAdminDashboard from './pages/SuperAdminDashboard.jsx';
import UserManagement from './pages/UserManagement.jsx';
import LoginForm from './components/LoginForm.jsx';
import AdminProfile from './pages/admin/AdminProfile.jsx';


function App() {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth && !authUser) return (
    <div className="flex justify-center items-center h-screen">
      <Loader className="size-10 animate-spin" />
    </div>
  );

  return (
    <>
      <div>
        <Routes>
          {/* Default to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Public */}
          <Route path="/login" element={!authUser ? <LoginForm /> : <Navigate to={`/${authUser.role}`} replace />} />

          {/* Superadmin */}
          <Route
            path="/superadmin"
            element={
              <RequireRole allowed={["superadmin"]}>
                <SuperAdminDashboard />
              </RequireRole>
            }
          />
          {/* Superadmin + nest route */}
          <Route
            path="/superadmin/users"
            element={
              <RequireRole allowed={["superadmin"]}>
                <UserManagement />
              </RequireRole>
            }
          />

          {/* Admin + Nested routes */}
          <Route
            path="/admin"
            element={
              <RequireRole allowed={["admin"]}>
                <AdminDashboardLayout />
              </RequireRole>
            }
          >
          <Route index element={<AdminHome />} />
            <Route path="recruitment" element={<Recruitment />} />
            <Route path="profile" element={<AdminProfile />} />
          </Route>

          <Route
            path="/lecturer"
            element={
              <RequireRole allowed={["lecturer"]}>
                <LecturerDashboard />
              </RequireRole>
            }
          />

            <Route
              path="/management"
              element={
                <RequireRole allowed={["management"]}>
                  <ManagementDashboard />
                </RequireRole>
              }
            />

          {/* Fallback to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>

        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </div>
    </>
  )
}

export default App
