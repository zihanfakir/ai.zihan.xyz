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
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  next();
});
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

const User = require('./models/User');

// Connect DB & Seed Plans/Models
connectDB().then(async () => {
  if (getIsMongoConnected()) {
    try {
      const { getPersistedPlans, getPersistedModels } = require('../utils/getModelConfig');
      const planCount = await Plan.countDocuments();
      if (planCount === 0) {
        const pPlans = await getPersistedPlans();
        if (pPlans && pPlans.length > 0) {
          for (const p of pPlans) {
            await Plan.findOneAndUpdate({ name: p.name }, p, { upsert: true });
          }
          console.log(`[Database Seed] Synced ${pPlans.length} plans from Supabase to MongoDB.`);
        } else {
          await Plan.seedDefaultPlans();
        }
      }

      const modelCount = await AiModel.countDocuments();
      if (modelCount === 0) {
        const pModels = await getPersistedModels();
        if (pModels && pModels.length > 0) {
          for (const m of pModels) {
            await AiModel.findOneAndUpdate(
              { model_id: m.id || m.model_id },
              {
                model_id: m.id || m.model_id,
                name: m.name,
                provider: m.provider || 'Alora',
                type: m.type || 'custom',
                base_url: m.base_url || '',
                api_key: m.api_key || '',
                premium: !!m.premium,
                efficient: !!m.efficient,
                order: m.order || 0,
                api_model_1: m.api_model_1 || m.model_id || m.id || '',
                fallback_url_1: m.fallback_url_1 || '',
                fallback_key_1: m.fallback_key_1 || '',
                fallback_model_1: m.fallback_model_1 || '',
                api_model_2: m.api_model_2 || '',
                fallback_url_2: m.fallback_url_2 || '',
                fallback_key_2: m.fallback_key_2 || '',
                fallback_model_2: m.fallback_model_2 || '',
                api_model_3: m.api_model_3 || ''
              },
              { upsert: true }
            );
          }
          console.log(`[Database Seed] Synced ${pModels.length} models from Supabase to MongoDB.`);
        } else {
          await AiModel.seedDefaultModels();
        }
      }
    } catch (syncErr) {
      console.warn('[Database Seed Warning]:', syncErr.message);
    }

    const adminEmails = ['zihanfakir@gmail.com', 'x@zihan.uk'];
    for (const email of adminEmails) {
      const adminUser = await User.findOne({ email });
      if (adminUser && adminUser.role !== 'admin') {
        adminUser.role = 'admin';
        await adminUser.save();
        console.log(`[Auth] Promoted ${email} to Admin.`);
      }
    }
  }
}).catch(err => console.error('[DB Connection Error]:', err.message));

// API Routes with Rate Limiting & Anti-Cache Headers (fixes login/logout stale cache)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/redeem', redeemLimiter, redeemRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'Alora AI Backend Running', time: new Date() });
});

// Public plans and limits info
app.get('/api/plans', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const normalizePlan = (p) => {
      const plain = (p && typeof p.toObject === 'function') ? p.toObject() : { ...p };
      plain.message_limit = Number(plain.message_limit) || 10;
      const defaultImg = (plain.name === 'Free' ? 5 : (plain.name === 'Pro' ? 25 : 100));
      plain.image_limit = (plain.image_limit !== undefined && plain.image_limit !== null && !isNaN(Number(plain.image_limit)) && Number(plain.image_limit) > 0)
        ? Math.max(Number(plain.image_limit), defaultImg)
        : defaultImg;
      return plain;
    };

    if (getIsMongoConnected()) {
      const Plan = require('./models/Plan');
      let plans = await Plan.find({ is_active: true });
      if (!plans || plans.length === 0) {
        const { getPersistedPlans } = require('../utils/getModelConfig');
        plans = await getPersistedPlans();
      }
      return res.json({ success: true, plans: plans.map(normalizePlan) });
    } else {
      const { getPersistedPlans } = require('../utils/getModelConfig');
      const plans = await getPersistedPlans();
      return res.json({ success: true, plans: plans.filter(p => p.is_active !== false).map(normalizePlan) });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: 'প্ল্যানের তথ্য লোড করতে সমস্যা হয়েছে।' });
  }
});

const ROOT_DIR = path.join(__dirname, '..');
app.use('/avatars', express.static(path.join(ROOT_DIR, 'avatars')));
app.use('/logo', express.static(path.join(ROOT_DIR, 'logo')));

// Serve logo images, app icons, favicons, and mobile packages safely
const STATIC_ASSETS = [
  'favicon.ico', 'favicon.svg', 'favicon.png', 'favicon-32x32.png', 'favicon-16x16.png',
  'apple-touch-icon.png', 'app_logo.png', 'app logo.png',
  'logo_icon_white.png', 'logo_icon_black.png',
  'logo_wordmark_white.png', 'logo_wordmark_black.png',
  'app_logo_transparent.png', 'app_logo_transparent_black.png',
  'app_logo.svg', 'app_logo_transparent.svg',
  'Alora.apk', 'Alora.ipa', 'AloAI.apk', 'Alokpoth.ipa'
];

STATIC_ASSETS.forEach(file => {
  app.get('/' + file, (req, res) => {
    const filePath = path.join(ROOT_DIR, file);
    if (file.endsWith('.apk')) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    } else if (file.endsWith('.ipa')) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    } else if (file.endsWith('.ico')) {
      res.setHeader('Content-Type', 'image/x-icon');
    } else if (file.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (file.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
    res.sendFile(filePath);
  });
});

app.get('/', (req, res) => res.sendFile(path.join(ROOT_DIR, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'admin.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'login.html')));
app.get('/account.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'account.html')));
app.get('/plans.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'plans.html')));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(ROOT_DIR, 'manifest.json')));
app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.sendFile(path.join(ROOT_DIR, 'sw.js'));
});

// Dedicated settings pages
app.get('/profile.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'profile.html')));
app.get('/security.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'security.html')));
app.get('/subscription.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'subscription.html')));
app.get('/usage.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'usage.html')));
app.get('/theme.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'theme.html')));
app.get('/sound.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'sound.html')));
app.get('/personalization.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'personalization.html')));
app.get('/help.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'help.html')));
app.get('/redeem.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'redeem.html')));
app.get('/download.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'download.html')));
app.get('/download', (req, res) => res.sendFile(path.join(ROOT_DIR, 'download.html')));
app.get('/app', (req, res) => res.sendFile(path.join(ROOT_DIR, 'download.html')));

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
  console.log(`[Alora AI Server] Running on http://localhost:${PORT}`);
  console.log(`[Admin Panel] Open http://localhost:${PORT}/admin.html`);
  console.log(`=================================================`);
});
