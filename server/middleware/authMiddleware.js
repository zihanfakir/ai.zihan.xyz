const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore } = require('../config/memoryStore');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'অননুমোদিত এক্সেস! অনুগ্রহ করে লগইন করুন।' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'alokpoth_secret_jwt_key_2026_super_secure_998877');
    
    let user;
    if (getIsMongoConnected()) {
      user = await User.findById(decoded.id);
    } else {
      const { getPersistedUsers } = require('../../utils/getModelConfig');
      const users = await getPersistedUsers();
      user = users.find(u => String(u._id || u.id) === String(decoded.id));
    }

    if (!user && decoded && decoded.id) {
      const isVerifiedAdminEmail = decoded.email && decoded.email.toLowerCase() === 'zihanfakir@gmail.com';
      user = {
        _id: decoded.id,
        id: decoded.id,
        name: decoded.name || 'User',
        email: decoded.email || '',
        role: isVerifiedAdminEmail ? 'admin' : 'user', // Prevent synthetic admin role escalation
        is_blocked: false,
        subscription: {
          plan_name: isVerifiedAdminEmail ? 'Max' : (decoded.plan || 'Free'),
          expires_at: decoded.expires_at || null,
          is_active: true
        }
      };
      // Prevent unbounded duplicate pushes into memoryStore
      if (!memoryStore.users.some(u => String(u._id || u.id) === String(decoded.id))) {
        memoryStore.users.push(user);
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি!' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ success: false, error: 'আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে! অ্যাডমিনের সাথে যোগাযোগ করুন।' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'অকার্যকর টোকেন! পুনরায় লগইন করুন।' });
  }
};

const optionalProtect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'alokpoth_secret_jwt_key_2026_super_secure_998877');
    
    let user;
    if (getIsMongoConnected()) {
      user = await User.findById(decoded.id);
    } else {
      const { getPersistedUsers } = require('../../utils/getModelConfig');
      const users = await getPersistedUsers();
      user = users.find(u => String(u._id || u.id) === String(decoded.id));
    }

    if (!user && decoded && decoded.id) {
      const isVerifiedAdminEmail = decoded.email && decoded.email.toLowerCase() === 'zihanfakir@gmail.com';
      user = {
        _id: decoded.id,
        id: decoded.id,
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
      if (!memoryStore.users.some(u => String(u._id || u.id) === String(decoded.id))) {
        memoryStore.users.push(user);
      }
    }

    if (user && user.is_blocked) {
      return res.status(403).json({ success: false, error: 'আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে!' });
    }

    req.user = user || null;
  } catch (error) {
    req.user = null;
  }
  next();
};

module.exports = { protect, optionalProtect };
