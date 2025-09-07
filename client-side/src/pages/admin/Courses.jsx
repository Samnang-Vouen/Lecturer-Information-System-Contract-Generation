import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Plus, Edit, Trash2, GraduationCap, Loader2, Search, Filter, BookOpen, Clock, Award, MoreVertical, Eye } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import axiosInstance from '../../lib/axios';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table.jsx';
import Badge from '../../components/ui/Badge.jsx';

export default function CoursesPage(){
  const { authUser: _authUser } = useAuthStore();
  const [courses,setCourses] = useState([]);
  const [search,setSearch] = useState('');
  const [loading,setLoading] = useState(false);
  const [creating,setCreating] = useState(false);
  const [updating,setUpdating] = useState(false);
  const [deletingId,setDeletingId] = useState(null);
  const [addOpen,setAddOpen] = useState(false);
  const [editOpen,setEditOpen] = useState(false);
  const [viewOpen,setViewOpen] = useState(false);
  const [confirmDeleteOpen,setConfirmDeleteOpen] = useState(false);
  const [courseToDelete,setCourseToDelete] = useState(null);
  const [selectedCourse,setSelectedCourse] = useState(null);
  const [viewType,setViewType] = useState('table'); // 'table' or 'grid'
  const emptyCourse = { course_code:'', course_name:'', description:'', hours:'', credits:'' };
  const [form,setForm] = useState(emptyCourse);
  const [editId,setEditId] = useState(null);
  const [page,setPage] = useState(1);
  const [hasMore,setHasMore] = useState(true);
  const limit = 10;
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);

  const load = useCallback(async (reset=false)=>{
    if(loadingRef.current) return;
    loadingRef.current = true;
    if(reset){ setPage(1); setHasMore(true); }
    if(reset) setCourses([]);
    setLoading(true);
    try {
      const targetPage = reset? 1 : page;
      const res = await axiosInstance.get(`/courses?page=${targetPage}&limit=${limit}`);
      const payload = res.data;
      if(Array.isArray(payload)){
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
  },[page,limit]);

  useEffect(()=>{ load(true); },[]);

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

  useEffect(()=>{ if(page>1) load(); },[page]);

  const openAdd=()=>{ setForm(emptyCourse); setAddOpen(true); };
  const submitAdd=async()=>{
    if(!form.course_code || !form.course_name){ toast.error('Course code and name are required'); return; }
    setCreating(true);
    try {
      const payload = { ...form, hours: form.hours? Number(form.hours): null, credits: form.credits? Number(form.credits): null };
      const res = await axiosInstance.post('/courses', payload);
      setCourses(prev=>[res.data.course, ...prev]);
      toast.success('Course added successfully');
      setAddOpen(false);
      setForm(emptyCourse);
    } catch(e){
      toast.error(e?.response?.data?.message || 'Failed to add course');
    } finally { setCreating(false); }
  };

  const openEdit=(c)=>{ 
    setEditId(c.id); 
    setForm({ 
      course_code:c.course_code, 
      course_name:c.course_name, 
      description:c.description||'', 
      hours:c.hours||'', 
      credits:c.credits||'' 
    }); 
    setEditOpen(true); 
  };

  const openView=(c)=>{ setSelectedCourse(c); setViewOpen(true); };

  const submitEdit=async()=>{
    if(!editId) return; 
    if(!form.course_code || !form.course_name){ toast.error('Course code and name are required'); return; }
    setUpdating(true);
    try {
      const payload = { ...form, hours: form.hours? Number(form.hours): null, credits: form.credits? Number(form.credits): null };
      const res = await axiosInstance.put(`/courses/${editId}`, payload);
      setCourses(prev=> prev.map(c=> c.id===editId ? res.data.course : c));
      toast.success('Course updated successfully');
      setEditOpen(false); setEditId(null);
    } catch(e){
      toast.error(e?.response?.data?.message || 'Failed to update course');
    } finally { setUpdating(false); }
  };

  const deleteCourse=async(id)=>{
    setDeletingId(id);
    try {
      await axiosInstance.delete(`/courses/${id}`);
      setCourses(prev=> prev.filter(c=> c.id!==id));
      toast.success('Course deleted successfully');
      setConfirmDeleteOpen(false); setCourseToDelete(null);
    } catch(e){ toast.error(e?.response?.data?.message || 'Failed to delete course'); }
    finally { setDeletingId(null); }
  };

  const filteredCourses = useMemo(()=>{
    if(!search.trim()) return courses;
    const term = search.toLowerCase();
    return courses.filter(c =>
      c.course_code?.toLowerCase().includes(term) ||
      c.course_name?.toLowerCase().includes(term) ||
      c.description?.toLowerCase().includes(term)
    );
  },[courses,search]);

  const CourseCard = ({ course, index }) => (
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
            <button
              onClick={() => openView(course)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="View details"
            >
              <Eye className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={() => openEdit(course)}
              className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
              title="Edit course"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setCourseToDelete(course); setConfirmDeleteOpen(true); }}
              className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
              title="Delete course"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">{course.course_name}</h4>
        
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {course.description || 'No description available'}
        </p>
        
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
      <div className="p-6 lg:p-8 space-y-8">
        {/* Enhanced Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Course Management</h1>
                  <p className="text-gray-600 mt-1">Manage your department's academic curriculum</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewType('table')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewType === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewType('grid')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewType === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Grid
                </button>
              </div>
              <Button 
                onClick={openAdd} 
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Course
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
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
                  <p className="text-3xl font-bold text-purple-900">
                    {courses.reduce((sum, course) => sum + (course.credits || 0), 0)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Search and Filter */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  value={search} 
                  onChange={e=>setSearch(e.target.value)} 
                  placeholder="Search courses by code, name, or description..." 
                  className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              {search && (
                <Button 
                  variant="outline" 
                  onClick={() => setSearch('')}
                  className="shrink-0"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Content Area */}
        {viewType === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course, index) => (
              <CourseCard key={course.id} course={course} index={index} />
            ))}
            {!filteredCourses.length && !loading && (
              <div className="col-span-full">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {search ? 'No matching courses' : 'No courses yet'}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {search ? 'Try adjusting your search terms' : 'Start by adding your first course'}
                    </p>
                    {!search && (
                      <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" /> Add First Course
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
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
                    {filteredCourses.map((course, index) => (
                      <TableRow key={course.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <TableCell className="font-semibold text-blue-900 py-4">{course.course_code}</TableCell>
                        <TableCell className="text-gray-900 py-4">{course.course_name}</TableCell>
                        <TableCell className="max-w-xs text-gray-600 py-4">
                          {course.description ? (
                            <span className="line-clamp-2">{course.description}</span>
                          ) : (
                            <span className="italic text-gray-400">No description</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            {course.hours || '-'}h
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
                            {course.credits || '-'} credits
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openView(course)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View details"
                            >
                              <Eye className="h-4 w-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => openEdit(course)}
                              className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                              title="Edit course"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setCourseToDelete(course); setConfirmDeleteOpen(true); }}
                              disabled={deletingId === course.id}
                              className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete course"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filteredCourses.length && !loading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-lg font-semibold text-gray-900 mb-2">
                            {search ? 'No matching courses' : 'No courses yet'}
                          </p>
                          <p className="text-gray-600">
                            {search ? 'Try adjusting your search terms' : 'Start by adding your first course'}
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading Sentinel */}
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

        {/* Enhanced Dialogs */}
        {/* View Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Course Details
              </DialogTitle>
            </DialogHeader>
            {selectedCourse && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-blue-900 mb-1">{selectedCourse.course_code}</h3>
                  <p className="text-blue-700 font-medium">{selectedCourse.course_name}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-amber-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-900">Duration</span>
                    </div>
                    <p className="text-lg font-bold text-amber-800">{selectedCourse.hours || '-'} hours</p>
                  </div>
                  
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm font-medium text-indigo-900">Credits</span>
                    </div>
                    <p className="text-lg font-bold text-indigo-800">{selectedCourse.credits || '-'} credits</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                  <p className="text-gray-600 leading-relaxed">
                    {selectedCourse.description || 'No description available for this course.'}
                  </p>
                </div>
                
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
                  <Button onClick={() => { setViewOpen(false); openEdit(selectedCourse); }}>
                    <Edit className="h-4 w-4 mr-2" /> Edit Course
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Enhanced Add Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Add New Course
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Code *</label>
                  <Input 
                    value={form.course_code} 
                    onChange={e=>setForm(f=>({...f, course_code:e.target.value}))} 
                    placeholder="e.g., CS101"
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Name *</label>
                  <Input 
                    value={form.course_name} 
                    onChange={e=>setForm(f=>({...f, course_name:e.target.value}))} 
                    placeholder="e.g., Programming Fundamentals"
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <Textarea 
                  value={form.description} 
                  onChange={e=>setForm(f=>({...f, description:e.target.value}))} 
                  placeholder="Provide a brief description of the course content and objectives..."
                  rows={4}
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hours</label>
                  <Input 
                    type="number" 
                    min="0" 
                    value={form.hours} 
                    onChange={e=>setForm(f=>({...f, hours:e.target.value}))}
                    placeholder="e.g., 3"
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Credits</label>
                  <Input 
                    type="number" 
                    min="0" 
                    value={form.credits} 
                    onChange={e=>setForm(f=>({...f, credits:e.target.value}))}
                    placeholder="e.g., 3"
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={()=>setAddOpen(false)}>Cancel</Button>
                <Button 
                  onClick={submitAdd} 
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/>Adding...</> : 'Add Course'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Enhanced Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Edit Course
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Code *</label>
                  <Input 
                    value={form.course_code} 
                    onChange={e=>setForm(f=>({...f, course_code:e.target.value}))}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Name *</label>
                  <Input 
                    value={form.course_name} 
                    onChange={e=>setForm(f=>({...f, course_name:e.target.value}))}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <Textarea 
                  value={form.description} 
                  onChange={e=>setForm(f=>({...f, description:e.target.value}))}
                  rows={4}
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hours</label>
                  <Input 
                    type="number" 
                    min="0" 
                    value={form.hours} 
                    onChange={e=>setForm(f=>({...f, hours:e.target.value}))}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Credits</label>
                  <Input 
                    type="number" 
                    min="0" 
                    value={form.credits} 
                    onChange={e=>setForm(f=>({...f, credits:e.target.value}))}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={()=>setEditOpen(false)}>Cancel</Button>
                <Button 
                  onClick={submitEdit} 
                  disabled={updating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {updating ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/>Saving...</> : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Enhanced Delete Dialog */}
        <Dialog open={confirmDeleteOpen} onOpenChange={(o)=>{ if(!o){ setConfirmDeleteOpen(false); setCourseToDelete(null);} }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Delete Course
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  Are you sure you want to delete <strong>{courseToDelete?.course_name}</strong>? 
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={()=>{ setConfirmDeleteOpen(false); setCourseToDelete(null); }}
                  disabled={deletingId===courseToDelete?.id}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={()=> deleteCourse(courseToDelete.id)}
                  disabled={deletingId===courseToDelete?.id}
                >
                  {deletingId===courseToDelete?.id ? 
                    <><Loader2 className="h-4 w-4 animate-spin mr-2"/>Deleting...</> : 
                    <>Delete Course</>
                  }
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}