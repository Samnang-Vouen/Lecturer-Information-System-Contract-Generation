import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useAuthStore } from "../store/useAuthStore";
import DashboardLayout from "../components/DashboardLayout";
import CreateUserModal from "../components/CreateUserModal";
import { 
  Users, Plus, Search, Filter, MoreHorizontal, 
  Edit3, UserX, UserCheck, X, Trash2
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
    const [limit, setLimit] = useState(() => Math.min(Math.max(parseInt(searchParams.get('limit')) || 5, 1), 100)); // dynamic page size
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);

    const departmentOptions = [
        "all",
        "Computer Science",
        "Digital Business",
        "Telecommunications and Network"
    ];

    // Sync URL when page/limit change
    useEffect(() => {
        const params = new URLSearchParams(searchParams);
        let changed = false;
        if (params.get('page') !== String(page)) { params.set('page', String(page)); changed = true; }
        if (params.get('limit') !== String(limit)) { params.set('limit', String(limit)); changed = true; }
        if (changed) setSearchParams(params, { replace: true });
    }, [page, limit]);

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
        ? users.filter(u => (u.name || '').toLowerCase().startsWith(q) || (u.email || '').toLowerCase().startsWith(q))
        : users;
    const paginatedUsers = filteredUsers; // render-only list

    const getRoleBadgeVariant = (role) => {
        const r = (role || '').toString().trim().toLowerCase();
        if (r === 'superadmin') return 'superadmin';
        if (r === 'admin') return 'admin';
        if (r === 'management') return 'management';
        return 'secondary';
    };
    const getRoleBadgeClass = () => '';

    const getStatusBadgeClass = (status) => (status || '').toLowerCase() === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';

    const closeMenu = () => setOpenMenuId(null);

    const openMenu = (userId, event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const menuHeight = 140; // approximate height of menu
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropUp = spaceBelow < menuHeight;
        const y = dropUp ? rect.top - menuHeight : rect.bottom;
        const width = 176; // w-44
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
        // normalize role value (remove spaces, lowercase)
        const normalizedRole = (user.role || '').toString().trim().toLowerCase().replace(/\s+/g,'')
        setEditForm({
        name: user.name,
        email: user.email,
        role: normalizedRole, // superadmin, admin, management, lecturer
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
    // Refetch users to reflect persisted backend state
    const refreshed = await axiosInstance.get('/users');
    // Some endpoints wrap data as { data: [...], meta: {...} }
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
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                <p className="text-gray-600 mt-2">Manage system users and their permissions</p>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)} variant="primary" size="md" className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create New User
            </Button>
            </div>

            {/* Search & Filters */}
            <Card>
            <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input placeholder="Search by name or email..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} className="pl-10" />
                    </div>
                </div>
                <div className="flex gap-4 flex-col md:flex-row md:items-center w-full md:w-auto">
                    <div className="w-full md:w-48">
                    <Select value={selectedRole} onValueChange={setSelectedRole} placeholder="Role">
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                        <SelectItem value="superadmin">Super Admin</SelectItem>
                    </Select>
                    </div>
                    <div className="w-full md:w-60">
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment} placeholder="Department">
                        <SelectItem value="all">All Departments</SelectItem>
                        {departmentOptions.filter(d=>d!=='all').map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                    </Select>
                    </div>
                </div>
                </div>
            </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> All Users ({totalUsers})</CardTitle>
                <CardDescription>Manage user accounts and permissions</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading users...</p>
                </div>
                ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-600">No users found. Try adjusting your search or filters.</div>
                ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500">
                        <th className="px-6 py-3 font-medium">Name</th>
                        <th className="px-6 py-3 font-medium">Email</th>
                        <th className="px-6 py-3 font-medium">Role</th>
                        <th className="px-6 py-3 font-medium">Department</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Last Login</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {paginatedUsers.map(user => (
                        <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-gray-800 whitespace-nowrap">{user.name}</td>
                            <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{user.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={getRoleBadgeVariant(user.role)} className={getRoleBadgeClass(user.role)}>
                                {(user.role || '').replace('-', ' ')}
                            </Badge>
                            </td>
                            <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{user.department}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={user.status==='active'?'default':'secondary'} className={getStatusBadgeClass(user.status)}>
                                {user.status}
                            </Badge>
                            </td>
                            <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{user.lastLogin && user.lastLogin !== 'Never' ? new Date(user.lastLogin).toLocaleString() : 'Never'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right relative user-action-menu">
                            <button className="text-gray-500 hover:text-gray-700" onClick={(e)=>{ e.stopPropagation(); openMenu(user.id,e); }}>
                                <MoreHorizontal className="w-5 h-5" />
                            </button>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                    {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t mt-2">
                        <p className="text-sm text-gray-600">Showing page {page} of {totalPages}</p>
                        <div className="flex items-center gap-2">
                        <button
                            onClick={()=> setPage(p=> Math.max(1, p-1))}
                            disabled={page === 1}
                            className={`px-3 py-1 rounded border text-sm ${page===1? 'text-gray-400 border-gray-200 cursor-not-allowed':'hover:bg-gray-50'}`}
                        >Prev</button>
                        {Array.from({ length: totalPages }, (_,i)=> i+1).slice(Math.max(0, page-3), page+2).map(p=> (
                            <button
                            key={p}
                            onClick={()=> setPage(p)}
                            className={`px-3 py-1 rounded text-sm border ${p===page ? 'bg-blue-600 text-white border-blue-600':'hover:bg-gray-50 border-gray-200 text-gray-700'}`}
                            >{p}</button>
                        ))}
                        <button
                            onClick={()=> setPage(p=> Math.min(totalPages, p+1))}
                            disabled={page === totalPages}
                            className={`px-3 py-1 rounded border text-sm ${page===totalPages? 'text-gray-400 border-gray-200 cursor-not-allowed':'hover:bg-gray-50'}`}
                        >Next</button>
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
                // Normalize backend response to table shape
                const rawName = newUser.email.split('@')[0].replace(/\./g,' ');
                const displayName = rawName.split(' ').map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
                const normalized = {
                id: newUser.id,
                name: displayName,
                email: newUser.email,
                role: newUser.role || 'User',
                department: newUser.department || 'General',
                status: 'active',
                lastLogin: 'Never'
                };
                setUsers(prev => [normalized, ...prev]);
            }}
            />
            
            {/* Edit User Modal */}
            {isEditModalOpen && ReactDOM.createPortal(
            <div className="fixed inset-0 z-50">
                <div className="absolute inset-0 bg-black/50" onClick={()=>setIsEditModalOpen(false)} />
                <div className="relative w-full h-full flex items-center justify-center p-4 pointer-events-none">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-5 pointer-events-auto">
                    <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Edit User</h2>
                        <p className="text-sm text-gray-500 mt-1">Update user information and permissions.</p>
                    </div>
                    <button onClick={()=>setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                    </div>
                    <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <Input value={editForm.name} onChange={(e)=>setEditForm(f=>({...f, name: e.target.value}))} placeholder="Full name" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <Input type="email" value={editForm.email} onChange={(e)=>setEditForm(f=>({...f, email: e.target.value}))} placeholder="Email" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <Select value={editForm.role} onValueChange={(v)=>setEditForm(f=>({...f, role: v}))} placeholder="Select role">
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <Select value={editForm.department} onValueChange={(v)=>setEditForm(f=>({...f, department: v}))} placeholder="Select department">
                        {departmentOptions.filter(d=>d!=='all').map(d=> <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </Select>
                    </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                    <Button onClick={submitEdit} className="flex-1" disabled={!editForm.email || !editForm.role || !editForm.department}>Update User</Button>
                    <Button variant="outline" onClick={()=>setIsEditModalOpen(false)} className="flex-1">Cancel</Button>
                    </div>
                </div>
                </div>
            </div>, document.body)}

                        {/* Delete Confirmation Dialog */}
                        {isDeleteModalOpen && userToDelete && (
                            <Dialog open={isDeleteModalOpen} onOpenChange={(open)=> { setIsDeleteModalOpen(open); if (!open) setUserToDelete(null); }}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Confirm Deletion</DialogTitle>
                                    </DialogHeader>
                                    <div className="px-2 pb-2 text-center space-y-4">
                                        <p className="text-sm text-gray-700">
                                            Do you want to delete this {userToDelete?.name || userToDelete?.email}?
                                        </p>
                                        <div className="flex flex-col sm:flex-row gap-2 sm:justify-center">
                                            <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white sm:min-w-[120px]">OK</Button>
                                            <Button variant="outline" onClick={cancelDelete} className="sm:min-w-[120px]">Cancel</Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}

            {/* Floating Action Menu */}
            {openMenuId && (() => { const user = users.find(u=>u.id===openMenuId); if(!user) return null; return (
            <div className="fixed z-50 user-action-menu" style={{ top: menuCoords.y, left: menuCoords.x }}>
                <div className="w-44 bg-white border border-gray-200 rounded-md shadow-lg py-2 text-sm">
                <button onClick={()=>openEditModal(user)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"><Edit3 className="w-4 h-4"/> Edit User</button>
                <button onClick={()=>handleDeactivate(user)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                    {user.status==='active' ? (<><UserX className="w-4 h-4"/> Deactivate</>) : (<><UserCheck className="w-4 h-4"/> Activate</>)}
                </button>
                <button onClick={()=>requestDelete(user)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-red-600">
                    <Trash2 className="w-4 h-4"/> Delete
                </button>
                </div>
            </div>
            ); })()}
        </div>
        </DashboardLayout>
    );
}
