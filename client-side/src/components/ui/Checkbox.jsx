import React from 'react';

export function Checkbox({ id, checked, onCheckedChange }) {
  return (
    <input
      id={id}
      type="checkbox"
      className="h-4 w-4 rounded border border-gray-300 bg-white text-white cursor-pointer appearance-none checked:bg-blue-600 checked:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
      checked={checked}
      onChange={() => onCheckedChange(!checked)}
    />
  );
}
export default Checkbox;
