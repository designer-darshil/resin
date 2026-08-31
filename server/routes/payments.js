const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { auditLog, generateCode, getIp } = require('../utils/audit');

// GET /api/payments
router.get('/', authenticate, requirePermission('payments', 'can_view'), (req, res) => {
  const { customer_id, payment_method, payment_direction, from_date, to_date, page = 1, limit = 50 } = req.query;
  let where = 'WHERE p.is_active = 1';
  const params = [];

  if (customer_id) { where += ' AND p.customer_id = ?'; params.push(customer_id); }
  if (payment_method) { where += ' AND p.payment_method = ?'; params.push(payment_method); }
  if (payment_direction) { where += ' AND p.payment_direction = ?'; params.push(payment_direction); }
  if (from_date) { where += ' AND p.payment_date >= ?'; params.push(from_date); }
  if (to_date) { where += ' AND p.payment_date <= ?'; params.push(to_date); }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM payments p ${where}`).get(...params);
  const payments = db.prepare(`
    SELECT p.*, c.company_name as customer_name, c.whatsapp_number as customer_whatsapp,
      u.full_name as created_by_name,
      d.dispatch_code, pur.purchase_code
    FROM payments p
    LEFT JOIN customers c ON p.customer_id = c.id
    LEFT JOIN users u ON p.created_by = u.id
    LEFT JOIN dispatches d ON p.related_dispatch_id = d.id
    LEFT JOIN purchases pur ON p.related_purchase_id = pur.id
    ${where}
    ORDER BY p.payment_date DESC, p.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  // Summary
  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN payment_direction='received' AND is_active=1 THEN amount ELSE 0 END),0) as total_received,
      COALESCE(SUM(CASE WHEN payment_direction='paid' AND is_active=1 THEN amount ELSE 0 END),0) as total_paid
    FROM payments ${customer_id ? 'WHERE customer_id = ?' : ''}
  `).get(...(customer_id ? [customer_id] : []));

  res.json({ data: payments, total: total.cnt, summary });
});

// POST /api/payments
router.post('/', authenticate, requirePermission('payments', 'can_create'), (req, res) => {
  const { customer_id, payment_date, amount, payment_method, reference_number,
    related_dispatch_id, related_purchase_id, payment_direction, notes } = req.body;

  if (!customer_id || !payment_date || !amount) {
    return res.status(400).json({ error: 'Customer, date, and amount are required' });
  }

  const code = generateCode('PAY', 'payments', 'payment_code');
  const result = db.prepare(`
    INSERT INTO payments (payment_code, customer_id, payment_date, amount, payment_method, reference_number,
      related_dispatch_id, related_purchase_id, payment_direction, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, customer_id, payment_date, parseFloat(amount), payment_method || 'cash',
    reference_number || null, related_dispatch_id || null, related_purchase_id || null,
    payment_direction || 'received', notes || null, req.user.id);

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);
  auditLog(req.user.id, 'CREATE', 'payments', result.lastInsertRowid, `Payment of ₹${amount} recorded`, null, payment, getIp(req));
  res.status(201).json(payment);
});

module.exports = router;
