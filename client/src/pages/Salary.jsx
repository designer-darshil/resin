import { useState, useEffect, useCallback } from 'react';
import { salaryApi, employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingCards, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtCurrency, monthName } from '../utils/helpers.js';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: monthName(i + 1) }));
const currentYear = new Date().getFullYear();

export default function SalaryPage() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employee_id: '', period_month: new Date().getMonth() + 1, period_year: currentYear, bonus: '', other_deductions: '', adjustments: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('salary', 'can_create');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (statusFilter) params.status = statusFilter;
      if (monthFilter) params.month = monthFilter;
      if (yearFilter) params.year = yearFilter;
      const res = await salaryApi.list(params);
      setRecords(res.data);
      setTotal(res.total);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [page, statusFilter, monthFilter, yearFilter]);

  useEffect(() => { load(); }, [load]);

  const handleOpenModal = async () => {
    const res = await employeesApi.list({ status: 'active', limit: 200 });
    setEmployees(res.data);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.period_month || !form.period_year) { toast.error('Employee, month, year required'); return; }
    setSaving(true);
    try {
      await salaryApi.create({ ...form, period_month: parseInt(form.period_month), period_year: parseInt(form.period_year), bonus: parseFloat(form.bonus) || 0, other_deductions: parseFloat(form.other_deductions) || 0, adjustments: parseFloat(form.adjustments) || 0 });
      toast.success('Salary record generated');
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const markPaid = async (record) => {
    try {
      await salaryApi.update(record.id, { payment_status: 'paid', payment_date: new Date().toISOString().split('T')[0] });
      toast.success('Marked as paid');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <PageHeader
        title="Salary"
        subtitle={`${total} records`}
        actions={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>+ Generate Salary</button>}
      />

      <div className="toolbar">
        <select className="filter-select" value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setPage(1); }}>
          <option value="">All Months</option>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select className="filter-select" value={yearFilter} onChange={e => { setYearFilter(e.target.value); setPage(1); }}>
          {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Period</th>
              <th>Base</th>
              <th>OT</th>
              <th>Bonus</th>
              <th>Advance</th>
              <th>Deductions</th>
              <th>Net Payable</th>
              <th>Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 10 }).map((_, j) => <td key={j}><div className="skeleton skeleton-line" /></td>)}</tr>)
              : records.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.employee_name}</td>
                  <td>{monthName(r.period_month)} {r.period_year}</td>
                  <td>{fmtCurrency(r.base_salary)}</td>
                  <td>{fmtCurrency(r.overtime_amount)}</td>
                  <td>{fmtCurrency(r.bonus)}</td>
                  <td style={{ color: 'var(--color-error)' }}>-{fmtCurrency(r.advance_deducted)}</td>
                  <td style={{ color: 'var(--color-error)' }}>-{fmtCurrency(r.other_deductions)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>{fmtCurrency(r.net_payable)}</td>
                  <td><StatusBadge status={r.payment_status} /></td>
                  <td className="col-actions">
                    {r.payment_status !== 'paid' && (
                      <button className="btn btn-success btn-sm" onClick={() => markPaid(r)}>Mark Paid</button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && records.length === 0 && (
          <EmptyState title="No salary records" description="Generate salary slips for employees" action={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>Generate Salary</button>} />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <div className="data-cards">
        {loading ? <LoadingCards count={4} /> : records.map(r => (
          <div key={r.id} className="data-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div className="data-card-title">{r.employee_name}</div>
                <div className="text-sm text-muted">{monthName(r.period_month)} {r.period_year}</div>
              </div>
              <div>
                <StatusBadge status={r.payment_status} />
              </div>
            </div>
            <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div className="data-card-row"><span className="data-card-label">Base Salary</span><span>{fmtCurrency(r.base_salary)}</span></div>
              <div className="data-card-row"><span className="data-card-label">+ Overtime</span><span className="text-success">+{fmtCurrency(r.overtime_amount)}</span></div>
              <div className="data-card-row"><span className="data-card-label">+ Bonus</span><span className="text-success">+{fmtCurrency(r.bonus)}</span></div>
              <div className="data-card-row"><span className="data-card-label">- Advance</span><span className="text-error">-{fmtCurrency(r.advance_deducted)}</span></div>
              <div className="data-card-row"><span className="data-card-label">- Deductions</span><span className="text-error">-{fmtCurrency(r.other_deductions)}</span></div>
              <hr className="divider" style={{ margin: '8px 0' }} />
              <div className="data-card-row">
                <span style={{ fontWeight: 700 }}>Net Payable</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-success)' }}>{fmtCurrency(r.net_payable)}</span>
              </div>
            </div>
            {r.payment_status !== 'paid' && (
              <div className="data-card-actions">
                <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => markPaid(r)}>Mark as Paid</button>
              </div>
            )}
          </div>
        ))}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Generate Salary Slip"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Generating…' : 'Generate'}</button>
        </>}>
        <div className="info-box" style={{ marginBottom: 16 }}>
          Overtime and advances will be auto-calculated from records for the selected period.
        </div>
        <div className="form-group">
          <label className="form-label">Employee <span className="required">*</span></label>
          <select className="form-control" value={form.employee_id} onChange={e => set('employee_id', e.target.value)}>
            <option value="">Select employee…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} — {fmtCurrency(e.base_salary)}/{e.salary_type}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Month <span className="required">*</span></label>
            <select className="form-control" value={form.period_month} onChange={e => set('period_month', e.target.value)}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Year <span className="required">*</span></label>
            <select className="form-control" value={form.period_year} onChange={e => set('period_year', e.target.value)}>
              {[currentYear, currentYear - 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">Bonus (₹)</label>
            <input className="form-control" type="number" value={form.bonus} onChange={e => set('bonus', e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Other Deductions (₹)</label>
            <input className="form-control" type="number" value={form.other_deductions} onChange={e => set('other_deductions', e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Adjustments (₹)</label>
            <input className="form-control" type="number" value={form.adjustments} onChange={e => set('adjustments', e.target.value)} placeholder="0 (+ or -)" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" />
        </div>
      </Modal>
    </div>
  );
}
