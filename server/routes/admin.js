const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/permissions');
const { auditLog, getIp } = require('../utils/audit');

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// ===== USERS =====

// GET /api/admin/users
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.created_at, u.employee_id,
      r.name as role_name, r.id as role_id
    FROM users u JOIN roles r ON u.role_id = r.id
    ORDER BY u.full_name
  `).all();
  res.json({ data: users });
});

// POST /api/admin/users
router.post('/users', (req, res) => {
  const { username, email, full_name, password, role_id, employee_id } = req.body;
  if (!username || !full_name || !password || !role_id) {
    return res.status(400).json({ error: 'Username, full name, password, and role are required' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email || '');
  if (existing) return res.status(400).json({ error: 'Username or email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, role_id, employee_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(username, email || null, hash, full_name, role_id, employee_id || null);

  auditLog(req.user.id, 'CREATE_USER', 'admin', result.lastInsertRowid, `Created user: ${username}`, null, null, getIp(req));
  const user = db.prepare('SELECT id, username, email, full_name, is_active, role_id FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /api/admin/users/:id
router.put('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { full_name, email, role_id, is_active, employee_id, new_password } = req.body;
  let hash = user.password_hash;
  if (new_password) {
    if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    hash = bcrypt.hashSync(new_password, 10);
  }

  db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      email = COALESCE(?, email),
      role_id = COALESCE(?, role_id),
      is_active = COALESCE(?, is_active),
      employee_id = COALESCE(?, employee_id),
      password_hash = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(full_name, email, role_id, is_active, employee_id, hash, req.params.id);

  auditLog(req.user.id, 'UPDATE_USER', 'admin', req.params.id, `Updated user: ${user.username}`, null, null, getIp(req));
  res.json({ message: 'User updated successfully' });
});

// ===== ROLES & PERMISSIONS =====

// GET /api/admin/roles
router.get('/roles', (req, res) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();
  const permissions = db.prepare('SELECT * FROM permissions ORDER BY role_id, module').all();
  res.json({ roles, permissions });
});

// PUT /api/admin/permissions/:role_id/:module
router.put('/permissions/:role_id/:module', (req, res) => {
  const { can_view, can_create, can_edit, can_delete, can_approve, has_financial_access, has_salary_access, has_reports_access } = req.body;

  db.prepare(`
    INSERT OR REPLACE INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_approve, has_financial_access, has_salary_access, has_reports_access)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.role_id, req.params.module,
    can_view ? 1 : 0, can_create ? 1 : 0, can_edit ? 1 : 0, can_delete ? 1 : 0,
    can_approve ? 1 : 0, has_financial_access ? 1 : 0, has_salary_access ? 1 : 0, has_reports_access ? 1 : 0);

  auditLog(req.user.id, 'UPDATE_PERMISSION', 'admin', req.params.role_id, `Updated permissions for role ${req.params.role_id} - ${req.params.module}`, null, null, getIp(req));
  res.json({ message: 'Permission updated' });
});

// ===== SETTINGS =====

// GET /api/admin/settings
router.get('/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings ORDER BY category, key').all();
  res.json({ data: settings });
});

// PUT /api/admin/settings
router.put('/settings', (req, res) => {
  const { updates } = req.body; // [{ key, value }]
  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: 'Updates array is required' });
  }

  const updateSetting = db.prepare(`
    UPDATE settings SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = ?
  `);

  const updateMany = db.transaction(() => {
    updates.forEach(({ key, value }) => {
      updateSetting.run(value, req.user.id, key);
    });
  });

  updateMany();
  auditLog(req.user.id, 'UPDATE_SETTINGS', 'admin', null, `Updated ${updates.length} settings`, null, null, getIp(req));
  res.json({ message: 'Settings saved' });
});

// ===== AUDIT LOGS =====

// GET /api/admin/audit-logs
router.get('/audit-logs', (req, res) => {
  const { module, user_id, from_date, to_date, page = 1, limit = 100 } = req.query;
  let where = 'WHERE 1=1';
  const params = [];

  if (module) { where += ' AND al.module = ?'; params.push(module); }
  if (user_id) { where += ' AND al.user_id = ?'; params.push(user_id); }
  if (from_date) { where += ' AND al.created_at >= ?'; params.push(from_date); }
  if (to_date) { where += ' AND al.created_at <= ?'; params.push(to_date + ' 23:59:59'); }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs al ${where}`).get(...params);
  const logs = db.prepare(`
    SELECT al.*, u.username, u.full_name as user_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ${where}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ data: logs, total: total.cnt });
});

module.exports = router;
