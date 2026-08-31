const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const WhatsAppService = require('../services/whatsappService');
const { auditLog, getIp } = require('../utils/audit');

// GET /api/evolution/status
router.get('/status', authenticate, async (req, res) => {
  const result = await WhatsAppService.getConnectionStatus();
  res.json(result);
});

// POST /api/evolution/connect
router.post('/connect', authenticate, requirePermission('whatsapp', 'can_create'), async (req, res) => {
  const result = await WhatsAppService.connectInstance();
  res.json(result);
});

// POST /api/evolution/disconnect
router.post('/disconnect', authenticate, requirePermission('whatsapp', 'can_create'), async (req, res) => {
  const result = await WhatsAppService.disconnectInstance();
  auditLog(req.user.id, 'DISCONNECT', 'whatsapp', null, 'Disconnected WhatsApp instance', null, null, getIp(req));
  res.json(result);
});

// POST /api/evolution/test-message
router.post('/test-message', authenticate, requirePermission('whatsapp', 'can_create'), async (req, res) => {
  const { phone_number, message } = req.body;
  if (!phone_number || !message) {
    return res.status(400).json({ error: 'Phone number and message are required' });
  }

  const result = await WhatsAppService.sendDirectMessage(phone_number, message);
  if (result.ok) {
    // Log test message
    db.prepare(`
      INSERT INTO whatsapp_logs (phone_number, message_body, status, message_id, trigger_event, sent_by)
      VALUES (?, ?, 'sent', ?, 'test_message', ?)
    `).run(phone_number, message, result.messageId, req.user.id);

    return res.json({ ok: true, message: 'Test message sent successfully', messageId: result.messageId });
  } else {
    return res.status(400).json({ error: result.error || 'Unable to send message. Check WhatsApp connection.' });
  }
});

// POST /api/evolution/send — contextual manual send via Evolution Go
router.post('/send', authenticate, requirePermission('whatsapp', 'can_create'), async (req, res) => {
  const { customer_id, phone_number, message, template_id, entity_type, entity_id } = req.body;
  if (!phone_number || !message) {
    return res.status(400).json({ error: 'Phone number and message are required' });
  }

  const sendResult = await WhatsAppService.sendDirectMessage(phone_number, message);
  const status = sendResult.ok ? 'sent' : 'failed';

  const insert = db.prepare(`
    INSERT INTO whatsapp_logs (
      customer_id, template_id, phone_number, message_body, status,
      message_id, error_message, related_entity_type, related_entity_id, sent_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer_id || null,
    template_id || null,
    phone_number,
    message,
    status,
    sendResult.messageId || null,
    sendResult.error || null,
    entity_type || null,
    entity_id || null,
    req.user.id
  );

  if (sendResult.ok) {
    res.json({ ok: true, log_id: insert.lastInsertRowid, message: 'Message sent successfully' });
  } else {
    res.status(400).json({ error: sendResult.error || 'Failed to send message via Evolution Go' });
  }
});

// GET /api/evolution/automations
router.get('/automations', authenticate, requirePermission('whatsapp', 'can_view'), (req, res) => {
  const automations = db.prepare(`
    SELECT wa.*, wt.name as template_name, wt.template_body
    FROM whatsapp_automations wa
    LEFT JOIN whatsapp_templates wt ON wa.template_id = wt.id
    ORDER BY wa.id ASC
  `).all();
  res.json({ data: automations });
});

// PUT /api/evolution/automations/:id
router.put('/automations/:id', authenticate, requirePermission('whatsapp', 'can_edit'), (req, res) => {
  const { is_enabled, template_id, recipient_role } = req.body;
  db.prepare(`
    UPDATE whatsapp_automations SET
      is_enabled = COALESCE(?, is_enabled),
      template_id = COALESCE(?, template_id),
      recipient_role = COALESCE(?, recipient_role),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(is_enabled !== undefined ? (is_enabled ? 1 : 0) : null, template_id, recipient_role, req.params.id);

  const updated = db.prepare('SELECT * FROM whatsapp_automations WHERE id = ?').get(req.params.id);
  auditLog(req.user.id, 'UPDATE_AUTOMATION', 'whatsapp', req.params.id, `Updated automation ${updated?.name}`, null, updated, getIp(req));
  res.json(updated);
});

// GET /api/evolution/settings
router.get('/settings', authenticate, requirePermission('whatsapp', 'can_view'), (req, res) => {
  const rows = db.prepare(`SELECT key, value FROM settings WHERE category = 'whatsapp'`).all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json({ data: settings });
});

// PUT /api/evolution/settings
router.put('/settings', authenticate, requirePermission('whatsapp', 'can_edit'), (req, res) => {
  const { whatsapp_automation_enabled, whatsapp_test_mode, whatsapp_require_approval, whatsapp_auto_retry, whatsapp_max_retries } = req.body;
  const updates = [
    ['whatsapp_automation_enabled', whatsapp_automation_enabled],
    ['whatsapp_test_mode', whatsapp_test_mode],
    ['whatsapp_require_approval', whatsapp_require_approval],
    ['whatsapp_auto_retry', whatsapp_auto_retry],
    ['whatsapp_max_retries', whatsapp_max_retries]
  ];

  const stmt = db.prepare(`UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?`);
  updates.forEach(([k, v]) => {
    if (v !== undefined) stmt.run(String(v), k);
  });

  res.json({ message: 'WhatsApp settings updated' });
});

// POST /api/evolution/logs/:id/retry
router.post('/logs/:id/retry', authenticate, requirePermission('whatsapp', 'can_create'), async (req, res) => {
  const result = await WhatsAppService.retryLogMessage(req.params.id);
  if (result.ok) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// POST /api/evolution/webhook — incoming status updates from Evolution Go
router.post('/webhook', (req, res) => {
  const payload = req.body || {};
  const event = payload.event;
  const data = payload.data;

  // Handle message updates (e.g., MESSAGES_UPDATE or MESSAGE_UPDATE)
  if (data && (event === 'messages.update' || event === 'message.update' || event === 'MESSAGES_UPDATE')) {
    const messageId = data.key?.id || data.id;
    const status = data.status || (data.update?.status);
    if (messageId && status) {
      let mappedStatus = 'sent';
      if (status === 'DELIVERY_ACK' || status === 'delivered') mappedStatus = 'delivered';
      if (status === 'READ' || status === 'read') mappedStatus = 'read';
      if (status === 'ERROR' || status === 'failed') mappedStatus = 'failed';

      db.prepare(`
        UPDATE whatsapp_logs SET status = ?, updated_at = datetime('now')
        WHERE message_id = ?
      `).run(mappedStatus, messageId);
    }
  }

  res.json({ status: 'received' });
});

module.exports = router;
