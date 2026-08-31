import { useState, useEffect, useCallback } from 'react';
import { salaryApi, employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingRows, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtCurrency, monthName } from '../utils/helpers.js';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: monthName(i + 1) }));
const currentYear = new Date().getFullYear();

export default function SalaryPage() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    employee_id: '', period_month: new Date().getMonth() + 1, period_year: currentYear,
    bonus: '', other_deductions: '', adjustments: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
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
    if (!form.employee_id || !form.period_month || !form.period_year) {
      toast.error('Employee, month, year required'); return;
    }
    setSaving(true);
    try {
      await salaryApi.create({
        ...form,
        period_month: parseInt(form.period_month),
        period_year: parseInt(form.period_year),
        bonus: parseFloat(form.bonus) || 0,
        other_deductions: parseFloat(form.other_deductions) || 0,
        adjustments: parseFloat(form.adjustments) || 0
      });
      toast.success('Salary record generated');
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const markPaid = async (record) => {
    try {
      await salaryApi.update(record.id, {
        payment_status: 'paid',
        payment_date: new Date().toISOString().split('T')[0]
      });
      toast.success(`Salary marked as paid for ${record.employee_name}`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalPayroll = records.reduce((sum, r) => sum + (r.net_payable || 0), 0);
  const totalPaid = records.filter(r => r.payment_status === 'paid').reduce((sum, r) => sum + (r.net_payable || 0), 0);
  const totalPending = totalPayroll - totalPaid;

  return (
    <div className="page">
      <PageHeader
        title="Monthly Payroll &amp; Salaries"
        subtitle="Compute monthly base wages, approved overtime, advance deductions, and net payouts"
        actions={canCreate && (
          <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
            + Generate Salary Record
          </button>
        )}
      />

      {/* Snapshot Summary Strip */}
      <div className="stat-strip">
        <div className="stat-strip-item">
          <div className="stat-strip-label">Payroll Period</div>
          <div className="stat-strip-value" style={{ fontSize: 18 }}>
            {monthFilter ? monthName(parseInt(monthFilter)) : 'All Months'} {yearFilter}
          </div>
          <div className="stat-strip-sub">{records.length} salary slips</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Total Net Payable</div>
          <div className="stat-strip-value" style={{ color: 'var(--color-primary)' }}>
            {fmtCurrency(totalPayroll)}
          </div>
          <div className="stat-strip-sub">Computed gross minus deductions</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Settled / Paid</div>
          <div className="stat-strip-value" style={{ color: 'var(--status-success)' }}>
            {fmtCurrency(totalPaid)}
          </div>
          <div className="stat-strip-sub">Paid out wages</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Pending Disbursement</div>
          <div className="stat-strip-value" style={{ color: totalPending > 0 ? 'var(--status-warning)' : 'inherit' }}>
            {fmtCurrency(totalPending)}
          </div>
          <div className="stat-strip-sub">Due for transfer</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <select
          className="filter-select"
          value={monthFilter}
          onChange={e => { setMonthFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Months</option>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select
          className="filter-select"
          value={yearFilter}
          onChange={e => { setYearFilter(e.target.value); setPage(1); }}
        >
          {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Payout Statuses</option>
          <option value="pending">Pending Settlement</option>
          <option value="paid">Settled / Paid</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Period</th>
              <th className="num-col">Base Salary</th>
              <th className="num-col">Overtime</th>
              <th className="num-col">Bonus / Allow</th>
              <th className="num-col">Advance Ded.</th>
              <th className="num-col">Other Ded.</th>
              <th className="num-col">Net Payable</th>
              <th>Status</th>
              <th className="action-col">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={10} rows={6} />
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <EmptyState
                    title="No salary slips for this period"
                    description="Generate salary statements for active employees to compute monthly wages."
                    action={canCreate && (
                      <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
                        + Generate Salary Record
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
                  <td>{monthName(r.period_month)} {r.period_year}</td>
                  <td className="num-col">{fmtCurrency(r.base_salary)}</td>
                  <td className="num-col" style={{ color: r.overtime_amount > 0 ? 'var(--color-primary)' : 'inherit' }}>
                    {fmtCurrency(r.overtime_amount)}
                  </td>
                  <td className="num-col">{fmtCurrency(r.bonus)}</td>
                  <td className="num-col" style={{ color: r.advance_deducted > 0 ? 'var(--status-error)' : 'inherit' }}>
                    {r.advance_deducted > 0 ? `-${fmtCurrency(r.advance_deducted)}` : '₹0'}
                  </td>
                  <td className="num-col" style={{ color: r.other_deductions > 0 ? 'var(--status-error)' : 'inherit' }}>
                    {r.other_deductions > 0 ? `-${fmtCurrency(r.other_deductions)}` : '₹0'}
                  </td>
                  <td className="num-col" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--status-success)' }}>
                    {fmtCurrency(r.net_payable)}
                  </td>
                  <td>
                    <StatusBadge status={r.payment_status} />
                  </td>
                  <td className="action-col">
                    {r.payment_status !== 'paid' ? (
                      <button
                        className="btn btn-success btn-sm"
                        style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                        onClick={() => markPaid(r)}
                      >
                        ✓ Mark Paid
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--status-success)', fontWeight: 600 }}>
                        Settled
                      </span>
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
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{monthName(r.period_month)} {r.period_year}</div>
              </div>
              <StatusBadge status={r.payment_status} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
              <span>Base: {fmtCurrency(r.base_salary)} | OT: {fmtCurrency(r.overtime_amount)}</span>
              <span style={{ fontWeight: 700, color: 'var(--status-success)', fontFamily: 'var(--font-mono)' }}>
                {fmtCurrency(r.net_payable)}
              </span>
            </div>
            {r.payment_status !== 'paid' && (
              <button className="btn btn-success btn-sm" style={{ marginTop: 8 }} onClick={() => markPaid(r)}>
                ✓ Mark Paid
              </button>
            )}
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />

      {/* Generate Salary Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Generate Employee Salary Record"
        size="large"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Processing…' : 'Generate &amp; Save Salary'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-section-title" style={{ marginTop: 0 }}>1. Employee &amp; Period</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Employee *</label>
              <select
                className="form-control"
                value={form.employee_id}
                onChange={e => set('employee_id', e.target.value)}
                required
                autoFocus
              >
                <option value="">-- Select Employee --</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Month *</label>
              <select
                className="form-control"
                value={form.period_month}
                onChange={e => set('period_month', e.target.value)}
                required
              >
                {MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Year *</label>
              <select
                className="form-control"
                value={form.period_year}
                onChange={e => set('period_year', e.target.value)}
                required
              >
                {[currentYear, currentYear - 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section-title">2. Adjustments &amp; Bonus</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Performance Bonus (₹)</label>
              <input
                className="form-control"
                type="number"
                placeholder="0"
                value={form.bonus}
                onChange={e => set('bonus', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Other Deductions (₹)</label>
              <input
                className="form-control"
                type="number"
                placeholder="0"
                value={form.other_deductions}
                onChange={e => set('other_deductions', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Manual Adjustments (₹)</label>
              <input
                className="form-control"
                type="number"
                placeholder="0"
                value={form.adjustments}
                onChange={e => set('adjustments', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payroll Notes</label>
            <textarea
              className="form-textarea"
              placeholder="Remarks for payslip..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
