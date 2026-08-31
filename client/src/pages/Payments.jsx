import { useState, useEffect, useCallback } from 'react';
import { paymentsApi, customersApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, LoadingCards, Pagination, Modal, EmptyState } from '../components/ui.jsx';
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
    payment_method: 'cash', reference_number: '', notes: '', payment_type: 'customer_payment'
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
    const res = await customersApi.list({ limit: 200 });
    setCustomers(res.data);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.payment_date) { toast.error('Amount and date required'); return; }
    setSaving(true);
    try {
      await paymentsApi.create({ ...form, amount: parseFloat(form.amount) });
      toast.success('Payment recorded');
      setShowModal(false);
      setForm({ customer_id: '', amount: '', payment_date: today(), payment_direction: 'received', payment_method: 'cash', reference_number: '', notes: '', payment_type: 'customer_payment' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Calculate totals from current page
  const totalReceived = records.filter(r => r.payment_direction === 'received').reduce((sum, r) => sum + r.amount, 0);
  const totalPaid = records.filter(r => r.payment_direction === 'paid').reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="page">
      <PageHeader
        title="Payments"
        subtitle={`${total} records`}
        actions={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>+ Record Payment</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="stat-card success">
          <div className="stat-card-label">Received (this page)</div>
          <div className="stat-card-value" style={{ fontSize: 20 }}>{fmtCurrency(totalReceived)}</div>
        </div>
        <div className="stat-card error">
          <div className="stat-card-label">Paid Out (this page)</div>
          <div className="stat-card-value" style={{ fontSize: 20 }}>{fmtCurrency(totalPaid)}</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" placeholder="Search customer, reference…" onChange={e => debouncedSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={directionFilter} onChange={e => { setDirectionFilter(e.target.value); setPage(1); }}>
          <option value="">All Payments</option>
          <option value="received">Received</option>
          <option value="paid">Paid Out</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Direction</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton skeleton-line" /></td>)}</tr>)
              : records.map(r => (
                <tr key={r.id}>
                  <td><span className="tag">{r.payment_code}</span></td>
                  <td>
                    <span className={`badge ${r.payment_direction === 'received' ? 'badge-success' : 'badge-error'}`}>
                      {r.payment_direction === 'received' ? '↓ Received' : '↑ Paid'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{r.customer_name || '—'}</td>
                  <td style={{ fontWeight: 700, color: r.payment_direction === 'received' ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {r.payment_direction === 'received' ? '+' : '-'}{fmtCurrency(r.amount)}
                  </td>
                  <td>{fmtDate(r.payment_date)}</td>
                  <td className="text-sm">{r.payment_method}</td>
                  <td className="text-muted text-sm">{r.reference_number || '—'}</td>
                  <td className="text-muted text-sm">{r.notes || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && records.length === 0 && (
          <EmptyState title="No payments" description="Record incoming or outgoing payments" action={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>Record Payment</button>} />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <div className="data-cards">
        {loading ? <LoadingCards count={4} /> : records.map(r => (
          <div key={r.id} className="data-card" style={{ borderLeft: `3px solid ${r.payment_direction === 'received' ? 'var(--color-success)' : 'var(--color-error)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div className="data-card-title">{r.customer_name || 'No customer'}</div>
                <div className="text-sm text-muted">{r.payment_code}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: r.payment_direction === 'received' ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {r.payment_direction === 'received' ? '+' : '-'}{fmtCurrency(r.amount)}
                </div>
                <div className="text-xs text-muted">{r.payment_direction}</div>
              </div>
            </div>
            <div className="data-card-row"><span className="data-card-label">Date</span><span>{fmtDate(r.payment_date)}</span></div>
            <div className="data-card-row"><span className="data-card-label">Method</span><span className="text-capitalize">{r.payment_method}</span></div>
            {r.reference_number && <div className="data-card-row"><span className="data-card-label">Ref</span><span>{r.reference_number}</span></div>}
          </div>
        ))}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Record Payment"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Payment'}</button>
        </>}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Direction</label>
            <select className="form-control" value={form.payment_direction} onChange={e => set('payment_direction', e.target.value)}>
              <option value="received">💰 Received from Customer</option>
              <option value="paid">💸 Paid to Supplier</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Customer / Party</label>
            <select className="form-control" value={form.customer_id} onChange={e => set('customer_id', e.target.value)}>
              <option value="">No party / direct</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Amount (₹) <span className="required">*</span></label>
            <input className="form-control" type="number" inputMode="numeric" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Date <span className="required">*</span></label>
            <input className="form-control" type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Method</label>
            <select className="form-control" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Reference Number</label>
            <input className="form-control" value={form.reference_number} onChange={e => set('reference_number', e.target.value)} placeholder="UTR / Ref / Cheque No." />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-control" rows="2" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
