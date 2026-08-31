const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { auditLog, generateCode, getIp } = require('../utils/audit');
const WhatsAppService = require('../services/whatsappService');

// GET /api/purchases
router.get('/', authenticate, requirePermission('purchases', 'can_view'), (req, res) => {
  const { search, status, supplier_id, from_date, to_date, page = 1, limit = 50 } = req.query;
  let where = 'WHERE p.is_active = 1';
  const params = [];

  if (search) {
    where += ' AND (p.purchase_code LIKE ? OR p.invoice_number LIKE ? OR c.company_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (status) { where += ' AND p.status = ?'; params.push(status); }
  if (supplier_id) { where += ' AND p.supplier_id = ?'; params.push(supplier_id); }
  if (from_date) { where += ' AND p.purchase_date >= ?'; params.push(from_date); }
  if (to_date) { where += ' AND p.purchase_date <= ?'; params.push(to_date); }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM purchases p LEFT JOIN customers c ON p.supplier_id = c.id ${where}`).get(...params);
  const purchases = db.prepare(`
    SELECT p.*, c.company_name as supplier_name, c.whatsapp_number as supplier_whatsapp,
      (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as item_count,
      (SELECT COALESCE(SUM(quantity),0) FROM purchase_items WHERE purchase_id = p.id) as total_quantity
    FROM purchases p
    LEFT JOIN customers c ON p.supplier_id = c.id
    ${where}
    ORDER BY p.purchase_date DESC, p.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ data: purchases, total: total.cnt, page: parseInt(page), limit: parseInt(limit) });
});

// POST /api/purchases
router.post('/', authenticate, requirePermission('purchases', 'can_create'), (req, res) => {
  const { supplier_id, purchase_date, invoice_number, notes, items } = req.body;
  if (!supplier_id || !purchase_date) return res.status(400).json({ error: 'Supplier and purchase date are required' });
  if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required' });

  const code = generateCode('PUR', 'purchases', 'purchase_code');
  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);

  const insertPurchase = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO purchases (purchase_code, supplier_id, purchase_date, invoice_number, total_amount, notes, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'expected', ?)
    `).run(code, supplier_id, purchase_date, invoice_number || null, totalAmount, notes || null, req.user.id);

    const purchaseId = result.lastInsertRowid;
    for (const item of items) {
      const itemResult = db.prepare(`
        INSERT INTO purchase_items (purchase_id, diamond_type, shape, size, color, clarity, quantity, weight, rate, total_amount, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(purchaseId, item.diamond_type || null, item.shape || null, item.size || null, item.color || null, item.clarity || null,
        parseFloat(item.quantity) || 0, parseFloat(item.weight) || 0, parseFloat(item.rate) || 0,
        parseFloat(item.total_amount) || 0, item.notes || null);

      // Create stock record for this item
      db.prepare(`
        INSERT INTO stock (purchase_item_id, diamond_type, shape, size, color, clarity, raw_quantity)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(itemResult.lastInsertRowid, item.diamond_type || null, item.shape || null, item.size || null, item.color || null, item.clarity || null);
    }

    return purchaseId;
  });

  const purchaseId = insertPurchase();
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
  auditLog(req.user.id, 'CREATE', 'purchases', purchaseId, `Created purchase ${code}`, null, purchase, getIp(req));
  res.status(201).json(purchase);
});

// GET /api/purchases/:id
router.get('/:id', authenticate, requirePermission('purchases', 'can_view'), (req, res) => {
  const purchase = db.prepare(`
    SELECT p.*, c.company_name as supplier_name, c.whatsapp_number as supplier_whatsapp, c.phone as supplier_phone
    FROM purchases p LEFT JOIN customers c ON p.supplier_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

  const items = db.prepare(`
    SELECT pi.*, s.raw_quantity, s.in_coating_quantity, s.finished_quantity, s.rejected_quantity
    FROM purchase_items pi LEFT JOIN stock s ON s.purchase_item_id = pi.id
    WHERE pi.purchase_id = ?
  `).all(req.params.id);

  res.json({ ...purchase, items });
});

// PUT /api/purchases/:id
router.put('/:id', authenticate, requirePermission('purchases', 'can_edit'), (req, res) => {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

  const { status, invoice_number, notes } = req.body;
  db.prepare(`
    UPDATE purchases SET
      status = COALESCE(?, status),
      invoice_number = COALESCE(?, invoice_number),
      notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(status, invoice_number, notes, req.params.id);

  const updated = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  auditLog(req.user.id, 'UPDATE', 'purchases', req.params.id, `Updated purchase ${purchase.purchase_code}`, purchase, updated, getIp(req));
  res.json(updated);
});

// POST /api/purchases/:id/receive — receive stock against a purchase item
router.post('/:id/receive', authenticate, requirePermission('purchases', 'can_edit'), (req, res) => {
  const { item_id, received_quantity, notes } = req.body;
  if (!item_id || received_quantity === undefined) return res.status(400).json({ error: 'Item ID and received quantity required' });

  const item = db.prepare('SELECT * FROM purchase_items WHERE id = ? AND purchase_id = ?').get(item_id, req.params.id);
  if (!item) return res.status(404).json({ error: 'Purchase item not found' });

  const newReceived = item.received_quantity + parseFloat(received_quantity);
  if (newReceived > item.quantity) {
    return res.status(400).json({ error: `Cannot receive more than ordered quantity (${item.quantity})` });
  }

  const receiveItems = db.transaction(() => {
    db.prepare('UPDATE purchase_items SET received_quantity = ? WHERE id = ?').run(newReceived, item_id);

    // Update stock
    db.prepare('UPDATE stock SET raw_quantity = raw_quantity + ?, last_updated = datetime("now") WHERE purchase_item_id = ?')
      .run(parseFloat(received_quantity), item_id);

    // Stock movement record
    db.prepare(`
      INSERT INTO stock_movements (movement_type, purchase_item_id, quantity, from_status, to_status, notes, created_by)
      VALUES ('purchase_in', ?, ?, null, 'raw', ?, ?)
    `).run(item_id, parseFloat(received_quantity), notes || null, req.user.id);

    // Update purchase status
    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(req.params.id);
    const allReceived = items.every(i => i.received_quantity >= i.quantity);
    const anyReceived = items.some(i => i.received_quantity > 0);
    const newStatus = allReceived ? 'completed' : (anyReceived ? 'partial' : 'expected');
    db.prepare('UPDATE purchases SET status = ?, received_by = ?, updated_at = datetime("now") WHERE id = ?')
      .run(newStatus, req.user.id, req.params.id);
  });

  receiveItems();
  auditLog(req.user.id, 'RECEIVE_STOCK', 'purchases', req.params.id, `Received ${received_quantity} units for item ${item_id}`, null, null, getIp(req));

  // Trigger automated WhatsApp notification
  const purchase = db.prepare('SELECT p.*, c.company_name, c.phone, c.whatsapp_number FROM purchases p LEFT JOIN customers c ON p.supplier_id = c.id WHERE p.id = ?').get(req.params.id);
  if (purchase && purchase.supplier_id) {
    WhatsAppService.processTriggerEvent('purchase_received', 'purchase', req.params.id, {
      customer_id: purchase.supplier_id,
      supplier_name: purchase.company_name || 'Valued Supplier',
      purchase_number: purchase.purchase_code,
      quantity: received_quantity,
      weight: item.weight || 0
    });
  }

  res.json({ message: `Received ${received_quantity} units successfully` });
});

// DELETE /api/purchases/:id (soft delete)
router.delete('/:id', authenticate, requirePermission('purchases', 'can_delete'), (req, res) => {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

  db.prepare('UPDATE purchases SET is_active = 0, status = "cancelled", updated_at = datetime("now") WHERE id = ?').run(req.params.id);
  auditLog(req.user.id, 'CANCEL', 'purchases', req.params.id, `Cancelled purchase ${purchase.purchase_code}`, null, null, getIp(req));
  res.json({ message: 'Purchase cancelled' });
});

module.exports = router;
