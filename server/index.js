require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes mounted with and without /api prefix for local and serverless compatibility
const routeModules = [
  ['/auth', require('./routes/auth')],
  ['/customers', require('./routes/customers')],
  ['/purchases', require('./routes/purchases')],
  ['/stock', require('./routes/stock')],
  ['/coating-jobs', require('./routes/coatingJobs')],
  ['/employees', require('./routes/employees')],
  ['/overtime', require('./routes/overtime')],
  ['/salary', require('./routes/salary')],
  ['/advances', require('./routes/advances')],
  ['/dispatch', require('./routes/dispatch')],
  ['/payments', require('./routes/payments')],
  ['/whatsapp', require('./routes/whatsapp')],
  ['/evolution', require('./routes/evolution')],
  ['/search', require('./routes/search')],
  ['/reports', require('./routes/reports')],
  ['/admin', require('./routes/admin')],
];

routeModules.forEach(([routePath, router]) => {
  app.use(`/api${routePath}`, router);
  app.use(routePath, router);
});

// Health check & database diagnostics
app.get(['/health', '/api/health'], (req, res) => {
  const db = require('./db/database');
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  let dbStatus = 'ok';
  let counts = {};
  try {
    const custCount = db.prepare('SELECT COUNT(*) as c FROM customers').get()?.c || 0;
    const purCount = db.prepare('SELECT COUNT(*) as c FROM purchases').get()?.c || 0;
    const jobCount = db.prepare('SELECT COUNT(*) as c FROM coating_jobs').get()?.c || 0;
    counts = { customers: custCount, purchases: purCount, coating_jobs: jobCount };
  } catch (err) {
    dbStatus = 'error: ' + err.message;
  }

  res.json({
    status: 'ok',
    environment: isVercel ? 'vercel-serverless' : 'persistent-node',
    database_status: dbStatus,
    storage_type: isVercel ? 'ephemeral-lambda-tmp' : 'local-disk-persistent',
    records_summary: counts,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Resin server running on port ${PORT}`);
  });
}

module.exports = app;
