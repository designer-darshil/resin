import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsApi, customersApi, stockApi, employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingRows, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtQty, fmtDate, debounce, today } from '../utils/helpers.js';

const INITIAL_JOB_FORM = {
  customer_id: '',
  purchase_item_id: '',
  coating_type: 'Standard Resin',
  input_quantity: '',
  input_weight: '',
  employee_id: '',
  coating_date: today(),
  expected_completion: '',
  notes: ''
};

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
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(INITIAL_JOB_FORM);
  const [selectedStock, setSelectedStock] = useState(null);
  const [saving, setSaving] = useState(false);
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
    try {
      const [custRes, stockRes, empRes] = await Promise.all([
        customersApi.list({ limit: 200 }),
        stockApi.list({ limit: 200 }),
        employeesApi.list({ status: 'active', limit: 200 })
      ]);
      setCustomers(custRes.data || []);
      setStockItems((stockRes.data || []).filter(s => s.raw_quantity > 0));
      setEmployees(empRes.data || []);
      setForm(INITIAL_JOB_FORM);
      setSelectedStock(null);
      setShowModal(true);
    } catch (err) {
      toast.error('Failed to load form dependencies');
    }
  };

  const handleStockSelect = (stockId) => {
    const stock = stockItems.find(s => s.id === parseInt(stockId));
    setSelectedStock(stock || null);
    if (stock) {
      setForm(f => ({
        ...f,
        purchase_item_id: stock.purchase_item_id,
        diamond_type: stock.diamond_type,
        shape: stock.shape,
        size: stock.size,
        color: stock.color,
        clarity: stock.clarity
      }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const qty = parseFloat(form.input_quantity);
    if (!qty || qty <= 0) { toast.error('Enter valid input quantity'); return; }
    if (selectedStock && qty > selectedStock.raw_quantity) {
      toast.error(`Quantity exceeds available stock (${selectedStock.raw_quantity} pcs)`); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        input_quantity: qty,
        input_weight: parseFloat(form.input_weight) || 0
      };
      if (selectedStock) {
        payload.diamond_type = selectedStock.diamond_type;
        payload.shape = selectedStock.shape;
        payload.size = selectedStock.size;
        payload.color = selectedStock.color;
        payload.clarity = selectedStock.clarity;
      }
      const job = await jobsApi.create(payload);
      if (form.employee_id && job.id) {
        try { await jobsApi.assign(job.id, { employee_id: form.employee_id }); } catch {}
      }
      toast.success(`Job ${job.job_code} created successfully`);
      setShowModal(false);
      navigate(`/coating-jobs/${job.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Coating Jobs & Production"
        subtitle="Track batches through Received → Production → QC → Ready → Dispatched"
        actions={canCreate && (
          <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
            + Create New Job
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
            placeholder="Search job code, party name, spec…"
            onChange={e => debouncedSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Job Statuses</option>
          <option value="in_progress">In Progress</option>
          <option value="quality_check">Quality Check (QC)</option>
          <option value="assigned">Assigned Operator</option>
          <option value="completed">Completed / Ready</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Job Code</th>
              <th>Buyer / Party</th>
              <th>Diamond Spec</th>
              <th>Operator</th>
              <th className="num-col">Input Qty</th>
              <th className="num-col">Completed</th>
              <th>Due Date</th>
              <th>Status</th>
              <th className="action-col">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={9} rows={6} />
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    title="No coating jobs found"
                    description="Create a new coating batch from raw stock to assign operators and track QC."
                    action={canCreate && (
                      <button className="btn btn-primary btn-sm" onClick={handleOpenModal}>
                        + Create Coating Job
                      </button>
                    )}
                  />
                </td>
              </tr>
            ) : (
              jobs.map(j => (
                <tr
                  key={j.id}
                  onClick={() => navigate(`/coating-jobs/${j.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {j.job_code}
                  </td>
                  <td style={{ fontWeight: 600 }}>{j.customer_name || 'In-House Job'}</td>
                  <td>
                    {j.diamond_type || 'Standard'} {j.shape ? `(${j.shape})` : ''}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {j.employee_name || '—'}
                  </td>
                  <td className="num-col" style={{ fontWeight: 600 }}>{fmtQty(j.input_quantity)}</td>
                  <td className="num-col" style={{ color: 'var(--status-success)', fontWeight: 600 }}>
                    {fmtQty(j.completed_quantity || 0)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {fmtDate(j.expected_completion)}
                  </td>
                  <td>
                    <StatusBadge status={j.job_status} />
                  </td>
                  <td className="action-col" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/coating-jobs/${j.id}`)}
                    >
                      Open Job →
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
        {jobs.map(j => (
          <div key={j.id} className="mobile-card" onClick={() => navigate(`/coating-jobs/${j.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-info" style={{ marginBottom: 4 }}>{j.job_code}</span>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{j.customer_name || 'In-House'}</div>
              </div>
              <StatusBadge status={j.job_status} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span>{fmtQty(j.input_quantity)} pcs · {j.employee_name || 'Unassigned'}</span>
              <span>Due: {fmtDate(j.expected_completion)}</span>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />

      {/* New Coating Job Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Create Diamond Coating Job"
        size="large"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Start Coating Job'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-section-title" style={{ marginTop: 0 }}>1. Party & Stock Source</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Buyer / Customer Party</label>
              <select
                className="form-control"
                value={form.customer_id}
                onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
              >
                <option value="">-- Optional / In-House Coating --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name} ({c.party_code})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Source Raw Stock *</label>
              <select
                className="form-control"
                value={stockItems.find(s => s.purchase_item_id === form.purchase_item_id)?.id || ''}
                onChange={e => handleStockSelect(e.target.value)}
                required
              >
                <option value="">-- Select Available Raw Stock --</option>
                {stockItems.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.purchase_code || 'Stock'} · {s.diamond_type} ({s.shape}, {s.size}) — {s.raw_quantity} pcs avail
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section-title">2. Batch Specifications & Quantity</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Input Quantity (pcs) *</label>
              <input
                className="form-control"
                type="number"
                placeholder={selectedStock ? `Max ${selectedStock.raw_quantity}` : '0'}
                value={form.input_quantity}
                onChange={e => setForm(f => ({ ...f, input_quantity: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Input Weight (carats)</label>
              <input
                className="form-control"
                type="number"
                step="0.001"
                placeholder="0.00"
                value={form.input_weight}
                onChange={e => setForm(f => ({ ...f, input_weight: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Coating Type / Grade</label>
              <select
                className="form-control"
                value={form.coating_type}
                onChange={e => setForm(f => ({ ...f, coating_type: e.target.value }))}
              >
                <option value="Standard Resin">Standard Resin</option>
                <option value="High Durability Resin">High Durability Resin</option>
                <option value="Diamond Gloss Polish">Diamond Gloss Polish</option>
                <option value="Custom Chemical Formula">Custom Chemical Formula</option>
              </select>
            </div>
          </div>

          <div className="form-section-title">3. Operator & Scheduling</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Assign Coater Operator</label>
              <select
                className="form-control"
                value={form.employee_id}
                onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
              >
                <option value="">-- Assign Later --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.designation || 'Operator'})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Coating Date *</label>
              <input
                className="form-control"
                type="date"
                value={form.coating_date}
                onChange={e => setForm(f => ({ ...f, coating_date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Target Completion Date</label>
              <input
                className="form-control"
                type="date"
                value={form.expected_completion}
                onChange={e => setForm(f => ({ ...f, expected_completion: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label">Batch Notes & Formulas</label>
            <textarea
              className="form-textarea"
              placeholder="Special instructions for the machine operator..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
