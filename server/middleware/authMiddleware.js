const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore } = require('../config/memoryStore');
const { JWT_SECRET } = require('../config/jwtSecret');
const { getCachedUser, setCachedUser, invalidateCachedUser } = require('../config/dbCache');

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
    
    const userId = decoded.id || decoded._id || decoded.userId;

    // 1. High-Performance In-Memory Cache Check (<0.01ms)
    let isFromCache = false;
    let user = getCachedUser(userId) || (decoded.email ? getCachedUser(decoded.email) : null);
    if (user) {
      isFromCache = true;
    }

    if (!user && getIsMongoConnected()) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId).select('-password').lean();
      }
      if (!user && userId) {
        user = await User.findOne({ $or: [{ _id: userId }, { id: userId }] }).select('-password').lean();
      }
      if (!user && decoded.email) {
        user = await User.findOne({ email: decoded.email.toLowerCase().trim() }).select('-password').lean();
      }
    }
    
    if (!user) {
      const { getPersistedUsers } = require('../../utils/getModelConfig');
      const users = await getPersistedUsers();
      user = users.find(u => String(u._id || u.id) === String(userId) || (decoded.email && u.email && u.email.toLowerCase().trim() === decoded.email.toLowerCase().trim()));
    }

    const adminEmails = ['zihanfakir@gmail.com', 'x@zihan.uk'];
    if (user) {
      const isVerifiedAdmin = user.role === 'admin' || (user.email && adminEmails.includes(user.email.toLowerCase().trim()));
      if (!user.subscription || typeof user.subscription !== 'object') {
        user.subscription = {
          plan_name: isVerifiedAdmin ? 'Max' : (['Free', 'Pro', 'Max'].includes(decoded.plan) ? decoded.plan : 'Free'),
          starts_at: new Date(),
          expires_at: decoded.expires_at || null,
          is_active: true
        };
      } else if (isVerifiedAdmin && user.subscription.plan_name !== 'Max') {
        user.subscription.plan_name = 'Max';
      } else if (!isVerifiedAdmin && user.subscription.plan_name !== 'Free' && user.subscription.expires_at && new Date() > new Date(user.subscription.expires_at)) {
        // Auto-downgrade expired subscription
        user.subscription.plan_name = 'Free';
        user.subscription.expires_at = null;
        user.subscription.is_active = true;
        const uId = user._id || user.id;
        if (getIsMongoConnected()) {
          const q = mongoose.Types.ObjectId.isValid(uId) ? { _id: uId } : { $or: [{ _id: uId }, { id: uId }, ...(user.email ? [{ email: user.email }] : [])] };
          User.updateOne(q, { $set: { subscription: user.subscription } }).catch(() => {});
        }
        try {
          const { getPersistedUsers, savePersistedUsers, invalidateUsersCache, invalidateUserUsageCache } = require('../../utils/getModelConfig');
          getPersistedUsers().then(uList => {
            let list = [...uList];
            const idx = list.findIndex(u => String(u._id || u.id) === String(uId) || (user.email && u.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim()));
            if (idx !== -1) {
              list[idx].subscription = user.subscription;
              savePersistedUsers(list);
            }
          }).catch(() => {});
          if (typeof invalidateUsersCache === 'function') invalidateUsersCache();
          if (typeof invalidateUserUsageCache === 'function') {
            invalidateUserUsageCache(uId);
            if (user.email) invalidateUserUsageCache(user.email);
          }
        } catch {}
        invalidateCachedUser(uId);
        if (user.email) invalidateCachedUser(user.email);
      }
    }

    if (!user && decoded && userId) {
      const isVerifiedAdminEmail = decoded.email && adminEmails.includes(decoded.email.toLowerCase().trim());
      if (isVerifiedAdminEmail) {
        user = {
          _id: String(userId),
          id: String(userId),
          name: decoded.name || 'Zihan Fakir',
          email: decoded.email,
          role: 'admin',
          is_blocked: false,
          subscription: { plan_name: 'Max', expires_at: null, is_active: true }
        };
        if (!memoryStore.users.some(u => String(u._id || u.id) === String(userId))) {
          memoryStore.users.push(user);
        }
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
    if (!isFromCache) {
      setCachedUser(userId, user);
    }
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
    
    const userId = decoded.id || decoded._id || decoded.userId;

    // 1. High-Performance In-Memory Cache Check (<0.01ms)
    let isFromCache = false;
    let user = getCachedUser(userId) || (decoded.email ? getCachedUser(decoded.email) : null);
    if (user) {
      isFromCache = true;
    }

    if (!user && getIsMongoConnected()) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId).select('-password').lean();
      }
      if (!user && userId) {
        user = await User.findOne({ $or: [{ _id: userId }, { id: userId }] }).select('-password').lean();
      }
      if (!user && decoded.email) {
        user = await User.findOne({ email: decoded.email.toLowerCase().trim() }).select('-password').lean();
      }
    }
    
    if (!user) {
      const { getPersistedUsers } = require('../../utils/getModelConfig');
      const users = await getPersistedUsers();
      user = users.find(u => String(u._id || u.id) === String(userId) || (decoded.email && u.email && u.email.toLowerCase().trim() === decoded.email.toLowerCase().trim()));
    }

    const adminEmails = ['zihanfakir@gmail.com', 'x@zihan.uk'];
    if (user) {
      const isVerifiedAdmin = user.role === 'admin' || (user.email && adminEmails.includes(user.email.toLowerCase().trim()));
      if (!user.subscription || typeof user.subscription !== 'object') {
        user.subscription = {
          plan_name: isVerifiedAdmin ? 'Max' : (['Free', 'Pro', 'Max'].includes(decoded.plan) ? decoded.plan : 'Free'),
          starts_at: new Date(),
          expires_at: decoded.expires_at || null,
          is_active: true
        };
      } else if (isVerifiedAdmin && user.subscription.plan_name !== 'Max') {
        user.subscription.plan_name = 'Max';
      } else if (!isVerifiedAdmin && user.subscription.plan_name !== 'Free' && user.subscription.expires_at && new Date() > new Date(user.subscription.expires_at)) {
        // Auto-downgrade expired subscription
        user.subscription.plan_name = 'Free';
        user.subscription.expires_at = null;
        user.subscription.is_active = true;
        const uId = user._id || user.id;
        if (getIsMongoConnected()) {
          const q = mongoose.Types.ObjectId.isValid(uId) ? { _id: uId } : { $or: [{ _id: uId }, { id: uId }, ...(user.email ? [{ email: user.email }] : [])] };
          User.updateOne(q, { $set: { subscription: user.subscription } }).catch(() => {});
        }
        try {
          const { getPersistedUsers, savePersistedUsers, invalidateUsersCache, invalidateUserUsageCache } = require('../../utils/getModelConfig');
          getPersistedUsers().then(uList => {
            let list = [...uList];
            const idx = list.findIndex(u => String(u._id || u.id) === String(uId) || (user.email && u.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim()));
            if (idx !== -1) {
              list[idx].subscription = user.subscription;
              savePersistedUsers(list);
            }
          }).catch(() => {});
          if (typeof invalidateUsersCache === 'function') invalidateUsersCache();
          if (typeof invalidateUserUsageCache === 'function') {
            invalidateUserUsageCache(uId);
            if (user.email) invalidateUserUsageCache(user.email);
          }
        } catch {}
        invalidateCachedUser(uId);
        if (user.email) invalidateCachedUser(user.email);
      }
    }

    if (!user && decoded && userId) {
      const isVerifiedAdminEmail = decoded.email && adminEmails.includes(decoded.email.toLowerCase().trim());
      if (isVerifiedAdminEmail) {
        user = {
          _id: String(userId),
          id: String(userId),
          name: decoded.name || 'Zihan Fakir',
          email: decoded.email,
          role: 'admin',
          is_blocked: false,
          subscription: { plan_name: 'Max', expires_at: null, is_active: true }
        };
        if (!memoryStore.users.some(u => String(u._id || u.id) === String(userId))) {
          memoryStore.users.push(user);
        }
      }
    }

    if (user && user.is_blocked) {
      return res.status(403).json({ success: false, error: 'আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে!' });
    }

    if (user) {
      user._id = user._id || user.id;
      user.id = user.id || user._id;
      if (!isFromCache) {
        setCachedUser(userId, user);
      }
    }
    req.user = user || null;
  } catch (error) {
    req.user = null;
  }
  next();
};

module.exports = { protect, optionalProtect, invalidateCachedUser };
