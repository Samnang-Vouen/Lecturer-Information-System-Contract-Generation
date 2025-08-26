import React, { useEffect } from 'react';

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      {children}
    </div>
  );
}
export function DialogContent({ children, className = '' }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') { /* could call onOpenChange(false) if passed */ } };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);
  return (
    <div className={`relative z-50 w-full max-w-lg rounded-lg bg-white p-6 shadow-lg ${className}`}>{children}</div>
  );
}
export function DialogHeader({ children, className = '' }) { return <div className={`mb-4 space-y-1 ${className}`}>{children}</div>; }
export function DialogTitle({ children, className = '' }) { return <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h2>; }
export function DialogDescription({ children, className = '' }) { return <p className={`text-sm text-gray-500 ${className}`}>{children}</p>; }
export function DialogTrigger({ asChild, children, onClick }) { return asChild ? React.cloneElement(children, { onClick }) : <button onClick={onClick}>{children}</button>; }

export default { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger };
