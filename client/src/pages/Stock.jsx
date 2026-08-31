import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { PageHeader, LoadingRows, Pagination } from '../components/ui.jsx';
import { fmtQty, fmtDate, debounce } from '../utils/helpers.js';

export default function StockPage() {
  const [stock, setStock] = useState([]);
  const [summary, setSummary] = useState({});
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [movLoading, setMovLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const loadStock = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const res = await stockApi.list(params);
      setStock(res.data);
      setSummary(res.summary || {});
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [search]);

  const loadMovements = useCallback(async () => {
    setMovLoading(true);
    try {
      const res = await stockApi.movements({ limit: 100 });
      setMovements(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setMovLoading(false); }
  }, []);

  useEffect(() => { loadStock(); }, [loadStock]);
  useEffect(() => { if (activeTab === 'movements') loadMovements(); }, [activeTab, loadMovements]);

  const debouncedSearch = useCallback(debounce(v => setSearch(v), 350), []);

  const movementLabel = {
    purchase_in: 'Inward Purchase',
    sent_to_coating: 'Allocated to Coating',
    coating_finished: 'Coating Finished',
    coating_rejected: 'Coating Rejected',
    dispatch_out: 'Dispatched to Party',
    adjustment: 'Inventory Adjustment',
  };

  return (
    <div className="page">
      <PageHeader
        title="Stock & Inventory Control"
        subtitle="Live multi-stage raw, in-coating, and finished stone ledger"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/purchases')}>
              + Receive Purchase
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/coating-jobs')}>
              + Allocate to Job
            </button>
          </div>
        }
      />

      {/* Operational Metrics Pipeline Strip */}
      <div className="stat-strip">
        <div className="stat-strip-item">
          <div className="stat-strip-label">Available Raw</div>
          <div className="stat-strip-value" style={{ color: 'var(--status-success)' }}>
            {fmtQty(summary.total_raw || 0)}
          </div>
          <div className="stat-strip-sub">Ready for coating</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">In Coating</div>
          <div className="stat-strip-value" style={{ color: 'var(--status-info)' }}>
            {fmtQty(summary.total_in_coating || 0)}
          </div>
          <div className="stat-strip-sub">Active batch work</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Finished & Ready</div>
          <div className="stat-strip-value" style={{ color: 'var(--color-primary)' }}>
            {fmtQty(summary.total_finished || 0)}
          </div>
          <div className="stat-strip-sub">Coated diamond stock</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Dispatched</div>
          <div className="stat-strip-value">
            {fmtQty(summary.total_dispatched || 0)}
          </div>
          <div className="stat-strip-sub">Delivered to buyers</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Rejected / Loss</div>
          <div className="stat-strip-value" style={{ color: summary.total_rejected > 0 ? 'var(--status-error)' : 'inherit' }}>
            {fmtQty(summary.total_rejected || 0)}
          </div>
          <div className="stat-strip-sub">QC reject count</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Live Inventory Ledger
        </button>
        <button className={`tab ${activeTab === 'movements' ? 'active' : ''}`} onClick={() => setActiveTab('movements')}>
          Stock Movements Log
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Toolbar */}
          <div className="toolbar">
            <div className="search-input-wrap">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="search-input"
                placeholder="Search diamond spec, shape, supplier, purchase code…"
                onChange={e => debouncedSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Master Inventory Table */}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Purchase Ref</th>
                  <th>Supplier Source</th>
                  <th>Diamond Specification</th>
                  <th>Shape / Size</th>
                  <th className="num-col">Available (Raw)</th>
                  <th className="num-col">In Coating</th>
                  <th className="num-col">Finished</th>
                  <th className="num-col">Dispatched</th>
                  <th className="action-col">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingRows cols={9} rows={6} />
                ) : stock.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No inventory records found. Inward stock from Purchases to populate.
                    </td>
                  </tr>
                ) : (
                  stock.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {s.purchase_code || '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.supplier_name || '—'}</td>
                      <td>{s.diamond_type || 'Standard'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {s.shape || 'Round'} {s.size ? `(${s.size})` : ''}
                      </td>
                      <td className="num-col" style={{ fontWeight: 700, color: s.raw_quantity > 0 ? 'var(--status-success)' : 'var(--text-muted)' }}>
                        {fmtQty(s.raw_quantity)} pcs
                      </td>
                      <td className="num-col" style={{ color: s.in_coating_quantity > 0 ? 'var(--status-info)' : 'var(--text-muted)' }}>
                        {fmtQty(s.in_coating_quantity)}
                      </td>
                      <td className="num-col" style={{ color: s.finished_quantity > 0 ? 'var(--color-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {fmtQty(s.finished_quantity)}
                      </td>
                      <td className="num-col" style={{ color: 'var(--text-secondary)' }}>
                        {fmtQty(s.dispatched_quantity)}
                      </td>
                      <td className="action-col">
                        {s.raw_quantity > 0 && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate('/coating-jobs')}
                          >
                            + Job
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="mobile-card-list">
            {stock.map(s => (
              <div key={s.id} className="mobile-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="badge badge-accent" style={{ marginBottom: 4 }}>{s.purchase_code || '—'}</span>
                    <div style={{ fontWeight: 700 }}>{s.supplier_name || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Available</div>
                    <div style={{ fontWeight: 700, color: 'var(--status-success)', fontFamily: 'var(--font-mono)' }}>
                      {fmtQty(s.raw_quantity)} pcs
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span>{s.shape} {s.diamond_type} {s.size}</span>
                  <span>In Coating: <strong>{fmtQty(s.in_coating_quantity)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'movements' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Movement Type</th>
                <th>Diamond Spec</th>
                <th className="num-col">Quantity</th>
                <th>Reference</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {movLoading ? (
                <LoadingRows cols={6} rows={6} />
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No stock movements recorded yet.
                  </td>
                </tr>
              ) : (
                movements.map(m => (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(m.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>
                      <span className="badge badge-neutral">
                        {movementLabel[m.movement_type] || m.movement_type}
                      </span>
                    </td>
                    <td>{m.diamond_type || 'Diamond'} {m.shape ? `(${m.shape})` : ''}</td>
                    <td className="num-col" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {fmtQty(m.quantity)} pcs
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                      {m.reference_code || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
