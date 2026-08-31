import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, EmptyState, StatusBadge, LoadingRows, LoadingCards, Pagination, Modal } from '../components/ui.jsx';
import { fmtCurrency, debounce, today } from '../utils/helpers.js';

const INITIAL_FORM = {
  company_name: '', contact_person: '', phone: '', whatsapp_number: '',
  email: '', address: '', gst_number: '', opening_balance: 0,
  customer_type: 'customer', notes: ''
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('customers', 'can_create');

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const res = await customersApi.list(params);
      setCustomers(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const debouncedSearch = useCallback(
    debounce(v => { setSearch(v); setPage(1); }, 350),
    []
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim()) { toast.error('Company name is required'); return; }
    setSaving(true);
    try {
      const created = await customersApi.create({ ...form, opening_balance: parseFloat(form.opening_balance) || 0 });
      toast.success('Party created successfully');
      setShowModal(false);
      setForm(INITIAL_FORM);
      navigate(`/customers/${created.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <PageHeader
        title="Parties"
        subtitle={`${total} records`}
        actions={canCreate && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Party</button>
        )}
      />

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input className="search-input" placeholder="Search name, phone, code…" onChange={e => debouncedSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="customer">Customer</option>
          <option value="supplier">Supplier</option>
          <option value="both">Both</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Company / Name</th>
              <th>Contact</th>
              <th>Phone / WhatsApp</th>
              <th>Type</th>
              <th>Balance</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRows cols={7} rows={5} /> : customers.map(c => (
              <tr key={c.id}>
                <td><span className="tag">{c.party_code}</span></td>
                <td style={{ fontWeight: 500 }}>{c.company_name}</td>
                <td className="text-muted">{c.contact_person || '—'}</td>
                <td>
                  <div>{c.phone || '—'}</div>
                  {c.whatsapp_number && <div style={{ fontSize: 11, color: '#25d366' }}>📱 {c.whatsapp_number}</div>}
                </td>
                <td><StatusBadge status={c.customer_type} /></td>
                <td>{fmtCurrency(c.opening_balance)}</td>
                <td className="col-actions">
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/customers/${c.id}`)}>View</button>
                    {c.whatsapp_number && (
                      <button className="btn btn-whatsapp btn-sm" onClick={() => {
                        const num = c.whatsapp_number.replace(/[^0-9]/g, '');
                        window.open(`https://wa.me/${num.startsWith('91') ? num : '91' + num}`, '_blank');
                      }}>WA</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && customers.length === 0 && (
          <EmptyState title="No parties found" description="Add your first customer or supplier party" action={
            canCreate && <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Party</button>
          } />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      {/* Mobile Cards */}
      <div className="data-cards">
        {loading ? <LoadingCards /> : customers.map(c => (
          <div key={c.id} className="data-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div className="data-card-title">{c.company_name}</div>
                <span className="tag">{c.party_code}</span>
              </div>
              <StatusBadge status={c.customer_type} />
            </div>
            <div className="data-card-row">
              <span className="data-card-label">Contact</span>
              <span className="data-card-value">{c.contact_person || '—'}</span>
            </div>
            <div className="data-card-row">
              <span className="data-card-label">Phone</span>
              <span className="data-card-value">{c.phone || '—'}</span>
            </div>
            <div className="data-card-row">
              <span className="data-card-label">Balance</span>
              <span className="data-card-value">{fmtCurrency(c.opening_balance)}</span>
            </div>
            <div className="data-card-actions">
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/customers/${c.id}`)}>View</button>
              {c.whatsapp_number && (
                <button className="btn btn-whatsapp btn-sm" onClick={() => {
                  const num = c.whatsapp_number.replace(/[^0-9]/g, '');
                  window.open(`https://wa.me/${num.startsWith('91') ? num : '91' + num}`, '_blank');
                }}>WhatsApp</button>
              )}
            </div>
          </div>
        ))}
        {!loading && customers.length === 0 && (
          <EmptyState title="No parties found" description="Add your first party" action={
            canCreate && <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Party</button>
          } />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      {/* Create Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Party"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Party'}</button>
        </>}>
        <form onSubmit={handleSave}>
          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Company / Name <span className="required">*</span></label>
                <input className="form-control" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="e.g. ABC Diamonds" />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-control" value={form.customer_type} onChange={e => set('customer_type', e.target.value)}>
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input className="form-control" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Name" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-control" type="tel" inputMode="numeric" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Mobile number" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">WhatsApp Number</label>
                <input className="form-control" type="tel" inputMode="numeric" value={form.whatsapp_number} onChange={e => set('whatsapp_number', e.target.value)} placeholder="If different from phone" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea className="form-control" rows="2" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Business address" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">GST Number</label>
                <input className="form-control" value={form.gst_number} onChange={e => set('gst_number', e.target.value)} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="form-label">Opening Balance (₹)</label>
                <input className="form-control" type="number" inputMode="numeric" step="0.01" value={form.opening_balance} onChange={e => set('opening_balance', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" rows="2" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes" />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
