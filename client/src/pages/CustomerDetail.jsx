import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { customersApi, paymentsApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, WhatsAppButton, Modal } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, fmtQty } from '../utils/helpers.js';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [form, setForm] = useState({});
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0], notes: '', reference_number: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/whatsapp/templates', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      const tmplData = await res.json();
      if (tmplData.data) setTemplates(tmplData.data);
      
      const data = await customersApi.get(id);
      setCustomer(data);
      setForm({
        company_name: data.company_name, contact_person: data.contact_person || '',
        phone: data.phone || '', whatsapp_number: data.whatsapp_number || '',
        email: data.email || '', address: data.address || '',
        gst_number: data.gst_number || '', notes: data.notes || '',
        customer_type: data.customer_type || 'customer',
      });
    } catch (err) {
      toast.error('Customer not found');
      navigate('/customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSendWhatsApp = () => {
    if (!customMessage.trim()) { toast.error('Enter a message'); return; }
    const num = customer.whatsapp_number.replace(/[^0-9]/g, '');
    const fullNum = num.startsWith('91') ? num : `91${num}`;
    window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(customMessage)}`, '_blank');
    setShowWhatsAppModal(false);
    setCustomMessage('');
    setSelectedTemplate('');
  };

  const handleTemplateSelect = (e) => {
    const tmplId = e.target.value;
    setSelectedTemplate(tmplId);
    if (tmplId) {
      const tmpl = templates.find(t => t.id === parseInt(tmplId));
      if (tmpl) {
        let text = tmpl.message_template;
        text = text.replace(/\{customer_name\}/g, customer.company_name);
        // Replace other vars with placeholders if any
        setCustomMessage(text);
      }
    } else {
      setCustomMessage('');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await customersApi.update(id, form);
      toast.success('Customer updated');
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
      await paymentsApi.create({ ...payForm, customer_id: id, payment_direction: 'received' });
      toast.success('Payment recorded');
      setShowPayModal(false);
      setPayForm({ amount: '', payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0], notes: '', reference_number: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (loading) return <div className="page"><div className="skeleton skeleton-line" style={{ height: 32, width: 300, marginBottom: 16 }} /></div>;
  if (!customer) return null;

  const whatsAppMsg = `Hello ${customer.company_name}, `;

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/customers">Parties</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{customer.company_name}</span>
      </div>

      <PageHeader
        title={customer.company_name}
        subtitle={`${customer.party_code} · ${customer.customer_type}`}
        actions={<>
          {hasPermission('customers', 'can_edit') && (
            <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>Edit</button>
          )}
          {hasPermission('payments', 'can_create') && (
            <button className="btn btn-primary" onClick={() => setShowPayModal(true)}>+ Payment</button>
          )}
          {customer.whatsapp_number && (
            <button className="btn btn-whatsapp" onClick={() => setShowWhatsAppModal(true)}>📱 WhatsApp Message</button>
          )}
        </>}
      />

      {/* Info Cards (Document Style) */}
      <div className="detail-grid" style={{ marginBottom: 24 }}>
        <div className="detail-section">
          <h2 className="detail-section-title">Party Information</h2>
          <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
            <div>
              <div className="detail-field">
                <div className="detail-field-label">Contact Person</div>
                <div className="detail-field-value">{customer.contact_person || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Phone</div>
                <div className="detail-field-value">{customer.phone || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">WhatsApp</div>
                <div className="detail-field-value">{customer.whatsapp_number || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Email</div>
                <div className="detail-field-value">{customer.email || '—'}</div>
              </div>
            </div>
            <div>
              <div className="detail-field">
                <div className="detail-field-label">Address</div>
                <div className="detail-field-value">{customer.address || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">GST Number</div>
                <div className="detail-field-value">{customer.gst_number || '—'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Opening Balance</div>
                <div className="detail-field-value">{fmtCurrency(customer.opening_balance)}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Total Paid</div>
                <div className="detail-field-value text-success">{fmtCurrency(customer.total_paid)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['overview','purchases','jobs','dispatches','payments'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'purchases' && (
        <div>
          {customer.purchases?.length === 0 && <p className="text-muted">No purchases recorded.</p>}
          {customer.purchases?.map(p => (
            <div key={p.id} className="data-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="font-semibold">{p.purchase_code}</span>
                <StatusBadge status={p.status} />
              </div>
              <div className="data-card-row"><span className="data-card-label">Date</span><span>{fmtDate(p.purchase_date)}</span></div>
              <div className="data-card-row"><span className="data-card-label">Amount</span><span>{fmtCurrency(p.total_amount)}</span></div>
              <div className="data-card-row"><span className="data-card-label">Invoice</span><span>{p.invoice_number || '—'}</span></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'jobs' && (
        <div>
          {customer.coating_jobs?.length === 0 && <p className="text-muted">No coating jobs.</p>}
          {customer.coating_jobs?.map(j => (
            <div key={j.id} className="data-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="font-semibold">{j.job_code}</span>
                <StatusBadge status={j.job_status} />
              </div>
              <div className="data-card-row"><span className="data-card-label">Input</span><span>{fmtQty(j.input_quantity)} pcs</span></div>
              <div className="data-card-row"><span className="data-card-label">Completed</span><span>{fmtQty(j.completed_quantity)} pcs</span></div>
              <div className="data-card-row"><span className="data-card-label">Date</span><span>{fmtDate(j.coating_date)}</span></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'dispatches' && (
        <div>
          {customer.dispatches?.length === 0 && <p className="text-muted">No dispatches.</p>}
          {customer.dispatches?.map(d => (
            <div key={d.id} className="data-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="font-semibold">{d.dispatch_code}</span>
                <StatusBadge status={d.status} />
              </div>
              <div className="data-card-row"><span className="data-card-label">Quantity</span><span>{fmtQty(d.quantity)} pcs</span></div>
              <div className="data-card-row"><span className="data-card-label">Date</span><span>{fmtDate(d.dispatch_date)}</span></div>
              {d.job_code && <div className="data-card-row"><span className="data-card-label">Job</span><span>{d.job_code}</span></div>}
              {customer.whatsapp_number && (
                <div className="data-card-actions">
                  <WhatsAppButton size="sm" phone={customer.whatsapp_number}
                    message={`Hello ${customer.company_name}, your order ${d.dispatch_code} has been dispatched on ${fmtDate(d.dispatch_date)}. Quantity: ${fmtQty(d.quantity)} pcs. Thank you!`}
                    label="Send Dispatch Update" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'payments' && (
        <div>
          {customer.payments?.length === 0 && <p className="text-muted">No payments recorded.</p>}
          {customer.payments?.map(p => (
            <div key={p.id} className="data-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="font-semibold">{p.payment_code}</span>
                <span className="text-success font-semibold">{fmtCurrency(p.amount)}</span>
              </div>
              <div className="data-card-row"><span className="data-card-label">Date</span><span>{fmtDate(p.payment_date)}</span></div>
              <div className="data-card-row"><span className="data-card-label">Method</span><span className="text-capitalize">{p.payment_method}</span></div>
              <div className="data-card-row"><span className="data-card-label">Ref</span><span>{p.reference_number || '—'}</span></div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Party"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input className="form-control" value={form.company_name} onChange={e => set('company_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Person</label>
            <input className="form-control" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">WhatsApp</label>
            <input className="form-control" value={form.whatsapp_number} onChange={e => set('whatsapp_number', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <textarea className="form-control" rows="2" value={form.address} onChange={e => set('address', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-control" rows="2" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal open={showPayModal} onClose={() => setShowPayModal(false)} title="Record Payment"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePayment} disabled={saving}>{saving ? 'Saving…' : 'Save Payment'}</button>
        </>}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Amount (₹) <span className="required">*</span></label>
            <input className="form-control" type="number" inputMode="numeric" step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Date <span className="required">*</span></label>
            <input className="form-control" type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Method</label>
            <select className="form-control" value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Reference Number</label>
            <input className="form-control" value={payForm.reference_number} onChange={e => setPayForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="UPI ref / cheque no." />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-control" rows="2" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>

      {/* Inline WhatsApp Modal */}
      <Modal open={showWhatsAppModal} onClose={() => setShowWhatsAppModal(false)} title={`Message ${customer?.company_name}`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowWhatsAppModal(false)}>Cancel</button>
          <button className="btn btn-whatsapp" onClick={handleSendWhatsApp}>Open WhatsApp</button>
        </>}>
        <div className="form-group">
          <label className="form-label">Template (Optional)</label>
          <select className="form-control" value={selectedTemplate} onChange={handleTemplateSelect}>
            <option value="">No template (write custom message)</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Message Content</label>
          <textarea className="form-control" rows="8" value={customMessage} onChange={e => setCustomMessage(e.target.value)} placeholder="Type your message here..." />
        </div>
        <div className="info-box">
          This will open WhatsApp Web or Desktop with the pre-filled message to {customer?.whatsapp_number}.
        </div>
      </Modal>
    </div>
  );
}
