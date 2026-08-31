import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dispatchApi, customersApi, stockApi, jobsApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingRows, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtQty, fmtDate, debounce, today } from '../utils/helpers.js';

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
      }
      const res = await dispatchApi.list(params);
      
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
    try {
      const [custRes, stockRes, jobRes] = await Promise.all([
        customersApi.list({ limit: 200 }),
        stockApi.list({ limit: 200 }),
        jobsApi.list({ status: 'completed', limit: 200 }),
      ]);
      setCustomers(custRes.data || []);
      setStockItems((stockRes.data || []).filter(s => s.finished_quantity > 0));
      setJobs(jobRes.data || []);
      setShowModal(true);
    } catch (err) {
      toast.error('Failed to load dispatch options');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.customer_id || !form.quantity || !form.dispatch_date) {
      toast.error('Customer party, quantity, and date required'); return;
    }
    setSaving(true);
    try {
      await dispatchApi.create({ ...form, quantity: parseFloat(form.quantity) });
      toast.success('Dispatch challan created');
      setShowModal(false);
      setForm({
        customer_id: '', quantity: '', dispatch_date: today(), vehicle_number: '',
        driver_name: '', courier_name: '', tracking_number: '', delivery_address: '',
        notes: '', source: 'finished_stock', coating_job_id: '', stock_id: ''
      });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await dispatchApi.update(id, { status });
      toast.success(`Dispatch status updated to ${status}`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <PageHeader
        title="Dispatch & Finished Goods Logistics"
        subtitle="Manage ready diamond shipments, gate passes, courier tracking, and deliveries"
        actions={canCreate && (
          <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
            + Create Dispatch Challan
          </button>
        )}
      />

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'ready' ? 'active' : ''}`}
          onClick={() => { setActiveTab('ready'); setPage(1); }}
        >
          Ready for Dispatch
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => { setActiveTab('history'); setPage(1); }}
        >
          Dispatched &amp; Delivery History
        </button>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search dispatch code, party, tracking number…"
            onChange={e => debouncedSearch(e.target.value)}
          />
        </div>
        {activeTab === 'history' && (
          <select
            className="filter-select"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Shipment Statuses</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered to Party</option>
            <option value="returned">Returned</option>
          </select>
        )}
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Dispatch Code</th>
              <th>Customer / Buyer</th>
              <th>Date</th>
              <th className="num-col">Quantity</th>
              <th>Courier / Transport</th>
              <th>Tracking #</th>
              <th>Status</th>
              <th className="action-col">Update Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={8} rows={6} />
            ) : dispatches.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title={activeTab === 'ready' ? 'No pending dispatches' : 'No dispatch history'}
                    description={activeTab === 'ready' ? 'Finished coating jobs will queue here ready for packaging and dispatch.' : 'Past delivered shipments will appear here.'}
                    action={canCreate && activeTab === 'ready' && (
                      <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
                        + Create Dispatch Challan
                      </button>
                    )}
                  />
                </td>
              </tr>
            ) : (
              dispatches.map(d => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {d.dispatch_code}
                  </td>
                  <td style={{ fontWeight: 600 }}>{d.customer_name}</td>
                  <td>{fmtDate(d.dispatch_date)}</td>
                  <td className="num-col" style={{ fontWeight: 700 }}>
                    {fmtQty(d.quantity)} pcs
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {d.courier_name || d.driver_name || 'Direct Handover'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {d.tracking_number || '—'}
                  </td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="action-col">
                    <select
                      className="filter-select"
                      style={{ height: 28, fontSize: 11 }}
                      value={d.status}
                      onChange={e => updateStatus(d.id, e.target.value)}
                    >
                      <option value="ready">Ready</option>
                      <option value="in_transit">In Transit</option>
                      <option value="delivered">Delivered</option>
                      <option value="returned">Returned</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="mobile-card-list">
        {dispatches.map(d => (
          <div key={d.id} className="mobile-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-accent" style={{ marginBottom: 4 }}>{d.dispatch_code}</span>
                <div style={{ fontWeight: 700 }}>{d.customer_name}</div>
              </div>
              <StatusBadge status={d.status} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              <span>{fmtDate(d.dispatch_date)}</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmtQty(d.quantity)} pcs</span>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />

      {/* Create Dispatch Challan Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Create Dispatch Challan"
        size="large"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Generate Dispatch Challan'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-section-title" style={{ marginTop: 0 }}>1. Party &amp; Quantity</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Recipient Party *</label>
              <select
                className="form-control"
                value={form.customer_id}
                onChange={e => set('customer_id', e.target.value)}
                required
              >
                <option value="">-- Select Buyer / Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name} ({c.party_code})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Dispatch Quantity (pcs) *</label>
              <input
                className="form-control"
                type="number"
                placeholder="Total diamond pieces"
                value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Dispatch Date *</label>
              <input
                className="form-control"
                type="date"
                value={form.dispatch_date}
                onChange={e => set('dispatch_date', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-section-title">2. Logistics &amp; Transport Details</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Courier / Logistics Provider</label>
              <input
                className="form-control"
                placeholder="e.g. BVC Logistics / Sequel"
                value={form.courier_name}
                onChange={e => set('courier_name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Docket / Tracking Number</label>
              <input
                className="form-control"
                placeholder="e.g. BVC-994821"
                value={form.tracking_number}
                onChange={e => set('tracking_number', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Driver / Handover Person</label>
              <input
                className="form-control"
                placeholder="e.g. Ramesh Bhai"
                value={form.driver_name}
                onChange={e => set('driver_name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle / Reg Number</label>
              <input
                className="form-control"
                placeholder="e.g. GJ-05-AB-1234"
                value={form.vehicle_number}
                onChange={e => set('vehicle_number', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Delivery Address / Destination</label>
            <input
              className="form-control"
              placeholder="Destination factory / office address"
              value={form.delivery_address}
              onChange={e => set('delivery_address', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Challan Remarks</label>
            <textarea
              className="form-textarea"
              placeholder="Seal number, diamond packet notes..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
