const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore, debouncedSave } = require('../config/memoryStore');

const generateToken = (user) => {
  const payload = (user && typeof user === 'object') ? {
    id: String(user._id || user.id),
    role: user.role || 'user',
    plan: (user.subscription && user.subscription.plan_name) || 'Free',
    expires_at: (user.subscription && user.subscription.expires_at) || null,
    name: user.name || '',
    email: user.email || ''
  } : { id: String(user) };

  return jwt.sign(payload, process.env.JWT_SECRET || 'alokpoth_secret_jwt_key_2026_super_secure_998877', {
    expiresIn: '30d'
  });
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'সঠিক নাম, ইমেইল এবং পাসওয়ার্ড প্রদান করুন' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা দিন' });
    }
    const cleanPassword = password.trim();
    if (cleanPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
    }
    if (password.length > 72) {
      return res.status(400).json({ success: false, error: 'পাসওয়ার্ড সর্বোচ্চ ৭২ অক্ষরের হতে পারবে' });
    }
    const cleanName = name.trim().slice(0, 50);
    if (cleanName.length < 2) {
      return res.status(400).json({ success: false, error: 'নাম কমপক্ষে ২ অক্ষরের হতে হবে' });
    }
    const isAdminEmail = cleanEmail === 'zihanfakir@gmail.com';

    if (getIsMongoConnected()) {
      const userExists = await User.findOne({ email: cleanEmail });
      if (userExists) {
        return res.status(400).json({ success: false, error: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি আছে' });
      }
      const role = isAdminEmail ? 'admin' : 'user';

      const user = await User.create({
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
        role,
        subscription: { plan_name: isAdminEmail ? 'Max' : 'Free', starts_at: new Date(), expires_at: null, is_active: true }
      });

      // Sync new user to Supabase __users_metadata__ and memoryStore.users
      try {
        const { getPersistedUsers, savePersistedUsers } = require('../../utils/getModelConfig');
        let users = await getPersistedUsers();
        users = [...users, {
          _id: String(user._id),
          id: String(user._id),
          name: user.name,
          email: user.email,
          password: user.password,
          role: user.role,
          is_blocked: false,
          subscription: user.subscription,
          createdAt: user.createdAt
        }];
        await savePersistedUsers(users);
        if (memoryStore.users) {
          memoryStore.users.push({
            _id: String(user._id),
            id: String(user._id),
            name: user.name,
            email: user.email,
            password: user.password,
            role: user.role,
            is_blocked: false,
            subscription: user.subscription,
            createdAt: user.createdAt
          });
        }
        debouncedSave();
      } catch (syncErr) {
        console.warn('[Register Mongo Sync Warning]:', syncErr.message);
      }

      const token = generateToken(user);
      return res.status(201).json({
        success: true,
        token,
        user: { _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role, subscription: user.subscription, avatar: user.avatar }
      });
    } else {
      const { getPersistedUsers, savePersistedUsers } = require('../../utils/getModelConfig');
      let users = await getPersistedUsers();
      users = [...users];

      const userExists = users.find(u => u.email && u.email.toLowerCase().trim() === cleanEmail);
      if (userExists) {
        return res.status(400).json({ success: false, error: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি আছে' });
      }
      const role = isAdminEmail ? 'admin' : 'user';
      const hashedPassword = await bcrypt.hash(cleanPassword, 10);
      const user = {
        _id: 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role,
        is_blocked: false,
        subscription: { plan_name: isAdminEmail ? 'Max' : 'Free', starts_at: new Date(), expires_at: null, is_active: true },
        createdAt: new Date()
      };
      users.push(user);
      await savePersistedUsers(users);
      debouncedSave();
      const token = generateToken(user);
      return res.status(201).json({
        success: true,
        token,
        user: { _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role, subscription: user.subscription, avatar: user.avatar }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'ইমেইল এবং পাসওয়ার্ড প্রয়োজন' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (getIsMongoConnected()) {
      const user = await User.findOne({ email: cleanEmail }).select('+password');
      if (!user) {
        return res.status(401).json({ success: false, error: 'অবৈধ ইমেইল বা পাসওয়ার্ড' });
      }
      const isMatch = user.password ? await bcrypt.compare(password, user.password) : false;
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'অবৈধ ইমেইল বা পাসওয়ার্ড' });
      }
      if (user.is_blocked) {
        return res.status(403).json({ success: false, error: 'আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে।' });
      }
      // Ensure zihanfakir@gmail.com is always admin and Max plan
      if (cleanEmail === 'zihanfakir@gmail.com') {
        if (user.role !== 'admin' || !user.subscription || user.subscription.plan_name !== 'Max') {
          user.role = 'admin';
          user.subscription = { plan_name: 'Max', starts_at: new Date(), expires_at: null, is_active: true };
          await user.save();
        }
      }
      const token = generateToken(user);
      return res.json({
        success: true,
        token,
        user: { _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role, subscription: user.subscription, avatar: user.avatar }
      });
    } else {
      const { getPersistedUsers, savePersistedUsers } = require('../../utils/getModelConfig');
      let users = await getPersistedUsers();
      users = [...users];
      const user = users.find(u => u.email && u.email.toLowerCase().trim() === cleanEmail);
      if (!user) {
        return res.status(401).json({ success: false, error: 'অবৈধ ইমেইল বা পাসওয়ার্ড' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'অবৈধ ইমেইল বা পাসওয়ার্ড' });
      }
      if (user.is_blocked) {
        return res.status(403).json({ success: false, error: 'আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে।' });
      }
      if (cleanEmail === 'zihanfakir@gmail.com') {
        user.role = 'admin';
        user.subscription = { plan_name: 'Max', starts_at: new Date(), expires_at: null, is_active: true };
        await savePersistedUsers(users);
        debouncedSave();
      }
      const token = generateToken(user);
      return res.json({
        success: true,
        token,
        user: { _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role, subscription: user.subscription, avatar: user.avatar }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = req.user;
    let rateLimit = null;
    let usage = null;
    
    // Auto-downgrade expired subscriptions before computing quota and returning user object
    if (user.subscription && user.subscription.plan_name !== 'Free' && user.subscription.expires_at) {
      if (new Date() > new Date(user.subscription.expires_at)) {
        user.subscription.plan_name = 'Free';
        user.subscription.expires_at = null;
        user.subscription.is_active = true;
        if (getIsMongoConnected() && typeof user.save === 'function') {
          await user.save().catch(() => {});
        }
        try {
          const { getPersistedUsers, savePersistedUsers } = require('../../utils/getModelConfig');
          let users = await getPersistedUsers();
          users = [...users];
          const uIdx = users.findIndex(u => String(u._id || u.id) === String(user._id || user.id));
          if (uIdx !== -1) {
            users[uIdx].subscription = user.subscription;
            await savePersistedUsers(users);
          }
          if (memoryStore.users) {
            const mUser = memoryStore.users.find(u => String(u._id || u.id) === String(user._id || user.id));
            if (mUser) mUser.subscription = user.subscription;
          }
          debouncedSave();
        } catch {}
      }
    }

    if (user.role !== 'admin') {
      const Plan = require('../models/Plan');
      const UsageLog = require('../models/UsageLog');
      const currentPlanName = (user.subscription && user.subscription.plan_name) ? user.subscription.plan_name : 'Free';
      
      let plan;
      if (getIsMongoConnected()) {
        plan = await Plan.findOne({ name: currentPlanName });
      } else {
        const { getPersistedPlans } = require('../../utils/getModelConfig');
        const plans = await getPersistedPlans();
        plan = plans.find(p => p.name === currentPlanName);
      }
      
      if (!plan) {
        const defaultLimits = { 'Free': { limit: 10, window: 3 }, 'Pro': { limit: 30, window: 3 }, 'Max': { limit: 50, window: 1 } };
        const def = defaultLimits[currentPlanName] || defaultLimits['Free'];
        plan = { message_limit: def.limit, window_hours: def.window, name: currentPlanName };
      }

      const planLimit = Number(plan.message_limit) || 10;
      const planWindow = Number(plan.window_hours) || 3;
      
      const userId = String(user._id || user.id);
      const windowStart = new Date(Date.now() - planWindow * 60 * 60 * 1000);
      let messageCount = 0;
      let resetTimeMinutes = Math.round(planWindow * 60);
      let resetAt = null;
      let windowStartTs = windowStart.getTime();
      
      if (getIsMongoConnected()) {
        messageCount = await UsageLog.countDocuments({ user_id: userId, timestamp: { $gte: windowStart } });
        const oldestLog = await UsageLog.findOne({ user_id: userId, timestamp: { $gte: windowStart } }).sort({ timestamp: 1 });
        if (oldestLog) {
          const resetMs = new Date(oldestLog.timestamp).getTime() + planWindow * 60 * 60 * 1000;
          resetTimeMinutes = Math.max(1, Math.ceil((resetMs - Date.now()) / (60 * 1000)));
          resetAt = new Date(resetMs).toISOString();
          windowStartTs = new Date(oldestLog.timestamp).getTime();
        } else {
          resetAt = new Date(Date.now() + planWindow * 60 * 60 * 1000).toISOString();
        }
      } else {
        const { getUserUsageDetails } = require('../../utils/getModelConfig');
        const usageDetails = await getUserUsageDetails(userId, planWindow);
        const memCount = memoryStore.usageLogs.filter(l => String(l.user_id) === userId && new Date(l.timestamp) >= windowStart).length;
        messageCount = Math.max(usageDetails.count, memCount);
        resetTimeMinutes = usageDetails.resetInMinutes;
        if (usageDetails.resetAt) {
          resetAt = usageDetails.resetAt;
          windowStartTs = usageDetails.start || (new Date(resetAt).getTime() - planWindow * 60 * 60 * 1000);
        } else {
          resetAt = new Date(Date.now() + resetTimeMinutes * 60 * 1000).toISOString();
        }
      }
      
      rateLimit = {
        used: messageCount,
        limit: planLimit,
        remaining: Math.max(0, planLimit - messageCount),
        resetInMinutes: Math.max(1, resetTimeMinutes || 1),
        windowHours: planWindow,
        resetAt,
        windowStart: windowStartTs
      };

      usage = {
        count: messageCount,
        limit: planLimit,
        remaining: Math.max(0, planLimit - messageCount),
        resetInMinutes: Math.max(1, resetTimeMinutes || 1),
        windowHours: planWindow,
        resetAt,
        start: windowStartTs
      };
    } else {
      rateLimit = {
        isAdmin: true,
        unlimited: true,
        used: 0,
        limit: 999999,
        remaining: 999999,
        resetInMinutes: 0,
        windowHours: 1,
        resetAt: null,
        windowStart: Date.now()
      };
      usage = {
        isAdmin: true,
        unlimited: true,
        count: 0,
        limit: 999999,
        remaining: 999999,
        resetInMinutes: 0,
        windowHours: 1,
        resetAt: null,
        start: Date.now()
      };
    }

    const finalId = user._id || user.id;
    res.json({
      success: true,
      user: {
        _id: finalId,
        id: finalId,
        name: user.name,
        email: user.email,
        role: user.role,
        subscription: user.subscription,
        avatar: user.avatar,
        rateLimit,
        usage
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;
    if (name !== undefined && typeof name !== 'string') return res.status(400).json({ success: false, error: 'অবৈধ নাম' });
    if (avatar !== undefined && typeof avatar !== 'string') return res.status(400).json({ success: false, error: 'অবৈধ প্রোফাইল ছবি' });
    if (avatar && avatar.length > 50000) return res.status(400).json({ success: false, error: 'ছবির সাইজ অতিরিক্ত বড় (সর্বোচ্চ 50KB)' });
    if (avatar && avatar !== 'default' && !avatar.startsWith('data:image/') && !avatar.startsWith('http://') && !avatar.startsWith('https://')) {
      return res.status(400).json({ success: false, error: 'অকার্যকর ছবির ফরম্যাট' });
    }
    if (avatar && avatar.startsWith('data:image/svg+xml')) {
      return res.status(400).json({ success: false, error: 'SVG ফরম্যাটের ছবি গ্রহণযোগ্য নয়।' });
    }
    const cleanName = name !== undefined ? name.trim().slice(0, 50) : undefined;
    if (cleanName !== undefined && cleanName.length < 2) {
      return res.status(400).json({ success: false, error: 'নাম কমপক্ষে ২ অক্ষরের হতে হবে' });
    }

    const targetUserId = req.user._id || req.user.id;
    let user;
    if (getIsMongoConnected()) {
      if (mongoose.Types.ObjectId.isValid(targetUserId)) {
        user = await User.findById(targetUserId);
      } else if (req.user && req.user.email) {
        user = await User.findOne({ email: req.user.email.toLowerCase().trim() });
      }
      if (user) {
        if (cleanName) user.name = cleanName;
        if (avatar !== undefined) user.avatar = avatar;
        await user.save();

        // Sync profile changes to Supabase and memoryStore
        try {
          const { getPersistedUsers, savePersistedUsers } = require('../../utils/getModelConfig');
          let users = await getPersistedUsers();
          users = [...users];
          const pUser = users.find(u => String(u._id) === String(user._id) || String(u.id) === String(user._id) || (u.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim()));
          if (pUser) {
            if (cleanName) pUser.name = cleanName;
            if (avatar !== undefined) pUser.avatar = avatar;
            await savePersistedUsers(users);
          }
          if (memoryStore.users) {
            const mUser = memoryStore.users.find(u => String(u._id) === String(user._id) || String(u.id) === String(user._id) || (u.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim()));
            if (mUser) {
              if (cleanName) mUser.name = cleanName;
              if (avatar !== undefined) mUser.avatar = avatar;
            }
          }
          debouncedSave();
        } catch (syncErr) {
          console.warn('[Profile Update Sync Warning]:', syncErr.message);
        }
      }
    } else {
      const { getPersistedUsers, savePersistedUsers } = require('../../utils/getModelConfig');
      let users = await getPersistedUsers();
      users = [...users];
      const uIdx = users.findIndex(u => String(u._id || u.id) === String(targetUserId));
      if (uIdx !== -1) {
        if (cleanName) users[uIdx].name = cleanName;
        if (avatar !== undefined) users[uIdx].avatar = avatar;
        user = users[uIdx];
        await savePersistedUsers(users);
      } else {
        user = (memoryStore.users && memoryStore.users.find(u => String(u._id || u.id) === String(targetUserId))) || req.user;
        if (cleanName) user.name = cleanName;
        if (avatar !== undefined) user.avatar = avatar;
      }
      if (memoryStore.users) {
        const mUser = memoryStore.users.find(u => String(u._id || u.id) === String(targetUserId));
        if (mUser) {
          if (cleanName) mUser.name = cleanName;
          if (avatar !== undefined) mUser.avatar = avatar;
        }
      }
      debouncedSave();
    }
    res.json({
      success: true,
      user: { _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role, subscription: user.subscription, avatar: user.avatar }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    if (!current_password || typeof current_password !== 'string') {
      return res.status(400).json({ success: false, error: 'বর্তমান পাসওয়ার্ড প্রদান করুন' });
    }
    if (!new_password || typeof new_password !== 'string' || !new_password.trim()) {
      return res.status(400).json({ success: false, error: 'নতুন পাসওয়ার্ড প্রদান করুন' });
    }
    const cleanNewPass = new_password.trim();
    if (cleanNewPass.length < 6) {
      return res.status(400).json({ success: false, error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
    }
    if (cleanNewPass.length > 72) {
      return res.status(400).json({ success: false, error: 'নতুন পাসওয়ার্ড সর্বোচ্চ ৭২ অক্ষরের হতে পারবে' });
    }
    if (!confirm_password || typeof confirm_password !== 'string' || confirm_password.trim() !== cleanNewPass) {
      return res.status(400).json({ success: false, error: 'নিশ্চিতকরণ পাসওয়ার্ড মেলেনি' });
    }

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'অননুমোদিত রিকোয়েস্ট' });
    }

    const userId = String(req.user._id || req.user.id || '');
    let user;
    if (getIsMongoConnected()) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId).select('+password');
      } else if (req.user && req.user.email) {
        user = await User.findOne({ email: req.user.email.toLowerCase().trim() }).select('+password');
      }
      if (!user) {
        return res.status(404).json({ success: false, error: 'ব্যবহারকারী পাওয়া যায়নি' });
      }
      const isMatch = await bcrypt.compare(current_password, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'বর্তমান পাসওয়ার্ডটি সঠিক নয়' });
      }
      // Assign plaintext new password: UserSchema.pre('save') handles hashing once
      user.password = cleanNewPass;
      await user.save();
    } else {
      const { getPersistedUsers, savePersistedUsers } = require('../../utils/getModelConfig');
      let users = await getPersistedUsers();
      users = [...users];
      let uIdx = users.findIndex(u => String(u._id || u.id) === userId || (req.user.email && u.email && u.email.toLowerCase() === req.user.email.toLowerCase()));
      
      let targetUser = uIdx !== -1 ? users[uIdx] : (memoryStore.users && memoryStore.users.find(u => String(u._id || u.id) === userId || (req.user.email && u.email && u.email.toLowerCase() === req.user.email.toLowerCase()))) || req.user;

      if (!targetUser || !targetUser.password) {
        return res.status(404).json({ success: false, error: 'ব্যবহারকারী পাওয়া যায়নি' });
      }

      const isMatch = await bcrypt.compare(current_password, targetUser.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'বর্তমান পাসওয়ার্ডটি সঠিক নয়' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(cleanNewPass, salt);
      targetUser.password = hashed;

      if (uIdx !== -1) {
        users[uIdx].password = hashed;
      } else {
        users.push(targetUser);
      }
      await savePersistedUsers(users);

      if (memoryStore.users) {
        const mIdx = memoryStore.users.findIndex(u => String(u._id || u.id) === userId || (targetUser.email && u.email && u.email.toLowerCase() === targetUser.email.toLowerCase()));
        if (mIdx !== -1) memoryStore.users[mIdx].password = hashed;
        else memoryStore.users.push(targetUser);
      }
      debouncedSave();
    }

    // Also backup to memoryStore/Supabase in Mongo mode if possible
    if (getIsMongoConnected() && user) {
      try {
        const { getPersistedUsers, savePersistedUsers } = require('../../utils/getModelConfig');
        let users = await getPersistedUsers();
        users = [...users];
        const uIdx = users.findIndex(u => String(u._id || u.id) === userId || (u.email && u.email.toLowerCase() === user.email.toLowerCase()));
        if (uIdx !== -1) {
          users[uIdx].password = user.password;
          await savePersistedUsers(users);
        }
        if (memoryStore.users) {
          const mIdx = memoryStore.users.findIndex(u => String(u._id || u.id) === userId || (u.email && u.email.toLowerCase() === user.email.toLowerCase()));
          if (mIdx !== -1) memoryStore.users[mIdx].password = user.password;
        }
        debouncedSave();
      } catch {}
    }

    return res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { registerUser, loginUser, getMe, updateProfile, changePassword };


