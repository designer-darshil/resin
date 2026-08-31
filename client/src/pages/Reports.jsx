import { useState, useEffect } from 'react';
import { reportsApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { PageHeader, StatCard } from '../components/ui.jsx';
import { fmtCurrency, fmtQty, fmtDate, today, monthName } from '../utils/helpers.js';

const last30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('production');
  const [fromDate, setFromDate] = useState(last30);
  const [toDate, setToDate] = useState(today());
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const loadData = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'production') {
        const res = await reportsApi.production({ from_date: fromDate, to_date: toDate });
        setData(res);
      } else if (tab === 'stock') {
        const res = await reportsApi.stock();
        setData(res);
      } else if (tab === 'employee') {
        const res = await reportsApi.employee({ from_date: fromDate, to_date: toDate });
        setData(res);
      } else if (tab === 'financial') {
        const res = await reportsApi.financial({ from_date: fromDate, to_date: toDate });
        setData(res);
      }
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(activeTab); }, [activeTab, fromDate, toDate]);

  const tabs = ['production', 'stock', 'employee', 'financial'];

  return (
    <div className="page">
      <PageHeader title="Reports & Analytics" subtitle="Business performance insights" />

      <div className="tabs">
        {tabs.map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Date range for non-stock reports */}
      {activeTab !== 'stock' && (
        <div className="toolbar" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>From</label>
            <input className="filter-date" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>To</label>
            <input className="filter-date" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>
      )}

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
      )}

      {/* Production Report */}
      {activeTab === 'production' && !loading && data.daily && (
        <>
          <div className="table-wrapper" style={{ marginBottom: 24 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Received (pcs)</th>
                  <th>Coated (pcs)</th>
                  <th>Rejected (pcs)</th>
                  <th>Dispatched (pcs)</th>
                  <th>Net Yield %</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No data for this period</td></tr>
                ) : data.daily.map(d => {
                  const yield_pct = d.coated > 0 && (d.coated + d.rejected) > 0
                    ? ((d.coated / (d.coated + d.rejected)) * 100).toFixed(1)
                    : '—';
                  return (
                    <tr key={d.date}>
                      <td>{fmtDate(d.date)}</td>
                      <td>{fmtQty(d.received)}</td>
                      <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtQty(d.coated)}</td>
                      <td style={{ color: 'var(--color-error)' }}>{fmtQty(d.rejected)}</td>
                      <td style={{ color: 'var(--color-info)' }}>{fmtQty(d.dispatched)}</td>
                      <td style={{ fontWeight: 600 }}>{yield_pct}{yield_pct !== '—' ? '%' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-header"><h3>Employee Production</h3></div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Code</th>
                  <th>Jobs</th>
                  <th>Completed</th>
                  <th>Rejected</th>
                  <th>Yield %</th>
                  <th>Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {(data.by_employee || []).map(e => {
                  const total = (e.completed || 0) + (e.rejected || 0);
                  const yp = total > 0 ? ((e.completed / total) * 100).toFixed(1) : '—';
                  return (
                    <tr key={e.employee_code}>
                      <td style={{ fontWeight: 600 }}>{e.full_name}</td>
                      <td><span className="tag">{e.employee_code}</span></td>
                      <td>{e.jobs}</td>
                      <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtQty(e.completed)}</td>
                      <td style={{ color: 'var(--color-error)' }}>{fmtQty(e.rejected)}</td>
                      <td style={{ fontWeight: 600 }}>{yp}{yp !== '—' ? '%' : ''}</td>
                      <td>{e.total_hours} hrs</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Stock Report */}
      {activeTab === 'stock' && !loading && data.totals && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatCard label="Total Raw" value={fmtQty(data.totals.raw)} sub="pieces" />
            <StatCard label="In Coating" value={fmtQty(data.totals.in_coating)} sub="pieces" variant="accent" />
            <StatCard label="Finished" value={fmtQty(data.totals.finished)} sub="pieces" variant="success" />
            <StatCard label="Rejected" value={fmtQty(data.totals.rejected)} sub="pieces" variant="error" />
            <StatCard label="Dispatched" value={fmtQty(data.totals.dispatched)} sub="pieces" />
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Purchase</th>
                  <th>Supplier</th>
                  <th>Type/Shape</th>
                  <th>Rate</th>
                  <th>Raw</th>
                  <th>In Coating</th>
                  <th>Finished</th>
                  <th>Rejected</th>
                  <th>Dispatched</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {(data.stock || []).map(s => (
                  <tr key={s.id}>
                    <td><span className="tag">{s.purchase_code || '—'}</span></td>
                    <td className="text-sm text-muted">{s.supplier_name || '—'}</td>
                    <td className="text-sm">{[s.shape, s.diamond_type].filter(Boolean).join(' ') || '—'}</td>
                    <td>{s.rate ? fmtCurrency(s.rate) : '—'}</td>
                    <td style={{ fontWeight: 600 }}>{fmtQty(s.raw_quantity)}</td>
                    <td style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{fmtQty(s.in_coating_quantity)}</td>
                    <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtQty(s.finished_quantity)}</td>
                    <td style={{ color: 'var(--color-error)' }}>{fmtQty(s.rejected_quantity)}</td>
                    <td>{fmtQty(s.dispatched_quantity)}</td>
                    <td className="text-sm text-muted">{fmtDate(s.last_updated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Employee Report */}
      {activeTab === 'employee' && !loading && data.employees && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Salary Type</th>
                <th>Base Salary</th>
                <th>Jobs</th>
                <th>Completed</th>
                <th>Rejected</th>
                <th>Yield %</th>
                <th>OT Hours</th>
                <th>OT Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No data</td></tr>
              ) : data.employees.map(e => {
                const total = (e.total_completed || 0) + (e.total_rejected || 0);
                const yp = total > 0 ? ((e.total_completed / total) * 100).toFixed(1) : '—';
                return (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.full_name}</td>
                    <td><span className="tag">{e.employee_code}</span></td>
                    <td className="text-sm">{e.salary_type}</td>
                    <td>{fmtCurrency(e.base_salary)}</td>
                    <td>{e.total_jobs}</td>
                    <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtQty(e.total_completed)}</td>
                    <td style={{ color: 'var(--color-error)' }}>{fmtQty(e.total_rejected)}</td>
                    <td style={{ fontWeight: 600 }}>{yp}{yp !== '—' ? '%' : ''}</td>
                    <td>{e.overtime_hours} hrs</td>
                    <td>{fmtCurrency(e.overtime_amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Financial Report */}
      {activeTab === 'financial' && !loading && data.purchases !== undefined && (
        <>
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <StatCard label="Purchase Cost" value={fmtCurrency(data.purchases)} sub="diamonds purchased" variant="error" />
            <StatCard label="Received" value={fmtCurrency(data.payments_received)} sub="from customers" variant="success" />
            <StatCard label="Paid Out" value={fmtCurrency(data.payments_paid)} sub="to suppliers" variant="error" />
            <StatCard label="Salary Expense" value={fmtCurrency(data.salary_expense)} sub="total payroll" />
            <StatCard label="Net Cash Flow" value={fmtCurrency(data.payments_received - data.payments_paid - data.salary_expense)} variant={data.payments_received - data.payments_paid - data.salary_expense >= 0 ? 'success' : 'error'} />
          </div>

          <div className="card">
            <div className="card-header"><h3>By Customer</h3></div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Code</th>
                  <th>Received</th>
                  <th>Paid Out</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {data.by_customer?.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>No payment data</td></tr>
                )}
                {data.by_customer?.map(c => (
                  <tr key={c.party_code}>
                    <td style={{ fontWeight: 600 }}>{c.company_name}</td>
                    <td><span className="tag">{c.party_code}</span></td>
                    <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtCurrency(c.received)}</td>
                    <td style={{ color: 'var(--color-error)' }}>{fmtCurrency(c.paid)}</td>
                    <td style={{ fontWeight: 700, color: c.received - c.paid >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {fmtCurrency(c.received - c.paid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
