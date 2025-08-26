import React from 'react';

export default function Button({ children, onClick, type = 'button', variant = 'primary', size = 'md', className = '', disabled = false, ...props }) {
    const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
    const variants = {
        primary: 'border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
        outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500',
        destructive: 'border border-transparent bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
    };
    const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
    return (
        <button type={type} className={`${base} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`} onClick={onClick} disabled={disabled} {...props}>
        {children}
        </button>
    );
}
