import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi } from '../api/index.js';
import { fmtCurrency, fmtQty, fmtDate } from '../utils/helpers.js';
import { StatCard, StatusBadge } from '../components/ui.jsx';

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
      <div className="stat-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="stat-card"><div className="skeleton skeleton-line" style={{ height: 48 }} /></div>
        ))}
      </div>
    </div>
  );

  const s = data?.stats || {};
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{today}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => navigate('/coating-jobs?new=1')}>
            + New Job
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '+ Purchase', path: '/purchases', color: 'btn-secondary' },
              { label: '+ Coating Job', path: '/coating-jobs', color: 'btn-primary' },
              { label: '+ Customer', path: '/customers', color: 'btn-secondary' },
              { label: '+ Employee', path: '/employees', color: 'btn-secondary' },
              { label: '+ Dispatch', path: '/dispatch', color: 'btn-secondary' },
              { label: '+ Payment', path: '/payments', color: 'btn-secondary' },
            ].map(({ label, path, color }) => (
              <button key={path} className={`btn ${color} btn-sm`} onClick={() => navigate(path)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Today Overview */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Today's Overview</h2>
        </div>
        <div className="stat-grid">
          <StatCard label="Jobs Today" value={s.jobs_today} variant="accent" />
          <StatCard label="Pending Jobs" value={s.jobs_pending} variant="warning" />
          <StatCard label="In QC" value={s.jobs_quality_check} variant="accent" />
          <StatCard label="Completed" value={s.jobs_completed} variant="success" />
          <StatCard label="Dispatches Today" value={s.dispatches_today} variant="info" />
          <StatCard label="Pending Dispatch" value={s.dispatches_pending} variant="warning" />
          <StatCard label="OT Approvals" value={s.overtime_pending} variant="warning" sub="pending" />
          <StatCard label="Salary Pending" value={s.salary_pending} variant="warning" sub="slips" />
        </div>
      </div>

      {/* Stock Summary */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Stock Summary</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/stock')}>View All →</button>
        </div>
        <div className="stat-grid">
          <StatCard label="Raw Diamond" value={fmtQty(s.stock_raw)} sub="pieces" />
          <StatCard label="In Coating" value={fmtQty(s.stock_in_coating)} sub="pieces" variant="accent" />
          <StatCard label="Finished" value={fmtQty(s.stock_finished)} sub="pieces" variant="success" />
          <StatCard label="Rejected" value={fmtQty(s.stock_rejected)} sub="pieces" variant="error" />
        </div>
      </div>

      {/* Production Today */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Production Today</h2>
        </div>
        <div className="stat-grid">
          <StatCard label="Received" value={fmtQty(s.received_today)} sub="pieces" />
          <StatCard label="Coated" value={fmtQty(s.coated_today)} sub="pieces" variant="success" />
          <StatCard label="Active Employees" value={s.employees_active} />
          <StatCard label="OT Pending" value={s.overtime_pending} variant="warning" />
        </div>
      </div>

      {/* Recent Jobs & Dispatches */}
      <div className="grid-2" style={{ gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <h3>Recent Coating Jobs</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/coating-jobs')}>View All</button>
          </div>
          <div>
            {data?.recent_jobs?.length === 0 && (
              <div className="empty-state" style={{ padding: '24px' }}>
                <p>No coating jobs yet</p>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/coating-jobs')}>Create Job</button>
              </div>
            )}
            {data?.recent_jobs?.map(job => (
              <div key={job.job_code}
                style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
                onClick={() => navigate(`/coating-jobs`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{job.job_code}</span>
                  <StatusBadge status={job.job_status} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  <span>{job.customer_name || '—'}</span>
                  <span>{job.completed_quantity}/{job.input_quantity} pcs</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent Dispatches</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dispatch')}>View All</button>
          </div>
          <div>
            {data?.recent_dispatches?.length === 0 && (
              <div className="empty-state" style={{ padding: '24px' }}>
                <p>No dispatches yet</p>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/dispatch')}>Create Dispatch</button>
              </div>
            )}
            {data?.recent_dispatches?.map(d => (
              <div key={d.dispatch_code}
                style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                onClick={() => navigate('/dispatch')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{d.dispatch_code}</span>
                  <StatusBadge status={d.status} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  <span>{d.customer_name || '—'}</span>
                  <span>{fmtQty(d.quantity)} pcs · {fmtDate(d.dispatch_date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
