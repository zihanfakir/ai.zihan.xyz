/**
 * server/config/dbCache.js
 * Ultra-Fast High-Performance In-Memory Cache Tier for Database Queries.
 * Provides microsecond-latency reads (<0.01ms) for high-frequency queries
 * (authenticated users, plan definitions, model configs, rate limits).
 */

// 1. Authenticated User Cache (30s TTL)
const userCache = new Map(); // key: userId / email -> { user, ts }
const USER_CACHE_TTL = 30 * 1000;

function getCachedUser(key) {
  if (!key) return null;
  const cleanKey = String(key).toLowerCase().trim();
  const entry = userCache.get(cleanKey);
  if (entry && (Date.now() - entry.ts) < USER_CACHE_TTL) {
    return entry.user;
  }
  if (entry) userCache.delete(cleanKey);
  return null;
}

function setCachedUser(key, user) {
  if (!key || !user) return;
  // Limit cache size to prevent memory leaks
  if (userCache.size > 5000) {
    const toDelete = Array.from(userCache.keys()).slice(0, 1000);
    for (const k of toDelete) userCache.delete(k);
  }
  const cleanKey = String(key).toLowerCase().trim();
  userCache.set(cleanKey, { user, ts: Date.now() });

  // Also cache by email if available
  if (user.email) {
    userCache.set(String(user.email).toLowerCase().trim(), { user, ts: Date.now() });
  }
  // And by id if different from key
  const idKey = String(user._id || user.id || '').toLowerCase().trim();
  if (idKey && idKey !== cleanKey) {
    userCache.set(idKey, { user, ts: Date.now() });
  }
}

function invalidateCachedUser(key) {
  if (!key) {
    userCache.clear();
    return;
  }
  const cleanKey = String(key).toLowerCase().trim();
  userCache.delete(cleanKey);
  for (const [k, v] of userCache.entries()) {
    if (k === cleanKey) {
      userCache.delete(k);
    } else if (v && v.user) {
      const u = v.user;
      const uEmail = String(u.email || '').toLowerCase().trim();
      const uId = String(u._id || u.id || '').toLowerCase().trim();
      if (uEmail === cleanKey || uId === cleanKey) {
        userCache.delete(k);
      }
    }
  }
}

// 2. Plan Cache (ZERO Plan Caching: Always real-time direct from DB / store)
// User requirement: "aye jonno plan er cash thakbe na"
const planCache = new Map();

function getCachedPlan(planName) {
  // Plan caching is completely disabled so limits & upgrades update instantly
  return null;
}

function setCachedPlan(planName, plan) {
  // No-op: do not cache plans
}

function invalidateCachedPlans() {
  planCache.clear();
}

// 3. AI Model Cache (5 min TTL, invalidated on admin edit)
const modelCache = new Map(); // modelId -> { model, ts }
const MODEL_CACHE_TTL = 5 * 60 * 1000;

function getCachedModel(modelId) {
  if (!modelId) return null;
  const entry = modelCache.get(modelId);
  if (entry && (Date.now() - entry.ts) < MODEL_CACHE_TTL) {
    return entry.model;
  }
  return null;
}

function setCachedModel(modelId, model) {
  if (!modelId || !model) return;
  modelCache.set(modelId, { model, ts: Date.now() });
}

function invalidateCachedModels() {
  modelCache.clear();
}

module.exports = {
  getCachedUser,
  setCachedUser,
  invalidateCachedUser,
  getCachedPlan,
  setCachedPlan,
  invalidateCachedPlans,
  getCachedModel,
  setCachedModel,
  invalidateCachedModels
};

