import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export default function LecturerDashboard() {
  const { authUser } = useAuthStore();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Welcome{authUser ? `, ${authUser.first_name || authUser.username || ''}` : ''}</h1>
      <p className="text-gray-600">This is your lecturer dashboard overview.</p>
      {/* Add dashboard widgets / stats here later */}
    </div>
  );
}
