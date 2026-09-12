const Plan = require('../models/Plan');
const UsageLog = require('../models/UsageLog');
const AiModel = require('../models/AiModel');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore, debouncedSave } = require('../config/memoryStore');
const { getModelConfig, getUserUsageDetails } = require('../../utils/getModelConfig');

const checkRateLimit = async (req, res, next) => {
  try {
    const user = req.user;

    // Admin users are never rate-limited
    if (user && user.role === 'admin') {
      req.currentPlan = { name: 'Admin', displayName: 'অ্যাডমিন', message_limit: 999999, window_hours: 1, allowed_models: ['*'] };
      return next();
    }

    // 0. Guest User (Not logged in)
    if (!user) {
      const model_id = req.body.model || 'gemini-3.5-flash-lite';
      const freeModels = ['openrouter/free', 'gemini-3.5-flash-lite', 'gemini-1.5-flash', 'mimo-v2.5', 'hy3', 'deepseek-v4-flash'];
      const isKnownFree = freeModels.includes(model_id);

      if (!isKnownFree) {
        return res.status(403).json({
          success: false,
          error: `এই মডেলটি ব্যবহারের জন্য অনুগ্রহ করে লগইন করুন এবং প্রো বা ম্যাক্স প্ল্যান সক্রিয় করুন।`
        });
      }

      let aiModel = null;
      if (getIsMongoConnected()) {
        aiModel = await AiModel.findOne({ $or: [{ model_id }, { id: model_id }] });
      } else {
        aiModel = await getModelConfig(model_id);
      }
      if (aiModel && (aiModel.premium || aiModel.efficient)) {
        return res.status(403).json({
          success: false,
          error: `এই মডেলটি ব্যবহারের জন্য অনুগ্রহ করে লগইন করুন এবং প্রো বা ম্যাক্স প্ল্যান সক্রিয় করুন।`
        });
      }

      // Enforce IP-based Guest Rate Limit: 10 messages per 3 hours
      const xff = req.headers['x-forwarded-for'];
      const rawIp = req.socket?.remoteAddress || (typeof xff === 'string' ? xff.split(',').pop().trim() : '127.0.0.1');
      const cleanIp = String(rawIp).replace(/^::ffff:/, '').replace(/[^a-zA-Z0-9]/g, '_');
      const guestId = `guest_${cleanIp}`;

      const usageDetails = await getUserUsageDetails(guestId, 3);
      if (usageDetails.count >= 10) {
        res.setHeader('Retry-After', Math.max(1, (usageDetails.resetInMinutes || 180) * 60));
        return res.status(429).json({
          success: false,
          error: `গেস্ট বার্তা সীমা শেষ! আপনি ৩ ঘণ্টায় সর্বোচ্চ ১০টি ফ্রি বার্তা পাঠাতে পারেন। আবার ${usageDetails.resetInMinutes} মিনিট পর চেষ্টা করুন অথবা বিনামূল্যে অ্যাকাউন্ট তৈরি করুন।`
        });
      }

      req.guestId = guestId;
      req.currentPlan = { name: 'Free', displayName: 'গেস্ট প্ল্যান', message_limit: 10, window_hours: 3, allowed_models: freeModels };
      return next();
    }

    // 1. Check & Auto-Downgrade Expired Subscriptions
    if (user.subscription && user.subscription.plan_name !== 'Free' && user.subscription.expires_at) {
      if (new Date() > new Date(user.subscription.expires_at)) {
        user.subscription.plan_name = 'Free';
        user.subscription.expires_at = null;
        user.subscription.is_active = true;
        if (getIsMongoConnected() && typeof user.save === 'function') {
          await user.save().catch(() => {});
        }
        // Unconditionally persist downgrade across Supabase and memoryStore
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
            const mIdx = memoryStore.users.findIndex(u => String(u._id || u.id) === String(user._id || user.id));
            if (mIdx !== -1) memoryStore.users[mIdx].subscription = user.subscription;
          }
          debouncedSave();
        } catch (syncErr) {
          console.warn('[RateLimit Auto-Downgrade Sync Warning]:', syncErr.message);
        }
      }
    }

    // 2. Fetch Current Plan Configuration
    const currentPlanName = (user.subscription && user.subscription.plan_name) ? user.subscription.plan_name : 'Free';
    
    let plan;
    if (getIsMongoConnected()) {
      plan = await Plan.findOne({ name: currentPlanName });
    } else {
      const { getPersistedPlans } = require('../../utils/getModelConfig');
      const plans = await getPersistedPlans();
      plan = plans.find(p => p.name === currentPlanName);
    }

    const freeModelIds = ['openrouter/free', 'gemini-3.5-flash-lite', 'gemini-1.5-flash', 'mimo-v2.5', 'hy3', 'deepseek-v4-flash'];

    if (!plan) {
      const defaultLimits = {
        'Free': { limit: 10, window: 3, name: 'ফ্রি প্ল্যান', allowed: freeModelIds },
        'Pro': { limit: 30, window: 3, name: 'প্রো প্ল্যান', allowed: ['*'] },
        'Max': { limit: 50, window: 1, name: 'ম্যাক্স প্ল্যান', allowed: ['*'] }
      };
      const def = defaultLimits[currentPlanName] || defaultLimits['Free'];
      plan = {
        name: currentPlanName,
        displayName: def.name,
        message_limit: def.limit,
        window_hours: def.window,
        allowed_models: def.allowed,
        is_active: true
      };
    }
    plan.message_limit = Number(plan.message_limit) || 10;
    plan.window_hours = Number(plan.window_hours) || 3;

    // 3. Model Access Permission Check
    const model_id = req.body.model || 'openrouter/free';
    
    let aiModel = null;
    if (getIsMongoConnected()) {
      aiModel = await AiModel.findOne({ $or: [{ model_id }, { id: model_id }] });
    } else {
      aiModel = await getModelConfig(model_id);
    }

    const isKnownFree = freeModelIds.includes(model_id) && (!aiModel || (!aiModel.premium && !aiModel.efficient));
    const isMaxModel = (aiModel && Boolean(aiModel.efficient)) || model_id === 'gpt-5.6';
    const isProModel = (aiModel && Boolean(aiModel.premium)) && !isMaxModel;

    if (currentPlanName === 'Free') {
      // Free users can ONLY use models that are confirmed free!
      if (isMaxModel) {
        return res.status(403).json({
          success: false,
          error: `'${aiModel?.name || model_id}' মডেলটি ব্যবহারের জন্য Max প্ল্যান প্রয়োজন। আপনার বর্তমান প্ল্যান: ${plan.displayName || 'ফ্রি প্ল্যান'}।`
        });
      }
      if (isProModel) {
        return res.status(403).json({
          success: false,
          error: `'${aiModel?.name || model_id}' মডেলটি ব্যবহারের জন্য Pro বা Max প্ল্যান প্রয়োজন। আপনার বর্তমান প্ল্যান: ${plan.displayName || 'ফ্রি প্ল্যান'}।`
        });
      }
      if (!isKnownFree) {
        // Also check if explicitly in plan.allowed_models (excluding wildcard '*')
        const explicitlyAllowed = Array.isArray(plan.allowed_models) && plan.allowed_models.includes(model_id) && !plan.allowed_models.includes('*');
        if (!explicitlyAllowed) {
          return res.status(403).json({
            success: false,
            error: `'${aiModel?.name || model_id}' মডেলটি ফ্রি প্ল্যানে অনুমোদিত নয়। Pro বা Max প্ল্যানে আপগ্রেড করুন।`
          });
        }
      }
    } else if (currentPlanName === 'Pro') {
      // Pro users can use Free and Pro models, but CANNOT use Max models!
      if (isMaxModel) {
        return res.status(403).json({
          success: false,
          error: `'${aiModel?.name || model_id}' মডেলটি ব্যবহারের জন্য Max প্ল্যান প্রয়োজন। আপনার বর্তমান প্ল্যান: ${plan.displayName || 'প্রো প্ল্যান'}।`
        });
      }
    } else if (currentPlanName !== 'Max' && user.role !== 'admin') {
      // Unknown non-max/non-pro/non-free plan fallback check
      const allowed = Array.isArray(plan.allowed_models) ? plan.allowed_models : [];
      if (!allowed.includes('*') && !allowed.includes(model_id)) {
        return res.status(403).json({
          success: false,
          error: `আপনার ${plan.displayName || currentPlanName} এ '${model_id}' মডেল ব্যবহারের অনুমতি নেই।`
        });
      }
    }

    // 4. Dynamic Window Rate Limit Check
    const userId = String(user._id || user.id);
    const windowStart = new Date(Date.now() - plan.window_hours * 60 * 60 * 1000);
    let messageCount = 0;
    let resetTimeMinutes = Math.round(plan.window_hours * 60);

    if (getIsMongoConnected()) {
      messageCount = await UsageLog.countDocuments({
        user_id: userId,
        timestamp: { $gte: windowStart }
      });
      if (messageCount >= plan.message_limit) {
        const oldestLog = await UsageLog.findOne({ user_id: userId, timestamp: { $gte: windowStart } }).sort({ timestamp: 1 });
        if (oldestLog) {
          resetTimeMinutes = Math.max(1, Math.ceil((new Date(oldestLog.timestamp).getTime() + plan.window_hours * 60 * 60 * 1000 - Date.now()) / (60 * 1000)));
        }
      }
    } else {
      const usageDetails = await getUserUsageDetails(userId, plan.window_hours);
      const memCount = memoryStore.usageLogs.filter(l => String(l.user_id) === userId && new Date(l.timestamp) >= windowStart).length;
      messageCount = Math.max(usageDetails.count, memCount);
      resetTimeMinutes = usageDetails.resetInMinutes;
    }

    if (messageCount >= plan.message_limit) {
      res.setHeader('Retry-After', Math.max(1, resetTimeMinutes * 60));
      return res.status(429).json({
        success: false,
        error: `বার্তা সীমা শেষ! ${plan.displayName}-এ প্রতি ${plan.window_hours} ঘণ্টায় সর্বোচ্চ ${plan.message_limit}টি বার্তা পাঠানো যায়। আবার ${resetTimeMinutes} মিনিট পর চেষ্টা করুন বা প্ল্যান আপগ্রেড করুন।`
      });
    }

    req.currentPlan = plan;
    next();
  } catch (error) {
    console.error('[RateLimit Middleware Error]:', error);
    res.status(500).json({ success: false, error: 'সার্ভার রেট লিমিট ভেরিফিকেশন ব্যর্থ হয়েছে।' });
  }
};

module.exports = { checkRateLimit };
