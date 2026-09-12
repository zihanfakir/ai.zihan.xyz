const jwt = require('jsonwebtoken');
const RedeemCode = require('../models/RedeemCode');
const User = require('../models/User');
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
    const userId = user._id || user.id;

    // Lifetime plan detection
    const isLifetime = user.subscription && user.subscription.is_active && user.subscription.expires_at === null && user.subscription.plan_name !== 'Free';
    const currentTier = (user.subscription && user.subscription.plan_name) ? (PLAN_HIERARCHY[user.subscription.plan_name] || 1) : 1;

    let claimedCodeId = null;
    let isCustomCode = false;

    if (getIsMongoConnected()) {
      // First, find the code to check if it's custom multi-use
      let redeemCode = await RedeemCode.findOne({ code: cleanCode });
      if (!redeemCode) {
        return res.status(400).json({ success: false, error: 'অবৈধ বা অকার্যকর রিডিম কোড!' });
      }

      // Check if custom multi-use code
      if (redeemCode.is_custom) {
        isCustomCode = true;
        // Check if already used by this user
        const alreadyUsed = (redeemCode.used_by_list || []).some(u => String(u.user_id) === String(userId) || (user.email && u.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim()));
        if (alreadyUsed) {
          return res.status(400).json({ success: false, error: 'আপনি ইতিমধ্যে এই কাস্টম রিডিম কোডটি ব্যবহার করেছেন!' });
        }
        // Check max uses
        if ((redeemCode.use_count || 0) >= (redeemCode.max_uses || 1)) {
          return res.status(400).json({ success: false, error: 'এই কাস্টম রিডিম কোডটির সর্বোচ্চ ব্যবহার সীমা পূর্ণ হয়েছে!' });
        }
        // Atomically increment use_count and add to used_by_list
        redeemCode = await RedeemCode.findOneAndUpdate(
          { code: cleanCode, use_count: { $lt: redeemCode.max_uses || 1 } },
          { 
            $inc: { use_count: 1 },
            $push: { used_by_list: { user_id: userId, email: user.email || '', used_at: now } },
            $set: { is_used: (redeemCode.use_count + 1) >= (redeemCode.max_uses || 1) }
          },
          { new: true }
        );
        if (!redeemCode) {
          return res.status(400).json({ success: false, error: 'এই কাস্টম রিডিম কোডটির সর্বোচ্চ ব্যবহার সীমা পূর্ণ হয়েছে!' });
        }
        claimedCodeId = redeemCode._id;
      } else {
        // Standard single-use code - use atomic findOneAndUpdate
        if (redeemCode.is_used) {
          return res.status(400).json({ success: false, error: 'এই রিডিম কোডটি ইতিমধ্যে অন্য ব্যবহারকারী দ্বারা দাবি করা হয়েছে!' });
        }
        redeemCode = await RedeemCode.findOneAndUpdate(
          { code: cleanCode, is_used: false },
          { $set: { is_used: true, used_by: userId, used_at: now } },
          { new: true }
        );
        if (!redeemCode) {
          return res.status(400).json({ success: false, error: 'অবৈধ, অকার্যকর অথবা ইতিমধ্যে ব্যবহৃত রিডিম কোড!' });
        }
        claimedCodeId = redeemCode._id;
      }

      const durationDays = redeemCode.duration_days || 30;
      const newTier = PLAN_HIERARCHY[redeemCode.plan_name] || 1;

      // Lifetime plan holders with >= tier: rollback and reject
      if (isLifetime && currentTier >= newTier) {
        if (isCustomCode) {
          await RedeemCode.updateOne({ _id: redeemCode._id }, { 
            $inc: { use_count: -1 },
            $pull: { used_by_list: { user_id: userId } },
            $set: { is_used: false }
          });
        } else {
          await RedeemCode.updateOne({ _id: redeemCode._id }, { $set: { is_used: false, used_by: null, used_at: null } });
        }
        claimedCodeId = null;
        return res.status(400).json({ success: false, error: 'আপনার অ্যাকাউন্টে ইতিমধ্যে আজীবন সক্রিয় প্ল্যান রয়েছে। এই কোডটি ব্যবহার করা সম্ভব নয়।' });
      }

      // Lower-tier code on higher-tier active plan: reject
      const isCurrentActive = !isLifetime && user.subscription && user.subscription.expires_at && new Date(user.subscription.expires_at) > now;
      let baseDate, finalPlanName;
      if (isCurrentActive && currentTier > newTier) {
        if (isCustomCode) {
          await RedeemCode.updateOne({ _id: redeemCode._id }, { 
            $inc: { use_count: -1 },
            $pull: { used_by_list: { user_id: userId } },
            $set: { is_used: false }
          });
        } else {
          await RedeemCode.updateOne({ _id: redeemCode._id }, { $set: { is_used: false, used_by: null, used_at: null } });
        }
        claimedCodeId = null;
        return res.status(400).json({ success: false, error: `আপনার অ্যাকাউন্টে ইতিমধ্যে উচ্চতর প্ল্যান (${user.subscription.plan_name}) সক্রিয় আছে। এই কোডটি ব্যবহার করা সম্ভব নয়।` });
      } else if (isCurrentActive && currentTier === newTier) {
        baseDate = new Date(user.subscription.expires_at);
        finalPlanName = redeemCode.plan_name;
      } else {
        baseDate = now;
        finalPlanName = redeemCode.plan_name;
      }

      const expiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const subscriptionData = { plan_name: finalPlanName, starts_at: now, expires_at: expiresAt, is_active: true };

      // Support both ObjectId and custom string user IDs without CastError
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(userId)) {
        await User.findByIdAndUpdate(userId, { $set: { subscription: subscriptionData } });
      } else if (user.email) {
        await User.findOneAndUpdate({ email: user.email.toLowerCase().trim() }, { $set: { subscription: subscriptionData } });
      }
      user.subscription = subscriptionData;

      // Also sync to Supabase and memoryStore so multi-store stays in sync
      try {
        const { getPersistedUsers, savePersistedUsers, getPersistedRedeemCodes, savePersistedRedeemCodes } = require('../../utils/getModelConfig');
        let users = await getPersistedUsers();
        users = [...users];
        const uIdx = users.findIndex(u => String(u._id || u.id) === String(userId) || (u.email && user.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim()));
        if (uIdx !== -1) {
          users[uIdx].subscription = subscriptionData;
          await savePersistedUsers(users);
        }
        if (memoryStore.users) {
          const mUser = memoryStore.users.find(u => String(u._id || u.id) === String(userId) || (u.email && user.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim()));
          if (mUser) mUser.subscription = subscriptionData;
        }
        let pCodes = await getPersistedRedeemCodes();
        pCodes = [...pCodes];
        const cIdx = pCodes.findIndex(c => c.code === cleanCode);
        if (cIdx !== -1) {
          if (pCodes[cIdx].is_custom) {
            pCodes[cIdx].use_count = (pCodes[cIdx].use_count || 0) + 1;
            if (!Array.isArray(pCodes[cIdx].used_by_list)) pCodes[cIdx].used_by_list = [];
            pCodes[cIdx].used_by_list.push({ user_id: userId, email: user.email || '', used_at: now });
            pCodes[cIdx].is_used = pCodes[cIdx].use_count >= (pCodes[cIdx].max_uses || 1);
          } else {
            pCodes[cIdx].is_used = true;
            pCodes[cIdx].used_by = userId;
            pCodes[cIdx].used_at = now;
          }
          await savePersistedRedeemCodes(pCodes);
        }
        debouncedSave();
      } catch (syncErr) {
        console.warn('[Redeem Mongo Sync Warning]:', syncErr.message);
      }

      const newToken = jwt.sign({
        id: String(userId),
        role: user.role || 'user',
        plan: finalPlanName,
        expires_at: expiresAt.toISOString(),
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
      // ========== Non-Mongo (Supabase/memoryStore) Mode ==========
      
      // Atomic pre-check in memoryStore
      if (memoryStore.redeemCodes) {
        const memCode = memoryStore.redeemCodes.find(c => c.code === cleanCode);
        if (memCode) {
          if (memCode.is_custom) {
            const alreadyUsed = (memCode.used_by_list || []).some(u => String(u.user_id) === String(userId) || (user.email && u.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim()));
            if (alreadyUsed) {
              return res.status(400).json({ success: false, error: 'আপনি ইতিমধ্যে এই কাস্টম রিডিম কোডটি ব্যবহার করেছেন!' });
            }
            if ((memCode.use_count || 0) >= (memCode.max_uses || 1)) {
              return res.status(400).json({ success: false, error: 'এই কাস্টম রিডিম কোডটির সর্বোচ্চ ব্যবহার সীমা পূর্ণ হয়েছে!' });
            }
          } else if (memCode.is_used) {
            return res.status(400).json({ success: false, error: 'এই রিডিম কোডটি ইতিমধ্যে অন্য ব্যবহারকারী দ্বারা দাবি করা হয়েছে!' });
          }
        }
      }

      const { getPersistedRedeemCodes, savePersistedRedeemCodes, getPersistedUsers, savePersistedUsers } = require('../../utils/getModelConfig');
      let codes = await getPersistedRedeemCodes();
      codes = [...codes];

      const redeemCode = codes.find(c => c.code === cleanCode);
      if (!redeemCode) {
        return res.status(400).json({ success: false, error: 'অবৈধ বা অকার্যকর রিডিম কোড!' });
      }

      if (redeemCode.is_custom) {
        isCustomCode = true;
        const alreadyUsed = (redeemCode.used_by_list || []).some(u => String(u.user_id) === String(userId) || (user.email && u.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim()));
        if (alreadyUsed) {
          return res.status(400).json({ success: false, error: 'আপনি ইতিমধ্যে এই কাস্টম রিডিম কোডটি ব্যবহার করেছেন!' });
        }
        if ((redeemCode.use_count || 0) >= (redeemCode.max_uses || 1)) {
          return res.status(400).json({ success: false, error: 'এই কাস্টম রিডিম কোডটির সর্বোচ্চ ব্যবহার সীমা পূর্ণ হয়েছে!' });
        }
      } else {
        if (redeemCode.is_used) {
          return res.status(400).json({ success: false, error: 'এই রিডিম কোডটি ইতিমধ্যে অন্য ব্যবহারকারী দ্বারা দাবি করা হয়েছে!' });
        }
      }

      const durationDays = redeemCode.duration_days || 30;
      const newTier = PLAN_HIERARCHY[redeemCode.plan_name] || 1;

      // Lifetime plan holders with >= tier: reject
      if (isLifetime && currentTier >= newTier) {
        return res.status(400).json({ success: false, error: 'আপনার অ্যাকাউন্টে ইতিমধ্যে আজীবন সক্রিয় প্ল্যান রয়েছে। এই কোডটি ব্যবহার করা সম্ভব নয়।' });
      }

      // Lower-tier code on higher-tier active plan: reject
      const isCurrentActive = !isLifetime && user.subscription && user.subscription.expires_at && new Date(user.subscription.expires_at) > now;
      let baseDate, finalPlanName;
      if (isCurrentActive && currentTier > newTier) {
        return res.status(400).json({ success: false, error: `আপনার অ্যাকাউন্টে ইতিমধ্যে উচ্চতর প্ল্যান (${user.subscription.plan_name}) সক্রিয় আছে। এই কোডটি ব্যবহার করা সম্ভব নয়।` });
      } else if (isCurrentActive && currentTier === newTier) {
        baseDate = new Date(user.subscription.expires_at);
        finalPlanName = redeemCode.plan_name;
      } else {
        baseDate = now;
        finalPlanName = redeemCode.plan_name;
      }

      const expiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const subscriptionData = { plan_name: finalPlanName, starts_at: now, expires_at: expiresAt, is_active: true };

      // Mark code as used
      if (redeemCode.is_custom) {
        redeemCode.use_count = (redeemCode.use_count || 0) + 1;
        if (!Array.isArray(redeemCode.used_by_list)) redeemCode.used_by_list = [];
        redeemCode.used_by_list.push({ user_id: userId, email: user.email || '', used_at: now });
        redeemCode.is_used = redeemCode.use_count >= (redeemCode.max_uses || 1);
      } else {
        redeemCode.is_used = true;
        redeemCode.used_by = userId;
        redeemCode.used_at = now;
      }

      // Update user subscription in Supabase
      let users = await getPersistedUsers();
      users = [...users];
      const userEmail = (user.email || '').toLowerCase().trim();
      const uIdx = users.findIndex(u => String(u._id || u.id) === String(userId) || (userEmail && u.email && u.email.toLowerCase().trim() === userEmail));
      if (uIdx !== -1) {
        users[uIdx].subscription = subscriptionData;
        await savePersistedUsers(users);
      } else {
        console.warn('[Redeem] User not found in persisted users array, userId:', userId);
      }
      if (memoryStore.users) {
        const mUser = memoryStore.users.find(u => String(u._id || u.id) === String(userId) || (userEmail && u.email && u.email.toLowerCase().trim() === userEmail));
        if (mUser) mUser.subscription = subscriptionData;
      }
      user.subscription = subscriptionData;

      await savePersistedRedeemCodes(codes);
      debouncedSave();

      const newToken = jwt.sign({
        id: String(userId),
        role: user.role || 'user',
        plan: finalPlanName,
        expires_at: expiresAt.toISOString(),
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
    console.error('[Redeem Error]:', error);
    if (claimedCodeId && getIsMongoConnected()) {
      try {
        const RedeemCode = require('../models/RedeemCode');
        const failedCode = await RedeemCode.findById(claimedCodeId);
        if (failedCode && failedCode.is_custom) {
          await RedeemCode.updateOne({ _id: claimedCodeId }, { 
            $inc: { use_count: -1 },
            $pull: { used_by_list: { user_id: userId } },
            $set: { is_used: false }
          });
        } else {
          await RedeemCode.updateOne({ _id: claimedCodeId }, { $set: { is_used: false, used_by: null, used_at: null } });
        }
      } catch {}
    }
    res.status(500).json({ success: false, error: 'সার্ভারে অভ্যন্তরীণ সমস্যা হয়েছে।' });
  }
};

module.exports = { claimRedeemCode };
