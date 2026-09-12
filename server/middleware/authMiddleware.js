const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore } = require('../config/memoryStore');

const JWT_SECRET = process.env.JWT_SECRET || 'alokpoth_secret_jwt_key_2026_super_secure_998877';

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0].toLowerCase() === 'bearer' && parts[1]) {
    return parts[1];
  }
  return null;
}

const protect = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ success: false, error: 'অননুমোদিত এক্সেস! অনুগ্রহ করে লগইন করুন।' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], clockTolerance: 5 });
    
    let user = null;
    const userId = decoded.id || decoded._id || decoded.userId;

    if (getIsMongoConnected()) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId);
      } else if (decoded.email) {
        user = await User.findOne({ email: decoded.email.toLowerCase().trim() });
      }
    }
    
    if (!user) {
      const { getPersistedUsers } = require('../../utils/getModelConfig');
      const users = await getPersistedUsers();
      user = users.find(u => String(u._id || u.id) === String(userId) || (decoded.email && u.email === decoded.email));
    }

    if (!user && decoded && userId) {
      const isVerifiedAdminEmail = decoded.email && decoded.email.toLowerCase() === 'zihanfakir@gmail.com';
      user = {
        _id: String(userId),
        id: String(userId),
        name: decoded.name || 'User',
        email: decoded.email || '',
        role: isVerifiedAdminEmail ? 'admin' : 'user', // NEVER allow arbitrary admin escalation
        is_blocked: false,
        subscription: {
          plan_name: isVerifiedAdminEmail ? 'Max' : (decoded.plan || 'Free'),
          expires_at: decoded.expires_at || null,
          is_active: true
        }
      };
      if (!memoryStore.users.some(u => String(u._id || u.id) === String(userId))) {
        memoryStore.users.push(user);
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি!' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ success: false, error: 'আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে! অ্যাডমিনের সাথে যোগাযোগ করুন।' });
    }

    user._id = user._id || user.id;
    user.id = user.id || user._id;
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'অকার্যকর টোকেন! পুনরায় লগইন করুন।' });
  }
};

const optionalProtect = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], clockTolerance: 5 });
    
    let user = null;
    const userId = decoded.id || decoded._id || decoded.userId;

    if (getIsMongoConnected()) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId);
      } else if (decoded.email) {
        user = await User.findOne({ email: decoded.email.toLowerCase().trim() });
      }
    }
    
    if (!user) {
      const { getPersistedUsers } = require('../../utils/getModelConfig');
      const users = await getPersistedUsers();
      user = users.find(u => String(u._id || u.id) === String(userId) || (decoded.email && u.email === decoded.email));
    }

    if (!user && decoded && userId) {
      const isVerifiedAdminEmail = decoded.email && decoded.email.toLowerCase() === 'zihanfakir@gmail.com';
      user = {
        _id: String(userId),
        id: String(userId),
        name: decoded.name || 'User',
        email: decoded.email || '',
        role: isVerifiedAdminEmail ? 'admin' : 'user',
        is_blocked: false,
        subscription: {
          plan_name: isVerifiedAdminEmail ? 'Max' : (decoded.plan || 'Free'),
          expires_at: decoded.expires_at || null,
          is_active: true
        }
      };
      if (!memoryStore.users.some(u => String(u._id || u.id) === String(userId))) {
        memoryStore.users.push(user);
      }
    }

    if (user && user.is_blocked) {
      return res.status(403).json({ success: false, error: 'আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে!' });
    }

    if (user) {
      user._id = user._id || user.id;
      user.id = user.id || user._id;
    }
    req.user = user || null;
  } catch (error) {
    req.user = null;
  }
  next();
};

module.exports = { protect, optionalProtect };
