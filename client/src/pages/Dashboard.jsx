import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi } from '../api/index.js';
import { fmtQty, fmtDate, fmtCurrency } from '../utils/helpers.js';
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
    </div>
  );

  const s = data?.stats || {};
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <div className="page-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 16, marginBottom: 24 }}>
        <div className="page-header-left">
          <h1 className="page-title">Morning Briefing</h1>
          <p className="page-subtitle">{today}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/coating-jobs?new=1')}>
            + New Job
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Needs Attention & Today's Work */}
        <div>
          {/* Needs Attention */}
          <div className="section" style={{ marginBottom: 32 }}>
            <div className="section-header">
              <h2 className="section-title text-warning" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)' }}></span>
                Needs Attention
              </h2>
            </div>
            
            <div className="card" style={{ padding: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {s.jobs_due_today > 0 && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => navigate('/coating-jobs')}>
                    <span style={{ fontWeight: 500 }}>Coating Jobs Due Today</span>
                    <span className="badge badge-warning">{s.jobs_due_today}</span>
                  </div>
                )}
                {s.jobs_overdue > 0 && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => navigate('/coating-jobs')}>
                    <span style={{ fontWeight: 500, color: 'var(--color-error)' }}>Overdue Coating Jobs</span>
                    <span className="badge badge-error">{s.jobs_overdue}</span>
                  </div>
                )}
                {s.jobs_quality_check > 0 && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => navigate('/coating-jobs')}>
                    <span style={{ fontWeight: 500 }}>Jobs waiting for QC</span>
                    <span className="badge badge-accent">{s.jobs_quality_check}</span>
                  </div>
                )}
                {s.dispatches_pending > 0 && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => navigate('/dispatch')}>
                    <span style={{ fontWeight: 500 }}>Ready for Dispatch</span>
                    <span className="badge badge-warning">{s.dispatches_pending}</span>
                  </div>
                )}
                {s.overtime_pending > 0 && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => navigate('/overtime')}>
                    <span style={{ fontWeight: 500 }}>Pending Overtime Approvals</span>
                    <span className="badge badge-warning">{s.overtime_pending}</span>
                  </div>
                )}
                
                {(!s.jobs_due_today && !s.jobs_overdue && !s.jobs_quality_check && !s.dispatches_pending && !s.overtime_pending) && (
                  <div style={{ padding: '16px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    All clear! Nothing urgently requires your attention.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Today's Work Queue */}
          <div className="section">
            <div className="section-header" style={{ marginBottom: 12 }}>
              <h2 className="section-title">Today's Work</h2>
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
                      <th>Party</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Done / Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recent_jobs?.map(job => (
                      <tr key={job.job_code} style={{ cursor: 'pointer' }} onClick={() => navigate('/coating-jobs')}>
                        <td style={{ fontWeight: 600 }}>{job.job_code}</td>
                        <td>{job.customer_name || '—'}</td>
                        <td><StatusBadge status={job.job_status} /></td>
                        <td style={{ textAlign: 'right' }}>{job.completed_quantity} / {job.input_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Stock & Financials */}
        <div>
          {/* Stock Operational Flow */}
          <div className="section" style={{ marginBottom: 32 }}>
            <h2 className="section-title" style={{ marginBottom: 16 }}>Operational Stock Flow</h2>
            <div className="card" style={{ padding: '20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }} onClick={() => navigate('/stock')}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)' }}>{fmtQty(s.stock_raw)}</div>
                <div className="text-muted text-xs">Available</div>
              </div>
              <div style={{ color: 'var(--color-border)' }}>→</div>
              <div style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }} onClick={() => navigate('/stock')}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-accent)' }}>{fmtQty(s.stock_in_coating)}</div>
                <div className="text-muted text-xs">In Coating</div>
              </div>
              <div style={{ color: 'var(--color-border)' }}>→</div>
              <div style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }} onClick={() => navigate('/stock')}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-success)' }}>{fmtQty(s.stock_finished)}</div>
                <div className="text-muted text-xs">Finished</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, gap: 24 }}>
              <div className="text-sm">
                 <span className="text-muted">Total Rejected:</span> <strong style={{ color: 'var(--color-error)' }}>{fmtQty(s.stock_rejected)} pcs</strong>
              </div>
            </div>
          </div>

          {/* Financial Snapshot */}
          <div className="section" style={{ marginBottom: 32 }}>
             <h2 className="section-title" style={{ marginBottom: 16 }}>Financial Snapshot</h2>
             <div className="grid-2" style={{ gap: 16 }}>
               <div className="card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => navigate('/payments')}>
                 <div className="text-muted text-sm" style={{ marginBottom: 4 }}>Today's Received</div>
                 <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-success)' }}>{fmtCurrency(s.payments_today)}</div>
               </div>
               <div className="card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => navigate('/payments')}>
                 <div className="text-muted text-sm" style={{ marginBottom: 4 }}>Parties w/ Balances</div>
                 <div style={{ fontSize: 22, fontWeight: 700 }}>{s.customers_outstanding}</div>
               </div>
               <div className="card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => navigate('/salary')}>
                 <div className="text-muted text-sm" style={{ marginBottom: 4 }}>Pending Salaries</div>
                 <div style={{ fontSize: 22, fontWeight: 700, color: s.salary_pending > 0 ? 'var(--color-warning)' : 'inherit' }}>{s.salary_pending}</div>
               </div>
               <div className="card" style={{ padding: 16 }}>
                 <div className="text-muted text-sm" style={{ marginBottom: 4 }}>Active Staff</div>
                 <div style={{ fontSize: 22, fontWeight: 700 }}>{s.employees_active}</div>
               </div>
             </div>
          </div>

          {/* Quick Actions (Dense) */}
          <div className="section">
             <h2 className="section-title" style={{ marginBottom: 12, fontSize: 13, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Quick Actions</h2>
             <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/purchases')}>+ Purchase</button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dispatch')}>+ Dispatch</button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/payments')}>+ Payment</button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers')}>+ Party</button>
             </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
