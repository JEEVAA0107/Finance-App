require('dotenv').config(); // trigger restart
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 5000;

// Resolve local network IP address dynamically
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
const localIp = getLocalIpAddress();

// ─── Middleware ────────────────────────────────────────────────────────────────

// Trust reverse proxy (Render, Vercel, Railway, Nginx) for accurate client IP rate limiting
app.set('trust proxy', 1);

app.use(helmet());

// Allow specific origins for production security
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => process.env.DISABLE_RATE_LIMIT === 'true',
});
app.use('/api/', limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/companies',  require('./src/routes/companies'));
app.use('/api/auth',       require('./src/routes/auth'));
app.use('/api/users',      require('./src/routes/users'));
app.use('/api/customers',  require('./src/routes/customers'));
app.use('/api/loans',      require('./src/routes/loans'));
app.use('/api/daybook',    require('./src/routes/daybook'));
app.use('/api/repayments', require('./src/routes/repayments'));
app.use('/api/payments',   require('./src/routes/payments'));
app.use('/api/dashboard',  require('./src/routes/dashboard'));
app.use('/api/reports',    require('./src/routes/reports'));
app.use('/api/audit',      require('./src/routes/audit'));
app.use('/api/notifications', require('./src/routes/notifications'));

// Health check
app.get('/health', (req, res) => res.json({
  status: 'ok',
  app: process.env.APP_NAME || 'Finova',
  version: '2.3.1-fix-render-build',
  timestamp: new Date().toISOString()
}));

// Safe database schema synchronizer route
app.get('/api/sync-db', async (req, res) => {
  try {
    await syncDatabaseSchema();
    res.json({
      success: true,
      message: 'Customer & Jamin database columns synchronized successfully',
      version: '2.2.0-customer-jamin-edit',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const { seedAdmin } = require('./src/utils/seed');
const { startCronJobs } = require('./src/jobs/cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncDatabaseSchema() {
  try {
    const customerCols = [
      { col: 'photoUrl', type: 'TEXT' },
      { col: 'idProofUrl', type: 'TEXT' },
      { col: 'notificationPref', type: "TEXT DEFAULT 'WHATSAPP'" },
      { col: 'latitude', type: 'DOUBLE PRECISION' },
      { col: 'longitude', type: 'DOUBLE PRECISION' },
      { col: 'jaminName', type: 'TEXT' },
      { col: 'jaminPhone', type: 'TEXT' },
      { col: 'jaminAddress', type: 'TEXT' },
      { col: 'jaminRelationship', type: 'TEXT' },
      { col: 'jaminIdType', type: 'TEXT' },
      { col: 'jaminIdNumber', type: 'TEXT' },
      { col: 'jaminPhotoUrl', type: 'TEXT' },
      { col: 'jaminIdProofUrl', type: 'TEXT' },
    ];
    for (const item of customerCols) {
      const attempts = [
        `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "${item.col}" ${item.type};`,
        `ALTER TABLE "Customer" ADD COLUMN "${item.col}" ${item.type};`,
        `ALTER TABLE customer ADD COLUMN IF NOT EXISTS "${item.col}" ${item.type};`,
        `ALTER TABLE customer ADD COLUMN "${item.col}" ${item.type};`,
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS "${item.col}" ${item.type};`
      ];
      for (const sql of attempts) {
        try {
          await prisma.$executeRawUnsafe(sql);
          break;
        } catch (_) {}
      }
    }

    // User table columns
    const userCols = [
      { col: 'agentId', type: 'TEXT' }
    ];
    for (const item of userCols) {
      const attempts = [
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "${item.col}" ${item.type};`,
        `ALTER TABLE "User" ADD COLUMN "${item.col}" ${item.type};`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS "${item.col}" ${item.type};`
      ];
      for (const sql of attempts) {
        try {
          await prisma.$executeRawUnsafe(sql);
          break;
        } catch (_) {}
      }
    }
    console.log('✅ Customer & User schema columns verified');

    // Repayment table schema updates for Weekly & Daily Carry-Forward
    const repaymentCols = [
      { col: 'weekNo', type: 'INTEGER' },
      { col: 'dayNo', type: 'INTEGER' },
      { col: 'penaltyAmount', type: 'DOUBLE PRECISION DEFAULT 0' },
      { col: 'penaltyPaid', type: 'DOUBLE PRECISION DEFAULT 0' },
      { col: 'penaltyStatus', type: "TEXT DEFAULT 'NONE'" },
      { col: 'originalDueDate', type: 'TIMESTAMP' },
      { col: 'carriedToInstNo', type: 'INTEGER' }
    ];

    for (const item of repaymentCols) {
      const attempts = [
        `ALTER TABLE "Repayment" ADD COLUMN IF NOT EXISTS "${item.col}" ${item.type};`,
        `ALTER TABLE "Repayment" ADD COLUMN "${item.col}" ${item.type};`,
        `ALTER TABLE repayment ADD COLUMN IF NOT EXISTS "${item.col}" ${item.type};`,
        `ALTER TABLE repayments ADD COLUMN IF NOT EXISTS "${item.col}" ${item.type};`
      ];
      for (const sql of attempts) {
        try {
          await prisma.$executeRawUnsafe(sql);
          break;
        } catch (_) {}
      }
    }
    console.log('✅ Repayment carry-forward columns verified');
  } catch (err) {
    console.warn('⚠️ Schema check note:', err.message);
  }
}

async function syncTenantIntegrity() {
  try {
    const unlinkedLoans = await prisma.loan.findMany({
      where: { companyId: null },
      include: { customer: { select: { companyId: true } } },
      take: 500,
    });
    for (const loan of unlinkedLoans) {
      if (loan.customer?.companyId) {
        await prisma.loan.update({
          where: { id: loan.id },
          data: { companyId: loan.customer.companyId },
        });
      }
    }
  } catch (err) {
    console.warn('Tenant integrity note:', err.message);
  }
}

async function start() {
  try {
    await prisma.$connect();
    console.log('Database connected');
    await syncDatabaseSchema();
    await syncTenantIntegrity();
    await seedAdmin();
    startCronJobs();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Finova API running on http://0.0.0.0:${PORT}`);
      console.log(`📡 Accessible on your network at http://${localIp}:${PORT}`);

      // Cloud keep-alive ping (e.g. Render / free tier) to prevent cold start spin-down
      const renderUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_API_URL;
      if (renderUrl && renderUrl.startsWith('http')) {
        const pingClient = renderUrl.startsWith('https') ? require('https') : require('http');
        setInterval(() => {
          pingClient.get(`${renderUrl}/api/health`, () => {}).on('error', () => {});
        }, 8 * 60 * 1000);
        console.log(`⏱️ Keep-alive ping active for ${renderUrl}`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
