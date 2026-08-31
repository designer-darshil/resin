import { useState, useEffect, useCallback } from 'react';
import { stockApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { PageHeader, StatCard, LoadingRows, LoadingCards, Modal } from '../components/ui.jsx';
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

  const loadStock = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const res = await stockApi.list(params);
      setStock(res.data);
      setSummary(res.summary);
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
    purchase_in: '📦 Purchase In',
    sent_to_coating: '🔵 Sent to Coating',
    coating_finished: '✅ Coating Finished',
    coating_rejected: '❌ Coating Rejected',
    dispatch_out: '🚚 Dispatched',
    adjustment: '🔧 Adjustment',
  };

  return (
    <div className="page">
      <PageHeader title="Stock Management" subtitle="Live inventory across all stages" />

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard label="Raw Diamond" value={fmtQty(summary.total_raw)} sub="pieces available" />
        <StatCard label="In Coating" value={fmtQty(summary.total_in_coating)} sub="pieces" variant="accent" />
        <StatCard label="Finished" value={fmtQty(summary.total_finished)} sub="pieces ready" variant="success" />
        <StatCard label="Rejected" value={fmtQty(summary.total_rejected)} sub="pieces" variant="error" />
        <StatCard label="Dispatched" value={fmtQty(summary.total_dispatched)} sub="pieces out" />
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Stock Overview</button>
        <button className={`tab ${activeTab === 'movements' ? 'active' : ''}`} onClick={() => setActiveTab('movements')}>Movements Log</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="toolbar">
            <div className="search-input-wrap">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input className="search-input" placeholder="Search diamond type, shape, size…" onChange={e => debouncedSearch(e.target.value)} />
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Purchase</th>
                  <th>Type</th>
                  <th>Shape</th>
                  <th>Size</th>
                  <th>Color</th>
                  <th>Supplier</th>
                  <th>Raw</th>
                  <th>In Coating</th>
                  <th>Finished</th>
                  <th>Rejected</th>
                  <th>Dispatched</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <LoadingRows cols={11} rows={5} /> : stock.map(s => (
                  <tr key={s.id}>
                    <td><span className="tag">{s.purchase_code || '—'}</span></td>
                    <td>{s.diamond_type || '—'}</td>
                    <td>{s.shape || '—'}</td>
                    <td>{s.size || '—'}</td>
                    <td>{s.color || '—'}</td>
                    <td className="text-muted text-sm">{s.supplier_name || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{fmtQty(s.raw_quantity)}</td>
                    <td style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{fmtQty(s.in_coating_quantity)}</td>
                    <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtQty(s.finished_quantity)}</td>
                    <td style={{ color: 'var(--color-error)' }}>{fmtQty(s.rejected_quantity)}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{fmtQty(s.dispatched_quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && stock.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <p>No stock records. Create a purchase and receive stock to see it here.</p>
              </div>
            )}
          </div>

          <div className="data-cards">
            {loading ? <LoadingCards /> : stock.map(s => (
              <div key={s.id} className="data-card">
                <div className="data-card-title">{s.diamond_type || 'Diamond'} — {s.shape}</div>
                <div style={{ marginBottom: 4 }}><span className="tag">{s.purchase_code}</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  {[
                    { label: 'Raw', value: s.raw_quantity, color: '' },
                    { label: 'In Coating', value: s.in_coating_quantity, color: 'var(--color-accent)' },
                    { label: 'Finished', value: s.finished_quantity, color: 'var(--color-success)' },
                    { label: 'Rejected', value: s.rejected_quantity, color: 'var(--color-error)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: 'var(--color-bg)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--color-text-primary)' }}>{fmtQty(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'movements' && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>Type</th>
                  <th>Diamond</th>
                  <th>Quantity</th>
                  <th>From → To</th>
                  <th>Job/Dispatch</th>
                  <th>By</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {movLoading ? <LoadingRows cols={8} rows={5} /> : movements.map(m => (
                  <tr key={m.id}>
                    <td className="text-sm">{fmtDate(m.created_at, 'short')}</td>
                    <td><span className="text-sm">{movementLabel[m.movement_type] || m.movement_type}</span></td>
                    <td className="text-sm">{[m.shape, m.diamond_type].filter(Boolean).join(' ') || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{fmtQty(m.quantity)}</td>
                    <td className="text-sm text-muted">{m.from_status || '—'} → {m.to_status || '—'}</td>
                    <td className="text-sm">{m.job_code || m.dispatch_code || '—'}</td>
                    <td className="text-sm text-muted">{m.created_by_name || '—'}</td>
                    <td className="text-sm text-muted">{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="data-cards">
            {movLoading ? <LoadingCards /> : movements.map(m => (
              <div key={m.id} className="data-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="text-sm">{movementLabel[m.movement_type] || m.movement_type}</span>
                  <span className="font-bold">{fmtQty(m.quantity)} pcs</span>
                </div>
                <div className="data-card-row"><span className="data-card-label">Diamond</span><span>{[m.shape, m.diamond_type].filter(Boolean).join(' ') || '—'}</span></div>
                <div className="data-card-row"><span className="data-card-label">Flow</span><span>{m.from_status || '—'} → {m.to_status || '—'}</span></div>
                <div className="data-card-row"><span className="data-card-label">Date</span><span>{fmtDate(m.created_at)}</span></div>
                <div className="data-card-row"><span className="data-card-label">By</span><span>{m.created_by_name || '—'}</span></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
