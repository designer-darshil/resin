import { useState, useEffect } from 'react';
import { adminApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal, LoadingRows } from '../components/ui.jsx';
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
      setUsers(usersRes.data || []);
      setRoles(rolesRes.roles || []);
      setPermissions(rolesRes.permissions || []);
      setSettings(settingsRes.data || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await adminApi.auditLogs({ limit: 100 });
      setAuditLogs(res.data || []);
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
      toast.success('User account created');
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
      setPermissions(res.permissions || []);
    } catch (err) { toast.error(err.message); }
  };

  const MODULES = ['purchases', 'stock', 'coating_jobs', 'customers', 'dispatch', 'employees', 'salary', 'overtime', 'payments', 'whatsapp', 'reports'];
  const PERM_FIELDS = ['can_view', 'can_create', 'can_edit', 'can_approve', 'has_salary_access', 'has_reports_access'];
  const PERM_LABELS = { can_view: 'View', can_create: 'Create', can_edit: 'Edit', can_approve: 'Approve', has_salary_access: 'Salary', has_reports_access: 'Reports' };

  const saveSettings = async () => {
    const updates = Object.entries(settingsEditing).map(([key, value]) => ({ key, value }));
    if (updates.length === 0) { toast.info('No modifications to save'); return; }
    try {
      await adminApi.saveSettings(updates);
      toast.success('System settings saved');
      setSettingsEditing({});
      loadAll();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="page">
      <PageHeader
        title="System Administration"
        subtitle="Manage user accounts, RBAC permissions matrix, application settings, and audit logs"
        actions={
          activeTab === 'users' && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowUserModal(true)}>
              + Add User Account
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          User Accounts ({users.length})
        </button>
        <button className={`tab ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>
          Role Permissions Matrix
        </button>
        <button className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          System Configurations
        </button>
        <button className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
          Audit Trail Logs
        </button>
      </div>

      {/* TAB 1: User Accounts */}
      {activeTab === 'users' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Assigned Role</th>
                <th>Status</th>
                <th className="action-col">Account Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows cols={6} rows={5} />
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {u.username}
                    </td>
                    <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{u.email || '—'}</td>
                    <td>
                      <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                        {u.role_name || u.role}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={u.is_active ? 'active' : 'inactive'} />
                    </td>
                    <td className="action-col">
                      <button
                        className={`btn ${u.is_active ? 'btn-danger' : 'btn-success'} btn-sm`}
                        style={{ height: 24, fontSize: 11 }}
                        onClick={() => toggleUserActive(u)}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: RBAC Matrix */}
      {activeTab === 'roles' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>System Module</th>
                {roles.map(r => (
                  <th key={r.id} style={{ textAlign: 'center' }}>
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map(mod => (
                <tr key={mod}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {mod.replace('_', ' ')}
                  </td>
                  {roles.map(r => {
                    const perm = getPermission(r.id, mod) || {};
                    return (
                      <td key={r.id} style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {PERM_FIELDS.map(f => (
                            <label
                              key={f}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10,
                                cursor: 'pointer', opacity: perm[f] ? 1 : 0.4
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(perm[f])}
                                onChange={() => togglePermission(r.id, mod, f)}
                                style={{ width: 12, height: 12, accentColor: 'var(--color-primary)' }}
                              />
                              {PERM_LABELS[f]}
                            </label>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: System Configurations */}
      {activeTab === 'settings' && (
        <div className="panel" style={{ maxWidth: 700 }}>
          <div className="form-section-title" style={{ marginTop: 0 }}>System Variables</div>
          {settings.map(s => (
            <div key={s.key || s.setting_key} className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontFamily: 'var(--font-mono)' }}>{s.key || s.setting_key}</label>
              <input
                className="form-control"
                value={settingsEditing[s.key || s.setting_key] !== undefined ? settingsEditing[s.key || s.setting_key] : (s.value || s.setting_value || '')}
                onChange={e => setSettingsEditing(prev => ({ ...prev, [s.key || s.setting_key]: e.target.value }))}
              />
            </div>
          ))}
          <button className="btn btn-primary btn-sm" onClick={saveSettings} style={{ marginTop: 8 }}>
            Save Configuration Changes
          </button>
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User / Operator</th>
                <th>Action</th>
                <th>Module / Resource</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(l => (
                <tr key={l.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(l.created_at)}</td>
                  <td style={{ fontWeight: 600 }}>{l.username || 'System'}</td>
                  <td><span className="badge badge-accent">{l.action}</span></td>
                  <td>{l.entity_type}</td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.details || '—'}
                  </td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                    No audit log records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: New User */}
      <Modal
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        title="Create New User Account"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowUserModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleCreateUser} disabled={saving}>
              {saving ? 'Creating…' : 'Create User Account'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateUser}>
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input
              className="form-control"
              value={userForm.username}
              onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-control"
              value={userForm.full_name}
              onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-control"
              type="email"
              value={userForm.email}
              onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Initial Password *</label>
            <input
              className="form-control"
              type="password"
              value={userForm.password}
              onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Assigned Role *</label>
            <select
              className="form-control"
              value={userForm.role_id}
              onChange={e => setUserForm(f => ({ ...f, role_id: e.target.value }))}
              required
            >
              <option value="">-- Select Role --</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
