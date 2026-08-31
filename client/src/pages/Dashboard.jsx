import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi } from '../api/index.js';
import { fmtQty, fmtDate } from '../utils/helpers.js';
import { StatusBadge } from '../components/ui.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    reportsApi.dashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <div className="skeleton skeleton-line" style={{ width: 200, height: 28, marginBottom: 8 }} />
        <div className="skeleton skeleton-line short" style={{ height: 16 }} />
      </div>
      <div className="skeleton skeleton-line" style={{ height: 48, marginBottom: 16 }} />
      <div className="skeleton skeleton-line" style={{ height: 48, marginBottom: 16 }} />
      <div className="skeleton skeleton-line" style={{ height: 48, marginBottom: 16 }} />
    </div>
  );

  const s = data?.stats || {};
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 16, marginBottom: 24 }}>
        <div className="page-header-left">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{today}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/coating-jobs?new=1')}>
            + New Job
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Attention Needed & Work Queue */}
        <div>
          {/* Attention Needed */}
          <div className="section" style={{ marginBottom: 32 }}>
            <div className="section-header">
              <h2 className="section-title text-warning" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)' }}></span>
                Attention Needed
              </h2>
            </div>
            
            <div className="card" style={{ padding: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => navigate('/overtime')}>
                  <span style={{ fontWeight: 500 }}>Pending OT Approvals</span>
                  <span className="badge badge-warning">{s.overtime_pending || 0}</span>
                </div>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => navigate('/salary')}>
                  <span style={{ fontWeight: 500 }}>Pending Salary Slips</span>
                  <span className="badge badge-warning">{s.salary_pending || 0}</span>
                </div>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => navigate('/coating-jobs')}>
                  <span style={{ fontWeight: 500 }}>Jobs in QC</span>
                  <span className="badge badge-accent">{s.jobs_quality_check || 0}</span>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => navigate('/dispatch')}>
                  <span style={{ fontWeight: 500 }}>Pending Dispatches</span>
                  <span className="badge badge-warning">{s.dispatches_pending || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Work Queue (Today) */}
          <div className="section">
            <div className="section-header" style={{ marginBottom: 12 }}>
              <h2 className="section-title">Active Work Queue</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/coating-jobs')}>View All →</button>
            </div>
            <div className="table-wrapper">
              {data?.recent_jobs?.length === 0 ? (
                 <div className="empty-state" style={{ padding: '24px' }}>
                   <p>No active coating jobs</p>
                 </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recent_jobs?.map(job => (
                      <tr key={job.job_code} style={{ cursor: 'pointer' }} onClick={() => navigate('/coating-jobs')}>
                        <td style={{ fontWeight: 600 }}>{job.job_code}</td>
                        <td>{job.customer_name || '—'}</td>
                        <td><StatusBadge status={job.job_status} /></td>
                        <td style={{ textAlign: 'right' }}>{job.completed_quantity}/{job.input_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Production & Stock Summary */}
        <div>
          {/* Quick Actions (Dense) */}
          <div className="section" style={{ marginBottom: 32 }}>
             <h2 className="section-title" style={{ marginBottom: 12, fontSize: 13, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Quick Actions</h2>
             <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/purchases')}>+ Purchase</button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dispatch')}>+ Dispatch</button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/payments')}>+ Payment</button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers')}>+ Customer</button>
             </div>
          </div>

          {/* Production & Stock Summary */}
          <div className="section">
            <h2 className="section-title" style={{ marginBottom: 16 }}>Production Summary</h2>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div className="label">Jobs Today</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)' }}>{s.jobs_today || 0}</div>
                  <div className="text-muted text-xs">Total jobs active</div>
                </div>
                <div>
                  <div className="label">Coated Today</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-success)' }}>{fmtQty(s.coated_today)}</div>
                  <div className="text-muted text-xs">Pieces completed</div>
                </div>
                <div>
                  <div className="label">Received Today</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)' }}>{fmtQty(s.received_today)}</div>
                  <div className="text-muted text-xs">Pieces received</div>
                </div>
                <div>
                  <div className="label">Active Staff</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)' }}>{s.employees_active || 0}</div>
                  <div className="text-muted text-xs">Currently clocked in</div>
                </div>
              </div>
              
              <hr className="divider" style={{ margin: '16px 0' }} />
              
              <h3 className="label" style={{ marginBottom: 12 }}>Stock Overview</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                   <span className="text-muted">Raw Diamond</span>
                   <span style={{ fontWeight: 600 }}>{fmtQty(s.stock_raw)} pcs</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                   <span className="text-muted">In Coating</span>
                   <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{fmtQty(s.stock_in_coating)} pcs</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                   <span className="text-muted">Finished</span>
                   <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{fmtQty(s.stock_finished)} pcs</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                   <span className="text-muted">Rejected</span>
                   <span style={{ fontWeight: 600, color: 'var(--color-error)' }}>{fmtQty(s.stock_rejected)} pcs</span>
                 </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
