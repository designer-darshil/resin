import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, fmtQty } from '../utils/helpers.js';

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await employeesApi.update(id, {
        ...form,
        base_salary: parseFloat(form.base_salary) || 0,
        overtime_rate: parseFloat(form.overtime_rate) || 0
      });
      toast.success('Employee updated');
      setShowEditModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="page">
      <div className="skeleton-line" style={{ height: 28, width: 220, marginBottom: 12 }} />
      <div className="skeleton-line" style={{ height: 90 }} />
    </div>
  );
  if (!employee) return null;

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/employees">Employees</Link>
        <span>/</span>
        <strong>{employee.full_name}</strong>
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">{employee.full_name}</h1>
            <span className="badge badge-accent">{employee.employee_code}</span>
            <StatusBadge status={employee.employment_status || 'active'} />
          </div>
          <p className="page-subtitle">
            {employee.designation || 'Operator'} · {employee.department || 'Production'} · Joined {fmtDate(employee.joining_date)}
          </p>
        </div>

        <div className="page-header-actions">
          {employee.phone && (
            <button className="btn btn-secondary btn-sm" onClick={() => window.open(`tel:${employee.phone}`)}>
              📞 Call
            </button>
          )}
          {hasPermission('employees', 'can_edit') && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(true)}>
              Edit Details
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/coating-jobs')}>
            Assign to Job →
          </button>
        </div>
      </div>

      {/* Structured Stats Strip */}
      <div className="stat-strip">
        <div className="stat-strip-item">
          <div className="stat-strip-label">Base Salary</div>
          <div className="stat-strip-value">{fmtCurrency(employee.base_salary)}</div>
          <div className="stat-strip-sub">Per {employee.salary_type || 'month'}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Overtime Rate</div>
          <div className="stat-strip-value" style={{ color: 'var(--color-primary)' }}>
            {fmtCurrency(employee.overtime_rate)} / hr
          </div>
          <div className="stat-strip-sub">Approved extra rate</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Total Assigned Jobs</div>
          <div className="stat-strip-value">{employee.jobs?.length || 0}</div>
          <div className="stat-strip-sub">Production batches</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Active Advances</div>
          <div className="stat-strip-value" style={{ color: employee.advances?.length > 0 ? 'var(--status-warning)' : 'inherit' }}>
            {employee.advances?.length || 0}
          </div>
          <div className="stat-strip-sub">Pending deductions</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview &amp; Profile
        </button>
        <button className={`tab ${activeTab === 'work' ? 'active' : ''}`} onClick={() => setActiveTab('work')}>
          Assigned Jobs ({employee.jobs?.length || 0})
        </button>
        <button className={`tab ${activeTab === 'overtime' ? 'active' : ''}`} onClick={() => setActiveTab('overtime')}>
          Overtime Log ({employee.overtime?.length || 0})
        </button>
        <button className={`tab ${activeTab === 'salary' ? 'active' : ''}`} onClick={() => setActiveTab('salary')}>
          Salary History ({employee.salaries?.length || 0})
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.4fr)', gap: 'var(--space-6)' }}>
          <div className="panel">
            <div className="form-section-title" style={{ marginTop: 0 }}>Employee Profile</div>
            <div className="data-row">
              <span className="data-row-label">Full Name</span>
              <span className="data-row-value">{employee.full_name}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Employee Code</span>
              <span className="data-row-value" style={{ fontFamily: 'var(--font-mono)' }}>{employee.employee_code}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Department</span>
              <span className="data-row-value">{employee.department || 'Production'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Designation</span>
              <span className="data-row-value">{employee.designation || 'Coating Operator'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Phone</span>
              <span className="data-row-value">{employee.phone || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Joining Date</span>
              <span className="data-row-value">{fmtDate(employee.joining_date)}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Address</span>
              <span className="data-row-value">{employee.address || '—'}</span>
            </div>
          </div>

          <div className="panel">
            <div className="form-section-title" style={{ marginTop: 0 }}>Recent Coating Operations</div>
            <div className="table-wrapper" style={{ border: 'none', margin: 0, boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job Code</th>
                    <th>Date</th>
                    <th className="num-col">Quantity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(employee.jobs || []).slice(0, 5).map(j => (
                    <tr key={j.id} onClick={() => navigate(`/coating-jobs/${j.coating_job_id || j.id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {j.job_code}
                      </td>
                      <td>{fmtDate(j.assigned_date || j.coating_date)}</td>
                      <td className="num-col">{fmtQty(j.completed_quantity || j.input_quantity)} pcs</td>
                      <td><StatusBadge status={j.job_status} /></td>
                    </tr>
                  ))}
                  {(!employee.jobs || employee.jobs.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                        No jobs assigned yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Work */}
      {activeTab === 'work' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job Code</th>
                <th>Assigned Date</th>
                <th>Coating Type</th>
                <th className="num-col">Completed Qty</th>
                <th className="num-col">Rejected Qty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(employee.jobs || []).map(j => (
                <tr key={j.id} onClick={() => navigate(`/coating-jobs/${j.coating_job_id || j.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {j.job_code}
                  </td>
                  <td>{fmtDate(j.assigned_date)}</td>
                  <td>{j.coating_type || 'Standard'}</td>
                  <td className="num-col" style={{ fontWeight: 600, color: 'var(--status-success)' }}>
                    {fmtQty(j.completed_quantity)} pcs
                  </td>
                  <td className="num-col" style={{ color: j.rejected_quantity > 0 ? 'var(--status-error)' : 'var(--text-muted)' }}>
                    {fmtQty(j.rejected_quantity || 0)}
                  </td>
                  <td><StatusBadge status={j.job_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Overtime */}
      {activeTab === 'overtime' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num-col">Hours</th>
                <th className="num-col">Rate / hr</th>
                <th className="num-col">Calculated Amount</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(employee.overtime || []).map(ot => (
                <tr key={ot.id}>
                  <td>{fmtDate(ot.overtime_date)}</td>
                  <td className="num-col" style={{ fontWeight: 600 }}>{ot.hours} hrs</td>
                  <td className="num-col">{fmtCurrency(ot.rate_per_hour)}</td>
                  <td className="num-col" style={{ fontWeight: 700 }}>{fmtCurrency(ot.total_amount)}</td>
                  <td><StatusBadge status={ot.approval_status} /></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{ot.notes || '—'}</td>
                </tr>
              ))}
              {(!employee.overtime || employee.overtime.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No overtime hours logged.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Salary */}
      {activeTab === 'salary' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th className="num-col">Base</th>
                <th className="num-col">OT Pay</th>
                <th className="num-col">Deductions</th>
                <th className="num-col">Net Payable</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {(employee.salaries || []).map(sal => (
                <tr key={sal.id}>
                  <td style={{ fontWeight: 600 }}>{sal.period_month}/{sal.period_year}</td>
                  <td className="num-col">{fmtCurrency(sal.base_salary)}</td>
                  <td className="num-col">{fmtCurrency(sal.overtime_amount)}</td>
                  <td className="num-col">{fmtCurrency(sal.total_deductions)}</td>
                  <td className="num-col" style={{ fontWeight: 700, color: 'var(--status-success)' }}>
                    {fmtCurrency(sal.net_payable)}
                  </td>
                  <td><StatusBadge status={sal.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Employee Information"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-control" value={form.full_name || ''} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Department</label>
              <input className="form-control" value={form.department || ''} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input className="form-control" value={form.designation || ''} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Base Salary (₹)</label>
              <input className="form-control" type="number" value={form.base_salary || ''} onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">OT Rate / hr (₹)</label>
              <input className="form-control" type="number" value={form.overtime_rate || ''} onChange={e => setForm(f => ({ ...f, overtime_rate: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={form.employment_status || 'active'} onChange={e => setForm(f => ({ ...f, employment_status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On Leave</option>
              <option value="resigned">Resigned</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
