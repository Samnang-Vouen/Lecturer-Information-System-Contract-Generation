import React, { forwardRef } from 'react';

const Input = forwardRef(function Input({ className = '', style, type, ...props }, ref) {
  const mergedStyle = {
    WebkitBoxShadow: '0 0 0 1000px white inset',
    color: '#000',
    ...(style || {})
  };
  // Force light (white) native date picker popup
  if (type === 'date') {
    mergedStyle.colorScheme = 'light';
  }
  return (
    <input
      ref={ref}
      type={type}
      className={`w-full px-3 text-black bg-white border border-gray-300 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
      style={mergedStyle}
      {...props}
    />
  );
});

export default Input;
