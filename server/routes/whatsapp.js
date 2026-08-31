const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { auditLog, getIp } = require('../utils/audit');

// GET /api/whatsapp/templates
router.get('/templates', authenticate, requirePermission('whatsapp', 'can_view'), (req, res) => {
  const templates = db.prepare('SELECT * FROM whatsapp_templates WHERE is_active = 1 ORDER BY category, name').all();
  res.json({ data: templates });
});

// POST /api/whatsapp/templates
router.post('/templates', authenticate, requirePermission('whatsapp', 'can_create'), (req, res) => {
  const { name, category, template_body, variables } = req.body;
  if (!name || !category || !template_body) {
    return res.status(400).json({ error: 'Name, category, and template body are required' });
  }

  const result = db.prepare(`
    INSERT INTO whatsapp_templates (name, category, template_body, variables)
    VALUES (?, ?, ?, ?)
  `).run(name, category, template_body, variables ? JSON.stringify(variables) : null);

  res.status(201).json(db.prepare('SELECT * FROM whatsapp_templates WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/whatsapp/templates/:id
router.put('/templates/:id', authenticate, requirePermission('whatsapp', 'can_edit'), (req, res) => {
  const { name, category, template_body, variables, is_active } = req.body;
  db.prepare(`
    UPDATE whatsapp_templates SET
      name = COALESCE(?, name),
      category = COALESCE(?, category),
      template_body = COALESCE(?, template_body),
      variables = COALESCE(?, variables),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name, category, template_body, variables ? JSON.stringify(variables) : null, is_active, req.params.id);

  const updated = db.prepare('SELECT * FROM whatsapp_templates WHERE id = ?').get(req.params.id);
  auditLog(req.user.id, 'UPDATE', 'whatsapp', req.params.id, `Updated template: ${updated.name}`, null, null, getIp(req));
  res.json(updated);
});

// POST /api/whatsapp/log — log a WhatsApp send action
router.post('/log', authenticate, requirePermission('whatsapp', 'can_create'), (req, res) => {
  const { customer_id, template_id, phone_number, message_body } = req.body;
  if (!phone_number || !message_body) {
    return res.status(400).json({ error: 'Phone number and message body are required' });
  }

  db.prepare(`
    INSERT INTO whatsapp_logs (customer_id, template_id, phone_number, message_body, sent_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(customer_id || null, template_id || null, phone_number, message_body, req.user.id);

  res.json({ message: 'WhatsApp action logged' });
});

// GET /api/whatsapp/logs
router.get('/logs', authenticate, requirePermission('whatsapp', 'can_view'), (req, res) => {
  const { customer_id, page = 1, limit = 50 } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (customer_id) { where += ' AND wl.customer_id = ?'; params.push(customer_id); }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const logs = db.prepare(`
    SELECT wl.*, c.company_name as customer_name, u.full_name as sent_by_name, t.name as template_name
    FROM whatsapp_logs wl
    LEFT JOIN customers c ON wl.customer_id = c.id
    LEFT JOIN users u ON wl.sent_by = u.id
    LEFT JOIN whatsapp_templates t ON wl.template_id = t.id
    ${where}
    ORDER BY wl.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ data: logs });
});

module.exports = router;
