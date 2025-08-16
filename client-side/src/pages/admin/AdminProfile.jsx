import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore.js';
import { axiosInstance } from '../../lib/axios.js';
import { UserCircle, Clock, KeyRound } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import toast from 'react-hot-toast';

function formatDateTime(dt) {
  if (!dt) return '—';
  const date = new Date(dt);
  return date.toLocaleString(undefined, {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function durationFrom(start) {
  if (!start) return '';
  const s = new Date(start).getTime();
  const now = Date.now();
  let diff = Math.floor((now - s) / 1000); // sec
  const days = Math.floor(diff / 86400); diff -= days * 86400;
  const years = Math.floor(days / 365);
  const remDays = days - years * 365;
  const parts = [];
  if (years) parts.push(`${years} year${years>1?'s':''}`);
  if (remDays) parts.push(`${remDays} day${remDays>1?'s':''}`);
  return `(${parts.join(' ') || 'now'})`;
}

export default function AdminProfile() {
  const { authUser } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pwLoading, setPwLoading] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [p, a] = await Promise.all([
          axiosInstance.get('/profile/me'),
          axiosInstance.get('/profile/activity')
        ]);
        setProfile(p.data);
        setActivity(a.data);
      } catch (e) {
        console.error('Profile load failed', e);
        toast.error(e.response?.data?.message || 'Failed to load profile');
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submitPassword = async (e) => {
    e.preventDefault();
    if (!form.currentPassword || !form.newPassword) return toast.error('Fill all fields');
    if (form.newPassword !== form.confirmPassword) return toast.error('Passwords do not match');
    try {
      setPwLoading(true);
      await axiosInstance.post('/profile/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password updated');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally { setPwLoading(false); }
  };

  if (loading) {
    return <div className='p-8'>Loading...</div>;
  }

  return (
      <div className='p-8 space-y-8'>
        <h1 className='text-3xl font-bold text-gray-800'>My Profile</h1>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Profile Card */}
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200 col-span-1'>
            <div className='flex items-center mb-4'>
              <UserCircle className='w-10 h-10 text-blue-600 mr-3' />
              <div>
                <p className='text-sm text-gray-500'>Full Name</p>
                <p className='text-lg font-semibold text-gray-900'>{profile?.fullName || '—'}</p>
              </div>
            </div>
            <div className='mt-4'>
              <p className='text-sm text-gray-500'>Email</p>
              <p className='font-medium'>{profile?.email}</p>
            </div>
            <div className='mt-4'>
              <p className='text-sm text-gray-500'>Role</p>
              <p className='font-medium capitalize'>{profile?.role}</p>
            </div>
            {profile?.department && (
              <div className='mt-4'>
                <p className='text-sm text-gray-500'>Department</p>
                <p className='font-medium'>{profile.department}</p>
              </div>
            )}
          </div>

          {/* Activity Card */}
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200 col-span-1'>
            <div className='flex items-center mb-4'>
              <Clock className='w-6 h-6 text-blue-600 mr-2' />
              <h2 className='text-lg font-semibold text-gray-800'>Login Activity</h2>
            </div>
            <div className='space-y-4'>
              <div>
                <p className='text-sm text-gray-500'>First access to site</p>
                <p className='font-semibold'>{formatDateTime(activity?.firstAccess)} <span className='font-normal text-gray-500'>{durationFrom(activity?.firstAccess)}</span></p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>Last access to site</p>
                <p className='font-semibold'>{formatDateTime(activity?.lastAccess)} <span className='font-normal text-gray-500'>{activity?.lastAccess ? '(now)' : ''}</span></p>
              </div>
            </div>
          </div>

          {/* Password Change */}
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200 col-span-1'>
            <div className='flex items-center mb-4'>
              <KeyRound className='w-6 h-6 text-blue-600 mr-2' />
              <h2 className='text-lg font-semibold text-gray-800'>Change Password</h2>
            </div>
            <form onSubmit={submitPassword} className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Current Password</label>
                <Input name='currentPassword' type='password' value={form.currentPassword} onChange={onChange} placeholder='••••••••' />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>New Password</label>
                <Input name='newPassword' type='password' value={form.newPassword} onChange={onChange} placeholder='At least 6 characters' />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Confirm New Password</label>
                <Input name='confirmPassword' type='password' value={form.confirmPassword} onChange={onChange} placeholder='Repeat new password' />
              </div>
              <Button disabled={pwLoading} type='submit' variant='primary' className='w-full'>
                {pwLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </div>
        </div>
    </div>
  );
}
