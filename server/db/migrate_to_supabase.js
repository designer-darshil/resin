require('dotenv').config();
const db = require('./database');
const { supabase, isConfigured } = require('./supabase');

async function migrate() {
  if (!isConfigured()) {
    console.error('❌ Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.');
    process.exit(1);
  }

  console.log('🚀 Starting data migration from SQLite to Supabase PostgreSQL...');

  const tables = [
    'roles',
    'permissions',
    'settings',
    'users',
    'customers',
    'employees',
    'purchases',
    'purchase_items',
    'stock',
    'stock_movements',
    'coating_jobs',
    'employee_job_assignments',
    'quality_checks',
    'overtime',
    'salary_records',
    'salary_advances',
    'dispatches',
    'payments',
    'whatsapp_templates',
    'whatsapp_automations',
    'whatsapp_logs',
    'audit_logs'
  ];

  for (const table of tables) {
    try {
      const records = db.prepare(`SELECT * FROM ${table}`).all();
      if (records.length === 0) {
        console.log(`- ${table}: 0 records to migrate`);
        continue;
      }

      console.log(`- Migrating ${records.length} records into ${table}...`);
      
      // Clean records (e.g. SQLite boolean integer 0/1 to boolean where appropriate or direct upsert)
      const cleanRecords = records.map(r => {
        const clean = { ...r };
        // Clean boolean fields
        ['is_active', 'is_enabled', 'is_system_role', 'can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve', 'has_financial_access', 'has_salary_access', 'has_reports_access'].forEach(k => {
          if (k in clean) clean[k] = Boolean(clean[k]);
        });
        return clean;
      });

      // Batch upsert into Supabase
      const { error } = await supabase.from(table).upsert(cleanRecords, { onConflict: 'id' });
      if (error) {
        console.warn(`  ⚠️ Warning during ${table} migration:`, error.message);
      } else {
        console.log(`  ✅ Successfully migrated ${table}`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Could not migrate table ${table}:`, err.message);
    }
  }

  console.log('🎉 Data migration process completed.');
}

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { migrate };
