import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsApi, customersApi, stockApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingCards, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtQty, fmtDate, debounce, today } from '../utils/helpers.js';

const JOB_STATUSES = ['draft', 'assigned', 'in_progress', 'quality_check', 'completed', 'partial', 'rejected', 'cancelled'];

export default function CoatingJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [form, setForm] = useState({
    customer_id: '', purchase_item_id: '', coating_type: 'Standard Resin',
    input_quantity: '', input_weight: '', coating_date: today(), expected_completion: '', notes: ''
  });
  const [selectedStock, setSelectedStock] = useState(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('coating_jobs', 'can_create');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await jobsApi.list(params);
      setJobs(res.data);
      setTotal(res.total);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);
  const debouncedSearch = useCallback(debounce(v => { setSearch(v); setPage(1); }, 350), []);

  const handleOpenModal = async () => {
    const [custRes, stockRes] = await Promise.all([
      customersApi.list({ limit: 200 }),
      stockApi.list({ limit: 200 })
    ]);
    setCustomers(custRes.data);
    setStockItems(stockRes.data.filter(s => s.raw_quantity > 0));
    setStep(1);
    setShowModal(true);
  };

  const handleStockSelect = (stockId) => {
    const stock = stockItems.find(s => s.id === parseInt(stockId));
    setSelectedStock(stock);
    if (stock) {
      const item = { ...form, purchase_item_id: stock.purchase_item_id };
      setForm(item);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.input_quantity || parseFloat(form.input_quantity) <= 0) { toast.error('Input quantity is required'); return; }
    setSaving(true);
    try {
      const data = { ...form, input_quantity: parseFloat(form.input_quantity), input_weight: parseFloat(form.input_weight) || 0 };
      if (selectedStock) {
        data.diamond_type = selectedStock.diamond_type;
        data.shape = selectedStock.shape;
        data.size = selectedStock.size;
        data.color = selectedStock.color;
        data.clarity = selectedStock.clarity;
      }
      const job = await jobsApi.create(data);
      toast.success('Coating job created');
      setShowModal(false);
      setForm({ customer_id: '', purchase_item_id: '', coating_type: 'Standard Resin', input_quantity: '', input_weight: '', coating_date: today(), expected_completion: '', notes: '' });
      setSelectedStock(null);
      navigate(`/coating-jobs/${job.id}`);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const statusColors = {
    draft: '#9ca3af', assigned: '#2563eb', in_progress: '#0891b2',
    quality_check: '#d97706', completed: '#16a34a', partial: '#d97706',
    rejected: '#dc2626', cancelled: '#9ca3af'
  };

  return (
    <div className="page">
      <PageHeader
        title="Coating Jobs"
        subtitle={`${total} jobs`}
        actions={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>+ New Job</button>}
      />

      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" placeholder="Search job code, party…" onChange={e => debouncedSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          {JOB_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Desktop table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Job Code</th>
              <th>Party</th>
              <th>Diamond</th>
              <th>Input</th>
              <th>Done</th>
              <th>Rejected</th>
              <th>Coating</th>
              <th>Due Date</th>
              <th>Assigned</th>
              <th>Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 11 }).map((_, j) => <td key={j}><div className="skeleton skeleton-line" /></td>)}</tr>
              ))
              : jobs.map(j => (
                <tr key={j.id}>
                  <td><span className="tag">{j.job_code}</span></td>
                  <td style={{ fontWeight: 500 }}>{j.customer_name || '—'}</td>
                  <td className="text-sm text-muted">{[j.shape, j.diamond_type].filter(Boolean).join(' ') || '—'}</td>
                  <td>{fmtQty(j.input_quantity)}</td>
                  <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtQty(j.completed_quantity)}</td>
                  <td style={{ color: 'var(--color-error)' }}>{fmtQty(j.rejected_quantity)}</td>
                  <td className="text-sm">{j.coating_type || '—'}</td>
                  <td className="text-sm">{fmtDate(j.expected_completion)}</td>
                  <td className="text-sm text-muted">{j.assigned_employees || '—'}</td>
                  <td><StatusBadge status={j.job_status} /></td>
                  <td className="col-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/coating-jobs/${j.id}`)}>View</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && jobs.length === 0 && (
          <EmptyState title="No coating jobs" description="Create your first coating job" action={
            canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>New Job</button>
          } />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      {/* Mobile cards */}
      <div className="data-cards">
        {loading ? <LoadingCards count={4} /> : jobs.map(j => (
          <div key={j.id} className="data-card" style={{ borderLeft: `3px solid ${statusColors[j.job_status] || '#e2e0db'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div className="data-card-title">{j.job_code}</div>
                <div className="text-sm text-muted">{j.customer_name || 'No party'}</div>
              </div>
              <StatusBadge status={j.job_status} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div style={{ textAlign: 'center', background: 'var(--color-bg)', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Input</div>
                <div style={{ fontWeight: 700 }}>{fmtQty(j.input_quantity)}</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--color-success-light)', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--color-success)' }}>Done</div>
                <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>{fmtQty(j.completed_quantity)}</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--color-error-light)', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--color-error)' }}>Rejected</div>
                <div style={{ fontWeight: 700, color: 'var(--color-error)' }}>{fmtQty(j.rejected_quantity)}</div>
              </div>
            </div>
            <div className="data-card-row"><span className="data-card-label">Coating</span><span>{j.coating_type || '—'}</span></div>
            <div className="data-card-row"><span className="data-card-label">Due</span><span>{fmtDate(j.expected_completion)}</span></div>
            {j.assigned_employees && <div className="data-card-row"><span className="data-card-label">Assigned</span><span>{j.assigned_employees}</span></div>}
            <div className="data-card-actions">
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/coating-jobs/${j.id}`)}>View Job</button>
            </div>
          </div>
        ))}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      {/* Create Job Modal (Wizard) */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={`New Coating Job — Step ${step} of 3`} size="large"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          {step > 1 && <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 3 && <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Next Step</button>}
          {step === 3 && <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Creating…' : 'Create Job'}</button>}
        </>}>
        <div style={{ marginBottom: 20 }}>
           <div style={{ display: 'flex', gap: 4, height: 4, background: 'var(--color-bg)' }}>
             <div style={{ flex: 1, background: step >= 1 ? 'var(--color-primary)' : 'var(--color-border)', borderRadius: 2 }} />
             <div style={{ flex: 1, background: step >= 2 ? 'var(--color-primary)' : 'var(--color-border)', borderRadius: 2 }} />
             <div style={{ flex: 1, background: step >= 3 ? 'var(--color-primary)' : 'var(--color-border)', borderRadius: 2 }} />
           </div>
        </div>

        <form onSubmit={e => e.preventDefault()}>
          {step === 1 && (
            <>
              <div className="form-group">
                <label className="form-label">Party</label>
                <select className="form-control" value={form.customer_id} onChange={e => set('customer_id', e.target.value)}>
                  <option value="">Select party…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Source Stock</label>
                <select className="form-control" value={selectedStock?.id || ''} onChange={e => handleStockSelect(e.target.value)}>
                  <option value="">No stock selected (manual entry)</option>
                  {stockItems.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.purchase_code} — {s.shape} {s.diamond_type} — Available: {fmtQty(s.raw_quantity)} pcs
                    </option>
                  ))}
                </select>
                {selectedStock && (
                  <div className="info-box" style={{ marginTop: 8 }}>
                    Selected: {selectedStock.shape} {selectedStock.diamond_type} | Available raw stock: <strong>{fmtQty(selectedStock.raw_quantity)} pcs</strong>
                  </div>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-group">
                <label className="form-label">Coating Type</label>
                <select className="form-control" value={form.coating_type} onChange={e => set('coating_type', e.target.value)}>
                  {['Standard Resin','Premium Resin','UV Resin','Epoxy Resin','Custom'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Input Quantity (pcs) <span className="required">*</span></label>
                  <input
                    className="form-control"
                    type="number"
                    inputMode="numeric"
                    value={form.input_quantity}
                    onChange={e => set('input_quantity', e.target.value)}
                    max={selectedStock ? selectedStock.raw_quantity : undefined}
                    placeholder={selectedStock ? `Max: ${selectedStock.raw_quantity}` : 'Enter quantity'}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Input Weight (ct)</label>
                  <input className="form-control" type="number" step="0.001" value={form.input_weight} onChange={e => set('input_weight', e.target.value)} placeholder="Optional" />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Coating Date</label>
                  <input className="form-control" type="date" value={form.coating_date} onChange={e => set('coating_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Completion</label>
                  <input className="form-control" type="date" value={form.expected_completion} onChange={e => set('expected_completion', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows="3" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any special instructions for this job" />
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
