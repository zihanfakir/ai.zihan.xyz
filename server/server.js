const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { connectDB, getIsMongoConnected } = require('./config/db');
const Plan = require('./models/Plan');
const AiModel = require('./models/AiModel');
const { createRateLimiter } = require('./middleware/ipRateLimiter');

const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const redeemRoutes = require('./routes/redeemRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Rate Limiters for DDoS and Brute Force Protection
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'অতিরিক্ত লগইন/রেজিস্ট্রেশন অনুরোধ করা হয়েছে। অনুগ্রহ করে ১৫ মিনিট পর আবার চেষ্টা করুন।'
});
const redeemLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'অতিরিক্ত রিডিম কোড অনুরোধ। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।'
});
const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'অতিরিক্ত সার্ভার অনুরোধ। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
});

// Middleware
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

const User = require('./models/User');

// Connect DB & Seed Plans
connectDB().then(async () => {
  if (getIsMongoConnected()) {
    await Plan.seedDefaultPlans();
    await AiModel.seedDefaultModels();
    const adminUser = await User.findOne({ email: 'zihanfakir@gmail.com' });
    if (adminUser && adminUser.role !== 'admin') {
      adminUser.role = 'admin';
      await adminUser.save();
      console.log('[Auth] Promoted zihanfakir@gmail.com to Admin.');
    }
  }
}).catch(err => console.error('[DB Connection Error]:', err.message));

// API Routes with Rate Limiting
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/redeem', redeemLimiter, redeemRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'Alokpoth AI Backend Running', time: new Date() });
});

// Public plans and limits info
app.get('/api/plans', async (req, res) => {
  try {
    if (getIsMongoConnected()) {
      const Plan = require('./models/Plan');
      const plans = await Plan.find({ is_active: true });
      return res.json({ success: true, plans });
    } else {
      const { memoryStore } = require('./config/memoryStore');
      return res.json({ success: true, plans: memoryStore.plans });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Serve Frontend and Admin HTML safely (never expose server directory)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, '../admin.html')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(err.status || 500).json({ success: false, error: 'Internal server error' });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`[Alokpoth AI Server] Running on http://localhost:${PORT}`);
  console.log(`[Admin Panel] Open http://localhost:${PORT}/admin.html`);
  console.log(`=================================================`);
});
