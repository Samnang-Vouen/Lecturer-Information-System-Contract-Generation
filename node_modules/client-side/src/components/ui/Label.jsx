import React from 'react';

const Label = React.forwardRef(function Label({ className = '', ...props }, ref) {
  return <label ref={ref} className={`text-sm font-medium text-gray-700 ${className}`} {...props} />;
});

export default Label;
