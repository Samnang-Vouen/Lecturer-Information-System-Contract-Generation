import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import Button from "./ui/Button.jsx";
import { 
    LayoutDashboard, 
    Users, 
    FileText, 
    LogOut, 
    Building2, 
    UserCheck,
    PanelRightClose,
    PanelRightOpen
} from "lucide-react";

/**
 * @typedef {'superadmin' | 'admin' | 'lecturer' | 'management'} UserRole
 * 
 * @typedef {Object} NavItem
 * @property {string} title - The title of the navigation item
 * @property {string} href - The href link of the navigation item
 * @property {React.ComponentType<{className?: string}>} icon - The icon component
 * @property {UserRole[]} roles - The roles that can see this item
 */

/**
 * @type {NavItem[]}
 */
const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard", // placeholder; will be replaced dynamically per role
    icon: LayoutDashboard,
    roles: ["superadmin", "admin", "lecturer", "management"],
  },
  {
    title: "My Profile",
    href: "/admin/profile",
    icon: UserCheck,
    roles: ["admin"],
  },
  {
    title: "Recruitment",
    href: "/admin/recruitment",
    icon: Users,
    roles: ["admin"],
  },
  {
    title: "User Management",
    href: "/superadmin/users",
    icon: Users,
    roles: ["superadmin"],
  },
  {
    title: "My Profile",
    href: "/profile",
    icon: UserCheck,
    roles: ["lecturer"],
  },
  {
    title: "My Contracts",
    href: "/my-contracts",
    icon: FileText,
    roles: ["lecturer"],
  },
];

/**
 * Sidebar component that displays navigation based on user role
 * 
 * @param {Object} props - Component props
 * @param {Object} [props.user] - User object (can be passed from server-side)
 * @param {string} props.user.name - User name
 * @param {UserRole} props.user.role - User role
 * @param {Function} [props.onLogout] - Logout function
 * @returns {React.ReactElement|null}
 */
export function Sidebar({ user: userProp, onLogout }) {
  const location = useLocation();
  const { user: storeUser, logout: storeLogout } = useAuthStore();
  // Initialize from localStorage immediately to avoid post-mount state flip animation on route changes
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === 'true'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebarCollapsed', String(next)); } catch {}
      return next;
    });
  };

  // Use provided user from props (SSR) or fallback to client-side context
  const user = userProp || storeUser;
  const logout = onLogout || storeLogout;
  
  // Don't render sidebar if no user
  if (!user) return null;

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter((item) => 
    item.roles.includes(user.role)
  );

  // Helper function to determine if a link is active
  const isActive = (href, title) => {
    if (title === 'Dashboard') return location.pathname === href; // exact match only
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };
  
  // Helper for classnames concatenation
  const cn = (...classes) => classes.filter(Boolean).join(' ');

  return (
    <div className={`flex h-full ${collapsed ? 'w-20' : 'w-64'} flex-col bg-white border-r border-gray-200 transition-[width] duration-300 ease-in-out`}> 
      <div className={`flex h-16 items-center ${collapsed ? 'justify-center px-0' : 'px-4'} border-b border-gray-200 transition-all duration-300 gap-2`}> 
        {!collapsed && (
          <>
            <Building2 className="h-8 w-8 text-blue-600 flex-shrink-0 transition-opacity duration-300" />
            <span className="text-lg font-semibold text-gray-900 transition-opacity duration-300">LCMS</span>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              className="ml-auto text-gray-500 hover:text-gray-700 p-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <PanelRightClose className="w-5 h-5" />
            </button>
          </>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className="text-gray-500 hover:text-gray-700 p-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <PanelRightOpen className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 px-4 py-6 overflow-y-auto transition-all duration-300">
        {/* User info: hidden entirely when collapsed */}
        {!collapsed && (
          <p className='text-gray-600 mb-6'>
            Welcome back,<br/>
            <span className='font-semibold text-gray-900'>
              {user.fullName || user.name || (user.email ? user.email.split('@')[0] : '')}
            </span><br/>
            <span className='capitalize text-blue-600'>
              admin{user.department ? `, ${user.department}` : ''}
            </span>
          </p>
        )}
        <nav className="space-y-2">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            let href = item.href;
            if (item.title === 'Dashboard') {
              const roleRoot = {
                superadmin: '/superadmin',
                admin: '/admin',
                lecturer: '/lecturer',
                management: '/management'
              }[user.role] || '/dashboard';
              href = roleRoot;
            }
            const active = isActive(href, item.title);
            return (
              <Link key={item.title} to={href} className="block group">
                <Button
                  variant={active ? "primary" : "outline"}
                  className={cn(
                    "w-full transition-colors flex items-center gap-3 px-4 py-2 text-sm font-medium overflow-hidden",
                    collapsed ? 'justify-center px-3 gap-0' : 'justify-start',
                    active ? "bg-blue-600 text-white hover:bg-blue-600" : "text-gray-700 hover:bg-gray-100"
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  <span className="w-5 flex justify-center">
                    <Icon className={cn("h-4 w-4", active ? "text-white" : "text-gray-600 group-hover:text-gray-900")} />
                  </span>
                  {!collapsed && (
                    <span className={cn(active ? "text-white" : "text-gray-700 group-hover:text-gray-900", "transition-opacity duration-200")}>{item.title}</span>
                  )}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={`p-4 border-t border-gray-200 transition-all duration-300 ${collapsed ? 'px-2' : ''}`}>
        <Button
          variant="outline"
          className={cn(
            "w-full text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center", 
            collapsed ? 'justify-center px-2' : 'justify-start'
          )}
          onClick={logout}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-3">Sign Out</span>}
        </Button>
      </div>
    </div>
  );
}
