import {create} from 'zustand';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';

export const useAuthStore = create((set) => ({
    authUser: null,
    isLoggingIn: false,
    // Start in checking state so protected routes don't redirect before auth status known
    isCheckingAuth: true,
    error: null,

    checkAuth: async () => {
        set({ isCheckingAuth: true });
        try{
            const res = await axiosInstance.get('/auth/check');
            set({ authUser: res.data?.authenticated ? res.data.user : null });
        } catch (error) {
            if (error?.response?.status === 401) {
                set({ authUser: null });
            } else if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
                console.error('Server connection error:', error);
                toast.error('Unable to connect to server. Please check if the server is running.');
                set({ authUser: null, error: 'Server connection error' });
            } else {
                set({ error: error.response?.data?.message || error.message });
            }
        } finally {
            set({ isCheckingAuth: false });
        }
    },

    login: async (credentials) => {
        set({ isLoggingIn: true, error: null });
        try {
            const res = await axiosInstance.post('/auth/login', credentials);
            // Backend may return either { user } or { success, role }
            const user = res.data?.user || (res.data?.role ? { email: credentials.email, role: res.data.role } : null);
            set({ authUser: user });
            if (user) toast.success('Login successful');
            else toast.error('Login failed');
            return res.data;
        } catch (error) {
            if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
                console.error('Server connection error:', error);
                toast.error('Unable to connect to server. Please check if the server is running.');
                set({ error: 'Server connection error' });
            } else {
                set({ error: error.response?.data?.message || error.message });
                toast.error(error.response?.data?.message || 'Login failed');
            }
            throw error;
        } finally {
            set({ isLoggingIn: false });
        }
    },

    logout: async () => {
        try { 
            await axiosInstance.post('/auth/logout'); 
            set({ authUser: null });
            toast.success('Logged out successfully');
        } catch (error) {
            console.error('Logout failed:', error);
            toast.error(error.response?.data?.message || 'Logout failed');
        }
    },
}));