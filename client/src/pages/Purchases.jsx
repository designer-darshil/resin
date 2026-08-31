import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { purchasesApi, customersApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingRows, LoadingCards, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, fmtQty, debounce, today } from '../utils/helpers.js';

const EMPTY_ITEM = { diamond_type: '', shape: 'Round', size: '', color: '', clarity: '', quantity: '', weight: '', rate: '', notes: '' };

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
    const res = await customersApi.list({ type: 'supplier', limit: 200 });
    // include both/customer as well for flexibility
    const all = await customersApi.list({ limit: 200 });
    setSuppliers(all.data || []);
  };

  const handleOpenModal = () => {
    loadSuppliers();
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
      toast.success('Purchase created successfully');
      setShowModal(false);
      setForm({ supplier_id: '', purchase_date: today(), invoice_number: '', notes: '' });
      setItems([{ ...EMPTY_ITEM }]);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="page">
      <PageHeader
        title="Purchases"
        subtitle={`${total} records`}
        actions={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>+ New Purchase</button>}
      />

      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" placeholder="Search code, invoice, supplier…" onChange={e => debouncedSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="expected">Expected</option>
          <option value="partial">Partial</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Invoice</th>
              <th>Items</th>
              <th>Qty</th>
              <th>Amount</th>
              <th>Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRows cols={9} rows={5} /> : purchases.map(p => (
              <tr key={p.id}>
                <td><span className="tag">{p.purchase_code}</span></td>
                <td style={{ fontWeight: 500 }}>{p.supplier_name}</td>
                <td>{fmtDate(p.purchase_date)}</td>
                <td className="text-muted">{p.invoice_number || '—'}</td>
                <td>{p.item_count}</td>
                <td>{fmtQty(p.total_quantity)}</td>
                <td>{fmtCurrency(p.total_amount)}</td>
                <td><StatusBadge status={p.status} /></td>
                <td className="col-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/purchases/${p.id}`)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && purchases.length === 0 && (
          <EmptyState title="No purchases found" description="Record your first diamond purchase" action={
            canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>New Purchase</button>
          } />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <div className="data-cards">
        {loading ? <LoadingCards /> : purchases.map(p => (
          <div key={p.id} className="data-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="font-semibold">{p.purchase_code}</span>
              <StatusBadge status={p.status} />
            </div>
            <div className="data-card-row"><span className="data-card-label">Supplier</span><span>{p.supplier_name}</span></div>
            <div className="data-card-row"><span className="data-card-label">Date</span><span>{fmtDate(p.purchase_date)}</span></div>
            <div className="data-card-row"><span className="data-card-label">Qty</span><span>{fmtQty(p.total_quantity)} pcs</span></div>
            <div className="data-card-row"><span className="data-card-label">Amount</span><span className="font-semibold">{fmtCurrency(p.total_amount)}</span></div>
            <div className="data-card-actions">
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/purchases/${p.id}`)}>View Details</button>
            </div>
          </div>
        ))}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      {/* Create Purchase Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Purchase" size="large"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Create Purchase'}</button>
        </>}>
        <form onSubmit={handleSave}>
          <div className="form-section-title">Purchase Details</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Supplier <span className="required">*</span></label>
              <select className="form-control" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                <option value="">Select supplier…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Purchase Date <span className="required">*</span></label>
              <input className="form-control" type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Invoice Number</label>
              <input className="form-control" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>

          <div className="form-section-title" style={{ marginTop: 16 }}>Diamond Items</div>
          {items.map((item, i) => (
            <div key={i} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-sm font-semibold">Item {i + 1}</span>
                {items.length > 1 && <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(i)}>Remove</button>}
              </div>
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Diamond Type</label>
                  <input className="form-control" value={item.diamond_type} onChange={e => setItem(i, 'diamond_type', e.target.value)} placeholder="e.g. Natural, Lab" />
                </div>
                <div className="form-group">
                  <label className="form-label">Shape</label>
                  <select className="form-control" value={item.shape} onChange={e => setItem(i, 'shape', e.target.value)}>
                    {['Round','Princess','Oval','Marquise','Pear','Emerald','Asscher','Radiant','Heart','Cushion','Other'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Size</label>
                  <input className="form-control" value={item.size} onChange={e => setItem(i, 'size', e.target.value)} placeholder="e.g. 0.30 ct" />
                </div>
              </div>
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input className="form-control" value={item.color} onChange={e => setItem(i, 'color', e.target.value)} placeholder="e.g. D, E, F" />
                </div>
                <div className="form-group">
                  <label className="form-label">Clarity</label>
                  <input className="form-control" value={item.clarity} onChange={e => setItem(i, 'clarity', e.target.value)} placeholder="e.g. VS1, SI2" />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity <span className="required">*</span></label>
                  <input className="form-control" type="number" inputMode="numeric" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} placeholder="Pcs" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Weight (ct)</label>
                  <input className="form-control" type="number" step="0.001" value={item.weight} onChange={e => setItem(i, 'weight', e.target.value)} placeholder="Total weight" />
                </div>
                <div className="form-group">
                  <label className="form-label">Rate (₹ per pc)</label>
                  <input className="form-control" type="number" inputMode="numeric" value={item.rate} onChange={e => setItem(i, 'rate', e.target.value)} placeholder="Rate" />
                </div>
              </div>
              {item.quantity && item.rate && (
                <div className="info-box" style={{ marginTop: -4 }}>
                  Item Total: <strong>{fmtCurrency(calcTotal(item))}</strong>
                </div>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Item</button>

          {items.length > 0 && (
            <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: 16 }}>
              Grand Total: {fmtCurrency(items.reduce((sum, item) => sum + calcTotal(item), 0))}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
