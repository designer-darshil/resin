const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'resin-coating-jwt-super-secret-key-2024';

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    body = body || {};

    const { username, password } = body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Try database authentication first
    let user = null;
    try {
      const db = require('../../../server/db/database');
      user = db.prepare(`
        SELECT u.*, r.name as role_name
        FROM users u JOIN roles r ON u.role_id = r.id
        WHERE (u.username = ? OR u.email = ?) AND u.is_active = 1
      `).get(username, username);
    } catch (dbErr) {
      console.warn('Database lookup fallback to default admin:', dbErr.message);
    }

    if (user) {
      if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
      const { password_hash, ...safeUser } = user;
      return res.status(200).json({ token, user: safeUser });
    }

    // Default admin fallback for serverless environment
    if ((username === 'admin' || username === 'admin@resin.local') && (password === 'admin123' || password === 'admin')) {
      const defaultUser = {
        id: 1,
        username: 'admin',
        email: 'admin@resin.local',
        full_name: 'Administrator',
        role_id: 1,
        role_name: 'admin',
        is_active: 1
      };
      const token = jwt.sign({ id: defaultUser.id, username: defaultUser.username, role_id: 1 }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({ token, user: defaultUser });
    }

    return res.status(401).json({ error: 'Invalid username or password' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
