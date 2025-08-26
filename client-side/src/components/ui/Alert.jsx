import React from 'react';

export function Alert({ children, className = '' }) {
  return <div className={`w-full rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 ${className}`}>{children}</div>;
}

export function AlertDescription({ children, className='' }) {
  return <div className={`mt-1 text-blue-800 ${className}`}>{children}</div>;
}

export default Alert;
