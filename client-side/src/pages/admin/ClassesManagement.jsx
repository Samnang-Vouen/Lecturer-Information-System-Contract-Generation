import React, { useEffect, useState, useRef, useCallback } from "react";
import { Plus } from 'lucide-react';
import ClassesTable from "../../components/ClassesTable";
import ClassFormDialog from "../../components/ClassFormDialog";
import AssignCoursesDialog from "../../components/AssignCoursesDialog";
import axios from "../../lib/axios";
// UI primitives (custom implementations use default exports only)
import Button from "../../components/ui/Button";
import Label from "../../components/ui/Label";
import Select, { SelectItem } from "../../components/ui/Select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/Dialog";
// Courses fetched from server-side endpoint
// Stored in local state for assignment dialog


const initialClassState = {
  name: "",
  term: "",
  year_level: "",
  academic_year: "",
  total_class: 1,
};

export default function ClassesManagement() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("all");

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCourseAssignDialogOpen, setIsCourseAssignDialogOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [newClass, setNewClass] = useState(initialClassState);
  const [editingClass, setEditingClass] = useState(null);
  const [assigningClass, setAssigningClass] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);

  const [page,setPage] = useState(1);
  const [hasMore,setHasMore] = useState(true);
  const limit = 10;
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);

  const loadClasses = useCallback(async (reset=false)=>{
    if(loadingRef.current) return;
    loadingRef.current = true;
    if(reset){ setPage(1); setHasMore(true); setClasses([]); }
    setLoading(true);
    try {
      const targetPage = reset? 1 : page;
      const res = await axios.get(`/classes?page=${targetPage}&limit=${limit}`);
      const payload = res.data;
      if(Array.isArray(payload)) {
        // legacy non-paginated shape
        setClasses(payload);
        setHasMore(false);
      } else {
        setClasses(prev => reset ? payload.data : [...prev, ...payload.data]);
        setHasMore(payload.hasMore);
      }
      setError("");
    } catch {
      setError("Failed to load classes.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  },[page,limit]);

  // Fetch classes from API
  useEffect(() => {
    loadClasses(true);
  },[]);
  useEffect(() => {
    if(page>1) loadClasses();
  },[page]);
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

  // Fetch course catalog
  useEffect(() => {
    axios.get('/courses')
      .then(res => {
        const payload = res.data;
        const list = Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []);
        setAvailableCourses(list);
      })
      .catch(() => console.warn('Failed to load courses list'));
  }, []);

  // Add class
  const handleAddClass = () => {
    setLoading(true);
  const payload = { ...newClass };
  // Normalize total_class (string -> int, default 1)
  const parsedTotal = parseInt(payload.total_class, 10);
  payload.total_class = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : 1;
  // Include any selected courses chosen during add flow
  axios.post("/classes", { ...payload, courses: selectedCourses })
      .then(res => {
        setClasses(prev => [...prev, res.data]);
        setIsAddDialogOpen(false);
        setNewClass(initialClassState);
        setSelectedCourses([]);
        setError("");
      })
      .catch(() => setError("Failed to add class."))
      .finally(() => setLoading(false));
  };

  // Edit class
  const handleEditClass = (classItem) => {
    setEditingClass(classItem);
    setIsEditDialogOpen(true);
  };

  // Update class
  const handleUpdateClass = () => {
    setLoading(true);
  const payload = { ...editingClass };
  const parsedTotal = parseInt(payload.total_class, 10);
  payload.total_class = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : 1;
  axios.put(`/classes/${editingClass.id}`, payload)
      .then(res => {
        setClasses(prev => prev.map(c => c.id === editingClass.id ? res.data : c));
        setIsEditDialogOpen(false);
        setEditingClass(null);
        setError("");
      })
      .catch(() => setError("Failed to update class."))
      .finally(() => setLoading(false));
  };

  // Open confirm delete
  const handleDeleteClass = (classOrId) => {
    const cls = typeof classOrId === 'object' && classOrId !== null
      ? classOrId
      : classes.find(c => String(c.id) === String(classOrId));
    if (!cls) return;
    setClassToDelete(cls);
    setIsConfirmDeleteOpen(true);
  };

  // Perform delete after confirmation
  const performDeleteClass = async () => {
    if (!classToDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`/classes/${classToDelete.id}`);
      setClasses(prev => prev.filter(c => c.id !== classToDelete.id));
      setError("");
      setIsConfirmDeleteOpen(false);
      setClassToDelete(null);
    } catch (e) {
      setError("Failed to delete class.");
    } finally {
      setDeleting(false);
    }
  };

  // Assign courses
  const handleAssignCourses = (classItem) => {
    // If classItem has no id, treat as new-class assignment
    const isNew = !classItem || !classItem.id;
    const target = isNew
      ? { id: null, name: newClass?.name || 'New Class', courses: Array.isArray(selectedCourses) ? selectedCourses : [] }
      : classItem;
    setAssigningClass(target);
    setSelectedCourses(Array.isArray(target.courses) ? target.courses : []);
    axios.get('/courses')
      .then(res => {
        const payload = res.data;
        const list = Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []);
        setAvailableCourses(list);
      })
      .catch((err)=>{ console.debug('Failed to load courses list', err); })
      .finally(()=> setIsCourseAssignDialogOpen(true));
  };

  // Save course assignment
  const handleSaveCourseAssignment = () => {
    // If assigningClass has no id, we're in Add flow: just store selectedCourses and close dialog
    if (!assigningClass || !assigningClass.id) {
      setIsCourseAssignDialogOpen(false);
      setAssigningClass(null);
      return;
    }
    setLoading(true);
    axios.put(`/classes/${assigningClass.id}/courses`, { courses: selectedCourses })
      .then(() => {
        setClasses(prev => prev.map(c => c.id === assigningClass.id ? { ...c, courses: selectedCourses } : c));
        setIsCourseAssignDialogOpen(false);
        setAssigningClass(null);
        setSelectedCourses([]);
        setError("");
      })
      .catch(() => setError("Failed to assign courses."))
      .finally(() => setLoading(false));
  };

  // Toggle course selection
  const handleCourseToggle = (courseCode) => {
    setSelectedCourses(prev => prev.includes(courseCode) ? prev.filter(c => c !== courseCode) : [...prev, courseCode]);
  };

  // Academic year filter
  const getUniqueAcademicYears = () => {
    const years = [...new Set(classes.map(c => c.academic_year))];
    return years.sort();
  };
  const getFilteredClasses = () => {
    if (selectedAcademicYear === "all") return classes;
    return classes.filter(c => c.academic_year === selectedAcademicYear);
  };
  const filteredClasses = getFilteredClasses();

  return (
      <div className="p-8 space-y-6">
        {/* NOTE: Server-side pagination (limit=10) with infinite scroll for classes implemented. */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">Classes Management</h1>
            <p className="text-gray-600">Manage academic classes and assign courses</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4"/> Add Class
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-gray-700" htmlFor="academic-year-filter">Filter by Academic Year:</Label>
            <div className="w-48">
              <Select
                value={selectedAcademicYear}
                onValueChange={setSelectedAcademicYear}
                placeholder="Select academic year"
              >
                <SelectItem value="all">All Academic Years</SelectItem>
                {getUniqueAcademicYears().map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </Select>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-700">{filteredClasses.length}</span> of <span className="font-medium text-gray-700">{classes.length}</span> classes
          </div>
        </div>
        {error && <div className="text-sm mb-2 text-red-600">{error}</div>}
        <ClassesTable
          classes={filteredClasses}
          onEdit={handleEditClass}
          onDelete={handleDeleteClass}
          onAssignCourses={handleAssignCourses}
          loading={loading}
          courseCatalog={availableCourses}
          title="Academic Classes"
          description="Overview of all academic classes in your department"
        />
        {/* Confirm Delete Dialog */}
        {isConfirmDeleteOpen && classToDelete && (
          <Dialog open={isConfirmDeleteOpen} onOpenChange={(open)=> { setIsConfirmDeleteOpen(open); if (!open) setClassToDelete(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
              </DialogHeader>
              <div className="px-2 pb-2 text-center space-y-4">
                <p className="text-sm text-gray-700">
                  Do you want to delete this {classToDelete?.name || 'class'}?
                </p>
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-center">
                  <Button
                    onClick={performDeleteClass}
                    className="bg-red-600 hover:bg-red-700 text-white sm:min-w-[120px]"
                    disabled={deleting}
                  >{deleting ? 'Deleting…' : 'OK'}</Button>
                  <Button
                    variant="outline"
                    onClick={()=> { setIsConfirmDeleteOpen(false); setClassToDelete(null); }}
                    className="sm:min-w-[120px]"
                    disabled={deleting}
                  >Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        <div ref={sentinelRef} className="h-10 flex items-center justify-center text-xs text-gray-500">
          {loading && hasMore && <span>Loading more...</span>}
          {/* {!hasMore && !loading && <span className="text-gray-400">No more classes</span>} */}
        </div>
        <ClassFormDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onSubmit={handleAddClass}
          classData={newClass}
          setClassData={setNewClass}
          isEdit={false}
          onAssignCourses={() => handleAssignCourses(null)}
          selectedCourses={selectedCourses}
          courseCatalog={availableCourses}
        />
  <ClassFormDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSubmit={handleUpdateClass}
          classData={editingClass || initialClassState}
          setClassData={setEditingClass}
          isEdit={true}
        />
        <AssignCoursesDialog
          open={isCourseAssignDialogOpen}
          onOpenChange={setIsCourseAssignDialogOpen}
          availableCourses={availableCourses}
          selectedCourses={selectedCourses}
          onToggleCourse={handleCourseToggle}
          onSave={handleSaveCourseAssignment}
          onCancel={() => setIsCourseAssignDialogOpen(false)}
          className={assigningClass?.name}
        />
      </div>
  );
}
