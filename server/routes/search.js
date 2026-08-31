const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

// GET /api/search?q=query
router.get('/', authenticate, (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) {
    return res.json({
      results: {
        suppliers: [],
        customers: [],
        purchases: [],
        jobs: [],
        dispatches: [],
        employees: [],
        payments: []
      },
      total: 0
    });
  }

  const s = `%${query}%`;

  // 1. Suppliers
  const suppliers = db.prepare(`
    SELECT id, party_code, company_name, contact_person, phone, customer_type
    FROM customers
    WHERE is_active = 1 AND customer_type IN ('supplier', 'both')
      AND (company_name LIKE ? OR party_code LIKE ? OR contact_person LIKE ? OR phone LIKE ?)
    LIMIT 5
  `).all(s, s, s, s);

  // 2. Customers / Buyers
  const customers = db.prepare(`
    SELECT id, party_code, company_name, contact_person, phone, customer_type
    FROM customers
    WHERE is_active = 1 AND customer_type IN ('customer', 'both')
      AND (company_name LIKE ? OR party_code LIKE ? OR contact_person LIKE ? OR phone LIKE ?)
    LIMIT 5
  `).all(s, s, s, s);

  // 3. Purchases
  const purchases = db.prepare(`
    SELECT p.id, p.purchase_code, p.purchase_date, p.total_amount, p.status, c.company_name as supplier_name
    FROM purchases p
    LEFT JOIN customers c ON p.supplier_id = c.id
    WHERE p.is_active = 1
      AND (p.purchase_code LIKE ? OR p.invoice_number LIKE ? OR c.company_name LIKE ?)
    LIMIT 5
  `).all(s, s, s);

  // 4. Coating Jobs
  const jobs = db.prepare(`
    SELECT cj.id, cj.job_code, cj.job_status, cj.input_quantity, cj.completed_quantity, c.company_name as customer_name
    FROM coating_jobs cj
    LEFT JOIN customers c ON cj.customer_id = c.id
    WHERE cj.is_active = 1
      AND (cj.job_code LIKE ? OR c.company_name LIKE ? OR cj.coating_type LIKE ?)
    LIMIT 5
  `).all(s, s, s);

  // 5. Dispatches
  const dispatches = db.prepare(`
    SELECT d.id, d.dispatch_code, d.quantity, d.dispatch_date, d.status, d.tracking_number, c.company_name as customer_name
    FROM dispatches d
    LEFT JOIN customers c ON d.customer_id = c.id
    WHERE d.is_active = 1
      AND (d.dispatch_code LIKE ? OR d.tracking_number LIKE ? OR c.company_name LIKE ?)
    LIMIT 5
  `).all(s, s, s);

  // 6. Employees
  const employees = db.prepare(`
    SELECT id, employee_code, full_name, department, designation, phone
    FROM employees
    WHERE is_active = 1
      AND (full_name LIKE ? OR employee_code LIKE ? OR phone LIKE ? OR designation LIKE ?)
    LIMIT 5
  `).all(s, s, s, s);

  // 7. Payments
  const payments = db.prepare(`
    SELECT p.id, p.payment_code, p.amount, p.payment_date, p.payment_method, p.reference_number, c.company_name as customer_name
    FROM payments p
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE p.is_active = 1
      AND (p.payment_code LIKE ? OR p.reference_number LIKE ? OR c.company_name LIKE ?)
    LIMIT 5
  `).all(s, s, s);

  const total = suppliers.length + customers.length + purchases.length + jobs.length + dispatches.length + employees.length + payments.length;

  res.json({
    results: {
      suppliers,
      customers,
      purchases,
      jobs,
      dispatches,
      employees,
      payments
    },
    total
  });
});

module.exports = router;
