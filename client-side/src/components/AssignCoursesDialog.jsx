import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/Dialog";
import { Checkbox } from "./ui/Checkbox";
import Label from "./ui/Label";
import Button from "./ui/Button";
import Input from "./ui/Input";

// Assign courses from server-side course objects. selectedCourses stores course_code values.
export default function AssignCoursesDialog({ open, onOpenChange, availableCourses = [], selectedCourses = [], onToggleCourse, onSave, onCancel, className }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return availableCourses;
    const q = query.toLowerCase();
    return availableCourses.filter(c =>
      c.course_code?.toLowerCase().includes(q) ||
      c.course_name?.toLowerCase().includes(q)
    );
  }, [availableCourses, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-800 tracking-tight">Assign Courses</DialogTitle>
          <DialogDescription className="text-gray-500">
            Select courses to assign to <span className="font-medium text-gray-700">{className}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Input placeholder="Search courses" value={query} onChange={e=>setQuery(e.target.value)} className="flex-1" />
            {query && (
              <button onClick={()=>setQuery("")} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
            )}
          </div>
          <div className="border rounded-lg p-4 bg-gray-50/70">
            <div className="grid grid-cols-1 gap-3 max-h-72 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No courses found.</p>
              ) : (
                filtered.map(course => {
                  const code = course.course_code; // still used internally
                  const id = `course-${course.id}`;
                  const checked = selectedCourses.includes(code);
                  return (
                    <div key={course.id} className="flex items-start space-x-3 rounded-md bg-white border border-gray-200 px-3 py-2 shadow-sm hover:shadow transition">
                      <Checkbox id={id} checked={checked} onCheckedChange={() => onToggleCourse(code)} />
                      <Label htmlFor={id} className="text-sm leading-tight text-gray-700 cursor-pointer w-full">
                        <span className="font-semibold text-gray-900">{course.course_name}</span>
                        <span className="block mt-0.5 text-xs text-gray-400">{course.hours ?? '-'}h / {course.credits ?? '-'} credits</span>
                      </Label>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-gray-600">
              {selectedCourses.length} course{selectedCourses.length !== 1 && "s"} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} className="border-gray-300 text-gray-700 hover:bg-gray-100">Cancel</Button>
              <Button onClick={onSave} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">Save Assignment</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
