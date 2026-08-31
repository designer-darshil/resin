import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dispatchApi, customersApi, stockApi, jobsApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingCards, Pagination, Modal, EmptyState, WhatsAppButton } from '../components/ui.jsx';
import { fmtQty, fmtDate, debounce, today } from '../utils/helpers.js';

const DISPATCH_STATUSES = ['ready', 'in_transit', 'delivered', 'returned'];

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('ready'); // 'ready' or 'history'
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({
    customer_id: '', quantity: '', dispatch_date: today(), vehicle_number: '',
    driver_name: '', courier_name: '', tracking_number: '',
    delivery_address: '', notes: '', source: 'finished_stock', coating_job_id: '', stock_id: ''
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('dispatch', 'can_create');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (activeTab === 'ready') {
        params.status = 'ready';
      } else {
        if (statusFilter) params.status = statusFilter;
        // if no filter, history should really exclude ready, but API might not support `not_status`, so let's just let it be all or filtered.
      }
      const res = await dispatchApi.list(params);
      
      // If history tab and no specific filter, filter out 'ready' on client side if API doesn't support not_status
      if (activeTab === 'history' && !statusFilter) {
        setDispatches(res.data.filter(d => d.status !== 'ready'));
      } else {
        setDispatches(res.data);
      }
      
      setTotal(res.total);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, activeTab]);

  useEffect(() => { load(); }, [load]);
  const debouncedSearch = useCallback(debounce(v => { setSearch(v); setPage(1); }, 350), []);

  const handleOpenModal = async () => {
    const [custRes, stockRes, jobRes] = await Promise.all([
      customersApi.list({ limit: 200 }),
      stockApi.list({ limit: 200 }),
      jobsApi.list({ status: 'completed', limit: 200 }),
    ]);
    setCustomers(custRes.data);
    setStockItems(stockRes.data.filter(s => s.finished_quantity > 0));
    setJobs(jobRes.data);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.customer_id || !form.quantity || !form.dispatch_date) { toast.error('Party, quantity, and date required'); return; }
    setSaving(true);
    try {
      await dispatchApi.create({ ...form, quantity: parseFloat(form.quantity) });
      toast.success('Dispatch created');
      setShowModal(false);
      setForm({ customer_id: '', quantity: '', dispatch_date: today(), vehicle_number: '', driver_name: '', courier_name: '', tracking_number: '', delivery_address: '', notes: '', source: 'finished_stock', coating_job_id: '', stock_id: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await dispatchApi.update(id, { status });
      toast.success(`Status updated to ${status}`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <PageHeader
        title="Dispatch"
        subtitle={`${total} dispatches`}
        actions={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>+ New Dispatch</button>}
      />

      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${activeTab === 'ready' ? 'active' : ''}`} onClick={() => { setActiveTab('ready'); setPage(1); }}>Ready for Dispatch</button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); setPage(1); }}>Dispatch History</button>
      </div>

      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" placeholder="Search code, party, tracking…" onChange={e => debouncedSearch(e.target.value)} />
        </div>
        {activeTab === 'history' && (
          <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All History Status</option>
            {DISPATCH_STATUSES.filter(s => s !== 'ready').map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        )}
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Party</th>
              <th>Qty</th>
              <th>Date</th>
              <th>Vehicle/Courier</th>
              <th>Tracking</th>
              <th>Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton skeleton-line" /></td>)}</tr>)
              : dispatches.map(d => (
                <tr key={d.id}>
                  <td><span className="tag">{d.dispatch_code}</span></td>
                  <td style={{ fontWeight: 500 }}>{d.customer_name}</td>
                  <td>{fmtQty(d.quantity)} pcs</td>
                  <td>{fmtDate(d.dispatch_date)}</td>
                  <td className="text-muted">{d.vehicle_number || d.courier_name || '—'}</td>
                  <td className="text-sm">{d.tracking_number || '—'}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td className="col-actions">
                    <div style={{ display: 'flex', gap: 4 }}>
                      {d.status === 'ready' && (
                        <button className="btn btn-accent btn-sm" onClick={() => updateStatus(d.id, 'in_transit')} style={{ background: 'var(--color-info)', color: '#fff' }}>Dispatch</button>
                      )}
                      {d.status === 'in_transit' && (
                        <button className="btn btn-success btn-sm" onClick={() => updateStatus(d.id, 'delivered')}>Delivered</button>
                      )}
                      {d.customer_whatsapp && (
                        <button className="btn btn-whatsapp btn-sm" onClick={() => {
                          const msg = `Hello ${d.customer_name}, your order ${d.dispatch_code} (${fmtQty(d.quantity)} pcs) has been dispatched on ${fmtDate(d.dispatch_date)}.${d.tracking_number ? ` Tracking: ${d.tracking_number}` : ''}`;
                          const num = d.customer_whatsapp.replace(/[^0-9]/g, '');
                          window.open(`https://wa.me/${num.startsWith('91') ? num : '91' + num}?text=${encodeURIComponent(msg)}`, '_blank');
                        }}>WA</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && dispatches.length === 0 && (
          <EmptyState title="No dispatches" description="Create your first dispatch" action={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>New Dispatch</button>} />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      <div className="data-cards">
        {loading ? <LoadingCards count={4} /> : dispatches.map(d => (
          <div key={d.id} className="data-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div className="data-card-title">{d.dispatch_code}</div>
                <div className="text-sm text-muted">{d.customer_name}</div>
              </div>
              <StatusBadge status={d.status} />
            </div>
            <div className="data-card-row"><span className="data-card-label">Quantity</span><span className="font-bold">{fmtQty(d.quantity)} pcs</span></div>
            <div className="data-card-row"><span className="data-card-label">Date</span><span>{fmtDate(d.dispatch_date)}</span></div>
            {d.vehicle_number && <div className="data-card-row"><span className="data-card-label">Vehicle</span><span>{d.vehicle_number}</span></div>}
            {d.tracking_number && <div className="data-card-row"><span className="data-card-label">Tracking</span><span>{d.tracking_number}</span></div>}
            <div className="data-card-actions">
              {d.status === 'ready' && <button className="btn btn-sm" style={{ flex: 1, background: 'var(--color-info)', color: '#fff' }} onClick={() => updateStatus(d.id, 'in_transit')}>Mark Dispatched</button>}
              {d.status === 'in_transit' && <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => updateStatus(d.id, 'delivered')}>Mark Delivered</button>}
              {d.customer_whatsapp && (
                <button className="btn btn-whatsapp btn-sm" onClick={() => {
                  const msg = `Hello ${d.customer_name}, your order ${d.dispatch_code} has been dispatched. Qty: ${fmtQty(d.quantity)} pcs on ${fmtDate(d.dispatch_date)}.${d.tracking_number ? ` Tracking: ${d.tracking_number}` : ''}`;
                  const num = d.customer_whatsapp.replace(/[^0-9]/g, '');
                  window.open(`https://wa.me/${num.startsWith('91') ? num : '91' + num}?text=${encodeURIComponent(msg)}`, '_blank');
                }}>WhatsApp</button>
              )}
            </div>
          </div>
        ))}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      {/* Create Dispatch Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Dispatch" size="large"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Creating…' : 'Create Dispatch'}</button>
        </>}>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Party <span className="required">*</span></label>
              <select className="form-control" value={form.customer_id} onChange={e => set('customer_id', e.target.value)}>
                <option value="">Select party…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Dispatch Date <span className="required">*</span></label>
              <input className="form-control" type="date" value={form.dispatch_date} onChange={e => set('dispatch_date', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Source</label>
              <select className="form-control" value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="finished_stock">Finished Stock</option>
                <option value="coating_job">Coating Job</option>
              </select>
            </div>
            {form.source === 'coating_job' ? (
              <div className="form-group">
                <label className="form-label">Coating Job</label>
                <select className="form-control" value={form.coating_job_id} onChange={e => set('coating_job_id', e.target.value)}>
                  <option value="">Select job…</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.job_code} — {fmtQty(j.completed_quantity)} pcs available</option>)}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Stock (Finished)</label>
                <select className="form-control" value={form.stock_id} onChange={e => set('stock_id', e.target.value)}>
                  <option value="">Any finished stock</option>
                  {stockItems.map(s => <option key={s.id} value={s.id}>{s.purchase_code} — {s.shape} {s.diamond_type} — {fmtQty(s.finished_quantity)} pcs</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Quantity (pcs) <span className="required">*</span></label>
              <input className="form-control" type="number" inputMode="numeric" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Number</label>
              <input className="form-control" value={form.vehicle_number} onChange={e => set('vehicle_number', e.target.value)} placeholder="e.g. GJ 01 AB 1234" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Driver Name</label>
              <input className="form-control" value={form.driver_name} onChange={e => set('driver_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Courier / Company</label>
              <input className="form-control" value={form.courier_name} onChange={e => set('courier_name', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tracking Number</label>
              <input className="form-control" value={form.tracking_number} onChange={e => set('tracking_number', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Delivery Address</label>
              <input className="form-control" value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" rows="2" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
