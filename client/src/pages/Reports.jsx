import { useState, useEffect } from 'react';
import { reportsApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { PageHeader, LoadingRows, EmptyState } from '../components/ui.jsx';
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
        setData(res || {});
      } else if (tab === 'stock') {
        const res = await reportsApi.stock();
        setData(res || {});
      } else if (tab === 'employee') {
        const res = await reportsApi.employee({ from_date: fromDate, to_date: toDate });
        setData(res || {});
      } else if (tab === 'financial') {
        const res = await reportsApi.financial({ from_date: fromDate, to_date: toDate });
        setData(res || {});
      }
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(activeTab); }, [activeTab, fromDate, toDate]);

  const tabs = [
    { id: 'production', label: 'Production & Yield' },
    { id: 'stock', label: 'Inventory Valuation' },
    { id: 'employee', label: 'Operator Performance' },
    { id: 'financial', label: 'Financial Summary' },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Reports &amp; Operational Analytics"
        subtitle="Business performance, coating yield percentages, stock valuation, and payroll summaries"
      />

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date filter toolbar */}
      {activeTab !== 'stock' && (
        <div className="toolbar" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>From:</span>
            <input
              className="filter-select"
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>To:</span>
            <input
              className="filter-select"
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => loadData(activeTab)}>
            Refresh Analysis
          </button>
        </div>
      )}

      {/* TAB 1: Production Report */}
      {activeTab === 'production' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num-col">Raw Received (pcs)</th>
                <th className="num-col">Coated Approved (pcs)</th>
                <th className="num-col">Rejected (pcs)</th>
                <th className="num-col">Dispatched (pcs)</th>
                <th className="num-col">Batch Yield %</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows cols={6} rows={6} />
              ) : !data.daily || data.daily.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No production activity in this date range" description="Select a broader date filter to analyze coating throughput." />
                  </td>
                </tr>
              ) : (
                data.daily.map(d => {
                  const yield_pct = d.coated > 0 && (d.coated + d.rejected) > 0
                    ? ((d.coated / (d.coated + d.rejected)) * 100).toFixed(1)
                    : '—';
                  return (
                    <tr key={d.date}>
                      <td style={{ fontWeight: 600 }}>{fmtDate(d.date)}</td>
                      <td className="num-col">{fmtQty(d.received)}</td>
                      <td className="num-col" style={{ color: 'var(--status-success)', fontWeight: 600 }}>
                        {fmtQty(d.coated)}
                      </td>
                      <td className="num-col" style={{ color: d.rejected > 0 ? 'var(--status-error)' : 'inherit' }}>
                        {fmtQty(d.rejected)}
                      </td>
                      <td className="num-col" style={{ color: 'var(--status-info)' }}>
                        {fmtQty(d.dispatched)}
                      </td>
                      <td className="num-col" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {yield_pct}{yield_pct !== '—' ? '%' : ''}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Stock Report */}
      {activeTab === 'stock' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Diamond Specification</th>
                <th>Cut / Shape</th>
                <th className="num-col">Available Raw (pcs)</th>
                <th className="num-col">In Production (pcs)</th>
                <th className="num-col">Ready Finished (pcs)</th>
                <th className="num-col">Total Dispatched (pcs)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows cols={6} rows={6} />
              ) : !data.items || data.items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No inventory items found" description="Receive raw diamond stock through purchases." />
                  </td>
                </tr>
              ) : (
                data.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{item.diamond_type} ({item.size || 'Standard'})</td>
                    <td>{item.shape || 'Round'}</td>
                    <td className="num-col" style={{ fontWeight: 600 }}>{fmtQty(item.raw_quantity)}</td>
                    <td className="num-col" style={{ color: 'var(--status-warning)' }}>{fmtQty(item.in_coating_quantity)}</td>
                    <td className="num-col" style={{ color: 'var(--status-success)', fontWeight: 600 }}>{fmtQty(item.finished_quantity)}</td>
                    <td className="num-col" style={{ color: 'var(--text-secondary)' }}>{fmtQty(item.dispatched_quantity)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Employee Performance */}
      {activeTab === 'employee' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Operator</th>
                <th className="num-col">Assigned Jobs</th>
                <th className="num-col">Completed Units</th>
                <th className="num-col">Defect / Rejects</th>
                <th className="num-col">Overtime Logged</th>
                <th className="num-col">Approval Rate %</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows cols={6} rows={6} />
              ) : !data.employees || data.employees.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No employee operations in this range" description="Assign operators to coating jobs to record performance metrics." />
                  </td>
                </tr>
              ) : (
                data.employees.map((emp, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{emp.full_name}</td>
                    <td className="num-col">{emp.jobs_count || 0}</td>
                    <td className="num-col" style={{ color: 'var(--status-success)', fontWeight: 600 }}>{fmtQty(emp.completed_qty || 0)} pcs</td>
                    <td className="num-col" style={{ color: emp.rejected_qty > 0 ? 'var(--status-error)' : 'inherit' }}>{fmtQty(emp.rejected_qty || 0)} pcs</td>
                    <td className="num-col">{emp.ot_hours || 0} hrs</td>
                    <td className="num-col" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {emp.completed_qty > 0 ? ((emp.completed_qty / (emp.completed_qty + (emp.rejected_qty || 0))) * 100).toFixed(1) + '%' : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: Financial Report */}
      {activeTab === 'financial' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Financial Ledger Line</th>
                <th className="num-col">Transaction Count</th>
                <th className="num-col">Total Volume</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows cols={3} rows={4} />
              ) : (
                <>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Raw Diamond Purchases</td>
                    <td className="num-col">{data.purchases_count || 0}</td>
                    <td className="num-col" style={{ color: 'var(--status-error)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      -{fmtCurrency(data.total_purchases || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Customer Collections / Inflow</td>
                    <td className="num-col">{data.received_count || 0}</td>
                    <td className="num-col" style={{ color: 'var(--status-success)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      +{fmtCurrency(data.total_received || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Operator Wages &amp; Overtime Paid</td>
                    <td className="num-col">{data.salaries_count || 0}</td>
                    <td className="num-col" style={{ color: 'var(--status-error)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      -{fmtCurrency(data.total_salaries || 0)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
