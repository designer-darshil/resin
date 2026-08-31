import { useState, useEffect, useCallback } from 'react';
import { whatsappApi, customersApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal, EmptyState } from '../components/ui.jsx';
import { fmtDate } from '../utils/helpers.js';

export default function WhatsAppPage() {
  const [activeTab, setActiveTab] = useState('connection');
  const [connectionStatus, setConnectionStatus] = useState({ status: 'checking', instance: 'resin' });
  const [qrCode, setQrCode] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [pollingStatus, setPollingStatus] = useState(false);
  
  // Automations & Settings
  const [automations, setAutomations] = useState([]);
  const [settings, setSettings] = useState({
    whatsapp_automation_enabled: '0',
    whatsapp_test_mode: '0',
    whatsapp_require_approval: '0'
  });
  
  // Templates
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', category: 'order_update', template_body: '' });
  
  // Logs
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('');
  
  // Test Message
  const [testForm, setTestForm] = useState({ phone_number: '', message: 'Test message from Resin ERP WhatsApp Automation' });
  const [sendingTest, setSendingTest] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { isAdmin } = useAuth();

  // Load connection status
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/evolution/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setConnectionStatus(data);
      if (data.status === 'connected') {
        setShowQRModal(false);
        setPollingStatus(false);
      }
    } catch {
      setConnectionStatus({ status: 'disconnected', instance: 'resin' });
    }
  }, []);

  // Load automations & settings
  const loadAutomations = useCallback(async () => {
    try {
      const [autoRes, setRes, tmplRes] = await Promise.all([
        fetch('/api/evolution/automations', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
        fetch('/api/evolution/settings', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
        whatsappApi.templates()
      ]);
      const autoData = await autoRes.json();
      const setData = await setRes.json();
      setAutomations(autoData.data || []);
      if (setData.data) setSettings(setData.data);
      setTemplates(tmplRes.data || []);
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

  // Load logs
  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/logs', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setLogs(data.data || []);
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadAutomations();
    setLoading(false);
  }, [loadStatus, loadAutomations]);

  useEffect(() => {
    if (activeTab === 'logs') loadLogs();
    if (activeTab === 'automations') loadAutomations();
    if (activeTab === 'connection') loadStatus();
  }, [activeTab, loadLogs, loadAutomations, loadStatus]);

  // Polling for QR / status
  useEffect(() => {
    let interval;
    if (pollingStatus && showQRModal) {
      interval = setInterval(() => {
        loadStatus();
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [pollingStatus, showQRModal, loadStatus]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/evolution/connect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.qrcode) {
        setQrCode(data.qrcode);
        setShowQRModal(true);
        setPollingStatus(true);
      } else {
        toast.info('Initiated connection. Checking status...');
        loadStatus();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect WhatsApp?')) return;
    try {
      await fetch('/api/evolution/disconnect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('WhatsApp disconnected');
      loadStatus();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testForm.phone_number.trim()) { toast.error('Enter phone number'); return; }
    setSendingTest(true);
    try {
      const res = await fetch('/api/evolution/test-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(testForm)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Test message sent successfully');
      } else {
        toast.error(data.error || 'Failed to send test message');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingTest(false);
    }
  };

  const handleToggleSetting = async (key, val) => {
    const newVal = val ? '1' : '0';
    setSettings(prev => ({ ...prev, [key]: newVal }));
    try {
      await fetch('/api/evolution/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ [key]: newVal })
      });
      toast.success('Setting updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleAutomation = async (autoId, isEnabled, templateId) => {
    try {
      await fetch(`/api/evolution/automations/${autoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ is_enabled: isEnabled ? 1 : 0, template_id: templateId })
      });
      setAutomations(prev => prev.map(a => a.id === autoId ? { ...a, is_enabled: isEnabled ? 1 : 0, template_id: templateId } : a));
      toast.success('Automation updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRetryLog = async (logId) => {
    try {
      const res = await fetch(`/api/evolution/logs/${logId}/retry`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        toast.success('Message retried successfully');
        loadLogs();
      } else {
        toast.error('Retry failed');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!templateForm.name || !templateForm.template_body) {
      toast.error('Name and message template are required'); return;
    }
    setSaving(true);
    try {
      await whatsappApi.createTemplate(templateForm);
      toast.success('Template saved');
      setShowTemplateModal(false);
      setTemplateForm({ name: '', category: 'order_update', template_body: '' });
      loadAutomations();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Sample preview helper
  const renderPreview = (body) => {
    if (!body) return '';
    return body
      .replace(/\{\{party_name\}\}/g, 'ABC Diamonds')
      .replace(/\{\{supplier_name\}\}/g, 'Surat Diamond Merchants')
      .replace(/\{\{buyer_name\}\}/g, 'ABC Diamonds')
      .replace(/\{\{job_number\}\}/g, 'JOB-1024')
      .replace(/\{\{purchase_number\}\}/g, 'PUR-1024')
      .replace(/\{\{quantity\}\}/g, '120')
      .replace(/\{\{weight\}\}/g, '4.50')
      .replace(/\{\{coating_type\}\}/g, 'Standard Resin')
      .replace(/\{\{due_date\}\}/g, '31 Aug 2026')
      .replace(/\{\{dispatch_number\}\}/g, 'DSP-1024')
      .replace(/\{\{dispatch_date\}\}/g, '31 Aug 2026')
      .replace(/\{\{tracking_number\}\}/g, 'TRK-9821')
      .replace(/\{\{amount\}\}/g, '1,20,000')
      .replace(/\{\{payment_method\}\}/g, 'Bank Transfer')
      .replace(/\{\{payment_reference\}\}/g, 'UTR-82910')
      .replace(/\{\{balance\}\}/g, '45,000');
  };

  const isConnected = connectionStatus.status === 'connected';

  return (
    <div className="page">
      <PageHeader
        title="WhatsApp Automation"
        subtitle="Powered by Evolution Go messaging transport engine"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isConnected ? 'var(--color-success, #10b981)' : 'var(--color-error, #ef4444)'
              }} />
              <span style={{ fontWeight: 600, color: isConnected ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {isAdmin && activeTab === 'templates' && (
              <button className="btn btn-primary" onClick={() => setShowTemplateModal(true)}>+ New Template</button>
            )}
          </div>
        }
      />

      {/* Main Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab ${activeTab === 'connection' ? 'active' : ''}`} onClick={() => setActiveTab('connection')}>Connection &amp; Settings</button>
        <button className={`tab ${activeTab === 'automations' ? 'active' : ''}`} onClick={() => setActiveTab('automations')}>Automations ({automations.filter(a => a.is_enabled).length} Active)</button>
        <button className={`tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>Templates ({templates.length})</button>
        <button className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>Message Logs</button>
      </div>

      {/* TAB 1: Connection & Settings */}
      {activeTab === 'connection' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Connection Status Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="section-title">Evolution Go Transport Status</h3>
            </div>
            <div className="card-body" style={{ lineHeight: 1.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Instance Name</span>
                <strong>{connectionStatus.instance || 'resin'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-muted">Transport Status</span>
                <span className={`tag ${isConnected ? 'tag-success' : 'tag-error'}`}>
                  {connectionStatus.status.toUpperCase()}
                </span>
              </div>
              {connectionStatus.ownerJid && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span className="text-muted">Paired Number</span>
                  <strong>{connectionStatus.ownerJid.split('@')[0]}</strong>
                </div>
              )}

              <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                {!isConnected ? (
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConnect}>
                    📱 Connect WhatsApp (Scan QR)
                  </button>
                ) : (
                  <>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={loadStatus}>
                      🔄 Refresh Status
                    </button>
                    <button className="btn btn-danger" onClick={handleDisconnect}>
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Master Controls & Safety Settings */}
          <div className="card">
            <div className="card-header">
              <h3 className="section-title">Automation Safety &amp; Modes</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <strong>Master Automation Toggle</strong>
                  <div className="text-xs text-muted">Enable automatic event messaging when business events occur</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.whatsapp_automation_enabled === '1'}
                  onChange={e => handleToggleSetting('whatsapp_automation_enabled', e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <strong>Test Mode (Dry Run)</strong>
                  <div className="text-xs text-muted">Logs messages to DB without transmitting to Evolution Go</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.whatsapp_test_mode === '1'}
                  onChange={e => handleToggleSetting('whatsapp_test_mode', e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                <div>
                  <strong>Require Manual Approval</strong>
                  <div className="text-xs text-muted">Queue automated messages for admin review before sending</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.whatsapp_require_approval === '1'}
                  onChange={e => handleToggleSetting('whatsapp_require_approval', e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Test Message Card */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <h3 className="section-title">Send Direct Test Message</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSendTest} className="grid-2" style={{ gap: 16 }}>
                <div>
                  <div className="form-group">
                    <label className="form-label">Recipient Phone Number <span className="required">*</span></label>
                    <input
                      className="form-control"
                      type="tel"
                      value={testForm.phone_number}
                      onChange={e => setTestForm(f => ({ ...f, phone_number: e.target.value }))}
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={sendingTest}>
                    {sendingTest ? 'Sending…' : 'Send Test WhatsApp'}
                  </button>
                </div>
                <div className="form-group">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={testForm.message}
                    onChange={e => setTestForm(f => ({ ...f, message: e.target.value }))}
                  />
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Automations */}
      {activeTab === 'automations' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Business Trigger Event</th>
                <th>Recipient Target</th>
                <th>Assigned Template</th>
                <th>Status</th>
                <th className="col-actions">Toggle</th>
              </tr>
            </thead>
            <tbody>
              {automations.map(auto => (
                <tr key={auto.id}>
                  <td>
                    <strong>{auto.name}</strong>
                    <div className="text-xs text-muted">Event: <code>{auto.trigger_event}</code></div>
                  </td>
                  <td>
                    <span className="tag" style={{ textTransform: 'capitalize' }}>{auto.recipient_role}</span>
                  </td>
                  <td>
                    <select
                      className="form-control text-sm"
                      value={auto.template_id || ''}
                      onChange={e => handleToggleAutomation(auto.id, auto.is_enabled, parseInt(e.target.value))}
                      style={{ maxWidth: 260 }}
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`tag ${auto.is_enabled ? 'tag-success' : 'tag-muted'}`}>
                      {auto.is_enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="col-actions">
                    <input
                      type="checkbox"
                      checked={!!auto.is_enabled}
                      onChange={e => handleToggleAutomation(auto.id, e.target.checked, auto.template_id)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Templates */}
      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {templates.map(tmpl => (
            <div key={tmpl.id} className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{tmpl.name}</strong>
                <span className="tag">{tmpl.category.replace('_', ' ')}</span>
              </div>
              <div className="card-body">
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Template Source:</div>
                <pre style={{
                  background: 'var(--color-bg)', padding: 10, borderRadius: 6,
                  fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto'
                }}>
                  {tmpl.template_body}
                </pre>

                <div style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600, marginTop: 10, marginBottom: 4 }}>
                  Live Preview with Sample Data:
                </div>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)',
                  padding: 10, borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5, color: '#a7f3d0'
                }}>
                  {renderPreview(tmpl.template_body)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: Message Logs */}
      {activeTab === 'logs' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Recipient</th>
                <th>Party</th>
                <th>Trigger Event</th>
                <th>Message Content</th>
                <th>Status</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="text-xs text-muted">{fmtDate(log.created_at)}</td>
                  <td><strong>{log.phone_number}</strong></td>
                  <td className="text-sm">{log.customer_name || '—'}</td>
                  <td><span className="tag">{log.trigger_event || 'manual'}</span></td>
                  <td style={{ maxWidth: 300 }}>
                    <div style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.message_body}
                    </div>
                    {log.error_message && (
                      <div className="text-xs text-error" style={{ marginTop: 2 }}>{log.error_message}</div>
                    )}
                  </td>
                  <td>
                    <span className={`tag ${
                      log.status === 'delivered' || log.status === 'read' || log.status === 'sent'
                        ? 'tag-success' : log.status === 'failed' ? 'tag-error' : 'tag-warning'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="col-actions">
                    {log.status === 'failed' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRetryLog(log.id)}>
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <EmptyState title="No message logs" description="Automated and manual WhatsApp messages will appear here" />
          )}
        </div>
      )}

      {/* QR Pairing Modal */}
      <Modal open={showQRModal} onClose={() => setShowQRModal(false)} title="Pair WhatsApp Device"
        footer={<button className="btn btn-secondary" onClick={() => setShowQRModal(false)}>Close</button>}>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ marginBottom: 16 }}>Open WhatsApp on your phone → Linked Devices → Link a Device, and scan the QR code below:</p>
          {qrCode ? (
            <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 8 }}>
              <img
                src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="WhatsApp QR Code"
                style={{ width: 240, height: 240, display: 'block' }}
              />
            </div>
          ) : (
            <div className="spinner" style={{ margin: '30px auto' }} />
          )}
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>
            This modal will automatically close as soon as connection is verified.
          </div>
        </div>
      </Modal>

      {/* New Template Modal */}
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title="Create Template"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowTemplateModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveTemplate} disabled={saving}>{saving ? 'Saving…' : 'Save Template'}</button>
        </>}>
        <form onSubmit={handleSaveTemplate}>
          <div className="form-group">
            <label className="form-label">Template Name <span className="required">*</span></label>
            <input className="form-control" value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Job Completed Notification" />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-control" value={templateForm.category} onChange={e => setTemplateForm(f => ({ ...f, category: e.target.value }))}>
              <option value="order_update">Order Update</option>
              <option value="quality_update">Quality Update</option>
              <option value="dispatch_notification">Dispatch Notification</option>
              <option value="payment_reminder">Payment Reminder</option>
              <option value="general">General</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Template Body <span className="required">*</span></label>
            <textarea
              className="form-control"
              rows="6"
              value={templateForm.template_body}
              onChange={e => setTemplateForm(f => ({ ...f, template_body: e.target.value }))}
              placeholder="Hello {{party_name}}, your coating job {{job_number}} is completed. Quantity: {{quantity}} pcs."
            />
            <div className="form-hint">
              Supported variables: <code>{'{{party_name}}'}</code>, <code>{'{{supplier_name}}'}</code>, <code>{'{{job_number}}'}</code>, <code>{'{{purchase_number}}'}</code>, <code>{'{{quantity}}'}</code>, <code>{'{{weight}}'}</code>, <code>{'{{coating_type}}'}</code>, <code>{'{{due_date}}'}</code>, <code>{'{{dispatch_number}}'}</code>, <code>{'{{amount}}'}</code>, <code>{'{{balance}}'}</code>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
