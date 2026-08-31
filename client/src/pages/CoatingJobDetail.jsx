import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { jobsApi, employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal } from '../components/ui.jsx';
import { fmtQty, fmtDate, today } from '../utils/helpers.js';

const PIPELINE_STEPS = [
  { id: 'draft', label: 'Received' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in_progress', label: 'Production' },
  { id: 'quality_check', label: 'Quality Check' },
  { id: 'completed', label: 'Ready / Finished' },
  { id: 'dispatched', label: 'Dispatched' }
];

export default function CoatingJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showQCModal, setShowQCModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ employee_id: '', assigned_date: today(), notes: '' });
  const [qcForm, setQcForm] = useState({ completed_quantity: '', rejected_quantity: '0', notes: '' });
  const [customMessage, setCustomMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const load = async () => {
    try {
      const [data, empRes] = await Promise.all([
        jobsApi.get(id),
        employeesApi.list({ status: 'active', limit: 200 })
      ]);
      setJob(data);
      setEmployees(empRes.data || []);
    } catch (err) {
      toast.error('Coating job not found');
      navigate('/coating-jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.employee_id) { toast.error('Please select an employee'); return; }
    setSaving(true);
    try {
      await jobsApi.assign(id, assignForm);
      toast.success('Operator assigned successfully');
      setShowAssignModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleQC = async (e) => {
    e.preventDefault();
    const completed = parseFloat(qcForm.completed_quantity) || 0;
    const rejected = parseFloat(qcForm.rejected_quantity) || 0;
    if (completed <= 0 && rejected <= 0) {
      toast.error('Enter valid completed or rejected quantity'); return;
    }
    const remaining = job.input_quantity - (job.completed_quantity || 0) - (job.rejected_quantity || 0);
    if (completed + rejected > remaining) {
      toast.error(`Total (${completed + rejected}) exceeds remaining batch pieces (${remaining} pcs)`);
      return;
    }

    setSaving(true);
    try {
      await jobsApi.complete(id, {
        completed_quantity: completed,
        rejected_quantity: rejected,
        notes: qcForm.notes
      });
      toast.success('Quality check recorded');
      setShowQCModal(false);
      setQcForm({ completed_quantity: '', rejected_quantity: '0', notes: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!customMessage.trim()) { toast.error('Enter message text'); return; }
    const phone = job.customer_whatsapp;
    if (!phone) { toast.error('No WhatsApp number registered for buyer party'); return; }

    try {
      const res = await fetch('/api/evolution/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('resin_token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          customer_id: job.customer_id,
          phone_number: phone,
          message: customMessage,
          entity_type: 'job',
          entity_id: id
        })
      });
      if (res.ok) {
        toast.success('WhatsApp update sent to party');
      } else {
        const num = phone.replace(/[^0-9]/g, '');
        const fullNum = num.startsWith('91') ? num : `91${num}`;
        window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(customMessage)}`, '_blank');
        toast.info('Opened WhatsApp chat');
      }
    } catch {
      const num = phone.replace(/[^0-9]/g, '');
      const fullNum = num.startsWith('91') ? num : `91${num}`;
      window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(customMessage)}`, '_blank');
    }

    setShowWhatsAppModal(false);
    setCustomMessage('');
  };

  if (loading) return (
    <div className="page">
      <div className="skeleton-line" style={{ height: 28, width: 220, marginBottom: 12 }} />
      <div className="skeleton-line" style={{ height: 90 }} />
    </div>
  );
  if (!job) return null;

  const currentStepIndex = PIPELINE_STEPS.findIndex(s => s.id === job.job_status);
  const remainingPcs = job.input_quantity - (job.completed_quantity || 0) - (job.rejected_quantity || 0);

  return (
    <div className="page">
      {/* Breadcrumb Navigation */}
      <div className="breadcrumb">
        <Link to="/coating-jobs">Coating Jobs</Link>
        <span>/</span>
        <strong>{job.job_code}</strong>
      </div>

      {/* Main Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">{job.job_code}</h1>
            <StatusBadge status={job.job_status} />
          </div>
          <p className="page-subtitle">
            Party: <strong>{job.customer_name || 'In-House Job'}</strong> · {fmtQty(job.input_quantity)} pcs · Operator: {job.employee_name || 'Unassigned'}
          </p>
        </div>

        <div className="page-header-actions">
          {job.customer_whatsapp && (
            <button className="btn btn-whatsapp btn-sm" onClick={() => setShowWhatsAppModal(true)}>
              WhatsApp Party
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAssignModal(true)}>
            Assign Operator
          </button>
          {remainingPcs > 0 && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowQCModal(true)}>
              Record QC &amp; Completion
            </button>
          )}
          {job.job_status === 'completed' && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/dispatch')}>
              Ready for Dispatch →
            </button>
          )}
        </div>
      </div>

      {/* Operational Workflow Progress Strip */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div className="workflow-pipeline">
          {PIPELINE_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div
                key={step.id}
                className={`workflow-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
              >
                <span>{isCompleted ? '✓' : `${idx + 1}.`}</span>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Numerical Snapshot Strip */}
      <div className="stat-strip">
        <div className="stat-strip-item">
          <div className="stat-strip-label">Input Quantity</div>
          <div className="stat-strip-value">{fmtQty(job.input_quantity)} pcs</div>
          <div className="stat-strip-sub">{job.input_weight ? `${job.input_weight} ct` : 'Raw lot'}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Completed (Passed QC)</div>
          <div className="stat-strip-value" style={{ color: 'var(--status-success)' }}>
            {fmtQty(job.completed_quantity || 0)} pcs
          </div>
          <div className="stat-strip-sub">Quality approved</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Rejected / Loss</div>
          <div className="stat-strip-value" style={{ color: job.rejected_quantity > 0 ? 'var(--status-error)' : 'inherit' }}>
            {fmtQty(job.rejected_quantity || 0)} pcs
          </div>
          <div className="stat-strip-sub">Coating defects</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">In Production / Remaining</div>
          <div className="stat-strip-value" style={{ color: remainingPcs > 0 ? 'var(--status-info)' : 'var(--text-muted)' }}>
            {fmtQty(remainingPcs)} pcs
          </div>
          <div className="stat-strip-sub">Pending inspection</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Job Overview &amp; Specs
        </button>
        <button className={`tab ${activeTab === 'qc' ? 'active' : ''}`} onClick={() => setActiveTab('qc')}>
          QC Inspection History
        </button>
        <button className={`tab ${activeTab === 'operator' ? 'active' : ''}`} onClick={() => setActiveTab('operator')}>
          Operator Assignments
        </button>
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.4fr)', gap: 'var(--space-6)' }}>
          {/* Left Panel: Specifications */}
          <div className="panel">
            <div className="form-section-title" style={{ marginTop: 0 }}>Diamond Batch Details</div>
            <div className="data-row">
              <span className="data-row-label">Coating Grade / Type</span>
              <span className="data-row-value">{job.coating_type || 'Standard Resin'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Diamond Type</span>
              <span className="data-row-value">{job.diamond_type || 'Standard'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Shape &amp; Cut</span>
              <span className="data-row-value">{job.shape || 'Round'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Size / Sieve</span>
              <span className="data-row-value">{job.size || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Color &amp; Clarity</span>
              <span className="data-row-value">{job.color || '—'} / {job.clarity || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Coating Date</span>
              <span className="data-row-value">{fmtDate(job.coating_date)}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Due Date</span>
              <span className="data-row-value" style={{ color: 'var(--color-primary)' }}>{fmtDate(job.expected_completion)}</span>
            </div>
          </div>

          {/* Right Panel: Party & Status */}
          <div className="panel">
            <div className="form-section-title" style={{ marginTop: 0 }}>Party &amp; Origin Context</div>
            <div className="data-row">
              <span className="data-row-label">Buyer Party</span>
              <span className="data-row-value">{job.customer_name || 'In-House Manufacturing'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Party Phone</span>
              <span className="data-row-value">{job.customer_phone || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Source Purchase Code</span>
              <span className="data-row-value" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                {job.purchase_code || 'Raw Inventory'}
              </span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Assigned Operator</span>
              <span className="data-row-value">{job.employee_name || 'Unassigned'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Operator Code</span>
              <span className="data-row-value" style={{ fontFamily: 'var(--font-mono)' }}>{job.employee_code || '—'}</span>
            </div>
            {job.notes && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
                <strong style={{ display: 'block', marginBottom: 4, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Formula Notes</strong>
                {job.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'qc' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Operator</th>
                <th className="num-col">Passed Quantity</th>
                <th className="num-col">Rejected Quantity</th>
                <th>Inspection Notes</th>
              </tr>
            </thead>
            <tbody>
              {(job.assignments || []).map((a, i) => (
                <tr key={i}>
                  <td>{fmtDate(a.assigned_date)}</td>
                  <td style={{ fontWeight: 600 }}>{a.employee_name}</td>
                  <td className="num-col" style={{ color: 'var(--status-success)', fontWeight: 700 }}>
                    {fmtQty(a.completed_quantity || 0)} pcs
                  </td>
                  <td className="num-col" style={{ color: a.rejected_quantity > 0 ? 'var(--status-error)' : 'var(--text-muted)' }}>
                    {fmtQty(a.rejected_quantity || 0)} pcs
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{a.notes || '—'}</td>
                </tr>
              ))}
              {(!job.assignments || job.assignments.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No QC inspection records submitted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'operator' && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontWeight: 600 }}>Assigned Coating Operators</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAssignModal(true)}>
              + Assign Additional Operator
            </button>
          </div>
          <div className="data-row">
            <span className="data-row-label">Primary Operator</span>
            <span className="data-row-value">{job.employee_name || 'None'}</span>
          </div>
          <div className="data-row">
            <span className="data-row-label">Operator Code</span>
            <span className="data-row-value">{job.employee_code || '—'}</span>
          </div>
        </div>
      )}

      {/* Modal: Assign Operator */}
      <Modal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Operator to Job"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAssignModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleAssign} disabled={saving}>
              {saving ? 'Assigning…' : 'Confirm Assignment'}
            </button>
          </>
        }
      >
        <form onSubmit={handleAssign}>
          <div className="form-group">
            <label className="form-label">Coater Operator *</label>
            <select
              className="form-control"
              value={assignForm.employee_id}
              onChange={e => setAssignForm(f => ({ ...f, employee_id: e.target.value }))}
              required
              autoFocus
            >
              <option value="">-- Select Active Operator --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Assignment Date</label>
            <input
              className="form-control"
              type="date"
              value={assignForm.assigned_date}
              onChange={e => setAssignForm(f => ({ ...f, assigned_date: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Instructions</label>
            <textarea
              className="form-textarea"
              placeholder="Shift instructions or machine allocation..."
              value={assignForm.notes}
              onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Record QC */}
      <Modal
        open={showQCModal}
        onClose={() => setShowQCModal(false)}
        title="Record Production QC Inspection"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowQCModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleQC} disabled={saving}>
              {saving ? 'Submitting…' : 'Record QC Results'}
            </button>
          </>
        }
      >
        <form onSubmit={handleQC}>
          <div className="panel-subtle" style={{ marginBottom: 16 }}>
            <div className="data-row">
              <span className="data-row-label">Batch Total:</span>
              <span className="data-row-value">{fmtQty(job.input_quantity)} pcs</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Remaining to Inspect:</span>
              <span className="data-row-value" style={{ color: 'var(--color-primary)' }}>{fmtQty(remainingPcs)} pcs</span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Passed QC Quantity (pcs) *</label>
              <input
                className="form-control"
                type="number"
                placeholder={`Max ${remainingPcs}`}
                value={qcForm.completed_quantity}
                onChange={e => setQcForm(f => ({ ...f, completed_quantity: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Defects / Rejects (pcs)</label>
              <input
                className="form-control"
                type="number"
                placeholder="0"
                value={qcForm.rejected_quantity}
                onChange={e => setQcForm(f => ({ ...f, rejected_quantity: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">QC Inspector Remarks</label>
            <textarea
              className="form-textarea"
              placeholder="Visual inspection remarks, coating adhesion, clarity verification..."
              value={qcForm.notes}
              onChange={e => setQcForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </form>
      </Modal>

      {/* Modal: WhatsApp */}
      <Modal
        open={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        title="Notify Customer via WhatsApp"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowWhatsAppModal(false)}>Cancel</button>
            <button className="btn btn-whatsapp btn-sm" onClick={handleSendWhatsApp}>
              Send WhatsApp Update
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Customer WhatsApp</label>
          <input className="form-control" value={job.customer_whatsapp || ''} readOnly />
        </div>
        <div className="form-group">
          <label className="form-label">Message Content</label>
          <textarea
            className="form-textarea"
            rows={5}
            placeholder="Type update message to customer..."
            value={customMessage}
            onChange={e => setCustomMessage(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
