require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dbPath = process.env.DB_PATH || (isVercel ? path.join('/tmp', 'resin.db') : path.join(__dirname, 'resin.db'));
const dbDir = path.dirname(path.resolve(dbPath));

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// If running in Vercel lambda and /tmp/resin.db doesn't exist, try to copy pre-seeded database if present
const sourceDb = path.join(__dirname, 'resin.db');
if (isVercel && !fs.existsSync(dbPath) && fs.existsSync(sourceDb)) {
  try {
    fs.copyFileSync(sourceDb, dbPath);
  } catch (e) {
    // Ignore copy error and proceed to create/init
  }
}

const db = new Database(path.resolve(dbPath));

// Enable appropriate journal mode
try {
  db.pragma('journal_mode = WAL');
} catch (e) {
  try {
    db.pragma('journal_mode = DELETE');
  } catch (_) {}
}
db.pragma('foreign_keys = ON');

// Auto-initialize schema & default admin seed if tables do not exist
try {
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!tableCheck) {
    const initSchema = require('./init_schema');
    initSchema(db);
  }
} catch (err) {
  console.error('Error during auto-initializing database:', err.message);
}

module.exports = db;
