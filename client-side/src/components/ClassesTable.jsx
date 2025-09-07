import React from "react";
import { School } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { Edit, Trash2 } from "lucide-react";

export default function ClassesTable({ classes, onEdit, onDelete, onAssignCourses, loading, courseCatalog = [], title, description }) {
  const codeToName = React.useMemo(()=> {
    const map = new Map();
    // Support both legacy array and new paginated shape { data, ... }
    const list = Array.isArray(courseCatalog) ? courseCatalog : (Array.isArray(courseCatalog.data) ? courseCatalog.data : []);
    list.forEach(c=> { if(c?.course_code) map.set(c.course_code, c.course_name || c.course_code); });
    return map;
  }, [courseCatalog]);
  if (loading) {
    return (
      <div className="p-12 text-center border border-dashed rounded-lg bg-white/50">
        <div className="animate-pulse text-gray-500">Loading classes...</div>
      </div>
    );
  }
  if (!classes.length) {
    return (
      <div className="p-12 text-center border border-dashed rounded-lg bg-white/50">
        <p className="text-gray-500 mb-2 font-medium">No classes found</p>
        <p className="text-xs text-gray-400">Use the "Add Class" button to create your first class.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {(title || description) && (
        <div className="px-6 pt-5 pb-4 border-b border-gray-200 bg-white/60">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-blue-50 text-blue-600"><School className="h-5 w-5"/></div>
            <div>
              {title && <h2 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h2>}
              {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
            </div>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table className="min-w-full">
        <TableHeader>
          <TableRow className="bg-gray-50/80 *:whitespace-nowrap">
            <TableHead className="text-gray-800 text-sm font-semibold tracking-wide">Class Name</TableHead>
            <TableHead className="text-gray-800 text-sm font-semibold tracking-wide">Term</TableHead>
            <TableHead className="text-gray-800 text-sm font-semibold tracking-wide">Year Level</TableHead>
            <TableHead className="text-gray-800 text-sm font-semibold tracking-wide">Academic Year</TableHead>
            <TableHead className="text-gray-800 text-sm font-semibold tracking-wide">Total Groups</TableHead>
            <TableHead className="text-gray-800 text-sm font-semibold tracking-wide">Assigned Courses</TableHead>
            <TableHead className="text-gray-800 text-sm font-semibold tracking-wide">Total Hours and Credits</TableHead>
            <TableHead className="text-gray-800 text-sm font-semibold tracking-wide text-right pr-6">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.map((classItem) => (
            <TableRow key={classItem.id} className="hover:bg-blue-50/40 transition-colors">
              <TableCell className="font-medium text-gray-800">{classItem.name}</TableCell>
              <TableCell className="text-gray-700 text-sm">{classItem.term}</TableCell>
              <TableCell className="text-gray-700 text-sm">{classItem.year_level}</TableCell>
              <TableCell className="text-gray-700 text-sm">{classItem.academic_year}</TableCell>
              <TableCell className="text-gray-700 text-sm">{classItem.total_class}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1 max-w-xs">
                  {(classItem.courses || []).map((courseCode, idx) => {
                    const label = codeToName.get(courseCode) || courseCode;
                    return <Badge key={idx} variant="course" className="text-[10px] px-2 py-0.5">{label}</Badge>;
                  })}
                  {!classItem.courses.length && (
                    <span className="text-gray-400 text-xs italic">No courses assigned</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-xs text-gray-700">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 border-indigo-200"
                      title="Total hours across assigned courses"
                    >
                      {Number(classItem.total_hours || 0)} hrs
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200"
                      title="Total credits across assigned courses"
                    >
                      {Number(classItem.total_credits || 0)} credits
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 justify-end pr-0 sm:pr-2">
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-200 hover:bg-gray-800 hover:text-white text-gray-600"
                    onClick={() => onEdit(classItem)}
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-600 hover:text-white"
                    onClick={() => onDelete(classItem.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}
