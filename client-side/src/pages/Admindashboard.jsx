import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function AdminDashboardLayout() {
    const { authUser, logout, isCheckingAuth } = useAuthStore();
    return (
        <DashboardLayout user={authUser} isLoading={isCheckingAuth} logout={logout}>
            <Outlet />
        </DashboardLayout>
    );
}
