import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsApi, customersApi, stockApi, employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, LoadingCards, LoadingRows, Pagination, Modal, EmptyState } from '../components/ui.jsx';
import { fmtQty, fmtDate, debounce, today } from '../utils/helpers.js';

const JOB_STATUSES = ['draft', 'assigned', 'in_progress', 'quality_check', 'completed', 'cancelled'];

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
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
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
    const [custRes, stockRes, empRes] = await Promise.all([
      customersApi.list({ limit: 200 }),
      stockApi.list({ limit: 200 }),
      employeesApi.list({ status: 'active', limit: 200 })
    ]);
    setCustomers(custRes.data);
    setStockItems(stockRes.data.filter(s => s.raw_quantity > 0));
    setEmployees(empRes.data);
    setStep(1);
    setForm(INITIAL_JOB_FORM);
    setSelectedStock(null);
    setSelectedCustomer(null);
    setSelectedEmployee(null);
    setShowModal(true);
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

  const handleCustomerSelect = (custId) => {
    const cust = customers.find(c => c.id === parseInt(custId));
    setSelectedCustomer(cust || null);
    setForm(f => ({ ...f, customer_id: custId }));
  };

  const handleEmployeeSelect = (empId) => {
    const emp = employees.find(e => e.id === parseInt(empId));
    setSelectedEmployee(emp || null);
    setForm(f => ({ ...f, employee_id: empId }));
  };

  const validateStep = () => {
    if (step === 1 && !form.customer_id) {
      toast.error('Please select a Buyer / Party'); return false;
    }
    if (step === 2 && !selectedStock) {
      toast.error('Please select source diamond stock'); return false;
    }
    if (step === 4) {
      const qty = parseFloat(form.input_quantity);
      if (!qty || qty <= 0) {
        toast.error('Enter a valid input quantity'); return false;
      }
      if (selectedStock && qty > selectedStock.raw_quantity) {
        toast.error(`Quantity exceeds available stock (${selectedStock.raw_quantity} pcs)`); return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) setStep(s => Math.min(s + 1, 7));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateStep()) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        input_quantity: parseFloat(form.input_quantity),
        input_weight: parseFloat(form.input_weight) || 0
      };
      if (selectedStock) {
        data.diamond_type = selectedStock.diamond_type;
        data.shape = selectedStock.shape;
        data.size = selectedStock.size;
        data.color = selectedStock.color;
        data.clarity = selectedStock.clarity;
      }
      const job = await jobsApi.create(data);

      // Assign employee if chosen in Step 5
      if (form.employee_id && job.id) {
        try {
          await jobsApi.assign(job.id, { employee_id: form.employee_id });
        } catch {}
      }

      toast.success(`Coating job ${job.job_code} created successfully`);
      setShowModal(false);
      navigate(`/coating-jobs/${job.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <PageHeader
        title="Coating Jobs"
        subtitle={`${total} jobs recorded`}
        actions={canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>+ Create Coating Job</button>}
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
              <th>Buyer / Party</th>
              <th>Diamond Spec</th>
              <th>Input Qty</th>
              <th>Completed</th>
              <th>Rejected</th>
              <th>Coating</th>
              <th>Due Date</th>
              <th>Assigned Coater</th>
              <th>Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <LoadingRows cols={11} rows={5} />
              : jobs.map(j => (
                <tr key={j.id}>
                  <td><span className="tag">{j.job_code}</span></td>
                  <td style={{ fontWeight: 600 }}>{j.customer_name || '—'}</td>
                  <td className="text-sm text-muted">{[j.shape, j.diamond_type, j.size].filter(Boolean).join(' ') || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmtQty(j.input_quantity)}</td>
                  <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtQty(j.completed_quantity)}</td>
                  <td style={{ color: 'var(--color-error)' }}>{fmtQty(j.rejected_quantity)}</td>
                  <td className="text-sm">{j.coating_type || '—'}</td>
                  <td className="text-sm">{fmtDate(j.expected_completion)}</td>
                  <td className="text-sm text-muted">{j.assigned_employees || 'Unassigned'}</td>
                  <td><StatusBadge status={j.job_status} /></td>
                  <td className="col-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/coating-jobs/${j.id}`)}>Open Job</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && jobs.length === 0 && (
          <EmptyState title="No coating jobs" description="Create your first coating job from available diamond stock" action={
            canCreate && <button className="btn btn-primary" onClick={handleOpenModal}>Create Job</button>
          } />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      {/* Mobile cards */}
      <div className="data-cards">
        {loading ? <LoadingCards count={4} /> : jobs.map(j => (
          <div key={j.id} className="data-card">
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
              <div style={{ textAlign: 'center', background: 'var(--color-success-light, rgba(16,185,129,0.1))', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--color-success)' }}>Done</div>
                <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>{fmtQty(j.completed_quantity)}</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--color-error-light, rgba(239,68,68,0.1))', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--color-error)' }}>Rejected</div>
                <div style={{ fontWeight: 700, color: 'var(--color-error)' }}>{fmtQty(j.rejected_quantity)}</div>
              </div>
            </div>
            <div className="data-card-row"><span className="data-card-label">Coating</span><span>{j.coating_type || '—'}</span></div>
            <div className="data-card-row"><span className="data-card-label">Due Date</span><span>{fmtDate(j.expected_completion)}</span></div>
            <div className="data-card-row"><span className="data-card-label">Assigned</span><span>{j.assigned_employees || 'Unassigned'}</span></div>
            <div className="data-card-actions">
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/coating-jobs/${j.id}`)}>Open Job</button>
            </div>
          </div>
        ))}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      {/* 7-Step Coating Job Creation Wizard */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={`Create Coating Job — Step ${step} of 7`} size="large"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          {step > 1 && <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>Back</button>}
          {step < 7 && <button className="btn btn-primary" onClick={nextStep}>Next Step →</button>}
          {step === 7 && <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Creating Job…' : 'Confirm & Create Job'}</button>}
        </>}>

        {/* Wizard Step Progress Indicator */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            <span>1. Buyer</span>
            <span>2. Stock</span>
            <span>3. Coating</span>
            <span>4. Quantity</span>
            <span>5. Employee</span>
            <span>6. Due Date</span>
            <span>7. Review</span>
          </div>
          <div style={{ display: 'flex', gap: 4, height: 4, background: 'var(--color-bg)' }}>
            {[1,2,3,4,5,6,7].map(s => (
              <div key={s} style={{
                flex: 1,
                background: step >= s ? 'var(--color-primary, #60a5fa)' : 'var(--color-border)',
                borderRadius: 2
              }} />
            ))}
          </div>
        </div>

        <form onSubmit={e => e.preventDefault()}>
          {/* STEP 1: Select Buyer / Party */}
          {step === 1 && (
            <div>
              <div className="form-section-title">Step 1: Select Buyer / Customer Party</div>
              <div className="form-group">
                <label className="form-label">Party Receiving the Coated Diamonds <span className="required">*</span></label>
                <select className="form-control" value={form.customer_id} onChange={e => handleCustomerSelect(e.target.value)}>
                  <option value="">Select party…</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name} ({c.party_code})</option>
                  ))}
                </select>
              </div>
              {selectedCustomer && (
                <div className="info-box">
                  <strong>{selectedCustomer.company_name}</strong> · Contact: {selectedCustomer.contact_person || 'N/A'} · Phone: {selectedCustomer.phone || 'N/A'}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Select Source Stock */}
          {step === 2 && (
            <div>
              <div className="form-section-title">Step 2: Select Source Raw Diamonds</div>
              <div className="form-group">
                <label className="form-label">Available Diamond Stock Batch <span className="required">*</span></label>
                <select className="form-control" value={selectedStock?.id || ''} onChange={e => handleStockSelect(e.target.value)}>
                  <option value="">Select available stock batch…</option>
                  {stockItems.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.purchase_code} — {s.shape} {s.diamond_type} ({s.size || 'Unsized'}) — Available: {fmtQty(s.raw_quantity)} pcs
                    </option>
                  ))}
                </select>
              </div>
              {selectedStock && (
                <div style={{ background: 'var(--color-bg)', padding: 14, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div><span className="text-xs text-muted">Purchase Batch:</span> <strong>{selectedStock.purchase_code}</strong></div>
                    <div><span className="text-xs text-muted">Shape &amp; Type:</span> <strong>{selectedStock.shape} {selectedStock.diamond_type}</strong></div>
                    <div><span className="text-xs text-muted">Available Raw:</span> <strong style={{ color: 'var(--color-success)' }}>{fmtQty(selectedStock.raw_quantity)} pcs</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Coating Details */}
          {step === 3 && (
            <div>
              <div className="form-section-title">Step 3: Specify Coating Process</div>
              <div className="form-group">
                <label className="form-label">Coating Type <span className="required">*</span></label>
                <select className="form-control" value={form.coating_type} onChange={e => set('coating_type', e.target.value)}>
                  <option value="Standard Resin">Standard Resin Coating</option>
                  <option value="Premium Hard Resin">Premium Hard Resin</option>
                  <option value="UV Resin Gloss">UV Resin Gloss Finish</option>
                  <option value="Epoxy Protective Resin">Epoxy Protective Resin</option>
                  <option value="Custom Specification">Custom Specification</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Coating Notes / Formula</label>
                <input className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Layer thickness, curing duration, etc." />
              </div>
            </div>
          )}

          {/* STEP 4: Input Quantity */}
          {step === 4 && (
            <div>
              <div className="form-section-title">Step 4: Enter Allocation Quantity</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Quantity to Allocate (pcs) <span className="required">*</span></label>
                  <input
                    className="form-control"
                    type="number"
                    inputMode="numeric"
                    value={form.input_quantity}
                    onChange={e => set('input_quantity', e.target.value)}
                    max={selectedStock?.raw_quantity}
                    placeholder={`Max: ${selectedStock?.raw_quantity || 0}`}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estimated Weight (ct)</label>
                  <input
                    className="form-control"
                    type="number"
                    step="0.001"
                    value={form.input_weight}
                    onChange={e => set('input_weight', e.target.value)}
                    placeholder="Optional total carats"
                  />
                </div>
              </div>

              {selectedStock && form.input_quantity && (
                <div className="info-box" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Available in Batch</div>
                    <strong>{fmtQty(selectedStock.raw_quantity)} pcs</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-primary)' }}>Allocated to Job</div>
                    <strong style={{ color: 'var(--color-primary)' }}>{fmtQty(form.input_quantity)} pcs</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Remaining Raw Stock</div>
                    <strong>{fmtQty(Math.max(0, selectedStock.raw_quantity - (parseFloat(form.input_quantity) || 0)))} pcs</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Assign Employee */}
          {step === 5 && (
            <div>
              <div className="form-section-title">Step 5: Assign Coater Employee</div>
              <div className="form-group">
                <label className="form-label">Select Employee</label>
                <select className="form-control" value={form.employee_id} onChange={e => handleEmployeeSelect(e.target.value)}>
                  <option value="">Leave unassigned for now</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code}) — {e.designation || e.department || 'Coater'}</option>
                  ))}
                </select>
              </div>
              {selectedEmployee && (
                <div className="info-box">
                  Assigned Coater: <strong>{selectedEmployee.full_name}</strong> · Base Rate: ₹{selectedEmployee.base_salary} ({selectedEmployee.salary_type})
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Set Due Date */}
          {step === 6 && (
            <div>
              <div className="form-section-title">Step 6: Production Schedule &amp; Due Date</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start / Coating Date</label>
                  <input className="form-control" type="date" value={form.coating_date} onChange={e => set('coating_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Completion Due Date</label>
                  <input className="form-control" type="date" value={form.expected_completion} onChange={e => set('expected_completion', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Review */}
          {step === 7 && (
            <div>
              <div className="form-section-title">Step 7: Review &amp; Confirm Job</div>
              <div style={{ background: 'var(--color-bg)', padding: 16, borderRadius: 8, border: '1px solid var(--color-border)', lineHeight: 1.8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><span className="text-muted">Buyer / Party:</span> <strong>{selectedCustomer?.company_name || 'N/A'}</strong></div>
                  <div><span className="text-muted">Source Batch:</span> <strong>{selectedStock?.purchase_code || 'Manual'}</strong></div>
                  <div><span className="text-muted">Diamond Spec:</span> <strong>{selectedStock?.shape} {selectedStock?.diamond_type}</strong></div>
                  <div><span className="text-muted">Coating Type:</span> <strong>{form.coating_type}</strong></div>
                  <div><span className="text-muted">Allocated Qty:</span> <strong style={{ color: 'var(--color-primary)' }}>{fmtQty(form.input_quantity)} pcs</strong></div>
                  <div><span className="text-muted">Assigned Coater:</span> <strong>{selectedEmployee?.full_name || 'Unassigned'}</strong></div>
                  <div><span className="text-muted">Start Date:</span> <strong>{fmtDate(form.coating_date)}</strong></div>
                  <div><span className="text-muted">Due Date:</span> <strong>{fmtDate(form.expected_completion) || 'Not set'}</strong></div>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
