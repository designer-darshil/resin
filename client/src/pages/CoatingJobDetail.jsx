import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { jobsApi, employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal } from '../components/ui.jsx';
import { fmtQty, fmtDate, today } from '../utils/helpers.js';

const STAGES = [
  { key: 'draft', label: 'Draft' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'quality_check', label: 'QC' },
  { key: 'completed', label: 'Completed' },
  { key: 'dispatched', label: 'Dispatched' }
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
      toast.success('Employee assigned to job');
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
      toast.error('Enter completed or rejected quantity'); return;
    }
    const remaining = job.input_quantity - (job.completed_quantity || 0) - (job.rejected_quantity || 0);
    if (completed + rejected > remaining) {
      toast.error(`Total (${completed + rejected}) exceeds remaining quantity (${remaining} pcs)`);
      return;
    }

    setSaving(true);
    try {
      await jobsApi.complete(id, {
        completed_quantity: completed,
        rejected_quantity: rejected,
        notes: qcForm.notes
      });
      toast.success('Production QC record saved');
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
    if (!customMessage.trim()) { toast.error('Enter message content'); return; }
    const phone = job.customer_whatsapp;
    if (!phone) { toast.error('No WhatsApp number for this buyer party'); return; }

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
        toast.success('WhatsApp notification sent');
      } else {
        const num = phone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${num.startsWith('91') ? num : '91' + num}?text=${encodeURIComponent(customMessage)}`, '_blank');
      }
    } catch {
      const num = phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${num.startsWith('91') ? num : '91' + num}?text=${encodeURIComponent(customMessage)}`, '_blank');
    }

    setShowWhatsAppModal(false);
    setCustomMessage('');
  };

  if (loading) return <div className="page"><div className="skeleton skeleton-line" style={{ height: 32, width: 300 }} /></div>;
  if (!job) return null;

  const remainingQty = Math.max(0, job.input_quantity - (job.completed_quantity || 0) - (job.rejected_quantity || 0));

  // Determine current stage index
  let currentStageIndex = 0;
  if (job.job_status === 'assigned') currentStageIndex = 1;
  else if (job.job_status === 'in_progress') currentStageIndex = 2;
  else if (job.job_status === 'quality_check') currentStageIndex = 3;
  else if (job.job_status === 'completed') currentStageIndex = 4;
  else if (job.job_status === 'dispatched') currentStageIndex = 5;

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/coating-jobs">Coating Jobs</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{job.job_code}</span>
      </div>

      <PageHeader
        title={job.job_code}
        subtitle={`${job.customer_name || 'No Party'} · Diamond Coating Job`}
        actions={<>
          <StatusBadge status={job.job_status} />
          {hasPermission('coating_jobs', 'can_edit') && (
            <button className="btn btn-secondary" onClick={() => setShowAssignModal(true)}>+ Assign Coater</button>
          )}
          {hasPermission('coating_jobs', 'can_edit') && remainingQty > 0 && (
            <button className="btn btn-primary" onClick={() => setShowQCModal(true)}>+ Record Production QC</button>
          )}
          {job.customer_whatsapp && (
            <button className="btn btn-whatsapp" onClick={() => {
              setCustomMessage(`Hello ${job.customer_name},\n\nUpdate on your coating job ${job.job_code}:\nStatus: ${job.job_status}\nCompleted: ${job.completed_quantity} pcs / ${job.input_quantity} pcs.\n\nThank you,\nResin Diamond Coating`);
              setShowWhatsAppModal(true);
            }}>📱 WhatsApp Buyer</button>
          )}
        </>}
      />

      {/* Visual Workflow Stages Bar */}
      <div style={{
        background: 'var(--color-surface, #1e1e24)', border: '1px solid var(--color-border, #333)',
        borderRadius: 10, padding: '16px 20px', marginBottom: 24
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 12 }}>
          WORKFLOW STAGES
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          {STAGES.map((st, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            return (
              <div key={st.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: isCurrent ? 'var(--color-primary, #60a5fa)' : isCompleted ? 'var(--color-success, #10b981)' : 'var(--color-bg, #121216)',
                  border: isCurrent ? '2px solid #fff' : `2px solid ${isCompleted ? 'var(--color-success)' : 'var(--color-border)'}`,
                  color: isCurrent || isCompleted ? '#fff' : 'var(--color-text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700
                }}>
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <div style={{
                  fontSize: 12, marginTop: 6,
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? 'var(--color-primary)' : isCompleted ? 'var(--color-text)' : 'var(--color-text-muted)'
                }}>
                  {st.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Production & Spec KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-label">Input Quantity</div>
          <div className="stat-card-value">{fmtQty(job.input_quantity)} pcs</div>
          <div className="stat-card-sub">{job.input_weight ? `${job.input_weight} ct` : 'Raw Batch'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Completed / QC Pass</div>
          <div className="stat-card-value text-success">{fmtQty(job.completed_quantity)} pcs</div>
          <div className="stat-card-sub">Finished goods</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Rejected Quantity</div>
          <div className="stat-card-value text-error">{fmtQty(job.rejected_quantity)} pcs</div>
          <div className="stat-card-sub">QC failed</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Remaining to Coat</div>
          <div className="stat-card-value text-warning">{fmtQty(remainingQty)} pcs</div>
          <div className="stat-card-sub">In process</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Coating Spec</div>
          <div className="stat-card-value" style={{ fontSize: 16 }}>{job.coating_type || 'Standard'}</div>
          <div className="stat-card-sub">Due: {fmtDate(job.expected_completion) || 'Not set'}</div>
        </div>
      </div>

      {/* Detailed Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Diamond & Job Details */}
        <div className="detail-section">
          <h2 className="detail-section-title">Diamond &amp; Batch Specifications</h2>
          <div className="detail-field">
            <div className="detail-field-label">Buyer / Customer Party</div>
            <div className="detail-field-value">
              {job.customer_id ? <Link to={`/customers/${job.customer_id}`}>{job.customer_name}</Link> : '—'}
            </div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Source Purchase Batch</div>
            <div className="detail-field-value">{job.purchase_code || 'Direct Raw'}</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Shape &amp; Type</div>
            <div className="detail-field-value">{[job.shape, job.diamond_type].filter(Boolean).join(' ') || 'Standard'}</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Size / Sieve / Color</div>
            <div className="detail-field-value">{[job.size, job.color, job.clarity].filter(Boolean).join(' · ') || '—'}</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Coating Date</div>
            <div className="detail-field-value">{fmtDate(job.coating_date)}</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Special Notes</div>
            <div className="detail-field-value">{job.notes || '—'}</div>
          </div>
        </div>

        {/* Assigned Coaters & QC History */}
        <div className="detail-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 className="detail-section-title" style={{ margin: 0 }}>Assigned Employees</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAssignModal(true)}>+ Assign</button>
          </div>
          {(job.assignments || []).map(a => (
            <div key={a.id} style={{
              background: 'var(--color-bg)', padding: '10px 14px', borderRadius: 6,
              marginBottom: 8, border: '1px solid var(--color-border)', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <strong>{a.employee_name}</strong>
                <div className="text-xs text-muted">Assigned on {fmtDate(a.assigned_date)}</div>
              </div>
              <span className="text-sm font-semibold">{a.completed_quantity || 0} completed</span>
            </div>
          ))}
          {(!job.assignments || job.assignments.length === 0) && (
            <p className="text-muted" style={{ padding: '10px 0' }}>No employee assigned to this coating job yet.</p>
          )}

          <h2 className="detail-section-title" style={{ marginTop: 24 }}>Quality Check (QC) History</h2>
          {(job.quality_checks || []).map(qc => (
            <div key={qc.id} style={{
              background: 'var(--color-bg)', padding: '10px 14px', borderRadius: 6,
              marginBottom: 8, border: '1px solid var(--color-border)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-xs text-muted">{fmtDate(qc.check_date || qc.created_at)} · Checked by {qc.checked_by_name || 'QC Inspector'}</span>
                <span className={`tag ${qc.status === 'passed' ? 'tag-success' : 'tag-warning'}`}>{qc.status}</span>
              </div>
              <div style={{ marginTop: 4, display: 'flex', gap: 16 }}>
                <span className="text-success font-semibold">Passed: {qc.passed_quantity} pcs</span>
                <span className="text-error font-semibold">Rejected: {qc.failed_quantity} pcs</span>
              </div>
              {qc.notes && <div className="text-xs text-muted" style={{ marginTop: 4 }}>Note: {qc.notes}</div>}
            </div>
          ))}
          {(!job.quality_checks || job.quality_checks.length === 0) && (
            <p className="text-muted" style={{ padding: '10px 0' }}>No QC records submitted yet.</p>
          )}
        </div>
      </div>

      {/* Assign Employee Modal */}
      <Modal open={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Coater Employee"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAssign} disabled={saving}>{saving ? 'Assigning…' : 'Assign Employee'}</button>
        </>}>
        <div className="form-group">
          <label className="form-label">Employee <span className="required">*</span></label>
          <select className="form-control" value={assignForm.employee_id} onChange={e => setAssignForm(f => ({ ...f, employee_id: e.target.value }))}>
            <option value="">Select coater…</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code}) — {e.department || 'Coating'}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Assignment Date</label>
          <input className="form-control" type="date" value={assignForm.assigned_date} onChange={e => setAssignForm(f => ({ ...f, assigned_date: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Instructions / Notes</label>
          <input className="form-control" value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} placeholder="Specific coating instructions" />
        </div>
      </Modal>

      {/* Production & QC Record Modal */}
      <Modal open={showQCModal} onClose={() => setShowQCModal(false)} title="Record Production &amp; QC Update"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowQCModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleQC} disabled={saving}>{saving ? 'Saving QC…' : 'Save Production QC'}</button>
        </>}>
        <div className="info-box" style={{ marginBottom: 14 }}>
          Remaining to coat: <strong>{fmtQty(remainingQty)} pcs</strong> (from total {job.input_quantity} pcs)
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Passed / Completed Qty (pcs) <span className="required">*</span></label>
            <input className="form-control" type="number" inputMode="numeric" value={qcForm.completed_quantity} onChange={e => setQcForm(f => ({ ...f, completed_quantity: e.target.value }))} placeholder="Passed pieces" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Rejected / Defective Qty (pcs)</label>
            <input className="form-control" type="number" inputMode="numeric" value={qcForm.rejected_quantity} onChange={e => setQcForm(f => ({ ...f, rejected_quantity: e.target.value }))} placeholder="0" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">QC Notes / Rejection Reason</label>
          <textarea className="form-control" rows="2" value={qcForm.notes} onChange={e => setQcForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Surface bubbles, improper coating cure, etc." />
        </div>
      </Modal>

      {/* Direct WhatsApp Modal */}
      <Modal open={showWhatsAppModal} onClose={() => setShowWhatsAppModal(false)} title={`Message Buyer (${job.customer_name})`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowWhatsAppModal(false)}>Cancel</button>
          <button className="btn btn-whatsapp" onClick={handleSendWhatsApp}>Send WhatsApp</button>
        </>}>
        <div className="form-group">
          <label className="form-label">Message Content</label>
          <textarea className="form-control" rows="6" value={customMessage} onChange={e => setCustomMessage(e.target.value)} />
        </div>
        <div className="info-box">
          Recipient: <strong>{job.customer_whatsapp}</strong> (Buyer)
        </div>
      </Modal>
    </div>
  );
}
