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
      <div style={{ marginBottom: 20 }}>
        <div className="skeleton-line" style={{ width: 180, height: 28, marginBottom: 8 }} />
        <div className="skeleton-line" style={{ width: 240, height: 14 }} />
      </div>
      <div className="skeleton-line" style={{ height: 90, marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="skeleton-line" style={{ height: 240 }} />
        <div className="skeleton-line" style={{ height: 240 }} />
      </div>
    </div>
  );

  const s = data?.stats || {};
  const recentJobs = data?.recent_jobs || [];
  const recentDispatches = data?.recent_dispatches || [];

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const attentionItems = [
    {
      label: 'Pending QC Inspection',
      count: s.jobs_quality_check || 0,
      path: '/coating-jobs?status=quality_check',
      variant: s.jobs_quality_check > 0 ? 'warning' : 'neutral'
    },
    {
      label: 'Jobs Due Today',
      count: s.jobs_due_today || 0,
      path: '/coating-jobs',
      variant: s.jobs_due_today > 0 ? 'warning' : 'neutral'
    },
    {
      label: 'Overdue Coating Jobs',
      count: s.jobs_overdue || 0,
      path: '/coating-jobs',
      variant: s.jobs_overdue > 0 ? 'error' : 'neutral'
    },
    {
      label: 'Ready for Dispatch',
      count: s.dispatches_pending || 0,
      path: '/dispatch',
      variant: s.dispatches_pending > 0 ? 'accent' : 'neutral'
    },
    {
      label: 'Overtime Approvals Pending',
      count: s.overtime_pending || 0,
      path: '/overtime',
      variant: s.overtime_pending > 0 ? 'warning' : 'neutral'
    },
    {
      label: 'Pending Salary Settlements',
      count: s.salary_pending || 0,
      path: '/salary',
      variant: s.salary_pending > 0 ? 'neutral' : 'neutral'
    }
  ];

  return (
    <div className="page">
      {/* 1. Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Today · {todayFormatted}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/purchases')}>
            + New Purchase
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/coating-jobs')}>
            + New Coating Job
          </button>
        </div>
      </div>

      {/* 2. Operations Overview (Clean Operational Pipeline Strip) */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-2)'
        }}>
          Operations Pipeline
        </div>
        <div className="stat-strip">
          <div className="stat-strip-item interactive" onClick={() => navigate('/stock')}>
            <div className="stat-strip-label">Raw In Stock</div>
            <div className="stat-strip-value">{fmtQty(s.stock_raw || 0)}</div>
            <div className="stat-strip-sub">Available pieces</div>
          </div>
          <div className="stat-strip-item interactive" onClick={() => navigate('/coating-jobs')}>
            <div className="stat-strip-label">In Production</div>
            <div className="stat-strip-value" style={{ color: 'var(--status-info)' }}>
              {s.jobs_pending || 0}
            </div>
            <div className="stat-strip-sub">Active batch jobs</div>
          </div>
          <div className="stat-strip-item interactive" onClick={() => navigate('/coating-jobs')}>
            <div className="stat-strip-label">Quality Check</div>
            <div className="stat-strip-value" style={{ color: s.jobs_quality_check > 0 ? 'var(--status-warning)' : 'inherit' }}>
              {s.jobs_quality_check || 0}
            </div>
            <div className="stat-strip-sub">Pending verification</div>
          </div>
          <div className="stat-strip-item interactive" onClick={() => navigate('/dispatch')}>
            <div className="stat-strip-label">Ready for Dispatch</div>
            <div className="stat-strip-value" style={{ color: s.dispatches_pending > 0 ? 'var(--color-primary)' : 'inherit' }}>
              {s.dispatches_pending || 0}
            </div>
            <div className="stat-strip-sub">Completed batches</div>
          </div>
          <div className="stat-strip-item interactive" onClick={() => navigate('/dispatch')}>
            <div className="stat-strip-label">Dispatched Today</div>
            <div className="stat-strip-value" style={{ color: 'var(--status-success)' }}>
              {s.dispatches_today || 0}
            </div>
            <div className="stat-strip-sub">Shipments cleared</div>
          </div>
        </div>
      </div>

      {/* 3. Main Operational Sections (Attention & Recent Timelines) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(380px, 1.4fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Attention Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-subtle)',
              borderBottom: '1px solid var(--border-subtle)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="status-dot warning" />
                <span style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  Action Required
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {attentionItems.filter(i => i.count > 0).length} active items
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {attentionItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate(item.path)}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: idx === attentionItems.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', transition: 'background 0.1s ease',
                    background: item.count > 0 && (item.variant === 'warning' || item.variant === 'error') ? 'rgba(254, 242, 242, 0.3)' : 'transparent'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  onMouseLeave={e => e.currentTarget.style.background = item.count > 0 && (item.variant === 'warning' || item.variant === 'error') ? 'rgba(254, 242, 242, 0.3)' : 'transparent'}
                >
                  <span style={{ fontSize: 'var(--font-size-sm)', color: item.count > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: item.count > 0 ? 500 : 400 }}>
                    {item.label}
                  </span>
                  <span
                    className={`badge badge-${item.variant}`}
                    style={{ fontFamily: 'var(--font-mono)', minWidth: 24, justifyContent: 'center' }}
                  >
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Production Metrics */}
          <div className="panel" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
              Production Throughput (Today)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="panel-subtle" style={{ padding: 'var(--space-3)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coated Pcs</div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: 2 }}>
                  {fmtQty(s.coated_today || 0)}
                </div>
              </div>
              <div className="panel-subtle" style={{ padding: 'var(--space-3)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Raw Received</div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: 2 }}>
                  {fmtQty(s.received_today || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Recent Production & Dispatches Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          
          {/* Recent Coating Jobs */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-subtle)',
              borderBottom: '1px solid var(--border-subtle)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                Recent Coating Jobs
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/coating-jobs')}>
                View All →
              </button>
            </div>

            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, margin: 0, boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job Code</th>
                    <th>Customer / Party</th>
                    <th className="num-col">Qty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        No coating jobs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentJobs.map(j => (
                      <tr
                        key={j.job_code}
                        onClick={() => navigate('/coating-jobs')}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                          {j.job_code}
                        </td>
                        <td>{j.customer_name || 'In-House'}</td>
                        <td className="num-col">{fmtQty(j.input_quantity)}</td>
                        <td>
                          <StatusBadge status={j.job_status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Dispatches */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-subtle)',
              borderBottom: '1px solid var(--border-subtle)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                Recent Dispatches
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dispatch')}>
                Dispatch Hub →
              </button>
            </div>

            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, margin: 0, boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dispatch Code</th>
                    <th>Customer</th>
                    <th className="num-col">Quantity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDispatches.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        No dispatches recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentDispatches.map(d => (
                      <tr
                        key={d.dispatch_code}
                        onClick={() => navigate('/dispatch')}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {d.dispatch_code}
                        </td>
                        <td>{d.customer_name}</td>
                        <td className="num-col">{fmtQty(d.quantity)} pcs</td>
                        <td>
                          <StatusBadge status={d.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
