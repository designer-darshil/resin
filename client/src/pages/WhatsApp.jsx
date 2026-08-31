import { useState, useEffect, useCallback } from 'react';
import { whatsappApi, customersApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, Modal, EmptyState } from '../components/ui.jsx';
import { fmtDate } from '../utils/helpers.js';

export default function WhatsAppPage() {
  const [templates, setTemplates] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('send');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', category: 'order_update', message_template: '', variables: '' });
  const [vars, setVars] = useState({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { isAdmin } = useAuth();

  const load = useCallback(async () => {
    try {
      const [tmpl, cust] = await Promise.all([whatsappApi.templates(), customersApi.list({ limit: 200 })]);
      setTemplates(tmpl.data);
      setCustomers(cust.data.filter(c => c.whatsapp_number));
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  const loadLogs = async () => {
    try {
      const res = await whatsappApi.logs({ limit: 50 });
      setLogs(res.data);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (activeTab === 'logs') loadLogs(); }, [activeTab]);

  // Extract {variables} from template
  const extractVars = (template) => {
    const matches = template.match(/\{(\w+)\}/g) || [];
    return [...new Set(matches.map(m => m.slice(1, -1)))];
  };

  const buildMessage = (template, variables) => {
    return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] || `{${key}}`);
  };

  const handleOpenSend = (tmpl) => {
    setSelectedTemplate(tmpl);
    const varKeys = extractVars(tmpl.message_template);
    const initial = {};
    varKeys.forEach(k => { initial[k] = ''; });
    if (selectedCustomer) initial['customer_name'] = selectedCustomer.company_name;
    setVars(initial);
    setShowSendModal(true);
  };

  const handleSend = async () => {
    if (!selectedCustomer) { toast.error('Select a customer to send to'); return; }
    const msg = buildMessage(selectedTemplate.message_template, vars);
    const phone = selectedCustomer.whatsapp_number;
    const num = phone.replace(/[^0-9]/g, '');
    const fullNum = num.startsWith('91') ? num : `91${num}`;
    window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(msg)}`, '_blank');

    // Log the send
    try {
      await whatsappApi.log({ template_id: selectedTemplate.id, customer_id: selectedCustomer.id, message_sent: msg, status: 'sent' });
    } catch {}

    setShowSendModal(false);
    toast.success('WhatsApp opened!');
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.message_template) { toast.error('Name and template are required'); return; }
    setSaving(true);
    try {
      await whatsappApi.createTemplate(form);
      toast.success('Template saved');
      setShowTemplateModal(false);
      setForm({ name: '', category: 'order_update', message_template: '', variables: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const previewVars = selectedTemplate ? extractVars(selectedTemplate.message_template) : [];

  const categoryIcons = {
    order_update: '📦', payment_reminder: '💰', dispatch_notification: '🚚',
    quality_update: '✅', general: '💬'
  };

  return (
    <div className="page">
      <PageHeader
        title="WhatsApp"
        subtitle="Message templates and communication log"
        actions={isAdmin && <button className="btn btn-primary" onClick={() => setShowTemplateModal(true)}>+ New Template</button>}
      />

      <div className="tabs">
        <button className={`tab ${activeTab === 'send' ? 'active' : ''}`} onClick={() => setActiveTab('send')}>Send Message</button>
        <button className={`tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>Templates</button>
        <button className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>Message Logs</button>
      </div>

      {activeTab === 'send' && (
        <div>
          {/* Customer Select */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><h3>Select Customer</h3></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Customer (with WhatsApp)</label>
                <select className="form-control" value={selectedCustomer?.id || ''} onChange={e => {
                  const c = customers.find(c => c.id === parseInt(e.target.value));
                  setSelectedCustomer(c || null);
                }}>
                  <option value="">Select customer…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.company_name} — {c.whatsapp_number}</option>)}
                </select>
              </div>
              {selectedCustomer && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div>
                    <strong>{selectedCustomer.company_name}</strong>
                    <div className="text-sm text-muted">📱 {selectedCustomer.whatsapp_number}</div>
                  </div>
                  <button className="btn btn-whatsapp btn-sm" onClick={() => {
                    const num = selectedCustomer.whatsapp_number.replace(/[^0-9]/g, '');
                    window.open(`https://wa.me/${num.startsWith('91') ? num : '91' + num}`, '_blank');
                  }}>Open Chat</button>
                </div>
              )}
            </div>
          </div>

          {/* Template List */}
          <h3 className="section-title" style={{ marginBottom: 16 }}>Choose a Template</h3>
          {loading && <p className="text-muted">Loading templates…</p>}
          {!loading && templates.length === 0 && (
            <EmptyState title="No templates" description="Create WhatsApp message templates for quick sending" action={
              isAdmin && <button className="btn btn-primary" onClick={() => setShowTemplateModal(true)}>Create Template</button>
            } />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {templates.map(tmpl => (
              <div key={tmpl.id} className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontSize: 24 }}>{categoryIcons[tmpl.category] || '💬'}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{tmpl.name}</div>
                      <div className="text-xs text-muted">{tmpl.category.replace('_', ' ')}</div>
                    </div>
                  </div>
                  <div style={{
                    background: 'var(--color-bg)', borderRadius: 8, padding: 10,
                    fontSize: 13, color: 'var(--color-text-secondary)',
                    maxHeight: 80, overflow: 'hidden', marginBottom: 12,
                    whiteSpace: 'pre-wrap', lineHeight: 1.5
                  }}>
                    {tmpl.message_template}
                  </div>
                  <button
                    className="btn btn-whatsapp btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => handleOpenSend(tmpl)}
                    disabled={!selectedCustomer}
                  >
                    {selectedCustomer ? `Send to ${selectedCustomer.company_name}` : 'Select customer first'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div>
          {templates.map(tmpl => (
            <div key={tmpl.id} className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>{categoryIcons[tmpl.category] || '💬'}</span>
                  <div>
                    <h3>{tmpl.name}</h3>
                    <div className="text-xs text-muted">{tmpl.category.replace('_', ' ')}</div>
                  </div>
                </div>
              </div>
              <div className="card-body">
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, background: 'var(--color-bg)', padding: 12, borderRadius: 8, lineHeight: 1.6 }}>
                  {tmpl.message_template}
                </pre>
                {extractVars(tmpl.message_template).length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {extractVars(tmpl.message_template).map(v => (
                      <span key={v} className="tag">{`{${v}}`}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'logs' && (
        <div>
          {logs.length === 0 && <EmptyState title="No logs yet" description="Messages you send through the app will appear here" />}
          {logs.map(l => (
            <div key={l.id} className="data-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div className="data-card-title">{l.customer_name || '—'}</div>
                  <div className="text-xs text-muted">{fmtDate(l.created_at)}</div>
                </div>
                <span className="badge badge-success">Sent</span>
              </div>
              <div className="text-sm" style={{ background: 'var(--color-bg)', padding: 10, borderRadius: 6, whiteSpace: 'pre-wrap' }}>{l.message_sent}</div>
            </div>
          ))}
        </div>
      )}

      {/* Send Modal */}
      <Modal open={showSendModal} onClose={() => setShowSendModal(false)} title={`Send: ${selectedTemplate?.name}`} size="large"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowSendModal(false)}>Cancel</button>
          <button className="btn btn-whatsapp" onClick={handleSend}>📱 Open WhatsApp &amp; Send</button>
        </>}>
        {selectedTemplate && (
          <>
            {previewVars.length > 0 && (
              <div className="form-section" style={{ marginBottom: 16 }}>
                <div className="form-section-title">Fill in Variables</div>
                {previewVars.map(v => (
                  <div key={v} className="form-group">
                    <label className="form-label">{v.replace(/_/g, ' ')}</label>
                    <input className="form-control" value={vars[v] || ''} onChange={e => setVars(prev => ({ ...prev, [v]: e.target.value }))} placeholder={`{${v}}`} />
                  </div>
                ))}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Preview</label>
              <div style={{
                background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 12,
                padding: 16, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6,
                fontFamily: 'inherit', color: '#166534', maxHeight: 240, overflow: 'auto'
              }}>
                {buildMessage(selectedTemplate.message_template, vars)}
              </div>
            </div>
            <div className="info-box">
              Clicking "Open WhatsApp" will open WhatsApp with this pre-filled message to {selectedCustomer?.company_name} ({selectedCustomer?.whatsapp_number}).
            </div>
          </>
        )}
      </Modal>

      {/* Create Template Modal */}
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title="Create Template"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowTemplateModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveTemplate} disabled={saving}>{saving ? 'Saving…' : 'Save Template'}</button>
        </>}>
        <div className="form-group">
          <label className="form-label">Template Name <span className="required">*</span></label>
          <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Dispatch Notification" />
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-control" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            <option value="order_update">Order Update</option>
            <option value="payment_reminder">Payment Reminder</option>
            <option value="dispatch_notification">Dispatch Notification</option>
            <option value="quality_update">Quality Update</option>
            <option value="general">General</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Message Template <span className="required">*</span></label>
          <textarea className="form-control" rows="6" value={form.message_template} onChange={e => setForm(f => ({ ...f, message_template: e.target.value }))}
            placeholder={'Hello {customer_name},\n\nYour order {order_id} has been dispatched.\n\nQuantity: {quantity} pcs\nTracking: {tracking_number}\n\nThank you!'} />
          <div className="form-hint">Use {`{variable_name}`} for dynamic values that will be filled in before sending</div>
        </div>
        {form.message_template && extractVars(form.message_template).length > 0 && (
          <div className="info-box">
            Variables detected: {extractVars(form.message_template).map(v => <span key={v} className="tag" style={{ marginLeft: 4 }}>{`{${v}}`}</span>)}
          </div>
        )}
      </Modal>
    </div>
  );
}
