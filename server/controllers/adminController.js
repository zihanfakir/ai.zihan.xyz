const User = require('../models/User');
const Plan = require('../models/Plan');
const RedeemCode = require('../models/RedeemCode');
const UsageLog = require('../models/UsageLog');
const AiModel = require('../models/AiModel');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore, debouncedSave } = require('../config/memoryStore');
const supabase = require('../config/supabase');
const { invalidateModelKeyCache } = require('../../utils/getModelConfig');

// Supabase তে api_key upsert করার helper
async function upsertApiKeyToSupabase(modelId, apiKey) {
  if (!supabase || !modelId || !apiKey) return;
  try {
    const { error } = await supabase
      .from('api_keys')
      .upsert({ model_id: modelId, api_key: apiKey, updated_at: new Date().toISOString() }, { onConflict: 'model_id' });
    if (error) console.error('[Supabase] api_key upsert error:', error.message);
    else {
      invalidateModelKeyCache(modelId); // Cache clear করো
      console.log(`[Supabase] api_key saved for model: ${modelId}`);
    }
  } catch (e) {
    console.error('[Supabase] api_key upsert exception:', e.message);
  }
}

const getAdminStats = async (req, res) => {
  try {
    if (getIsMongoConnected()) {
      const totalUsers = await User.countDocuments();
      const proUsers = await User.countDocuments({ 'subscription.plan_name': 'Pro' });
      const maxUsers = await User.countDocuments({ 'subscription.plan_name': 'Max' });
      const totalRedeemCodes = await RedeemCode.countDocuments();
      const usedRedeemCodes = await RedeemCode.countDocuments({ is_used: true });
      const totalMessages = await UsageLog.countDocuments();

      const stats = {
        totalUsers,
        total_users: totalUsers,
        proUsers,
        pro_users: proUsers,
        maxUsers,
        max_users: maxUsers,
        totalRedeemCodes,
        total_codes: totalRedeemCodes,
        total_redeem_codes: totalRedeemCodes,
        usedRedeemCodes,
        used_codes: usedRedeemCodes,
        used_redeem_codes: usedRedeemCodes,
        availableRedeemCodes: totalRedeemCodes - usedRedeemCodes,
        totalMessages,
        total_messages: totalMessages
      };
      return res.json({ success: true, stats });
    } else {
      const totalUsers = memoryStore.users.length;
      const proUsers = memoryStore.users.filter(u => u.subscription && u.subscription.plan_name === 'Pro').length;
      const maxUsers = memoryStore.users.filter(u => u.subscription && u.subscription.plan_name === 'Max').length;
      const { getPersistedRedeemCodes } = require('../../utils/getModelConfig');
      const persistedCodes = await getPersistedRedeemCodes();
      const totalRedeemCodes = persistedCodes.length;
      const usedRedeemCodes = persistedCodes.filter(c => c.is_used).length;
      const totalMessages = memoryStore.usageLogs.length;

      const stats = {
        totalUsers,
        total_users: totalUsers,
        proUsers,
        pro_users: proUsers,
        maxUsers,
        max_users: maxUsers,
        totalRedeemCodes,
        total_codes: totalRedeemCodes,
        total_redeem_codes: totalRedeemCodes,
        usedRedeemCodes,
        used_codes: usedRedeemCodes,
        used_redeem_codes: usedRedeemCodes,
        availableRedeemCodes: totalRedeemCodes - usedRedeemCodes,
        totalMessages,
        total_messages: totalMessages
      };
      return res.json({ success: true, stats });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    if (getIsMongoConnected()) {
      const users = await User.find().select('-password').sort({ createdAt: -1 });
      return res.json({ success: true, count: users.length, users });
    } else {
      const users = memoryStore.users.map(({ password, ...u }) => u);
      return res.json({ success: true, count: users.length, users });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateUserPlan = async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan_name, duration_days = 30 } = req.body;

    const days = Math.min(Math.max(Number(duration_days) || 30, 1), 3650);
    const now = new Date();
    let expiresAt = null;
    if (plan_name && plan_name !== 'Free') {
      expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }

    if (getIsMongoConnected()) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'ইউজার পাওয়া যায়নি।' });
      }

      user.subscription = {
        plan_name: plan_name || 'Free',
        starts_at: now,
        expires_at: expiresAt,
        is_active: true
      };

      await user.save();
      return res.json({
        success: true,
        message: `${user.name}-এর প্ল্যান ${plan_name} করা হয়েছে (${days} দিন)।`,
        subscription: user.subscription
      });
    } else {
      const user = memoryStore.users.find(u => String(u._id) === String(userId));
      if (!user) {
        return res.status(404).json({ success: false, error: 'ইউজার পাওয়া যায়নি।' });
      }

      user.subscription = {
        plan_name: plan_name || 'Free',
        starts_at: now,
        expires_at: expiresAt,
        is_active: true
      };
      debouncedSave();

      return res.json({
        success: true,
        message: `${user.name}-এর প্ল্যান ${plan_name} করা হয়েছে (${days} দিন)।`,
        subscription: user.subscription
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const toggleBlockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_blocked } = req.body;

    if (req.user && String(userId) === String(req.user._id)) {
      return res.status(400).json({ success: false, error: 'অ্যাডমিন নিজের অ্যাকাউন্ট ব্লক করতে পারবেন না।' });
    }

    if (getIsMongoConnected()) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'ইউজার পাওয়া যায়নি।' });
      }

      user.is_blocked = is_blocked !== undefined ? is_blocked : !user.is_blocked;
      await user.save();

      return res.json({
        success: true,
        message: `ইউজার ${user.is_blocked ? 'ব্লক' : 'আনব্লক'} করা হয়েছে।`,
        is_blocked: user.is_blocked
      });
    } else {
      const user = memoryStore.users.find(u => String(u._id) === String(userId));
      if (!user) {
        return res.status(404).json({ success: false, error: 'ইউজার পাওয়া যায়নি।' });
      }

      user.is_blocked = is_blocked !== undefined ? is_blocked : !user.is_blocked;
      debouncedSave();

      return res.json({
        success: true,
        message: `ইউজার ${user.is_blocked ? 'ব্লক' : 'আনব্লক'} করা হয়েছে।`,
        is_blocked: user.is_blocked
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getPlans = async (req, res) => {
  try {
    if (getIsMongoConnected()) {
      const plans = await Plan.find();
      return res.json({ success: true, count: plans.length, plans });
    } else {
      return res.json({ success: true, count: memoryStore.plans.length, plans: memoryStore.plans });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updatePlanLimits = async (req, res) => {
  try {
    const { planName } = req.params;
    const { message_limit, window_hours, is_active } = req.body;

    if (getIsMongoConnected()) {
      const plan = await Plan.findOne({ name: planName });
      if (!plan) {
        return res.status(404).json({ success: false, error: 'প্ল্যান পাওয়া যায়নি।' });
      }

      if (message_limit !== undefined) plan.message_limit = Number(message_limit);
      if (window_hours !== undefined) plan.window_hours = Number(window_hours);
      if (is_active !== undefined) plan.is_active = Boolean(is_active);

      await plan.save();
      return res.json({
        success: true,
        message: `${plan.name} প্ল্যানের লিমিট সফলভাবে আপডেট করা হয়েছে।`,
        plan
      });
    } else {
      const plan = memoryStore.plans.find(p => p.name === planName);
      if (!plan) {
        return res.status(404).json({ success: false, error: 'প্ল্যান পাওয়া যায়নি।' });
      }

      if (message_limit !== undefined) plan.message_limit = Number(message_limit);
      if (window_hours !== undefined) plan.window_hours = Number(window_hours);
      if (is_active !== undefined) plan.is_active = Boolean(is_active);
      debouncedSave();

      return res.json({
        success: true,
        message: `${plan.name} প্ল্যানের লিমিট সফলভাবে আপডেট করা হয়েছে।`,
        plan
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const generateRandomCode = (planName) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ALO-${planName.toUpperCase()}-${rand}`;
};

const generateRedeemCodes = async (req, res) => {
  try {
    const { plan_name, count = 1, duration_days = 30 } = req.body;
    if (!['Pro', 'Max'].includes(plan_name)) {
      return res.status(400).json({ success: false, error: 'প্ল্যান অবশ্যই Pro অথবা Max হতে হবে' });
    }

    const createdCodes = [];
    const numToCreate = Math.min(Math.max(Number(count) || 1, 1), 100);

    for (let i = 0; i < numToCreate; i++) {
      let codeStr = generateRandomCode(plan_name);
      
      if (getIsMongoConnected()) {
        let attempts = 0;
        while (await RedeemCode.exists({ code: codeStr })) {
          attempts++;
          if (attempts > 30) { codeStr += '-' + Date.now().toString(36); break; }
          codeStr = generateRandomCode(plan_name);
        }
        const codeDoc = await RedeemCode.create({
          code: codeStr,
          plan_name,
          duration_days,
          created_by: req.user._id
        });
        createdCodes.push(codeDoc);
      } else {
        const { getPersistedRedeemCodes, savePersistedRedeemCodes } = require('../../utils/getModelConfig');
        let currentCodes = await getPersistedRedeemCodes();
        currentCodes = [...currentCodes];

        let attempts = 0;
        while (currentCodes.some(c => c.code === codeStr)) {
          attempts++;
          if (attempts > 30) { codeStr += '-' + Date.now().toString(36); break; }
          codeStr = generateRandomCode(plan_name);
        }
        const codeDoc = {
          _id: 'code_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          code: codeStr,
          plan_name,
          duration_days,
          is_used: false,
          used_by: null,
          used_at: null,
          createdAt: new Date()
        };
        currentCodes.push(codeDoc);
        await savePersistedRedeemCodes(currentCodes);
        createdCodes.push(codeDoc);
      }
    }
    if (!getIsMongoConnected()) debouncedSave();

    res.status(201).json({
      success: true,
      message: `${createdCodes.length}টি ${plan_name} রিডিম কোড সফলভাবে জেনারেট করা হয়েছে।`,
      codes: createdCodes
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getRedeemCodes = async (req, res) => {
  try {
    if (getIsMongoConnected()) {
      const codes = await RedeemCode.find().populate('used_by', 'name email').sort({ createdAt: -1 });
      return res.json({ success: true, count: codes.length, codes });
    } else {
      const { getPersistedRedeemCodes } = require('../../utils/getModelConfig');
      const persisted = await getPersistedRedeemCodes();
      const codes = persisted.map(c => {
        let used_by = c.used_by;
        if (typeof used_by === 'string') {
          const u = memoryStore.users.find(usr => String(usr._id) === String(used_by));
          if (u) used_by = { name: u.name, email: u.email };
        }
        return { ...c, used_by };
      });
      return res.json({ success: true, count: codes.length, codes });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteRedeemCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    if (getIsMongoConnected()) {
      await RedeemCode.findByIdAndDelete(codeId);
    } else {
      const { getPersistedRedeemCodes, savePersistedRedeemCodes } = require('../../utils/getModelConfig');
      let codes = await getPersistedRedeemCodes();
      codes = codes.filter(c => String(c._id) !== String(codeId) && String(c.code) !== String(codeId));
      await savePersistedRedeemCodes(codes);
      debouncedSave();
    }
    res.json({ success: true, message: 'রিডিম কোডটি মুছে ফেলা হয়েছে।' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getModels = async (req, res) => {
  try {
    if (getIsMongoConnected()) {
      const models = await AiModel.find().sort({ order: 1 });
      return res.json({ success: true, models });
    } else {
      const { getPersistedModels } = require('../../utils/getModelConfig');
      const models = await getPersistedModels();
      const sorted = [...models].sort((a, b) => (a.order || 0) - (b.order || 0));
      return res.json({ success: true, models: sorted });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateModel = async (req, res) => {
  try {
    const { modelId } = req.params;
    const { premium, efficient, name, base_url, api_key } = req.body;

    // api_key পাঠানো হলে Supabase এ সেভ করো (MongoDB বা memoryStore নির্বিশেষে)
    if (api_key !== undefined && api_key !== '') {
      await upsertApiKeyToSupabase(modelId, api_key);
    }
    
    if (getIsMongoConnected()) {
      const model = await AiModel.findOne({ model_id: modelId });
      if (!model) return res.status(404).json({ success: false, error: 'মডেল পাওয়া যায়নি' });
      if (premium !== undefined) model.premium = Boolean(premium);
      if (efficient !== undefined) model.efficient = Boolean(efficient);
      if (name !== undefined) model.name = name;
      if (base_url !== undefined) model.base_url = base_url;
      // api_key MongoDB তে সেভ করা বন্ধ (Supabase এ থাকবে)
      await model.save();
      return res.json({ success: true, message: 'মডেল আপডেট হয়েছে', model });
    } else {
      const { getPersistedModels, savePersistedModels } = require('../../utils/getModelConfig');
      let models = await getPersistedModels();
      models = [...models];
      const model = models.find(m => m.id === modelId || m.model_id === modelId);
      if (!model) return res.status(404).json({ success: false, error: 'মডেল পাওয়া যায়নি' });
      if (premium !== undefined) model.premium = Boolean(premium);
      if (efficient !== undefined) model.efficient = Boolean(efficient);
      if (name !== undefined) model.name = name;
      if (base_url !== undefined) model.base_url = base_url;
      if (api_key !== undefined) model.api_key = api_key;
      await savePersistedModels(models);
      debouncedSave();
      return res.json({ success: true, message: 'মডেল আপডেট হয়েছে', model });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const addModel = async (req, res) => {
  try {
    const { model_id, name, base_url, api_key, premium, efficient, provider, type } = req.body;
    if (!model_id || !name) {
      return res.status(400).json({ success: false, error: 'মডেল আইডি এবং নাম আবশ্যক' });
    }

    // api_key Supabase এ সেভ করো
    if (api_key) {
      await upsertApiKeyToSupabase(model_id, api_key);
    }

    if (getIsMongoConnected()) {
      const existing = await AiModel.findOne({ model_id });
      if (existing) {
        return res.status(400).json({ success: false, error: 'এই মডেল আইডি ইতিমধ্যে বিদ্যমান' });
      }
      const count = await AiModel.countDocuments();
      const model = await AiModel.create({
        model_id,
        name,
        base_url: base_url || '',
        // api_key MongoDB তে সেভ হবে না
        premium: Boolean(premium),
        efficient: Boolean(efficient),
        provider: provider || 'Alokpoth',
        type: type || 'custom',
        order: count + 1
      });
      return res.status(201).json({ success: true, message: 'নতুন মডেল সফলভাবে যোগ করা হয়েছে', model });
    } else {
      const { getPersistedModels, savePersistedModels } = require('../../utils/getModelConfig');
      let models = await getPersistedModels();
      models = [...models];

      const existing = models.find(m => (m.id === model_id || m.model_id === model_id));
      if (existing) {
        return res.status(400).json({ success: false, error: 'এই মডেল আইডি ইতিমধ্যে বিদ্যমান' });
      }
      const maxOrder = models.reduce((max, m) => Math.max(max, m.order || 0), 0);
      const newModel = {
        id: model_id,
        model_id,
        name,
        base_url: base_url || '',
        api_key: api_key || '',
        premium: Boolean(premium),
        efficient: Boolean(efficient),
        provider: provider || 'Alokpoth',
        type: type || 'custom',
        order: maxOrder + 1
      };
      models.push(newModel);
      await savePersistedModels(models);
      debouncedSave();
      return res.status(201).json({ success: true, message: 'নতুন মডেল সফলভাবে যোগ করা হয়েছে', model: newModel });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteModel = async (req, res) => {
  try {
    const { modelId } = req.params;
    if (getIsMongoConnected()) {
      await AiModel.findOneAndDelete({ model_id: modelId });
    } else {
      const { getPersistedModels, savePersistedModels } = require('../../utils/getModelConfig');
      let models = await getPersistedModels();
      models = models.filter(m => (m.id !== modelId && m.model_id !== modelId));
      await savePersistedModels(models);
      debouncedSave();
    }
    return res.json({ success: true, message: 'মডেল মুছে ফেলা হয়েছে' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const reorderModels = async (req, res) => {
  try {
    const { modelId, direction, modelIds } = req.body;

    if (modelIds && Array.isArray(modelIds)) {
      if (getIsMongoConnected()) {
        for (let i = 0; i < modelIds.length; i++) {
          await AiModel.updateOne({ model_id: modelIds[i] }, { $set: { order: i + 1 } });
        }
        const updated = await AiModel.find().sort({ order: 1, createdAt: 1 });
        return res.json({ success: true, message: 'মডেলের ক্রম সফলভাবে পরিবর্তন করা হয়েছে', models: updated });
      } else {
        const { getPersistedModels, savePersistedModels } = require('../../utils/getModelConfig');
        let models = await getPersistedModels();
        models = [...models]; // clone

        modelIds.forEach((id, idx) => {
          const m = models.find(x => (x.id === id || x.model_id === id));
          if (m) m.order = idx + 1;
        });
        models.sort((a, b) => (a.order || 0) - (b.order || 0));
        await savePersistedModels(models);
        debouncedSave();
        return res.json({ success: true, message: 'মডেলের ক্রম সফলভাবে পরিবর্তন করা হয়েছে', models });
      }
    }

    if (modelId && direction) {
      if (getIsMongoConnected()) {
        const models = await AiModel.find().sort({ order: 1, createdAt: 1 });
        const idx = models.findIndex(m => m.model_id === modelId);
        if (idx === -1) return res.status(404).json({ success: false, error: 'মডেল পাওয়া যায়নি' });
        
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx >= 0 && targetIdx < models.length) {
          const [movedModel] = models.splice(idx, 1);
          models.splice(targetIdx, 0, movedModel);

          for (let i = 0; i < models.length; i++) {
            await AiModel.updateOne({ _id: models[i]._id }, { $set: { order: i + 1 } });
          }
        }
        const updated = await AiModel.find().sort({ order: 1, createdAt: 1 });
        return res.json({ success: true, message: 'মডেলের অবস্থান পরিবর্তন হয়েছে', models: updated });
      } else {
        const { getPersistedModels, savePersistedModels } = require('../../utils/getModelConfig');
        let models = await getPersistedModels();
        models = [...models]; // clone
        models.sort((a, b) => (a.order || 0) - (b.order || 0));

        const idx = models.findIndex(m => (m.id === modelId || m.model_id === modelId));
        if (idx === -1) return res.status(404).json({ success: false, error: 'মডেল পাওয়া যায়নি' });
        
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx >= 0 && targetIdx < models.length) {
          const [movedModel] = models.splice(idx, 1);
          models.splice(targetIdx, 0, movedModel);
          
          models.forEach((m, i) => { m.order = i + 1; });
          await savePersistedModels(models);
          debouncedSave();
        }
        return res.json({ success: true, message: 'মডেলের অবস্থান পরিবর্তন হয়েছে', models });
      }
    }

    return res.status(400).json({ success: false, error: 'সঠিক তথ্য দিন' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { 
  getModels, 
  updateModel, 
  addModel,
  deleteModel,
  reorderModels,
  getAdminStats,
  getUsers,
  updateUserPlan,
  toggleBlockUser,
  getPlans,
  updatePlanLimits,
  generateRedeemCodes,
  getRedeemCodes,
  deleteRedeemCode
};
