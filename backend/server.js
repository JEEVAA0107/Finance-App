require('dotenv').config();
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
app.use(helmet());
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'capacitor://localhost',
  'http://localhost',
  `http://${localIp}:5173`, // Local dev IP
  `http://${localIp}:5000`,
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./src/routes/auth'));
app.use('/api/users',      require('./src/routes/users'));
app.use('/api/customers',  require('./src/routes/customers'));
app.use('/api/loans',      require('./src/routes/loans'));
app.use('/api/repayments', require('./src/routes/repayments'));
app.use('/api/payments',   require('./src/routes/payments'));
app.use('/api/dashboard',  require('./src/routes/dashboard'));
app.use('/api/reports',    require('./src/routes/reports'));
app.use('/api/audit',      require('./src/routes/audit'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', app: process.env.APP_NAME }));

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
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    await seedAdmin();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 LoanFlow Pro API running on http://0.0.0.0:${PORT}`);
      console.log(`📡 Accessible on your network at http://${localIp}:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
