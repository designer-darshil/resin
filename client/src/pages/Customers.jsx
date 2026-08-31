import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, EmptyState, StatusBadge, LoadingRows, Pagination, Modal } from '../components/ui.jsx';
import { fmtCurrency, debounce } from '../utils/helpers.js';

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
      const created = await customersApi.create({
        ...form,
        opening_balance: parseFloat(form.opening_balance) || 0
      });
      toast.success('Party registered successfully');
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
        title="Buyers & Customer Parties"
        subtitle="Manage diamond coating clients, job history, and receivables"
        actions={canCreate && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            + Add Buyer Party
          </button>
        )}
      />

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search party name, phone, code…"
            onChange={e => debouncedSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Party Types</option>
          <option value="customer">Buyer / Customer</option>
          <option value="supplier">Supplier</option>
          <option value="both">Both (Buyer & Supplier)</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Company Name</th>
              <th>Type</th>
              <th>Contact Person</th>
              <th>Phone</th>
              <th className="num-col">Active Jobs</th>
              <th className="num-col">Receivable Balance</th>
              <th className="action-col">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={8} rows={6} />
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title="No parties found"
                    description="Register your customer parties to assign coating jobs and generate invoices."
                    action={canCreate && (
                      <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                        + Add Buyer Party
                      </button>
                    )}
                  />
                </td>
              </tr>
            ) : (
              customers.map(c => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/customers/${c.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {c.party_code}
                  </td>
                  <td style={{ fontWeight: 600 }}>{c.company_name}</td>
                  <td>
                    <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                      {c.customer_type}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.contact_person || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                  <td className="num-col">{c.job_count || 0}</td>
                  <td className="num-col" style={{ fontWeight: 600 }}>{fmtCurrency(c.opening_balance)}</td>
                  <td className="action-col" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    >
                      View Profile →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="mobile-card-list">
        {customers.map(c => (
          <div key={c.id} className="mobile-card" onClick={() => navigate(`/customers/${c.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-neutral" style={{ marginBottom: 4 }}>{c.party_code}</span>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.company_name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Balance</div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {fmtCurrency(c.opening_balance)}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{c.contact_person || 'No contact person'}</span>
              <span>{c.phone || 'No phone'}</span>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />

      {/* Add Party Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Add Customer / Buyer Party"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Create Party'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Company Name *</label>
            <input
              className="form-control"
              placeholder="e.g. Navkar Diamonds"
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Party Role</label>
              <select
                className="form-control"
                value={form.customer_type}
                onChange={e => set('customer_type', e.target.value)}
              >
                <option value="customer">Buyer / Customer</option>
                <option value="supplier">Supplier</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                className="form-control"
                placeholder="e.g. Anand Mehta"
                value={form.contact_person}
                onChange={e => set('contact_person', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                className="form-control"
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp Number</label>
              <input
                className="form-control"
                placeholder="e.g. 9876543210"
                value={form.whatsapp_number}
                onChange={e => set('whatsapp_number', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Opening Balance (₹)</label>
              <input
                className="form-control"
                type="number"
                placeholder="0"
                value={form.opening_balance}
                onChange={e => set('opening_balance', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">GST Number</label>
              <input
                className="form-control"
                placeholder="Optional GST"
                value={form.gst_number}
                onChange={e => set('gst_number', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea
              className="form-textarea"
              placeholder="Factory / trading office address"
              value={form.address}
              onChange={e => set('address', e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
