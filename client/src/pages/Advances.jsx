import { useState, useEffect, useCallback } from 'react';
import { advancesApi, employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingRows, Pagination, Modal, EmptyState } from '../components/ui.jsx';
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
    try {
      const res = await employeesApi.list({ status: 'active', limit: 200 });
      setEmployees(res.data || []);
      setShowModal(true);
    } catch (err) {
      toast.error('Failed to load employee list');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.amount || !form.advance_date) {
      toast.error('Employee, amount, and date required'); return;
    }
    setSaving(true);
    try {
      await advancesApi.create({
        ...form,
        amount: parseFloat(form.amount),
        repayment_months: parseInt(form.repayment_months) || 1
      });
      toast.success('Salary advance recorded');
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
        title="Salary Advances &amp; Loans"
        subtitle="Manage employee wage advance requests and monthly payroll deduction schedules"
        actions={canCreate && (
          <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
            + Issue Advance
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
          <option value="">All Advance Statuses</option>
          <option value="active">Active (Repayment Pending)</option>
          <option value="partially_repaid">Partially Repaid</option>
          <option value="fully_repaid">Fully Settled</option>
          <option value="written_off">Written Off</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Issue Date</th>
              <th className="num-col">Advance Amount</th>
              <th className="num-col">Repaid Amount</th>
              <th className="num-col">Remaining Balance</th>
              <th>Repayment Plan</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={8} rows={6} />
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title="No salary advance records"
                    description="Issue salary advances to operators to automatically deduct from upcoming payroll."
                    action={canCreate && (
                      <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
                        + Issue Advance
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
                  <td>{fmtDate(r.advance_date)}</td>
                  <td className="num-col" style={{ fontWeight: 600 }}>{fmtCurrency(r.amount)}</td>
                  <td className="num-col" style={{ color: 'var(--status-success)' }}>{fmtCurrency(r.repaid_amount)}</td>
                  <td className="num-col" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.remaining_balance > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                    {fmtCurrency(r.remaining_balance)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{r.repayment_months || 1} Month(s)</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{r.reason || '—'}</td>
                  <td>
                    <StatusBadge status={r.status || 'active'} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />

      {/* Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Issue Salary Advance"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Confirm &amp; Issue Advance'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Employee *</label>
            <select
              className="form-control"
              value={form.employee_id}
              onChange={e => set('employee_id', e.target.value)}
              required
              autoFocus
            >
              <option value="">-- Select Active Employee --</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Advance Amount (₹) *</label>
              <input
                className="form-control"
                type="number"
                placeholder="e.g. 5000"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Disbursement Date *</label>
              <input
                className="form-control"
                type="date"
                value={form.advance_date}
                onChange={e => set('advance_date', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Deduction Term (Months)</label>
              <select
                className="form-control"
                value={form.repayment_months}
                onChange={e => set('repayment_months', e.target.value)}
              >
                <option value={1}>1 Month (Next Payroll)</option>
                <option value={2}>2 Months Installment</option>
                <option value={3}>3 Months Installment</option>
                <option value={6}>6 Months Installment</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Advance Purpose / Reason</label>
              <input
                className="form-control"
                placeholder="e.g. Medical emergency"
                value={form.reason}
                onChange={e => set('reason', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Internal Remarks</label>
            <textarea
              className="form-textarea"
              placeholder="Approval notes..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
