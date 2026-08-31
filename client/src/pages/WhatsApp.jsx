import { useState, useEffect, useCallback } from 'react';
import { whatsappApi } from '../api/index.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PageHeader, StatusBadge, Modal, EmptyState, LoadingRows } from '../components/ui.jsx';
import { fmtDate } from '../utils/helpers.js';

function getAuthToken() {
  return localStorage.getItem('resin_token') || localStorage.getItem('token');
}

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
  const [testForm, setTestForm] = useState({ phone_number: '', message: 'Test message from Resin ERP WhatsApp Engine' });
  const [sendingTest, setSendingTest] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { isAdmin } = useAuth();

  // Load connection status
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/evolution/status', {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
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
        fetch('/api/evolution/automations', { headers: { 'Authorization': `Bearer ${getAuthToken()}` } }),
        fetch('/api/evolution/settings', { headers: { 'Authorization': `Bearer ${getAuthToken()}` } }),
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
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
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
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
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
    if (!window.confirm('Are you sure you want to disconnect the WhatsApp instance?')) return;
    try {
      await fetch('/api/evolution/disconnect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
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
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(testForm)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Test message dispatched successfully');
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
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ [key]: newVal })
      });
      toast.success('System setting updated');
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
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ is_enabled: isEnabled ? 1 : 0, template_id: templateId })
      });
      setAutomations(prev => prev.map(a => a.id === autoId ? { ...a, is_enabled: isEnabled ? 1 : 0, template_id: templateId } : a));
      toast.success('Automation trigger updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRetryLog = async (logId) => {
    try {
      const res = await fetch(`/api/evolution/logs/${logId}/retry`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
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
      toast.error('Template name and body required'); return;
    }
    setSaving(true);
    try {
      await whatsappApi.createTemplate(templateForm);
      toast.success('Template saved successfully');
      setShowTemplateModal(false);
      setTemplateForm({ name: '', category: 'order_update', template_body: '' });
      loadAutomations();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isConnected = connectionStatus.status === 'connected';

  const filteredLogs = logs.filter(l => {
    if (!logFilter) return true;
    return l.status === logFilter;
  });

  return (
    <div className="page">
      <PageHeader
        title="WhatsApp Business Automations"
        subtitle="Automated party alerts, job status updates, delivery notices, and payment receipts"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`badge ${isConnected ? 'badge-success' : 'badge-neutral'}`}>
              <span className={`status-dot ${isConnected ? 'success' : 'neutral'}`} style={{ width: 6, height: 6 }} />
              {isConnected ? 'Transport Connected' : 'Disconnected'}
            </span>
            {isAdmin && activeTab === 'templates' && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowTemplateModal(true)}>
                + New Template
              </button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'connection' ? 'active' : ''}`}
          onClick={() => setActiveTab('connection')}
        >
          Connection &amp; Dispatch Engine
        </button>
        <button
          className={`tab ${activeTab === 'automations' ? 'active' : ''}`}
          onClick={() => setActiveTab('automations')}
        >
          Automations ({automations.filter(a => a.is_enabled).length} Active)
        </button>
        <button
          className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates ({templates.length})
        </button>
        <button
          className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Message Delivery Log
        </button>
      </div>

      {/* TAB 1: Connection & Dispatch Engine */}
      {activeTab === 'connection' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)' }}>
          {/* Panel: Instance Status */}
          <div className="panel">
            <div className="form-section-title" style={{ marginTop: 0 }}>Evolution Go Instance Status</div>
            <div className="data-row">
              <span className="data-row-label">Instance Identifier</span>
              <span className="data-row-value" style={{ fontFamily: 'var(--font-mono)' }}>{connectionStatus.instance || 'resin'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-label">Connection State</span>
              <span className="data-row-value">
                <span className={`badge ${isConnected ? 'badge-success' : 'badge-error'}`}>
                  {connectionStatus.status?.toUpperCase()}
                </span>
              </span>
            </div>
            {connectionStatus.ownerJid && (
              <div className="data-row">
                <span className="data-row-label">Paired WhatsApp Phone</span>
                <span className="data-row-value">{connectionStatus.ownerJid.split('@')[0]}</span>
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              {!isConnected ? (
                <button className="btn btn-whatsapp btn-sm" style={{ flex: 1 }} onClick={handleConnect}>
                  📱 Connect WhatsApp (Scan QR)
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={loadStatus}>
                    🔄 Refresh Connection
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={handleDisconnect}>
                    Disconnect
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Panel: Engine Safety Controls */}
          <div className="panel">
            <div className="form-section-title" style={{ marginTop: 0 }}>Master Dispatch Controls</div>
            <div className="data-row" style={{ padding: '12px 0' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Enable Automated Dispatches</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Trigger auto-messages on production events</div>
              </div>
              <input
                type="checkbox"
                style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                checked={settings.whatsapp_automation_enabled === '1'}
                onChange={e => handleToggleSetting('whatsapp_automation_enabled', e.target.checked)}
              />
            </div>
            <div className="data-row" style={{ padding: '12px 0' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Test Mode (Dry Run)</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Simulate dispatches in log without sending to customer</div>
              </div>
              <input
                type="checkbox"
                style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                checked={settings.whatsapp_test_mode === '1'}
                onChange={e => handleToggleSetting('whatsapp_test_mode', e.target.checked)}
              />
            </div>
          </div>

          {/* Panel: Test Console */}
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <div className="form-section-title" style={{ marginTop: 0 }}>Manual Test Dispatch Console</div>
            <form onSubmit={handleSendTest} style={{ display: 'grid', gridTemplateColumns: '240px 1fr auto', gap: 12, alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Phone Number (with Country Code)</label>
                <input
                  className="form-control"
                  placeholder="919876543210"
                  value={testForm.phone_number}
                  onChange={e => setTestForm(f => ({ ...f, phone_number: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Test Message Content</label>
                <input
                  className="form-control"
                  value={testForm.message}
                  onChange={e => setTestForm(f => ({ ...f, message: e.target.value }))}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-whatsapp btn-sm"
                style={{ height: 'var(--control-height)' }}
                disabled={sendingTest}
              >
                {sendingTest ? 'Sending…' : 'Send Test Dispatch'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Automations */}
      {activeTab === 'automations' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Trigger Event</th>
                <th>Description</th>
                <th>Recipient Role</th>
                <th>Assigned Message Template</th>
                <th>Auto-Dispatch</th>
              </tr>
            </thead>
            <tbody>
              {automations.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{a.event_name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{a.description}</td>
                  <td><span className="badge badge-neutral">{a.target_audience || 'Party'}</span></td>
                  <td>
                    <select
                      className="filter-select"
                      value={a.template_id || ''}
                      onChange={e => handleToggleAutomation(a.id, a.is_enabled, e.target.value)}
                    >
                      <option value="">-- Default Template --</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                      checked={Boolean(a.is_enabled)}
                      onChange={e => handleToggleAutomation(a.id, e.target.checked, a.template_id)}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {templates.map(t => (
            <div key={t.id} className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>{t.name}</strong>
                <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{t.category}</span>
              </div>
              <div style={{
                background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-md)',
                fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-primary)'
              }}>
                {t.template_body || t.message_template}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyState
                title="No message templates created"
                description="Create customized WhatsApp message templates for party notifications."
                action={isAdmin && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowTemplateModal(true)}>
                    + Create Template
                  </button>
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Logs */}
      {activeTab === 'logs' && (
        <>
          <div className="toolbar">
            <select
              className="filter-select"
              value={logFilter}
              onChange={e => setLogFilter(e.target.value)}
            >
              <option value="">All Delivery Statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Recipient Phone</th>
                  <th>Recipient Name</th>
                  <th>Event Trigger</th>
                  <th>Message Snippet</th>
                  <th>Delivery Status</th>
                  <th className="action-col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(l => (
                  <tr key={l.id}>
                    <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(l.created_at)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{l.phone_number}</td>
                    <td style={{ fontWeight: 600 }}>{l.recipient_name || 'Party'}</td>
                    <td><span className="badge badge-neutral">{l.event_type || 'Manual'}</span></td>
                    <td style={{ color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.message_body || l.message}
                    </td>
                    <td>
                      <StatusBadge status={l.status || 'sent'} />
                    </td>
                    <td className="action-col">
                      {l.status === 'failed' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ height: 24, fontSize: 11 }}
                          onClick={() => handleRetryLog(l.id)}
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 36 }}>
                      No message delivery logs available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* QR Modal */}
      <Modal
        open={showQRModal}
        onClose={() => { setShowQRModal(false); setPollingStatus(false); }}
        title="Pair WhatsApp Device"
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Open WhatsApp on your phone → Linked Devices → Link a Device → Scan this QR code
          </p>
          {qrCode ? (
            <img
              src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="WhatsApp QR Code"
              style={{ maxWidth: 240, border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8, background: '#fff' }}
            />
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>Generating QR code…</div>
          )}
        </div>
      </Modal>

      {/* Template Modal */}
      <Modal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title="New Message Template"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowTemplateModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveTemplate} disabled={saving}>
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveTemplate}>
          <div className="form-group">
            <label className="form-label">Template Name *</label>
            <input
              className="form-control"
              placeholder="e.g. Job Completed Notification"
              value={templateForm.name}
              onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-control"
              value={templateForm.category}
              onChange={e => setTemplateForm(f => ({ ...f, category: e.target.value }))}
            >
              <option value="order_update">Order Update</option>
              <option value="qc_approval">QC Approval</option>
              <option value="dispatch_notice">Dispatch Notice</option>
              <option value="payment_receipt">Payment Receipt</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Message Template Body *</label>
            <textarea
              className="form-textarea"
              rows={6}
              placeholder="Use variables like {{party_name}}, {{job_number}}, {{quantity}}..."
              value={templateForm.template_body}
              onChange={e => setTemplateForm(f => ({ ...f, template_body: e.target.value }))}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
