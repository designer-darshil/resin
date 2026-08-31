import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const navGroups = [
  {
    label: 'HOME',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: HomeIcon }
    ]
  },
  {
    label: 'WORK',
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
      { to: '/customers', label: 'Parties', icon: CustomerIcon, perm: 'customers' },
      { to: '/employees', label: 'Employees', icon: EmployeeIcon, perm: 'employees' },
    ]
  },
  {
    label: 'MONEY',
    items: [
      { to: '/payments', label: 'Payments', icon: PayIcon, perm: 'payments' },
      { to: '/salary', label: 'Salary', icon: SalaryIcon, perm: 'salary' },
      { to: '/advances', label: 'Advances', icon: AdvIcon, perm: 'salary' },
      { to: '/overtime', label: 'Overtime', icon: OTIcon, perm: 'overtime' },
    ]
  },
  {
    label: 'REPORTS',
    items: [
      { to: '/reports', label: 'Reports', icon: ReportIcon, perm: 'reports' }
    ]
  },
  {
    label: 'COMMUNICATION',
    items: [
      { to: '/whatsapp', label: 'WhatsApp', icon: WAIcon, perm: 'whatsapp' }
    ]
  },
  {
    label: 'ADMIN',
    items: [
      { to: '/admin', label: 'Settings', icon: AdminIcon, adminOnly: true }
    ]
  }
];

// Bottom nav (5 most important for mobile)
const bottomNav = [
  { to: '/dashboard', label: 'Home', icon: HomeIcon },
  { to: '/coating-jobs', label: 'Jobs', icon: JobIcon },
  { to: '/stock', label: 'Stock', icon: StockIcon },
  { to: '/customers', label: 'Parties', icon: CustomerIcon },
  { to: '/employees', label: 'Employees', icon: EmployeeIcon },
];

export default function AppShell({ children }) {
  const { user, logout, hasPermission, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <div className="sidebar-overlay visible" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>💎 Resin</h1>
          <p>Operations Manager</p>
        </div>

        <div className="sidebar-nav">
          {navGroups.map(group => {
            const filteredItems = group.items.filter(n =>
              (!n.perm || hasPermission(n.perm)) && (!n.adminOnly || isAdmin)
            );
            
            if (filteredItems.length === 0) return null;

            return (
              <div key={group.label} style={{ marginBottom: 16 }}>
                <div className="sidebar-section-label">{group.label}</div>
                {filteredItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="icon" />
                    {label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', marginBottom: 4 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: 'var(--sidebar-active-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0
            }}>
              {user?.full_name?.[0] || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name || user?.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--sidebar-section-text)', textTransform: 'capitalize' }}>
                {user?.role_name}
              </div>
            </div>
          </div>
          <button
            className="sidebar-link"
            onClick={handleLogout}
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--sidebar-text)', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <LogoutIcon className="icon" />
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="main-content">
        {/* Mobile Header */}
        <header className="mobile-header">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <MenuIcon />
          </button>
          <h2>💎 Resin</h2>
          <button className="btn btn-ghost btn-icon" onClick={handleLogout}>
            <LogoutIcon />
          </button>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>

      {/* Bottom Navigation */}
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

/* ---- SVG Icons ---- */
function HomeIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function PurchaseIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
}
function StockIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}
function JobIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 9H14V7.5"/><path d="M10 9.5c0 .83-.67 1.5-1.5 1.5H3c-.83 0-1.5-.67-1.5-1.5S2.17 8 3 8h5.5c.83 0 1.5.67 1.5 1.5z"/><path d="M8.5 15H10v1.5"/></svg>;
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
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.547 4.103 1.508 5.833L0 24l6.337-1.491A11.938 11.938 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.548 9.548 0 0 1-4.879-1.337l-.35-.208-3.619.851.886-3.523-.228-.363A9.547 9.547 0 0 1 2.4 12c0-5.292 4.308-9.6 9.6-9.6s9.6 4.308 9.6 9.6-4.308 9.6-9.6 9.6z"/></svg>;
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
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2.5-8 4v1h16v-1c0-1.5-3-4-8-4z"/><path d="M18 2l2 2-8 8-4-4 2-2 2 2z"/></svg>;
}
function LogoutIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}
function MenuIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
}
