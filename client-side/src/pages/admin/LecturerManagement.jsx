import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAuthStore } from '../../store/useAuthStore';
import CreateLecturerModal from '../../components/CreateLecturerModal';
import { Users, Plus, Search, MoreHorizontal, Edit3, UserX, UserCheck, X, Trash2, BookOpen, FileText, Loader2, Eye, Download, Upload } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Label from '../../components/ui/Label';
import Textarea from '../../components/ui/Textarea';
import Select, { SelectItem } from '../../components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/Dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AssignCoursesDialog from '../../components/AssignCoursesDialog';

export default function LecturerManagement(){
  const { logout } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lecturers, setLecturers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeView, setActiveView] = useState('list'); // 'list' | 'add'
  const [createdLecturers, setCreatedLecturers] = useState([]); // session-created list
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuCoords, setMenuCoords] = useState({ x:0, y:0, dropUp:false });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState(null); // enriched detail object
  const [editTab, setEditTab] = useState('basic');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [lecturerToDelete, setLecturerToDelete] = useState(null);
  const [page, setPage] = useState(()=> Math.max(parseInt(searchParams.get('page'))||1,1));
  const [limit, setLimit] = useState(()=> Math.min(Math.max(parseInt(searchParams.get('limit'))||10,1),100));
  const [totalPages, setTotalPages] = useState(1);
  const [totalLecturers, setTotalLecturers] = useState(0);
  const [_departments, setDepartments] = useState([]);
  const [statusFilter, _setStatusFilter] = useState('');
  const [departmentFilter, _setDepartmentFilter] = useState('');
  const [assigning, setAssigning] = useState(null); // lecturer object for assignment
  const [coursesCatalog, setCoursesCatalog] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]); // course_code list for dialog
  const [assignLoading, setAssignLoading] = useState(false);
  const [profileDrawer, setProfileDrawer] = useState({ open:false, lecturer:null, loading:false, detail:null, activeTab:'overview', saving:false });

  // small helper to render initials for avatar circles
    // avatar initials removed — names will display without avatar

  // Sync URL
  useEffect(()=>{ const params=new URLSearchParams(searchParams); let changed=false; if(params.get('page')!==String(page)){params.set('page',String(page)); changed=true;} if(params.get('limit')!==String(limit)){params.set('limit',String(limit)); changed=true;} if(changed) setSearchParams(params,{replace:true}); },[page,limit]);
  // React to manual URL change
  useEffect(()=>{ const urlPage=Math.max(parseInt(searchParams.get('page'))||1,1); const urlLimit=Math.min(Math.max(parseInt(searchParams.get('limit'))||limit,1),100); if(urlPage!==page) setPage(urlPage); if(urlLimit!==limit) setLimit(urlLimit); },[searchParams]);

  // debounce search input to avoid too many requests
  useEffect(()=>{
    const t = setTimeout(()=> setDebouncedSearch(searchQuery.trim()), 300);
    return ()=> clearTimeout(t);
  },[searchQuery]);

  useEffect(()=>{ const fetchLecturers= async ()=>{ try{ setIsLoading(true); const params={ page, limit }; if(debouncedSearch) params.search=debouncedSearch; if(statusFilter) params.status=statusFilter; if(departmentFilter) params.department=departmentFilter; const res= await axiosInstance.get('/lecturers', { params }); const payload=res.data; const list= Array.isArray(payload)? payload : payload.data; // standardized response
      // Ensure each entry has name/email/status structure expected by UI
      const normalized = list.map(l => ({
        id: l.id || l.userId || l.lecturerProfileId,
        name: l.name || `${l.firstName||''} ${l.lastName||''}`.trim() || (l.email? l.email.split('@')[0]:'').replace(/\./g,' '),
        email: l.email,
        status: l.status || 'active',
    lastLogin: l.lastLogin || 'Never',
    department: l.department || '',
    coursesCount: l.coursesCount || 0,
    // support API returning researchFields or legacy specializations
    researchFields: l.researchFields || l.specializations || [],
    specializations: l.specializations || [],
    // optional course objects to display names in list
    courses: l.courses || l.assignedCourses || []
      }));
      setLecturers(normalized);
      if(payload.meta){ setTotalPages(payload.meta.totalPages); setTotalLecturers(payload.meta.total); if(page>payload.meta.totalPages && payload.meta.totalPages>0) setPage(payload.meta.totalPages); }
      else { setTotalPages(1); setTotalLecturers(normalized.length); }
  }catch(err){ console.error('Failed to fetch lecturers', err); if(err.response?.status===401){ logout(); return;} setLecturers([]);} finally { setIsLoading(false);} }; fetchLecturers(); },[logout,page,limit,debouncedSearch,statusFilter,departmentFilter]);
  // re-run when filters change
  useEffect(()=>{ const params=new URLSearchParams(searchParams); if(statusFilter) params.set('status',statusFilter); else params.delete('status'); if(departmentFilter) params.set('department',departmentFilter); else params.delete('department'); setSearchParams(params,{replace:true}); setPage(1); },[statusFilter,departmentFilter]);
  useEffect(()=>{ const fetchDeps= async ()=>{ try { const res = await axiosInstance.get('/catalog/departments'); const data = Array.isArray(res.data)? res.data : res.data.departments || []; setDepartments(data); } catch(e){ console.warn('departments fetch failed', e.message);} }; fetchDeps(); },[]);

  useEffect(()=>{ setPage(1); },[searchQuery,statusFilter,departmentFilter]);

  const openMenu = (id, e)=>{
    const rect = e.currentTarget.getBoundingClientRect();
    // increase estimated menu height to ensure drop-up triggers for taller menus
    const menuHeight = 240;
    const gap = 8; // small gap so menu sits slightly away from the button
    // if the menu would overflow below the viewport, prefer dropping up
    const shouldDropUp = (rect.bottom + menuHeight + gap) > window.innerHeight;
    const dropUp = shouldDropUp;
    // if dropUp, position above the button with a gap; otherwise place below with a gap
    const y = dropUp ? Math.max(rect.top - menuHeight - gap, gap) : Math.min(rect.bottom + gap, Math.max(window.innerHeight - menuHeight - gap, gap));
    const width = 176;
    const rawX = rect.right - width;
    const x = Math.min(Math.max(rawX, gap), Math.max(window.innerWidth - width - gap, gap));
    setMenuCoords({ x, y, dropUp });
    setOpenMenuId(id);
  };
  const closeMenu=()=> setOpenMenuId(null);

  const requestDelete = (lecturer)=>{ setLecturerToDelete(lecturer); setIsDeleteModalOpen(true); closeMenu(); };
  const cancelDelete=()=>{ setIsDeleteModalOpen(false); setLecturerToDelete(null); };
  const confirmDelete= async ()=>{ if(!lecturerToDelete) return; try{ await axiosInstance.delete(`/lecturers/${lecturerToDelete.id}`); setLecturers(prev=> prev.filter(l=> l.id!==lecturerToDelete.id)); }catch(e){ console.error('Delete lecturer failed', e);} finally { cancelDelete(); } };

  const handleDeactivate= async (lecturer)=>{ try{ const res= await axiosInstance.patch(`/lecturers/${lecturer.id}/status`); setLecturers(prev=> prev.map(l=> l.id===lecturer.id? {...l, status:res.data.status}:l)); closeMenu(); }catch(e){ console.error('Toggle status failed', e);} };

  const openEdit = async (lecturer)=>{
    closeMenu();
    try {
      // fetch detail to enrich
      const res = await axiosInstance.get(`/lecturers/${lecturer.id}/detail`);
      const raw = res.data || {};
      // some APIs return payload under .data or nested profile object
      const detail = raw.data || raw.profile || raw.lecturer_profile || raw || {};
      const get = (k, alt) => detail[k] ?? raw[k] ?? raw.data?.[k] ?? raw.profile?.[k] ?? raw.lecturer_profile?.[k] ?? alt;
      const enriched = {
        id: lecturer.id,
        name: lecturer.name || get('name',''),
        email: lecturer.email || get('email',''),
        department: lecturer.department || get('department',''),
        position: lecturer.position || get('position','Lecturer'),
        status: lecturer.status || get('status','active'),
        phone: get('phone') || get('phone_number') || '',
        bio: get('qualifications',''),
        // normalize research fields
        specialization: get('researchFields') || get('research_fields') || lecturer.researchFields || [],
        education: get('education') || [],
        experience: get('experience') || [],
        cvUploaded: get('cvUploaded') || false,
        cvFilePath: get('cvFilePath') || get('cv_file_path') || '',
        syllabusUploaded: get('syllabusUploaded') || false,
        syllabusFilePath: get('syllabusFilePath') || get('syllabus_file_path') || '',
        // bank/payroll (many possible keys)
        bank_name: get('bank_name','') || get('bankName',''),
        account_name: get('account_name','') || get('accountName',''),
        account_number: get('account_number','') || get('accountNumber',''),
  payrollFilePath: get('payrollFilePath') || get('payroll_file_path') || get('payroll_path') || get('payrollPath') || get('pay_roll_in_riel') || ''
      };
      setSelectedLecturer(enriched);
      setIsEditDialogOpen(true);
      setEditTab('basic');
    } catch(e){
      toast.error('Failed to load lecturer');
      console.error(e);
    }
  };

  const saveEditProfile = async ()=> {
    if(!selectedLecturer) return;
    try {
      // Save bio (qualifications) & research_fields
  await axiosInstance.patch(`/lecturers/${selectedLecturer.id}/profile`, {
    qualifications: selectedLecturer.bio || '',
  research_fields: selectedLecturer.specialization.join(','),
  phone_number: selectedLecturer.phone || null,
  bank_name: selectedLecturer.bank_name || null,
  account_name: selectedLecturer.account_name || null,
  account_number: selectedLecturer.account_number || null
  });
      // Optionally update status/position via update user endpoint
      await axiosInstance.put(`/lecturers/${selectedLecturer.id}`, {
        // fullName not editable here; include position/status if changed
        position: selectedLecturer.position,
        status: selectedLecturer.status
      });
      // reflect in table
      setLecturers(prev=> prev.map(l=> l.id===selectedLecturer.id ? { ...l, status: selectedLecturer.status, position: selectedLecturer.position } : l));
      toast.success('Profile updated');
      setIsEditDialogOpen(false);
    } catch(e){
      console.error(e);
      toast.error('Save failed');
    }
  };

    const handlePayrollUpload = async (file) => {
      if(!selectedLecturer || !file) return;
      const fd = new FormData();
      fd.append('payroll', file);
      try{
        toast.loading('Uploading payroll...');
        const res = await axiosInstance.post(`/lecturers/${selectedLecturer.id}/payroll`, fd, { headers:{ 'Content-Type':'multipart/form-data' } });
        // expect server to return updated path under several possible keys
        const newPath = res.data.path || res.data.payrollFilePath || res.data.profile?.pay_roll_in_riel || res.data.profile?.payrollPath || res.data.pay_roll_in_riel;
        setSelectedLecturer(p=> ({ ...p, payrollFilePath: newPath || p.payrollFilePath, payrollUploaded: true }));
        // if drawer open for same lecturer, update it too
        setProfileDrawer(prev => {
          if(!prev.open) return prev;
          if(prev.lecturer && prev.lecturer.id === selectedLecturer.id){
            return { ...prev, detail: { ...(prev.detail||{}), payrollFilePath: newPath || prev.detail?.payrollFilePath } };
          }
          return prev;
        });
        toast.dismiss(); toast.success('Payroll uploaded');
      }catch(e){ toast.dismiss(); toast.error(e.response?.data?.message || 'Upload failed'); console.error(e); }
    };

  const handleFileUpload = async (file)=> {
    if(!file){ return; }
    toast.error('CV upload not implemented for admin yet');
    // Placeholder: implement backend route for admin CV upload if needed
  };

  const openAssign = async (lecturer)=> {
    try {
      setAssigning(lecturer);
      setAssignLoading(true);
      // fetch detail for selected courses
      const detailRes = await axiosInstance.get(`/lecturers/${lecturer.id}/detail`);
      const detail = detailRes.data;
      // fetch all courses once (reuse if already loaded)
      if(!coursesCatalog.length){
        const coursesRes = await axiosInstance.get('/catalog/courses');
        const all = Array.isArray(coursesRes.data)? coursesRes.data : (coursesRes.data.courses || []);
        setCoursesCatalog(all);
      }
      setSelectedCourses(detail.courses?.map(c=> c.course_code).filter(Boolean) || []);
    } catch(e){
      toast.error('Failed to open course assignment');
      console.error(e);
      setAssigning(null);
    } finally { setAssignLoading(false); closeMenu(); }
  };

  const toggleCourseSelection = (course_code)=> {
    setSelectedCourses(prev=> prev.includes(course_code)? prev.filter(c=> c!==course_code): [...prev, course_code]);
  };

  const saveAssignment = async ()=> {
    if(!assigning) return;
    try {
      // map selected course codes to ids
      const map = new Map(coursesCatalog.map(c=> [c.course_code, c.id]));
      const course_ids = selectedCourses.map(code=> map.get(code)).filter(Boolean);
      setAssignLoading(true);
      await axiosInstance.put(`/lecturers/${assigning.id}/courses`, { course_ids });
      toast.success('Courses updated');
      // refresh just counts
      setLecturers(prev=> prev.map(l=> l.id===assigning.id? { ...l, coursesCount: selectedCourses.length }: l));
      setAssigning(null);
    } catch(e){
      toast.error('Update failed');
      console.error(e);
    } finally { setAssignLoading(false); }
  };

  const cancelAssignment = ()=> { setAssigning(null); };

  useEffect(()=>{ function onDocClick(e){ if(!e.target.closest('.lecturer-action-menu')) closeMenu(); } document.addEventListener('click', onDocClick); const onScrollOrResize=()=> closeMenu(); window.addEventListener('scroll', onScrollOrResize,true); window.addEventListener('resize', onScrollOrResize); return ()=>{ document.removeEventListener('click', onDocClick); window.removeEventListener('scroll', onScrollOrResize,true); window.removeEventListener('resize', onScrollOrResize); }; },[]);
  useEffect(()=>{ if(isEditDialogOpen){ const o=document.body.style.overflow; document.body.style.overflow='hidden'; return ()=>{ document.body.style.overflow=o; }; } },[isEditDialogOpen]);

  // When profile drawer opens, fetch fresh detail (including bank/payroll) for display
  useEffect(()=>{
    const loadDetail = async ()=>{
      if(!profileDrawer.open || !profileDrawer.lecturer) return;
      try{
        setProfileDrawer(p=> ({ ...p, loading:true }));
        const res = await axiosInstance.get(`/lecturers/${profileDrawer.lecturer.id}/detail`);
        const d = res.data || {};
        const merged = {
          ...d,
          bank_name: d.bank_name || d.bankName || '',
          account_name: d.account_name || d.accountName || '',
          account_number: d.account_number || d.accountNumber || '',
          // Support multiple possible keys returned from server
          payrollFilePath: d.payrollFilePath || d.payroll_file_path || d.payrollPath || d.pay_roll_in_riel || ''
        };
        setProfileDrawer(p=> ({ ...p, loading:false, detail: merged }));
      }catch(e){
        console.error('Failed to load profile drawer detail', e);
        setProfileDrawer(p=> ({ ...p, loading:false }));
      }
    };
    loadDetail();
  },[profileDrawer.open, profileDrawer.lecturer]);

  return <div className='p-8 space-y-6 bg-gray-50 min-h-screen'>
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900'>Lecturer Management</h1>
          <p className='text-gray-600 mt-2'>Manage lecturers (create, edit, activate/deactivate, delete)</p>
        </div>
  {/* Removed standalone Add Lecturer button (navigation handled by tabs below) */}
      </div>
      <div className='flex items-center justify-between'>
        <div className='flex items-center'>
          <div role='tablist' aria-label='Lecturer management views' className='inline-flex rounded-lg bg-gray-100 p-1 shadow-inner'>
            <button
              role='tab'
              aria-selected={activeView==='list'}
              onClick={()=> setActiveView('list')}
              className={`relative px-4 py-2 text-sm font-medium rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white
              ${activeView==='list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-800 hover:bg-white/70'}`}
            >
              <span className='flex items-center gap-1'><Users className='w-4 h-4'/> Lecturer List</span>
              {activeView==='list' && <span className='absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500' />}
            </button>
            <button
              role='tab'
              aria-selected={activeView==='add'}
              onClick={()=> { setActiveView('add'); }}
              className={`relative px-4 py-2 text-sm font-medium rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white
              ${activeView==='add' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-800 hover:bg-white/70'}`}
            >
              <span className='flex items-center gap-1'><Plus className='w-4 h-4'/> Add Lecturer</span>
              {activeView==='add' && <span className='absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500' />}
            </button>
          </div>
        </div>
      </div>
    </div>

  {activeView==='list' && <Card>
      <CardContent className='pt-6'>
        <div className='flex flex-col md:flex-row gap-4'>
          <div className='flex-1'>
            <div className='bg-white rounded-md py-1 px-3 flex items-center gap-2 shadow-sm border border-gray-400 max-w-3xl mx-auto w-full'>
              <div className='flex items-center gap-2 w-full'>
                <Search className='text-gray-400 w-4 h-4' />
                <Input placeholder='Search by name' value={searchQuery} onChange={e=> setSearchQuery(e.target.value)} className='border-0 shadow-none h-8 text-sm placeholder-gray-400 w-full' />
              </div>
              {/* filters removed - only search kept */}
            </div>
          </div>
        </div>
      </CardContent>
  </Card>}

  {activeView==='add' && <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'><Plus className='w-5 h-5'/> Create Lecturer</CardTitle>
        <CardDescription>Add a new lecturer and view lecturers created this session.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div>
          <Button onClick={()=> setIsCreateModalOpen(true)} className='flex items-center gap-2'><Plus className='w-4 h-4'/> New Lecturer</Button>
        </div>
        <div className='border rounded-md overflow-hidden'>
          <div className='px-4 py-3 bg-gray-50 flex items-center justify-between'>
            <p className='text-sm font-medium text-gray-700'>Session Created ({createdLecturers.length})</p>
          </div>
          {createdLecturers.length === 0 ? (
            <div className='p-6 text-sm text-gray-500 text-center'>No lecturers created yet this session.</div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left text-gray-500'>
                    <th className='px-4 py-2 font-medium'>Name</th>
                    <th className='px-4 py-2 font-medium'>Email</th>
                    <th className='px-4 py-2 font-medium'>Temp Password</th>
                    <th className='px-4 py-2 font-medium'>Status</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-200'>
                  {createdLecturers.map(c => (
                    <tr key={c.id} className='hover:bg-gray-50'>
                      <td className='px-4 py-2 whitespace-nowrap font-medium text-gray-800'>{c.name}</td>
                      <td className='px-4 py-2 whitespace-nowrap text-gray-600'>{c.email}</td>
                      <td className='px-4 py-2 whitespace-nowrap text-xs'>
                        {c.tempPassword ? (
                          <div className='flex items-center gap-2'>
                            <span className='font-mono select-none'>••••••••</span>
                            <button
                              type='button'
                              onClick={()=> { navigator.clipboard.writeText(c.tempPassword); toast.success('Copied'); }}
                              className='px-2 py-0.5 text-[11px] rounded border bg-white hover:bg-gray-100'
                              title='Copy temp password'
                            >Copy</button>
                          </div>
                        ) : '—'}
                      </td>
                      <td className='px-4 py-2 whitespace-nowrap'><Badge className='bg-gray-100 text-gray-700 font-semibold'>active</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>}

  {activeView==='list' && <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'><Users className='w-5 h-5'/> Lecturers ({totalLecturers})</CardTitle>
        <CardDescription>All lecturer accounts</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='p-8 text-center'>
            <div className='animate-spin h-12 w-12 rounded-full border-b-2 border-blue-600 mx-auto'></div>
            <p className='mt-4 text-gray-600'>Loading lecturers...</p>
          </div>
        ) : lecturers.length===0 ? (
          <div className='p-8 text-center text-gray-600'>No lecturers found.</div>
        ) : (
          <div className='bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm bg-white'>
                <thead>
                  <tr className='text-left'>
                    <th className='px-6 py-3 font-medium text-xs uppercase tracking-wider text-gray-500 bg-gray-50'>Name</th>
                    <th className='px-6 py-3 font-medium text-xs uppercase tracking-wider text-gray-500 bg-gray-50'>Department</th>
                    <th className='px-6 py-3 font-medium text-xs uppercase tracking-wider text-gray-500 bg-gray-50'>Position</th>
                    <th className='px-6 py-3 font-medium text-xs uppercase tracking-wider text-gray-500 bg-gray-50'>Research Fields</th>
                    <th className='px-6 py-3 font-medium text-xs uppercase tracking-wider text-gray-500 bg-gray-50'>Courses</th>
                    <th className='px-6 py-3 font-medium text-xs uppercase tracking-wider text-gray-500 bg-gray-50'>Status</th>
                    <th className='px-6 py-3 font-medium text-xs uppercase tracking-wider text-gray-500 bg-gray-50 text-right'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lecturers.map(l=> (
                    <tr key={l.id} className='hover:bg-gray-100 odd:bg-white even:bg-gray-50 transition-colors'>
                      <td className='px-6 py-4 font-medium text-gray-800 whitespace-nowrap'>
                          <div className='flex flex-col'>
                            <span className='text-sm font-medium'>{l.name}</span>
                            <span className='text-xs text-gray-500'>{l.email}</span>
                          </div>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-gray-600'>{l.department||'—'}</td>
                      <td className='px-6 py-4 whitespace-nowrap text-gray-600'>{l.position||'Lecturer'}</td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <div className='flex flex-wrap gap-2'>
                          {l.researchFields && l.researchFields.length>0 ? l.researchFields.slice(0,3).map((s,i)=> <span key={i} className='px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold'>{s}</span>) : <span className='text-xs text-gray-400'>—</span>}
                          {l.researchFields && l.researchFields.length>3 && <span className='px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold'>+{l.researchFields.length-3}</span>}
                        </div>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-gray-600'>
                        <div className='flex flex-wrap gap-2'>
                          {l.courses && l.courses.length>0 ? l.courses.slice(0,3).map((c,i)=> <span key={i} className='px-3 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold'>{c.course_name || c.name || c.courseCode || c.course_code || c}</span>) : <span className='text-xs text-gray-400'>—</span>}
                          {l.courses && l.courses.length>3 && <span className='px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold'>+{l.courses.length-3}</span>}
                        </div>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${l.status==='active' ? 'bg-green-100 text-green-800' : l.status==='inactive' ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-800'}`}>{l.status}</span>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-right relative lecturer-action-menu'>
                        <button className='p-2 rounded hover:bg-gray-100 text-gray-500' onClick={e=> openMenu(l.id, e)}><MoreHorizontal className='w-5 h-5'/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages>1 && (
              <div className='flex items-center justify-between px-6 py-4 border-t mt-2'>
                <p className='text-sm text-gray-600'>Page {page} of {totalPages}</p>
                <div className='flex items-center gap-2'>
                  <button onClick={()=> setPage(p=> Math.max(1,p-1))} disabled={page===1} className={`px-3 py-1 rounded border text-sm ${page===1?'text-gray-400 border-gray-200 cursor-not-allowed':'hover:bg-gray-50'}`}>Prev</button>
                  {Array.from({length: totalPages},(_,i)=> i+1).slice(Math.max(0,page-3), page+2).map(p=> <button key={p} onClick={()=> setPage(p)} className={`px-3 py-1 rounded text-sm border ${p===page? 'bg-blue-600 text-white border-blue-600':'hover:bg-gray-50 border-gray-200 text-gray-700'}`}>{p}</button>)}
                  <button onClick={()=> setPage(p=> Math.min(totalPages,p+1))} disabled={page===totalPages} className={`px-3 py-1 rounded border text-sm ${page===totalPages?'text-gray-400 border-gray-200 cursor-not-allowed':'hover:bg-gray-50'}`}>Next</button>
                </div>
              </div>
            )}
          </div>
        ) }
      </CardContent>
    </Card>}

  <CreateLecturerModal isOpen={isCreateModalOpen} onClose={()=> setIsCreateModalOpen(false)} onLecturerCreated={(lec)=>{ const raw= lec.email.split('@')[0].replace(/\./g,' '); const display= raw.split(' ').map(w=> w.charAt(0).toUpperCase()+w.slice(1)).join(' '); const normalized={ id: lec.id, name: display, email: lec.email, status:'inactive', lastLogin:'Never', role:'lecturer', tempPassword: lec.tempPassword }; setLecturers(prev=> [normalized, ...prev]); setCreatedLecturers(prev=> [normalized, ...prev]); }}/>

    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
      <DialogContent className="max-w-4xl max-h-[95vh] w-full sm:w-auto overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lecturer Profile</DialogTitle>
          <DialogDescription>Update lecturer information and upload documents</DialogDescription>
        </DialogHeader>
        {selectedLecturer && (
          <div className='space-y-6'>
            <Tabs value={editTab} onValueChange={setEditTab}>
              <TabsList>
                <TabsTrigger value='basic'>Basic Info</TabsTrigger>
                <TabsTrigger value='education'>Education</TabsTrigger>
                <TabsTrigger value='bank'>Bank Info</TabsTrigger>
                <TabsTrigger value='documents'>Documents</TabsTrigger>
              </TabsList>
              <TabsContent value='basic'>
                <div className='space-y-4'>
                  <div className='grid grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label>Full Name</Label>
                      <Input value={selectedLecturer.name} readOnly />
                    </div>
                    <div className='space-y-2'>
                      <Label>Email</Label>
                      <Input value={selectedLecturer.email} readOnly />
                    </div>
                    <div className='space-y-2'>
                      <Label>Phone</Label>
                      <Input value={selectedLecturer.phone} onChange={e=> setSelectedLecturer(p=> ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className='space-y-2'>
                      <Label>Department</Label>
                      <Input value={selectedLecturer.department} readOnly />
                    </div>
                    <div className='space-y-2'>
                      <Label>Position</Label>
                      <Select value={selectedLecturer.position} onValueChange={val=> setSelectedLecturer(p=> ({ ...p, position: val }))}>
                        <SelectItem value='Assistant Professor'>Assistant Professor</SelectItem>
                        <SelectItem value='Associate Professor'>Associate Professor</SelectItem>
                        <SelectItem value='Professor'>Professor</SelectItem>
                        <SelectItem value='Lecturer'>Lecturer</SelectItem>
                      </Select>
                    </div>
                    <div className='space-y-2'>
                      <Label>Status</Label>
                      <Select value={selectedLecturer.status} onValueChange={val=> setSelectedLecturer(p=> ({ ...p, status: val }))}>
                        <SelectItem value='active'>Active</SelectItem>
                        <SelectItem value='inactive'>Inactive</SelectItem>
                        <SelectItem value='on-leave'>On Leave</SelectItem>
                      </Select>
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <Label>Bio</Label>
                    <Textarea rows={4} value={selectedLecturer.bio} onChange={e=> setSelectedLecturer(p=> ({ ...p, bio: e.target.value }))} />
                  </div>
                  <div className='space-y-2'>
                    <Label>Research Field</Label>
                    <div className='flex flex-wrap gap-2'>
                      {selectedLecturer.specialization.length? selectedLecturer.specialization.map(spec=> <Badge key={spec} variant='secondary'>{spec}</Badge>) : <span className='text-xs text-gray-400'>None</span>}
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value='education'>
                <div className='space-y-4'>
                  {selectedLecturer.education.length ? selectedLecturer.education.map(edu=> (
                    <Card key={edu.id || edu.degree+edu.institution}>
                      <CardContent className='pt-4'>
                        <div className='grid grid-cols-2 gap-4 text-sm'>
                          <div>
                            <Label className='text-xs font-semibold'>Degree</Label>
                            <p>{edu.degree}</p>
                          </div>
                          <div>
                            <Label className='text-xs font-semibold'>Institution</Label>
                            <p>{edu.institution}</p>
                          </div>
                          <div>
                            <Label className='text-xs font-semibold'>Major</Label>
                            <p>{edu.major}</p>
                          </div>
                          <div>
                            <Label className='text-xs font-semibold'>Year</Label>
                            <p>{edu.year}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )) : <p className='text-gray-500 text-center py-8 text-sm'>No education records found</p>}
                </div>
              </TabsContent>
              <TabsContent value='bank'>
                <div className='space-y-4'>
                  <div className='grid grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label>Bank Name</Label>
                      <Input value={selectedLecturer.bank_name || selectedLecturer.bankName || ''} onChange={e=> setSelectedLecturer(p=> ({ ...p, bank_name: e.target.value }))} />
                    </div>
                    <div className='space-y-2'>
                      <Label>Account Name</Label>
                      <Input value={selectedLecturer.account_name || selectedLecturer.accountName || ''} onChange={e=> setSelectedLecturer(p=> ({ ...p, account_name: e.target.value }))} />
                    </div>
                    <div className='space-y-2'>
                      <Label>Account Number</Label>
                      <Input value={selectedLecturer.account_number || selectedLecturer.accountNumber || ''} onChange={e=> setSelectedLecturer(p=> ({ ...p, account_number: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label className='text-base font-medium'>Payroll Document / Image</Label>
                    <div className='mt-2'>
                      {selectedLecturer.payrollFilePath || selectedLecturer.payrollUploaded ? (
                        <div className='flex items-center justify-between p-4 border rounded-lg'>
                          <div className='flex items-center gap-4'>
                            {/* show thumbnail if image or file icon otherwise */}
                            {selectedLecturer.payrollFilePath ? (()=>{
                              const path = selectedLecturer.payrollFilePath.startsWith('uploads/')? selectedLecturer.payrollFilePath : `uploads/${selectedLecturer.payrollFilePath.replace(/^\/?/, '')}`;
                              const url = `${window.location.origin.replace(/:\d+$/,':4000')}/${path}`;
                              const isPdf = String(url).toLowerCase().endsWith('.pdf');
                              if(isPdf){
                                return (
                                  <>
                                    <div className='w-24 h-16 flex items-center justify-center rounded-md border bg-gray-50'>
                                      <FileText className='w-8 h-8 text-red-600' />
                                    </div>
                                    <div>
                                      <p className='font-medium'>Uploaded Payroll</p>
                                      <p className='text-sm text-gray-600'>PDF Document</p>
                                    </div>
                                  </>
                                );
                              }
                              return (
                                <>
                                  <img src={url} alt='Payroll' className='w-24 h-16 object-cover rounded-md border' />
                                  <div>
                                    <p className='font-medium'>Uploaded Payroll</p>
                                    <p className='text-sm text-gray-600'>Preview below</p>
                                  </div>
                                </>
                              );
                            })() : (
                              <div className='text-sm text-gray-500'>No payroll file available</div>
                            )}
                          </div>
                          <div className='flex gap-2'>
                            {selectedLecturer.payrollFilePath && (()=>{
                              const path = selectedLecturer.payrollFilePath.startsWith('uploads/')? selectedLecturer.payrollFilePath : `uploads/${selectedLecturer.payrollFilePath.replace(/^\/?/, '')}`;
                              const url = `${window.location.origin.replace(/:\d+$/,':4000')}/${path}`;
                              return <>
                                {/* For PDFs, preview in new tab; images will open too */}
                                <a href={url} target='_blank' rel='noreferrer' className='inline-flex items-center px-3 py-1.5 text-xs rounded border hover:bg-gray-50'><Eye className='w-4 h-4 mr-1'/> Preview</a>
                                <a href={url} download className='inline-flex items-center px-3 py-1.5 text-xs rounded border hover:bg-gray-50'><Download className='w-4 h-4 mr-1'/> Download</a>
                              </>;
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className='text-center py-8 border-2 border-dashed border-gray-300 rounded-lg'>
                          <p className='text-gray-600 text-sm'>No payroll uploaded</p>
                        </div>
                      )}
                      <div className='flex items-center gap-4 mt-3'>
                        <input type='file' accept='image/*,.pdf' onChange={e=> e.target.files?.[0] && handlePayrollUpload(e.target.files[0])} className='hidden' id='payroll-upload'/>
                        <Label htmlFor='payroll-upload' className='cursor-pointer'>
                          <span className='inline-flex items-center px-3 py-2 text-xs rounded border bg-white hover:bg-gray-50'><Upload className='w-4 h-4 mr-1'/> Upload Payroll</span>
                        </Label>
                        <p className='text-xs text-gray-600'>Image or PDF, max 10MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value='documents'>
                <div className='space-y-6'>
                  <div>
                    <Label className='text-base font-medium'>Curriculum Vitae (CV)</Label>
                    <div className='mt-2 space-y-4'>
                      {selectedLecturer.cvUploaded ? (
                        <div className='flex items-center justify-between p-4 border rounded-lg'>
                          <div className='flex items-center'>
                            <FileText className='h-8 w-8 text-red-600 mr-3'/>
                            <div>
                              <p className='font-medium'>Current CV</p>
                              <p className='text-sm text-gray-600'>PDF Document</p>
                            </div>
                          </div>
                          <div className='flex gap-2'>
                            {selectedLecturer.cvFilePath && (()=>{ const path = selectedLecturer.cvFilePath.startsWith('uploads/')? selectedLecturer.cvFilePath : `uploads/${selectedLecturer.cvFilePath.replace(/^\/?/, '')}`; const url = `${window.location.origin.replace(/:\d+$/,':4000')}/${path}`; return <>
                              <a href={url} target='_blank' rel='noreferrer' className='inline-flex items-center px-3 py-1.5 text-xs rounded border hover:bg-gray-50'><Eye className='w-4 h-4 mr-1'/> Preview</a>
                              <a href={url} download className='inline-flex items-center px-3 py-1.5 text-xs rounded border hover:bg-gray-50'><Download className='w-4 h-4 mr-1'/> Download</a>
                            </>; })()}
                          </div>
                        </div>
                      ) : (
                        <div className='text-center py-8 border-2 border-dashed border-gray-300 rounded-lg'>
                          <FileText className='h-12 w-12 text-gray-400 mx-auto mb-4'/>
                          <p className='text-gray-600 text-sm'>No CV uploaded</p>
                        </div>
                      )}
                      <div className='flex items-center gap-4'>
                        <input type='file' accept='.pdf' onChange={e=> e.target.files?.[0] && handleFileUpload(e.target.files[0])} className='hidden' id='cv-upload'/>
                        <Label htmlFor='cv-upload' className='cursor-pointer'>
                          <span className='inline-flex items-center px-3 py-2 text-xs rounded border bg-white hover:bg-gray-50'><Upload className='w-4 h-4 mr-1'/> Upload New CV</span>
                        </Label>
                        <p className='text-xs text-gray-600'>PDF only, max 10MB</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className='text-base font-medium'>Course Syllabus</Label>
                    <div className='mt-2 space-y-4'>
                      {selectedLecturer.syllabusUploaded ? (
                        <div className='flex items-center justify-between p-4 border rounded-lg'>
                          <div className='flex items-center'>
                            <FileText className='h-8 w-8 text-blue-600 mr-3'/>
                            <div>
                              <p className='font-medium'>Current Syllabus</p>
                              <p className='text-sm text-gray-600'>PDF Document</p>
                            </div>
                          </div>
                          <div className='flex gap-2'>
                            {selectedLecturer.syllabusFilePath && (()=>{ const path = selectedLecturer.syllabusFilePath.startsWith('uploads/')? selectedLecturer.syllabusFilePath : `uploads/${selectedLecturer.syllabusFilePath.replace(/^\/?/,'')}`; const url = `${window.location.origin.replace(/:\d+$/,':4000')}/${path}`; return <>
                              <a href={url} target='_blank' rel='noreferrer' className='inline-flex items-center px-3 py-1.5 text-xs rounded border hover:bg-gray-50'><Eye className='w-4 h-4 mr-1'/> Preview</a>
                              <a href={url} download className='inline-flex items-center px-3 py-1.5 text-xs rounded border hover:bg-gray-50'><Download className='w-4 h-4 mr-1'/> Download</a>
                            </>; })()}
                          </div>
                        </div>
                      ) : (
                        <div className='text-center py-8 border-2 border-dashed border-gray-300 rounded-lg'>
                          <FileText className='h-12 w-12 text-gray-400 mx-auto mb-4'/>
                          <p className='text-gray-600 text-sm'>No syllabus uploaded</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            <div className='flex justify-end gap-3 border-t pt-4'>
              <Button variant='outline' onClick={()=> setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveEditProfile}>Save Changes</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {isDeleteModalOpen && ReactDOM.createPortal(<div className='fixed inset-0 z-50'>
      <div className='absolute inset-0 bg-black/50' onClick={cancelDelete} />
      <div className='relative w-full h-full flex items-center justify-center p-4 pointer-events-none'>
        <div className='bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-5 pointer-events-auto'>
          <div className='flex items-start justify-between'>
            <h2 className='text-lg font-semibold text-gray-900'>Confirm Delete</h2>
            <button onClick={cancelDelete} className='text-gray-400 hover:text-gray-600'><X className='w-5 h-5'/></button>
          </div>
          <p className='text-sm text-gray-600'>Delete lecturer <span className='font-medium'>{lecturerToDelete?.email}</span>? This cannot be undone.</p>
          <div className='flex gap-3 pt-2'>
            <Button onClick={confirmDelete} className='flex-1 bg-red-600 hover:bg-red-700'>OK</Button>
            <Button variant='outline' onClick={cancelDelete} className='flex-1'>Cancel</Button>
          </div>
        </div>
      </div>
    </div>, document.body)}

    {openMenuId && (()=>{ const l= lecturers.find(x=> x.id===openMenuId); if(!l) return null; return <div className='fixed z-50 lecturer-action-menu' style={{ top: menuCoords.y, left: menuCoords.x }}>
      <div className='w-44 bg-white border border-gray-200 rounded-md shadow-lg py-2 text-sm'>
        <button onClick={()=> openEdit(l)} className='w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left'><Edit3 className='w-4 h-4'/> Edit</button>
        <button onClick={()=> openAssign(l)} className='w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left'><BookOpen className='w-4 h-4'/> Courses</button>
        <button onClick={()=> handleDeactivate(l)} className='w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left'>{l.status==='active'? (<><UserX className='w-4 h-4'/> Deactivate</>):(<><UserCheck className='w-4 h-4'/> Activate</> )}</button>
        <button onClick={()=> requestDelete(l)} className='w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-red-600'><Trash2 className='w-4 h-4'/> Delete</button>
      </div>
    </div>; })()}
    {/* Specialization badges inline overlay (optional stacked UI): we add row after table if detail open - skipped for brevity */}
    <AssignCoursesDialog
      open={!!assigning}
      onOpenChange={(o)=> { if(!o) setAssigning(null); }}
      availableCourses={coursesCatalog}
      selectedCourses={selectedCourses}
      onToggleCourse={toggleCourseSelection}
      onSave={saveAssignment}
      onCancel={cancelAssignment}
      className={assigning?.name}
    />
    {assigning && assignLoading && <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/30'><div className='flex items-center gap-3 bg-white px-6 py-4 rounded shadow'><Loader2 className='w-5 h-5 animate-spin text-blue-600'/><span className='text-sm text-gray-700'>Loading courses...</span></div></div>}
    {profileDrawer.open && ReactDOM.createPortal(<div className='fixed inset-0 z-50 flex'>
      <div className='flex-1 bg-black/40' onClick={()=> setProfileDrawer({ open:false, lecturer:null, loading:false, detail:null, activeTab:'overview', saving:false })} />
      <div className='w-full max-w-lg bg-white h-full shadow-xl overflow-hidden flex flex-col'>
        <div className='flex items-center justify-between px-5 py-4 border-b'>
          <div>
            <h2 className='text-lg font-semibold text-gray-900'>Lecturer Profile</h2>
            <p className='text-xs text-gray-500'>{profileDrawer.lecturer?.email}</p>
          </div>
          <button onClick={()=> setProfileDrawer({ open:false, lecturer:null, loading:false, detail:null, activeTab:'overview', saving:false })} className='text-gray-400 hover:text-gray-600'><X className='w-5 h-5'/></button>
        </div>
        <div className='flex border-b text-sm'>
          {['overview','bank','specialization','documents'].map(tab=> <button key={tab} onClick={()=> setProfileDrawer(p=> ({ ...p, activeTab:tab }))} className={`px-4 py-2 -mb-px border-b-2 ${profileDrawer.activeTab===tab? 'border-blue-600 text-blue-600 font-medium':'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab==='overview'?'Overview':tab==='specialization'?'Research Fields':tab==='bank'?'Bank Info':'Documents'}</button>)}
        </div>
        <div className='flex-1 overflow-y-auto p-5 text-sm relative'>
          {profileDrawer.loading && <div className='absolute inset-0 flex items-center justify-center bg-white/60'><Loader2 className='w-6 h-6 animate-spin text-blue-600'/></div>}
          {!profileDrawer.loading && profileDrawer.detail && (
            <>
              {profileDrawer.activeTab==='overview' && <div className='space-y-4'>
                <div>
                  <p className='text-xs font-semibold text-gray-500 mb-1'>Name</p>
                  <p className='text-gray-800 font-medium'>{profileDrawer.detail.name}</p>
                </div>
                <div>
                  <p className='text-xs font-semibold text-gray-500 mb-1'>Departments</p>
                  <div className='flex flex-wrap gap-2'>{(profileDrawer.detail.departments||[]).map(d=> <span key={d.id} className='px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700'>{d.name}</span>)}</div>
                </div>
                <div>
                  <p className='text-xs font-semibold text-gray-500 mb-1'>Courses Count</p>
                  <p>{profileDrawer.detail.coursesCount}</p>
                </div>
                <div>
                  <p className='text-xs font-semibold text-gray-500 mb-1'>Qualifications</p>
                  <textarea className='w-full border rounded p-2 h-24 text-xs' value={profileDrawer.detail.qualifications||''} onChange={e=> setProfileDrawer(p=> ({ ...p, detail:{ ...p.detail, qualifications:e.target.value } }))} />
                </div>
              </div>}
              {profileDrawer.activeTab==='bank' && <div className='space-y-4'>
                <div>
                  <p className='text-xs font-semibold text-gray-500 mb-1'>Bank Name</p>
                  <p className='text-gray-800 font-medium'>{profileDrawer.detail.bank_name || profileDrawer.detail.bankName || '—'}</p>
                </div>
                <div>
                  <p className='text-xs font-semibold text-gray-500 mb-1'>Account Name</p>
                  <p className='text-gray-800 font-medium'>{profileDrawer.detail.account_name || profileDrawer.detail.accountName || '—'}</p>
                </div>
                <div>
                  <p className='text-xs font-semibold text-gray-500 mb-1'>Account Number</p>
                  <p className='text-gray-800 font-medium'>{profileDrawer.detail.account_number || profileDrawer.detail.accountNumber || '—'}</p>
                </div>
                <div>
                  <p className='text-xs font-semibold text-gray-500 mb-1'>Payroll Document</p>
                  {profileDrawer.detail.payrollFilePath ? (()=>{
                    const path = profileDrawer.detail.payrollFilePath.startsWith('uploads/')? profileDrawer.detail.payrollFilePath : `uploads/${profileDrawer.detail.payrollFilePath.replace(/^\/?/, '')}`;
                    const url = `${window.location.origin.replace(/:\d+$/,':4000')}/${path}`;
                    const isPdf = String(url).toLowerCase().endsWith('.pdf');
                    if(isPdf){
                      return (
                        <div className='flex items-center gap-4'>
                          <div className='w-28 h-20 flex items-center justify-center rounded-md border bg-gray-50'>
                            <FileText className='w-10 h-10 text-red-600'/>
                          </div>
                          <div className='flex gap-2'>
                            <a href={url} target='_blank' rel='noreferrer' className='inline-flex items-center px-3 py-1.5 text-xs rounded border hover:bg-gray-50'><Eye className='w-4 h-4 mr-1'/> Preview</a>
                            <a href={url} download className='inline-flex items-center px-3 py-1.5 text-xs rounded border hover:bg-gray-50'><Download className='w-4 h-4 mr-1'/> Download</a>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className='flex items-center gap-4'>
                        <img src={url} alt='Payroll' className='w-28 h-20 object-cover rounded-md border' />
                        <div className='flex gap-2'>
                          <a href={url} target='_blank' rel='noreferrer' className='inline-flex items-center px-3 py-1.5 text-xs rounded border hover:bg-gray-50'><Eye className='w-4 h-4 mr-1'/> Preview</a>
                          <a href={url} download className='inline-flex items-center px-3 py-1.5 text-xs rounded border hover:bg-gray-50'><Download className='w-4 h-4 mr-1'/> Download</a>
                        </div>
                      </div>
                    );
                  })() : <div className='text-sm text-gray-500'>No payroll uploaded</div>}
                </div>
              </div>}
              {profileDrawer.activeTab==='specialization' && <div className='space-y-4'>
                <p className='text-xs font-semibold text-gray-500'>Research / Specialization Tags</p>
                <div className='flex flex-wrap gap-2'>{(profileDrawer.detail.researchFields||[]).map((tag,i)=> <span key={i} className='px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs'>{tag}</span>)}
                  {!profileDrawer.detail.researchFields?.length && <span className='text-gray-400 text-xs italic'>None</span>}
                </div>
                <textarea placeholder='Comma separated tags e.g. AI, Data Mining, Cloud' className='w-full border rounded p-2 h-28 text-xs' value={profileDrawer.detail.research_fields||''} onChange={e=> setProfileDrawer(p=> ({ ...p, detail:{ ...p.detail, research_fields:e.target.value } }))} />
              </div>}
              {profileDrawer.activeTab==='documents' && <div className='space-y-4'>
                <p className='text-xs font-semibold text-gray-500'>Documents</p>
                <div className='space-y-2'>
                  <div className='flex items-center justify-between p-2 border rounded'>
                    <div className='flex items-center gap-2 text-xs'><FileText className='w-4 h-4 text-gray-500'/> CV</div>
                    {profileDrawer.detail.cvUploaded ? <a href={`/${profileDrawer.detail.cvFilePath}`} target='_blank' rel='noreferrer' className='text-blue-600 hover:underline text-xs'>Open</a> : <span className='text-gray-400 text-xs'>Not uploaded</span>}
                  </div>
                  <div className='flex items-center justify-between p-2 border rounded'>
                    <div className='flex items-center gap-2 text-xs'><FileText className='w-4 h-4 text-gray-500'/> Syllabus</div>
                    {profileDrawer.detail.syllabusUploaded ? <a href={`/${profileDrawer.detail.syllabusFilePath}`} target='_blank' rel='noreferrer' className='text-blue-600 hover:underline text-xs'>Open</a> : <span className='text-gray-400 text-xs'>Not uploaded</span>}
                  </div>
                </div>
              </div>}
            </>
          )}
        </div>
        <div className='border-t p-4 flex justify-between items-center'>
          <span className='text-xs text-gray-500'>Changes are not auto-saved</span>
          <div className='flex gap-2'>
            <button onClick={()=> setProfileDrawer({ open:false, lecturer:null, loading:false, detail:null, activeTab:'overview', saving:false })} className='px-3 py-1.5 text-xs rounded border text-gray-600 hover:bg-gray-50'>Close</button>
            <button disabled={profileDrawer.saving || profileDrawer.loading} onClick={async ()=> { if(!profileDrawer.detail) return; try { setProfileDrawer(p=> ({ ...p, saving:true })); await axiosInstance.patch(`/lecturers/${profileDrawer.lecturer.id}/profile`, { qualifications: profileDrawer.detail.qualifications||'', research_fields: profileDrawer.detail.research_fields||'' }); toast.success('Profile saved'); // update list specializations if changed
              if(profileDrawer.detail.research_fields){ const tags = profileDrawer.detail.research_fields.split(',').map(s=> s.trim()).filter(Boolean).slice(0,5); setLecturers(prev=> prev.map(l=> l.id===profileDrawer.lecturer.id? { ...l, specializations: tags }: l)); }
              setProfileDrawer(p=> ({ ...p, saving:false })); } catch(e){ toast.error('Save failed'); console.error(e); setProfileDrawer(p=> ({ ...p, saving:false })); } }} className='px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1'>{profileDrawer.saving && <Loader2 className='w-3 h-3 animate-spin'/>} Save</button>
          </div>
        </div>
      </div>
    </div>, document.body)}
  </div>;
}
