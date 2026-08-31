const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { auditLog, generateCode, getIp } = require('../utils/audit');

// GET /api/dispatch
router.get('/', authenticate, requirePermission('dispatch', 'can_view'), (req, res) => {
  const { search, status, customer_id, from_date, to_date, page = 1, limit = 50 } = req.query;
  let where = 'WHERE d.is_active = 1';
  const params = [];

  if (search) {
    where += ' AND (d.dispatch_code LIKE ? OR c.company_name LIKE ? OR d.tracking_number LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (status) { where += ' AND d.status = ?'; params.push(status); }
  if (customer_id) { where += ' AND d.customer_id = ?'; params.push(customer_id); }
  if (from_date) { where += ' AND d.dispatch_date >= ?'; params.push(from_date); }
  if (to_date) { where += ' AND d.dispatch_date <= ?'; params.push(to_date); }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM dispatches d LEFT JOIN customers c ON d.customer_id = c.id ${where}`).get(...params);
  const dispatches = db.prepare(`
    SELECT d.*, c.company_name as customer_name, c.whatsapp_number as customer_whatsapp,
      cj.job_code
    FROM dispatches d
    LEFT JOIN customers c ON d.customer_id = c.id
    LEFT JOIN coating_jobs cj ON d.coating_job_id = cj.id
    ${where}
    ORDER BY d.dispatch_date DESC, d.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ data: dispatches, total: total.cnt });
});

// POST /api/dispatch
router.post('/', authenticate, requirePermission('dispatch', 'can_create'), (req, res) => {
  const { customer_id, coating_job_id, purchase_item_id, diamond_type, shape, size,
    quantity, weight, dispatch_date, delivery_method, tracking_number, recipient, notes } = req.body;

  if (!customer_id || !quantity || !dispatch_date) {
    return res.status(400).json({ error: 'Customer, quantity, and dispatch date are required' });
  }

  const qty = parseFloat(quantity);

  // Validate available finished stock
  if (purchase_item_id) {
    const stock = db.prepare('SELECT * FROM stock WHERE purchase_item_id = ?').get(purchase_item_id);
    if (!stock || stock.finished_quantity < qty) {
      return res.status(400).json({
        error: `Insufficient finished stock. Available: ${stock ? stock.finished_quantity : 0}, Requested: ${qty}`
      });
    }
  }

  const code = generateCode('DISP', 'dispatches', 'dispatch_code');

  const createDispatch = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO dispatches (dispatch_code, customer_id, coating_job_id, purchase_item_id, diamond_type, shape, size,
        quantity, weight, dispatch_date, delivery_method, tracking_number, recipient, status, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dispatched', ?, ?)
    `).run(code, customer_id, coating_job_id || null, purchase_item_id || null, diamond_type || null,
      shape || null, size || null, qty, parseFloat(weight) || 0, dispatch_date,
      delivery_method || null, tracking_number || null, recipient || null, notes || null, req.user.id);

    // Reduce finished stock
    if (purchase_item_id) {
      db.prepare('UPDATE stock SET finished_quantity = MAX(0, finished_quantity - ?), dispatched_quantity = dispatched_quantity + ?, last_updated = datetime("now") WHERE purchase_item_id = ?')
        .run(qty, qty, purchase_item_id);

      db.prepare(`
        INSERT INTO stock_movements (movement_type, purchase_item_id, dispatch_id, quantity, from_status, to_status, notes, created_by)
        VALUES ('dispatch_out', ?, ?, ?, 'finished', 'dispatched', ?, ?)
      `).run(purchase_item_id, result.lastInsertRowid, qty, notes || null, req.user.id);
    }

    // Update job status
    if (coating_job_id) {
      db.prepare('UPDATE coating_jobs SET job_status = "completed", updated_at = datetime("now") WHERE id = ? AND job_status != "completed"').run(coating_job_id);
    }

    return result.lastInsertRowid;
  });

  const dispatchId = createDispatch();
  const dispatch = db.prepare('SELECT * FROM dispatches WHERE id = ?').get(dispatchId);
  auditLog(req.user.id, 'CREATE', 'dispatch', dispatchId, `Created dispatch ${code}`, null, dispatch, getIp(req));
  res.status(201).json(dispatch);
});

// GET /api/dispatch/:id
router.get('/:id', authenticate, requirePermission('dispatch', 'can_view'), (req, res) => {
  const dispatch = db.prepare(`
    SELECT d.*, c.company_name as customer_name, c.whatsapp_number as customer_whatsapp,
      c.phone as customer_phone, cj.job_code, u.full_name as created_by_name
    FROM dispatches d
    LEFT JOIN customers c ON d.customer_id = c.id
    LEFT JOIN coating_jobs cj ON d.coating_job_id = cj.id
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.id = ?
  `).get(req.params.id);

  if (!dispatch) return res.status(404).json({ error: 'Dispatch not found' });
  res.json(dispatch);
});

// PUT /api/dispatch/:id
router.put('/:id', authenticate, requirePermission('dispatch', 'can_edit'), (req, res) => {
  const dispatch = db.prepare('SELECT * FROM dispatches WHERE id = ?').get(req.params.id);
  if (!dispatch) return res.status(404).json({ error: 'Dispatch not found' });

  const { status, tracking_number, notes } = req.body;
  db.prepare(`
    UPDATE dispatches SET
      status = COALESCE(?, status),
      tracking_number = COALESCE(?, tracking_number),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(status, tracking_number, notes, req.params.id);

  const updated = db.prepare('SELECT * FROM dispatches WHERE id = ?').get(req.params.id);
  auditLog(req.user.id, 'UPDATE', 'dispatch', req.params.id, `Updated dispatch ${dispatch.dispatch_code}`, dispatch, updated, getIp(req));
  res.json(updated);
});

module.exports = router;
