const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { auditLog, getIp } = require('../utils/audit');

// GET /api/advances
router.get('/', authenticate, requirePermission('salary', 'can_view'), (req, res) => {
  const { employee_id, status } = req.query;
  let where = 'WHERE sa.is_active = 1';
  const params = [];

  if (employee_id) { where += ' AND sa.employee_id = ?'; params.push(employee_id); }
  if (status) { where += ' AND sa.status = ?'; params.push(status); }

  const records = db.prepare(`
    SELECT sa.*, e.full_name as employee_name, e.employee_code,
      u.full_name as approved_by_name
    FROM salary_advances sa
    JOIN employees e ON sa.employee_id = e.id
    LEFT JOIN users u ON sa.approved_by = u.id
    ${where}
    ORDER BY sa.advance_date DESC
  `).all(...params);

  res.json({ data: records });
});

// POST /api/advances
router.post('/', authenticate, requirePermission('salary', 'can_create'), (req, res) => {
  const { employee_id, advance_date, amount, reason, notes } = req.body;
  if (!employee_id || !advance_date || !amount) {
    return res.status(400).json({ error: 'Employee, date, and amount are required' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ? AND is_active = 1').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const result = db.prepare(`
    INSERT INTO salary_advances (employee_id, advance_date, amount, reason, remaining_balance, notes, approved_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(employee_id, advance_date, parseFloat(amount), reason || null, parseFloat(amount), notes || null, req.user.id);

  const record = db.prepare('SELECT * FROM salary_advances WHERE id = ?').get(result.lastInsertRowid);
  auditLog(req.user.id, 'CREATE', 'advances', result.lastInsertRowid, `Advance of ₹${amount} for ${employee.full_name}`, null, record, getIp(req));
  res.status(201).json(record);
});

// PUT /api/advances/:id — update remaining balance or status
router.put('/:id', authenticate, requirePermission('salary', 'can_edit'), (req, res) => {
  const record = db.prepare('SELECT * FROM salary_advances WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Advance record not found' });

  const { remaining_balance, status, notes } = req.body;
  db.prepare(`
    UPDATE salary_advances SET
      remaining_balance = COALESCE(?, remaining_balance),
      status = COALESCE(?, status),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(remaining_balance, status, notes, req.params.id);

  const updated = db.prepare('SELECT * FROM salary_advances WHERE id = ?').get(req.params.id);
  auditLog(req.user.id, 'UPDATE', 'advances', req.params.id, `Updated advance record`, record, updated, getIp(req));
  res.json(updated);
});

module.exports = router;
