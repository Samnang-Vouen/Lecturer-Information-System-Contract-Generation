import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/Dialog";
import Input from "./ui/Input";
import Label from "./ui/Label";
import Select, { SelectItem } from "./ui/Select";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import { BookOpen } from "lucide-react";

export default function ClassFormDialog({ open, onOpenChange, onSubmit, classData, setClassData, isEdit, onAssignCourses, selectedCourses = [], courseCatalog = [] }) {
  // Academic years: start from current year, next 4 (total 5), formatted YYYY-YYYY
  const academicYearOptions = React.useMemo(() => {
    const start = new Date().getFullYear();
    const count = 5; // current year + next 4 years
    return Array.from({ length: count }, (_, i) => `${start + i}-${start + i + 1}`);
  }, []);
  // Map course_code -> course_name for display
  const codeToName = React.useMemo(() => {
    const map = new Map();
    const list = Array.isArray(courseCatalog) ? courseCatalog : (Array.isArray(courseCatalog.data) ? courseCatalog.data : []);
    list.forEach(c => { if (c?.course_code) map.set(c.course_code, c.course_name || c.course_code); });
    return map;
  }, [courseCatalog]);

  // Validation: all fields must be filled; total_class must be a positive integer
  const isPositiveInt = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return false;
    if (!/^\d+$/.test(s)) return false;
    return parseInt(s, 10) > 0;
  };
  const allFilled = React.useMemo(() => {
    const baseOk = (
      String(classData?.name || '').trim() !== '' &&
      String(classData?.term || '').trim() !== '' &&
      String(classData?.year_level || '').trim() !== '' &&
      String(classData?.academic_year || '').trim() !== '' &&
      isPositiveInt(classData?.total_class)
    );
    // In Add mode (when onAssignCourses is provided and not editing), require at least one assigned course
    const coursesOk = isEdit || !onAssignCourses ? true : (Array.isArray(selectedCourses) && selectedCourses.length > 0);
    return baseOk && coursesOk;
  }, [classData, isEdit, onAssignCourses, selectedCourses]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-800 tracking-tight">
            {isEdit ? "Edit Class" : "Add New Class"}
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            {isEdit ? "Update class information and settings." : "Create a new academic class with term and year information."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-6"
          onSubmit={e => {
            e.preventDefault();
            if (!allFilled) return; // block submit if not complete
            onSubmit();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">Class Name</Label>
              <Input id="name" className="focus:ring-blue-500" placeholder="e.g., SE-Gen10" value={classData.name} onChange={e => setClassData({ ...classData, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="term" className="text-sm font-medium text-gray-700">Term</Label>
              <Select
                value={classData.term}
                onValueChange={value => setClassData({ ...classData, term: value })}
                placeholder="Select term"
              >
                <SelectItem value="Term 1">Term 1</SelectItem>
                <SelectItem value="Term 2">Term 2</SelectItem>
                <SelectItem value="Term 3">Term 3</SelectItem>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="year_level" className="text-sm font-medium text-gray-700">Year Level</Label>
              <Select
                value={classData.year_level}
                onValueChange={value => setClassData({ ...classData, year_level: value })}
                placeholder="Select year level"
              >
                <SelectItem value="Year 1">Year 1</SelectItem>
                <SelectItem value="Year 2">Year 2</SelectItem>
                <SelectItem value="Year 3">Year 3</SelectItem>
                <SelectItem value="Year 4">Year 4</SelectItem>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="academic_year" className="text-sm font-medium text-gray-700">Academic Year</Label>
              <Select
                value={classData.academic_year}
                onValueChange={(value) => setClassData({ ...classData, academic_year: value })}
                placeholder="Select academic year"
              >
                {academicYearOptions.map((ay) => (
                  <SelectItem key={ay} value={ay}>{ay}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="total_class" className="text-sm font-medium text-gray-700">Total Groups</Label>
              <Input
                id="total_class"
                type="number"
                min="1"
                placeholder="e.g., 3"
                className="flex-1 min-w-0"
                value={classData.total_class === null || classData.total_class === undefined ? "" : classData.total_class}
                onChange={e => {
                  const v = e.target.value;
                  if (v === "") return setClassData({ ...classData, total_class: "" });
                  if (/^\d+$/.test(v)) {
                    setClassData({ ...classData, total_class: v });
                  }
                }}
              />
            </div>
            {!isEdit && onAssignCourses && (
              <div className="space-y-1">
                <Label htmlFor="assign_courses" className="text-sm font-medium text-gray-700">Assign Courses</Label>
                <Button
                  id="assign_courses"
                  type="button"
                  variant="outline"
                  className="h-10 w-full justify-center border-blue-200 hover:bg-blue-600 hover:text-white text-blue-700 bg-blue-50"
                  onClick={() => onAssignCourses(classData)}
                  title="Assign Courses"
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="ml-2 text-sm font-medium">Assign Courses</span>
                </Button>
                {/* Selected courses preview */}
                <div className="pt-2">
                  {Array.isArray(selectedCourses) && selectedCourses.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedCourses.map((code, idx) => (
                        <Badge key={`${code}-${idx}`} variant="course" className="text-[10px] px-2 py-0.5">
                          {codeToName.get(code) || code}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">No courses selected</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <Button
            type="submit"
            disabled={!allFilled}
            title={!allFilled ? 'Fill in all fields before submitting' : undefined}
            className={`w-full shadow-sm ${!allFilled ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {isEdit ? "Update Class" : "Add Class"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
