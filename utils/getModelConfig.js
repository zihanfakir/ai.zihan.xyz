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
  'openai/gpt-oss-120b': 'llama-3.3-70b-versatile',
  'gemini-3.5-flash-lite': 'gemini-1.5-flash',
  'gemini-1.5-flash': 'gemini-3.5-flash-lite'
};

async function getModelConfig(rawId) {
  const modelId = MODEL_ALIASES[rawId] || rawId;

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
    return { ...model, api_key: apiKey || model.api_key || null };
  }

  if (apiKey) {
    return { id: rawId, model_id: rawId, api_key: apiKey };
  }

  return null;
}


function invalidateModelKeyCache(modelId) {
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
        .single();

      if (!error && data && data.api_key) {
        const parsed = JSON.parse(data.api_key);
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
    await supabase
      .from('api_keys')
      .upsert(
        { model_id: '__models_metadata__', api_key: JSON.stringify(models), updated_at: new Date().toISOString() },
        { onConflict: 'model_id' }
      );
  } catch (e) {
    console.error('[Supabase] Failed to persist models:', e.message);
  }
}

module.exports = { 
  getModelConfig, 
  getApiKeyFromSupabase, 
  invalidateModelKeyCache,
  getPersistedModels,
  savePersistedModels
};
