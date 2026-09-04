const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore, debouncedSave } = require('../config/memoryStore');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'alokpoth_secret_jwt_key_2026_super_secure_998877', {
    expiresIn: '30d'
  });
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'সঠিক নাম, ইমেইল এবং পাসওয়ার্ড প্রদান করুন' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim().slice(0, 50);
    const isAdminEmail = cleanEmail === 'zihanfakir@gmail.com';

    if (getIsMongoConnected()) {
      const userExists = await User.findOne({ email: cleanEmail });
      if (userExists) {
        return res.status(400).json({ success: false, error: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি আছে' });
      }
      const userCount = await User.countDocuments();
      const role = (userCount === 0 || isAdminEmail) ? 'admin' : 'user';

      const user = await User.create({
        name: cleanName,
        email: cleanEmail,
        password,
        role,
        subscription: { plan_name: isAdminEmail ? 'Max' : 'Free', starts_at: new Date(), expires_at: null, is_active: true }
      });
      const token = generateToken(user._id);
      return res.status(201).json({
        success: true,
        token,
        user: { _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role, subscription: user.subscription, avatar: user.avatar }
      });
    } else {
      const userExists = memoryStore.users.find(u => u.email === cleanEmail);
      if (userExists) {
        return res.status(400).json({ success: false, error: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি আছে' });
      }
      const role = (memoryStore.users.length === 0 || isAdminEmail) ? 'admin' : 'user';
      const hashedPassword = await bcrypt.hash(password, 10);
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
      memoryStore.users.push(user);
      debouncedSave();
      const token = generateToken(user._id);
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
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'সঠিক ইমেইল এবং পাসওয়ার্ড প্রদান করুন' });
    }
    const cleanEmail = email.toLowerCase().trim();

    if (getIsMongoConnected()) {
      const user = await User.findOne({ email: cleanEmail }).select('+password');
      if (!user || !(await user.matchPassword(password))) {
        return res.status(401).json({ success: false, error: 'অবৈধ ইমেইল বা পাসওয়ার্ড' });
      }
      if (user.is_blocked) {
        return res.status(403).json({ success: false, error: 'আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে।' });
      }
      if (cleanEmail === 'zihanfakir@gmail.com' && user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
      }
      const token = generateToken(user._id);
      return res.json({
        success: true,
        token,
        user: { _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role, subscription: user.subscription, avatar: user.avatar }
      });
    } else {
      const user = memoryStore.users.find(u => u.email === cleanEmail);
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
      if (cleanEmail === 'zihanfakir@gmail.com' && user.role !== 'admin') {
        user.role = 'admin';
      }
      const token = generateToken(user._id);
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
    
    if (user.role !== 'admin') {
      const Plan = require('../models/Plan');
      const UsageLog = require('../models/UsageLog');
      const currentPlanName = (user.subscription && user.subscription.plan_name) ? user.subscription.plan_name : 'Free';
      
      let plan;
      if (getIsMongoConnected()) {
        plan = await Plan.findOne({ name: currentPlanName });
      } else {
        plan = memoryStore.plans.find(p => p.name === currentPlanName);
      }
      
      if (!plan) {
        const defaultLimits = { 'Free': { limit: 10, window: 3 }, 'Pro': { limit: 30, window: 3 }, 'Max': { limit: 50, window: 1 } };
        const def = defaultLimits[currentPlanName] || defaultLimits['Free'];
        plan = { message_limit: def.limit, window_hours: def.window };
      }
      
      const windowStart = new Date(Date.now() - plan.window_hours * 60 * 60 * 1000);
      let messageCount = 0;
      
      if (getIsMongoConnected()) {
        messageCount = await UsageLog.countDocuments({ user_id: user._id, timestamp: { $gte: windowStart } });
      } else {
        messageCount = memoryStore.usageLogs.filter(l => String(l.user_id) === String(user._id) && new Date(l.timestamp) >= windowStart).length;
      }
      
      let resetTimeMinutes = Math.round(plan.window_hours * 60);
      if (getIsMongoConnected()) {
        const oldestLog = await UsageLog.findOne({ user_id: user._id, timestamp: { $gte: windowStart } }).sort({ timestamp: 1 });
        if (oldestLog) {
          resetTimeMinutes = Math.max(1, Math.ceil((new Date(oldestLog.timestamp).getTime() + plan.window_hours * 60 * 60 * 1000 - Date.now()) / (60 * 1000)));
        }
      } else {
        const logsInWindow = memoryStore.usageLogs
          .filter(l => String(l.user_id) === String(user._id) && new Date(l.timestamp) >= windowStart)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        if (logsInWindow.length > 0) {
          resetTimeMinutes = Math.max(1, Math.ceil((new Date(logsInWindow[0].timestamp).getTime() + plan.window_hours * 60 * 60 * 1000 - Date.now()) / (60 * 1000)));
        }
      }
      
      rateLimit = {
        used: messageCount,
        limit: plan.message_limit,
        remaining: Math.max(0, plan.message_limit - messageCount),
        resetInMinutes: resetTimeMinutes,
        windowHours: plan.window_hours
      };
    }

    res.json({
      success: true,
      user: { _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role, subscription: user.subscription, avatar: user.avatar, rateLimit }
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
    const cleanName = name ? name.trim().slice(0, 50) : undefined;

    let user;
    if (getIsMongoConnected()) {
      user = await User.findById(req.user._id);
      if (cleanName) user.name = cleanName;
      if (avatar !== undefined) user.avatar = avatar;
      await user.save();
    } else {
      user = memoryStore.users.find(u => String(u._id) === String(req.user._id));
      if (cleanName) user.name = cleanName;
      if (avatar !== undefined) user.avatar = avatar;
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

module.exports = { registerUser, loginUser, getMe, updateProfile };


