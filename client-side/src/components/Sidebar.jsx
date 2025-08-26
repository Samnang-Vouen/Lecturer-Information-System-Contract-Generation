import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import Button from "./ui/Button.jsx";
import { 
  LayoutDashboard, 
  Users, 
  UserPlus,
  FileText, 
  LogOut, 
  Building2, 
  UserCheck,
  PanelRightClose,
  PanelRightOpen,
  BookOpen,
  School
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
    title: "Courses Creation",
    href: "/admin/courses",
    icon: BookOpen,
    roles: ["admin"],
  },
  {
    title: "Classes Management",
    href: "/admin/classes",
    icon: School,
    roles: ["admin"],
  },
  {
    title: "Recruitment",
    href: "/admin/recruitment",
    icon: UserPlus,
    roles: ["admin"],
  },
  {
    title: "Lecturer Management",
    href: "/admin/lecturers",
    icon: Users,
    roles: ["admin"],
  },
  {
    title: "Course Mapping",
    href: "/admin/course-mapping",
    icon: BookOpen,
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
    href: "/lecturer/profile",
    icon: UserCheck,
    roles: ["lecturer"],
  },
  {
    title: "My Contracts",
  href: "/lecturer/my-contracts",
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
 * @param {boolean} [props.mobileOpen] - If true, show mobile overlay
 * @param {Function} [props.onClose] - Close handler for mobile overlay
 * @returns {React.ReactElement|null}
 */
export function Sidebar({ user: userProp, onLogout, mobileOpen = false, onClose = () => {} }) {
  const location = useLocation();
  const { user: storeUser, logout: storeLogout } = useAuthStore();
  // Initialize from localStorage immediately to avoid post-mount state flip animation on route changes
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === 'true'; } catch { /* ignore read errors (e.g., SSR) */ return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebarCollapsed', String(next)); } catch { /* ignore write errors */ }
      return next;
    });
  };

  // Use provided user from props (SSR) or fallback to client-side context
  const user = userProp || storeUser;
  const logout = onLogout || storeLogout;
  // Close on escape when mobile open (hook must be declared unconditionally)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && mobileOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onClose]);

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

  // Format email prefix like "cs.department" -> "Cs Department" and append role if admin
  const formatUserDisplay = (u) => {
    if (!u?.email) return '';
    let base = u.email.split('@')[0].replace(/[._-]+/g, ' ');
    base = base
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    if (u.role === 'admin' && !/admin$/i.test(base)) {
      base += ' Admin';
    }
    return base;
  };

  // NOTE: duplicate escape handler removed earlier to satisfy React Hooks rule

  // Desktop persistent sidebar (hidden on small screens)
  const desktopSidebar = (
    <div className={`hidden md:flex h-full ${collapsed ? 'w-20' : 'w-64'} flex-col bg-white border-r border-gray-200 transition-[width] duration-300 ease-in-out`}>
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
              {formatUserDisplay(user)}
            </span><br/>
            <span className='capitalize text-blue-600'>
              {user.department ? ` ${user.department}` : ''}
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
                    <span className={cn(
                      active ? "text-white" : "text-gray-700 group-hover:text-gray-900",
                      "transition-opacity duration-200 flex-1 text-left whitespace-nowrap"
                    )}>{item.title}</span>
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

  // Mobile overlay sidebar (visible when mobileOpen is true)
  const mobileSidebar = (
    <>
      {/* Backdrop */}
      <div className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${mobileOpen ? 'opacity-100 block' : 'opacity-0 pointer-events-none hidden'}`} onClick={onClose} aria-hidden />
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white border-r border-gray-200 transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`} role="dialog" aria-modal={mobileOpen}>
        <div className="flex h-16 items-center px-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <span className="text-lg font-semibold text-gray-900">LCMS</span>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">Close</button>
        </div>
        <div className="px-4 py-6 overflow-y-auto h-[calc(100vh-4rem)]">
          <p className='text-gray-600 mb-6'>
            Welcome back,<br/>
            <span className='font-semibold text-gray-900'>
              {formatUserDisplay(user)}
            </span><br/>
            <span className='capitalize text-blue-600'>
              {user.department ? ` ${user.department}` : ''}
            </span>
          </p>
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
                <Link key={item.title} to={href} className="block" onClick={onClose}>
                  <Button
                    variant={active ? "primary" : "outline"}
                    className={cn(
                      "w-full transition-colors flex items-center gap-3 px-4 py-2 text-sm font-medium overflow-hidden justify-start",
                      active ? "bg-blue-600 text-white hover:bg-blue-600" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <span className="w-5 flex justify-center">
                      <Icon className={cn("h-4 w-4", active ? "text-white" : "text-gray-600 group-hover:text-gray-900")} />
                    </span>
                    <span className={cn(
                      active ? "text-white" : "text-gray-700 group-hover:text-gray-900",
                      "transition-opacity duration-200 flex-1 text-left whitespace-nowrap"
                    )}>{item.title}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-gray-200">
          <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center" onClick={() => { onClose(); logout(); }}>
            <LogOut className="h-4 w-4" />
            <span className="ml-3">Sign Out</span>
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {desktopSidebar}
      {mobileSidebar}
    </>
  );
}

// Course Mapping page link already added earlier; ensure route exists in router configuration.
