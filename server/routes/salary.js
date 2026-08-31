const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { auditLog, getIp } = require('../utils/audit');

// GET /api/salary
router.get('/', authenticate, requirePermission('salary', 'can_view'), (req, res) => {
  const { employee_id, month, year, status, page = 1, limit = 50 } = req.query;
  let where = 'WHERE sr.is_active = 1';
  const params = [];

  // Employee can only see own salary if salary_access permission
  if (req.user.role_name === 'employee') {
    if (!req.user.permissions.salary?.has_salary_access) {
      return res.status(403).json({ error: 'Salary access not permitted' });
    }
    where += ' AND sr.employee_id = ?';
    params.push(req.user.employee_id);
  } else if (employee_id) {
    where += ' AND sr.employee_id = ?';
    params.push(employee_id);
  }

  if (month) { where += ' AND sr.period_month = ?'; params.push(parseInt(month)); }
  if (year) { where += ' AND sr.period_year = ?'; params.push(parseInt(year)); }
  if (status) { where += ' AND sr.payment_status = ?'; params.push(status); }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM salary_records sr ${where}`).get(...params);
  const records = db.prepare(`
    SELECT sr.*, e.full_name as employee_name, e.employee_code, e.salary_type
    FROM salary_records sr
    JOIN employees e ON sr.employee_id = e.id
    ${where}
    ORDER BY sr.period_year DESC, sr.period_month DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ data: records, total: total.cnt });
});

// POST /api/salary — generate salary slip
router.post('/', authenticate, requirePermission('salary', 'can_create'), (req, res) => {
  const { employee_id, period_month, period_year, bonus, other_deductions, adjustments, notes } = req.body;
  if (!employee_id || !period_month || !period_year) {
    return res.status(400).json({ error: 'Employee, month, and year are required' });
  }

  // Prevent duplicate
  const existing = db.prepare('SELECT id FROM salary_records WHERE employee_id = ? AND period_month = ? AND period_year = ? AND is_active = 1')
    .get(employee_id, period_month, period_year);
  if (existing) return res.status(400).json({ error: 'Salary record already exists for this period' });

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  // Sum approved overtime for period
  const otResult = db.prepare(`
    SELECT COALESCE(SUM(overtime_amount),0) as total
    FROM overtime
    WHERE employee_id = ? AND strftime('%m', date) = printf('%02d', ?) AND strftime('%Y', date) = ?
    AND approval_status = 'approved' AND is_active = 1
  `).get(employee_id, period_month, String(period_year));

  // Sum pending advances for deduction
  const advResult = db.prepare(`
    SELECT COALESCE(SUM(remaining_balance),0) as total
    FROM salary_advances
    WHERE employee_id = ? AND status = 'active' AND is_active = 1
  `).get(employee_id);

  const baseSalary = parseFloat(employee.base_salary) || 0;
  const overtimeAmount = parseFloat(otResult.total) || 0;
  const bonusAmount = parseFloat(bonus) || 0;
  const advanceDeducted = Math.min(parseFloat(advResult.total) || 0, baseSalary * 0.5); // max 50% deduction in one month
  const deductions = parseFloat(other_deductions) || 0;
  const adj = parseFloat(adjustments) || 0;
  const gross = baseSalary + overtimeAmount + bonusAmount;
  const net = gross - advanceDeducted - deductions + adj;

  const result = db.prepare(`
    INSERT INTO salary_records (employee_id, period_month, period_year, base_salary, overtime_amount, bonus,
      advance_deducted, other_deductions, adjustments, gross_amount, net_payable, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(employee_id, parseInt(period_month), parseInt(period_year), baseSalary, overtimeAmount, bonusAmount,
    advanceDeducted, deductions, adj, gross, net, notes || null, req.user.id);

  const record = db.prepare('SELECT *, (SELECT full_name FROM employees WHERE id = salary_records.employee_id) as employee_name FROM salary_records WHERE id = ?').get(result.lastInsertRowid);
  auditLog(req.user.id, 'CREATE', 'salary', result.lastInsertRowid, `Generated salary for ${employee.full_name} - ${period_month}/${period_year}`, null, record, getIp(req));
  res.status(201).json(record);
});

// PUT /api/salary/:id — edit (admin only, with audit)
router.put('/:id', authenticate, requirePermission('salary', 'can_edit'), (req, res) => {
  const record = db.prepare('SELECT * FROM salary_records WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Salary record not found' });
  if (record.payment_status === 'paid') return res.status(400).json({ error: 'Cannot edit a paid salary record' });

  const { base_salary, overtime_amount, bonus, advance_deducted, other_deductions, adjustments, notes, payment_status, payment_date, payment_method } = req.body;

  const base = parseFloat(base_salary) ?? record.base_salary;
  const ot = parseFloat(overtime_amount) ?? record.overtime_amount;
  const bon = parseFloat(bonus) ?? record.bonus;
  const adv = parseFloat(advance_deducted) ?? record.advance_deducted;
  const ded = parseFloat(other_deductions) ?? record.other_deductions;
  const adj = parseFloat(adjustments) ?? record.adjustments;
  const gross = base + ot + bon;
  const net = gross - adv - ded + adj;

  db.prepare(`
    UPDATE salary_records SET
      base_salary = ?, overtime_amount = ?, bonus = ?, advance_deducted = ?,
      other_deductions = ?, adjustments = ?, gross_amount = ?, net_payable = ?,
      notes = COALESCE(?, notes),
      payment_status = COALESCE(?, payment_status),
      payment_date = COALESCE(?, payment_date),
      payment_method = COALESCE(?, payment_method),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(base, ot, bon, adv, ded, adj, gross, net, notes, payment_status, payment_date, payment_method, req.params.id);

  const updated = db.prepare('SELECT * FROM salary_records WHERE id = ?').get(req.params.id);
  auditLog(req.user.id, 'UPDATE', 'salary', req.params.id, `Updated salary record`, record, updated, getIp(req));
  res.json(updated);
});

module.exports = router;
