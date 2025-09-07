import React, { useEffect, useState, useRef, useCallback } from "react";
import { Plus, AlertCircle } from 'lucide-react';
import ClassesTable from "../../components/ClassesTable";
import ClassFormDialog from "../../components/ClassFormDialog";
import AssignCoursesDialog from "../../components/AssignCoursesDialog";
import axios from "../../lib/axios";
// UI primitives (custom implementations use default exports only)
import Button from "../../components/ui/Button";
import Label from "../../components/ui/Label";
import Select, { SelectItem } from "../../components/ui/Select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/Dialog";

const initialClassState = {
  name: "",
  term: "",
  year_level: "",
  academic_year: "",
  total_class: 1,
  courses: [], // Add courses to initial state
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
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false); // Add error dialog state
  const [classToDelete, setClassToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [newClass, setNewClass] = useState(initialClassState);
  const [editingClass, setEditingClass] = useState(null);
  const [assigningClass, setAssigningClass] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 10;
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);

  // Show error popup
  const showErrorPopup = (message) => {
    setError(message);
    setIsErrorDialogOpen(true);
  };

  const loadClasses = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (reset) { setPage(1); setHasMore(true); setClasses([]); }
    setLoading(true);
    try {
      const targetPage = reset ? 1 : page;
      const res = await axios.get(`/classes?page=${targetPage}&limit=${limit}`);
      const payload = res.data;
      if (Array.isArray(payload)) {
        // legacy non-paginated shape
        setClasses(payload);
        setHasMore(false);
      } else {
        setClasses(prev => reset ? payload.data : [...prev, ...payload.data]);
        setHasMore(payload.hasMore);
      }
      setError("");
    } catch {
      showErrorPopup("Failed to load classes. Please try again.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [page, limit]);

  // Fetch classes from API
  useEffect(() => {
    loadClasses(true);
  }, []);

  useEffect(() => {
    if (page > 1) loadClasses();
  }, [page]);

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

  // Validate academic year
  const validateAcademicYear = (academicYear) => {
    // Check format YYYY-YYYY
    const academicYearPattern = /^\d{4}-\d{4}$/;
    if (!academicYearPattern.test(academicYear)) {
      return "Academic year must be in format YYYY-YYYY (e.g., 2024-2025)";
    }

    // Validate that academic year makes sense
    const [startYear, endYear] = academicYear.split('-').map(Number);
    if (endYear !== startYear + 1) {
      return "Academic year end year must be exactly one year after start year";
    }

    // Check if year is reasonable (not too far in past or future)
    const currentYear = new Date().getFullYear();
    if (startYear < currentYear - 10 || startYear > currentYear + 10) {
      return "Academic year must be within a reasonable range";
    }

    return null; // No error
  };

  // Add class with course assignment
  const handleAddClass = () => {
    // Validate academic year
    const academicYearError = validateAcademicYear(newClass.academic_year);
    if (academicYearError) {
      showErrorPopup(academicYearError);
      return;
    }

    // Validate required fields
    if (!newClass.name.trim()) {
      showErrorPopup("Class name is required");
      return;
    }

    if (!newClass.term.trim()) {
      showErrorPopup("Term is required");
      return;
    }

    if (!newClass.year_level.trim()) {
      showErrorPopup("Year level is required");
      return;
    }

    setLoading(true);
    const payload = { ...newClass };
    // Normalize total_class (string -> int, default 1)
    const parsedTotal = parseInt(payload.total_class, 10);
    payload.total_class = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : 1;
    
    // Include selected courses in the payload
    payload.courses = selectedCourses;

    axios.post("/classes", payload)
      .then(res => {
        setClasses(prev => [...prev, res.data]);
        setIsAddDialogOpen(false);
        setNewClass(initialClassState);
        setSelectedCourses([]);
        setError("");
      })
      .catch((err) => {
        const errorMessage = err.response?.data?.message || "Failed to add class. Please try again.";
        showErrorPopup(errorMessage);
      })
      .finally(() => setLoading(false));
  };

  // Edit class
  const handleEditClass = (classItem) => {
    setEditingClass(classItem);
    setSelectedCourses(Array.isArray(classItem.courses) ? classItem.courses : []);
    setIsEditDialogOpen(true);
  };

  // Update class
  const handleUpdateClass = () => {
    // Validate academic year
    const academicYearError = validateAcademicYear(editingClass.academic_year);
    if (academicYearError) {
      showErrorPopup(academicYearError);
      return;
    }

    // Validate required fields
    if (!editingClass.name.trim()) {
      showErrorPopup("Class name is required");
      return;
    }

    if (!editingClass.term.trim()) {
      showErrorPopup("Term is required");
      return;
    }

    if (!editingClass.year_level.trim()) {
      showErrorPopup("Year level is required");
      return;
    }

    setLoading(true);
    const payload = { ...editingClass };
    const parsedTotal = parseInt(payload.total_class, 10);
    payload.total_class = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : 1;
    
    // Include selected courses in the payload
    payload.courses = selectedCourses;

    axios.put(`/classes/${editingClass.id}`, payload)
      .then(res => {
        setClasses(prev => prev.map(c => c.id === editingClass.id ? res.data : c));
        setIsEditDialogOpen(false);
        setEditingClass(null);
        setSelectedCourses([]);
        setError("");
      })
      .catch((err) => {
        const errorMessage = err.response?.data?.message || "Failed to update class. Please try again.";
        showErrorPopup(errorMessage);
      })
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
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to delete class. Please try again.";
      showErrorPopup(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  // Assign courses
  const handleAssignCourses = (classItem) => {
    setAssigningClass(classItem);
    setSelectedCourses(Array.isArray(classItem.courses) ? classItem.courses : []);
    axios.get('/courses')
      .then(res => {
        const payload = res.data;
        const list = Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []);
        setAvailableCourses(list);
      })
      .catch((err) => { 
        console.debug('Failed to load courses list', err); 
        showErrorPopup("Failed to load courses list");
      })
      .finally(() => setIsCourseAssignDialogOpen(true));
  };

  // Save course assignment
  const handleSaveCourseAssignment = () => {
    setLoading(true);
    axios.put(`/classes/${assigningClass.id}/courses`, { courses: selectedCourses })
      .then(() => {
        setClasses(prev => prev.map(c => c.id === assigningClass.id ? { ...c, courses: selectedCourses } : c));
        setIsCourseAssignDialogOpen(false);
        setAssigningClass(null);
        setSelectedCourses([]);
        setError("");
      })
      .catch((err) => {
        const errorMessage = err.response?.data?.message || "Failed to assign courses. Please try again.";
        showErrorPopup(errorMessage);
      })
      .finally(() => setLoading(false));
  };

  // Toggle course selection
  const handleCourseToggle = (courseCode) => {
    setSelectedCourses(prev => prev.includes(courseCode) ? prev.filter(c => c !== courseCode) : [...prev, courseCode]);
  };

  // Academic year filter with validation
  const getUniqueAcademicYears = () => {
    const years = [...new Set(classes.map(c => c.academic_year))].filter(year => {
      // Only include valid academic years
      const academicYearPattern = /^\d{4}-\d{4}$/;
      return academicYearPattern.test(year);
    });
    return years.sort();
  };

  const getFilteredClasses = () => {
    if (selectedAcademicYear === "all") return classes;
    return classes.filter(c => c.academic_year === selectedAcademicYear);
  };
  const filteredClasses = getFilteredClasses();

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Classes Management</h1>
          <p className="text-gray-600">Manage academic classes and assign courses</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add Class
        </Button>
      </div>

      {/* Filter Controls */}
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

      {/* Error Message */}
      {error && !isErrorDialogOpen && <div className="text-sm mb-2 text-red-600">{error}</div>}

      {/* Classes Table */}
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

      {/* Error Dialog */}
      <Dialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Error
            </DialogTitle>
          </DialogHeader>
          <div className="px-2 pb-2 space-y-4">
            <p className="text-sm text-gray-700">{error}</p>
            <div className="flex justify-center">
              <Button
                onClick={() => setIsErrorDialogOpen(false)}
                className="bg-red-600 hover:bg-red-700 text-white min-w-[100px]"
              >
                OK
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      {isConfirmDeleteOpen && classToDelete && (
        <Dialog open={isConfirmDeleteOpen} onOpenChange={(open) => { setIsConfirmDeleteOpen(open); if (!open) setClassToDelete(null); }}>
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
                  onClick={() => { setIsConfirmDeleteOpen(false); setClassToDelete(null); }}
                  className="sm:min-w-[120px]"
                  disabled={deleting}
                >Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Infinite Scroll Sentinel */}
      <div ref={sentinelRef} className="h-10 flex items-center justify-center text-xs text-gray-500">
        {loading && hasMore && <span>Loading more...</span>}
        {!hasMore && !loading && <span className="text-gray-400">No more classes</span>}
      </div>

      {/* Add Class Dialog */}
      <ClassFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleAddClass}
        classData={newClass}
        setClassData={setNewClass}
        isEdit={false}
        availableCourses={availableCourses}
        selectedCourses={selectedCourses}
        onCourseToggle={handleCourseToggle}
      />

      {/* Edit Class Dialog */}
      <ClassFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={handleUpdateClass}
        classData={editingClass || initialClassState}
        setClassData={setEditingClass}
        isEdit={true}
        availableCourses={availableCourses}
        selectedCourses={selectedCourses}
        onCourseToggle={handleCourseToggle}
      />

      {/* Assign Courses Dialog */}
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