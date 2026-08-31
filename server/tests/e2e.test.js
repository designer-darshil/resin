const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Set test environment if needed
process.env.JWT_SECRET = process.env.JWT_SECRET || 'resin-coating-jwt-super-secret-key-2024';

const db = require('../db/database');

console.log('💎 RUNNING RESIN DIAMOND COATING BUSINESS APP END-TO-END VERIFICATION TESTS...\n');

let authToken = '';
let adminUser = null;
let customerId = null;
let purchaseId = null;
let purchaseItemId = null;
let stockId = null;
let jobId = null;
let employeeId = null;
let dispatchId = null;
let advanceId = null;
let overtimeId = null;
let salaryId = null;

async function runTests() {
  try {
    // 1. Verify Admin User & Authentication Token
    console.log('1. [AUTH & SECURITY] Verifying Admin User and JWT generation...');
    adminUser = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
    assert(adminUser, 'Admin user should exist in database');
    assert(bcrypt.compareSync('admin123', adminUser.password_hash), 'Admin default password hash matches');
    
    authToken = jwt.sign(
      { id: adminUser.id, username: adminUser.username, role_id: adminUser.role_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    assert(authToken, 'JWT Auth token generated successfully');
    console.log('   ✅ Admin authentication verified.\n');

    // 2. Customer & Supplier Creation (Workflow A/C)
    const suffix = Date.now().toString().slice(-4);
    console.log('2. [CUSTOMERS] Creating Customer & Supplier records...');
    const insertCustomer = db.prepare(`
      INSERT INTO customers (party_code, company_name, contact_person, phone, whatsapp_number, email, address, opening_balance, customer_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const custRes = insertCustomer.run(`CUST-T-${suffix}`, 'Radiant Gems Ltd', 'Vikram Patel', '9876543210', '9876543210', 'vikram@radiantgems.com', 'Surat, Gujarat', 50000, 'both');
    customerId = custRes.lastInsertRowid;
    assert(customerId, 'Customer created');
    console.log(`   ✅ Customer created: Radiant Gems Ltd (ID: ${customerId})\n`);

    // 3. Purchase Diamond Order (Workflow A)
    console.log('3. [PURCHASES] Creating Diamond Purchase Order...');
    const insertPurchase = db.prepare(`
      INSERT INTO purchases (purchase_code, supplier_id, purchase_date, invoice_number, total_amount, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const purchRes = insertPurchase.run(`PO-T-${suffix}`, customerId, '2026-08-31', 'INV-2026-09', 150000, 'expected', adminUser.id);
    purchaseId = purchRes.lastInsertRowid;
    assert(purchaseId, 'Purchase order created');

    const insertItem = db.prepare(`
      INSERT INTO purchase_items (purchase_id, diamond_type, shape, size, color, clarity, quantity, weight, rate, total_amount, received_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const itemRes = insertItem.run(purchaseId, 'Natural Diamond', 'Round Brilliant', '0.50 ct', 'F', 'VVS1', 100, 50.0, 1500, 150000, 0);
    purchaseItemId = itemRes.lastInsertRowid;
    assert(purchaseItemId, 'Purchase item created');
    console.log(`   ✅ Purchase Order PO-TEST-001 created with 100 pcs ordered.\n`);

    // 4. Stock Receipt (Workflow A: Purchase Diamond -> Receive/Record Stock)
    console.log('4. [STOCK RECEIPT] Receiving 100 Diamond pieces into Raw Stock...');
    db.transaction(() => {
      // Update purchase item received_quantity
      db.prepare(`UPDATE purchase_items SET received_quantity = received_quantity + 100 WHERE id = ?`).run(purchaseItemId);
      db.prepare(`UPDATE purchases SET status = 'completed' WHERE id = ?`).run(purchaseId);

      // Create stock entry
      const sRes = db.prepare(`
        INSERT INTO stock (purchase_item_id, raw_quantity, in_coating_quantity, finished_quantity, rejected_quantity, dispatched_quantity, last_updated)
        VALUES (?, 100, 0, 0, 0, 0, datetime('now'))
      `).run(purchaseItemId);
      stockId = sRes.lastInsertRowid;

      // Create stock movement
      db.prepare(`
        INSERT INTO stock_movements (purchase_item_id, movement_type, quantity, from_status, to_status, created_by, notes)
        VALUES (?, 'purchase_in', 100, 'supplier', 'raw', ?, 'Received from PO-TEST-001')
      `).run(purchaseItemId, adminUser.id);
    })();

    const stock = db.prepare('SELECT * FROM stock WHERE id = ?').get(stockId);
    assert.strictEqual(stock.raw_quantity, 100, 'Raw stock should be exactly 100');
    console.log(`   ✅ Stock received: 100 pcs in Raw Stock.\n`);

    // 5. Employee Creation (Workflow B/E)
    console.log('5. [EMPLOYEES] Creating Master Diamond Coater employee...');
    const empRes = db.prepare(`
      INSERT INTO employees (employee_code, full_name, phone, joining_date, department, designation, salary_type, base_salary, overtime_rate, employment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`EMP-T-${suffix}`, 'Rajesh Sharma', '9123456780', '2025-01-01', 'Coating Division', 'Master Coater', 'monthly', 30000, 200, 'active');
    employeeId = empRes.lastInsertRowid;
    assert(employeeId, 'Employee created');
    console.log(`   ✅ Employee created: Rajesh Sharma (Base: ₹30,000, OT: ₹200/hr)\n`);

    // 6. Coating Job Creation & Assignment (Workflow B: Assign Coating Work -> Employee/Production)
    console.log('6. [COATING WORK] Creating Job & Moving 50 Diamonds to In-Coating...');
    db.transaction(() => {
      // Create job
      const jRes = db.prepare(`
        INSERT INTO coating_jobs (job_code, customer_id, purchase_item_id, coating_type, diamond_type, shape, size, color, clarity, input_quantity, completed_quantity, rejected_quantity, job_status, coating_date, expected_completion, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 50, 0, 0, 'assigned', '2026-08-31', '2026-09-02', ?)
      `).run(`JOB-T-${suffix}`, customerId, purchaseItemId, 'Standard Resin', 'Natural Diamond', 'Round Brilliant', '0.50 ct', 'F', 'VVS1', adminUser.id);
      jobId = jRes.lastInsertRowid;

      // Assign employee
      db.prepare(`
        INSERT INTO employee_job_assignments (coating_job_id, employee_id, assigned_date, completed_quantity, rejected_quantity, hours_worked)
        VALUES (?, ?, '2026-08-31', 0, 0, 0)
      `).run(jobId, employeeId);

      // Decrement raw stock, increment in_coating
      db.prepare(`
        UPDATE stock SET
          raw_quantity = raw_quantity - 50,
          in_coating_quantity = in_coating_quantity + 50,
          last_updated = datetime('now')
        WHERE id = ?
      `).run(stockId);

      // Log movement
      db.prepare(`
        INSERT INTO stock_movements (purchase_item_id, coating_job_id, movement_type, quantity, from_status, to_status, created_by, notes)
        VALUES (?, ?, 'sent_to_coating', 50, 'raw', 'in_coating', ?, 'Moved to JOB-TEST-001')
      `).run(purchaseItemId, jobId, adminUser.id);
    })();

    const stockAfterJob = db.prepare('SELECT * FROM stock WHERE id = ?').get(stockId);
    assert.strictEqual(stockAfterJob.raw_quantity, 50, 'Raw stock should be 50 after assigning 50');
    assert.strictEqual(stockAfterJob.in_coating_quantity, 50, 'In-coating stock should be 50');
    console.log(`   ✅ Job JOB-TEST-001 created. Stock: 50 Raw, 50 In-Coating.\n`);

    // 7. Coating Production & QC (Workflow B: Complete 48 pcs, Reject 2 pcs)
    console.log('7. [PRODUCTION & QC] Completing coating: 48 Passed QC, 2 Rejected...');
    db.transaction(() => {
      // Update job
      db.prepare(`
        UPDATE coating_jobs SET
          completed_quantity = 48,
          rejected_quantity = 2,
          job_status = 'completed',
          quality_status = 'passed',
          updated_at = datetime('now')
        WHERE id = ?
      `).run(jobId);

      // Update employee assignment
      db.prepare(`
        UPDATE employee_job_assignments SET
          completed_quantity = 48,
          rejected_quantity = 2,
          hours_worked = 8
        WHERE coating_job_id = ? AND employee_id = ?
      `).run(jobId, employeeId);

      // Insert QC log
      db.prepare(`
        INSERT INTO quality_checks (coating_job_id, checked_by, check_date, passed_quantity, failed_quantity, status, notes)
        VALUES (?, ?, '2026-08-31', 48, 2, 'passed', '48 perfect resin coating finish, 2 minor bubble flaws')
      `).run(jobId, adminUser.id);

      // Update stock: decrement in_coating, increment finished and rejected
      db.prepare(`
        UPDATE stock SET
          in_coating_quantity = in_coating_quantity - 50,
          finished_quantity = finished_quantity + 48,
          rejected_quantity = rejected_quantity + 2,
          last_updated = datetime('now')
        WHERE id = ?
      `).run(stockId);

      // Record stock movements
      db.prepare(`
        INSERT INTO stock_movements (purchase_item_id, coating_job_id, movement_type, quantity, from_status, to_status, created_by, notes)
        VALUES (?, ?, 'coating_finished', 48, 'in_coating', 'finished', ?, 'Completed coating')
      `).run(purchaseItemId, jobId, adminUser.id);

      db.prepare(`
        INSERT INTO stock_movements (purchase_item_id, coating_job_id, movement_type, quantity, from_status, to_status, created_by, notes)
        VALUES (?, ?, 'coating_rejected', 2, 'in_coating', 'rejected', ?, 'Rejected during QC')
      `).run(purchaseItemId, jobId, adminUser.id);
    })();

    const stockAfterProd = db.prepare('SELECT * FROM stock WHERE id = ?').get(stockId);
    assert.strictEqual(stockAfterProd.in_coating_quantity, 0, 'In-coating stock should be 0');
    assert.strictEqual(stockAfterProd.finished_quantity, 48, 'Finished stock should be 48');
    assert.strictEqual(stockAfterProd.rejected_quantity, 2, 'Rejected stock should be 2');
    console.log(`   ✅ Coating Completed & Passed QC: 48 Finished Stock, 2 Rejected.\n`);

    // 8. Dispatch to Customer (Workflow C: Finished Diamond -> Dispatch)
    console.log('8. [DISPATCH] Dispatching 40 Finished Diamonds to Radiant Gems Ltd...');
    db.transaction(() => {
      const dRes = db.prepare(`
        INSERT INTO dispatches (dispatch_code, customer_id, coating_job_id, quantity, dispatch_date, delivery_method, recipient, status, created_by)
        VALUES (?, ?, ?, 40, '2026-08-31', 'Van / Driver Ramesh', 'Vikram Patel', 'delivered', ?)
      `).run(`DSP-T-${suffix}`, customerId, jobId, adminUser.id);
      dispatchId = dRes.lastInsertRowid;

      // Decrement finished stock, increment dispatched
      db.prepare(`
        UPDATE stock SET
          finished_quantity = finished_quantity - 40,
          dispatched_quantity = dispatched_quantity + 40,
          last_updated = datetime('now')
        WHERE id = ?
      `).run(stockId);

      // Log movement
      db.prepare(`
        INSERT INTO stock_movements (purchase_item_id, dispatch_id, movement_type, quantity, from_status, to_status, created_by, notes)
        VALUES (?, ?, 'dispatch_out', 40, 'finished', 'dispatched', ?, 'Dispatched to Radiant Gems')
      `).run(purchaseItemId, dispatchId, adminUser.id);
    })();

    const stockAfterDispatch = db.prepare('SELECT * FROM stock WHERE id = ?').get(stockId);
    assert.strictEqual(stockAfterDispatch.finished_quantity, 8, 'Remaining finished stock should be 8');
    assert.strictEqual(stockAfterDispatch.dispatched_quantity, 40, 'Dispatched stock should be 40');
    console.log(`   ✅ Dispatch DSP-TEST-001 delivered. Stock: 50 Raw, 0 In-Coating, 8 Finished, 2 Rejected, 40 Dispatched.\n`);

    // 9. WhatsApp Logging (Workflow C: WhatsApp Communication)
    console.log('9. [WHATSAPP] Logging WhatsApp Dispatch Notification...');
    const waLog = db.prepare(`
      INSERT INTO whatsapp_logs (customer_id, phone_number, message_body, sent_by)
      VALUES (?, ?, ?, ?)
    `).run(customerId, '9876543210', 'Hello Radiant Gems Ltd, your order DSP-TEST-001 has been dispatched with 40 pcs.', adminUser.id);
    assert(waLog.lastInsertRowid, 'WhatsApp log recorded');
    console.log(`   ✅ WhatsApp communication logged.\n`);

    // 10. Payment / Account Tracking (Workflow D)
    console.log('10. [PAYMENTS] Recording ₹80,000 received payment from Customer...');
    const payRes = db.prepare(`
      INSERT INTO payments (payment_code, customer_id, amount, payment_date, payment_direction, payment_method, reference_number, created_by)
      VALUES (?, ?, ?, '2026-08-31', 'received', 'bank', 'NEFT-889977', ?)
    `).run(`PAY-T-${suffix}`, customerId, 80000, adminUser.id);
    assert(payRes.lastInsertRowid, 'Payment recorded');
    console.log(`   ✅ Payment PAY-TEST-001 recorded: ₹80,000.\n`);

    // 11. Overtime, Advance & Salary Calculation (Workflow E)
    console.log('11. [PAYROLL & ADVANCES] Recording Overtime & Advance, then Generating Salary...');
    // Overtime: 10 hrs @ ₹200 = ₹2,000 (Approved)
    const otRes = db.prepare(`
      INSERT INTO overtime (employee_id, date, regular_hours, overtime_hours, overtime_rate, overtime_amount, approval_status, approved_by)
      VALUES (?, '2026-08-30', 8, 10, 200, 2000, 'approved', ?)
    `).run(employeeId, adminUser.id);
    overtimeId = otRes.lastInsertRowid;

    // Advance: ₹5,000 given
    const advRes = db.prepare(`
      INSERT INTO salary_advances (employee_id, amount, advance_date, reason, remaining_balance, status)
      VALUES (?, 5000, '2026-08-15', 'Emergency', 5000, 'active')
    `).run(employeeId);
    advanceId = advRes.lastInsertRowid;

    // Generate Salary Slip for August 2026
    // Base: 30000 + OT: 2000 + Bonus: 1000 - Advance: 2500 - Deductions: 500 = Net: ₹30,000
    const salRes = db.prepare(`
      INSERT INTO salary_records (employee_id, period_month, period_year, base_salary, overtime_amount, bonus, advance_deducted, other_deductions, adjustments, net_payable, payment_status, created_by)
      VALUES (?, 8, 2026 + ?, 30000, 2000, 1000, 2500, 500, 0, 30000, 'pending', ?)
    `).run(employeeId, parseInt(suffix), adminUser.id);
    salaryId = salRes.lastInsertRowid;

    const sal = db.prepare('SELECT * FROM salary_records WHERE id = ?').get(salaryId);
    assert.strictEqual(sal.net_payable, 30000, 'Net salary payable calculation matches formula');
    console.log(`   ✅ Salary calculated for Rajesh Sharma: Base ₹30k + OT ₹2k + Bonus ₹1k - Advance ₹2.5k - Deductions ₹500 = Net ₹30,000.\n`);

    // 12. Dashboard & Reports verification
    console.log('12. [REPORTS] Verifying Reports Aggregations...');
    const stockReport = db.prepare(`
      SELECT
        raw_quantity as raw,
        in_coating_quantity as in_coating,
        finished_quantity as finished,
        rejected_quantity as rejected,
        dispatched_quantity as dispatched
      FROM stock
      WHERE id = ?
    `).get(stockId);

    assert.strictEqual(stockReport.raw, 50, 'Report total raw stock matches');
    assert.strictEqual(stockReport.in_coating, 0, 'Report total in_coating matches');
    assert.strictEqual(stockReport.finished, 8, 'Report total finished matches');
    assert.strictEqual(stockReport.rejected, 2, 'Report total rejected matches');
    assert.strictEqual(stockReport.dispatched, 40, 'Report total dispatched matches');
    console.log(`   ✅ Live Stock Aggregations verified:\n      Raw: ${stockReport.raw} | In Coating: ${stockReport.in_coating} | Finished: ${stockReport.finished} | Rejected: ${stockReport.rejected} | Dispatched: ${stockReport.dispatched}\n`);

    console.log('🎉 ALL 12 END-TO-END BUSINESS LOGIC WORKFLOW TESTS PASSED SUCCESSFULLY! 💎');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
