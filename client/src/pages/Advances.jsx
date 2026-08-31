import { useState, useEffect, useCallback } from 'react';
import { advancesApi, employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingCards, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, today } from '../utils/helpers.js';

export default function AdvancesPage() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employee_id: '', amount: '', advance_date: today(), reason: '', repayment_months: 1, notes: '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('salary', 'can_create');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await advancesApi.list(params);
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
    if (!form.employee_id || !form.amount || !form.advance_date) { toast.error('Employee, amount, and date required'); return; }
    setSaving(true);
    try {
      await advancesApi.create({ ...form, amount: parseFloat(form.amount), repayment_months: parseInt(form.repayment_months) || 1 });
      toast.success('Advance recorded');
      setShowModal(false);
      setForm({ employee_id: '', amount: '', advance_date: today(), reason: '', repayment_months: 1, notes: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <PageHeader
        title="Salary Advances"
        subtitle={`${total} records`}
        actions={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>+ New Advance</button>}
      />

      <div className="toolbar">
        <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="partially_repaid">Partial</option>
          <option value="fully_repaid">Repaid</option>
          <option value="written_off">Written Off</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Repaid</th>
              <th>Remaining</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="skeleton skeleton-line" /></td>)}</tr>)
              : records.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.employee_name}</td>
                  <td>{fmtDate(r.advance_date)}</td>
                  <td>{fmtCurrency(r.amount)}</td>
                  <td style={{ color: 'var(--color-success)' }}>{fmtCurrency(r.repaid_amount)}</td>
                  <td style={{ fontWeight: 700, color: r.remaining_balance > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                    {fmtCurrency(r.remaining_balance)}
                  </td>
                  <td className="text-muted">{r.reason || '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && records.length === 0 && (
          <EmptyState title="No advance records" description="Record salary advances given to employees" action={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>New Advance</button>} />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <div className="data-cards">
        {loading ? <LoadingCards count={4} /> : records.map(r => (
          <div key={r.id} className="data-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div className="data-card-title">{r.employee_name}</div>
                <div className="text-sm text-muted">{fmtDate(r.advance_date)}</div>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="data-card-row"><span className="data-card-label">Amount</span><span className="font-semibold">{fmtCurrency(r.amount)}</span></div>
            <div className="data-card-row"><span className="data-card-label">Repaid</span><span className="text-success">{fmtCurrency(r.repaid_amount)}</span></div>
            <div className="data-card-row">
              <span className="data-card-label">Remaining</span>
              <span style={{ fontWeight: 700, color: r.remaining_balance > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {fmtCurrency(r.remaining_balance)}
              </span>
            </div>
            {r.reason && <div className="data-card-row"><span className="data-card-label">Reason</span><span>{r.reason}</span></div>}
          </div>
        ))}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Salary Advance"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Record Advance'}</button>
        </>}>
        <div className="form-group">
          <label className="form-label">Employee <span className="required">*</span></label>
          <select className="form-control" value={form.employee_id} onChange={e => set('employee_id', e.target.value)}>
            <option value="">Select employee…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Amount (₹) <span className="required">*</span></label>
            <input className="form-control" type="number" inputMode="numeric" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Date <span className="required">*</span></label>
            <input className="form-control" type="date" value={form.advance_date} onChange={e => set('advance_date', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Reason</label>
          <input className="form-control" value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="e.g. Medical emergency" />
        </div>
        <div className="form-group">
          <label className="form-label">Repayment Period (months)</label>
          <input className="form-control" type="number" min="1" max="24" value={form.repayment_months} onChange={e => set('repayment_months', e.target.value)} />
          <div className="form-hint">Advance will be deducted from salary over this period</div>
        </div>
      </Modal>
    </div>
  );
}
