import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { customersApi, paymentsApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal } from '../components/ui.jsx';
import { fmtCurrency, fmtDate, fmtQty, today } from '../utils/helpers.js';

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
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'cash', payment_date: today(), notes: '', reference_number: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/whatsapp/templates', { 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('resin_token') || localStorage.getItem('token')}` 
        } 
      });
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
      toast.error('Party not found');
      navigate('/customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSendWhatsApp = () => {
    if (!customMessage.trim()) { toast.error('Enter a message'); return; }
    const phone = customer.whatsapp_number || customer.phone;
    if (!phone) { toast.error('No phone number'); return; }
    const num = phone.replace(/[^0-9]/g, '');
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
      toast.success('Party updated');
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
      toast.success('Payment received recorded');
      setShowPayModal(false);
      setPayForm({ amount: '', payment_method: 'cash', payment_date: today(), notes: '', reference_number: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="page">
      <div className="skeleton-line" style={{ height: 28, width: 220, marginBottom: 12 }} />
      <div className="skeleton-line" style={{ height: 90 }} />
    </div>
  );
  if (!customer) return null;

  return (
    <div className="page">
      {/* Breadcrumb Navigation */}
      <div className="breadcrumb">
        <Link to="/customers">Parties</Link>
        <span>/</span>
        <strong>{customer.company_name}</strong>
      </div>

      {/* Customer Profile Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">{customer.company_name}</h1>
            <span className="badge badge-accent">{customer.party_code}</span>
            <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{customer.customer_type}</span>
          </div>
          <p className="page-subtitle">
            Contact: {customer.contact_person || '—'} · {customer.phone || 'No phone'}
          </p>
        </div>

        <div className="page-header-actions">
          {customer.phone && (
            <button className="btn btn-secondary btn-sm" onClick={() => window.open(`tel:${customer.phone}`)}>
              📞 Call
            </button>
          )}
          {(customer.whatsapp_number || customer.phone) && (
            <button className="btn btn-whatsapp btn-sm" onClick={() => setShowWhatsAppModal(true)}>
              WhatsApp
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(true)}>
            Edit Details
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPayModal(true)}>
            Receive Payment
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/coating-jobs')}>
            + New Job
          </button>
        </div>
      </div>

      {/* Operational Stats */}
      <div className="stat-strip">
        <div className="stat-strip-item">
          <div className="stat-strip-label">Total Jobs</div>
          <div className="stat-strip-value">{customer.jobs?.length || 0}</div>
          <div className="stat-strip-sub">Processed batches</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Dispatched Pcs</div>
          <div className="stat-strip-value" style={{ color: 'var(--status-success)' }}>
            {fmtQty((customer.dispatches || []).reduce((s, d) => s + (d.quantity || 0), 0))}
          </div>
          <div className="stat-strip-sub">Finished stones</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Total Received</div>
          <div className="stat-strip-value" style={{ color: 'var(--status-success)' }}>
            {fmtCurrency(customer.total_received || 0)}
          </div>
          <div className="stat-strip-sub">Recorded collections</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-strip-label">Outstanding Balance</div>
          <div className="stat-strip-value">
            {fmtCurrency(customer.opening_balance || 0)}
          </div>
          <div className="stat-strip-sub">Receivable amount</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={`tab ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>
          Coating Jobs ({customer.jobs?.length || 0})
        </button>
        <button className={`tab ${activeTab === 'dispatches' ? 'active' : ''}`} onClick={() => setActiveTab('dispatches')}>
          Dispatches ({customer.dispatches?.length || 0})
        </button>
        <button className={`tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
          Payments
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.4fr)', gap: 'var(--space-6)' }}>
          <div className="panel">
            <div className="form-section-title" style={{ marginTop: 0 }}>Company Information</div>
            <div className="data-row">
              <span className="data-row-label">Party Name</span>
              <span className="data-row-value">{customer.company_name}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Code</span>
              <span className="data-row-value" style={{ fontFamily: 'var(--font-mono)' }}>{customer.party_code}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Contact Person</span>
              <span className="data-row-value">{customer.contact_person || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Phone</span>
              <span className="data-row-value">{customer.phone || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">WhatsApp</span>
              <span className="data-row-value">{customer.whatsapp_number || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">GST Number</span>
              <span className="data-row-value">{customer.gst_number || '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Address</span>
              <span className="data-row-value">{customer.address || '—'}</span>
            </div>
          </div>

          <div className="panel">
            <div className="form-section-title" style={{ marginTop: 0 }}>Recent Coating Batches</div>
            <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none', margin: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job Code</th>
                    <th>Date</th>
                    <th className="num-col">Input Qty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(customer.jobs || []).slice(0, 5).map(j => (
                    <tr key={j.id} onClick={() => navigate(`/coating-jobs/${j.id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {j.job_code}
                      </td>
                      <td>{fmtDate(j.coating_date)}</td>
                      <td className="num-col">{fmtQty(j.input_quantity)}</td>
                      <td><StatusBadge status={j.job_status} /></td>
                    </tr>
                  ))}
                  {(!customer.jobs || customer.jobs.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                        No coating jobs assigned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Jobs */}
      {activeTab === 'jobs' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job Code</th>
                <th>Coating Date</th>
                <th>Coating Type</th>
                <th className="num-col">Input Qty</th>
                <th className="num-col">Completed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(customer.jobs || []).map(j => (
                <tr key={j.id} onClick={() => navigate(`/coating-jobs/${j.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>{j.job_code}</td>
                  <td>{fmtDate(j.coating_date)}</td>
                  <td>{j.coating_type || 'Standard'}</td>
                  <td className="num-col">{fmtQty(j.input_quantity)}</td>
                  <td className="num-col">{fmtQty(j.completed_quantity)}</td>
                  <td><StatusBadge status={j.job_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Dispatches */}
      {activeTab === 'dispatches' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dispatch Code</th>
                <th>Date</th>
                <th className="num-col">Quantity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(customer.dispatches || []).map(d => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{d.dispatch_code}</td>
                  <td>{fmtDate(d.dispatch_date)}</td>
                  <td className="num-col">{fmtQty(d.quantity)} pcs</td>
                  <td><StatusBadge status={d.status} /></td>
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
                <th>Date</th>
                <th>Reference</th>
                <th>Method</th>
                <th className="num-col">Amount Received</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(customer.payments || []).map(p => (
                <tr key={p.id}>
                  <td>{fmtDate(p.payment_date)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{p.reference_number || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.payment_method}</td>
                  <td className="num-col" style={{ fontWeight: 600, color: 'var(--status-success)' }}>{fmtCurrency(p.amount)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Party Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Party Details"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form onSubmit={handleEdit}>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input className="form-control" value={form.company_name || ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input className="form-control" value={form.contact_person || ''} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">WhatsApp</label>
              <input className="form-control" value={form.whatsapp_number || ''} onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">GST</label>
              <input className="form-control" value={form.gst_number || ''} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-textarea" value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
        </form>
      </Modal>

      {/* Receive Payment Modal */}
      <Modal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        title={`Receive Payment from ${customer.company_name}`}
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPayModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handlePayment} disabled={saving}>
              {saving ? 'Saving…' : 'Record Received'}
            </button>
          </>
        }
      >
        <form onSubmit={handlePayment}>
          <div className="form-group">
            <label className="form-label">Amount (₹) *</label>
            <input className="form-control" type="number" placeholder="e.g. 25000" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="form-control" type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Method</label>
              <select className="form-control" value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* WhatsApp Modal */}
      <Modal
        open={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        title="Send WhatsApp Message"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowWhatsAppModal(false)}>Cancel</button>
            <button className="btn btn-whatsapp btn-sm" onClick={handleSendWhatsApp}>Open WhatsApp Chat</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Recipient Number</label>
          <input className="form-control" value={customer.whatsapp_number || customer.phone || ''} readOnly />
        </div>
        {templates.length > 0 && (
          <div className="form-group">
            <label className="form-label">Select Pre-Saved Template</label>
            <select className="form-control" value={selectedTemplate} onChange={handleTemplateSelect}>
              <option value="">-- Custom Message --</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Message</label>
          <textarea className="form-textarea" rows={4} value={customMessage} onChange={e => setCustomMessage(e.target.value)} placeholder="Type WhatsApp message..." />
        </div>
      </Modal>
    </div>
  );
}
