import { useState, useEffect, useCallback } from 'react';
import { overtimeApi, employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingRows, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, today } from '../utils/helpers.js';

export default function OvertimePage() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employee_id: '', date: today(), regular_hours: 8, overtime_hours: '', overtime_rate: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(null);
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('overtime', 'can_create');
  const canApprove = hasPermission('overtime', 'can_approve');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await overtimeApi.list(params);
      setRecords(res.data);
      setTotal(res.total);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleOpenModal = async () => {
    try {
      const res = await employeesApi.list({ status: 'active', limit: 200 });
      setEmployees(res.data || []);
      setShowModal(true);
    } catch (err) {
      toast.error('Failed to load employee list');
    }
  };

  const handleEmployeeChange = (empId) => {
    const emp = employees.find(e => e.id === parseInt(empId));
    setForm(f => ({
      ...f,
      employee_id: empId,
      overtime_rate: emp?.overtime_rate || ''
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.date || !form.overtime_hours) {
      toast.error('Employee, date, and OT hours are required'); return;
    }
    setSaving(true);
    try {
      await overtimeApi.create({
        ...form,
        overtime_hours: parseFloat(form.overtime_hours),
        regular_hours: parseFloat(form.regular_hours) || 8,
        overtime_rate: parseFloat(form.overtime_rate) || 0
      });
      toast.success('Overtime logged successfully');
      setShowModal(false);
      setForm({ employee_id: '', date: today(), regular_hours: 8, overtime_hours: '', overtime_rate: '', notes: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleApprove = async (id, action) => {
    setApproving(id);
    try {
      await overtimeApi.approve(id, { action });
      toast.success(`Overtime ${action === 'approve' ? 'approved' : 'rejected'}`);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setApproving(null); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <PageHeader
        title="Overtime Management"
        subtitle="Review operator extra shifts, calculate hourly payouts, and manage approvals"
        actions={canCreate && (
          <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
            + Log Overtime
          </button>
        )}
      />

      {/* Toolbar */}
      <div className="toolbar">
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Approval Statuses</option>
          <option value="pending">Pending Approval</option>
          <option value="approved">Approved for Payroll</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Settled / Paid</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th className="num-col">Regular Shift</th>
              <th className="num-col">Overtime Hours</th>
              <th className="num-col">Hourly Rate</th>
              <th className="num-col">Calculated Amount</th>
              <th>Status</th>
              <th>Notes</th>
              <th className="action-col">Approval Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={9} rows={6} />
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    title="No overtime records found"
                    description="Log extra production hours worked by operators to include them in monthly salary computation."
                    action={canCreate && (
                      <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
                        + Log Overtime
                      </button>
                    )}
                  />
                </td>
              </tr>
            ) : (
              records.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.employee_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.employee_code}</div>
                  </td>
                  <td>{fmtDate(r.overtime_date || r.date)}</td>
                  <td className="num-col" style={{ color: 'var(--text-secondary)' }}>{r.regular_hours || 8} hrs</td>
                  <td className="num-col" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                    {r.hours || r.overtime_hours} hrs
                  </td>
                  <td className="num-col">{fmtCurrency(r.rate_per_hour || r.overtime_rate)}</td>
                  <td className="num-col" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {fmtCurrency(r.total_amount || (r.hours * r.rate_per_hour))}
                  </td>
                  <td>
                    <StatusBadge status={r.approval_status || r.status || 'pending'} />
                  </td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.notes || '—'}
                  </td>
                  <td className="action-col">
                    {canApprove && (r.approval_status === 'pending' || r.status === 'pending') ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-success btn-sm"
                          style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                          onClick={() => handleApprove(r.id, 'approve')}
                          disabled={approving === r.id}
                        >
                          ✓ Approve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                          onClick={() => handleApprove(r.id, 'reject')}
                          disabled={approving === r.id}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="mobile-card-list">
        {records.map(r => (
          <div key={r.id} className="mobile-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{r.employee_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(r.overtime_date || r.date)}</div>
              </div>
              <StatusBadge status={r.approval_status || r.status || 'pending'} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
              <span>{r.hours || r.overtime_hours} hrs @ {fmtCurrency(r.rate_per_hour || r.overtime_rate)}/hr</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmtCurrency(r.total_amount || (r.hours * r.rate_per_hour))}</span>
            </div>
            {canApprove && (r.approval_status === 'pending' || r.status === 'pending') && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => handleApprove(r.id, 'approve')}>Approve</button>
                <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => handleApprove(r.id, 'reject')}>Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />

      {/* Log Overtime Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Log Employee Overtime"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Submit Overtime Record'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Employee / Operator *</label>
            <select
              className="form-control"
              value={form.employee_id}
              onChange={e => handleEmployeeChange(e.target.value)}
              required
              autoFocus
            >
              <option value="">-- Select Active Employee --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Shift Date *</label>
              <input
                className="form-control"
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Overtime Hours *</label>
              <input
                className="form-control"
                type="number"
                step="0.5"
                placeholder="e.g. 2.5"
                value={form.overtime_hours}
                onChange={e => set('overtime_hours', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Hourly Overtime Rate (₹)</label>
              <input
                className="form-control"
                type="number"
                placeholder="Auto-filled from employee profile"
                value={form.overtime_rate}
                onChange={e => set('overtime_rate', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Estimated Payout (₹)</label>
              <input
                className="form-control"
                value={fmtCurrency((parseFloat(form.overtime_hours) || 0) * (parseFloat(form.overtime_rate) || 0))}
                readOnly
                style={{ background: 'var(--bg-subtle)', fontWeight: 700 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason / Batch Reference</label>
            <textarea
              className="form-textarea"
              placeholder="Urgent batch completion, evening shift extension..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
