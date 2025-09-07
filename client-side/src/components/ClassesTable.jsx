import React from "react";
import { School, GraduationCap } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/Table";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { Edit, Trash2, Users, BookOpen } from "lucide-react";

export default function ClassesTable({ classes, onEdit, onDelete, onAssignCourses, loading, courseCatalog = [], title, description }) {
  const codeToName = React.useMemo(() => {
    const map = new Map();
    // Support both legacy array and new paginated shape { data, ... }
    const list = Array.isArray(courseCatalog) ? courseCatalog : (Array.isArray(courseCatalog.data) ? courseCatalog.data : []);
    list.forEach(c => { if (c?.course_code) map.set(c.course_code, c.course_name || c.course_code); });
    return map;
  }, [courseCatalog]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
        </div>
        <p className="text-gray-600 font-medium">Loading classes...</p>
        <p className="text-gray-400 text-sm mt-1">Please wait while we fetch your data</p>
      </div>
    );
  }

  if (!classes.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-6">
          <GraduationCap className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Classes Available</h3>
        <p className="text-gray-500 mb-4 max-w-md mx-auto">
          Get started by creating your first class to begin managing course assignments and academic schedules.
        </p>
        <div className="inline-flex items-center text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
          <BookOpen className="h-3 w-3 mr-1" />
          Use the "Add Class" button to create your first class
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {(title || description) && (
        <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 rounded-lg bg-white shadow-sm border border-gray-100">
              <School className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-gray-600 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-200">
              <TableHead className="text-gray-900 font-semibold tracking-wide py-4 px-6 text-left">
                Class Information
              </TableHead>
              <TableHead className="text-gray-900 font-semibold tracking-wide py-4 px-6 text-center">
                Academic Details
              </TableHead>
              <TableHead className="text-gray-900 font-semibold tracking-wide py-4 px-6 text-center">
                Groups
              </TableHead>
              <TableHead className="text-gray-900 font-semibold tracking-wide py-4 px-6">
                Course Assignments
              </TableHead>
              <TableHead className="text-gray-900 font-semibold tracking-wide py-4 px-6 text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((classItem, index) => (
              <TableRow 
                key={classItem.id} 
                className={`
                  hover:bg-blue-50/30 transition-all duration-200 border-b border-gray-50
                  ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                `}
              >
                <TableCell className="py-5 px-6">
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900 text-base">
                      {classItem.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      Class ID: {classItem.id}
                    </div>
                  </div>
                </TableCell>
                
                <TableCell className="py-5 px-6 text-center">
                  <div className="space-y-2">
                    <div className="flex flex-col items-center gap-1">
                      <Badge variant="secondary" className="text-xs font-medium px-2.5 py-1">
                        {classItem.term}
                      </Badge>
                      <span className="text-sm font-medium text-gray-700">
                        Year {classItem.year_level}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                      AY {classItem.academic_year}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-5 px-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 border border-blue-100">
                    <span className="text-lg font-bold text-blue-700">
                      {classItem.total_class}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="py-5 px-6">
                  <div className="space-y-2">
                    {(classItem.courses || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-w-sm">
                        {(classItem.courses || []).map((courseCode, idx) => {
                          const label = codeToName.get(courseCode) || courseCode;
                          return (
                            <Badge 
                              key={idx} 
                              variant="course" 
                              className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 font-medium"
                            >
                              {label}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <BookOpen className="h-4 w-4" />
                        <span className="italic">No courses assigned</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {(classItem.courses || []).length} course{(classItem.courses || []).length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-5 px-6">
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-200 hover:bg-blue-600 hover:text-blue-400 text-blue-700 bg-blue-50/50 hover:border-blue-600 transition-all duration-200 font-medium"
                      onClick={() => onAssignCourses(classItem)}
                      title="Assign Courses"
                    >
                      <Users className="h-4 w-4" />
                      <span className="hidden lg:inline ml-2 ">Assign</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-200 hover:bg-gray-700 hover:text-white text-gray-600 hover:border-gray-700 transition-all duration-200"
                      onClick={() => onEdit(classItem)}
                      title="Edit Class"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-200"
                      onClick={() => onDelete(classItem.id)}
                      title="Delete Class"
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