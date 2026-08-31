import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { customersApi, paymentsApi, purchasesApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, fmtQty, today } from '../utils/helpers.js';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [form, setForm] = useState({});
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'bank', payment_date: today(), notes: '', reference_number: '' });
  const [purchaseForm, setPurchaseForm] = useState({ purchase_date: today(), invoice_number: '', notes: '' });
  const [purchaseItems, setPurchaseItems] = useState([{ diamond_type: '', shape: 'Round', size: '', color: '', clarity: '', quantity: '', weight: '', rate: '', notes: '' }]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await customersApi.get(id);
      setSupplier(data);
      setForm({
        company_name: data.company_name, contact_person: data.contact_person || '',
        phone: data.phone || '', whatsapp_number: data.whatsapp_number || '',
        email: data.email || '', address: data.address || '',
        gst_number: data.gst_number || '', notes: data.notes || '',
        customer_type: data.customer_type || 'supplier',
      });
    } catch (err) {
      toast.error('Supplier not found');
      navigate('/suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await customersApi.update(id, form);
      toast.success('Supplier details updated');
      setShowEditModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!payForm.amount || !payForm.payment_date) { toast.error('Amount and date are required'); return; }
    setSaving(true);
    try {
      await paymentsApi.create({ ...payForm, customer_id: id, payment_direction: 'paid' });
      toast.success('Payment recorded');
      setShowPayModal(false);
      setPayForm({ amount: '', payment_method: 'bank', payment_date: today(), notes: '', reference_number: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePurchase = async (e) => {
    e.preventDefault();
    if (purchaseItems.some(i => !i.quantity || parseFloat(i.quantity) <= 0)) {
      toast.error('All items must have valid quantity'); return;
    }
    setSaving(true);
    try {
      const processed = purchaseItems.map(i => ({
        ...i,
        quantity: parseFloat(i.quantity) || 0,
        weight: parseFloat(i.weight) || 0,
        rate: parseFloat(i.rate) || 0,
        total_amount: (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0)
      }));
      await purchasesApi.create({
        ...purchaseForm,
        supplier_id: id,
        items: processed
      });
      toast.success('New purchase recorded');
      setShowPurchaseModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!customMessage.trim()) { toast.error('Enter a message'); return; }
    const phone = supplier.whatsapp_number || supplier.phone;
    if (!phone) { toast.error('No phone number available'); return; }

    try {
      const res = await fetch('/api/evolution/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('resin_token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          customer_id: id,
          phone_number: phone,
          message: customMessage,
          entity_type: 'supplier',
          entity_id: id
        })
      });
      if (res.ok) {
        toast.success('WhatsApp message sent');
      } else {
        const num = phone.replace(/[^0-9]/g, '');
        const fullNum = num.startsWith('91') ? num : `91${num}`;
        window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(customMessage)}`, '_blank');
        toast.info('Opened WhatsApp chat');
      }
    } catch {
      const num = phone.replace(/[^0-9]/g, '');
      const fullNum = num.startsWith('91') ? num : `91${num}`;
      window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(customMessage)}`, '_blank');
    }

    setShowWhatsAppModal(false);
    setCustomMessage('');
  };

  if (loading) return (
    <div className="page">
      <div className="skeleton-line" style={{ height: 28, width: 240, marginBottom: 12 }} />
      <div className="skeleton-line" style={{ height: 90, marginBottom: 20 }} />
    </div>
  );
  if (!supplier) return null;

  const totalPurchased = (supplier.purchases || []).reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const totalPaid = supplier.total_paid || 0;
  const outstanding = (supplier.opening_balance || 0) + totalPurchased - totalPaid;
  const activeStockPcs = (supplier.stock || []).reduce((sum, s) => sum + (s.raw_quantity || 0), 0);

  return (
    <div className="page">
      {/* Breadcrumb Navigation */}
      <div className="breadcrumb">
        <Link to="/suppliers">Suppliers</Link>
        <span>/</span>
        <strong>{supplier.company_name}</strong>
      </div>

      {/* Supplier Profile Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">{supplier.company_name}</h1>
            <span className="badge badge-accent">{supplier.party_code}</span>
            <span className="badge badge-neutral">Supplier</span>
          </div>
          <p className="page-subtitle">
            Contact: {supplier.contact_person || '—'} · {supplier.phone || 'No phone'}
          </p>
        </div>

        <div className="page-header-actions">
          {supplier.phone && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => window.open(`tel:${supplier.phone}`)}
            >
              📞 Call
            </button>
          )}
          {(supplier.whatsapp_number || supplier.phone) && (
            <button className="btn btn-whatsapp btn-sm" onClick={() => setShowWhatsAppModal(true)}>
              WhatsApp
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(true)}>
            Edit Details
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPayModal(true)}>
            Record Payment
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowPurchaseModal(true)}>
            + New Purchase
          </button>
        </div>
      </div>

      {/* Financial Snapshot Strip */}
      <div className="stat-strip">
        <div className="stat-strip-item">
          <div className="stat-strip-label">Total Purchased</div>
          <div className="stat-strip-value">{fmtCurrency(totalPurchased)}</div>
          <div className="stat-strip-sub">{supplier.purchases?.length || 0} purchase orders</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Total Paid</div>
          <div className="stat-strip-value" style={{ color: 'var(--status-success)' }}>
            {fmtCurrency(totalPaid)}
          </div>
          <div className="stat-strip-sub">Settled ledger</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Outstanding Balance</div>
          <div className="stat-strip-value" style={{ color: outstanding > 0 ? 'var(--status-error)' : 'inherit' }}>
            {fmtCurrency(outstanding)}
          </div>
          <div className="stat-strip-sub">Payable amount</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Active Raw Stock</div>
          <div className="stat-strip-value" style={{ color: 'var(--color-primary)' }}>
            {fmtQty(activeStockPcs)} pcs
          </div>
          <div className="stat-strip-sub">Available for coating</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={`tab ${activeTab === 'purchases' ? 'active' : ''}`} onClick={() => setActiveTab('purchases')}>
          Purchases ({supplier.purchases?.length || 0})
        </button>
        <button className={`tab ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>
          Stock Inventory ({supplier.stock?.length || 0})
        </button>
        <button className={`tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
          Payments
        </button>
        <button className={`tab ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => setActiveTab('whatsapp')}>
          WhatsApp Messages
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.4fr)', gap: 'var(--space-6)' }}>
          <div className="panel">
            <div className="form-section-title" style={{ marginTop: 0 }}>Supplier Information</div>
            <div className="data-row">
              <span className="data-row-label">Company Name</span>
              <span className="data-row-value">{supplier.company_name}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Party Code</span>
              <span className="data-row-value" style={{ fontFamily: 'var(--font-mono)' }}>{supplier.party_code}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Contact Person</span>
              <span className="data-row-value">{supplier.contact_person || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Phone</span>
              <span className="data-row-value">{supplier.phone || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">WhatsApp</span>
              <span className="data-row-value">{supplier.whatsapp_number || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Email</span>
              <span className="data-row-value">{supplier.email || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">GST / Tax ID</span>
              <span className="data-row-value">{supplier.gst_number || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Address</span>
              <span className="data-row-value">{supplier.address || '—'}</span>
            </div>
          </div>

          <div className="panel">
            <div className="form-section-title" style={{ marginTop: 0 }}>Recent Purchases</div>
            <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none', margin: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Date</th>
                    <th className="num-col">Items</th>
                    <th className="num-col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(supplier.purchases || []).slice(0, 5).map(p => (
                    <tr key={p.id} onClick={() => navigate(`/purchases/${p.id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {p.purchase_code}
                      </td>
                      <td>{fmtDate(p.purchase_date)}</td>
                      <td className="num-col">{p.item_count || 1}</td>
                      <td className="num-col" style={{ fontWeight: 600 }}>{fmtCurrency(p.total_amount)}</td>
                    </tr>
                  ))}
                  {(!supplier.purchases || supplier.purchases.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                        No purchase records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Purchases */}
      {activeTab === 'purchases' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Purchase Code</th>
                <th>Date</th>
                <th>Invoice Ref</th>
                <th className="num-col">Items</th>
                <th className="num-col">Total Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(supplier.purchases || []).map(p => (
                <tr key={p.id} onClick={() => navigate(`/purchases/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {p.purchase_code}
                  </td>
                  <td>{fmtDate(p.purchase_date)}</td>
                  <td>{p.invoice_number || '—'}</td>
                  <td className="num-col">{p.item_count || 1}</td>
                  <td className="num-col" style={{ fontWeight: 600 }}>{fmtCurrency(p.total_amount)}</td>
                  <td><StatusBadge status={p.payment_status || 'completed'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Stock */}
      {activeTab === 'stock' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Diamond Spec</th>
                <th>Shape / Size</th>
                <th className="num-col">Raw Pcs</th>
                <th className="num-col">In Coating</th>
                <th className="num-col">Finished</th>
              </tr>
            </thead>
            <tbody>
              {(supplier.stock || []).map(st => (
                <tr key={st.id}>
                  <td style={{ fontWeight: 600 }}>{st.diamond_type || 'Diamond'}</td>
                  <td>{st.shape || 'Round'} · {st.size || '—'}</td>
                  <td className="num-col" style={{ fontWeight: 600 }}>{fmtQty(st.raw_quantity)}</td>
                  <td className="num-col">{fmtQty(st.in_coating_quantity)}</td>
                  <td className="num-col">{fmtQty(st.finished_quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Payments */}
      {activeTab === 'payments' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment Date</th>
                <th>Reference</th>
                <th>Method</th>
                <th className="num-col">Amount Paid</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(supplier.payments || []).map(pay => (
                <tr key={pay.id}>
                  <td>{fmtDate(pay.payment_date)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{pay.reference_number || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{pay.payment_method}</td>
                  <td className="num-col" style={{ fontWeight: 600, color: 'var(--status-success)' }}>
                    {fmtCurrency(pay.amount)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{pay.notes || '—'}</td>
                </tr>
              ))}
              {(!supplier.payments || supplier.payments.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No payment transactions recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: WhatsApp */}
      {activeTab === 'whatsapp' && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontWeight: 600 }}>WhatsApp Communication Log</span>
            <button className="btn btn-whatsapp btn-sm" onClick={() => setShowWhatsAppModal(true)}>
              + Send Direct Message
            </button>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            All automated purchase confirmations and delivery alerts sent to this supplier are logged in the WhatsApp module.
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        title={`Record Payment to ${supplier.company_name}`}
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPayModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handlePayment} disabled={saving}>
              {saving ? 'Saving…' : 'Record Payment'}
            </button>
          </>
        }
      >
        <form onSubmit={handlePayment}>
          <div className="form-group">
            <label className="form-label">Payment Amount (₹) *</label>
            <input
              className="form-control"
              type="number"
              placeholder="e.g. 50000"
              value={payForm.amount}
              onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Payment Date *</label>
              <input
                className="form-control"
                type="date"
                value={payForm.payment_date}
                onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select
                className="form-control"
                value={payForm.payment_method}
                onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}
              >
                <option value="bank">Bank Transfer / NEFT / RTGS</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reference Number (UTR / Cheque No)</label>
            <input
              className="form-control"
              placeholder="Optional transaction reference"
              value={payForm.reference_number}
              onChange={e => setPayForm(f => ({ ...f, reference_number: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              placeholder="Payment remarks"
              value={payForm.notes}
              onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </form>
      </Modal>

      {/* WhatsApp Message Modal */}
      <Modal
        open={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        title={`Send WhatsApp Message to ${supplier.company_name}`}
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowWhatsAppModal(false)}>Cancel</button>
            <button className="btn btn-whatsapp btn-sm" onClick={handleSendWhatsApp}>
              Send via WhatsApp
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Target Phone Number</label>
          <input className="form-control" value={supplier.whatsapp_number || supplier.phone || ''} readOnly />
        </div>
        <div className="form-group">
          <label className="form-label">Message Content</label>
          <textarea
            className="form-textarea"
            rows={5}
            placeholder="Type message to supplier..."
            value={customMessage}
            onChange={e => setCustomMessage(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
