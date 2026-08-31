-- ==========================================================
-- RESIN DIAMOND COATING ERP — SUPABASE POSTGRESQL SCHEMA
-- ==========================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SYSTEM ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role_id BIGINT NOT NULL REFERENCES roles(id),
  employee_id BIGINT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module VARCHAR(100) NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  has_financial_access BOOLEAN DEFAULT false,
  has_salary_access BOOLEAN DEFAULT false,
  has_reports_access BOOLEAN DEFAULT false,
  UNIQUE(role_id, module)
);

CREATE TABLE IF NOT EXISTS settings (
  id BIGSERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT,
  label VARCHAR(255),
  category VARCHAR(100),
  updated_by BIGINT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  module VARCHAR(100) NOT NULL,
  record_id VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  description TEXT,
  ip_address VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PARTIES & CUSTOMERS (Suppliers, Buyers, Both)
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  party_code VARCHAR(50) UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  whatsapp_number VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  gst_number VARCHAR(50),
  opening_balance NUMERIC(15,2) DEFAULT 0,
  customer_type VARCHAR(50) DEFAULT 'customer', -- 'supplier', 'customer' (buyer), 'both'
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES users(id)
);

-- 3. EMPLOYEES & SALARY
CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  employee_code VARCHAR(50) UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  joining_date DATE,
  department VARCHAR(100),
  designation VARCHAR(100),
  employment_status VARCHAR(50) DEFAULT 'active',
  salary_type VARCHAR(50) DEFAULT 'monthly',
  base_salary NUMERIC(12,2) DEFAULT 0,
  overtime_rate NUMERIC(10,2) DEFAULT 0,
  payment_frequency VARCHAR(50) DEFAULT 'monthly',
  bank_details TEXT,
  emergency_contact VARCHAR(100),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES users(id)
);

-- 4. PURCHASES & PURCHASE ITEMS
CREATE TABLE IF NOT EXISTS purchases (
  id BIGSERIAL PRIMARY KEY,
  purchase_code VARCHAR(50) UNIQUE,
  supplier_id BIGINT NOT NULL REFERENCES customers(id),
  purchase_date DATE NOT NULL,
  invoice_number VARCHAR(100),
  total_amount NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'expected',
  received_by BIGINT REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  diamond_type VARCHAR(100),
  shape VARCHAR(50),
  size VARCHAR(50),
  color VARCHAR(50),
  clarity VARCHAR(50),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  weight NUMERIC(10,3) DEFAULT 0,
  rate NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,
  received_quantity NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. STOCK & MOVEMENTS
CREATE TABLE IF NOT EXISTS stock (
  id BIGSERIAL PRIMARY KEY,
  purchase_item_id BIGINT UNIQUE REFERENCES purchase_items(id) ON DELETE CASCADE,
  diamond_type VARCHAR(100),
  shape VARCHAR(50),
  size VARCHAR(50),
  color VARCHAR(50),
  clarity VARCHAR(50),
  raw_quantity NUMERIC(12,2) DEFAULT 0,
  in_coating_quantity NUMERIC(12,2) DEFAULT 0,
  finished_quantity NUMERIC(12,2) DEFAULT 0,
  rejected_quantity NUMERIC(12,2) DEFAULT 0,
  dispatched_quantity NUMERIC(12,2) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  movement_type VARCHAR(100) NOT NULL,
  purchase_item_id BIGINT REFERENCES purchase_items(id),
  coating_job_id BIGINT,
  dispatch_id BIGINT,
  quantity NUMERIC(12,2) NOT NULL,
  weight NUMERIC(10,3) DEFAULT 0,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  notes TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. COATING JOBS, ASSIGNMENTS & QC
CREATE TABLE IF NOT EXISTS coating_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_code VARCHAR(50) UNIQUE,
  customer_id BIGINT REFERENCES customers(id),
  purchase_item_id BIGINT REFERENCES purchase_items(id),
  diamond_type VARCHAR(100),
  shape VARCHAR(50),
  size VARCHAR(50),
  color VARCHAR(50),
  clarity VARCHAR(50),
  input_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  input_weight NUMERIC(10,3) DEFAULT 0,
  coating_type VARCHAR(100),
  coating_date DATE,
  expected_completion DATE,
  completed_quantity NUMERIC(12,2) DEFAULT 0,
  rejected_quantity NUMERIC(12,2) DEFAULT 0,
  quality_status VARCHAR(50) DEFAULT 'pending',
  job_status VARCHAR(50) DEFAULT 'draft',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS employee_job_assignments (
  id BIGSERIAL PRIMARY KEY,
  coating_job_id BIGINT NOT NULL REFERENCES coating_jobs(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  assigned_date DATE,
  assigned_by BIGINT REFERENCES users(id),
  start_time VARCHAR(20),
  end_time VARCHAR(20),
  hours_worked NUMERIC(6,2) DEFAULT 0,
  quantity_handled NUMERIC(12,2) DEFAULT 0,
  completed_quantity NUMERIC(12,2) DEFAULT 0,
  rejected_quantity NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_checks (
  id BIGSERIAL PRIMARY KEY,
  coating_job_id BIGINT NOT NULL REFERENCES coating_jobs(id) ON DELETE CASCADE,
  checked_by BIGINT REFERENCES users(id),
  check_date DATE,
  passed_quantity NUMERIC(12,2) DEFAULT 0,
  failed_quantity NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. OVERTIME & SALARY ADVANCES
CREATE TABLE IF NOT EXISTS overtime (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  coating_job_id BIGINT REFERENCES coating_jobs(id),
  date DATE NOT NULL,
  regular_hours NUMERIC(6,2) DEFAULT 0,
  overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  overtime_rate NUMERIC(10,2) DEFAULT 0,
  overtime_amount NUMERIC(12,2) DEFAULT 0,
  approved_by BIGINT REFERENCES users(id),
  approval_status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_records (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  base_salary NUMERIC(12,2) DEFAULT 0,
  overtime_amount NUMERIC(12,2) DEFAULT 0,
  bonus NUMERIC(12,2) DEFAULT 0,
  advance_deducted NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  adjustments NUMERIC(12,2) DEFAULT 0,
  gross_amount NUMERIC(12,2) DEFAULT 0,
  net_payable NUMERIC(12,2) DEFAULT 0,
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_date DATE,
  payment_method VARCHAR(50),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES users(id),
  UNIQUE(employee_id, period_month, period_year)
);

CREATE TABLE IF NOT EXISTS salary_advances (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  advance_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT,
  repayment_plan TEXT,
  remaining_balance NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  approved_by BIGINT REFERENCES users(id),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. DISPATCHES
CREATE TABLE IF NOT EXISTS dispatches (
  id BIGSERIAL PRIMARY KEY,
  dispatch_code VARCHAR(50) UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  coating_job_id BIGINT REFERENCES coating_jobs(id),
  purchase_item_id BIGINT REFERENCES purchase_items(id),
  diamond_type VARCHAR(100),
  shape VARCHAR(50),
  size VARCHAR(50),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  weight NUMERIC(10,3) DEFAULT 0,
  dispatch_date DATE NOT NULL,
  delivery_method VARCHAR(100),
  tracking_number VARCHAR(100),
  recipient VARCHAR(255),
  status VARCHAR(50) DEFAULT 'ready',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES users(id)
);

-- 9. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  payment_code VARCHAR(50) UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  payment_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) DEFAULT 'cash',
  reference_number VARCHAR(100),
  related_dispatch_id BIGINT REFERENCES dispatches(id),
  related_purchase_id BIGINT REFERENCES purchases(id),
  payment_direction VARCHAR(50) DEFAULT 'received', -- 'received' (from buyer) or 'paid' (to supplier)
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES users(id)
);

-- 10. WHATSAPP ENGINE & AUTOMATIONS
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  template_body TEXT NOT NULL,
  variables TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_automations (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  trigger_event VARCHAR(100) NOT NULL UNIQUE,
  recipient_role VARCHAR(50) NOT NULL,
  template_id BIGINT REFERENCES whatsapp_templates(id),
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id),
  template_id BIGINT REFERENCES whatsapp_templates(id),
  phone_number VARCHAR(50),
  message_body TEXT,
  status VARCHAR(50) DEFAULT 'queued',
  message_id VARCHAR(100),
  idempotency_key VARCHAR(255) UNIQUE,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  trigger_event VARCHAR(100),
  related_entity_type VARCHAR(50),
  related_entity_id VARCHAR(50),
  sent_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE coating_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated backend / service access
CREATE POLICY "Allow backend access to users" ON users FOR ALL USING (true);
CREATE POLICY "Allow backend access to customers" ON customers FOR ALL USING (true);
CREATE POLICY "Allow backend access to purchases" ON purchases FOR ALL USING (true);
CREATE POLICY "Allow backend access to purchase_items" ON purchase_items FOR ALL USING (true);
CREATE POLICY "Allow backend access to stock" ON stock FOR ALL USING (true);
CREATE POLICY "Allow backend access to coating_jobs" ON coating_jobs FOR ALL USING (true);
CREATE POLICY "Allow backend access to dispatches" ON dispatches FOR ALL USING (true);
CREATE POLICY "Allow backend access to payments" ON payments FOR ALL USING (true);
CREATE POLICY "Allow backend access to employees" ON employees FOR ALL USING (true);
CREATE POLICY "Allow backend access to whatsapp_logs" ON whatsapp_logs FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_party_code ON customers(party_code);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_coating_jobs_customer_id ON coating_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_customer_id ON dispatches(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_idempotency ON whatsapp_logs(idempotency_key);
