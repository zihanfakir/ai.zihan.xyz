// api/index.js — Vercel Serverless Entry Point
const path = require('path');
const express = require('express');
const cors = require('cors');

// Load environment variables (Local fallback / Vercel injects automatically)
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const { connectDB } = require('../server/config/db');
const { seedDefaultAdmin } = require('../server/config/memoryStore');

const authRoutes   = require('../server/routes/authRoutes');
const chatRoutes   = require('../server/routes/chatRoutes');
const redeemRoutes = require('../server/routes/redeemRoutes');
const adminRoutes  = require('../server/routes/adminRoutes');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
  'https://zihanfakir.github.io',
  'https://ai.zihan.xyz',
  'http://localhost:5000',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all during launch/testing
  },
  credentials: true
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.use('/api/auth',   authRoutes);
app.use('/api/chat',   chatRoutes);
app.use('/api/redeem', redeemRoutes);
app.use('/api/admin',  adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'রাউট পাওয়া যায়নি' });
});

app.use((err, req, res, next) => {
  console.error('[Global Error]:', err.message);
  res.status(500).json({ success: false, error: err.message });
});

// Cold-start initialization
connectDB().catch(() => {});
seedDefaultAdmin().catch(() => {});

module.exports = app;
