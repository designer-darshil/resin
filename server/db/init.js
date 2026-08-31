require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './db/resin.db';
const dbDir = path.dirname(path.resolve(dbPath));

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.resolve(dbPath));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Initializing database schema...');

db.exec(`
-- ============================
-- SYSTEM TABLES
-- ============================

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

-- ============================
-- BUSINESS ENTITIES
-- ============================

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

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  template_id INTEGER REFERENCES whatsapp_templates(id),
  phone_number TEXT,
  message_body TEXT,
  sent_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);
`);

console.log('Schema created. Seeding initial data...');

// Seed roles
const insertRole = db.prepare(`INSERT OR IGNORE INTO roles (name, description, is_system_role) VALUES (?, ?, 1)`);
insertRole.run('admin', 'Full system access');
insertRole.run('manager', 'Configurable access — set by admin');
insertRole.run('employee', 'Restricted to own work and assigned jobs');

const roles = db.prepare('SELECT * FROM roles').all();
const roleMap = {};
roles.forEach(r => roleMap[r.name] = r.id);

// Seed permissions for admin (all access)
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

// Admin: full access to everything
modules.forEach(mod => {
  upsertPermission.run(roleMap['admin'], mod, 1, 1, 1, 1, 1, 1, 1, 1);
});

// Manager: configurable — default sensible set
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
  upsertPermission.run(roleMap['manager'], mod, ...perms);
});

// Employee: restricted
const employeeModules = {
  dashboard:    [1,0,0,0,0,0,0,0],
  coating_jobs: [1,0,0,0,0,0,0,0],
  overtime:     [1,1,0,0,0,0,0,0],
  salary:       [0,0,0,0,0,0,0,0],
};
modules.forEach(mod => {
  const perms = employeeModules[mod] || [0,0,0,0,0,0,0,0];
  upsertPermission.run(roleMap['employee'], mod, ...perms);
});

// Seed admin user
const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingAdmin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, role_id)
    VALUES (?, ?, ?, ?, ?)
  `).run('admin', 'admin@resin.local', hash, 'Administrator', roleMap['admin']);
  console.log('Admin user created: username=admin, password=admin123');
}

// Seed default settings
const defaultSettings = [
  ['business_name', 'Resin Diamond Coating', 'Business Name', 'business'],
  ['currency_symbol', '₹', 'Currency Symbol', 'business'],
  ['currency_code', 'INR', 'Currency Code', 'business'],
  ['date_format', 'DD/MM/YYYY', 'Date Format', 'business'],
  ['business_phone', '', 'Business Phone', 'business'],
  ['business_whatsapp', '', 'WhatsApp Number', 'business'],
  ['business_address', '', 'Business Address', 'business'],
  ['overtime_default_rate', '150', 'Default Overtime Rate (per hour)', 'employees'],
  ['salary_default_type', 'monthly', 'Default Salary Type', 'employees'],
];
const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value, label, category) VALUES (?, ?, ?, ?)`);
defaultSettings.forEach(s => insertSetting.run(...s));

// Seed coating types in settings
db.prepare(`INSERT OR IGNORE INTO settings (key, value, label, category) VALUES (?, ?, ?, ?)`).run(
  'coating_types',
  JSON.stringify(['Standard Resin','Premium Resin','UV Resin','Epoxy Resin','Custom']),
  'Coating Types',
  'production'
);

// Seed diamond shapes
db.prepare(`INSERT OR IGNORE INTO settings (key, value, label, category) VALUES (?, ?, ?, ?)`).run(
  'diamond_shapes',
  JSON.stringify(['Round','Princess','Oval','Marquise','Pear','Emerald','Asscher','Radiant','Heart','Cushion','Other']),
  'Diamond Shapes',
  'production'
);

// Seed WhatsApp templates
const insertTemplate = db.prepare(`INSERT OR IGNORE INTO whatsapp_templates (name, category, template_body, variables) VALUES (?, ?, ?, ?)`);
insertTemplate.run(
  'Dispatch Notification', 'dispatch',
  'Hello {customer_name}, your diamond coating order *{job_id}* has been dispatched on {dispatch_date}. Quantity: *{quantity} pcs*. Thank you for your business!',
  JSON.stringify(['customer_name','job_id','dispatch_date','quantity'])
);
insertTemplate.run(
  'Payment Reminder', 'payment_reminder',
  'Hello {customer_name}, this is a gentle reminder regarding your outstanding payment of *₹{amount}*. Kindly arrange the payment at your earliest convenience. Thank you.',
  JSON.stringify(['customer_name','amount'])
);
insertTemplate.run(
  'Job Status Update', 'job_update',
  'Hello {customer_name}, your coating job *{job_id}* is currently *{status}*. Completed quantity: *{completed_quantity} pcs*. Expected completion: {expected_date}.',
  JSON.stringify(['customer_name','job_id','status','completed_quantity','expected_date'])
);
insertTemplate.run(
  'Purchase Confirmation', 'purchase',
  'Hello {supplier_name}, we confirm receipt of your purchase order *{purchase_code}* dated {purchase_date}. Quantity received: *{quantity} pcs*. Thank you.',
  JSON.stringify(['supplier_name','purchase_code','purchase_date','quantity'])
);
insertTemplate.run(
  'General Message', 'general',
  'Hello {customer_name}, {message}. Please feel free to contact us for any queries.',
  JSON.stringify(['customer_name','message'])
);

console.log('Database initialized successfully!');
console.log('');
console.log('Default login credentials:');
console.log('  Username: admin');
console.log('  Password: admin123');
console.log('');
console.log('Please change the password after first login.');

db.close();
