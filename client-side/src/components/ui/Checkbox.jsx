import React, { forwardRef } from 'react';

// Simple checkbox that forwards ref and supports common props.
// onCheckedChange(boolean) mirrors shadcn/ui's API for easier reuse.
export const Checkbox = forwardRef(function Checkbox(
  { id, checked, onCheckedChange, className = '', onClick, ...rest },
  ref
) {
  const base =
    'h-4 w-4 rounded border border-gray-300 bg-white text-white cursor-pointer appearance-none checked:bg-blue-600 checked:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors';

  return (
    <input
      id={id}
      ref={ref}
      type="checkbox"
      className={`${base} ${className}`}
      checked={!!checked}
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
      onClick={onClick}
      {...rest}
    />
  );
});

export default Checkbox;
