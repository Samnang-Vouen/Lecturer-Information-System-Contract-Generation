import React from 'react';

export default function Input({ className = '', ...props }) {
  return (
    <input 
      className={`w-full px-3 text-black bg-white border border-gray-300 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`} 
      style={{
        WebkitBoxShadow: '0 0 0 1000px white inset',
        color: '#000'
      }}
      {...props} 
    />
  );
}
