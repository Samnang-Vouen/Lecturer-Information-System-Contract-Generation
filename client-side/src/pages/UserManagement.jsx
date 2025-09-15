import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useAuthStore } from "../store/useAuthStore";
import DashboardLayout from "../components/DashboardLayout";
import CreateUserModal from "../components/CreateUserModal";
import { 
  Users, Plus, Search, Filter, MoreHorizontal, 
  Edit3, UserX, UserCheck, X, Trash2, Eye, Settings,
  Shield, Mail, Calendar, Activity
} from "lucide-react";
import { axiosInstance } from "../lib/axios";
import { Toaster } from "react-hot-toast";
// New design component imports
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Select, { SelectItem } from "../components/ui/Select";
import { useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/Dialog";

export default function UserManagement() {
    const { authUser, logout, isCheckingAuth } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRole, setSelectedRole] = useState("all");
    const [selectedDepartment, setSelectedDepartment] = useState("all");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuCoords, setMenuCoords] = useState({ x: 0, y: 0, dropUp: false });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', role: '', department: '' });
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [page, setPage] = useState(() => Math.max(parseInt(searchParams.get('page')) || 1, 1));
    const [limit, setLimit] = useState(() => Math.min(Math.max(parseInt(searchParams.get('limit')) || 5, 1), 100));
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);

    const departmentOptions = [
        "all",
        "Computer Science",
        "Digital Business",
        "Telecommunications and Network"
    ];

    // Helper function to format full name
    const formatFullName = (user) => {
        // Priority: name -> fullName -> formatted email
        if (user.name && user.name.trim()) {
            return user.name.trim();
        }
        if (user.fullName && user.fullName.trim()) {
            return user.fullName.trim();
        }
        // Extract and format name from email
        const emailName = user.email.split('@')[0].replace(/\./g, ' ');
        return emailName.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };

    // Sync URL when page/limit change
    useEffect(() => {
        const params = new URLSearchParams(searchParams);
        let changed = false;
        if (params.get('page') !== String(page)) { params.set('page', String(page)); changed = true; }
        if (params.get('limit') !== String(limit)) { params.set('limit', String(limit)); changed = true; }
        if (changed) setSearchParams(params, { replace: true });
    }, [page, limit]);

    // Open create modal automatically if ?create=1 is present
    useEffect(() => {
        const c = searchParams.get('create');
        if (c === '1') {
            setIsCreateModalOpen(true);
            // Remove the flag from URL without adding a new entry to history
            const params = new URLSearchParams(searchParams);
            params.delete('create');
            setSearchParams(params, { replace: true });
        }
    }, []);

    // React to manual URL changes (back/forward)
    useEffect(() => {
        const urlPage = Math.max(parseInt(searchParams.get('page')) || 1, 1);
        const urlLimit = Math.min(Math.max(parseInt(searchParams.get('limit')) || limit, 1), 100);
        if (urlPage !== page) setPage(urlPage);
        if (urlLimit !== limit) setLimit(urlLimit);
    }, [searchParams]);

    useEffect(() => {
        const fetchUsers = async () => {
        try {
            setIsLoading(true);
            const params = { page, limit };
            if (selectedRole !== 'all' && ['admin','management','superadmin'].includes(selectedRole)) params.role = selectedRole;
            if (selectedDepartment !== 'all') params.department = selectedDepartment;
            if (searchQuery) params.search = searchQuery;
            const response = await axiosInstance.get('/users', { params });
            const payload = response.data;
            const list = Array.isArray(payload) ? payload : payload.data;
            setUsers(list);
            if (payload.meta) {
                setTotalPages(payload.meta.totalPages);
                setTotalUsers(payload.meta.total);
                if (payload.meta.limit && payload.meta.limit !== limit) setLimit(payload.meta.limit);
                if (page > payload.meta.totalPages && payload.meta.totalPages > 0) setPage(payload.meta.totalPages);
            } else {
                setTotalPages(1);
                setTotalUsers(list.length);
            }
        } catch (error) {
            console.error("Failed to fetch users:", error);
            if (error.response?.status === 401) { logout(); return; }
            setUsers([]);
        } finally { setIsLoading(false); }
        };
        fetchUsers();
    }, [logout, page, limit, selectedRole, selectedDepartment, searchQuery]);

    // Reset to page 1 when filters or search change
    useEffect(()=>{ setPage(1); }, [searchQuery, selectedRole, selectedDepartment]);
    useEffect(()=>{}, [totalPages]);

    // Ensure only results matching the entered text are displayed while searching (hide unrelated rows)
    const q = (searchQuery || '').trim().toLowerCase();
    const filteredUsers = q
        ? users.filter(u => {
            const fullName = formatFullName(u).toLowerCase();
            const email = (u.email || '').toLowerCase();
            return fullName.includes(q) || email.includes(q);
        })
        : users;
    const paginatedUsers = filteredUsers;

    const getRoleBadgeVariant = (role) => {
        const r = (role || '').toString().trim().toLowerCase();
        if (r === 'superadmin') return 'superadmin';
        if (r === 'admin') return 'admin';
        if (r === 'management') return 'management';
        return 'secondary';
    };

    const getRoleIcon = (role) => {
        const r = (role || '').toString().trim().toLowerCase();
        if (r === 'superadmin') return <Shield className="w-3 h-3" />;
        if (r === 'admin') return <Settings className="w-3 h-3" />;
        if (r === 'management') return <Users className="w-3 h-3" />;
        return <Eye className="w-3 h-3" />;
    };

    const getStatusBadgeClass = (status) => (status || '').toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800';

    const closeMenu = () => setOpenMenuId(null);

    const openMenu = (userId, event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const menuHeight = 140;
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropUp = spaceBelow < menuHeight;
        const y = dropUp ? rect.top - menuHeight : rect.bottom;
        const width = 176;
        const x = rect.right - width;
        setMenuCoords({ x, y, dropUp });
        setOpenMenuId(userId);
    };

    const handleDeactivate = async (user) => {
        try {
        const res = await axiosInstance.patch(`/users/${user.id}/status`);
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: res.data.status } : u));
        closeMenu();
        } catch (e) { console.error('Deactivate failed', e); }
    };

    const requestDelete = (user) => {
        setUserToDelete(user);
        setIsDeleteModalOpen(true);
        closeMenu();
    };

    const confirmDelete = async () => {
        if(!userToDelete) return;
        try {
            await axiosInstance.delete(`/users/${userToDelete.id}`);
            const remaining = filteredUsers.length - 1;
            const newTotalPages = Math.ceil(remaining / limit) || 1;
            setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
            if(page > newTotalPages) setPage(newTotalPages);
        } catch (e) { console.error('Delete failed', e); }
        finally { setIsDeleteModalOpen(false); setUserToDelete(null); }
    };

    const cancelDelete = () => { setIsDeleteModalOpen(false); setUserToDelete(null); };

    const openEditModal = (user) => {
        setEditingUser(user);
        const normalizedRole = (user.role || '').toString().trim().toLowerCase().replace(/\s+/g,'')
        setEditForm({
        name: formatFullName(user),
        email: user.email,
        role: normalizedRole,
        department: user.department
        });
        setIsEditModalOpen(true);
        closeMenu();
    };

    const submitEdit = async () => {
        if (!editingUser) return;
        try {
        const payloadRole = editForm.role.trim().toLowerCase();
    await axiosInstance.put(`/users/${editingUser.id}`, { fullName: editForm.name, email: editForm.email, role: payloadRole, department: editForm.department });
    const refreshed = await axiosInstance.get('/users');
    const refreshedPayload = refreshed.data;
    const refreshedList = Array.isArray(refreshedPayload) ? refreshedPayload : refreshedPayload.data;
    setUsers(Array.isArray(refreshedList) ? refreshedList : []);
    setIsEditModalOpen(false);
    setEditingUser(null);
        } catch (e) { console.error('Update failed', e); }
    };

    useEffect(() => {
        function onDocClick(e){ if(!e.target.closest('.user-action-menu')) closeMenu(); }
        document.addEventListener('click', onDocClick);
        const onScrollOrResize = () => closeMenu();
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        return () => {
        document.removeEventListener('click', onDocClick);
        window.removeEventListener('scroll', onScrollOrResize, true);
        window.removeEventListener('resize', onScrollOrResize);
        };
    }, []);

    useEffect(() => {
        if (isEditModalOpen) {
            const original = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = original; };
        }
    }, [isEditModalOpen]);

    return (
        <DashboardLayout
        user={authUser}
        isLoading={isCheckingAuth}
        logout={logout}
        >
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 sm:space-y-8">
                {/* Header Section */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl">
                                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                                    User Management System
                                </h1>
                                <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-lg">Manage user accounts, roles, and permissions</p>
                            </div>
                        </div>
                        <Button 
                            onClick={() => setIsCreateModalOpen(true)} 
                            className="w-full sm:w-auto justify-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                        >
                            <Plus className="w-5 h-5 mr-2" /> 
                            <span>Add New User</span>
                        </Button>
                    </div>
                </div>

                {/* Search & Filters Form */}
                <Card className="shadow-lg border-0">
                    <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-2xl">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Filter className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle className="text-xl text-gray-900">Search & Filter Users</CardTitle>
                                <CardDescription className="text-gray-600">Find and filter users by name, email, role, or department</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-5 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                            <div className="space-y-2">
                                <label className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Search className="w-4 h-4" />
                                    Search Users
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <Input 
                                        placeholder="Search by name or email..." 
                                        value={searchQuery} 
                                        onChange={(e)=>setSearchQuery(e.target.value)} 
                                        className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl" 
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    Filter by Role
                                </label>
                                <Select value={selectedRole} onValueChange={setSelectedRole} placeholder="Select Role">
                                    <SelectItem value="all">All Roles</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="management">Management</SelectItem>
                                    <SelectItem value="superadmin">Super Admin</SelectItem>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Filter by Department
                                </label>
                                <Select value={selectedDepartment} onValueChange={setSelectedDepartment} placeholder="Select Department">
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departmentOptions.filter(d=>d!=='all').map(dept => 
                                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                    )}
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Activity className="w-4 h-4" />
                                    Results per Page
                                </label>
                                <Select value={String(limit)} onValueChange={(v)=>setLimit(parseInt(v))} placeholder="Page Size">
                                    <SelectItem value="5">5 users</SelectItem>
                                    <SelectItem value="10">10 users</SelectItem>
                                    <SelectItem value="25">25 users</SelectItem>
                                    <SelectItem value="50">50 users</SelectItem>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Users List */}
                <Card className="shadow-lg border-0">
                    <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <Users className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl text-gray-900">User Directory ({totalUsers} users)</CardTitle>
                                    <CardDescription className="text-gray-600">View and manage all registered users</CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="p-12 text-center">
                                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
                                <p className="mt-6 text-gray-600 text-lg">Loading user data...</p>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <h3 className="text-xl font-semibold mb-2">No users found</h3>
                                <p className="text-gray-400">Try adjusting your search criteria or filters</p>
                            </div>
                        ) : (
                            <div className="overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider">User</th>
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Contact</th>
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider">Role</th>
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider hidden lg:table-cell">Department</th>
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider">Status</th>
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider hidden xl:table-cell">Last Activity</th>
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {paginatedUsers.map(user => {
                                                const fullName = formatFullName(user);
                                                return (
                                                <tr key={user.id} className="hover:bg-blue-50 transition-colors duration-150">
                                                    <td className="px-4 sm:px-6 py-4 sm:py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-shrink-0">
                                                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                                                    <span className="text-white font-semibold text-xs sm:text-sm">
                                                                        {fullName.charAt(0).toUpperCase()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-900 truncate max-w-[140px] sm:max-w-none">{fullName}</p>
                                                                {/* <p className="text-xs text-gray-500">ID: {user.id}</p> */}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-4 sm:py-5 hidden md:table-cell">
                                                        <div className="flex items-center gap-2">
                                                            <Mail className="w-4 h-4 text-gray-400" />
                                                            <span className="text-sm text-gray-900 truncate max-w-[220px]">{user.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-4 sm:py-5">
                                                        <Badge 
                                                            variant={getRoleBadgeVariant(user.role)} 
                                                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"
                                                        >
                                                            {getRoleIcon(user.role)}
                                                            {(user.role || '').replace('-', ' ')}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-4 sm:py-5 hidden lg:table-cell">
                                                        <span className="text-sm text-gray-700 font-medium">{user.department}</span>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-4 sm:py-5">
                                                        <Badge 
                                                            variant={user.status==='active'?'default':'secondary'} 
                                                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(user.status)}`}
                                                        >
                                                            <div className={`w-2 h-2 rounded-full mr-1 ${user.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                                                            {user.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-4 sm:py-5 hidden xl:table-cell">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-4 h-4 text-gray-400" />
                                                            <span className="text-sm text-gray-600">
                                                                {user.lastLogin && user.lastLogin !== 'Never' 
                                                                    ? new Date(user.lastLogin).toLocaleDateString() 
                                                                    : 'Never logged in'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-4 sm:py-5 text-right relative user-action-menu">
                                                        <button 
                                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" 
                                                            onClick={(e)=>{ e.stopPropagation(); openMenu(user.id,e); }}
                                                        >
                                                            <MoreHorizontal className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* Enhanced Pagination */}
                                {totalPages > 1 && (
                                    <div className="bg-gray-50 px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center sm:justify-between">
                                        <div className="flex items-center">
                                            <span className="text-xs sm:text-sm text-gray-600">
                                                Showing <span className="font-semibold">{((page-1)*limit)+1}</span> to{' '}
                                                <span className="font-semibold">{Math.min(page*limit, totalUsers)}</span> of{' '}
                                                <span className="font-semibold">{totalUsers}</span> users
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={()=> setPage(p=> Math.max(1, p-1))}
                                                disabled={page === 1}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                    page===1 
                                                        ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                                                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                Previous
                                            </button>
                                            
                                            <div className="flex gap-1">
                                                {Array.from({ length: totalPages }, (_,i)=> i+1)
                                                    .slice(Math.max(0, page-3), page+2)
                                                    .map(p=> (
                                                    <button
                                                        key={p}
                                                        onClick={()=> setPage(p)}
                                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                            p===page 
                                                                ? 'bg-blue-600 text-white' 
                                                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                            
                                            <button
                                                onClick={()=> setPage(p=> Math.min(totalPages, p+1))}
                                                disabled={page === totalPages}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                    page===totalPages 
                                                        ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                                                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Create User Modal */}
                <CreateUserModal 
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onUserCreated={(newUser) => {
                    // Extract and format full name from email if no name provided
                    const extractedName = newUser.email.split('@')[0].replace(/\./g, ' ');
                    const formattedName = extractedName.split(' ').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                    ).join(' ');
                    
                    const normalized = {
                        id: newUser.id,
                        name: newUser.name || newUser.fullName || formattedName,
                        fullName: newUser.fullName || newUser.name || formattedName,
                        email: newUser.email,
                        role: newUser.role || 'User',
                        department: newUser.department || 'General',
                        status: 'active',
                        lastLogin: 'Never'
                    };
                    setUsers(prev => [normalized, ...prev]);
                }}
                />
                
                {/* Enhanced Edit User Modal */}
                {isEditModalOpen && ReactDOM.createPortal(
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=>setIsEditModalOpen(false)} />
                    <div className="relative w-full h-full flex items-center justify-center p-4 pointer-events-none">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Edit3 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
                                        <p className="text-sm text-gray-600">Update user information and permissions</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={()=>setIsEditModalOpen(false)} 
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5"/>
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">Full Name</label>
                                <Input 
                                    value={editForm.name} 
                                    onChange={(e)=>setEditForm(f=>({...f, name: e.target.value}))} 
                                    placeholder="Enter full name" 
                                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">Email Address</label>
                                <Input 
                                    type="email" 
                                    value={editForm.email} 
                                    onChange={(e)=>setEditForm(f=>({...f, email: e.target.value}))} 
                                    placeholder="Enter email address" 
                                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">User Role</label>
                                <Select value={editForm.role} onValueChange={(v)=>setEditForm(f=>({...f, role: v}))} placeholder="Select user role">
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="management">Management</SelectItem>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">Department</label>
                                <Select value={editForm.department} onValueChange={(v)=>setEditForm(f=>({...f, department: v}))} placeholder="Select department">
                                {departmentOptions.filter(d=>d!=='all').map(d=> <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </Select>
                            </div>
                        </div>
                        
                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <Button 
                                onClick={submitEdit} 
                                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl h-11" 
                                disabled={!editForm.email || !editForm.role || !editForm.department}
                            >
                                Update User
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={()=>setIsEditModalOpen(false)} 
                                className="flex-1 rounded-xl h-11"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                    </div>
                </div>, document.body)}

                {/* Enhanced Delete Confirmation Dialog */}
                {isDeleteModalOpen && userToDelete && (
                    <Dialog open={isDeleteModalOpen} onOpenChange={(open)=> { setIsDeleteModalOpen(open); if (!open) setUserToDelete(null); }}>
                        <DialogContent className="rounded-2xl">
                            <DialogHeader>
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-red-100 rounded-lg">
                                        <Trash2 className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-bold text-gray-900">Confirm User Deletion</DialogTitle>
                                        <p className="text-sm text-gray-600">This action cannot be undone</p>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="p-6 text-center space-y-4">
                                <p className="text-gray-700">
                                    Are you sure you want to delete <span className="font-semibold">{formatFullName(userToDelete)}</span>?
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <Button 
                                        onClick={confirmDelete} 
                                        className="bg-red-600 hover:bg-red-700 text-white sm:min-w-[120px] rounded-xl"
                                    >
                                        Delete User
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        onClick={cancelDelete} 
                                        className="sm:min-w-[120px] rounded-xl"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}

                {/* Enhanced Floating Action Menu */}
                {openMenuId && (() => { 
                    const user = users.find(u=>u.id===openMenuId); 
                    if(!user) return null; 
                    return (
                    <div className="fixed z-50 user-action-menu" style={{ top: menuCoords.y, left: menuCoords.x }}>
                        <div className="w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-2">
                            <button 
                                onClick={()=>openEditModal(user)} 
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors"
                            >
                                <Edit3 className="w-4 h-4 text-blue-600"/> 
                                <span className="text-sm font-medium text-gray-700">Edit User</span>
                            </button>
                            <button 
                                onClick={()=>handleDeactivate(user)} 
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-yellow-50 text-left transition-colors"
                            >
                                {user.status==='active' ? (
                                    <>
                                        <UserX className="w-4 h-4 text-yellow-600"/> 
                                        <span className="text-sm font-medium text-gray-700">Deactivate</span>
                                    </>
                                ) : (
                                    <>
                                        <UserCheck className="w-4 h-4 text-green-600"/> 
                                        <span className="text-sm font-medium text-gray-700">Activate</span>
                                    </>
                                )}
                            </button>
                            <button 
                                onClick={()=>requestDelete(user)} 
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-left transition-colors"
                            >
                                <Trash2 className="w-4 h-4 text-red-600"/> 
                                <span className="text-sm font-medium text-red-600">Delete User</span>
                            </button>
                        </div>
                    </div>
                    ); 
                })()}
            </div>
        </div>
        </DashboardLayout>
    );
}