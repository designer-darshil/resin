const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { auditLog, getIp } = require('../utils/audit');

// GET /api/overtime
router.get('/', authenticate, requirePermission('overtime', 'can_view'), (req, res) => {
  const { employee_id, status, from_date, to_date, page = 1, limit = 50 } = req.query;
  let where = 'WHERE o.is_active = 1';
  const params = [];

  // Employee can only see own overtime
  if (req.user.role_name === 'employee' && req.user.employee_id) {
    where += ' AND o.employee_id = ?';
    params.push(req.user.employee_id);
  } else if (employee_id) {
    where += ' AND o.employee_id = ?';
    params.push(employee_id);
  }

  if (status) { where += ' AND o.approval_status = ?'; params.push(status); }
  if (from_date) { where += ' AND o.date >= ?'; params.push(from_date); }
  if (to_date) { where += ' AND o.date <= ?'; params.push(to_date); }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM overtime o ${where}`).get(...params);
  const records = db.prepare(`
    SELECT o.*, e.full_name as employee_name, e.employee_code,
      u.full_name as approved_by_name,
      cj.job_code
    FROM overtime o
    JOIN employees e ON o.employee_id = e.id
    LEFT JOIN users u ON o.approved_by = u.id
    LEFT JOIN coating_jobs cj ON o.coating_job_id = cj.id
    ${where}
    ORDER BY o.date DESC, o.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ data: records, total: total.cnt });
});

// POST /api/overtime
router.post('/', authenticate, requirePermission('overtime', 'can_create'), (req, res) => {
  const { employee_id, coating_job_id, date, regular_hours, overtime_hours, overtime_rate, notes } = req.body;
  if (!employee_id || !date || !overtime_hours) {
    return res.status(400).json({ error: 'Employee, date, and overtime hours are required' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ? AND is_active = 1').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  // Check for duplicate
  const duplicate = db.prepare('SELECT id FROM overtime WHERE employee_id = ? AND date = ? AND is_active = 1').get(employee_id, date);
  if (duplicate) return res.status(400).json({ error: 'Overtime record already exists for this date' });

  const rate = parseFloat(overtime_rate) || parseFloat(employee.overtime_rate) || 0;
  const amount = parseFloat(overtime_hours) * rate;

  const result = db.prepare(`
    INSERT INTO overtime (employee_id, coating_job_id, date, regular_hours, overtime_hours, overtime_rate, overtime_amount, notes, approval_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(employee_id, coating_job_id || null, date, parseFloat(regular_hours) || 0,
    parseFloat(overtime_hours), rate, amount, notes || null);

  const record = db.prepare('SELECT * FROM overtime WHERE id = ?').get(result.lastInsertRowid);
  auditLog(req.user.id, 'CREATE', 'overtime', result.lastInsertRowid, `Created overtime for ${employee.full_name} on ${date}`, null, record, getIp(req));
  res.status(201).json(record);
});

// PUT /api/overtime/:id
router.put('/:id', authenticate, requirePermission('overtime', 'can_edit'), (req, res) => {
  const record = db.prepare('SELECT * FROM overtime WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Overtime record not found' });

  const { overtime_hours, overtime_rate, regular_hours, notes, approval_status } = req.body;
  const newHours = overtime_hours !== undefined ? parseFloat(overtime_hours) : record.overtime_hours;
  const newRate = overtime_rate !== undefined ? parseFloat(overtime_rate) : record.overtime_rate;
  const newAmount = newHours * newRate;

  db.prepare(`
    UPDATE overtime SET
      overtime_hours = ?,
      overtime_rate = ?,
      overtime_amount = ?,
      regular_hours = COALESCE(?, regular_hours),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(newHours, newRate, newAmount, regular_hours, notes, req.params.id);

  const updated = db.prepare('SELECT * FROM overtime WHERE id = ?').get(req.params.id);
  auditLog(req.user.id, 'UPDATE', 'overtime', req.params.id, `Updated overtime record`, record, updated, getIp(req));
  res.json(updated);
});

// POST /api/overtime/:id/approve
router.post('/:id/approve', authenticate, requirePermission('overtime', 'can_approve'), (req, res) => {
  const { action, notes } = req.body; // action: 'approve' | 'reject'
  const record = db.prepare('SELECT * FROM overtime WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Overtime record not found' });

  const status = action === 'approve' ? 'approved' : 'rejected';
  db.prepare(`
    UPDATE overtime SET approval_status = ?, approved_by = ?, notes = COALESCE(?, notes), updated_at = datetime('now')
    WHERE id = ?
  `).run(status, req.user.id, notes, req.params.id);

  auditLog(req.user.id, action === 'approve' ? 'APPROVE' : 'REJECT', 'overtime', req.params.id,
    `${status} overtime record for employee ${record.employee_id}`, null, null, getIp(req));
  res.json({ message: `Overtime ${status}` });
});

module.exports = router;
