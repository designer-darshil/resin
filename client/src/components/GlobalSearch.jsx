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
    <div className="search-modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex',
      alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh'
    }}>
      <div className="search-modal" onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-surface, #1e1e24)', border: '1px solid var(--color-border, #333)',
        borderRadius: 12, width: '90%', maxWidth: 640, boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '75vh'
      }}>
        {/* Input Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '14px 18px',
          borderBottom: '1px solid var(--color-border, #333)', gap: 12
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted, #888)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            className="search-input"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 16, color: 'var(--color-text, #fff)'
            }}
            placeholder="Search suppliers, buyers, jobs (JOB-1024), purchases, dispatches..."
            value={query}
            onChange={handleInputChange}
          />
          {loading && <div className="spinner-sm" />}
          <kbd style={{
            fontSize: 11, background: 'var(--color-bg, #121216)', padding: '3px 6px',
            borderRadius: 4, color: 'var(--color-text-muted, #888)', border: '1px solid var(--color-border, #333)'
          }}>ESC</kbd>
        </div>

        {/* Results Body */}
        <div style={{ overflowY: 'auto', padding: '12px 16px' }}>
          {!query && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted, #888)', fontSize: 13 }}>
              Type at least 2 characters to search across all records...
            </div>
          )}

          {query && !loading && (!results || results.total === 0) && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-muted, #888)' }}>
              No results found for "<strong>{query}</strong>"
            </div>
          )}

          {hasResults && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Suppliers */}
              {results.results.suppliers?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-primary, #60a5fa)', marginBottom: 6 }}>
                    SUPPLIERS ({results.results.suppliers.length})
                  </div>
                  {results.results.suppliers.map(s => (
                    <div key={s.id} onClick={() => handleSelect(`/suppliers/${s.id}`)} className="search-result-row">
                      <span className="tag" style={{ marginRight: 8 }}>{s.party_code}</span>
                      <strong style={{ color: 'var(--color-text, #fff)' }}>{s.company_name}</strong>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted, #888)' }}>{s.phone || 'Supplier'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Customers / Buyers */}
              {results.results.customers?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-primary, #60a5fa)', marginBottom: 6 }}>
                    CUSTOMERS / BUYERS ({results.results.customers.length})
                  </div>
                  {results.results.customers.map(c => (
                    <div key={c.id} onClick={() => handleSelect(`/customers/${c.id}`)} className="search-result-row">
                      <span className="tag" style={{ marginRight: 8 }}>{c.party_code}</span>
                      <strong style={{ color: 'var(--color-text, #fff)' }}>{c.company_name}</strong>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted, #888)' }}>{c.phone || 'Customer'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Coating Jobs */}
              {results.results.jobs?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#10b981', marginBottom: 6 }}>
                    COATING JOBS ({results.results.jobs.length})
                  </div>
                  {results.results.jobs.map(j => (
                    <div key={j.id} onClick={() => handleSelect(`/coating-jobs/${j.id}`)} className="search-result-row">
                      <span className="tag" style={{ marginRight: 8 }}>{j.job_code}</span>
                      <span style={{ color: 'var(--color-text, #fff)' }}>{j.customer_name || 'No party'}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted, #888)', textTransform: 'capitalize' }}>
                        {j.job_status.replace('_', ' ')} · {j.input_quantity} pcs
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Purchases */}
              {results.results.purchases?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#f59e0b', marginBottom: 6 }}>
                    PURCHASES ({results.results.purchases.length})
                  </div>
                  {results.results.purchases.map(p => (
                    <div key={p.id} onClick={() => handleSelect(`/purchases/${p.id}`)} className="search-result-row">
                      <span className="tag" style={{ marginRight: 8 }}>{p.purchase_code}</span>
                      <span style={{ color: 'var(--color-text, #fff)' }}>{p.supplier_name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted, #888)' }}>
                        {fmtCurrency(p.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Dispatches */}
              {results.results.dispatches?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#8b5cf6', marginBottom: 6 }}>
                    DISPATCHES ({results.results.dispatches.length})
                  </div>
                  {results.results.dispatches.map(d => (
                    <div key={d.id} onClick={() => handleSelect(`/dispatch`)} className="search-result-row">
                      <span className="tag" style={{ marginRight: 8 }}>{d.dispatch_code}</span>
                      <span style={{ color: 'var(--color-text, #fff)' }}>{d.customer_name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted, #888)' }}>
                        {d.quantity} pcs · {fmtDate(d.dispatch_date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Employees */}
              {results.results.employees?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#ec4899', marginBottom: 6 }}>
                    EMPLOYEES ({results.results.employees.length})
                  </div>
                  {results.results.employees.map(e => (
                    <div key={e.id} onClick={() => handleSelect(`/employees/${e.id}`)} className="search-result-row">
                      <span className="tag" style={{ marginRight: 8 }}>{e.employee_code}</span>
                      <strong style={{ color: 'var(--color-text, #fff)' }}>{e.full_name}</strong>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted, #888)' }}>
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
          padding: '8px 16px', background: 'var(--color-bg, #121216)',
          borderTop: '1px solid var(--color-border, #333)', fontSize: 11,
          color: 'var(--color-text-muted, #888)', display: 'flex', justifyContent: 'space-between'
        }}>
          <span>Navigate with mouse or Tab</span>
          <span>Pro tip: Press <strong>Cmd+K</strong> anywhere</span>
        </div>
      </div>

      <style>{`
        .search-result-row {
          display: flex;
          align-items: center;
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.1s;
        }
        .search-result-row:hover {
          background: rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </div>
  );
}
