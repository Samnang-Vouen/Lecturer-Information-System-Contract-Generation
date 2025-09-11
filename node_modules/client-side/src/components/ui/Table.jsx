import React from 'react';

export function Table({ children, className = '' }) {
  return <table className={`w-full caption-bottom text-sm ${className}`}>{children}</table>;
}
export function TableHeader({ children, className = '' }) {
  return <thead className={className}>{children}</thead>;
}
export function TableBody({ children, className = '' }) {
  return <tbody className={className}>{children}</tbody>;
}
export function TableRow({ children, className = '' }) {
  return <tr className={`border-b last:border-b-0 hover:bg-gray-50 ${className}`}>{children}</tr>;
}
export function TableHead({ children, className = '' }) {
  return <th className={`h-10 px-3 text-left align-middle font-medium text-gray-600 ${className}`}>{children}</th>;
}
export function TableCell({ children, className = '' }) {
  return <td className={`p-3 align-middle ${className}`}>{children}</td>;
}

export default { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
