import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { jobsApi, employeesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal, WhatsAppButton, Avatar } from '../components/ui.jsx';
import { fmtQty, fmtDate, today } from '../utils/helpers.js';

export default function CoatingJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ employee_id: '', assigned_date: today(), notes: '' });
  const [completeForm, setCompleteForm] = useState({ completed_quantity: '', rejected_quantity: '', notes: '' });
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await jobsApi.get(id);
      setJob(data);
      setNewStatus(data.job_status);
    } catch (err) {
      toast.error('Job not found');
      navigate('/coating-jobs');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleAssign = async () => {
    if (!assignForm.employee_id) { toast.error('Select an employee'); return; }
    setSaving(true);
    try {
      await jobsApi.assign(id, assignForm);
      toast.success('Employee assigned');
      setShowAssignModal(false);
      setAssignForm({ employee_id: '', assigned_date: today(), notes: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleComplete = async () => {
    if (!completeForm.completed_quantity && !completeForm.rejected_quantity) {
      toast.error('Enter completed or rejected quantity'); return;
    }
    setSaving(true);
    try {
      await jobsApi.complete(id, {
        completed_quantity: parseFloat(completeForm.completed_quantity) || 0,
        rejected_quantity: parseFloat(completeForm.rejected_quantity) || 0,
        notes: completeForm.notes
      });
      toast.success('Production recorded');
      setShowCompleteModal(false);
      setCompleteForm({ completed_quantity: '', rejected_quantity: '', notes: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleStatusUpdate = async () => {
    setSaving(true);
    try {
      await jobsApi.update(id, { job_status: newStatus });
      toast.success('Status updated');
      setShowStatusModal(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const loadEmployees = async () => {
    const res = await employeesApi.list({ status: 'active', limit: 200 });
    setEmployees(res.data);
  };

  if (loading) return <div className="page"><div className="skeleton skeleton-line" style={{ height: 32, width: 300 }} /></div>;
  if (!job) return null;

  const canEdit = hasPermission('coating_jobs', 'can_edit');
  const remaining = job.input_quantity - job.completed_quantity - job.rejected_quantity;

  const whatsAppMsg = job.customer_name
    ? `Hello ${job.customer_name}, your coating job *${job.job_code}* is currently *${job.job_status.replace('_', ' ')}*. Completed: ${job.completed_quantity} pcs out of ${job.input_quantity} pcs. Expected completion: ${fmtDate(job.expected_completion)}.`
    : '';

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/coating-jobs">Coating Jobs</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{job.job_code}</span>
      </div>

      <PageHeader
        title={job.job_code}
        subtitle={job.customer_name ? `Customer: ${job.customer_name}` : 'No customer assigned'}
        actions={<>
          {canEdit && (
            <>
              <button className="btn btn-secondary" onClick={() => { setShowStatusModal(true); }}>Update Status</button>
              <button className="btn btn-secondary" onClick={() => { loadEmployees(); setShowAssignModal(true); }}>Assign Employee</button>
              {remaining > 0 && (
                <button className="btn btn-primary" onClick={() => setShowCompleteModal(true)}>Record Production</button>
              )}
            </>
          )}
          {job.customer_whatsapp && (
            <WhatsAppButton phone={job.customer_whatsapp} message={whatsAppMsg} label="Job Update" />
          )}
        </>}
      />

      {/* Job Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Input', value: fmtQty(job.input_quantity), color: '' },
          { label: 'Completed', value: fmtQty(job.completed_quantity), color: 'var(--color-success)' },
          { label: 'Rejected', value: fmtQty(job.rejected_quantity), color: 'var(--color-error)' },
          { label: 'Remaining', value: fmtQty(remaining), color: 'var(--color-warning)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-label">{label}</div>
            <div className="stat-card-value" style={{ color: color || 'inherit', fontSize: 22 }}>{value}</div>
            <div className="stat-card-sub">pieces</div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-card-label">Status</div>
          <div style={{ marginTop: 4 }}><StatusBadge status={job.job_status} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Quality</div>
          <div style={{ marginTop: 4 }}><StatusBadge status={job.quality_status || 'pending'} /></div>
        </div>
      </div>

      {/* Progress bar */}
      {job.input_quantity > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span>Production Progress</span>
              <span style={{ fontWeight: 600 }}>{Math.round((job.completed_quantity / job.input_quantity) * 100)}%</span>
            </div>
            <div style={{ background: 'var(--color-bg-secondary)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                background: 'var(--color-success)', height: '100%',
                width: `${Math.min(100, (job.completed_quantity / job.input_quantity) * 100)}%`,
                borderRadius: 4, transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Job Details */}
        <div className="card">
          <div className="card-header"><h3>Job Details</h3></div>
          <div className="card-body">
            {[
              ['Diamond Type', job.diamond_type],
              ['Shape', job.shape],
              ['Size', job.size],
              ['Color', job.color],
              ['Clarity', job.clarity],
              ['Input Weight', job.input_weight ? `${job.input_weight} ct` : null],
              ['Coating Type', job.coating_type],
              ['Coating Date', fmtDate(job.coating_date)],
              ['Expected Completion', fmtDate(job.expected_completion)],
            ].filter(([_, v]) => v).map(([label, value]) => (
              <div key={label} className="detail-field">
                <div className="detail-field-label">{label}</div>
                <div className="detail-field-value">{value || '—'}</div>
              </div>
            ))}
            {job.notes && (
              <div className="detail-field">
                <div className="detail-field-label">Notes</div>
                <div className="detail-field-value">{job.notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Assignments */}
        <div className="card">
          <div className="card-header">
            <h3>Assigned Employees</h3>
            {canEdit && (
              <button className="btn btn-secondary btn-sm" onClick={() => { loadEmployees(); setShowAssignModal(true); }}>+ Assign</button>
            )}
          </div>
          <div className="card-body">
            {job.assignments?.length === 0 && (
              <p className="text-muted text-sm">No employees assigned yet.</p>
            )}
            {job.assignments?.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12, padding: 12, background: 'var(--color-bg)', borderRadius: 8 }}>
                <Avatar name={a.employee_name} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.employee_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{a.employee_code}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12 }}>
                    <span>✅ {fmtQty(a.completed_quantity)} done</span>
                    <span>❌ {fmtQty(a.rejected_quantity)} rejected</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quality Checks */}
      {job.quality_checks?.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><h3>Quality Check History</h3></div>
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Passed</th><th>Failed</th><th>Status</th><th>Checked By</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {job.quality_checks.map(qc => (
                <tr key={qc.id}>
                  <td>{fmtDate(qc.check_date)}</td>
                  <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtQty(qc.passed_quantity)}</td>
                  <td style={{ color: 'var(--color-error)' }}>{fmtQty(qc.failed_quantity)}</td>
                  <td><StatusBadge status={qc.status} /></td>
                  <td>{qc.checked_by_name || '—'}</td>
                  <td className="text-muted">{qc.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Employee Modal */}
      <Modal open={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Employee"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAssign} disabled={saving}>{saving ? 'Assigning…' : 'Assign'}</button>
        </>}>
        <div className="form-group">
          <label className="form-label">Employee <span className="required">*</span></label>
          <select className="form-control" value={assignForm.employee_id} onChange={e => setAssignForm(f => ({ ...f, employee_id: e.target.value }))}>
            <option value="">Select employee…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Assigned Date</label>
          <input className="form-control" type="date" value={assignForm.assigned_date} onChange={e => setAssignForm(f => ({ ...f, assigned_date: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-control" value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
        </div>
      </Modal>

      {/* Record Production Modal */}
      <Modal open={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Record Production"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCompleteModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleComplete} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>}>
        <div className="info-box" style={{ marginBottom: 16 }}>
          Remaining to process: <strong>{fmtQty(remaining)} pcs</strong>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Completed Quantity</label>
            <input
              className="form-control" type="number" inputMode="numeric"
              value={completeForm.completed_quantity}
              onChange={e => setCompleteForm(f => ({ ...f, completed_quantity: e.target.value }))}
              max={remaining} placeholder={`Max ${remaining}`}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Rejected Quantity</label>
            <input
              className="form-control" type="number" inputMode="numeric"
              value={completeForm.rejected_quantity}
              onChange={e => setCompleteForm(f => ({ ...f, rejected_quantity: e.target.value }))}
              placeholder="0"
            />
          </div>
        </div>
        {completeForm.completed_quantity && completeForm.rejected_quantity && (
          <div className="warning-box">
            Total: {(parseFloat(completeForm.completed_quantity || 0) + parseFloat(completeForm.rejected_quantity || 0))} of {remaining} remaining
          </div>
        )}
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Notes</label>
          <textarea className="form-control" rows="2" value={completeForm.notes} onChange={e => setCompleteForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>

      {/* Status Update Modal */}
      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update Job Status"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleStatusUpdate} disabled={saving}>{saving ? 'Saving…' : 'Update'}</button>
        </>}>
        <div className="form-group">
          <label className="form-label">New Status</label>
          <select className="form-control" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
            {['draft','assigned','in_progress','quality_check','completed','partial','rejected','cancelled'].map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
