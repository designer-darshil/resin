import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, EmptyState, LoadingRows, Pagination, Modal } from '../components/ui.jsx';
import { fmtCurrency, debounce } from '../utils/helpers.js';

const INITIAL_FORM = {
  company_name: '', contact_person: '', phone: '', whatsapp_number: '',
  email: '', address: '', gst_number: '', opening_balance: 0,
  customer_type: 'supplier', notes: ''
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('customers', 'can_create') || hasPermission('purchases', 'can_create');

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50, type: 'supplier' };
      if (search) params.search = search;
      const res = await customersApi.list(params);
      setSuppliers(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const debouncedSearch = useCallback(
    debounce(v => { setSearch(v); setPage(1); }, 350),
    []
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim()) { toast.error('Supplier company name is required'); return; }
    setSaving(true);
    try {
      const created = await customersApi.create({
        ...form,
        customer_type: 'supplier',
        opening_balance: parseFloat(form.opening_balance) || 0
      });
      toast.success('Supplier created successfully');
      setShowModal(false);
      setForm(INITIAL_FORM);
      navigate(`/suppliers/${created.id}`);
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
        title="Suppliers & Vendors"
        subtitle="Manage diamond suppliers, source ledgers, and purchase history"
        actions={canCreate && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            + Add Supplier
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
            placeholder="Search supplier name, phone, party code…"
            onChange={e => debouncedSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table for Desktop */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Supplier / Company</th>
              <th>Contact Person</th>
              <th>Phone</th>
              <th className="num-col">Purchases</th>
              <th className="num-col">Payable Balance</th>
              <th className="action-col">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={7} rows={6} />
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title="No suppliers found"
                    description="Register your raw diamond suppliers to track incoming orders and outstanding balances."
                    action={canCreate && (
                      <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                        + Add Supplier
                      </button>
                    )}
                  />
                </td>
              </tr>
            ) : (
              suppliers.map(s => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/suppliers/${s.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {s.party_code}
                  </td>
                  <td style={{ fontWeight: 600 }}>{s.company_name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.contact_person || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.phone || '—'}</td>
                  <td className="num-col">{s.purchase_count || 0}</td>
                  <td className="num-col" style={{ fontWeight: 600, color: s.opening_balance > 0 ? 'var(--status-error)' : 'inherit' }}>
                    {fmtCurrency(s.opening_balance)}
                  </td>
                  <td className="action-col" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/suppliers/${s.id}`)}
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

      {/* Mobile Card List for 320px - 640px */}
      <div className="mobile-card-list">
        {suppliers.map(s => (
          <div key={s.id} className="mobile-card" onClick={() => navigate(`/suppliers/${s.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-accent" style={{ marginBottom: 4 }}>{s.party_code}</span>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.company_name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Payable</div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.opening_balance > 0 ? 'var(--status-error)' : 'inherit' }}>
                  {fmtCurrency(s.opening_balance)}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{s.contact_person || 'No contact person'}</span>
              <span>{s.phone || 'No phone'}</span>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />

      {/* Add Supplier Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Supplier"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Create Supplier'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Company / Supplier Name *</label>
            <input
              className="form-control"
              placeholder="e.g. Surat Diamond Corp"
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                className="form-control"
                placeholder="e.g. Rajesh Shah"
                value={form.contact_person}
                onChange={e => set('contact_person', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                className="form-control"
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">WhatsApp Number</label>
              <input
                className="form-control"
                placeholder="e.g. 9876543210"
                value={form.whatsapp_number}
                onChange={e => set('whatsapp_number', e.target.value)}
              />
            </div>
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
          </div>

          <div className="form-group">
            <label className="form-label">GST / Tax ID</label>
            <input
              className="form-control"
              placeholder="Optional GST Number"
              value={form.gst_number}
              onChange={e => set('gst_number', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea
              className="form-textarea"
              placeholder="Office / factory address"
              value={form.address}
              onChange={e => set('address', e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
