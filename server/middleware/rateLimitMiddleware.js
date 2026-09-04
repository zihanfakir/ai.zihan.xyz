const Plan = require('../models/Plan');
const UsageLog = require('../models/UsageLog');
const AiModel = require('../models/AiModel');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore, debouncedSave } = require('../config/memoryStore');

const checkRateLimit = async (req, res, next) => {
  try {
    const user = req.user;

    // Admin gets full Max plan limits (or unlimited if superadmin)
    // Removed unconditional admin bypass so limits can be tested and enforced

    // Guest User (Not logged in)
    if (!user) {
      const model_id = req.body.model || 'openrouter/free';
      let aiModel = null;
      if (getIsMongoConnected()) {
        aiModel = await AiModel.findOne({ model_id });
      } else {
        aiModel = memoryStore.models.find(m => (m.id === model_id || m.model_id === model_id));
      }
      if (aiModel && (aiModel.premium || aiModel.efficient)) {
        return res.status(403).json({
          success: false,
          error: `এই প্রিমিয়াম মডেলটি ব্যবহারের জন্য অনুগ্রহ করে লগইন করুন এবং প্রো বা ম্যাক্স প্ল্যান সক্রিয় করুন।`
        });
      }
      return next();
    }

    // 1. Check & Auto-Downgrade Expired Subscriptions
    if (user.subscription && user.subscription.plan_name !== 'Free' && user.subscription.expires_at) {
      if (new Date() > new Date(user.subscription.expires_at)) {
        user.subscription.plan_name = 'Free';
        user.subscription.expires_at = null;
        user.subscription.is_active = true;
        if (getIsMongoConnected() && typeof user.save === 'function') {
          await user.save();
        } else if (!getIsMongoConnected()) {
          // Persist downgrade to Supabase
          const { getPersistedUsers, savePersistedUsers } = require('../../utils/getModelConfig');
          let users = await getPersistedUsers();
          users = [...users];
          const uIdx = users.findIndex(u => String(u._id || u.id) === String(user._id || user.id));
          if (uIdx !== -1) {
            users[uIdx].subscription = user.subscription;
            await savePersistedUsers(users);
          }
          debouncedSave();
        }
      }
    }

    // 2. Fetch Current Plan Configuration
    const currentPlanName = (user.subscription && user.subscription.plan_name) ? user.subscription.plan_name : 'Free';
    
    let plan;
    if (getIsMongoConnected()) {
      plan = await Plan.findOne({ name: currentPlanName });
    } else {
      plan = memoryStore.plans.find(p => p.name === currentPlanName);
    }

    if (!plan) {
      const defaultLimits = {
        'Free': { limit: 10, window: 3, name: 'ফ্রি প্ল্যান' },
        'Pro': { limit: 30, window: 3, name: 'প্রো প্ল্যান' },
        'Max': { limit: 50, window: 1, name: 'ম্যাক্স প্ল্যান' }
      };
      const def = defaultLimits[currentPlanName] || defaultLimits['Free'];
      plan = {
        name: currentPlanName,
        displayName: def.name,
        message_limit: def.limit,
        window_hours: def.window,
        allowed_models: currentPlanName === 'Free' ? ['openrouter/free', 'gemini-1.5-flash'] : ['*'],
        is_active: true
      };
    }

    // 3. Model Access Permission Check
    const model_id = req.body.model || 'openrouter/free';
    
    let aiModel = null;
    if (getIsMongoConnected()) {
      aiModel = await AiModel.findOne({ model_id });
    } else {
      const { getModelConfig } = require('../../utils/getModelConfig');
      aiModel = await getModelConfig(model_id);
    }

    if (aiModel) {
      if (aiModel.efficient) {
        // Max Badge Model -> Only Max Plan users allowed
        if (currentPlanName !== 'Max') {
          return res.status(403).json({
            success: false,
            error: `'${aiModel.name || model_id}' মডেলটি ব্যবহারের জন্য Max প্ল্যান প্রয়োজন। আপনার বর্তমান প্ল্যান: ${plan.displayName || currentPlanName}।`
          });
        }
      } else if (aiModel.premium) {
        // Pro Badge Model -> Pro and Max Plan users allowed
        if (currentPlanName !== 'Pro' && currentPlanName !== 'Max') {
          return res.status(403).json({
            success: false,
            error: `'${aiModel.name || model_id}' মডেলটি ব্যবহারের জন্য Pro বা Max প্ল্যান প্রয়োজন। আপনার বর্তমান প্ল্যান: ${plan.displayName || currentPlanName}।`
          });
        }
      }
    } else {
      // Fallback check against allowed_models list
      const isModelAllowed = plan.allowed_models.includes('*') || plan.allowed_models.includes(model_id);
      if (!isModelAllowed) {
        return res.status(403).json({
          success: false,
          error: `আপনার ${plan.displayName} এ '${model_id}' মডেল ব্যবহারের অনুমতি নেই। Pro বা Max প্ল্যানে আপগ্রেড করুন।`
        });
      }
    }

    // 4. Dynamic Window Rate Limit Check
    const windowStart = new Date(Date.now() - plan.window_hours * 60 * 60 * 1000);
    let messageCount = 0;

    if (getIsMongoConnected()) {
      messageCount = await UsageLog.countDocuments({
        user_id: user._id,
        timestamp: { $gte: windowStart }
      });
    } else {
      const { getUserUsage } = require('../../utils/getModelConfig');
      const supabaseCount = await getUserUsage(user._id, plan.window_hours);
      const memCount = memoryStore.usageLogs.filter(l => String(l.user_id) === String(user._id) && new Date(l.timestamp) >= windowStart).length;
      messageCount = Math.max(supabaseCount, memCount);
    }

    if (messageCount >= plan.message_limit) {
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
