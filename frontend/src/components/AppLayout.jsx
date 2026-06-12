import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, Landmark, HandCoins, ChevronRight,
  FileBarChart, Shield, UserCog, LogOut, Menu, X, Settings
} from 'lucide-react';

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Admin sees everything. Agent sees a limited, employee-focused sidebar.
  const links = isAdmin
    ? [
        { section: 'Overview', items: [
          { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        ]},
        { section: 'Management', items: [
          { to: '/customers', icon: Users, label: 'Customers' },
          { to: '/loans', icon: Landmark, label: 'Loans' },
          { to: '/loans/create', icon: ChevronRight, label: 'Create Loan' },
        ]},
        { section: 'Operations', items: [
          { to: '/collections', icon: HandCoins, label: 'Collections' },
          { to: '/reports', icon: FileBarChart, label: 'Reports' },
        ]},
        { section: 'Admin', items: [
          { to: '/users', icon: UserCog, label: 'User Management' },
          { to: '/audit', icon: Shield, label: 'Audit Logs' },
          { to: '/settings', icon: Settings, label: 'Settings & Backup' },
        ]},
      ]
    : [
        { section: 'My Work', items: [
          { to: '/', icon: LayoutDashboard, label: 'Home' },
          { to: '/collections', icon: HandCoins, label: 'Collections' },
        ]},
        { section: 'Data', items: [
          { to: '/customers', icon: Users, label: 'Customers' },
          { to: '/loans', icon: Landmark, label: 'Loans' },
          { to: '/loans/create', icon: ChevronRight, label: 'Create Loan' },
        ]},
      ];

  // Bottom nav items (most used pages)
  const bottomNavItems = isAdmin
    ? [
        { to: '/', icon: LayoutDashboard, label: 'Home' },
        { to: '/customers', icon: Users, label: 'Customers' },
        { to: '/loans', icon: Landmark, label: 'Loans' },
        { to: '/collections', icon: HandCoins, label: 'Collect' },
        { to: '/settings', icon: Settings, label: 'Settings' },
      ]
    : [
        { to: '/', icon: LayoutDashboard, label: 'Home' },
        { to: '/collections', icon: HandCoins, label: 'Collect' },
        { to: '/customers', icon: Users, label: 'Customers' },
        { to: '/loans', icon: Landmark, label: 'Loans' },
        { to: '/settings', icon: Settings, label: 'Settings' },
      ];

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  const handleLogout = async () => { await logout(); };

  // Get current page label for header title
  const currentPage = [
    { to: '/', label: 'Dashboard' },
    { to: '/customers', label: 'Customers' },
    { to: '/loans/create', label: 'Create Loan' },
    { to: '/loans', label: 'Loans' },
    { to: '/collections', label: 'Collections' },
    { to: '/reports', label: 'Reports' },
    { to: '/users', label: 'Users' },
    { to: '/audit', label: 'Audit Logs' },
  ].find(l => l.to === '/' ? location.pathname === '/' : location.pathname.startsWith(l.to))?.label || 'LoanFlow Pro';

  return (
    <>
      {/* Mobile header */}
      <div className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="mobile-header-brand">
          <div className="mobile-header-logo">LF</div>
          <span className="mobile-header-title">{currentPage}</span>
        </div>
        <div className="mobile-header-user">
          <div className="sidebar-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Sidebar overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">LF</div>
            <div>
              <h1>LoanFlow Pro</h1>
              <span>{isAdmin ? 'Admin Panel' : 'Agent Panel'}</span>
            </div>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(false)}
              style={{ marginLeft: 'auto', display: sidebarOpen ? 'flex' : 'none' }}>
              <X size={20} />
            </button>
          </div>

          <nav className="sidebar-nav">
            {links.map((section) => (
              <div key={section.section} className="sidebar-section">
                <div className="sidebar-section-title">{section.section}</div>
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon size={20} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
            <button className="mobile-menu-btn" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation (mobile only) */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
