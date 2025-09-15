import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Plus, Edit, Trash2, GraduationCap, Loader2, Search, BookOpen, Clock, Award, Eye, ChevronDown, ArrowUpDown } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import axiosInstance from '../../lib/axios';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card.jsx';
import Select, { SelectItem } from '../../components/ui/Select.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table.jsx';

export default function CoursesPage() {
  const { authUser: _authUser } = useAuthStore();

  // Data
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 10;
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);

  // UI state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('code'); // 'code' | 'name'
  const [hoursFilter, setHoursFilter] = useState(''); // '', '15', '30', '45', '90' or CSV
  const [viewType, setViewType] = useState('table'); // 'table' | 'grid'

  // CRUD state
  const emptyCourse = { course_code: '', course_name: '', description: '', hours: '', credits: '' };
  const [form, setForm] = useState(emptyCourse);
  const [formErrors, setFormErrors] = useState({ course_code: '', course_name: '' });
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editId, setEditId] = useState(null);

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseToDelete, setCourseToDelete] = useState(null);

  // Helpers
  const creditsFromHours = (hours) => {
    const n = typeof hours === 'string' ? parseInt(hours, 10) : hours;
    if (!Number.isFinite(n) || n <= 0) return null;
    return n % 15 === 0 ? n / 15 : null;
  };

  const load = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (reset) { setPage(1); setHasMore(true); setCourses([]); }
    setLoading(true);
    try {
      const targetPage = reset ? 1 : page;
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', String(limit));
      if (sortBy) params.set('sortBy', sortBy);
      if (hoursFilter) params.set('hours', hoursFilter);

      const res = await axiosInstance.get(`/courses?${params.toString()}`);
      const payload = res.data;
      if (Array.isArray(payload)) {
        // API returned a full array
        setCourses(payload);
        setHasMore(false);
      } else if (payload && Array.isArray(payload.data)) {
        setCourses(prev => reset ? payload.data : [...prev, ...payload.data]);
        setHasMore(!!payload.hasMore);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [page, limit, sortBy, hoursFilter]);

  useEffect(() => { load(true); }, []);
  useEffect(() => { setPage(1); load(true); }, [sortBy, hoursFilter]);
  useEffect(() => { if (page > 1) load(); }, [page]);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      const first = entries[0];
      if (first.isIntersecting && hasMore && !loading) {
        setPage(p => p + 1);
      }
    }, { threshold: 1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  // Derived list
  const filteredCourses = useMemo(() => {
    const base = courses.filter(c => {
      if (!search.trim()) return true;
      const term = search.trim().toLowerCase();
      return (
        (c.course_code || '').toLowerCase().includes(term) ||
        (c.course_name || '').toLowerCase().includes(term) ||
        (c.description || '').toLowerCase().includes(term)
      );
    });
    const sorted = [...base].sort((a, b) => {
      if (sortBy === 'name') return String(a.course_name || '').localeCompare(String(b.course_name || ''));
      return String(a.course_code || '').localeCompare(String(b.course_code || ''));
    });
    if (!hoursFilter) return sorted;
    const allowed = hoursFilter.split(',').map(s => s.trim());
    return sorted.filter(c => allowed.includes(String(c.hours ?? '')));
  }, [courses, search, sortBy, hoursFilter]);

  // Handlers
  const openAdd = () => { setForm(emptyCourse); setFormErrors({ course_code: '', course_name: '' }); setAddOpen(true); };
  const openEdit = (c) => {
    setEditId(c.id);
    setFormErrors({ course_code: '', course_name: '' });
    const hrs = c.hours ?? '';
    const derived = hrs !== '' ? creditsFromHours(hrs) : null;
    setForm({
      course_code: c.course_code,
      course_name: c.course_name,
      description: c.description || '',
      hours: hrs,
      credits: derived ?? (c.credits || '')
    });
    setEditOpen(true);
  };
  const openView = (c) => { setSelectedCourse(c); setViewOpen(true); };

  const submitAdd = async () => {
    if (!form.course_code || !form.course_name) { toast.error('Course code and name are required'); return; }
    setCreating(true);
    try {
      const hoursVal = form.hours ? Number(form.hours) : null;
      const derivedCredits = hoursVal ? creditsFromHours(hoursVal) : null;
      const payload = { ...form, hours: hoursVal, credits: derivedCredits ?? null };
      const res = await axiosInstance.post('/courses', payload);
      setCourses(prev => [res.data.course, ...prev]);
      toast.success('Course added successfully');
      setAddOpen(false);
      setForm(emptyCourse);
      setFormErrors({ course_code: '', course_name: '' });
    } catch (e) {
      const msg = e?.response?.data?.message;
      if (e?.response?.status === 409 && typeof msg === 'string') {
        if (msg.toLowerCase().includes('code')) setFormErrors(err => ({ ...err, course_code: msg }));
        if (msg.toLowerCase().includes('name')) setFormErrors(err => ({ ...err, course_name: msg }));
      }
      toast.error(msg || 'Failed to add course');
    } finally { setCreating(false); }
  };

  const submitEdit = async () => {
    if (!editId) return;
    if (!form.course_code || !form.course_name) { toast.error('Course code and name are required'); return; }
    setUpdating(true);
    try {
      const hoursVal = form.hours ? Number(form.hours) : null;
      const derivedCredits = hoursVal ? creditsFromHours(hoursVal) : null;
      const payload = { ...form, hours: hoursVal, credits: derivedCredits ?? null };
      const res = await axiosInstance.put(`/courses/${editId}`, payload);
      setCourses(prev => prev.map(c => c.id === editId ? res.data.course : c));
      toast.success('Course updated successfully');
      setEditOpen(false); setEditId(null);
    } catch (e) {
      const msg = e?.response?.data?.message;
      if (e?.response?.status === 409 && typeof msg === 'string') {
        if (msg.toLowerCase().includes('code')) setFormErrors(err => ({ ...err, course_code: msg }));
        if (msg.toLowerCase().includes('name')) setFormErrors(err => ({ ...err, course_name: msg }));
      }
      toast.error(msg || 'Failed to update course');
    } finally { setUpdating(false); }
  };

  const deleteCourse = async (id) => {
    setDeletingId(id);
    try {
      await axiosInstance.delete(`/courses/${id}`);
      setCourses(prev => prev.filter(c => c.id !== id));
      toast.success('Course deleted successfully');
      setConfirmDeleteOpen(false); setCourseToDelete(null);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to delete course');
    } finally { setDeletingId(null); }
  };

  // UI blocks
  const CourseCard = ({ course }) => (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 group">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
                {course.course_code}
              </h3>
              <p className="text-sm text-gray-500">Course Code</p>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => openView(course)} className="p-2 hover:bg-gray-100 rounded-lg" title="View details">
              <Eye className="h-4 w-4 text-gray-600" />
            </button>
            <button onClick={() => openEdit(course)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" title="Edit course">
              <Edit className="h-4 w-4" />
            </button>
            <button onClick={() => { setCourseToDelete(course); setConfirmDeleteOpen(true); }} className="p-2 hover:bg-red-50 text-red-600 rounded-lg" title="Delete course">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">{course.course_name}</h4>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{course.description || 'No description available'}</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-gray-700">{course.hours || '-'}h</span>
          </div>
          <div className="flex items-center gap-1">
            <Award className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-medium text-gray-700">{course.credits || '-'} credits</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="p-4 md:p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-3 mb-2 min-w-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Course Management</h1>
                <p className="text-gray-600 mt-1">Manage your department's academic curriculum</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
                <button onClick={() => setViewType('table')} className={`flex-1 sm:flex-none px-3 py-2 rounded-md text-sm font-medium ${viewType === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Table</button>
                <button onClick={() => setViewType('grid')} className={`flex-1 sm:flex-none px-3 py-2 rounded-md text-sm font-medium ${viewType === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Grid</button>
              </div>
              <Button onClick={openAdd} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl">
                <Plus className="h-4 w-4 mr-2" /> Add Course
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center w-full mt-6">
            <div className="w-full sm:w-56">
              <span className="sr-only">Sort by</span>
              <div className="relative">
                <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <Select
                  value={sortBy}
                  onValueChange={setSortBy}
                  className="w-full"
                  buttonClassName="h-10 pl-9 pr-8 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <SelectItem value="code">Sort: Code (A–Z)</SelectItem>
                  <SelectItem value="name">Sort: Name (A–Z)</SelectItem>
                </Select>
              </div>
            </div>
            <div className="w-full sm:w-56">
              <span className="sr-only">Hours</span>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <Select
                  value={hoursFilter}
                  onValueChange={setHoursFilter}
                  className="w-full"
                  buttonClassName="h-10 pl-9 pr-8 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <SelectItem value="">All Hours</SelectItem>
                  <SelectItem value="15">15 hours</SelectItem>
                  <SelectItem value="30">30 hours</SelectItem>
                  <SelectItem value="45">45 hours</SelectItem>
                  <SelectItem value="90">90 hours</SelectItem>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Courses</p>
                  <p className="text-3xl font-bold text-blue-900">{courses.length}</p>
                </div>
                <BookOpen className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Active Courses</p>
                  <p className="text-3xl font-bold text-green-900">{filteredCourses.length}</p>
                </div>
                <Award className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Total Credits</p>
                  <p className="text-3xl font-bold text-purple-900">{courses.reduce((sum, c) => sum + (c.credits || 0), 0)}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search bar */}
          <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses by code, name, or description..." className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
              </div>
              {search && (
                <Button variant="outline" onClick={() => setSearch('')} className="shrink-0 w-full sm:w-auto">Clear</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {viewType === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
            {!filteredCourses.length && !loading && (
              <div className="col-span-full">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{search ? 'No matching courses' : 'No courses yet'}</h3>
                    <p className="text-gray-600 mb-4">{search ? 'Try adjusting your search terms' : 'Start by adding your first course'}</p>
                    {!search && (<Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-2" /> Add First Course</Button>)}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80 border-b border-gray-200">
                      <TableHead className="font-semibold text-gray-900">Course Code</TableHead>
                      <TableHead className="font-semibold text-gray-900">Course Name</TableHead>
                      <TableHead className="font-semibold text-gray-900">Description</TableHead>
                      <TableHead className="font-semibold text-gray-900 text-center">Hours</TableHead>
                      <TableHead className="font-semibold text-gray-900 text-center">Credits</TableHead>
                      <TableHead className="font-semibold text-gray-900 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCourses.map(course => (
                      <TableRow key={course.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <TableCell className="font-semibold text-blue-900 py-4">{course.course_code}</TableCell>
                        <TableCell className="text-gray-900 py-4">{course.course_name}</TableCell>
                        <TableCell className="max-w-xs text-gray-600 py-4">
                          {course.description ? <span className="line-clamp-2">{course.description}</span> : <span className="italic text-gray-400">No description</span>}
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">{course.hours || '-'}h</span>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">{course.credits || '-'} credits</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openView(course)} className="p-2 hover:bg-gray-100 rounded-lg" title="View details"><Eye className="h-4 w-4 text-gray-600" /></button>
                            <button onClick={() => openEdit(course)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" title="Edit course"><Edit className="h-4 w-4" /></button>
                            <button onClick={() => { setCourseToDelete(course); setConfirmDeleteOpen(true); }} disabled={deletingId === course.id} className="p-2 hover:bg-red-50 text-red-600 rounded-lg disabled:opacity-50" title="Delete course"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filteredCourses.length && !loading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-lg font-semibold text-gray-900 mb-2">{search ? 'No matching courses' : 'No courses yet'}</p>
                          <p className="text-gray-600">{search ? 'Try adjusting your search terms' : 'Start by adding your first course'}</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading sentinel */}
        <div ref={sentinelRef} className="h-10 flex items-center justify-center">
          {loading && hasMore && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading more courses...
            </div>
          )}
          {!hasMore && courses.length > 0 && (
            <p className="text-sm text-gray-400">All courses loaded</p>
          )}
        </div>

        {/* View Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-600" /> Course Details</DialogTitle>
            </DialogHeader>
            {selectedCourse && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-blue-900 mb-1">{selectedCourse.course_code}</h3>
                  <p className="text-blue-700 font-medium">{selectedCourse.course_name}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-amber-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-amber-600" /><span className="text-sm font-medium text-amber-900">Duration</span></div>
                    <p className="text-lg font-bold text-amber-800">{selectedCourse.hours || '-'} hours</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2"><Award className="h-4 w-4 text-indigo-600" /><span className="text-sm font-medium text-indigo-900">Credits</span></div>
                    <p className="text-lg font-bold text-indigo-800">{selectedCourse.credits || '-'} credits</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                  <p className="text-gray-600 leading-relaxed">{selectedCourse.description || 'No description available for this course.'}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-end pt-4 border-t"><Button variant="outline" onClick={() => setViewOpen(false)} className="w-full sm:w-auto">Close</Button><Button onClick={() => { setViewOpen(false); openEdit(selectedCourse); }} className="w-full sm:w-auto"><Edit className="h-4 w-4 mr-2" /> Edit Course</Button></div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-blue-600" /> Add New Course</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Code <span className="text-red-500" aria-hidden="true">*</span></label>
                  <Input value={form.course_code} onChange={e => {
                    const raw = e.target.value || '';
                    const sanitized = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    setForm(f => ({ ...f, course_code: sanitized }));
                    setFormErrors(err => ({ ...err, course_code: '' }));
                  }} placeholder="e.g., CS101" className="border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                  {formErrors.course_code && <p className="mt-1 text-xs text-red-600">{formErrors.course_code}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Name <span className="text-red-500" aria-hidden="true">*</span></label>
                  <Input value={form.course_name} onChange={e => { setForm(f => ({ ...f, course_name: e.target.value })); setFormErrors(err => ({ ...err, course_name: '' })); }} placeholder="e.g., Programming Fundamentals" className="border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                  {formErrors.course_name && <p className="mt-1 text-xs text-red-600">{formErrors.course_name}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Provide a brief description of the course content and objectives..." rows={4} maxLength={300} className="border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                <div className="mt-1 text-xs text-gray-500 text-right">{(form.description || '').length}/300</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hours <span className="text-red-500" aria-hidden="true">*</span></label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[15, 30, 45, 60].map(v => (
                      <button key={v} type="button" onClick={() => {
                        const hours = String(v);
                        const credits = creditsFromHours(v);
                        setForm(f => ({ ...f, hours, credits: credits ?? '' }));
                      }} className={`px-2 py-1 rounded-full border text-xs transition-colors ${String(form.hours) === String(v) ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
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
                  <p className="mt-1 text-xs text-gray-500">Credits are derived from hours (every 15h = 1 credit).</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <Button variant="outline" onClick={() => setAddOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                <Button onClick={submitAdd} disabled={creating} className="w-full sm:w-auto">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-blue-600" /> Edit Course</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Code <span className="text-red-500" aria-hidden="true">*</span></label>
                  <Input value={form.course_code} onChange={e => {
                    const raw = e.target.value || '';
                    const sanitized = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    setForm(f => ({ ...f, course_code: sanitized }));
                    setFormErrors(err => ({ ...err, course_code: '' }));
                  }} className="border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Name <span className="text-red-500" aria-hidden="true">*</span></label>
                  <Input value={form.course_name} onChange={e => { setForm(f => ({ ...f, course_name: e.target.value })); setFormErrors(err => ({ ...err, course_name: '' })); }} className="border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} maxLength={300} className="border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                <div className="mt-1 text-xs text-gray-500 text-right">{(form.description || '').length}/300</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Hours</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[15, 30, 45, 90].map(v => (
                      <button key={v} type="button" onClick={() => {
                        const hours = String(v);
                        const credits = creditsFromHours(v);
                        setForm(f => ({ ...f, hours, credits: credits ?? '' }));
                      }} className={`px-2 py-1 rounded-full border text-xs transition-colors ${String(form.hours) === String(v) ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
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
                  <p className="mt-1 text-xs text-gray-500">Credits are derived from hours (every 15h = 1 credit).</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                <Button onClick={submitEdit} disabled={updating} className="w-full sm:w-auto">{updating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={confirmDeleteOpen} onOpenChange={(o) => { if (!o) { setConfirmDeleteOpen(false); setCourseToDelete(null); } }}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" /> Delete Course</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">Are you sure you want to delete <strong>{courseToDelete?.course_name}</strong>? This action cannot be undone.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <Button variant="outline" onClick={() => { setConfirmDeleteOpen(false); setCourseToDelete(null); }} disabled={deletingId === courseToDelete?.id} className="w-full sm:w-auto">Cancel</Button>
                <Button className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteCourse(courseToDelete.id)} disabled={deletingId === courseToDelete?.id}>
                  {deletingId === courseToDelete?.id ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : <>Delete Course</>}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}