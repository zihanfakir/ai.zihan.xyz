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

async function getModelConfig(modelId) {
  // memoryStore থেকে বেস কনফিগ নেওয়া (api_key ছাড়া)
  const model = memoryStore.models.find(
    m => m.id === modelId || m.model_id === modelId
  );

  // Supabase থেকে api_key লোড করা
  const apiKey = await getApiKeyFromSupabase(modelId);

  if (model) {
    // একটি নতুন অবজেক্ট রিটার্ন করি (মেমোরি মডিফাই না করে)
    return { ...model, api_key: apiKey || model.api_key || null };
  }

  // মেমোরিতে মডেল না থাকলে শুধু api_key সহ বেসিক অবজেক্ট
  if (apiKey) {
    return { id: modelId, model_id: modelId, api_key: apiKey };
  }

  return null;
}

// Cache invalidate (admin আপডেটের পরে ব্যবহার করা হবে)
function invalidateModelKeyCache(modelId) {
  if (modelId) {
    keyCache.delete(modelId);
  } else {
    keyCache.clear();
  }
}

module.exports = { getModelConfig, getApiKeyFromSupabase, invalidateModelKeyCache };
