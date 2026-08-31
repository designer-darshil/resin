const db = require('../db/database');

const auditLog = (userId, action, module, recordId, description, oldValue = null, newValue = null, ip = null) => {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, description, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      action,
      module,
      String(recordId || ''),
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      description,
      ip
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

// Generate sequential codes like PUR-001, JOB-001, etc.
const generateCode = (prefix, table, codeColumn) => {
  const last = db.prepare(`SELECT ${codeColumn} FROM ${table} ORDER BY id DESC LIMIT 1`).get();
  if (!last || !last[codeColumn]) {
    return `${prefix}-001`;
  }
  const num = parseInt(last[codeColumn].split('-')[1] || '0', 10);
  return `${prefix}-${String(num + 1).padStart(3, '0')}`;
};

const getIp = (req) => {
  return req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
};

module.exports = { auditLog, generateCode, getIp };
