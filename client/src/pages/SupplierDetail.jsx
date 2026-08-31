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
  const [activeTab, setActiveTab] = useState('purchases');
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
      toast.success('Payment to supplier recorded');
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
      // Try backend Evolution Go send first
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
      const data = await res.json();
      if (res.ok) {
        toast.success('WhatsApp message sent successfully');
      } else {
        // Fallback to wa.me
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

  if (loading) return <div className="page"><div className="skeleton skeleton-line" style={{ height: 32, width: 300, marginBottom: 16 }} /></div>;
  if (!supplier) return null;

  const totalPurchased = (supplier.purchases || []).reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const totalPaid = supplier.total_paid || 0;
  const outstanding = (supplier.opening_balance || 0) + totalPurchased - totalPaid;

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/suppliers">Suppliers</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{supplier.company_name}</span>
      </div>

      <PageHeader
        title={supplier.company_name}
        subtitle={`${supplier.party_code} · Diamond Supplier`}
        actions={<>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>Edit Supplier</button>
          <button className="btn btn-secondary" onClick={() => setShowPayModal(true)}>Record Payment</button>
          <button className="btn btn-primary" onClick={() => setShowPurchaseModal(true)}>+ New Purchase</button>
          {(supplier.whatsapp_number || supplier.phone) && (
            <button className="btn btn-whatsapp" onClick={() => setShowWhatsAppModal(true)}>📱 WhatsApp</button>
          )}
        </>}
      />

      {/* Overview Stat Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Purchases</div>
          <div className="stat-card-value">{fmtCurrency(totalPurchased)}</div>
          <div className="stat-card-sub">{supplier.purchases?.length || 0} orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Paid</div>
          <div className="stat-card-value text-success">{fmtCurrency(totalPaid)}</div>
          <div className="stat-card-sub">Recorded payments</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Outstanding Balance</div>
          <div className="stat-card-value text-error">{fmtCurrency(outstanding)}</div>
          <div className="stat-card-sub">Payable amount</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Phone &amp; Contact</div>
          <div className="stat-card-value" style={{ fontSize: 16 }}>{supplier.phone || '—'}</div>
          <div className="stat-card-sub">{supplier.contact_person || 'No contact person'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['purchases','payments','info'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'purchases' ? 'Purchases History' : t === 'payments' ? 'Payment History' : 'Supplier Info'}
          </button>
        ))}
      </div>

      {/* Tab 1: Purchases */}
      {activeTab === 'purchases' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Date</th>
                <th>Invoice</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(supplier.purchases || []).map(p => (
                <tr key={p.id}>
                  <td><span className="tag">{p.purchase_code}</span></td>
                  <td>{fmtDate(p.purchase_date)}</td>
                  <td className="text-muted">{p.invoice_number || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmtCurrency(p.total_amount)}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="col-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/purchases/${p.id}`)}>View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!supplier.purchases || supplier.purchases.length === 0) && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No purchases recorded yet. Click <strong>+ New Purchase</strong> above.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Payments */}
      {activeTab === 'payments' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Date</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Amount Paid</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(supplier.payments || []).map(p => (
                <tr key={p.id}>
                  <td><span className="tag">{p.payment_code}</span></td>
                  <td>{fmtDate(p.payment_date)}</td>
                  <td className="text-capitalize">{p.payment_method}</td>
                  <td>{p.reference_number || '—'}</td>
                  <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>{fmtCurrency(p.amount)}</td>
                  <td className="text-muted">{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!supplier.payments || supplier.payments.length === 0) && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No payments recorded yet. Click <strong>Record Payment</strong> above.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Supplier Info */}
      {activeTab === 'info' && (
        <div className="detail-section">
          <div className="grid-2" style={{ gap: 24 }}>
            <div>
              <div className="detail-field">
                <div className="detail-field-label">Company Name</div>
                <div className="detail-field-value">{supplier.company_name}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Contact Person</div>
                <div className="detail-field-value">{supplier.contact_person || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Phone</div>
                <div className="detail-field-value">{supplier.phone || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">WhatsApp Number</div>
                <div className="detail-field-value">{supplier.whatsapp_number || '—'}</div>
              </div>
            </div>
            <div>
              <div className="detail-field">
                <div className="detail-field-label">Email</div>
                <div className="detail-field-value">{supplier.email || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">GST Number</div>
                <div className="detail-field-value">{supplier.gst_number || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Address</div>
                <div className="detail-field-value">{supplier.address || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Notes</div>
                <div className="detail-field-value">{supplier.notes || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Purchase Modal */}
      <Modal open={showPurchaseModal} onClose={() => setShowPurchaseModal(false)} title={`New Purchase from ${supplier.company_name}`} size="large"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowPurchaseModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreatePurchase} disabled={saving}>{saving ? 'Saving…' : 'Create Purchase'}</button>
        </>}>
        <form onSubmit={handleCreatePurchase}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Purchase Date <span className="required">*</span></label>
              <input className="form-control" type="date" value={purchaseForm.purchase_date} onChange={e => setPurchaseForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Invoice Number</label>
              <input className="form-control" value={purchaseForm.invoice_number} onChange={e => setPurchaseForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="Optional" />
            </div>
          </div>

          <div className="form-section-title" style={{ marginTop: 16 }}>Diamond Details</div>
          {purchaseItems.map((item, i) => (
            <div key={i} style={{ background: 'var(--color-bg)', padding: 12, borderRadius: 8, marginBottom: 10, border: '1px solid var(--color-border)' }}>
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Diamond Type</label>
                  <input className="form-control" value={item.diamond_type} onChange={e => {
                    const val = e.target.value;
                    setPurchaseItems(prev => prev.map((it, idx) => idx === i ? { ...it, diamond_type: val } : it));
                  }} placeholder="Natural / Lab" />
                </div>
                <div className="form-group">
                  <label className="form-label">Shape</label>
                  <select className="form-control" value={item.shape} onChange={e => {
                    const val = e.target.value;
                    setPurchaseItems(prev => prev.map((it, idx) => idx === i ? { ...it, shape: val } : it));
                  }}>
                    {['Round','Princess','Oval','Marquise','Pear','Emerald','Asscher','Radiant','Heart','Cushion','Other'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Size / Sieve</label>
                  <input className="form-control" value={item.size} onChange={e => {
                    const val = e.target.value;
                    setPurchaseItems(prev => prev.map((it, idx) => idx === i ? { ...it, size: val } : it));
                  }} placeholder="e.g. +11-15" />
                </div>
              </div>
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Quantity (pcs) <span className="required">*</span></label>
                  <input className="form-control" type="number" inputMode="numeric" value={item.quantity} onChange={e => {
                    const val = e.target.value;
                    setPurchaseItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: val } : it));
                  }} placeholder="Pcs" />
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (ct)</label>
                  <input className="form-control" type="number" step="0.001" value={item.weight} onChange={e => {
                    const val = e.target.value;
                    setPurchaseItems(prev => prev.map((it, idx) => idx === i ? { ...it, weight: val } : it));
                  }} placeholder="Carats" />
                </div>
                <div className="form-group">
                  <label className="form-label">Rate (₹/pc)</label>
                  <input className="form-control" type="number" value={item.rate} onChange={e => {
                    const val = e.target.value;
                    setPurchaseItems(prev => prev.map((it, idx) => idx === i ? { ...it, rate: val } : it));
                  }} placeholder="Rate" />
                </div>
              </div>
            </div>
          ))}
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal open={showPayModal} onClose={() => setShowPayModal(false)} title={`Pay to ${supplier.company_name}`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePayment} disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
        </>}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Amount (₹) <span className="required">*</span></label>
            <input className="form-control" type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Date <span className="required">*</span></label>
            <input className="form-control" type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="form-control" value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
              <option value="bank">Bank Transfer / RTGS</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Reference / UTR</label>
            <input className="form-control" value={payForm.reference_number} onChange={e => setPayForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="Cheque / UTR no." />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-control" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
        </div>
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Supplier"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleEdit} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </>}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input className="form-control" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Person</label>
            <input className="form-control" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-control" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">WhatsApp</label>
            <input className="form-control" value={form.whatsapp_number} onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <textarea className="form-control" rows="2" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </div>
      </Modal>

      {/* Direct WhatsApp Modal */}
      <Modal open={showWhatsAppModal} onClose={() => setShowWhatsAppModal(false)} title={`Message ${supplier.company_name}`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowWhatsAppModal(false)}>Cancel</button>
          <button className="btn btn-whatsapp" onClick={handleSendWhatsApp}>Send WhatsApp</button>
        </>}>
        <div className="form-group">
          <label className="form-label">Message Content</label>
          <textarea className="form-control" rows="6" value={customMessage} onChange={e => setCustomMessage(e.target.value)} placeholder={`Hello ${supplier.company_name}, ...`} />
        </div>
        <div className="info-box">
          Sending to: <strong>{supplier.whatsapp_number || supplier.phone}</strong> via Evolution Go backend service.
        </div>
      </Modal>
    </div>
  );
}
