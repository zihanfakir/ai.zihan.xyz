// utils/getModelConfig.js
// Supabase থেকে api_key নিয়ে আসে। পাওয়া না গেলে memoryStore fallback।
const supabase = require('../server/config/supabase');
const { memoryStore } = require('../server/config/memoryStore');

// Cache: avoid repeated DB hits per request cycle (1 min TTL)
const keyCache = new Map(); // model_id -> { api_key, ts }
const CACHE_TTL = 60 * 1000; // 1 minute

async function getApiKeyFromSupabase(modelId) {
  const now = Date.now();
  const cached = keyCache.get(modelId);
  if (cached && (now - cached.ts) < CACHE_TTL) {
    return cached.api_key;
  }

  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('model_id', modelId)
      .single();

    if (!error && data && data.api_key) {
      keyCache.set(modelId, { api_key: data.api_key, ts: now });
      return data.api_key;
    }
  } catch (e) {
    console.warn('[Supabase] api_key fetch failed for', modelId, e.message);
  }
  return null;
}

const MODEL_ALIASES = {
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'gemini-1.5-flash': 'gemini-3.5-flash-lite'
};

function resolveModelAlias(rawId) {
  if (!rawId || typeof rawId !== 'string') return rawId;
  let current = rawId;
  const visited = new Set();
  while (MODEL_ALIASES[current] && !visited.has(current)) {
    visited.add(current);
    current = MODEL_ALIASES[current];
  }
  return current;
}

async function getModelConfig(rawId) {
  const modelId = resolveModelAlias(rawId);

  // 1. Check persisted models (from Supabase)
  const allModels = await getPersistedModels();
  const model = allModels.find(
    m => m.id === modelId || m.model_id === modelId || m.id === rawId || m.model_id === rawId
  );

  // 2. Load API key from Supabase
  let apiKey = await getApiKeyFromSupabase(modelId);
  if (!apiKey && rawId !== modelId) {
    apiKey = await getApiKeyFromSupabase(rawId);
  }

  if (model) {
    return { ...model, api_key: model.api_key || apiKey || null };
  }

  if (apiKey) {
    return { id: rawId, model_id: rawId, api_key: apiKey };
  }

  return null;
}


function invalidateModelKeyCache(modelId) {
  modelsCache = null;
  modelsCacheTs = 0;
  if (modelId) {
    keyCache.delete(modelId);
  } else {
    keyCache.clear();
  }
}

// Cache for models metadata
let modelsCache = null;
let modelsCacheTs = 0;

async function getPersistedModels() {
  const now = Date.now();
  if (modelsCache && (now - modelsCacheTs) < 10000) { // 10s cache
    return modelsCache;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('api_key')
        .eq('model_id', '__models_metadata__')
        .limit(1);

      if (!error && data && data.length > 0 && data[0].api_key) {
        const parsed = JSON.parse(data[0].api_key);
        if (Array.isArray(parsed) && parsed.length > 0) {
          modelsCache = parsed;
          modelsCacheTs = now;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[Supabase] __models_metadata__ fetch failed:', e.message);
    }
  }

  // Fallback to memoryStore.models
  return memoryStore.models;
}

async function savePersistedModels(models) {
  modelsCache = models;
  modelsCacheTs = Date.now();

  // Also update memoryStore so it's in sync locally
  memoryStore.models = models;

  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('api_keys')
      .upsert(
        { model_id: '__models_metadata__', api_key: JSON.stringify(models), updated_at: new Date().toISOString() },
        { onConflict: 'model_id' }
      );
    if (error) {
      console.error('[Supabase] Failed to persist models:', error.message);
    }
  } catch (e) {
    console.error('[Supabase] Failed to persist models exception:', e.message);
  }
}

async function getUserUsageDetails(userId, windowHours) {
  const windowMs = (windowHours || 3) * 60 * 60 * 1000;
  const def = { count: 0, resetInMinutes: Math.round((windowHours || 3) * 60) };
  if (!supabase) return def;
  try {
    const { data } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('model_id', '__usage_' + userId + '__')
      .limit(1);

    if (data && data.length > 0 && data[0].api_key) {
      const usage = JSON.parse(data[0].api_key);
      const now = Date.now();
      if (now - usage.start < windowMs) {
        const remainingMs = Math.max(0, (usage.start + windowMs) - now);
        return {
          count: usage.count || 0,
          resetInMinutes: Math.max(1, Math.ceil(remainingMs / 60000))
        };
      }
    }
  } catch (e) {}
  return def;
}

async function getUserUsage(userId, windowHours) {
  const details = await getUserUsageDetails(userId, windowHours);
  return details.count;
}

async function incrementUserUsage(userId, windowHours) {
  if (!supabase) return;
  try {
    const now = Date.now();
    const windowMs = (windowHours || 3) * 60 * 60 * 1000;
    let count = 1;
    let start = now;

    const { data } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('model_id', '__usage_' + userId + '__')
      .limit(1);

    if (data && data.length > 0 && data[0].api_key) {
      try {
        const prev = JSON.parse(data[0].api_key);
        if (now - prev.start < windowMs) {
          count = (prev.count || 0) + 1;
          start = prev.start;
        }
      } catch (e) {}
    }

    await supabase
      .from('api_keys')
      .upsert({
        model_id: '__usage_' + userId + '__',
        api_key: JSON.stringify({ count, start }),
        updated_at: new Date().toISOString()
      }, { onConflict: 'model_id' });
  } catch (e) {}
}

let plansCache = null;
let plansCacheTs = 0;

async function getPersistedPlans() {
  const now = Date.now();
  if (plansCache && (now - plansCacheTs) < 10000) {
    return plansCache;
  }

  const defaultPlans = [
    { name: 'Free', displayName: 'ফ্রি প্ল্যান', message_limit: 10, window_hours: 3, allowed_models: ['openrouter/free', 'gemini-3.5-flash-lite', 'gemini-1.5-flash', 'mimo-v2.5', 'hy3', 'deepseek-v4-flash'], is_active: true },
    { name: 'Pro', displayName: 'প্রো প্ল্যান', message_limit: 30, window_hours: 3, allowed_models: ['*'], is_active: true },
    { name: 'Max', displayName: 'ম্যাক্স প্ল্যান', message_limit: 50, window_hours: 1, allowed_models: ['*'], is_active: true }
  ];

  if (!supabase) return memoryStore.plans || defaultPlans;

  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('model_id', '__plans_metadata__')
      .limit(1);

    if (!error && data && data.length > 0 && data[0].api_key) {
      const parsed = JSON.parse(data[0].api_key);
      if (Array.isArray(parsed) && parsed.length > 0) {
        plansCache = parsed;
        plansCacheTs = now;
        memoryStore.plans = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Supabase] __plans_metadata__ fetch failed:', e.message);
  }

  return memoryStore.plans && memoryStore.plans.length > 0 ? memoryStore.plans : defaultPlans;
}

async function savePersistedPlans(plans) {
  plansCache = plans;
  plansCacheTs = Date.now();
  memoryStore.plans = plans;

  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('api_keys')
      .upsert(
        { model_id: '__plans_metadata__', api_key: JSON.stringify(plans), updated_at: new Date().toISOString() },
        { onConflict: 'model_id' }
      );
    if (error) {
      console.error('[Supabase] Failed to persist plans:', error.message);
    }
  } catch (e) {
    console.error('[Supabase] Failed to persist plans exception:', e.message);
  }
}

async function getPersistedRedeemCodes() {
  if (!supabase) return memoryStore.redeemCodes || [];
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('model_id', '__redeem_codes__')
      .limit(1);

    if (!error && data && data.length > 0 && data[0].api_key) {
      const parsed = JSON.parse(data[0].api_key);
      if (Array.isArray(parsed)) {
        const codeMap = new Map();
        for (const c of parsed) {
          if (c && c.code) codeMap.set(String(c.code).trim().toUpperCase(), c);
        }
        const cleanCodes = Array.from(codeMap.values());
        memoryStore.redeemCodes = cleanCodes;
        return cleanCodes;
      }
    }
  } catch (e) {}
  return memoryStore.redeemCodes || [];
}

async function savePersistedRedeemCodes(codes) {
  const codeMap = new Map();
  for (const c of (codes || [])) {
    if (c && c.code) {
      codeMap.set(String(c.code).trim().toUpperCase(), c);
    }
  }
  const cleanCodes = Array.from(codeMap.values());
  memoryStore.redeemCodes = cleanCodes;

  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('api_keys')
      .upsert({
        model_id: '__redeem_codes__',
        api_key: JSON.stringify(cleanCodes),
        updated_at: new Date().toISOString()
      }, { onConflict: 'model_id' });
    if (error) {
      console.error('[Supabase] Failed to persist redeem codes:', error.message);
    }
  } catch (e) {
    console.error('[Supabase] Failed to persist redeem codes exception:', e.message);
  }
}

// Cache for users metadata
let usersCache = null;
let usersCacheTs = 0;

async function getPersistedUsers() {
  const now = Date.now();
  if (usersCache && (now - usersCacheTs) < 3000) { // 3s cache
    return usersCache;
  }

  if (!supabase) return memoryStore.users || [];
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('model_id', '__users_metadata__')
      .limit(1);

    if (!error && data && data.length > 0 && data[0].api_key) {
      const parsed = JSON.parse(data[0].api_key);
      if (Array.isArray(parsed)) {
        const userMap = new Map();
        for (const u of parsed) {
          const key = u.email ? u.email.toLowerCase().trim() : String(u._id || u.id);
          userMap.set(key, u);
        }
        const cleanUsers = Array.from(userMap.values());
        memoryStore.users = cleanUsers;
        usersCache = cleanUsers;
        usersCacheTs = now;
        return cleanUsers;
      }
    }
  } catch (e) {}
  return memoryStore.users || [];
}

async function savePersistedUsers(users) {
  const userMap = new Map();
  for (const u of (users || [])) {
    if (u) {
      const key = u.email ? u.email.toLowerCase().trim() : String(u._id || u.id);
      userMap.set(key, u);
    }
  }
  const cleanUsers = Array.from(userMap.values());

  memoryStore.users = cleanUsers;
  usersCache = cleanUsers;
  usersCacheTs = Date.now();

  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('api_keys')
      .upsert({
        model_id: '__users_metadata__',
        api_key: JSON.stringify(cleanUsers),
        updated_at: new Date().toISOString()
      }, { onConflict: 'model_id' });
    if (error) {
      console.error('[Supabase] Failed to persist users:', error.message);
    }
  } catch (e) {
    console.error('[Supabase] Failed to persist users exception:', e.message);
  }
}

let settingsCache = null;
let settingsCacheTs = 0;

async function getSystemSettings() {
  const now = Date.now();
  if (settingsCache && (now - settingsCacheTs) < 10000) {
    return settingsCache;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('api_key')
        .eq('model_id', '__system_settings__')
        .limit(1);

      if (!error && data && data.length > 0 && data[0].api_key) {
        let parsed = null;
        try { parsed = JSON.parse(data[0].api_key); } catch {}
        if (parsed && typeof parsed === 'object') {
          if (!parsed.fallback_models) parsed.fallback_models = ['openai/gpt-oss-120b', 'openrouter/free'];
          settingsCache = parsed;
          settingsCacheTs = now;
          if (!memoryStore.settings) memoryStore.settings = {};
          Object.assign(memoryStore.settings, parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[Supabase] __system_settings__ fetch failed:', e.message);
    }
  }

  const def = memoryStore.settings || { auto_fallback: true, fallback_models: ['openai/gpt-oss-120b', 'openrouter/free'] };
  if (!def.fallback_models) def.fallback_models = ['openai/gpt-oss-120b', 'openrouter/free'];
  settingsCache = def;
  settingsCacheTs = now;
  return def;
}

async function saveSystemSettings(settings) {
  const updated = { auto_fallback: true, fallback_models: ['openai/gpt-oss-120b', 'openrouter/free'], ...(memoryStore.settings || {}), ...settings };
  settingsCache = updated;
  settingsCacheTs = Date.now();
  memoryStore.settings = updated;

  if (!supabase) return updated;

  try {
    const { error } = await supabase
      .from('api_keys')
      .upsert({
        model_id: '__system_settings__',
        api_key: JSON.stringify(updated),
        updated_at: new Date().toISOString()
      }, { onConflict: 'model_id' });
    if (error) {
      console.error('[Supabase] Failed to persist system settings:', error.message);
    }
  } catch (e) {
    console.error('[Supabase] Failed to persist system settings exception:', e.message);
  }
  return updated;
}

module.exports = { 
  getModelConfig, 
  getApiKeyFromSupabase, 
  invalidateModelKeyCache,
  getPersistedModels,
  savePersistedModels,
  getPersistedPlans,
  savePersistedPlans,
  getUserUsage,
  getUserUsageDetails,
  incrementUserUsage,
  getPersistedRedeemCodes,
  savePersistedRedeemCodes,
  getPersistedUsers,
  savePersistedUsers,
  getSystemSettings,
  saveSystemSettings
};

