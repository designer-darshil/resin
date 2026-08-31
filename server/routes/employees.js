const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { auditLog, generateCode, getIp } = require('../utils/audit');

// GET /api/employees
router.get('/', authenticate, requirePermission('employees', 'can_view'), (req, res) => {
  const { search, status, department, page = 1, limit = 50 } = req.query;
  let where = 'WHERE e.is_active = 1';
  const params = [];

  if (search) {
    where += ' AND (e.full_name LIKE ? OR e.employee_code LIKE ? OR e.phone LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (status) { where += ' AND e.employment_status = ?'; params.push(status); }
  if (department) { where += ' AND e.department = ?'; params.push(department); }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM employees e ${where}`).get(...params);
  const employees = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM employee_job_assignments WHERE employee_id = e.id) as job_count,
      (SELECT COUNT(*) FROM overtime WHERE employee_id = e.id AND approval_status = 'pending') as pending_overtime
    FROM employees e
    ${where}
    ORDER BY e.full_name ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  // Hide salary info for non-admin/manager
  if (req.user.role_name === 'employee') {
    employees.forEach(emp => {
      if (emp.id !== req.user.employee_id) {
        delete emp.base_salary;
        delete emp.overtime_rate;
        delete emp.bank_details;
      }
    });
  }

  res.json({ data: employees, total: total.cnt });
});

// POST /api/employees
router.post('/', authenticate, requirePermission('employees', 'can_create'), (req, res) => {
  const { full_name, phone, address, joining_date, department, designation,
    salary_type, base_salary, overtime_rate, payment_frequency,
    bank_details, emergency_contact, notes } = req.body;

  if (!full_name) return res.status(400).json({ error: 'Full name is required' });

  const code = generateCode('EMP', 'employees', 'employee_code');
  const result = db.prepare(`
    INSERT INTO employees (employee_code, full_name, phone, address, joining_date, department, designation,
      salary_type, base_salary, overtime_rate, payment_frequency, bank_details, emergency_contact, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, full_name, phone || null, address || null, joining_date || null, department || null,
    designation || null, salary_type || 'monthly', parseFloat(base_salary) || 0,
    parseFloat(overtime_rate) || 0, payment_frequency || 'monthly',
    bank_details ? JSON.stringify(bank_details) : null,
    emergency_contact ? JSON.stringify(emergency_contact) : null,
    notes || null, req.user.id);

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
  auditLog(req.user.id, 'CREATE', 'employees', result.lastInsertRowid, `Created employee: ${full_name}`, null, employee, getIp(req));
  res.status(201).json(employee);
});

// GET /api/employees/:id
router.get('/:id', authenticate, requirePermission('employees', 'can_view'), (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  // Restrict sensitive data
  if (req.user.role_name === 'employee' && req.user.employee_id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const jobs = db.prepare(`
    SELECT eja.*, cj.job_code, cj.job_status, cj.coating_date, cj.coating_type
    FROM employee_job_assignments eja
    JOIN coating_jobs cj ON eja.coating_job_id = cj.id
    WHERE eja.employee_id = ?
    ORDER BY eja.created_at DESC LIMIT 10
  `).all(req.params.id);

  const overtime = db.prepare(`
    SELECT * FROM overtime WHERE employee_id = ? ORDER BY date DESC LIMIT 10
  `).all(req.params.id);

  const advances = db.prepare(`
    SELECT * FROM salary_advances WHERE employee_id = ? AND is_active = 1 ORDER BY advance_date DESC
  `).all(req.params.id);

  res.json({ ...employee, jobs, overtime, advances });
});

// PUT /api/employees/:id
router.put('/:id', authenticate, requirePermission('employees', 'can_edit'), (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const { full_name, phone, address, department, designation, employment_status,
    salary_type, base_salary, overtime_rate, notes, is_active } = req.body;

  db.prepare(`
    UPDATE employees SET
      full_name = COALESCE(?, full_name),
      phone = ?,
      address = ?,
      department = ?,
      designation = ?,
      employment_status = COALESCE(?, employment_status),
      salary_type = COALESCE(?, salary_type),
      base_salary = COALESCE(?, base_salary),
      overtime_rate = COALESCE(?, overtime_rate),
      notes = ?,
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(full_name, phone, address, department, designation, employment_status,
    salary_type, base_salary, overtime_rate, notes, is_active, req.params.id);

  const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  auditLog(req.user.id, 'UPDATE', 'employees', req.params.id,
    `Updated employee: ${updated.full_name}`, employee, updated, getIp(req));
  res.json(updated);
});

module.exports = router;
