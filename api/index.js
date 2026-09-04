// api/index.js — Vercel Serverless Entry Point
const path = require('path');
const express = require('express');
const cors = require('cors');

require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const { connectDB, getIsMongoConnected } = require('../server/config/db');
const { memoryStore } = require('../server/config/memoryStore');

const authRoutes   = require('../server/routes/authRoutes');
const chatRoutes   = require('../server/routes/chatRoutes');
const redeemRoutes = require('../server/routes/redeemRoutes');
const adminRoutes  = require('../server/routes/adminRoutes');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Permissive CORS for Vercel deployment
app.use(cors({
  origin: true,
  credentials: true
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Health check
const healthHandler = (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
};
app.get('/api/health', healthHandler);
app.get('/health', healthHandler);
app.get('/api', healthHandler);

// Public plans endpoint
const plansHandler = async (req, res) => {
  try {
    if (getIsMongoConnected()) {
      const Plan = require('../server/models/Plan');
      const plans = await Plan.find({ is_active: true });
      return res.json({ success: true, plans });
    } else {
      return res.json({ success: true, plans: memoryStore.plans });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
app.get('/api/plans', plansHandler);
app.get('/plans', plansHandler);

// Mount main routes (with and without /api prefix for Vercel path flexibility)
app.use('/api/auth',   authRoutes);
app.use('/auth',       authRoutes);

app.use('/api/chat',   chatRoutes);
app.use('/chat',       chatRoutes);

app.use('/api/redeem', redeemRoutes);
app.use('/redeem',     redeemRoutes);

app.use('/api/admin',  adminRoutes);
app.use('/admin',      adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'রাউট পাওয়া যায়নি', path: req.url });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Global Error]:', err.message);
  res.status(500).json({ success: false, error: err.message });
});

// Cold-start DB connect (non-blocking)
connectDB().catch(() => {});

module.exports = app;
