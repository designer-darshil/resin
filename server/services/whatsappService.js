const db = require('../db/database');

const EVOLUTION_URL = process.env.EVOLUTION_GO_URL || process.env.EVOLUTION_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_GO_API_KEY || process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_GO_INSTANCE || process.env.EVOLUTION_INSTANCE || 'resin';

/**
 * Helper to get clean settings from DB
 */
function getSetting(key, defaultValue = '') {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Standard HTTP helper to call Evolution Go
 */
async function callEvolution(endpoint, method = 'GET', body = null) {
  const url = `${EVOLUTION_URL.replace(/\/+$/, '')}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (EVOLUTION_API_KEY) {
    headers['apikey'] = EVOLUTION_API_KEY;
    headers['Authorization'] = `Bearer ${EVOLUTION_API_KEY}`;
  }

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { text: await response.text() };
    }
    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    return { ok: false, status: 500, error: err.message };
  }
}

/**
 * Normalize phone number to international format (e.g. 91XXXXXXXXXX)
 */
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Render template variables safely
 */
function renderTemplate(templateBody, variables = {}) {
  if (!templateBody) return '';
  return templateBody.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    const val = variables[key];
    if (val !== undefined && val !== null) return String(val);
    return ''; // avoid undefined string
  });
}

/**
 * WhatsApp Automation Service
 */
class WhatsAppService {
  /**
   * Check connection status of Evolution Go instance
   */
  static async getConnectionStatus() {
    if (!EVOLUTION_URL) {
      return { status: 'not_configured', message: 'EVOLUTION_GO_URL is not set' };
    }

    try {
      // Evolution Go connectionState endpoint
      const res = await callEvolution(`/instance/connectionState/${EVOLUTION_INSTANCE}`);
      if (res.ok && res.data) {
        const state = res.data.instance?.state || res.data.state || (res.data.status === 'open' ? 'open' : 'connecting');
        if (state === 'open' || state === 'connected') {
          return {
            status: 'connected',
            instance: EVOLUTION_INSTANCE,
            ownerJid: res.data.instance?.ownerJid || res.data.ownerJid || ''
          };
        } else if (state === 'connecting') {
          return { status: 'connecting', instance: EVOLUTION_INSTANCE };
        }
      }
      return { status: 'disconnected', instance: EVOLUTION_INSTANCE, raw: res.data };
    } catch (e) {
      return { status: 'error', error: e.message, instance: EVOLUTION_INSTANCE };
    }
  }

  /**
   * Request QR code / Connect instance
   */
  static async connectInstance() {
    try {
      // 1. Try to create or get connect QR
      const connectRes = await callEvolution(`/instance/connect/${EVOLUTION_INSTANCE}`, 'GET');
      if (connectRes.ok && connectRes.data) {
        const qrcode = connectRes.data.qrcode || connectRes.data.base64 || connectRes.data.code;
        return { ok: true, qrcode, pairingCode: connectRes.data.pairingCode };
      }

      // If not created yet, try create instance
      const createRes = await callEvolution('/instance/create', 'POST', {
        instanceName: EVOLUTION_INSTANCE,
        qrcode: true,
        integration: 'WHATSMEOW'
      });

      if (createRes.ok && createRes.data) {
        const qrcode = createRes.data.qrcode?.base64 || createRes.data.qrcode || createRes.data.base64;
        return { ok: true, qrcode, instance: createRes.data };
      }

      return { ok: false, error: createRes.error || connectRes.error || 'Failed to generate QR code' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Disconnect instance
   */
  static async disconnectInstance() {
    try {
      const res = await callEvolution(`/instance/logout/${EVOLUTION_INSTANCE}`, 'DELETE');
      return { ok: res.ok, data: res.data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Send a direct text message via Evolution Go
   */
  static async sendDirectMessage(phoneNumber, messageText) {
    const cleanNumber = normalizePhoneNumber(phoneNumber);
    if (!cleanNumber) {
      return { ok: false, error: 'Invalid phone number' };
    }
    if (!messageText || !messageText.trim()) {
      return { ok: false, error: 'Empty message body' };
    }

    const testMode = getSetting('whatsapp_test_mode', '0') === '1';
    if (testMode) {
      return {
        ok: true,
        testMode: true,
        messageId: `TEST_MODE_${Date.now()}`,
        status: 'sent'
      };
    }

    // Evolution Go sendText payload
    const payload = {
      number: cleanNumber,
      text: messageText,
      delay: 1200
    };

    const res = await callEvolution(`/message/sendText/${EVOLUTION_INSTANCE}`, 'POST', payload);
    if (res.ok && res.data) {
      const messageId = res.data.key?.id || res.data.messageId || res.data.id || `EVO_${Date.now()}`;
      return { ok: true, messageId, status: 'sent', raw: res.data };
    }

    return {
      ok: false,
      error: res.error || (res.data ? JSON.stringify(res.data) : 'Unable to send message via Evolution Go')
    };
  }

  /**
   * Process a business event trigger with duplicate protection & automation check
   */
  static async processTriggerEvent(triggerEvent, entityType, entityId, contextVariables = {}, customPhone = null) {
    try {
      // 1. Check global automation toggle
      const globalEnabled = getSetting('whatsapp_automation_enabled', '0') === '1';
      if (!globalEnabled) {
        return { skipped: true, reason: 'WhatsApp automation is globally disabled' };
      }

      // 2. Look up automation config
      const automation = db.prepare(`
        SELECT wa.*, wt.template_body, wt.name as template_name
        FROM whatsapp_automations wa
        JOIN whatsapp_templates wt ON wa.template_id = wt.id
        WHERE wa.trigger_event = ? AND wa.is_enabled = 1
      `).get(triggerEvent);

      if (!automation) {
        return { skipped: true, reason: `Automation for '${triggerEvent}' is not enabled` };
      }

      // 3. Duplicate Protection (Idempotency Key: {entityType}_{entityId}_{triggerEvent})
      const idempotencyKey = `${entityType}_${entityId}_${triggerEvent}`;
      const existingLog = db.prepare(`
        SELECT id, status, message_id FROM whatsapp_logs
        WHERE idempotency_key = ? AND status IN ('sent', 'delivered', 'read')
      `).get(idempotencyKey);

      if (existingLog) {
        return { skipped: true, reason: `Duplicate prevented: message already sent for ${idempotencyKey}` };
      }

      // 4. Resolve recipient phone number
      let targetPhone = customPhone;
      let customerId = contextVariables.customer_id || null;

      if (!targetPhone && customerId) {
        const cust = db.prepare('SELECT phone, whatsapp_number FROM customers WHERE id = ?').get(customerId);
        if (cust) targetPhone = cust.whatsapp_number || cust.phone;
      }

      if (!targetPhone) {
        return { skipped: true, reason: 'No valid recipient phone number found' };
      }

      // 5. Render message
      const renderedMessage = renderTemplate(automation.template_body, contextVariables);

      // 6. Check Approval Mode
      const requireApproval = getSetting('whatsapp_require_approval', '0') === '1';
      const initialStatus = requireApproval ? 'awaiting_approval' : 'queued';

      // 7. Create log record
      const insertResult = db.prepare(`
        INSERT INTO whatsapp_logs (
          customer_id, template_id, phone_number, message_body, status,
          idempotency_key, trigger_event, related_entity_type, related_entity_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customerId,
        automation.template_id,
        targetPhone,
        renderedMessage,
        initialStatus,
        idempotencyKey,
        triggerEvent,
        entityType,
        entityId
      );

      const logId = insertResult.lastInsertRowid;

      // If approval is required, stop here
      if (requireApproval) {
        return { ok: true, status: 'awaiting_approval', logId };
      }

      // 8. Dispatch message asynchronously in background
      setImmediate(async () => {
        try {
          const sendRes = await WhatsAppService.sendDirectMessage(targetPhone, renderedMessage);
          if (sendRes.ok) {
            db.prepare(`
              UPDATE whatsapp_logs SET
                status = 'sent',
                message_id = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).run(sendRes.messageId, logId);
          } else {
            db.prepare(`
              UPDATE whatsapp_logs SET
                status = 'failed',
                error_message = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).run(sendRes.error || 'Send failed', logId);
          }
        } catch (err) {
          db.prepare(`
            UPDATE whatsapp_logs SET
              status = 'failed',
              error_message = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).run(err.message, logId);
        }
      });

      return { ok: true, status: 'queued', logId };
    } catch (err) {
      console.error(`Error in processTriggerEvent (${triggerEvent}):`, err.message);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Retry a failed message log
   */
  static async retryLogMessage(logId) {
    const log = db.prepare('SELECT * FROM whatsapp_logs WHERE id = ?').get(logId);
    if (!log) return { ok: false, error: 'Log entry not found' };

    const sendRes = await WhatsAppService.sendDirectMessage(log.phone_number, log.message_body);
    if (sendRes.ok) {
      db.prepare(`
        UPDATE whatsapp_logs SET
          status = 'sent',
          message_id = ?,
          error_message = null,
          retry_count = retry_count + 1,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(sendRes.messageId, logId);
      return { ok: true, message: 'Message sent successfully' };
    } else {
      db.prepare(`
        UPDATE whatsapp_logs SET
          status = 'failed',
          error_message = ?,
          retry_count = retry_count + 1,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(sendRes.error || 'Retry failed', logId);
      return { ok: false, error: sendRes.error || 'Retry failed' };
    }
  }
}

module.exports = WhatsAppService;
