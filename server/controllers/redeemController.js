const RedeemCode = require('../models/RedeemCode');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore, debouncedSave } = require('../config/memoryStore');

const PLAN_HIERARCHY = { 'Free': 1, 'Pro': 2, 'Max': 3 };

const claimRedeemCode = async (req, res) => {
  try {
    const { code } = req.body;
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'রিডিম কোড সক্রিয় করতে অনুগ্রহ করে প্রথমে অ্যাকাউন্টে লগইন করুন।' });
    }

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, error: 'সঠিক রিডিম কোড ইনপুট প্রদান করুন' });
    }

    const cleanCode = code.trim().toUpperCase();
    const now = new Date();
    const userId = user._id;

    if (getIsMongoConnected()) {
      const redeemCode = await RedeemCode.findOneAndUpdate(
        { code: cleanCode, is_used: false },
        { $set: { is_used: true, used_by: userId, used_at: now } },
        { new: true }
      );
      if (!redeemCode) {
        return res.status(400).json({ success: false, error: 'অবৈধ, অকার্যকর অথবা ইতিমধ্যে ব্যবহৃত রিডিম কোড!' });
      }

      const durationDays = redeemCode.duration_days || 30;
      const isCurrentActive = user && user.subscription && user.subscription.expires_at && new Date(user.subscription.expires_at) > now;
      const baseDate = isCurrentActive ? new Date(user.subscription.expires_at) : now;
      const expiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const currentTier = isCurrentActive ? (PLAN_HIERARCHY[user.subscription.plan_name] || 1) : 1;
      const newTier = PLAN_HIERARCHY[redeemCode.plan_name] || 1;
      const finalPlanName = currentTier > newTier ? user.subscription.plan_name : redeemCode.plan_name;

      const subscriptionData = { plan_name: finalPlanName, starts_at: now, expires_at: expiresAt, is_active: true };

      if (user) {
        user.subscription = subscriptionData;
        await user.save();
      }

      const jwt = require('jsonwebtoken');
      const newToken = jwt.sign({
        id: String(user._id || user.id),
        role: user.role || 'user',
        plan: finalPlanName,
        name: user.name || '',
        email: user.email || ''
      }, process.env.JWT_SECRET || 'alokpoth_secret_jwt_key_2026_super_secure_998877', { expiresIn: '30d' });

      return res.json({
        success: true,
        message: `অভিনন্দন! আপনার অ্যাকাউন্টে ${durationDays} দিনের জন্য '${finalPlanName}' প্ল্যান সক্রিয় হয়েছে।`,
        token: newToken,
        plan_name: finalPlanName,
        duration_days: durationDays,
        expires_at: expiresAt.toISOString(),
        subscription: subscriptionData
      });
    } else {
      const { getPersistedRedeemCodes, savePersistedRedeemCodes } = require('../../utils/getModelConfig');
      let codes = await getPersistedRedeemCodes();
      codes = [...codes];

      const redeemCode = codes.find(c => c.code === cleanCode);
      if (!redeemCode) {
        return res.status(404).json({ success: false, error: 'অবৈধ বা অকার্যকর রিডিম কোড!' });
      }
      if (redeemCode.is_used) {
        return res.status(400).json({ success: false, error: 'এই রিডিম কোডটি ইতিমধ্যে অন্য ব্যবহারকারী দ্বারা দাবি করা হয়েছে!' });
      }

      redeemCode.is_used = true;
      redeemCode.used_by = userId;
      redeemCode.used_at = now;

      const durationDays = redeemCode.duration_days || 30;
      const isCurrentActive = user && user.subscription && user.subscription.expires_at && new Date(user.subscription.expires_at) > now;
      const baseDate = isCurrentActive ? new Date(user.subscription.expires_at) : now;
      const expiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const currentTier = isCurrentActive ? (PLAN_HIERARCHY[user.subscription.plan_name] || 1) : 1;
      const newTier = PLAN_HIERARCHY[redeemCode.plan_name] || 1;
      const finalPlanName = currentTier > newTier ? user.subscription.plan_name : redeemCode.plan_name;

      const subscriptionData = { plan_name: finalPlanName, starts_at: now, expires_at: expiresAt, is_active: true };

      if (user) {
        user.subscription = subscriptionData;
      }
      await savePersistedRedeemCodes(codes);
      debouncedSave();

      const jwt = require('jsonwebtoken');
      const newToken = jwt.sign({
        id: String(user._id || user.id),
        role: user.role || 'user',
        plan: finalPlanName,
        name: user.name || '',
        email: user.email || ''
      }, process.env.JWT_SECRET || 'alokpoth_secret_jwt_key_2026_super_secure_998877', { expiresIn: '30d' });

      return res.json({
        success: true,
        message: `অভিনন্দন! আপনার অ্যাকাউন্টে ${durationDays} দিনের জন্য '${finalPlanName}' প্ল্যান সক্রিয় হয়েছে।`,
        token: newToken,
        plan_name: finalPlanName,
        duration_days: durationDays,
        expires_at: expiresAt.toISOString(),
        subscription: subscriptionData
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { claimRedeemCode };
