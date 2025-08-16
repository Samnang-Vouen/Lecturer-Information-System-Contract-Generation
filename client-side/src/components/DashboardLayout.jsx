import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import LoginForm from "./LoginForm";

/**
 * Dashboard layout component that handles authentication state and layout
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render in the main content area
 * @param {Object} [props.user] - Authenticated user object
 * @param {string} props.user.name - User name
 * @param {string} props.user.role - User role
 * @param {boolean} props.user.isFirstLogin - Whether this is the user's first login
 * @param {boolean} [props.isLoading=false] - Whether authentication is being loaded
 * @param {Function} [props.logout] - Logout function
 * @returns {React.ReactElement}
 */
export function DashboardLayout({ 
    children, 
    user, 
    isLoading = false, 
    logout 
}) {
    const navigate = useNavigate();
    
    useEffect(() => {
        // Redirect lecturer on first login to onboarding
        if (!isLoading && user?.isFirstLogin && user.role === "lecturer") {
        navigate("/onboarding");
        }
    }, [user, isLoading, navigate]);

    // Show loading spinner
    if (isLoading) {
        return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
        );
    }

    // Show login form if not authenticated
    if (!user) {
        return <LoginForm />;
    }

    // Show dashboard with sidebar
    return (
        <div className="flex h-screen bg-gray-50">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 overflow-auto">{children}</main>
        </div>
    );
}

export default DashboardLayout;
