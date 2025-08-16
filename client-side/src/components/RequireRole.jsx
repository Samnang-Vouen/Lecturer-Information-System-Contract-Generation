import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore.js';

const roleHome = {
  superadmin: '/superadmin',
  admin: '/admin',
  lecturer: '/lecturer',
  management: '/management',
};

export default function RequireRole({ allowed, children }) {
  const { authUser } = useAuthStore();
  const location = useLocation();

  if (!authUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowed && !allowed.includes(authUser.role)) {
    return <Navigate to={roleHome[authUser.role] || '/'} replace />;
  }

  return children;
}
