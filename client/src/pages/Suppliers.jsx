import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, EmptyState, LoadingRows, LoadingCards, Pagination, Modal } from '../components/ui.jsx';
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
    if (!form.company_name.trim()) { toast.error('Supplier name is required'); return; }
    setSaving(true);
    try {
      const created = await customersApi.create({ ...form, customer_type: 'supplier', opening_balance: parseFloat(form.opening_balance) || 0 });
      toast.success('Supplier added successfully');
      setShowModal(false);
      setForm(INITIAL_FORM);
      // Auto-open supplier profile!
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
        title="Suppliers"
        subtitle={`${total} registered diamond suppliers`}
        actions={canCreate && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Supplier</button>
        )}
      />

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input className="search-input" placeholder="Search supplier name, phone, code…" onChange={e => debouncedSearch(e.target.value)} />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Supplier / Company</th>
              <th>Contact Person</th>
              <th>Phone / WhatsApp</th>
              <th>Purchases</th>
              <th>Outstanding</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRows cols={7} rows={5} /> : suppliers.map(s => (
              <tr key={s.id}>
                <td><span className="tag">{s.party_code}</span></td>
                <td style={{ fontWeight: 600 }}>{s.company_name}</td>
                <td className="text-muted">{s.contact_person || '—'}</td>
                <td>
                  <div>{s.phone || '—'}</div>
                  {s.whatsapp_number && <div style={{ fontSize: 11, color: '#25d366' }}>📱 {s.whatsapp_number}</div>}
                </td>
                <td>{s.purchase_count || 0} purchases</td>
                <td style={{ fontWeight: 600, color: s.opening_balance > 0 ? 'var(--color-error)' : 'inherit' }}>
                  {fmtCurrency(s.opening_balance)}
                </td>
                <td className="col-actions">
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/suppliers/${s.id}`)}>View Profile</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && suppliers.length === 0 && (
          <EmptyState
            title="No suppliers found"
            description="Add your first diamond supplier to start tracking purchases and payments"
            action={canCreate && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Supplier</button>}
          />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      {/* Mobile Cards */}
      <div className="data-cards">
        {loading ? <LoadingCards /> : suppliers.map(s => (
          <div key={s.id} className="data-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div className="data-card-title">{s.company_name}</div>
                <span className="tag">{s.party_code}</span>
              </div>
              <span className="text-sm font-semibold">{s.purchase_count || 0} orders</span>
            </div>
            <div className="data-card-row">
              <span className="data-card-label">Contact</span>
              <span className="data-card-value">{s.contact_person || '—'}</span>
            </div>
            <div className="data-card-row">
              <span className="data-card-label">Phone</span>
              <span className="data-card-value">{s.phone || s.whatsapp_number || '—'}</span>
            </div>
            <div className="data-card-row">
              <span className="data-card-label">Balance</span>
              <span className="data-card-value">{fmtCurrency(s.opening_balance)}</span>
            </div>
            <div className="data-card-actions">
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/suppliers/${s.id}`)}>
                Open Profile
              </button>
            </div>
          </div>
        ))}
        {!loading && suppliers.length === 0 && (
          <EmptyState
            title="No suppliers yet"
            description="Add a supplier to start tracking purchases and payments"
            action={canCreate && <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Supplier</button>}
          />
        )}
        <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
      </div>

      {/* Add Supplier Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Supplier" size="large"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Supplier'}</button>
        </>}>
        <form onSubmit={handleSave}>
          <div className="form-section-title">Basic Information</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Supplier Name <span className="required">*</span></label>
              <input className="form-control" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="e.g. Surat Diamond Merchants" />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input className="form-control" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Full Name" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" type="tel" inputMode="numeric" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Mobile number" />
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp Number</label>
              <input className="form-control" type="tel" inputMode="numeric" value={form.whatsapp_number} onChange={e => set('whatsapp_number', e.target.value)} placeholder="For automated updates" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="Optional" />
            </div>
            <div className="form-group">
              <label className="form-label">GST Number</label>
              <input className="form-control" value={form.gst_number} onChange={e => set('gst_number', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-control" rows="2" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Business / Office address" />
          </div>

          <div className="form-section-title" style={{ marginTop: 16 }}>Financial &amp; Notes</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Opening Balance (₹)</label>
              <input className="form-control" type="number" inputMode="numeric" step="0.01" value={form.opening_balance} onChange={e => set('opening_balance', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Payment terms, specialties, etc." />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
