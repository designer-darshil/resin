const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { auditLog, generateCode, getIp } = require('../utils/audit');
const WhatsAppService = require('../services/whatsappService');

// GET /api/coating-jobs
router.get('/', authenticate, requirePermission('coating_jobs', 'can_view'), (req, res) => {
  const { search, status, customer_id, from_date, to_date, page = 1, limit = 50 } = req.query;
  let where = 'WHERE cj.is_active = 1';
  const params = [];

  if (search) {
    where += ' AND (cj.job_code LIKE ? OR c.company_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s);
  }
  if (status) { where += ' AND cj.job_status = ?'; params.push(status); }
  if (customer_id) { where += ' AND cj.customer_id = ?'; params.push(customer_id); }
  if (from_date) { where += ' AND cj.coating_date >= ?'; params.push(from_date); }
  if (to_date) { where += ' AND cj.coating_date <= ?'; params.push(to_date); }

  // Employee filter: only show assigned jobs for employees
  if (req.user.role_name === 'employee' && req.user.employee_id) {
    where += ' AND EXISTS (SELECT 1 FROM employee_job_assignments eja WHERE eja.coating_job_id = cj.id AND eja.employee_id = ?)';
    params.push(req.user.employee_id);
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM coating_jobs cj LEFT JOIN customers c ON cj.customer_id = c.id ${where}`).get(...params);
  const jobs = db.prepare(`
    SELECT cj.*,
      c.company_name as customer_name, c.whatsapp_number as customer_whatsapp,
      (SELECT COUNT(*) FROM employee_job_assignments WHERE coating_job_id = cj.id) as assignment_count,
      (SELECT GROUP_CONCAT(e.full_name, ', ') FROM employee_job_assignments eja
       JOIN employees e ON eja.employee_id = e.id WHERE eja.coating_job_id = cj.id) as assigned_employees
    FROM coating_jobs cj
    LEFT JOIN customers c ON cj.customer_id = c.id
    ${where}
    ORDER BY cj.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ data: jobs, total: total.cnt, page: parseInt(page), limit: parseInt(limit) });
});

// POST /api/coating-jobs
router.post('/', authenticate, requirePermission('coating_jobs', 'can_create'), (req, res) => {
  const { customer_id, purchase_item_id, diamond_type, shape, size, color, clarity,
    input_quantity, input_weight, coating_type, coating_date, expected_completion, notes } = req.body;

  if (!input_quantity || input_quantity <= 0) return res.status(400).json({ error: 'Input quantity is required' });

  // Validate stock availability if purchase_item_id provided
  if (purchase_item_id) {
    const stock = db.prepare('SELECT * FROM stock WHERE purchase_item_id = ?').get(purchase_item_id);
    if (!stock) return res.status(404).json({ error: 'Stock record not found' });
    if (stock.raw_quantity < parseFloat(input_quantity)) {
      return res.status(400).json({
        error: `Insufficient raw stock. Available: ${stock.raw_quantity}, Requested: ${input_quantity}`
      });
    }
  }

  const code = generateCode('JOB', 'coating_jobs', 'job_code');

  const createJob = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO coating_jobs (job_code, customer_id, purchase_item_id, diamond_type, shape, size, color, clarity,
        input_quantity, input_weight, coating_type, coating_date, expected_completion, notes, job_status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(code, customer_id || null, purchase_item_id || null, diamond_type || null, shape || null, size || null,
      color || null, clarity || null, parseFloat(input_quantity), parseFloat(input_weight) || 0,
      coating_type || null, coating_date || null, expected_completion || null, notes || null, req.user.id);

    // Move stock: raw → in_coating
    if (purchase_item_id) {
      db.prepare('UPDATE stock SET raw_quantity = raw_quantity - ?, in_coating_quantity = in_coating_quantity + ?, last_updated = datetime("now") WHERE purchase_item_id = ?')
        .run(parseFloat(input_quantity), parseFloat(input_quantity), purchase_item_id);

      db.prepare(`
        INSERT INTO stock_movements (movement_type, purchase_item_id, coating_job_id, quantity, from_status, to_status, notes, created_by)
        VALUES ('sent_to_coating', ?, ?, ?, 'raw', 'in_coating', ?, ?)
      `).run(purchase_item_id, result.lastInsertRowid, parseFloat(input_quantity), `Sent to job ${code}`, req.user.id);
    }

    return result.lastInsertRowid;
  });

  const jobId = createJob();
  const job = db.prepare('SELECT * FROM coating_jobs WHERE id = ?').get(jobId);
  auditLog(req.user.id, 'CREATE', 'coating_jobs', jobId, `Created coating job ${code}`, null, job, getIp(req));

  // Trigger automated WhatsApp notification
  if (job.customer_id) {
    const cust = db.prepare('SELECT company_name, phone, whatsapp_number FROM customers WHERE id = ?').get(job.customer_id);
    WhatsAppService.processTriggerEvent('job_created', 'job', jobId, {
      customer_id: job.customer_id,
      party_name: cust?.company_name || 'Valued Customer',
      job_number: job.job_code,
      quantity: job.input_quantity,
      coating_type: job.coating_type || 'Standard',
      due_date: job.expected_completion || 'TBD'
    });
  }

  res.status(201).json(job);
});

// GET /api/coating-jobs/:id
router.get('/:id', authenticate, requirePermission('coating_jobs', 'can_view'), (req, res) => {
  const job = db.prepare(`
    SELECT cj.*, c.company_name as customer_name, c.whatsapp_number as customer_whatsapp,
      pi.diamond_type as pi_type, pi.quantity as pi_quantity,
      p.purchase_code, s.raw_quantity as available_raw
    FROM coating_jobs cj
    LEFT JOIN customers c ON cj.customer_id = c.id
    LEFT JOIN purchase_items pi ON cj.purchase_item_id = pi.id
    LEFT JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN stock s ON s.purchase_item_id = cj.purchase_item_id
    WHERE cj.id = ?
  `).get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Coating job not found' });

  const assignments = db.prepare(`
    SELECT eja.*, e.full_name as employee_name, e.employee_code
    FROM employee_job_assignments eja
    JOIN employees e ON eja.employee_id = e.id
    WHERE eja.coating_job_id = ?
  `).all(req.params.id);

  const qualityChecks = db.prepare(`
    SELECT qc.*, u.full_name as checked_by_name
    FROM quality_checks qc
    LEFT JOIN users u ON qc.checked_by = u.id
    WHERE qc.coating_job_id = ?
    ORDER BY qc.created_at DESC
  `).all(req.params.id);

  res.json({ ...job, assignments, quality_checks: qualityChecks });
});

// PUT /api/coating-jobs/:id
router.put('/:id', authenticate, requirePermission('coating_jobs', 'can_edit'), (req, res) => {
  const job = db.prepare('SELECT * FROM coating_jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Coating job not found' });

  const { job_status, coating_type, expected_completion, notes, quality_status } = req.body;

  db.prepare(`
    UPDATE coating_jobs SET
      job_status = COALESCE(?, job_status),
      coating_type = COALESCE(?, coating_type),
      expected_completion = COALESCE(?, expected_completion),
      quality_status = COALESCE(?, quality_status),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(job_status, coating_type, expected_completion, quality_status, notes, req.params.id);

  const updated = db.prepare('SELECT * FROM coating_jobs WHERE id = ?').get(req.params.id);
  auditLog(req.user.id, 'UPDATE', 'coating_jobs', req.params.id, `Updated job ${job.job_code}`, job, updated, getIp(req));
  res.json(updated);
});

// POST /api/coating-jobs/:id/assign — assign employee
router.post('/:id/assign', authenticate, requirePermission('coating_jobs', 'can_edit'), (req, res) => {
  const { employee_id, assigned_date, notes } = req.body;
  if (!employee_id) return res.status(400).json({ error: 'Employee ID is required' });

  const job = db.prepare('SELECT * FROM coating_jobs WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const employee = db.prepare('SELECT * FROM employees WHERE id = ? AND is_active = 1').get(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const result = db.prepare(`
    INSERT INTO employee_job_assignments (coating_job_id, employee_id, assigned_date, assigned_by, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, employee_id, assigned_date || new Date().toISOString().split('T')[0], req.user.id, notes || null);

  // Update job status to assigned if in draft
  if (job.job_status === 'draft') {
    db.prepare('UPDATE coating_jobs SET job_status = "assigned", updated_at = datetime("now") WHERE id = ?').run(req.params.id);
  }

  auditLog(req.user.id, 'ASSIGN', 'coating_jobs', req.params.id, `Assigned ${employee.full_name} to job ${job.job_code}`, null, null, getIp(req));
  res.status(201).json({ message: `${employee.full_name} assigned to job ${job.job_code}` });
});

// POST /api/coating-jobs/:id/complete — record completion
router.post('/:id/complete', authenticate, requirePermission('coating_jobs', 'can_edit'), (req, res) => {
  const { completed_quantity, rejected_quantity, notes, assignment_id } = req.body;

  if (completed_quantity === undefined) return res.status(400).json({ error: 'completed_quantity is required' });

  const job = db.prepare('SELECT * FROM coating_jobs WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const completed = parseFloat(completed_quantity) || 0;
  const rejected = parseFloat(rejected_quantity) || 0;
  const total = completed + rejected;

  if (total > job.input_quantity) {
    return res.status(400).json({ error: `Total (${total}) exceeds input quantity (${job.input_quantity})` });
  }

  const completeJob = db.transaction(() => {
    db.prepare(`
      UPDATE coating_jobs SET
        completed_quantity = completed_quantity + ?,
        rejected_quantity = rejected_quantity + ?,
        job_status = 'quality_check',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(completed, rejected, req.params.id);

    // Update assignment if provided
    if (assignment_id) {
      db.prepare(`
        UPDATE employee_job_assignments SET
          completed_quantity = ?, rejected_quantity = ?, updated_at = datetime('now')
        WHERE id = ? AND coating_job_id = ?
      `).run(completed, rejected, assignment_id, req.params.id);
    }

    // Update stock: in_coating → finished + rejected
    if (job.purchase_item_id) {
      db.prepare(`UPDATE stock SET
        in_coating_quantity = MAX(0, in_coating_quantity - ?),
        finished_quantity = finished_quantity + ?,
        rejected_quantity = rejected_quantity + ?,
        last_updated = datetime('now')
        WHERE purchase_item_id = ?
      `).run(total, completed, rejected, job.purchase_item_id);

      if (completed > 0) {
        db.prepare(`INSERT INTO stock_movements (movement_type, purchase_item_id, coating_job_id, quantity, from_status, to_status, notes, created_by)
          VALUES ('coating_finished', ?, ?, ?, 'in_coating', 'finished', ?, ?)
        `).run(job.purchase_item_id, req.params.id, completed, notes || null, req.user.id);
      }
      if (rejected > 0) {
        db.prepare(`INSERT INTO stock_movements (movement_type, purchase_item_id, coating_job_id, quantity, from_status, to_status, notes, created_by)
          VALUES ('coating_rejected', ?, ?, ?, 'in_coating', 'rejected', ?, ?)
        `).run(job.purchase_item_id, req.params.id, rejected, notes || null, req.user.id);
      }
    }

    // Record quality check
    db.prepare(`
      INSERT INTO quality_checks (coating_job_id, checked_by, check_date, passed_quantity, failed_quantity, notes, status)
      VALUES (?, ?, date('now'), ?, ?, ?, ?)
    `).run(req.params.id, req.user.id, completed, rejected, notes || null, rejected > 0 ? 'partial' : 'passed');
  });

  completeJob();
  auditLog(req.user.id, 'COMPLETE', 'coating_jobs', req.params.id, `Completed job ${job.job_code}: ${completed} passed, ${rejected} rejected`, null, null, getIp(req));

  // Trigger automated WhatsApp notification
  if (job.customer_id && completed > 0) {
    const cust = db.prepare('SELECT company_name, phone, whatsapp_number FROM customers WHERE id = ?').get(job.customer_id);
    WhatsAppService.processTriggerEvent('coating_completed', 'job', req.params.id, {
      customer_id: job.customer_id,
      party_name: cust?.company_name || 'Valued Customer',
      job_number: job.job_code,
      quantity: completed,
      coating_type: job.coating_type || 'Standard'
    });
  }

  res.json({ message: 'Job completion recorded successfully' });
});

// DELETE /api/coating-jobs/:id
router.delete('/:id', authenticate, requirePermission('coating_jobs', 'can_delete'), (req, res) => {
  const job = db.prepare('SELECT * FROM coating_jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (['completed', 'in_progress'].includes(job.job_status)) {
    return res.status(400).json({ error: 'Cannot cancel a completed or in-progress job' });
  }

  const cancelJob = db.transaction(() => {
    db.prepare('UPDATE coating_jobs SET is_active = 0, job_status = "cancelled", updated_at = datetime("now") WHERE id = ?').run(req.params.id);

    // Return stock if it was taken from raw
    if (job.purchase_item_id && job.job_status !== 'draft') {
      const sentToCoating = job.input_quantity - job.completed_quantity - job.rejected_quantity;
      if (sentToCoating > 0) {
        db.prepare('UPDATE stock SET in_coating_quantity = MAX(0, in_coating_quantity - ?), raw_quantity = raw_quantity + ?, last_updated = datetime("now") WHERE purchase_item_id = ?')
          .run(sentToCoating, sentToCoating, job.purchase_item_id);
        db.prepare(`INSERT INTO stock_movements (movement_type, purchase_item_id, coating_job_id, quantity, from_status, to_status, notes, created_by)
          VALUES ('adjustment', ?, ?, ?, 'in_coating', 'raw', 'Job cancelled - returned to raw stock', ?)
        `).run(job.purchase_item_id, req.params.id, sentToCoating, req.user.id);
      }
    }
  });

  cancelJob();
  auditLog(req.user.id, 'CANCEL', 'coating_jobs', req.params.id, `Cancelled job ${job.job_code}`, null, null, getIp(req));
  res.json({ message: 'Job cancelled' });
});

module.exports = router;
