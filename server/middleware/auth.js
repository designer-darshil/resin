const jwt = require('jsonwebtoken');
const db = require('../db/database');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare(`
      SELECT u.*, r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Load permissions
    const permissions = db.prepare(`
      SELECT * FROM permissions WHERE role_id = ?
    `).all(user.role_id);

    const permMap = {};
    permissions.forEach(p => { permMap[p.module] = p; });

    req.user = { ...user, permissions: permMap };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
