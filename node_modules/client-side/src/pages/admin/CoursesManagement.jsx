import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Plus, Edit, Trash2, GraduationCap, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore.js';
import axiosInstance from '../../lib/axios.js';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table.jsx';

export default function CoursesPage(){
  const { authUser: _authUser } = useAuthStore();
  const [courses,setCourses] = useState([]);
  const [search,setSearch] = useState('');
  const [sortBy,setSortBy] = useState('code'); // 'code' | 'name'
  const [hoursFilter,setHoursFilter] = useState(''); // '', '15', '30', '45', '90' or CSV like '15,30'
  const [loading,setLoading] = useState(false);
  const [creating,setCreating] = useState(false);
  const [updating,setUpdating] = useState(false);
  const [deletingId,setDeletingId] = useState(null);
  const [addOpen,setAddOpen] = useState(false);
  const [editOpen,setEditOpen] = useState(false);
  const [confirmDeleteOpen,setConfirmDeleteOpen] = useState(false);
  const [courseToDelete,setCourseToDelete] = useState(null);
  const emptyCourse = { course_code:'', course_name:'', description:'', hours:'', credits:'' };
  const [form,setForm] = useState(emptyCourse);
  const [formErrors, setFormErrors] = useState({ course_code: '', course_name: '' });
  const [editId,setEditId] = useState(null);
  const [page,setPage] = useState(1);
  const [hasMore,setHasMore] = useState(true);
  const limit = 10; // server-side pagination size
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);

  // Derive credits from hours: every 15 hours = 1 credit
  const creditsFromHours = (hours) => {
    const n = typeof hours === 'string' ? parseInt(hours, 10) : hours;
    if (!Number.isFinite(n) || n <= 0) return null;
    return n % 15 === 0 ? n / 15 : null;
  };

  const load = useCallback(async (reset=false)=>{
    if(loadingRef.current) return; // prevent parallel
    loadingRef.current = true;
    if(reset){ setPage(1); setHasMore(true); }
    if(reset) setCourses([]);
    setLoading(true);
    try {
      const targetPage = reset? 1 : page;
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', String(limit));
      if(sortBy) params.set('sortBy', sortBy);
      if(hoursFilter) params.set('hours', hoursFilter);
      const res = await axiosInstance.get(`/courses?${params.toString()}`);
      const payload = res.data;
      if(Array.isArray(payload)){
        // backward compatibility (non-paginated older backend)
        setCourses(payload);
        setHasMore(false);
      } else {
        setCourses(prev => reset? payload.data : [...prev, ...payload.data]);
        setHasMore(payload.hasMore);
      }
    } catch(e){
      toast.error(e?.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  },[page,limit,sortBy,hoursFilter]);

  useEffect(()=>{ load(true); },[]);

  // When sort/filter changes, reload from first page
  useEffect(()=>{ setPage(1); load(true); },[sortBy,hoursFilter]);


  // Infinite scroll observer
  useEffect(()=>{
    if(!hasMore) return;
    const el = sentinelRef.current;
    if(!el) return;
    const observer = new IntersectionObserver(entries => {
      const first = entries[0];
      if(first.isIntersecting && hasMore && !loading){
        setPage(p=>p+1);
      }
    }, { threshold: 1 });
    observer.observe(el);
    return ()=> observer.disconnect();
  },[hasMore,loading]);

  // Fetch next page when page increments (except initial already handled)
  useEffect(()=>{ if(page>1) load(); },[page]);

  const openAdd=()=>{ setForm(emptyCourse); setFormErrors({ course_code: '', course_name: '' }); setAddOpen(true); };
  const submitAdd=async()=>{
    if(!form.course_code || !form.course_name){ toast.error('Code & name required'); return; }
    setCreating(true);
    try {
  const hoursVal = form.hours ? Number(form.hours) : null;
  const derivedCredits = hoursVal ? creditsFromHours(hoursVal) : null;
  const payload = { ...form, hours: hoursVal, credits: derivedCredits ?? null };
      const res = await axiosInstance.post('/courses', payload);
      setCourses(prev=>[...prev, res.data.course]);
      toast.success('Course added');
      setAddOpen(false);
      setForm(emptyCourse);
      setFormErrors({ course_code: '', course_name: '' });
    } catch(e){
      const msg = e?.response?.data?.message;
      if (e?.response?.status === 409 && typeof msg === 'string') {
        if (msg.toLowerCase().includes('code')) setFormErrors(err=>({ ...err, course_code: msg }));
        if (msg.toLowerCase().includes('name')) setFormErrors(err=>({ ...err, course_name: msg }));
      }
      toast.error(msg || 'Add failed');
    } finally { setCreating(false); }
  };

  const openEdit=(c)=>{
    setEditId(c.id);
    setFormErrors({ course_code: '', course_name: '' });
    const hrs = c.hours ?? '';
    const derived = hrs !== '' ? creditsFromHours(hrs) : null;
    setForm({
      course_code: c.course_code,
      course_name: c.course_name,
      description: c.description||'',
      hours: hrs,
      credits: derived ?? (c.credits || '')
    });
    setEditOpen(true);
  };
  const submitEdit=async()=>{
    if(!editId) return; if(!form.course_code || !form.course_name){ toast.error('Code & name required'); return; }
    setUpdating(true);
    try {
  const hoursVal = form.hours ? Number(form.hours) : null;
  const derivedCredits = hoursVal ? creditsFromHours(hoursVal) : null;
  const payload = { ...form, hours: hoursVal, credits: derivedCredits ?? null };
      const res = await axiosInstance.put(`/courses/${editId}`, payload);
      setCourses(prev=> prev.map(c=> c.id===editId ? res.data.course : c));
      toast.success('Course updated');
      setEditOpen(false); setEditId(null);
    } catch(e){
      const msg = e?.response?.data?.message;
      if (e?.response?.status === 409 && typeof msg === 'string') {
        if (msg.toLowerCase().includes('code')) setFormErrors(err=>({ ...err, course_code: msg }));
        if (msg.toLowerCase().includes('name')) setFormErrors(err=>({ ...err, course_name: msg }));
      }
      toast.error(msg || 'Update failed');
    } finally { setUpdating(false); }
  };

  const deleteCourse=async(id)=>{
    setDeletingId(id);
    try {
      await axiosInstance.delete(`/courses/${id}`);
      setCourses(prev=> prev.filter(c=> c.id!==id));
      toast.success('Course deleted');
      setConfirmDeleteOpen(false); setCourseToDelete(null);
    } catch(e){ toast.error(e?.response?.data?.message || 'Delete failed'); }
    finally { setDeletingId(null); }
  };

  const filteredCourses = useMemo(()=>{
    if(!search.trim()) return courses;
    const term = search.trim().toLowerCase();
    return courses.filter(c =>
      (c.course_code || '').toLowerCase().startsWith(term) ||
      (c.course_name || '').toLowerCase().startsWith(term)
    );
  },[courses,search]);

  return (
    <div className="p-8 space-y-6">
      {/* NOTE: Server-side pagination (limit=10) with infinite scroll implemented. */}
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Courses Management</h1>
          <p className="text-gray-600">Manage department courses and curriculum</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
          <Plus className="h-4 w-4"/> Add Course
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="h-5 w-5 text-blue-600"/> Department Courses
              </CardTitle>
              <CardDescription>Manage all courses available in your department</CardDescription>
            </div>
            <div className="flex flex-col sm:items-end">
              <div className="text-xs text-gray-500">Showing <span className="font-medium text-gray-700">{filteredCourses.length}</span> of <span className="font-medium text-gray-700">{courses.length}</span> courses</div>
              {loading && <span className="inline-flex items-center text-xs text-gray-500 mt-1"><Loader2 className="h-4 w-4 animate-spin mr-1"/>Loading</span>}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center w-full">
              <div className="sm:w-72">
                <Input className="h-10" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by code or name" />
              </div>
              <div className="sm:w-48">
                <select
                  value={sortBy}
                  onChange={e=>setSortBy(e.target.value)}
                  className="w-full h-10 px-3 text-black bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="code">Sort: Code (A→Z)</option>
                  <option value="name">Sort: Name (A→Z)</option>
                </select>
              </div>
              <div className="sm:w-48">
                <select
                  value={hoursFilter}
                  onChange={e=>setHoursFilter(e.target.value)}
                  className="w-full h-10 px-3 text-black bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Hours</option>
                  <option value="15">15 hours</option>
                  <option value="30">30 hours</option>
                  <option value="45">45 hours</option>
                  <option value="90">90 hours</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="bg-gray-50/60">
                  <TableHead className="whitespace-nowrap">Course Code</TableHead>
                  <TableHead className="whitespace-nowrap">Course Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-20">Hours</TableHead>
                  <TableHead className="w-24">Credits</TableHead>
                  <TableHead className="w-28 text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCourses.map((c,idx)=> (
                  <TableRow key={c.id} className={idx%2===0? 'bg-white':'bg-gray-50'}>
                    <TableCell className="font-semibold text-gray-900">{c.course_code}</TableCell>
                    <TableCell className="text-gray-800">{c.course_name}</TableCell>
                    <TableCell className="max-w-xs text-gray-600" title={c.description||''}>
                      {c.description ? (
                        <span className="line-clamp-2 block">{c.description}</span>
                      ) : (
                        <span className="italic text-gray-400">No description</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        {c.hours ?? '-'}h
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        {c.credits ?? '-'} credits
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2 pr-2">
                        <button
                          onClick={()=>openEdit(c)}
                          title="Edit course"
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={()=>{ setCourseToDelete(c); setConfirmDeleteOpen(true); }}
                          disabled={deletingId===c.id}
                          title="Delete course"
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredCourses.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">{search? 'No matching courses':'No courses yet'}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/* loading course from database */}
          <div ref={sentinelRef} className="h-10 flex items-center justify-center text-xs text-gray-500">
            {loading && hasMore && <span>Loading more...</span>}
            {/* Clearify that there is no more courses */}
            {/* {!hasMore && <span className="text-gray-400">No more courses</span>} */}
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Course</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Course Code</label>
              <Input
                value={form.course_code}
                onChange={e=>{
                  const raw = e.target.value || '';
                  const sanitized = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                  setForm(f=>({...f, course_code: sanitized}));
                  setFormErrors(err=>({ ...err, course_code: '' }));
                }}
                pattern="[A-Z0-9]*"
                title="Use uppercase letters (A-Z) and numbers (0-9) only"
                placeholder="CS101"
              />
              {formErrors.course_code && <p className="mt-1 text-xs text-red-600">{formErrors.course_code}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Course Name</label>
              <Input value={form.course_name} onChange={e=>{ setForm(f=>({...f, course_name:e.target.value})); setFormErrors(err=>({ ...err, course_name: '' })); }} placeholder="Programming Fundamentals"/>
              {formErrors.course_name && <p className="mt-1 text-xs text-red-600">{formErrors.course_name}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={form.description}
                onChange={e=>setForm(f=>({...f, description:e.target.value}))}
                placeholder="Brief description"
                maxLength={300}
              />
              <div className="mt-1 text-xs text-gray-500 text-right">{(form.description || '').length}/300</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Hours</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[15,30,45,90].map(v=> (
                    <button
                      key={v}
                      type="button"
                      onClick={()=>{
                        const hours = String(v);
                        const credits = creditsFromHours(v);
                        setForm(f=>({...f, hours, credits: credits ?? ''}));
                      }}
                      className={`px-2 py-1 rounded-full border text-xs transition-colors ${String(form.hours)===String(v) ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      {v}h
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Credits</label>
                <div className="relative">
                  <Input type="number" min="0" value={form.credits} readOnly className="h-10 bg-gray-50 cursor-not-allowed" />
                </div>
                <p className="mt-1 text-xs text-gray-500">Credits are derived from hours<br />(every 15h = 1 credit).</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={()=>setAddOpen(false)}>Cancel</Button>
              <Button onClick={submitAdd} disabled={creating}>{creating? <Loader2 className="h-4 w-4 animate-spin"/>:'Add'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Course</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Course Code</label>
              <Input
                value={form.course_code}
                onChange={e=>{
                  const raw = e.target.value || '';
                  const sanitized = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                  setForm(f=>({...f, course_code: sanitized}));
                  setFormErrors(err=>({ ...err, course_code: '' }));
                }}
                pattern="[A-Z0-9]*"
                title="Use uppercase letters (A-Z) and numbers (0-9) only"
              />
              {formErrors.course_code && <p className="mt-1 text-xs text-red-600">{formErrors.course_code}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Course Name</label>
              <Input value={form.course_name} onChange={e=>{ setForm(f=>({...f, course_name:e.target.value})); setFormErrors(err=>({ ...err, course_name: '' })); }}/>
              {formErrors.course_name && <p className="mt-1 text-xs text-red-600">{formErrors.course_name}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={form.description}
                onChange={e=>setForm(f=>({...f, description:e.target.value}))}
                maxLength={300}
              />
              <div className="mt-1 text-xs text-gray-500 text-right">{(form.description || '').length}/300</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Hours</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[15,30,45,90].map(v=> (
                    <button
                      key={v}
                      type="button"
                      onClick={()=>{
                        const hours = String(v);
                        const credits = creditsFromHours(v);
                        setForm(f=>({...f, hours, credits: credits ?? ''}));
                      }}
                      className={`px-2 py-1 rounded-full border text-xs transition-colors ${String(form.hours)===String(v) ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      {v}h
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Credits</label>
                <div className="relative">
                  <Input type="number" min="0" value={form.credits} readOnly className="h-10 bg-gray-50 cursor-not-allowed" />
                </div>
                <p className="mt-1 text-xs text-gray-500">Credits are derived from hours<br />(every 15h = 1 credit).</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={()=>setEditOpen(false)}>Cancel</Button>
              <Button onClick={submitEdit} disabled={updating}>{updating? <Loader2 className="h-4 w-4 animate-spin"/>:'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={(o)=>{ if(!o){ setConfirmDeleteOpen(false); setCourseToDelete(null);} }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center px-2 pb-2">
            <p className="text-sm text-gray-700">Do you want to delete this {courseToDelete?.course_name}?</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-center">
              <Button
                className="bg-red-600 hover:bg-red-700 text-white sm:min-w-[120px]"
                onClick={()=> deleteCourse(courseToDelete.id)}
                disabled={deletingId===courseToDelete?.id}
              >{deletingId===courseToDelete?.id ? 'Deleting…' : 'OK'}</Button>
              <Button
                variant="outline"
                onClick={()=>{ setConfirmDeleteOpen(false); setCourseToDelete(null); }}
                className="sm:min-w-[120px]"
                disabled={deletingId===courseToDelete?.id}
              >Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}