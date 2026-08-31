import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import GlobalSearch from './GlobalSearch.jsx';

const navGroups = [
  {
    label: 'BUSINESS',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: HomeIcon }
    ]
  },
  {
    label: 'OPERATIONS',
    items: [
      { to: '/purchases', label: 'Purchases', icon: PurchaseIcon, perm: 'purchases' },
      { to: '/stock', label: 'Stock', icon: StockIcon, perm: 'stock' },
      { to: '/coating-jobs', label: 'Coating Jobs', icon: JobIcon, perm: 'coating_jobs' },
      { to: '/dispatch', label: 'Dispatch', icon: DispatchIcon, perm: 'dispatch' },
    ]
  },
  {
    label: 'PEOPLE',
    items: [
      { to: '/suppliers', label: 'Suppliers', icon: SupplierIcon, perm: 'purchases' },
      { to: '/customers', label: 'Customers / Parties', icon: CustomerIcon, perm: 'customers' },
      { to: '/employees', label: 'Employees', icon: EmployeeIcon, perm: 'employees' },
    ]
  },
  {
    label: 'FINANCE',
    items: [
      { to: '/payments', label: 'Payments', icon: PayIcon, perm: 'payments' },
      { to: '/salary', label: 'Salary', icon: SalaryIcon, perm: 'salary' },
      { to: '/overtime', label: 'Overtime', icon: OTIcon, perm: 'overtime' },
      { to: '/advances', label: 'Advances', icon: AdvIcon, perm: 'salary' },
    ]
  },
  {
    label: 'COMMUNICATION',
    items: [
      { to: '/whatsapp', label: 'WhatsApp', icon: WAIcon, perm: 'whatsapp' }
    ]
  },
  {
    label: 'REPORTS',
    items: [
      { to: '/reports', label: 'Reports', icon: ReportIcon, perm: 'reports' }
    ]
  },
  {
    label: 'SYSTEM',
    items: [
      { to: '/admin', label: 'Settings', icon: AdminIcon, adminOnly: true }
    ]
  }
];

const bottomNav = [
  { to: '/dashboard', label: 'Home', icon: HomeIcon },
  { to: '/coating-jobs', label: 'Jobs', icon: JobIcon },
  { to: '/stock', label: 'Stock', icon: StockIcon },
  { to: '/purchases', label: 'Purchases', icon: PurchaseIcon },
  { to: '/suppliers', label: 'Suppliers', icon: SupplierIcon },
];

function getBreadcrumb(pathname) {
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/purchases')) return 'Operations / Purchases';
  if (pathname.startsWith('/stock')) return 'Operations / Stock';
  if (pathname.startsWith('/coating-jobs')) return 'Operations / Coating Jobs';
  if (pathname.startsWith('/dispatch')) return 'Operations / Dispatch';
  if (pathname.startsWith('/suppliers')) return 'People / Suppliers';
  if (pathname.startsWith('/customers')) return 'People / Customers & Parties';
  if (pathname.startsWith('/employees')) return 'People / Employees';
  if (pathname.startsWith('/payments')) return 'Finance / Payments';
  if (pathname.startsWith('/salary')) return 'Finance / Salary';
  if (pathname.startsWith('/overtime')) return 'Finance / Overtime';
  if (pathname.startsWith('/advances')) return 'Finance / Advances';
  if (pathname.startsWith('/whatsapp')) return 'Communication / WhatsApp';
  if (pathname.startsWith('/reports')) return 'Analytics / Reports';
  if (pathname.startsWith('/admin')) return 'System / Settings';
  return 'Resin Operations';
}

export default function AppShell({ children }) {
  const { user, logout, hasPermission, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    window.openGlobalSearch = () => setSearchOpen(true);
    return () => { delete window.openGlobalSearch; };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const breadcrumb = getBreadcrumb(location.pathname);

  return (
    <div className="app-layout">
      {/* Global Search Modal */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>
            <span style={{ color: 'var(--color-primary)' }}>◆</span> Resin ERP
          </h1>
          <p>Diamond Coating Ops</p>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map(group => {
            const filteredItems = group.items.filter(n =>
              (!n.perm || hasPermission(n.perm)) && (!n.adminOnly || isAdmin)
            );
            
            if (filteredItems.length === 0) return null;

            return (
              <div key={group.label}>
                <div className="sidebar-section-label">{group.label}</div>
                {filteredItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="icon" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 10px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0
            }}>
              {user?.full_name?.[0] || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name || user?.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {user?.role_name || 'Operator'}
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleLogout}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <LogoutIcon className="icon" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Desktop Top Header */}
        <header className="top-header">
          <div className="top-header-left">
            <span className="top-header-breadcrumb">
              <strong>{breadcrumb}</strong>
            </span>
          </div>

          <div className="top-header-right">
            <button className="top-search-btn" onClick={() => setSearchOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <span>Search jobs, stock, suppliers…</span>
              <kbd>⌘K</kbd>
            </button>

            {/* Dark / Light Mode Toggle Button */}
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle theme mode"
            >
              {theme === 'dark' ? (
                <SunIcon />
              ) : (
                <MoonIcon />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Top Header */}
        <header className="mobile-header">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation menu"
          >
            <MenuIcon />
          </button>
          <h2>Resin ERP</h2>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className="theme-toggle-btn"
              style={{ width: 28, height: 28 }}
              onClick={toggleTheme}
              aria-label="Toggle theme mode"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSearchOpen(true)} aria-label="Search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>

      {/* Bottom Navigation for Mobile */}
      <nav className="bottom-nav">
        <div className="bottom-nav-items">
          {bottomNav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* ---- SVGs ---- */
function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function HomeIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function PurchaseIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
}
function SupplierIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.85M19 21V10.85M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/></svg>;
}
function StockIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}
function JobIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
}
function CustomerIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function DispatchIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
}
function EmployeeIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function SalaryIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function WAIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
}
function ReportIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>;
}
function PayIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
}
function OTIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function AdvIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>;
}
function AdminIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}
function LogoutIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}
function MenuIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
}
