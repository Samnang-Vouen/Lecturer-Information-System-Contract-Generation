import React from 'react';

export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-green-100 text-green-800',
    destructive: 'bg-red-100 text-red-800',
    secondary: 'bg-gray-100 text-gray-800',
    outline: 'bg-orange-100 text-orange-800',
    superadmin: 'bg-purple-100 text-purple-800',
    admin: 'bg-blue-100 text-blue-800',
    management: 'bg-orange-100 text-orange-800',
    lecturer: 'bg-green-100 text-green-800',
  course: 'bg-blue-50 text-blue-700 border border-blue-100'
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variants[variant] || ''} ${className}`}>
      {children}
    </span>
  );
}
