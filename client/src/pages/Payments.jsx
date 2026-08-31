import { useState, useEffect, useCallback } from 'react';
import { paymentsApi, customersApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingRows, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, today, debounce } from '../utils/helpers.js';

export default function PaymentsPage() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    customer_id: '', amount: '', payment_date: today(), payment_direction: 'received',
    payment_method: 'bank', reference_number: '', notes: '', payment_type: 'customer_payment'
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('payments', 'can_create');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (directionFilter) params.direction = directionFilter;
      const res = await paymentsApi.list(params);
      setRecords(res.data);
      setTotal(res.total);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [page, search, directionFilter]);

  useEffect(() => { load(); }, [load]);
  const debouncedSearch = useCallback(debounce(v => { setSearch(v); setPage(1); }, 350), []);

  const handleOpenModal = async () => {
    try {
      const res = await customersApi.list({ limit: 200 });
      setCustomers(res.data || []);
      setShowModal(true);
    } catch (err) {
      toast.error('Failed to load parties list');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.payment_date) { toast.error('Amount and date required'); return; }
    setSaving(true);
    try {
      await paymentsApi.create({ ...form, amount: parseFloat(form.amount) });
      toast.success('Payment transaction recorded');
      setShowModal(false);
      setForm({
        customer_id: '', amount: '', payment_date: today(), payment_direction: 'received',
        payment_method: 'bank', reference_number: '', notes: '', payment_type: 'customer_payment'
      });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalReceived = records.filter(r => r.payment_direction === 'received').reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalPaid = records.filter(r => r.payment_direction === 'paid').reduce((sum, r) => sum + (r.amount || 0), 0);
  const netCashflow = totalReceived - totalPaid;

  return (
    <div className="page">
      <PageHeader
        title="Payments &amp; Financial Ledger"
        subtitle="Record buyer settlements, supplier disbursements, and bank transaction references"
        actions={canCreate && (
          <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
            + Record Transaction
          </button>
        )}
      />

      {/* Snapshot Summary Strip */}
      <div className="stat-strip">
        <div className="stat-strip-item">
          <div className="stat-strip-label">Total Inflow (Received)</div>
          <div className="stat-strip-value" style={{ color: 'var(--status-success)' }}>
            {fmtCurrency(totalReceived)}
          </div>
          <div className="stat-strip-sub">Customer collections (page)</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Total Outflow (Paid)</div>
          <div className="stat-strip-value" style={{ color: 'var(--status-error)' }}>
            {fmtCurrency(totalPaid)}
          </div>
          <div className="stat-strip-sub">Supplier payouts (page)</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Net Inward Cashflow</div>
          <div className="stat-strip-value" style={{ color: netCashflow >= 0 ? 'var(--status-success)' : 'var(--status-error)' }}>
            {fmtCurrency(netCashflow)}
          </div>
          <div className="stat-strip-sub">Page ledger net balance</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Total Transactions</div>
          <div className="stat-strip-value">{total}</div>
          <div className="stat-strip-sub">Ledger records</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search party name, reference, UTR, code…"
            onChange={e => debouncedSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={directionFilter}
          onChange={e => { setDirectionFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Flow Directions</option>
          <option value="received">Received (Inflow)</option>
          <option value="paid">Paid Out (Outflow)</option>
        </select>
      </div>

      {/* Master Payment Ledger Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Direction</th>
              <th>Party / Company</th>
              <th>Reference / Voucher</th>
              <th>Payment Method</th>
              <th className="num-col">Transaction Amount</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={7} rows={6} />
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title="No financial transactions recorded"
                    description="Record incoming party payments or outgoing vendor payouts."
                    action={canCreate && (
                      <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
                        + Record Transaction
                      </button>
                    )}
                  />
                </td>
              </tr>
            ) : (
              records.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(r.payment_date)}</td>
                  <td>
                    <span className={`badge ${r.payment_direction === 'received' ? 'badge-success' : 'badge-error'}`}>
                      {r.payment_direction === 'received' ? '↓ Inflow' : '↑ Outflow'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.customer_name || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                    {r.reference_number || r.payment_code || '—'}
                  </td>
                  <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                    {r.payment_method}
                  </td>
                  <td className="num-col" style={{
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: r.payment_direction === 'received' ? 'var(--status-success)' : 'var(--status-error)'
                  }}>
                    {r.payment_direction === 'received' ? '+' : '-'}{fmtCurrency(r.amount)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.notes || '—'}
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
                <span className={`badge ${r.payment_direction === 'received' ? 'badge-success' : 'badge-error'}`} style={{ marginBottom: 4 }}>
                  {r.payment_direction === 'received' ? 'Inflow' : 'Outflow'}
                </span>
                <div style={{ fontWeight: 700 }}>{r.customer_name || '—'}</div>
              </div>
              <div style={{
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                fontSize: 15,
                color: r.payment_direction === 'received' ? 'var(--status-success)' : 'var(--status-error)'
              }}>
                {r.payment_direction === 'received' ? '+' : '-'}{fmtCurrency(r.amount)}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              <span>{fmtDate(r.payment_date)} · {r.payment_method}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{r.reference_number || '—'}</span>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />

      {/* Record Payment Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Record Financial Transaction"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Record Transaction'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Transaction Flow Direction *</label>
            <select
              className="form-control"
              value={form.payment_direction}
              onChange={e => set('payment_direction', e.target.value)}
              required
            >
              <option value="received">Inflow — Received from Customer / Buyer</option>
              <option value="paid">Outflow — Paid to Diamond Supplier / Vendor</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Associated Party</label>
            <select
              className="form-control"
              value={form.customer_id}
              onChange={e => set('customer_id', e.target.value)}
            >
              <option value="">-- Select Registered Party --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.company_name} ({c.party_code})</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Transaction Amount (₹) *</label>
              <input
                className="form-control"
                type="number"
                placeholder="e.g. 50000"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Date *</label>
              <input
                className="form-control"
                type="date"
                value={form.payment_date}
                onChange={e => set('payment_date', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select
                className="form-control"
                value={form.payment_method}
                onChange={e => set('payment_method', e.target.value)}
              >
                <option value="bank">Bank Transfer / NEFT / RTGS</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reference / UTR / Cheque #</label>
              <input
                className="form-control"
                placeholder="e.g. UTR-88492019"
                value={form.reference_number}
                onChange={e => set('reference_number', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ledger Remarks</label>
            <textarea
              className="form-textarea"
              placeholder="Invoice settlement notes, voucher remarks..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
