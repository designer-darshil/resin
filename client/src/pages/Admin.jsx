import { useState, useEffect } from 'react';
import { adminApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal } from '../components/ui.jsx';
import { fmtDate } from '../utils/helpers.js';
import { useNavigate } from 'react-router-dom';

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [settings, setSettings] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', full_name: '', email: '', password: '', role_id: '' });
  const [saving, setSaving] = useState(false);
  const [settingsEditing, setSettingsEditing] = useState({});

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard'); return; }
    loadAll();
  }, [isAdmin]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, settingsRes] = await Promise.all([
        adminApi.users(), adminApi.roles(), adminApi.settings()
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.roles);
      setPermissions(rolesRes.permissions);
      setSettings(settingsRes.data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await adminApi.auditLogs({ limit: 100 });
      setAuditLogs(res.data);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => {
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.username || !userForm.full_name || !userForm.password || !userForm.role_id) {
      toast.error('All required fields must be filled'); return;
    }
    setSaving(true);
    try {
      await adminApi.createUser(userForm);
      toast.success('User created');
      setShowUserModal(false);
      setUserForm({ username: '', full_name: '', email: '', password: '', role_id: '' });
      loadAll();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const toggleUserActive = async (user) => {
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active ? 1 : 0 });
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      loadAll();
    } catch (err) { toast.error(err.message); }
  };

  const getPermission = (roleId, module) => permissions.find(p => p.role_id === roleId && p.module === module);

  const togglePermission = async (roleId, module, field) => {
    const current = getPermission(roleId, module) || {};
    const updated = { ...current, [field]: current[field] ? 0 : 1 };
    try {
      await adminApi.updatePermission(roleId, module, updated);
      const res = await adminApi.roles();
      setPermissions(res.permissions);
    } catch (err) { toast.error(err.message); }
  };

  const MODULES = ['purchases','stock','coating_jobs','customers','dispatch','employees','salary','overtime','payments','whatsapp','reports'];
  const PERM_FIELDS = ['can_view','can_create','can_edit','can_approve','has_salary_access','has_reports_access'];
  const PERM_LABELS = { can_view: 'View', can_create: 'Create', can_edit: 'Edit', can_approve: 'Approve', has_salary_access: 'Salary', has_reports_access: 'Reports' };

  const saveSettings = async () => {
    const updates = Object.entries(settingsEditing).map(([key, value]) => ({ key, value }));
    if (updates.length === 0) { toast.info('No changes to save'); return; }
    try {
      await adminApi.saveSettings(updates);
      toast.success('Settings saved');
      setSettingsEditing({});
      loadAll();
    } catch (err) { toast.error(err.message); }
  };

  const groupedSettings = settings.reduce((acc, s) => {
    acc[s.category] = acc[s.category] || [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div className="page">
      <PageHeader title="Administration" subtitle="User management, permissions, settings" />

      <div className="tabs">
        {['users','permissions','settings','audit'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>+ Create User</button>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Username</th><th>Full Name</th><th>Email</th><th>Role</th><th>Active</th><th className="col-actions">Actions</th></tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j}><div className="skeleton skeleton-line" /></td>)}</tr>)
                  : users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>@{u.username}</td>
                      <td>{u.full_name}</td>
                      <td className="text-muted">{u.email || '—'}</td>
                      <td><span className="badge badge-accent">{u.role_name}</span></td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="col-actions">
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggleUserActive(u)}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* PERMISSIONS TAB */}
      {activeTab === 'permissions' && (
        <>
          <div className="info-box" style={{ marginBottom: 16 }}>
            Admin role always has full access to everything. Only Manager and Employee roles are configurable.
          </div>
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  {roles.filter(r => r.name !== 'admin').flatMap(r =>
                    PERM_FIELDS.map(f => <th key={`${r.id}-${f}`} style={{ whiteSpace: 'nowrap', fontSize: 10 }}>{r.name} — {PERM_LABELS[f]}</th>)
                  )}
                </tr>
              </thead>
              <tbody>
                {MODULES.map(mod => (
                  <tr key={mod}>
                    <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{mod.replace('_', ' ')}</td>
                    {roles.filter(r => r.name !== 'admin').flatMap(r =>
                      PERM_FIELDS.map(f => {
                        const perm = getPermission(r.id, mod);
                        const val = perm?.[f] || 0;
                        return (
                          <td key={`${r.id}-${mod}-${f}`} style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => togglePermission(r.id, mod, f)}
                              style={{
                                width: 24, height: 24, borderRadius: 4, border: 'none', cursor: 'pointer',
                                background: val ? 'var(--color-success)' : 'var(--color-bg-secondary)',
                                color: val ? '#fff' : 'var(--color-text-muted)',
                                fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto'
                              }}
                              title={`Toggle ${f} for ${mod}`}
                            >
                              {val ? '✓' : '—'}
                            </button>
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <>
          {Object.entries(groupedSettings).map(([category, items]) => (
            <div key={category} className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <h3>{category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h3>
              </div>
              <div className="card-body">
                {items.map(s => (
                  <div key={s.key} className="form-group">
                    <label className="form-label">{s.label || s.key.replace(/_/g, ' ')}</label>
                    {s.type === 'textarea' ? (
                      <textarea
                        className="form-control"
                        rows="3"
                        value={settingsEditing[s.key] !== undefined ? settingsEditing[s.key] : s.value || ''}
                        onChange={e => setSettingsEditing(prev => ({ ...prev, [s.key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        className="form-control"
                        type={s.type === 'number' ? 'number' : 'text'}
                        value={settingsEditing[s.key] !== undefined ? settingsEditing[s.key] : s.value || ''}
                        onChange={e => setSettingsEditing(prev => ({ ...prev, [s.key]: e.target.value }))}
                      />
                    )}
                    {s.description && <div className="form-hint">{s.description}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-primary" onClick={saveSettings}>Save All Settings</button>
        </>
      )}

      {/* AUDIT LOG TAB */}
      {activeTab === 'audit' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>IP</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No audit logs</td></tr>
              ) : auditLogs.map(l => (
                <tr key={l.id}>
                  <td className="text-sm">{fmtDate(l.created_at)}</td>
                  <td>{l.username || '—'}</td>
                  <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{l.action}</span></td>
                  <td className="text-sm">{l.module}</td>
                  <td className="text-muted text-sm">{l.ip_address || '—'}</td>
                  <td className="text-sm text-muted">{l.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      <Modal open={showUserModal} onClose={() => setShowUserModal(false)} title="Create User"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreateUser} disabled={saving}>{saving ? 'Creating…' : 'Create User'}</button>
        </>}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Username <span className="required">*</span></label>
            <input className="form-control" value={userForm.username} onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))} placeholder="Unique username" />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name <span className="required">*</span></label>
            <input className="form-control" value={userForm.full_name} onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Role <span className="required">*</span></label>
            <select className="form-control" value={userForm.role_id} onChange={e => setUserForm(f => ({ ...f, role_id: e.target.value }))}>
              <option value="">Select role…</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Password <span className="required">*</span></label>
          <input className="form-control" type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" />
        </div>
      </Modal>
    </div>
  );
}
