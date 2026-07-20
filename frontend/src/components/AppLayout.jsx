import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notificationsAPI } from '../services/api';
import {
  LayoutDashboard, Users, Landmark, HandCoins, ChevronRight,
  FileBarChart, Shield, UserCog, LogOut, Menu, X, Settings, Bell
} from 'lucide-react';

export default function AppLayout() {
  const { user, logout, isSuperAdmin, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [inAppNotifs, setInAppNotifs] = useState([]);
  const location = useLocation();

  useEffect(() => {
    notificationsAPI.getInApp().then(setInAppNotifs).catch(() => {});
  }, [location.pathname]);

  const handleMarkRead = (id) => {
    notificationsAPI.markRead(id).then(() => {
      setInAppNotifs(prev => prev.filter(n => n.id !== id));
    });
  };

  // Navigation links based on role
  const links = isSuperAdmin
    ? [
        { section: 'System', items: [
          { to: '/', icon: LayoutDashboard, label: 'Super Panel' },
        ]},
        { section: 'Config', items: [
          { to: '/settings', icon: Settings, label: 'Settings & Backup' },
        ]},
      ]
    : isAdmin
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
        ]},
        { section: 'Admin', items: [
          { to: '/notifications', icon: Bell, label: 'Notifications' },
          { to: '/users', icon: UserCog, label: 'User Management' },
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
  const bottomNavItems = isSuperAdmin
    ? [
        { to: '/', icon: LayoutDashboard, label: 'Home' },
        { to: '/settings', icon: Settings, label: 'Settings' },
      ]
    : isAdmin
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
    { to: '/', label: isSuperAdmin ? 'Super Admin Panel' : 'Dashboard' },
    { to: '/customers', label: 'Customers' },
    { to: '/loans/create', label: 'Create Loan' },
    { to: '/loans', label: 'Loans' },
    { to: '/collections', label: 'Collections' },
    { to: '/users', label: 'Users' },
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
        <div className="mobile-header-user" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '16px' }}>
          
          <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => { setShowNotificationDropdown(!showNotificationDropdown); setShowProfileDropdown(false); }}>
            <Bell size={20} color="var(--text-secondary)" />
            {inAppNotifs.length > 0 && (
              <div style={{ position: 'absolute', top: -4, right: -4, background: 'var(--danger-500)', color: 'white', fontSize: 10, width: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                {inAppNotifs.length > 9 ? '9+' : inAppNotifs.length}
              </div>
            )}
          </div>

          {showNotificationDropdown && (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={() => setShowNotificationDropdown(false)} />
              <div className="profile-dropdown animate-in" style={{ zIndex: 999, right: -40, width: 280, padding: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Notifications
                  <Link to="/notifications" onClick={() => setShowNotificationDropdown(false)} style={{ fontSize: 12, color: 'var(--primary-600)' }}>View All</Link>
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {inAppNotifs.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No new notifications</div>
                  ) : (
                    inAppNotifs.map(n => (
                      <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 13, cursor: 'pointer' }} onClick={() => handleMarkRead(n.id)}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{n.customer?.name}</div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                        <div style={{ color: 'var(--primary-600)', fontSize: 11, marginTop: 4, fontWeight: 600 }}>Mark as read</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          <div 
            className="sidebar-avatar" 
            onClick={() => { setShowProfileDropdown(!showProfileDropdown); setShowNotificationDropdown(false); }} 
            style={{ width: 32, height: 32, fontSize: 13, cursor: 'pointer' }}
          >
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          {showProfileDropdown && (
            <>
              <div 
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                onClick={() => setShowProfileDropdown(false)} 
              />
              <div className="profile-dropdown animate-in" style={{ zIndex: 999 }}>
                <div className="profile-dropdown-header">
                  <strong>{user?.name}</strong>
                  <span>{user?.email || user?.phone}</span>
                  <div style={{ marginTop: 4 }}>
                    <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px', display: 'inline-block' }}>
                      {user?.role}
                    </span>
                  </div>
                </div>
                <div className="profile-dropdown-divider" />
                <button 
                  className="profile-dropdown-item text-danger" 
                  onClick={async () => { 
                    setShowProfileDropdown(false); 
                    await handleLogout(); 
                  }}
                >
                  <LogOut size={16} /> Switch Account
                </button>
              </div>
            </>
          )}
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
              <span>{isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin Panel' : 'Agent Panel'}</span>
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
