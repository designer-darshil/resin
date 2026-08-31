const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { auditLog, getIp } = require('../utils/audit');

// GET /api/stock — stock overview
router.get('/', authenticate, requirePermission('stock', 'can_view'), (req, res) => {
  const { search, diamond_type, shape } = req.query;
  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (s.diamond_type LIKE ? OR s.shape LIKE ? OR s.size LIKE ? OR s.color LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  if (diamond_type) { where += ' AND s.diamond_type = ?'; params.push(diamond_type); }
  if (shape) { where += ' AND s.shape = ?'; params.push(shape); }

  const stock = db.prepare(`
    SELECT s.*, pi.rate,
      p.purchase_code, p.purchase_date,
      c.company_name as supplier_name
    FROM stock s
    LEFT JOIN purchase_items pi ON s.purchase_item_id = pi.id
    LEFT JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN customers c ON p.supplier_id = c.id
    ${where}
    ORDER BY s.last_updated DESC
  `).all(...params);

  // Summary totals
  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(raw_quantity),0) as total_raw,
      COALESCE(SUM(in_coating_quantity),0) as total_in_coating,
      COALESCE(SUM(finished_quantity),0) as total_finished,
      COALESCE(SUM(rejected_quantity),0) as total_rejected,
      COALESCE(SUM(dispatched_quantity),0) as total_dispatched
    FROM stock
  `).get();

  res.json({ data: stock, summary });
});

// GET /api/stock/movements
router.get('/movements', authenticate, requirePermission('stock', 'can_view'), (req, res) => {
  const { from_date, to_date, movement_type, purchase_item_id, page = 1, limit = 50 } = req.query;
  let where = 'WHERE 1=1';
  const params = [];

  if (movement_type) { where += ' AND sm.movement_type = ?'; params.push(movement_type); }
  if (purchase_item_id) { where += ' AND sm.purchase_item_id = ?'; params.push(purchase_item_id); }
  if (from_date) { where += ' AND sm.created_at >= ?'; params.push(from_date); }
  if (to_date) { where += ' AND sm.created_at <= ?'; params.push(to_date + ' 23:59:59'); }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM stock_movements sm ${where}`).get(...params);
  const movements = db.prepare(`
    SELECT sm.*,
      pi.diamond_type, pi.shape, pi.size,
      p.purchase_code,
      cj.job_code,
      d.dispatch_code,
      u.full_name as created_by_name
    FROM stock_movements sm
    LEFT JOIN purchase_items pi ON sm.purchase_item_id = pi.id
    LEFT JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN coating_jobs cj ON sm.coating_job_id = cj.id
    LEFT JOIN dispatches d ON sm.dispatch_id = d.id
    LEFT JOIN users u ON sm.created_by = u.id
    ${where}
    ORDER BY sm.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ data: movements, total: total.cnt });
});

// POST /api/stock/adjust — manual adjustment
router.post('/adjust', authenticate, requirePermission('stock', 'can_edit'), (req, res) => {
  const { purchase_item_id, adjustment_type, quantity, notes } = req.body;
  if (!purchase_item_id || !adjustment_type || quantity === undefined) {
    return res.status(400).json({ error: 'purchase_item_id, adjustment_type, and quantity are required' });
  }

  const stock = db.prepare('SELECT * FROM stock WHERE purchase_item_id = ?').get(purchase_item_id);
  if (!stock) return res.status(404).json({ error: 'Stock record not found' });

  const validTypes = ['raw_quantity', 'finished_quantity', 'rejected_quantity'];
  if (!validTypes.includes(adjustment_type)) {
    return res.status(400).json({ error: 'Invalid adjustment type' });
  }

  const newQty = (stock[adjustment_type] || 0) + parseFloat(quantity);
  if (newQty < 0) return res.status(400).json({ error: 'Adjustment would result in negative stock' });

  db.prepare(`UPDATE stock SET ${adjustment_type} = ?, last_updated = datetime('now') WHERE purchase_item_id = ?`)
    .run(newQty, purchase_item_id);

  db.prepare(`
    INSERT INTO stock_movements (movement_type, purchase_item_id, quantity, from_status, to_status, notes, created_by)
    VALUES ('adjustment', ?, ?, ?, ?, ?, ?)
  `).run(purchase_item_id, parseFloat(quantity), adjustment_type, adjustment_type, notes || 'Manual adjustment', req.user.id);

  auditLog(req.user.id, 'STOCK_ADJUST', 'stock', purchase_item_id, `Adjusted ${adjustment_type} by ${quantity}`, { [adjustment_type]: stock[adjustment_type] }, { [adjustment_type]: newQty }, getIp(req));
  res.json({ message: 'Stock adjusted successfully' });
});

module.exports = router;
