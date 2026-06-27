import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice_app';

// Allow dev frontend + configured production origin. Same-origin prod requests
// (SPA served from this server) don't need CORS at all.
const allowedOrigins = [
  'http://localhost:4200',
  ...(process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : []),
];

app.use(helmet({ contentSecurityPolicy: false })); // CSP off: Angular inline styles/scripts
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Health Check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes — all imported from within src/ to respect rootDir
import authRoute from './routes/auth.route';
import inventoryRoute from './routes/inventory.route';
import saleRoute from './routes/sale.route';
import assignmentRoute from './routes/assignment.route';
import adminReportsRoute from './routes/admin-reports.route';
import marketingRoute from './routes/marketing.route';
import expensesRoute from './routes/expenses.route';
import reportsRoute from './routes/reports.route';
import usersRoute from './routes/users.route';
import shopsRoute from './routes/shops.route';
import publicRoute from './routes/public.route';
import categoryRoute from './routes/category.route';
import { requireAuth, requireAdmin, assertJwtSecretConfigured } from './middleware/auth.middleware';

assertJwtSecretConfigured();

// Brute-force protection on login.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' },
});

// /auth/login and /public/* stay public; everything else requires a valid JWT.
// Admin-only resources additionally require the admin role; finer-grained
// admin checks (e.g. inventory mutations) live inside the route files.
app.use('/auth', loginLimiter, authRoute);
app.use('/public', publicRoute); // customer storefront: catalog + order (no auth)
app.use('/inventory', requireAuth, inventoryRoute);
app.use('/sale', requireAuth, saleRoute);
app.use('/assignment', requireAuth, assignmentRoute);
app.use('/admin/reports', requireAuth, requireAdmin, adminReportsRoute);
app.use('/admin/marketing', requireAuth, requireAdmin, marketingRoute);
app.use('/expenses', requireAuth, requireAdmin, expensesRoute);
app.use('/reports', requireAuth, reportsRoute);
app.use('/users', requireAuth, requireAdmin, usersRoute);
app.use('/shops', requireAuth, shopsRoute);
app.use('/categories', requireAuth, categoryRoute);

// ── Serve the Angular SPA in production ─────────────────────────────────────
// render-build.sh places the frontend build at backend/static/frontend/browser.
// Relative API URLs keep working because app + API share one origin.
const staticDir = path.join(__dirname, '..', 'static', 'frontend', 'browser');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  // SPA fallback: any non-API GET that reached here gets index.html.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    return res.sendFile(path.join(staticDir, 'index.html'));
  });
  console.log(`📦 Serving frontend from ${staticDir}`);
}

// Connect to MongoDB and start server
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
