import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal, Avatar } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, fmtQty } from '../utils/helpers.js';

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission, isAdmin } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [showEditModal, setShowEditModal] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await employeesApi.get(id);
      setEmployee(data);
      setForm({
        full_name: data.full_name, phone: data.phone || '', address: data.address || '',
        department: data.department || '', designation: data.designation || '',
        employment_status: data.employment_status || 'active',
        salary_type: data.salary_type || 'monthly', base_salary: data.base_salary || '',
        overtime_rate: data.overtime_rate || '', notes: data.notes || ''
      });
    } catch (err) {
      toast.error('Employee not found');
      navigate('/employees');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await employeesApi.update(id, { ...form, base_salary: parseFloat(form.base_salary) || 0, overtime_rate: parseFloat(form.overtime_rate) || 0 });
      toast.success('Employee updated');
      setShowEditModal(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (loading) return <div className="page"><div className="skeleton skeleton-line" style={{ height: 32, width: 300 }} /></div>;
  if (!employee) return null;

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/employees">Employees</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{employee.full_name}</span>
      </div>

      <PageHeader
        title={employee.full_name}
        subtitle={`${employee.employee_code} · ${employee.designation || 'No designation'}`}
        actions={<>
          <StatusBadge status={employee.employment_status || 'active'} />
          {hasPermission('employees', 'can_edit') && (
            <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>Edit</button>
          )}
        </>}
      />

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: '1 1 140px' }}>
          <div className="stat-card-label">Base Salary</div>
          <div className="stat-card-value" style={{ fontSize: 20 }}>{fmtCurrency(employee.base_salary)}</div>
          <div className="stat-card-sub">per {employee.salary_type}</div>
        </div>
        <div className="stat-card" style={{ flex: '1 1 140px' }}>
          <div className="stat-card-label">OT Rate</div>
          <div className="stat-card-value" style={{ fontSize: 20 }}>{fmtCurrency(employee.overtime_rate)}</div>
          <div className="stat-card-sub">per hour</div>
        </div>
        <div className="stat-card" style={{ flex: '1 1 140px' }}>
          <div className="stat-card-label">Total Jobs</div>
          <div className="stat-card-value" style={{ fontSize: 20 }}>{employee.jobs?.length || 0}</div>
          <div className="stat-card-sub">assignments</div>
        </div>
        <div className="stat-card" style={{ flex: '1 1 140px' }}>
          <div className="stat-card-label">Active Advances</div>
          <div className="stat-card-value" style={{ fontSize: 20 }}>{employee.advances?.length || 0}</div>
          <div className="stat-card-sub">advances</div>
        </div>
      </div>

      <div className="tabs">
        {['profile','jobs','overtime','advances'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><h3>Personal Information</h3></div>
            <div className="card-body">
              {[
                ['Phone', employee.phone],
                ['Address', employee.address],
                ['Joining Date', fmtDate(employee.joining_date)],
                ['Department', employee.department],
                ['Designation', employee.designation],
                ['Notes', employee.notes],
              ].map(([label, val]) => val ? (
                <div key={label} className="detail-field">
                  <div className="detail-field-label">{label}</div>
                  <div className="detail-field-value">{val}</div>
                </div>
              ) : null)}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>Salary Configuration</h3></div>
            <div className="card-body">
              {[
                ['Salary Type', employee.salary_type],
                ['Base Salary', fmtCurrency(employee.base_salary)],
                ['Overtime Rate', `${fmtCurrency(employee.overtime_rate)}/hr`],
                ['Payment Frequency', employee.payment_frequency],
              ].map(([label, val]) => (
                <div key={label} className="detail-field">
                  <div className="detail-field-label">{label}</div>
                  <div className="detail-field-value">{val || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div>
          {employee.jobs?.length === 0 && <p className="text-muted">No job assignments.</p>}
          {employee.jobs?.map(j => (
            <div key={j.id} className="data-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="font-semibold">{j.job_code}</span>
                <StatusBadge status={j.job_status} />
              </div>
              <div className="data-card-row"><span className="data-card-label">Date</span><span>{fmtDate(j.coating_date)}</span></div>
              <div className="data-card-row"><span className="data-card-label">Coating</span><span>{j.coating_type || '—'}</span></div>
              <div className="data-card-row"><span className="data-card-label">Completed</span><span className="text-success">{fmtQty(j.completed_quantity)} pcs</span></div>
              <div className="data-card-row"><span className="data-card-label">Rejected</span><span className="text-error">{fmtQty(j.rejected_quantity)} pcs</span></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'overtime' && (
        <div>
          {employee.overtime?.length === 0 && <p className="text-muted">No overtime records.</p>}
          {employee.overtime?.map(o => (
            <div key={o.id} className="data-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="font-semibold">{fmtDate(o.date)}</span>
                <StatusBadge status={o.approval_status} />
              </div>
              <div className="data-card-row"><span className="data-card-label">OT Hours</span><span>{o.overtime_hours} hrs</span></div>
              <div className="data-card-row"><span className="data-card-label">Rate</span><span>{fmtCurrency(o.overtime_rate)}/hr</span></div>
              <div className="data-card-row"><span className="data-card-label">Amount</span><span className="font-semibold">{fmtCurrency(o.overtime_amount)}</span></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'advances' && (
        <div>
          {employee.advances?.length === 0 && <p className="text-muted">No advance records.</p>}
          {employee.advances?.map(a => (
            <div key={a.id} className="data-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="font-semibold">{fmtDate(a.advance_date)}</span>
                <StatusBadge status={a.status} />
              </div>
              <div className="data-card-row"><span className="data-card-label">Amount</span><span>{fmtCurrency(a.amount)}</span></div>
              <div className="data-card-row"><span className="data-card-label">Remaining</span><span className="text-warning font-semibold">{fmtCurrency(a.remaining_balance)}</span></div>
              <div className="data-card-row"><span className="data-card-label">Reason</span><span>{a.reason || '—'}</span></div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Employee" size="large"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-control" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Department</label>
            <input className="form-control" value={form.department} onChange={e => set('department', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={form.employment_status} onChange={e => set('employment_status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On Leave</option>
              <option value="resigned">Resigned</option>
            </select>
          </div>
        </div>
        {isAdmin && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Base Salary (₹)</label>
              <input className="form-control" type="number" value={form.base_salary} onChange={e => set('base_salary', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">OT Rate (₹/hr)</label>
              <input className="form-control" type="number" value={form.overtime_rate} onChange={e => set('overtime_rate', e.target.value)} />
            </div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-control" rows="2" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
