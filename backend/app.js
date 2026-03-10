const express = require('express');
require('dotenv').config();

// Tải các model và quan hệ
process.on('unhandledRejection', err => {
  console.error('UNHANDLED REJECTION', err);
});

process.on('uncaughtException', err => {
  console.error('UNCAUGHT EXCEPTION', err);
});

const app = express();
const cors = require('cors');
const path = require('path');
const sequelize = require('./config/db');
const { port } = require('./config/app');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

// Tải các model và quan hệ
require('./models');

// Import routes (optional where features were removed)
const authRoutes = require('./routes/authRoutes');
let userRoutes = null;
let timesheetRoutes = null;
let notificationRoutes = null;
let profileUpdateRoutes = null;
let departmentRoutes = null;
let adminRoutes = null;

try { userRoutes = require('./routes/userRoutes'); } catch (e) { userRoutes = null; }
// profileUpdateRoutes removed per request; do not require or mount it
profileUpdateRoutes = null;
try { departmentRoutes = require('./routes/departmentRoutes'); } catch (e) { departmentRoutes = null; }
try { adminRoutes = require('./routes/adminRoutes'); } catch (e) { adminRoutes = null; }
// assignmentRoutes removed (production-chains feature deleted)
let assignmentRoutes = null;

try { timesheetRoutes = require('./routes/timesheetRoutes'); } catch (e) { timesheetRoutes = null; }
try { notificationRoutes = require('./routes/notificationRoutes'); } catch (e) { notificationRoutes = null; }
// KPI/production-chain routes removed
let kpiRoutes = null;
try { kpiRoutes = require('./routes/kpiRoutes'); } catch (e) { console.error('[startup] failed to load kpiRoutes:', e && e.stack ? e.stack : e); kpiRoutes = null; }

// ============= MIDDLEWARE =============
app.use(express.json());

// log incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[req] ${req.method} ${req.url} origin=${req.headers.origin || 'no-origin'}`);
  next();
});

// CORS configuration: allow common dev origins and enable credentials
const allowedOrigins = (process.env.CORS_ORIGINS && process.env.CORS_ORIGINS.split(',')) || [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5555'
];

const corsOptions = {
  origin: function(origin, callback) {
    // allow non-browser requests (curl, postman) where origin is undefined
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    // allow localhost/127.0.0.1 on any port during development
    try {
      const m = origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
      if (m) return callback(null, true);
    } catch (e) {
      // ignore
    }
    console.warn('[cors] blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
};

app.use(cors(corsOptions));

// ============= API ROUTES =============
// Auth
app.use('/api/auth', authRoutes);

// Users
if (userRoutes) app.use('/api/users', userRoutes);
// Also mount singular path for compatibility with older frontend calls
if (userRoutes) app.use('/api/user', userRoutes);

// Serve uploaded files (avatars, cvs)
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Time Management (removed)
if (timesheetRoutes) app.use('/api/timesheets', timesheetRoutes);

// Profile
if (profileUpdateRoutes) app.use('/api/profile-updates', profileUpdateRoutes);

if (notificationRoutes) app.use('/api/notifications', notificationRoutes);

// Organization
if (departmentRoutes) app.use('/api/departments', departmentRoutes);
// Admin management
if (adminRoutes) app.use('/api/admins', adminRoutes);
// KPI routes (mounted at /api/kpis)
if (kpiRoutes) app.use('/api/kpis', kpiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap() {
  try {
    console.log('[1] Authenticating...');
    await sequelize.authenticate();
    console.log('✓ DB authenticated');

    if (!process.env.JWT_SECRET) {
      console.warn('[startup] WARNING: JWT_SECRET is not set. Tokens will be signed with a fallback secret. Set JWT_SECRET in .env for production.');
    } else {
      console.log('[startup] JWT_SECRET is present');
    }

    const shouldSync = process.env.FORCE_SYNC === 'true';

    if (shouldSync) {
      console.log('[2] Running forced sync...');
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      await sequelize.sync({ alter: true });
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('✓ Models synced');
    } else {
      console.log('[2] Sync skipped (set FORCE_SYNC=true to enable)');
    }

    // Auto-run any raw SQL migrations placed in backend/migrations if needed.
    try {
      const fs = require('fs');
      const path = require('path');
      const migDir = path.join(__dirname, 'migrations');
      if (fs.existsSync(migDir)) {
        const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
        if (files.length > 0) {
          console.log('[migrations] Found', files.length, 'migration file(s). Running migrations...');
          for (const file of files) {
            const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
            try {
              // Split the SQL file into individual statements and run them separately.
              // Some MySQL drivers disallow multiple statements in a single query by default.
              const parts = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
              for (const stmt of parts) {
                try {
                  await sequelize.query(stmt);
                } catch (innerErr) {
                  // individual statement failed; log and continue with remaining statements
                  console.warn('[migrations] statement failed in', file, innerErr && innerErr.message ? innerErr.message : innerErr);
                }
              }
              console.log('[migrations] Applied', file);
            } catch (e) {
              console.warn('[migrations] Migration', file, 'failed or was a no-op:', e && e.message ? e.message : e);
            }
          }
          console.log('[migrations] Migration step finished');
        }
      }
    } catch (e) {
      console.error('[migrations] error while running migrations:', e && e.stack ? e.stack : e);
    }

    app.listen(port, () =>
      console.log(`✓ Server running on port ${port}`)
    );
  } catch (error) {
    console.error('Không thể khởi động máy chủ:', error);
    process.exit(1);
  }
}

bootstrap();
