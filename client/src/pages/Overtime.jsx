import { useState, useEffect, useCallback } from 'react';
import { overtimeApi, employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingCards, Pagination, Modal, EmptyState } from '../components/ui.jsx';
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
    const res = await employeesApi.list({ status: 'active', limit: 200 });
    setEmployees(res.data);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.date || !form.overtime_hours) { toast.error('Employee, date, and OT hours are required'); return; }
    setSaving(true);
    try {
      await overtimeApi.create({ ...form, overtime_hours: parseFloat(form.overtime_hours), regular_hours: parseFloat(form.regular_hours) || 0, overtime_rate: parseFloat(form.overtime_rate) || 0 });
      toast.success('Overtime recorded');
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
      toast.success(`Overtime ${action}d`);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setApproving(null); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <PageHeader
        title="Overtime"
        subtitle={`${total} records`}
        actions={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>+ Add Overtime</button>}
      />

      <div className="toolbar">
        <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Regular Hrs</th>
              <th>OT Hours</th>
              <th>Rate</th>
              <th>Amount</th>
              <th>Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton skeleton-line" /></td>)}</tr>)
              : records.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.employee_name}</td>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.regular_hours} hrs</td>
                  <td style={{ fontWeight: 600 }}>{r.overtime_hours} hrs</td>
                  <td>{fmtCurrency(r.overtime_rate)}/hr</td>
                  <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>{fmtCurrency(r.overtime_amount)}</td>
                  <td><StatusBadge status={r.approval_status} /></td>
                  <td className="col-actions">
                    {canApprove && r.approval_status === 'pending' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-success btn-sm" disabled={approving === r.id} onClick={() => handleApprove(r.id, 'approve')}>Approve</button>
                        <button className="btn btn-danger btn-sm" disabled={approving === r.id} onClick={() => handleApprove(r.id, 'reject')}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && records.length === 0 && (
          <EmptyState title="No overtime records" description="Record employee overtime" action={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>Add Overtime</button>} />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <div className="data-cards">
        {loading ? <LoadingCards count={4} /> : records.map(r => (
          <div key={r.id} className="data-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div className="data-card-title">{r.employee_name}</div>
                <div className="text-sm text-muted">{fmtDate(r.date)}</div>
              </div>
              <StatusBadge status={r.approval_status} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div style={{ textAlign: 'center', background: 'var(--color-bg)', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Regular</div>
                <div style={{ fontWeight: 700 }}>{r.regular_hours}h</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--color-accent-light)', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--color-accent)' }}>Overtime</div>
                <div style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{r.overtime_hours}h</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--color-success-light)', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--color-success)' }}>Amount</div>
                <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: 13 }}>{fmtCurrency(r.overtime_amount)}</div>
              </div>
            </div>
            {canApprove && r.approval_status === 'pending' && (
              <div className="data-card-actions">
                <button className="btn btn-success btn-sm" style={{ flex: 1 }} disabled={approving === r.id} onClick={() => handleApprove(r.id, 'approve')}>Approve</button>
                <button className="btn btn-danger btn-sm" style={{ flex: 1 }} disabled={approving === r.id} onClick={() => handleApprove(r.id, 'reject')}>Reject</button>
              </div>
            )}
          </div>
        ))}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Overtime"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>}>
        <div className="form-group">
          <label className="form-label">Employee <span className="required">*</span></label>
          <select className="form-control" value={form.employee_id} onChange={e => {
            const emp = employees.find(em => em.id === parseInt(e.target.value));
            set('employee_id', e.target.value);
            if (emp?.overtime_rate) set('overtime_rate', emp.overtime_rate);
          }}>
            <option value="">Select employee…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date <span className="required">*</span></label>
            <input className="form-control" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Regular Hours</label>
            <input className="form-control" type="number" step="0.5" value={form.regular_hours} onChange={e => set('regular_hours', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Overtime Hours <span className="required">*</span></label>
            <input className="form-control" type="number" step="0.5" value={form.overtime_hours} onChange={e => set('overtime_hours', e.target.value)} placeholder="Hours worked OT" />
          </div>
          <div className="form-group">
            <label className="form-label">OT Rate (₹/hr)</label>
            <input className="form-control" type="number" value={form.overtime_rate} onChange={e => set('overtime_rate', e.target.value)} placeholder="Auto from employee" />
          </div>
        </div>
        {form.overtime_hours && form.overtime_rate && (
          <div className="info-box">
            OT Amount: <strong>{fmtCurrency(parseFloat(form.overtime_hours || 0) * parseFloat(form.overtime_rate || 0))}</strong>
          </div>
        )}
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Notes</label>
          <input className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional reason" />
        </div>
      </Modal>
    </div>
  );
}
