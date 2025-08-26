import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/Dialog";
import Input from "./ui/Input";
import Label from "./ui/Label";
import Select, { SelectItem } from "./ui/Select";
import Button from "./ui/Button";

export default function ClassFormDialog({ open, onOpenChange, onSubmit, classData, setClassData, isEdit }) {
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
        <form className="space-y-6" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
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
              <Input id="academic_year" className="focus:ring-blue-500" placeholder="e.g., 2025-2026" value={classData.academic_year} onChange={e => setClassData({ ...classData, academic_year: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="total_class" className="text-sm font-medium text-gray-700">Total Groups</Label>
              <Input
                id="total_class"
                type="number"
                min="1"
                placeholder="e.g., 3"
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
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
            {isEdit ? "Update Class" : "Add Class"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
