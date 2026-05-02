import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/spice_app';

app.use(cors());
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
import expensesRoute from './routes/expenses.route';
import reportsRoute from './routes/reports.route';
import usersRoute from './routes/users.route';
import shopsRoute from './routes/shops.route';

app.use('/auth', authRoute);
app.use('/inventory', inventoryRoute);
app.use('/sale', saleRoute);
app.use('/assignment', assignmentRoute);
app.use('/admin/reports', adminReportsRoute);
app.use('/expenses', expensesRoute);
app.use('/reports', reportsRoute);
app.use('/users', usersRoute);
app.use('/shops', shopsRoute);

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