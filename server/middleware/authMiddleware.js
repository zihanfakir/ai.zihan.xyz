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
      user = memoryStore.users.find(u => String(u._id) === String(decoded.id));
    }

    if (!user && decoded && decoded.id) {
      user = {
        _id: decoded.id,
        id: decoded.id,
        name: decoded.name || 'User',
        email: decoded.email || '',
        role: decoded.role || 'user',
        is_blocked: false,
        subscription: {
          plan_name: decoded.plan || 'Free',
          is_active: true
        }
      };
      // Keep in memoryStore for current lifecycle
      memoryStore.users.push(user);
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
      user = memoryStore.users.find(u => String(u._id) === String(decoded.id));
    }

    if (!user && decoded && decoded.id) {
      user = {
        _id: decoded.id,
        id: decoded.id,
        name: decoded.name || 'User',
        email: decoded.email || '',
        role: decoded.role || 'user',
        is_blocked: false,
        subscription: {
          plan_name: decoded.plan || 'Free',
          is_active: true
        }
      };
      memoryStore.users.push(user);
    }

    if (user && !user.is_blocked) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (error) {
    req.user = null;
  }
  next();
};

module.exports = { protect, optionalProtect };
