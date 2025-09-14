import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

// Added className hooks to allow sizing and minor style overrides from callers
export default function Select({ children, value, onValueChange, placeholder, disabled = false, className = '', buttonClassName = '', dropdownClassName = '', unstyled = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedValue, setSelectedValue] = useState(value || '');
    const containerRef = useRef(null);

    useEffect(() => {
        setSelectedValue(value || '');
    }, [value]);

    // Determine the label to display for the current selected value
    const childArray = React.Children.toArray(children);
    const matchedChild = childArray.find(child => child.props && child.props.value === selectedValue);
    const displayLabel = matchedChild ? matchedChild.props.children : (placeholder || 'Select');

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleSelect = (val) => {
        setSelectedValue(val);
        onValueChange(val);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                className={`relative w-full px-3 pr-8 py-2 ${unstyled ? '' : 'border border-gray-300 rounded-lg bg-white'} text-left focus:outline-none flex items-center ${disabled ? 'text-gray-500 ' + (unstyled ? 'cursor-not-allowed opacity-60' : 'bg-gray-50 cursor-not-allowed opacity-60') : (unstyled ? '' : 'focus:ring-2 focus:ring-blue-500')} ${buttonClassName}`}
                onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
                aria-disabled={disabled || undefined}
            >
                <span className={(selectedValue ? 'text-gray-900' : 'text-gray-500') + ' block leading-snug whitespace-normal break-words text-sm'}>
                    {displayLabel}
                </span>
                <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${disabled ? 'text-gray-400' : 'text-gray-500'}`} />
            </button>
            {isOpen && !disabled && (
                <div className={`absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto ${dropdownClassName}`}>
                    {React.Children.map(children, (child) => React.cloneElement(child, { onSelect: handleSelect }))}
                </div>
            )}
        </div>
    );
}

export function SelectItem({ value, children, onSelect, className = '' }) {
    return (
        <button
            type="button"
            className={`w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${className}`}
            onClick={() => onSelect(value)}
        >
            {children}
        </button>
    );
}
