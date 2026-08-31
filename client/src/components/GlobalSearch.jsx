import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { debounce, fmtCurrency, fmtDate } from '../utils/helpers';

export default function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else if (window.openGlobalSearch) window.openGlobalSearch();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const performSearch = async (q) => {
    if (!q || q.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('resin_token') || localStorage.getItem('token');
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useRef(debounce(performSearch, 300)).current;

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    debouncedSearch(val);
  };

  const handleSelect = (path) => {
    onClose();
    navigate(path);
  };

  if (!isOpen) return null;

  const hasResults = results && results.total > 0;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ paddingTop: '8vh', alignItems: 'flex-start' }}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 640, borderRadius: 'var(--radius-lg)' }}
      >
        {/* Input Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)', gap: 10
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--text-primary)', fontFamily: 'var(--font-family)'
            }}
            placeholder="Search suppliers, buyers, jobs (JOB-1024), purchases, dispatches…"
            value={query}
            onChange={handleInputChange}
          />
          {loading && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Searching…</span>
          )}
          <kbd style={{
            fontSize: 10, background: 'var(--bg-subtle)', padding: '2px 5px',
            borderRadius: 4, color: 'var(--text-muted)', border: '1px solid var(--border-strong)',
            fontFamily: 'var(--font-mono)'
          }}>ESC</kbd>
        </div>

        {/* Results Body */}
        <div style={{ overflowY: 'auto', padding: '12px 16px', maxHeight: '60vh' }}>
          {!query && (
            <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Type at least 2 characters to search jobs, stock, parties, purchases…
            </div>
          )}

          {query && !loading && (!results || results.total === 0) && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No operational records match "<strong>{query}</strong>"
            </div>
          )}

          {hasResults && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Suppliers */}
              {results.results.suppliers?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Suppliers ({results.results.suppliers.length})
                  </div>
                  {results.results.suppliers.map(s => (
                    <div key={s.id} onClick={() => handleSelect(`/suppliers/${s.id}`)} className="search-result-row">
                      <span className="badge badge-accent" style={{ marginRight: 8 }}>{s.party_code}</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{s.company_name}</strong>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>{s.phone || 'Supplier'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Customers / Buyers */}
              {results.results.customers?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Customers / Buyers ({results.results.customers.length})
                  </div>
                  {results.results.customers.map(c => (
                    <div key={c.id} onClick={() => handleSelect(`/customers/${c.id}`)} className="search-result-row">
                      <span className="badge badge-neutral" style={{ marginRight: 8 }}>{c.party_code}</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{c.company_name}</strong>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>{c.phone || 'Buyer'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Coating Jobs */}
              {results.results.jobs?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--status-info)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Coating Jobs ({results.results.jobs.length})
                  </div>
                  {results.results.jobs.map(j => (
                    <div key={j.id} onClick={() => handleSelect(`/coating-jobs/${j.id}`)} className="search-result-row">
                      <span className="badge badge-info" style={{ marginRight: 8 }}>{j.job_code}</span>
                      <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{j.customer_name || 'In-House'}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {j.job_status.replace('_', ' ')} · {j.input_quantity} pcs
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Purchases */}
              {results.results.purchases?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--status-warning)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Purchases ({results.results.purchases.length})
                  </div>
                  {results.results.purchases.map(p => (
                    <div key={p.id} onClick={() => handleSelect(`/purchases/${p.id}`)} className="search-result-row">
                      <span className="badge badge-warning" style={{ marginRight: 8 }}>{p.purchase_code}</span>
                      <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{p.supplier_name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {fmtCurrency(p.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Dispatches */}
              {results.results.dispatches?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--status-success)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Dispatches ({results.results.dispatches.length})
                  </div>
                  {results.results.dispatches.map(d => (
                    <div key={d.id} onClick={() => handleSelect(`/dispatch`)} className="search-result-row">
                      <span className="badge badge-success" style={{ marginRight: 8 }}>{d.dispatch_code}</span>
                      <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{d.customer_name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {d.quantity} pcs · {fmtDate(d.dispatch_date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Employees */}
              {results.results.employees?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--status-neutral)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Employees ({results.results.employees.length})
                  </div>
                  {results.results.employees.map(e => (
                    <div key={e.id} onClick={() => handleSelect(`/employees/${e.id}`)} className="search-result-row">
                      <span className="badge badge-neutral" style={{ marginRight: 8 }}>{e.employee_code}</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{e.full_name}</strong>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {e.designation || e.department || 'Employee'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '8px 16px', background: 'var(--bg-subtle)',
          borderTop: '1px solid var(--border-subtle)', fontSize: 11,
          color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between'
        }}>
          <span>Press <strong>ESC</strong> to close</span>
          <span>Shortcut: <strong>⌘K</strong> / <strong>Ctrl+K</strong></span>
        </div>
      </div>

      <style>{`
        .search-result-row {
          display: flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: background 0.1s ease;
        }
        .search-result-row:hover {
          background: var(--bg-subtle);
        }
      `}</style>
    </div>
  );
}
