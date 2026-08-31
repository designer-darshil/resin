import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { purchasesApi, customersApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingRows, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, fmtQty, debounce, today } from '../utils/helpers.js';

const EMPTY_ITEM = {
  diamond_type: '',
  shape: 'Round',
  size: '',
  color: '',
  clarity: '',
  quantity: '',
  weight: '',
  rate: '',
  notes: ''
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ supplier_id: '', purchase_date: today(), invoice_number: '', notes: '' });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('purchases', 'can_create');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await purchasesApi.list(params);
      setPurchases(res.data);
      setTotal(res.total);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const loadSuppliers = async () => {
    try {
      const all = await customersApi.list({ limit: 200 });
      setSuppliers(all.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenModal = () => {
    loadSuppliers();
    setForm({ supplier_id: '', purchase_date: today(), invoice_number: '', notes: '' });
    setItems([{ ...EMPTY_ITEM }]);
    setShowModal(true);
  };

  const debouncedSearch = useCallback(debounce(v => { setSearch(v); setPage(1); }, 350), []);

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const setItem = (i, k, v) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const calcTotal = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    return qty * rate;
  };

  const grandTotal = items.reduce((sum, item) => sum + calcTotal(item), 0);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.supplier_id || !form.purchase_date) { toast.error('Supplier and date are required'); return; }
    if (items.some(item => !item.quantity || parseFloat(item.quantity) <= 0)) {
      toast.error('All items must have a valid quantity'); return;
    }
    setSaving(true);
    try {
      const processedItems = items.map(item => ({
        ...item,
        quantity: parseFloat(item.quantity) || 0,
        weight: parseFloat(item.weight) || 0,
        rate: parseFloat(item.rate) || 0,
        total_amount: calcTotal(item),
      }));
      await purchasesApi.create({ ...form, items: processedItems });
      toast.success('Purchase order created successfully');
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="page">
      <PageHeader
        title="Raw Diamond Purchases"
        subtitle="Track incoming diamond supply, receiving stock, and vendor bills"
        actions={canCreate && (
          <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
            + New Purchase
          </button>
        )}
      />

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search purchase code, supplier, invoice…"
            onChange={e => debouncedSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="expected">Expected / In Transit</option>
          <option value="received">Fully Received</option>
          <option value="partial_received">Partially Received</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Purchase Code</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Invoice #</th>
              <th className="num-col">Items</th>
              <th className="num-col">Total Amount</th>
              <th>Status</th>
              <th className="action-col">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={8} rows={6} />
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title="No purchases recorded"
                    description="Record diamond shipments from vendors to update raw stock inventory."
                    action={canCreate && (
                      <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
                        + New Purchase
                      </button>
                    )}
                  />
                </td>
              </tr>
            ) : (
              purchases.map(p => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/purchases/${p.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {p.purchase_code}
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.supplier_name}</td>
                  <td>{fmtDate(p.purchase_date)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.invoice_number || '—'}</td>
                  <td className="num-col">{p.item_count || 1}</td>
                  <td className="num-col" style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {fmtCurrency(p.total_amount)}
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="action-col" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/purchases/${p.id}`)}
                    >
                      View Details →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="mobile-card-list">
        {purchases.map(p => (
          <div key={p.id} className="mobile-card" onClick={() => navigate(`/purchases/${p.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-accent" style={{ marginBottom: 4 }}>{p.purchase_code}</span>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.supplier_name}</div>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              <span>{fmtDate(p.purchase_date)}</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {fmtCurrency(p.total_amount)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />

      {/* Structured New Purchase Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Record New Diamond Purchase"
        size="large"
        footer={
          <>
            <div style={{ marginRight: 'auto', fontSize: 13 }}>
              Total Order Amount: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>{fmtCurrency(grandTotal)}</strong>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Save Purchase Order'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          {/* Section 1: Supplier & Dates */}
          <div className="form-section-title" style={{ marginTop: 0 }}>1. Supplier & Purchase Info</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Diamond Supplier *</label>
              <select
                className="form-control"
                value={form.supplier_id}
                onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                required
              >
                <option value="">-- Select Registered Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.company_name} ({s.party_code})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Purchase Date *</label>
              <input
                className="form-control"
                type="date"
                value={form.purchase_date}
                onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vendor Invoice Number</label>
              <input
                className="form-control"
                placeholder="e.g. INV-8842"
                value={form.invoice_number}
                onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
              />
            </div>
          </div>

          {/* Section 2: Diamond Items & Specifications */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 8px' }}>
            <div className="form-section-title" style={{ margin: 0, border: 'none' }}>2. Diamond Specifications & Quantities</div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
              + Add Item Row
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="panel-subtle" style={{ marginBottom: 12, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Item #{idx + 1}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeItem(idx)}
                    style={{ color: 'var(--status-error)', padding: '0 6px', height: 24 }}
                  >
                    ✕ Remove
                  </button>
                )}
              </div>

              <div className="form-row" style={{ marginBottom: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Diamond Type</label>
                  <input
                    className="form-control"
                    placeholder="e.g. CVD 2.0mm"
                    value={item.diamond_type}
                    onChange={e => setItem(idx, 'diamond_type', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Shape</label>
                  <select
                    className="form-control"
                    value={item.shape}
                    onChange={e => setItem(idx, 'shape', e.target.value)}
                  >
                    <option value="Round">Round</option>
                    <option value="Princess">Princess</option>
                    <option value="Oval">Oval</option>
                    <option value="Marquise">Marquise</option>
                    <option value="Cushion">Cushion</option>
                    <option value="Emerald">Emerald</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Size / Sieve</label>
                  <input
                    className="form-control"
                    placeholder="e.g. +2 -6"
                    value={item.size}
                    onChange={e => setItem(idx, 'size', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quantity (pcs) *</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="100"
                    value={item.quantity}
                    onChange={e => setItem(idx, 'quantity', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Weight (carats)</label>
                  <input
                    className="form-control"
                    type="number"
                    step="0.001"
                    placeholder="0.00"
                    value={item.weight}
                    onChange={e => setItem(idx, 'weight', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Rate / pc (₹)</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="Rate"
                    value={item.rate}
                    onChange={e => setItem(idx, 'rate', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Section 3: Notes */}
          <div className="form-section-title">3. Notes & Remarks</div>
          <div className="form-group">
            <textarea
              className="form-textarea"
              placeholder="Additional shipment instructions or diamond grading notes..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
