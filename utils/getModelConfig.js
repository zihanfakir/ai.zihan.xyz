// utils/getModelConfig.js
// Supabase থেকে api_key নিয়ে আসে। পাওয়া না গেলে memoryStore fallback।
const supabase = require('../server/config/supabase');
const { memoryStore, debouncedSave } = require('../server/config/memoryStore');

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
  'gemini-1.5-flash': 'gemini-3.5-flash-lite'
};

function resolveModelAlias(rawId) {
  if (!rawId || typeof rawId !== 'string') return rawId;
  let current = rawId;
  let depth = 0;
  while (MODEL_ALIASES[current] && depth < 3) {
    current = MODEL_ALIASES[current];
    depth++;
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

function invalidateModelsCache() {
  modelsCache = null;
  modelsCacheTs = 0;
}

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
        if (Array.isArray(parsed)) {
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
  debouncedSave();

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
  const now = Date.now();
  const windowStart = now - windowMs;
  let count = 0;
  let start = now;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('api_keys')
        .select('api_key')
        .eq('model_id', '__usage_' + userId + '__')
        .limit(1);

      if (data && data.length > 0 && data[0].api_key) {
        const usage = JSON.parse(data[0].api_key);
        if (now - usage.start < windowMs) {
          count = usage.count || 0;
          start = usage.start;
        }
      }
    } catch (e) {}
  }

  // Also check memoryStore to get true count
  const memLogs = (memoryStore.usageLogs || []).filter(l => String(l.user_id) === String(userId) && new Date(l.timestamp).getTime() >= windowStart);
  if (memLogs.length > count) {
    count = memLogs.length;
    start = memLogs.length > 0 ? Math.min(...memLogs.map(l => new Date(l.timestamp).getTime())) : now;
  }

  const remainingMs = Math.max(0, (start + windowMs) - now);
  return {
    count,
    resetInMinutes: Math.max(1, Math.ceil(remainingMs / 60000)),
    resetAt: new Date(start + windowMs).toISOString(),
    start
  };
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

function invalidatePlansCache() {
  plansCache = null;
  plansCacheTs = 0;
}

async function getPersistedPlans() {
  const now = Date.now();
  if (plansCache && (now - plansCacheTs) < 10000) {
    return plansCache;
  }

  const defaultPlans = [
    { name: 'Free', displayName: 'ফ্রি প্ল্যান', message_limit: 10, window_hours: 3, allowed_models: ['gemini-3.6-flash', 'llama-3.3-70b-versatile', 'qwen/qwen3.8-27b', 'gemini-3.5-flash-lite', 'openrouter/free', 'mimo-v2.5', 'hy3'], is_active: true },
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
  debouncedSave();

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

// Cache for redeem codes metadata
let redeemCodesCache = null;
let redeemCodesCacheTs = 0;

function invalidateRedeemCodesCache() {
  redeemCodesCache = null;
  redeemCodesCacheTs = 0;
}

async function getPersistedRedeemCodes() {
  const now = Date.now();
  if (redeemCodesCache && (now - redeemCodesCacheTs) < 5000) { // 5s cache
    return redeemCodesCache;
  }

  if (!supabase) return memoryStore.redeemCodes || [];
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('model_id', '__redeem_codes_metadata__')
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
        redeemCodesCache = cleanCodes;
        redeemCodesCacheTs = now;
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
  redeemCodesCache = cleanCodes;
  redeemCodesCacheTs = Date.now();
  debouncedSave();

  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('api_keys')
      .upsert({
        model_id: '__redeem_codes_metadata__',
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

function invalidateUsersCache() {
  usersCache = null;
  usersCacheTs = 0;
}

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
  debouncedSave();

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

  const defaultSettings = {};

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
          const merged = { ...defaultSettings, ...parsed };
          settingsCache = merged;
          settingsCacheTs = now;
          if (!memoryStore.settings) memoryStore.settings = {};
          Object.assign(memoryStore.settings, merged);
          return merged;
        }
      }
    } catch (e) {
      console.warn('[Supabase] __system_settings__ fetch failed:', e.message);
    }
  }

  const def = { ...defaultSettings, ...(memoryStore.settings || {}) };
  settingsCache = def;
  settingsCacheTs = now;
  return def;
}

async function saveSystemSettings(settings) {
  const updated = { ...(memoryStore.settings || {}), ...settings };
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

/**
 * Automatically purges all orphaned caches, dangling references, and ghost keys
 * across MongoDB, Supabase, memoryStore, and disk backup whenever any admin delete occurs.
 */
async function autoPurgeOrphanedDatabaseCaches() {
  const { saveBackup } = require('../server/config/memoryStore');

  // 1. Invalidate all memory caches immediately
  modelsCache = null;
  modelsCacheTs = 0;
  usersCache = null;
  usersCacheTs = 0;
  redeemCodesCache = null;
  redeemCodesCacheTs = 0;
  plansCache = null;
  plansCacheTs = 0;
  settingsCache = null;
  settingsCacheTs = 0;
  keyCache.clear();

  // 2. Clean plans allowed_models referencing non-existent models
  try {
    const currentModels = await getPersistedModels();
    const validModelIds = new Set(currentModels.map(m => String(m.id || m.model_id || '').toLowerCase().trim()));

    // Clean plans allowed_models
    const plans = await getPersistedPlans();
    let plansChanged = false;
    plans.forEach(p => {
      if (Array.isArray(p.allowed_models)) {
        const origLen = p.allowed_models.length;
        p.allowed_models = p.allowed_models.filter(m => {
          if (m === '*') return true;
          return validModelIds.has(String(m || '').toLowerCase().trim());
        });
        if (p.allowed_models.length !== origLen) plansChanged = true;
      }
    });
    if (plansChanged) {
      await savePersistedPlans(plans);
    }
  } catch (e) {
    console.warn('[AutoPurge] Model reference cleanup warning:', e.message);
  }

  // 3. Clean orphaned redeem code references for deleted users
  try {
    const currentUsers = await getPersistedUsers();
    const validUserIds = new Set(currentUsers.map(u => String(u._id || u.id)));
    const validEmails = new Set(currentUsers.filter(u => u.email).map(u => u.email.toLowerCase().trim()));

    const codes = await getPersistedRedeemCodes();
    let codesChanged = false;
    codes.forEach(c => {
      if (c.used_by && !validUserIds.has(String(c.used_by)) && !validEmails.has(String(c.used_by).toLowerCase().trim())) {
        c.used_by = null;
        c.is_used = false;
        c.used_at = null;
        codesChanged = true;
      }
      if (Array.isArray(c.used_by_list)) {
        const origLen = c.used_by_list.length;
        c.used_by_list = c.used_by_list.filter(item => {
          const uId = String(item.user_id || '');
          const email = item.email ? item.email.toLowerCase().trim() : '';
          return validUserIds.has(uId) || (email && validEmails.has(email));
        });
        if (c.used_by_list.length !== origLen) {
          c.use_count = c.used_by_list.length;
          c.is_used = c.use_count >= (c.max_uses || 1);
          codesChanged = true;
        }
      }
    });
    if (codesChanged) {
      await savePersistedRedeemCodes(codes);
    }
  } catch (e) {
    console.warn('[AutoPurge] Redeem code cleanup warning:', e.message);
  }

  // 4. Purge orphaned usage rows from Supabase
  if (supabase) {
    try {
      const currentUsers = await getPersistedUsers();
      const validUserIds = new Set(currentUsers.map(u => String(u._id || u.id)));
      const { data: usageRows } = await supabase
        .from('api_keys')
        .select('model_id')
        .like('model_id', '__usage_%');
      if (usageRows && usageRows.length > 0) {
        for (const row of usageRows) {
          const uId = row.model_id.replace(/^__usage_/, '').replace(/__$/, '');
          if (!validUserIds.has(uId)) {
            await supabase.from('api_keys').delete().eq('model_id', row.model_id);
          }
        }
      }
    } catch (e) {
      console.warn('[AutoPurge] Usage row cleanup warning:', e.message);
    }
  }

  // 5. Purge orphaned individual model API key rows from Supabase
  if (supabase) {
    try {
      const currentModels = await getPersistedModels();
      const validModelIds = new Set(currentModels.map(m => String(m.id || m.model_id || '')));
      const { data: allRows } = await supabase.from('api_keys').select('model_id');
      if (allRows && allRows.length > 0) {
        for (const row of allRows) {
          // Skip metadata rows (prefixed with __)
          if (row.model_id.startsWith('__')) continue;
          // If this model_id is not in the active models list, it's orphaned
          if (!validModelIds.has(row.model_id)) {
            await supabase.from('api_keys').delete().eq('model_id', row.model_id);
            console.log(`[AutoPurge] Deleted orphaned API key row: ${row.model_id}`);
          }
        }
      }
    } catch (e) {
      console.warn('[AutoPurge] Orphaned API key cleanup warning:', e.message);
    }
  }

  // 6. Synchronous flush to local backup
  saveBackup();
}

module.exports = { 
  getModelConfig, 
  getApiKeyFromSupabase, 
  invalidateModelKeyCache,
  getPersistedModels,
  savePersistedModels,
  invalidateModelsCache,
  getPersistedPlans,
  savePersistedPlans,
  invalidatePlansCache,
  getUserUsage,
  getUserUsageDetails,
  incrementUserUsage,
  getPersistedRedeemCodes,
  savePersistedRedeemCodes,
  invalidateRedeemCodesCache,
  getPersistedUsers,
  savePersistedUsers,
  invalidateUsersCache,
  getSystemSettings,
  saveSystemSettings,
  autoPurgeOrphanedDatabaseCaches
};

