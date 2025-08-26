import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore.js';
import './index.css'
import { Loader } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import RequireRole from './components/RequireRole.jsx';
import AdminDashboardLayout from './pages/Admindashboard.jsx';
import AdminHome from './pages/admin/AdminHome.jsx';
import LecturerDashboard from './pages/lecturer/LecturerDashboard.jsx';
import Onboarding from './pages/lecturer/Onboarding.jsx';
import LecturerDashboardLayout from './pages/LecturerDashboardLayout.jsx';
import LecturerProfile from './pages/lecturer/LecturerProfile.jsx';
import LecturerContracts from './pages/lecturer/LecturerContracts.jsx';
import ManagementDashboard from './pages/ManagementDashboard.jsx';
import Recruitment from './pages/admin/Recruitment.jsx';
import SuperAdminDashboard from './pages/SuperAdminDashboard.jsx';
import UserManagement from './pages/UserManagement.jsx';
import LoginForm from './components/LoginForm.jsx';
import AdminProfile from './pages/admin/AdminProfile.jsx';
import LecturerManagement from './pages/admin/LecturerManagement.jsx';
import ClassesManagement from './pages/admin/ClassesManagement.jsx';
import CoursesPage from './pages/admin/Courses.jsx';
import CourseMappingPage from './pages/admin/CourseMapping.jsx';


function App() {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth) return (
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

          {/* Public login - if already authenticated, stay on current route (don't force redirect) */}
          <Route path="/login" element={<LoginForm />} />

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
            <Route path="lecturers" element={<LecturerManagement />} />
              <Route path="classes" element={<ClassesManagement />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="course-mapping" element={<CourseMappingPage />} />
          </Route>

          <Route
            path="/lecturer"
            element={
              <RequireRole allowed={["lecturer"]}>
                <LecturerDashboardLayout />
              </RequireRole>
            }
          >
            <Route index element={<LecturerDashboard />} />
            <Route path="profile" element={<LecturerProfile />} />
            <Route path="my-contracts" element={<LecturerContracts />} />
          </Route>
          <Route path="/onboarding" element={<Onboarding />} />

            <Route
              path="/management"
              element={
                <RequireRole allowed={["management"]}>
                  <ManagementDashboard />
                </RequireRole>
              }
            />

          {/* Fallback: if authenticated, keep them where they are or send to role home; else go login */}
          <Route path="*" element={authUser ? <Navigate to={`/${authUser.role}`} replace /> : <Navigate to="/login" replace />} />
        </Routes>

        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </div>
    </>
  )
}

export default App
