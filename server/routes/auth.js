const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { auditLog, getIp } = require('../utils/audit');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare(`
    SELECT u.*, r.name as role_name
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE (u.username = ? OR u.email = ?) AND u.is_active = 1
  `).get(username, username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'resin-coating-jwt-super-secret-key-2024', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

  auditLog(user.id, 'LOGIN', 'auth', user.id, `User ${user.username} logged in`, null, null, getIp(req));

  const { password_hash, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const { password_hash, ...safeUser } = req.user;
  res.json(safeUser);
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  auditLog(req.user.id, 'LOGOUT', 'auth', req.user.id, `User ${req.user.username} logged out`, null, null, getIp(req));
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Both current and new password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?').run(newHash, req.user.id);
  auditLog(req.user.id, 'CHANGE_PASSWORD', 'auth', req.user.id, `User ${req.user.username} changed their password`, null, null, getIp(req));

  res.json({ message: 'Password changed successfully' });
});

module.exports = router;
