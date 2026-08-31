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
        <div className="skeleton-line" style={{ width: 160, height: 24, marginBottom: 6 }} />
        <div className="skeleton-line" style={{ width: 220, height: 14 }} />
      </div>
      <div className="skeleton-line" style={{ height: 80, marginBottom: 16 }} />
      <div className="skeleton-line" style={{ height: 160 }} />
    </div>
  );

  const s = data?.stats || {};
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="page">
      {/* Dashboard Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{today}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/purchases')}>
            + New Purchase
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/coating-jobs')}>
            + Create Coating Job
          </button>
        </div>
      </div>

      {/* Operational Work Status Progress Strip */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-5)', marginBottom: 'var(--space-6)'
      }}>
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
          OPERATIONAL WORK STATUS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)' }}>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/coating-jobs')}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>In Coating</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>{s.jobs_in_progress || 0}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Active batch jobs</div>
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/coating-jobs')}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--status-warning)' }}>Waiting for QC</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--status-warning)' }}>{s.jobs_quality_check || 0}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Inspection required</div>
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/dispatch')}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>Ready for Dispatch</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-primary)' }}>{s.dispatches_pending || 0}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Finished diamonds</div>
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/stock')}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--status-success)' }}>Available Raw Stock</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--status-success)' }}>{fmtQty(s.total_raw_stock || 0)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Pcs in inventory</div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Operational Grid */}
      <div className="form-row" style={{ alignItems: 'start', gap: 'var(--space-6)' }}>
        
        {/* LEFT COLUMN: Needs Attention & Quick Lists */}
        <div>
          {/* Needs Attention Section */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-warning)' }} />
              <strong style={{ fontSize: 'var(--font-size-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Needs Attention</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {s.jobs_due_today > 0 && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/coating-jobs')}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Coating Jobs Due Today</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Scheduled for completion today</div>
                  </div>
                  <span className="badge badge-warning">{s.jobs_due_today}</span>
                </div>
              )}

              {s.jobs_overdue > 0 && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/coating-jobs')}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--status-error)' }}>Overdue Jobs</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Past scheduled due date</div>
                  </div>
                  <span className="badge badge-error">{s.jobs_overdue}</span>
                </div>
              )}

              {s.overtime_pending > 0 && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/overtime')}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Overtime Approvals</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Submitted coater hours</div>
                  </div>
                  <span className="badge badge-warning">{s.overtime_pending}</span>
                </div>
              )}

              {(!s.jobs_due_today && !s.jobs_overdue && !s.overtime_pending) && (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  ✓ All operational schedules and approvals are currently up to date.
                </div>
              )}
            </div>
          </div>

          {/* Active Jobs in Progress */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 'var(--font-size-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Coating Jobs</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/coating-jobs')}>View All →</button>
            </div>

            <div>
              {(data?.active_jobs || []).slice(0, 5).map(job => (
                <div key={job.id} style={{
                  padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                }} onClick={() => navigate(`/coating-jobs/${job.id}`)}>
                  <div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <span className="tag">{job.job_code}</span>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{job.customer_name || 'No Party'}</span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                      {job.coating_type || 'Standard Resin'} · {fmtQty(job.input_quantity)} pcs
                    </div>
                  </div>
                  <StatusBadge status={job.job_status} />
                </div>
              ))}
              {(!data?.active_jobs || data.active_jobs.length === 0) && (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  No active coating jobs.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Financial Overview & Recent Dispatches */}
        <div>
          {/* Financial Balances Card */}
          <div className="card">
            <div className="card-header">
              <strong style={{ fontSize: 'var(--font-size-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Financial Snapshot</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/payments')}>Payments →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Buyer Receivables</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                  {fmtCurrency(s.total_receivable || 0)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pending collection</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Supplier Payables</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--status-error)', marginTop: 4 }}>
                  {fmtCurrency(s.total_payable || 0)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Outstanding raw purchases</div>
              </div>
            </div>
          </div>

          {/* Recent Dispatches */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 'var(--font-size-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recent Dispatches</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dispatch')}>Dispatch Hub →</button>
            </div>
            <div>
              {(data?.recent_dispatches || []).slice(0, 5).map(d => (
                <div key={d.id} style={{
                  padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{d.customer_name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {d.dispatch_code} · {fmtQty(d.quantity)} pcs · {fmtDate(d.dispatch_date)}
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
              {(!data?.recent_dispatches || data.recent_dispatches.length === 0) && (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  No recent dispatches recorded.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
