import React from 'react';

export function Tabs({ children, value, onValueChange }) {
  return <div>{React.Children.map(children, (child) => React.cloneElement(child, { activeTab: value, onTabChange: onValueChange }))}</div>;
}

export function TabsList({ children, activeTab, onTabChange }) {
  return <div className="flex bg-gray-100 rounded-lg p-1 mb-6">{React.Children.map(children, (child) => React.cloneElement(child, { activeTab, onTabChange }))}</div>;
}

export function TabsTrigger({ value, children, activeTab, onTabChange }) {
  return (
    <button className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === value ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`} onClick={() => onTabChange(value)}>
      {children}
    </button>
  );
}

export function TabsContent({ value, children, activeTab }) {
  if (activeTab !== value) return null;
  return <div>{children}</div>;
}
