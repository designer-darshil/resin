const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// GET /api/reports/dashboard — dashboard stats
router.get('/dashboard', authenticate, (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const stats = {
    // Jobs today
    jobs_today: db.prepare(`SELECT COUNT(*) as cnt FROM coating_jobs WHERE coating_date = ? AND is_active = 1`).get(today)?.cnt || 0,
    jobs_pending: db.prepare(`SELECT COUNT(*) as cnt FROM coating_jobs WHERE job_status IN ('draft','assigned','in_progress') AND is_active = 1`).get()?.cnt || 0,
    jobs_completed: db.prepare(`SELECT COUNT(*) as cnt FROM coating_jobs WHERE job_status = 'completed' AND is_active = 1`).get()?.cnt || 0,
    jobs_quality_check: db.prepare(`SELECT COUNT(*) as cnt FROM coating_jobs WHERE job_status = 'quality_check' AND is_active = 1`).get()?.cnt || 0,

    // Dispatches
    dispatches_today: db.prepare(`SELECT COUNT(*) as cnt FROM dispatches WHERE dispatch_date = ? AND is_active = 1`).get(today)?.cnt || 0,
    dispatches_pending: db.prepare(`SELECT COUNT(*) as cnt FROM dispatches WHERE status IN ('ready') AND is_active = 1`).get()?.cnt || 0,

    // Employees
    employees_active: db.prepare(`SELECT COUNT(*) as cnt FROM employees WHERE employment_status = 'active' AND is_active = 1`).get()?.cnt || 0,
    overtime_pending: db.prepare(`SELECT COUNT(*) as cnt FROM overtime WHERE approval_status = 'pending' AND is_active = 1`).get()?.cnt || 0,

    // Stock summary
    stock_raw: db.prepare(`SELECT COALESCE(SUM(raw_quantity),0) as total FROM stock`).get()?.total || 0,
    stock_in_coating: db.prepare(`SELECT COALESCE(SUM(in_coating_quantity),0) as total FROM stock`).get()?.total || 0,
    stock_finished: db.prepare(`SELECT COALESCE(SUM(finished_quantity),0) as total FROM stock`).get()?.total || 0,
    stock_rejected: db.prepare(`SELECT COALESCE(SUM(rejected_quantity),0) as total FROM stock`).get()?.total || 0,

    // Production today
    received_today: db.prepare(`SELECT COALESCE(SUM(quantity),0) as total FROM stock_movements WHERE movement_type='purchase_in' AND date(created_at)=?`).get(today)?.total || 0,
    coated_today: db.prepare(`SELECT COALESCE(SUM(quantity),0) as total FROM stock_movements WHERE movement_type='coating_finished' AND date(created_at)=?`).get(today)?.total || 0,

    // Salary pending
    salary_pending: db.prepare(`SELECT COUNT(*) as cnt FROM salary_records WHERE payment_status = 'pending' AND is_active = 1`).get()?.cnt || 0,

    // Customers with outstanding
    customers_outstanding: db.prepare(`SELECT COUNT(DISTINCT customer_id) as cnt FROM payments WHERE payment_direction='received' AND is_active=1`).get()?.cnt || 0,
  };

  // Recent jobs
  const recent_jobs = db.prepare(`
    SELECT cj.job_code, cj.job_status, cj.input_quantity, cj.completed_quantity,
      cj.expected_completion, c.company_name as customer_name
    FROM coating_jobs cj
    LEFT JOIN customers c ON cj.customer_id = c.id
    WHERE cj.is_active = 1
    ORDER BY cj.updated_at DESC LIMIT 5
  `).all();

  // Recent dispatches
  const recent_dispatches = db.prepare(`
    SELECT d.dispatch_code, d.quantity, d.dispatch_date, d.status,
      c.company_name as customer_name
    FROM dispatches d
    LEFT JOIN customers c ON d.customer_id = c.id
    WHERE d.is_active = 1
    ORDER BY d.dispatch_date DESC LIMIT 5
  `).all();

  res.json({ stats, recent_jobs, recent_dispatches });
});

// GET /api/reports/production
router.get('/production', authenticate, requirePermission('reports', 'has_reports_access'), (req, res) => {
  const { from_date, to_date, employee_id } = req.query;
  const from = from_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = to_date || new Date().toISOString().split('T')[0];

  const daily = db.prepare(`
    SELECT date(created_at) as date,
      SUM(CASE WHEN movement_type='purchase_in' THEN quantity ELSE 0 END) as received,
      SUM(CASE WHEN movement_type='coating_finished' THEN quantity ELSE 0 END) as coated,
      SUM(CASE WHEN movement_type='coating_rejected' THEN quantity ELSE 0 END) as rejected,
      SUM(CASE WHEN movement_type='dispatch_out' THEN quantity ELSE 0 END) as dispatched
    FROM stock_movements
    WHERE date(created_at) BETWEEN ? AND ?
    GROUP BY date(created_at)
    ORDER BY date(created_at) DESC
  `).all(from, to);

  const byEmployee = db.prepare(`
    SELECT e.full_name, e.employee_code,
      COALESCE(SUM(eja.completed_quantity),0) as completed,
      COALESCE(SUM(eja.rejected_quantity),0) as rejected,
      COUNT(DISTINCT eja.coating_job_id) as jobs
    FROM employee_job_assignments eja
    JOIN employees e ON eja.employee_id = e.id
    JOIN coating_jobs cj ON eja.coating_job_id = cj.id
    WHERE cj.coating_date BETWEEN ? AND ?
    ${employee_id ? 'AND e.id = ?' : ''}
    GROUP BY e.id
    ORDER BY completed DESC
  `).all(...(employee_id ? [from, to, employee_id] : [from, to]));

  res.json({ daily, by_employee: byEmployee, from, to });
});

// GET /api/reports/stock
router.get('/stock', authenticate, requirePermission('reports', 'has_reports_access'), (req, res) => {
  const stock = db.prepare(`
    SELECT s.*, pi.rate, pi.quantity as purchased_quantity,
      p.purchase_code, p.purchase_date, c.company_name as supplier_name
    FROM stock s
    LEFT JOIN purchase_items pi ON s.purchase_item_id = pi.id
    LEFT JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN customers c ON p.supplier_id = c.id
    ORDER BY s.last_updated DESC
  `).all();

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(raw_quantity),0) as raw,
      COALESCE(SUM(in_coating_quantity),0) as in_coating,
      COALESCE(SUM(finished_quantity),0) as finished,
      COALESCE(SUM(rejected_quantity),0) as rejected,
      COALESCE(SUM(dispatched_quantity),0) as dispatched
    FROM stock
  `).get();

  res.json({ stock, totals });
});

// GET /api/reports/employee
router.get('/employee', authenticate, requirePermission('reports', 'has_reports_access'), (req, res) => {
  const { from_date, to_date } = req.query;
  const from = from_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = to_date || new Date().toISOString().split('T')[0];

  const employeeReport = db.prepare(`
    SELECT e.id, e.full_name, e.employee_code, e.salary_type, e.base_salary,
      COALESCE(SUM(eja.completed_quantity),0) as total_completed,
      COALESCE(SUM(eja.rejected_quantity),0) as total_rejected,
      COALESCE(SUM(eja.hours_worked),0) as total_hours,
      COUNT(DISTINCT eja.coating_job_id) as total_jobs,
      (SELECT COALESCE(SUM(overtime_hours),0) FROM overtime WHERE employee_id = e.id AND date BETWEEN ? AND ? AND approval_status='approved') as overtime_hours,
      (SELECT COALESCE(SUM(overtime_amount),0) FROM overtime WHERE employee_id = e.id AND date BETWEEN ? AND ? AND approval_status='approved') as overtime_amount
    FROM employees e
    LEFT JOIN employee_job_assignments eja ON eja.employee_id = e.id
    LEFT JOIN coating_jobs cj ON eja.coating_job_id = cj.id AND cj.coating_date BETWEEN ? AND ?
    WHERE e.is_active = 1
    GROUP BY e.id
    ORDER BY e.full_name
  `).all(from, to, from, to, from, to);

  res.json({ employees: employeeReport, from, to });
});

// GET /api/reports/financial
router.get('/financial', authenticate, requirePermission('reports', 'has_reports_access'), (req, res) => {
  const { from_date, to_date } = req.query;
  const from = from_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = to_date || new Date().toISOString().split('T')[0];

  const purchases = db.prepare(`
    SELECT COALESCE(SUM(total_amount),0) as total FROM purchases WHERE purchase_date BETWEEN ? AND ? AND is_active=1
  `).get(from, to);

  const payments_received = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE payment_date BETWEEN ? AND ? AND payment_direction='received' AND is_active=1
  `).get(from, to);

  const payments_paid = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE payment_date BETWEEN ? AND ? AND payment_direction='paid' AND is_active=1
  `).get(from, to);

  const salary_expense = db.prepare(`
    SELECT COALESCE(SUM(net_payable),0) as total FROM salary_records WHERE period_year*100+period_month BETWEEN ? AND ? AND is_active=1
  `).get(parseInt(from.substring(0,4))*100 + parseInt(from.substring(5,7)),
         parseInt(to.substring(0,4))*100 + parseInt(to.substring(5,7)));

  const by_customer = db.prepare(`
    SELECT c.company_name, c.party_code,
      COALESCE(SUM(CASE WHEN p.payment_direction='received' THEN p.amount ELSE 0 END),0) as received,
      COALESCE(SUM(CASE WHEN p.payment_direction='paid' THEN p.amount ELSE 0 END),0) as paid
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    WHERE p.payment_date BETWEEN ? AND ? AND p.is_active=1
    GROUP BY c.id
    ORDER BY received DESC
  `).all(from, to);

  res.json({
    purchases: purchases.total,
    payments_received: payments_received.total,
    payments_paid: payments_paid.total,
    salary_expense: salary_expense.total,
    by_customer,
    from, to
  });
});

module.exports = router;
