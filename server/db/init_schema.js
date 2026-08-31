const bcrypt = require('bcryptjs');

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_system_role INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      employee_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      module TEXT NOT NULL,
      can_view INTEGER DEFAULT 0,
      can_create INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 0,
      can_delete INTEGER DEFAULT 0,
      can_approve INTEGER DEFAULT 0,
      has_financial_access INTEGER DEFAULT 0,
      has_salary_access INTEGER DEFAULT 0,
      has_reports_access INTEGER DEFAULT 0,
      UNIQUE(role_id, module)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      label TEXT,
      category TEXT,
      updated_by INTEGER REFERENCES users(id),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id TEXT,
      old_value TEXT,
      new_value TEXT,
      description TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_code TEXT UNIQUE,
      company_name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      whatsapp_number TEXT,
      email TEXT,
      address TEXT,
      gst_number TEXT,
      opening_balance REAL DEFAULT 0,
      customer_type TEXT DEFAULT 'customer',
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code TEXT UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      joining_date TEXT,
      department TEXT,
      designation TEXT,
      employment_status TEXT DEFAULT 'active',
      salary_type TEXT DEFAULT 'monthly',
      base_salary REAL DEFAULT 0,
      overtime_rate REAL DEFAULT 0,
      payment_frequency TEXT DEFAULT 'monthly',
      bank_details TEXT,
      emergency_contact TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_code TEXT UNIQUE,
      supplier_id INTEGER NOT NULL REFERENCES customers(id),
      purchase_date TEXT NOT NULL,
      invoice_number TEXT,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'expected',
      received_by INTEGER REFERENCES users(id),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id),
      diamond_type TEXT,
      shape TEXT,
      size TEXT,
      color TEXT,
      clarity TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      weight REAL DEFAULT 0,
      rate REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      received_quantity REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_item_id INTEGER UNIQUE REFERENCES purchase_items(id),
      diamond_type TEXT,
      shape TEXT,
      size TEXT,
      color TEXT,
      clarity TEXT,
      raw_quantity REAL DEFAULT 0,
      in_coating_quantity REAL DEFAULT 0,
      finished_quantity REAL DEFAULT 0,
      rejected_quantity REAL DEFAULT 0,
      dispatched_quantity REAL DEFAULT 0,
      last_updated TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_type TEXT NOT NULL,
      purchase_item_id INTEGER REFERENCES purchase_items(id),
      coating_job_id INTEGER,
      dispatch_id INTEGER,
      quantity REAL NOT NULL,
      weight REAL DEFAULT 0,
      from_status TEXT,
      to_status TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coating_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_code TEXT UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      purchase_item_id INTEGER REFERENCES purchase_items(id),
      diamond_type TEXT,
      shape TEXT,
      size TEXT,
      color TEXT,
      clarity TEXT,
      input_quantity REAL NOT NULL DEFAULT 0,
      input_weight REAL DEFAULT 0,
      coating_type TEXT,
      coating_date TEXT,
      expected_completion TEXT,
      completed_quantity REAL DEFAULT 0,
      rejected_quantity REAL DEFAULT 0,
      quality_status TEXT DEFAULT 'pending',
      job_status TEXT DEFAULT 'draft',
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS employee_job_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coating_job_id INTEGER NOT NULL REFERENCES coating_jobs(id),
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      assigned_date TEXT,
      assigned_by INTEGER REFERENCES users(id),
      start_time TEXT,
      end_time TEXT,
      hours_worked REAL DEFAULT 0,
      quantity_handled REAL DEFAULT 0,
      completed_quantity REAL DEFAULT 0,
      rejected_quantity REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quality_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coating_job_id INTEGER NOT NULL REFERENCES coating_jobs(id),
      checked_by INTEGER REFERENCES users(id),
      check_date TEXT,
      passed_quantity REAL DEFAULT 0,
      failed_quantity REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS overtime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      coating_job_id INTEGER REFERENCES coating_jobs(id),
      date TEXT NOT NULL,
      regular_hours REAL DEFAULT 0,
      overtime_hours REAL NOT NULL DEFAULT 0,
      overtime_rate REAL DEFAULT 0,
      overtime_amount REAL DEFAULT 0,
      approved_by INTEGER REFERENCES users(id),
      approval_status TEXT DEFAULT 'pending',
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS salary_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      period_month INTEGER NOT NULL,
      period_year INTEGER NOT NULL,
      base_salary REAL DEFAULT 0,
      overtime_amount REAL DEFAULT 0,
      bonus REAL DEFAULT 0,
      advance_deducted REAL DEFAULT 0,
      other_deductions REAL DEFAULT 0,
      adjustments REAL DEFAULT 0,
      gross_amount REAL DEFAULT 0,
      net_payable REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'pending',
      payment_date TEXT,
      payment_method TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id),
      UNIQUE(employee_id, period_month, period_year)
    );

    CREATE TABLE IF NOT EXISTS salary_advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      advance_date TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      reason TEXT,
      repayment_plan TEXT,
      remaining_balance REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      approved_by INTEGER REFERENCES users(id),
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dispatches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispatch_code TEXT UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      coating_job_id INTEGER REFERENCES coating_jobs(id),
      purchase_item_id INTEGER REFERENCES purchase_items(id),
      diamond_type TEXT,
      shape TEXT,
      size TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      weight REAL DEFAULT 0,
      dispatch_date TEXT NOT NULL,
      delivery_method TEXT,
      tracking_number TEXT,
      recipient TEXT,
      status TEXT DEFAULT 'ready',
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_code TEXT UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      reference_number TEXT,
      related_dispatch_id INTEGER REFERENCES dispatches(id),
      related_purchase_id INTEGER REFERENCES purchases(id),
      payment_direction TEXT DEFAULT 'received',
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS whatsapp_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      template_body TEXT NOT NULL,
      variables TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS whatsapp_automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trigger_event TEXT UNIQUE NOT NULL,
      recipient_role TEXT NOT NULL DEFAULT 'buyer',
      template_id INTEGER REFERENCES whatsapp_templates(id),
      is_enabled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      template_id INTEGER REFERENCES whatsapp_templates(id),
      phone_number TEXT,
      message_body TEXT,
      status TEXT DEFAULT 'sent',
      message_id TEXT,
      idempotency_key TEXT UNIQUE,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      trigger_event TEXT,
      related_entity_type TEXT,
      related_entity_id INTEGER,
      sent_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Run dynamic schema migrations on existing database if columns are missing
  try {
    const columns = db.prepare(`PRAGMA table_info(whatsapp_logs)`).all().map(c => c.name);
    if (!columns.includes('status')) db.exec(`ALTER TABLE whatsapp_logs ADD COLUMN status TEXT DEFAULT 'sent'`);
    if (!columns.includes('message_id')) db.exec(`ALTER TABLE whatsapp_logs ADD COLUMN message_id TEXT`);
    if (!columns.includes('idempotency_key')) db.exec(`ALTER TABLE whatsapp_logs ADD COLUMN idempotency_key TEXT`);
    if (!columns.includes('error_message')) db.exec(`ALTER TABLE whatsapp_logs ADD COLUMN error_message TEXT`);
    if (!columns.includes('retry_count')) db.exec(`ALTER TABLE whatsapp_logs ADD COLUMN retry_count INTEGER DEFAULT 0`);
    if (!columns.includes('trigger_event')) db.exec(`ALTER TABLE whatsapp_logs ADD COLUMN trigger_event TEXT`);
    if (!columns.includes('related_entity_type')) db.exec(`ALTER TABLE whatsapp_logs ADD COLUMN related_entity_type TEXT`);
    if (!columns.includes('related_entity_id')) db.exec(`ALTER TABLE whatsapp_logs ADD COLUMN related_entity_id INTEGER`);
    if (!columns.includes('updated_at')) db.exec(`ALTER TABLE whatsapp_logs ADD COLUMN updated_at TEXT`);
  } catch (e) {
    console.error('Migration error on whatsapp_logs:', e.message);
  }

  // Seed roles
  const insertRole = db.prepare(`INSERT OR IGNORE INTO roles (name, description, is_system_role) VALUES (?, ?, 1)`);
  insertRole.run('admin', 'Full system access');
  insertRole.run('manager', 'Configurable access — set by admin');
  insertRole.run('employee', 'Restricted to own work and assigned jobs');

  const roles = db.prepare('SELECT * FROM roles').all();
  const roleMap = {};
  roles.forEach(r => { roleMap[r.name] = r.id; });

  // Seed permissions
  const modules = [
    'dashboard','purchases','stock','coating_jobs','customers',
    'employees','salary','overtime','advances','dispatch',
    'payments','whatsapp','reports','admin','audit_logs','settings'
  ];

  const upsertPermission = db.prepare(`
    INSERT OR REPLACE INTO permissions
    (role_id, module, can_view, can_create, can_edit, can_delete, can_approve, has_financial_access, has_salary_access, has_reports_access)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  modules.forEach(mod => {
    if (roleMap['admin']) upsertPermission.run(roleMap['admin'], mod, 1, 1, 1, 1, 1, 1, 1, 1);
  });

  const managerModules = {
    dashboard:    [1,0,0,0,0,0,0,1],
    purchases:    [1,1,0,0,0,0,0,0],
    stock:        [1,0,0,0,0,0,0,0],
    coating_jobs: [1,1,1,0,0,0,0,1],
    customers:    [1,1,1,0,0,0,0,0],
    employees:    [1,0,0,0,0,0,0,0],
    salary:       [0,0,0,0,0,0,0,0],
    overtime:     [1,1,0,0,1,0,0,0],
    advances:     [0,0,0,0,0,0,0,0],
    dispatch:     [1,1,1,0,0,0,0,0],
    payments:     [1,0,0,0,0,1,0,0],
    whatsapp:     [1,1,0,0,0,0,0,0],
    reports:      [1,0,0,0,0,0,0,1],
    admin:        [0,0,0,0,0,0,0,0],
    audit_logs:   [0,0,0,0,0,0,0,0],
    settings:     [0,0,0,0,0,0,0,0],
  };
  Object.entries(managerModules).forEach(([mod, perms]) => {
    if (roleMap['manager']) upsertPermission.run(roleMap['manager'], mod, ...perms);
  });

  // Seed default admin user
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin && roleMap['admin']) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role_id)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin', 'admin@resin.local', hash, 'Administrator', roleMap['admin']);
  }

  // Seed default settings
  const defaultSettings = [
    ['business_name', 'Resin Diamond Coating', 'Business Name', 'business'],
    ['currency_symbol', '₹', 'Currency Symbol', 'business'],
    ['currency_code', 'INR', 'Currency Code', 'business'],
    ['date_format', 'DD/MM/YYYY', 'Date Format', 'business'],
    ['overtime_default_rate', '150', 'Default Overtime Rate (per hour)', 'employees'],
    ['salary_default_type', 'monthly', 'Default Salary Type', 'employees'],
    ['whatsapp_automation_enabled', '0', 'WhatsApp Automation Master Toggle', 'whatsapp'],
    ['whatsapp_test_mode', '0', 'WhatsApp Test Mode (Log only, no real send)', 'whatsapp'],
    ['whatsapp_require_approval', '0', 'Require Approval for Automated WhatsApp Messages', 'whatsapp'],
    ['whatsapp_auto_retry', '1', 'Auto Retry Failed WhatsApp Messages', 'whatsapp'],
    ['whatsapp_max_retries', '3', 'Maximum Retry Attempts', 'whatsapp'],
  ];
  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value, label, category) VALUES (?, ?, ?, ?)`);
  defaultSettings.forEach(s => insertSetting.run(...s));

  // Seed default WhatsApp templates
  const defaultTemplates = [
    {
      name: 'Purchase Received',
      category: 'order_update',
      template_body: 'Hello {{supplier_name}},\n\nWe have received your diamond shipment for Purchase {{purchase_number}}.\nTotal Quantity: {{quantity}} pcs ({{weight}} ct).\n\nThank you,\nResin Diamond Coating',
      variables: JSON.stringify(['supplier_name', 'purchase_number', 'quantity', 'weight'])
    },
    {
      name: 'Purchase Confirmation',
      category: 'order_update',
      template_body: 'Hello {{supplier_name}},\n\nPurchase {{purchase_number}} has been verified and confirmed.\nTotal Amount: ₹{{amount}}.\n\nThank you,\nResin Diamond Coating',
      variables: JSON.stringify(['supplier_name', 'purchase_number', 'amount'])
    },
    {
      name: 'Job Received',
      category: 'order_update',
      template_body: 'Hello {{party_name}},\n\nYour coating job {{job_number}} has been created and received.\nQuantity: {{quantity}} pcs\nCoating Type: {{coating_type}}\nExpected Completion: {{due_date}}.\n\nThank you,\nResin Diamond Coating',
      variables: JSON.stringify(['party_name', 'job_number', 'quantity', 'coating_type', 'due_date'])
    },
    {
      name: 'Coating Completed',
      category: 'quality_update',
      template_body: 'Hello {{party_name}},\n\nYour coating job {{job_number}} has been completed.\n\nQuantity: {{quantity}} pcs\nCoating: {{coating_type}}\n\nIt is now ready for the next step.\nThank you,\nResin Diamond Coating',
      variables: JSON.stringify(['party_name', 'job_number', 'quantity', 'coating_type'])
    },
    {
      name: 'Ready for Dispatch',
      category: 'dispatch_notification',
      template_body: 'Hello {{party_name}},\n\nYour coated diamonds for job {{job_number}} ({{quantity}} pcs) are packed and ready for dispatch.\n\nThank you,\nResin Diamond Coating',
      variables: JSON.stringify(['party_name', 'job_number', 'quantity'])
    },
    {
      name: 'Dispatch Confirmation',
      category: 'dispatch_notification',
      template_body: 'Hello {{party_name}},\n\nYour order {{dispatch_number}} has been dispatched on {{dispatch_date}}.\nQuantity: {{quantity}} pcs ({{weight}} ct).\nTracking Number: {{tracking_number}}.\n\nThank you,\nResin Diamond Coating',
      variables: JSON.stringify(['party_name', 'dispatch_number', 'dispatch_date', 'quantity', 'weight', 'tracking_number'])
    },
    {
      name: 'Payment Confirmation',
      category: 'payment_reminder',
      template_body: 'Hello {{party_name}},\n\nWe have recorded a payment of ₹{{amount}} via {{payment_method}} (Ref: {{payment_reference}}).\nRemaining Outstanding Balance: ₹{{balance}}.\n\nThank you,\nResin Diamond Coating',
      variables: JSON.stringify(['party_name', 'amount', 'payment_method', 'payment_reference', 'balance'])
    },
    {
      name: 'Payment Reminder',
      category: 'payment_reminder',
      template_body: 'Hello {{party_name}},\n\nThis is a friendly reminder regarding your outstanding balance of ₹{{balance}} with Resin Diamond Coating.\nKindly arrange payment at your earliest convenience.\n\nThank you,\nResin Diamond Coating',
      variables: JSON.stringify(['party_name', 'balance'])
    },
    {
      name: 'Job Delay Notification',
      category: 'order_update',
      template_body: 'Hello {{party_name}},\n\nWe would like to inform you that your coating job {{job_number}} is experiencing a slight delay. Revised estimated completion: {{due_date}}.\nWe apologize for the inconvenience.\n\nResin Diamond Coating',
      variables: JSON.stringify(['party_name', 'job_number', 'due_date'])
    }
  ];

  const insertTmpl = db.prepare(`INSERT OR IGNORE INTO whatsapp_templates (name, category, template_body, variables) VALUES (?, ?, ?, ?)`);
  defaultTemplates.forEach(t => insertTmpl.run(t.name, t.category, t.template_body, t.variables));

  // Seed default Automations
  const defaultAutomations = [
    { name: 'Purchase Received', trigger_event: 'purchase_received', recipient_role: 'seller', template_name: 'Purchase Received' },
    { name: 'Purchase Confirmation', trigger_event: 'purchase_confirmed', recipient_role: 'seller', template_name: 'Purchase Confirmation' },
    { name: 'Coating Job Created', trigger_event: 'job_created', recipient_role: 'buyer', template_name: 'Job Received' },
    { name: 'Coating Job Completed', trigger_event: 'coating_completed', recipient_role: 'buyer', template_name: 'Coating Completed' },
    { name: 'Job Ready for Dispatch', trigger_event: 'ready_for_dispatch', recipient_role: 'buyer', template_name: 'Ready for Dispatch' },
    { name: 'Dispatch Confirmed', trigger_event: 'dispatch_confirmed', recipient_role: 'buyer', template_name: 'Dispatch Confirmation' },
    { name: 'Payment Received', trigger_event: 'payment_received', recipient_role: 'party', template_name: 'Payment Confirmation' },
    { name: 'Payment Reminder', trigger_event: 'payment_reminder', recipient_role: 'party', template_name: 'Payment Reminder' },
    { name: 'Job Delayed', trigger_event: 'job_delayed', recipient_role: 'buyer', template_name: 'Job Delay Notification' },
  ];

  const insertAuto = db.prepare(`
    INSERT OR IGNORE INTO whatsapp_automations (name, trigger_event, recipient_role, template_id, is_enabled)
    VALUES (?, ?, ?, (SELECT id FROM whatsapp_templates WHERE name = ? LIMIT 1), 0)
  `);
  defaultAutomations.forEach(a => insertAuto.run(a.name, a.trigger_event, a.recipient_role, a.template_name));
}

module.exports = initSchema;
