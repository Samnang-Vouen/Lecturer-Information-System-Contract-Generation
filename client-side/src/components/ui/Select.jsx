import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Select({ children, value, onValueChange, placeholder }) {
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
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedValue ? 'text-gray-900' : 'text-gray-500'}>
                    {displayLabel}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {React.Children.map(children, (child) => React.cloneElement(child, { onSelect: handleSelect }))}
                </div>
            )}
        </div>
    );
}

export function SelectItem({ value, children, onSelect }) {
    return (
        <button
            type="button"
            className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
            onClick={() => onSelect(value)}
        >
            {children}
        </button>
    );
}
