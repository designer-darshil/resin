const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { auditLog, generateCode, getIp } = require('../utils/audit');

// GET /api/customers
router.get('/', authenticate, requirePermission('customers', 'can_view'), (req, res) => {
  const { search, status, type, page = 1, limit = 50 } = req.query;
  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (c.company_name LIKE ? OR c.contact_person LIKE ? OR c.phone LIKE ? OR c.party_code LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (status === 'active') { where += ' AND c.is_active = 1'; params.push(); }
  if (status === 'inactive') { where += ' AND c.is_active = 0'; params.push(); }
  if (type) { where += ' AND c.customer_type = ?'; params.push(type); }
  else { where += ' AND c.is_active = 1'; }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM customers c ${where}`).get(...params);
  const customers = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM purchases WHERE supplier_id = c.id AND is_active = 1) as purchase_count,
      (SELECT COUNT(*) FROM dispatches WHERE customer_id = c.id AND is_active = 1) as dispatch_count,
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE customer_id = c.id AND is_active = 1 AND payment_direction='received') as total_paid
    FROM customers c ${where}
    ORDER BY c.company_name ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ data: customers, total: total.cnt, page: parseInt(page), limit: parseInt(limit) });
});

// POST /api/customers
router.post('/', authenticate, requirePermission('customers', 'can_create'), (req, res) => {
  const { company_name, contact_person, phone, whatsapp_number, email, address, gst_number, opening_balance, customer_type, notes } = req.body;
  if (!company_name) return res.status(400).json({ error: 'Company name is required' });

  const code = generateCode('PARTY', 'customers', 'party_code');
  const result = db.prepare(`
    INSERT INTO customers (party_code, company_name, contact_person, phone, whatsapp_number, email, address, gst_number, opening_balance, customer_type, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, company_name, contact_person || null, phone || null, whatsapp_number || null, email || null, address || null, gst_number || null, opening_balance || 0, customer_type || 'customer', notes || null, req.user.id);

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  auditLog(req.user.id, 'CREATE', 'customers', result.lastInsertRowid, `Created customer: ${company_name}`, null, customer, getIp(req));
  res.status(201).json(customer);
});

// GET /api/customers/:id
router.get('/:id', authenticate, requirePermission('customers', 'can_view'), (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  // Load related data
  const purchases = db.prepare('SELECT * FROM purchases WHERE supplier_id = ? AND is_active = 1 ORDER BY purchase_date DESC LIMIT 10').all(req.params.id);
  const dispatches = db.prepare('SELECT d.*, cj.job_code FROM dispatches d LEFT JOIN coating_jobs cj ON d.coating_job_id = cj.id WHERE d.customer_id = ? AND d.is_active = 1 ORDER BY d.dispatch_date DESC LIMIT 10').all(req.params.id);
  const payments = db.prepare('SELECT * FROM payments WHERE customer_id = ? AND is_active = 1 ORDER BY payment_date DESC LIMIT 10').all(req.params.id);
  const coatingJobs = db.prepare('SELECT * FROM coating_jobs WHERE customer_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 10').all(req.params.id);
  const totalPaid = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE customer_id = ? AND payment_direction="received" AND is_active = 1').get(req.params.id);

  res.json({ ...customer, purchases, dispatches, payments, coating_jobs: coatingJobs, total_paid: totalPaid.total });
});

// PUT /api/customers/:id
router.put('/:id', authenticate, requirePermission('customers', 'can_edit'), (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const { company_name, contact_person, phone, whatsapp_number, email, address, gst_number, opening_balance, customer_type, notes, is_active } = req.body;
  db.prepare(`
    UPDATE customers SET
      company_name = COALESCE(?, company_name),
      contact_person = ?,
      phone = ?,
      whatsapp_number = ?,
      email = ?,
      address = ?,
      gst_number = ?,
      opening_balance = COALESCE(?, opening_balance),
      customer_type = COALESCE(?, customer_type),
      notes = ?,
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(company_name, contact_person, phone, whatsapp_number, email, address, gst_number, opening_balance, customer_type, notes, is_active, req.params.id);

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  auditLog(req.user.id, 'UPDATE', 'customers', req.params.id, `Updated customer: ${updated.company_name}`, customer, updated, getIp(req));
  res.json(updated);
});

// DELETE /api/customers/:id (soft delete)
router.delete('/:id', authenticate, requirePermission('customers', 'can_delete'), (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  db.prepare('UPDATE customers SET is_active = 0, updated_at = datetime("now") WHERE id = ?').run(req.params.id);
  auditLog(req.user.id, 'DEACTIVATE', 'customers', req.params.id, `Deactivated customer: ${customer.company_name}`, null, null, getIp(req));
  res.json({ message: 'Customer deactivated successfully' });
});

module.exports = router;
