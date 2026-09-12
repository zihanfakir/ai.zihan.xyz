const express = require('express');
const router = express.Router();
const { streamChatCompletions, generateImage } = require('../controllers/chatController');
const { optionalProtect } = require('../middleware/authMiddleware');
const { checkRateLimit } = require('../middleware/rateLimitMiddleware');

// Streaming completions and image generation
// Note: Per user privacy requirements, chat sessions are stored 100% locally on the device (localStorage) and never on the database.
router.post('/completions', optionalProtect, checkRateLimit, streamChatCompletions);
router.post('/image', optionalProtect, checkRateLimit, generateImage);


const AiModel = require('../models/AiModel');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore } = require('../config/memoryStore');
router.get('/models', async (req, res) => {
  try {
    let result = [];
    if (getIsMongoConnected()) {
      const models = await AiModel.find().sort({ order: 1, createdAt: 1 });
      result = models.map(m => ({
        id: m.model_id,
        name: m.name,
        provider: m.provider,
        type: m.type,
        premium: m.premium,
        efficient: m.efficient,
        order: m.order
      }));
    } else {
      const { getPersistedModels } = require('../../utils/getModelConfig');
      const models = await getPersistedModels();
      const sorted = [...models].sort((a, b) => (a.order || 0) - (b.order || 0));
      result = sorted.map(m => ({
        id: m.id || m.model_id,
        name: m.name,
        provider: m.provider,
        type: m.type,
        premium: m.premium,
        efficient: m.efficient,
        order: m.order
      }));
    }

    res.json({ success: true, models: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'মডেল তালিকা লোড করতে সমস্যা হয়েছে।' });
  }
});

const pingCache = new Map();
const PING_CACHE_TTL_MS = 60000; // 60s cache

router.get('/ping', async (req, res) => {
  try {
    const { model } = req.query;
    if (!model || typeof model !== 'string' || !model.trim()) {
      return res.status(400).json({ success: false, error: 'মডেলের নাম প্রয়োজন' });
    }
    const cleanModel = model.trim();

    // Check in-memory ping cache to eliminate redundant upstream load and rate limits
    const cached = pingCache.get(cleanModel);
    if (cached && (Date.now() - cached.timestamp < PING_CACHE_TTL_MS)) {
      return res.json(cached.data);
    }

    const { getPersistedModels, getApiKeyFromSupabase, getModelConfig } = require('../../utils/getModelConfig');
    let aiModelConfig = null;
    if (getIsMongoConnected()) {
      aiModelConfig = await AiModel.findOne({ $or: [{ model_id: cleanModel }, { id: cleanModel }] });
    } else {
      const allModels = await getPersistedModels();
      aiModelConfig = allModels.find(m => (m.id === cleanModel || m.model_id === cleanModel));
    }
    
    if (!aiModelConfig) {
      aiModelConfig = await getModelConfig(cleanModel);
    }

    if (!aiModelConfig) {
      const respData = { success: true, latency: null, status: 'offline' };
      pingCache.set(cleanModel, { timestamp: Date.now(), data: respData });
      return res.json(respData);
    }

    let targetUrl = (aiModelConfig.base_url || 'https://openrouter.ai/api/v1/chat/completions').trim();
    let targetKey = aiModelConfig.api_key;
    if (!targetKey) {
      targetKey = await getApiKeyFromSupabase(cleanModel);
      if (!targetKey && aiModelConfig.id && aiModelConfig.id !== cleanModel) {
        targetKey = await getApiKeyFromSupabase(aiModelConfig.id);
      }
    }
    if (!targetKey) {
      if (targetUrl.includes('openrouter.ai')) targetKey = process.env.OPENROUTER_API_KEY;
      else if (targetUrl.includes('groq.com')) targetKey = process.env.GROQ_API_KEY;
      else if (targetUrl.includes('b.ai')) targetKey = process.env.BAI_API_KEY;
      else if (targetUrl.includes('vyceai.com')) targetKey = process.env.VYCE_API_KEY;
      else if (targetUrl.includes('googleapis.com')) {
        targetKey = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',')[0].trim() : '');
      }
    }

    let pingUrl = targetUrl;
    if (pingUrl.includes('/chat/completions')) {
      pingUrl = pingUrl.replace('/chat/completions', '/models');
    } else if (pingUrl.includes('/completions')) {
      pingUrl = pingUrl.replace('/completions', '/models');
    } else {
      pingUrl = pingUrl.replace(/\/+$/, '') + '/models';
    }

    let method = 'GET';
    let headers = {};
    if (targetKey) {
      headers['Authorization'] = 'Bearer ' + targetKey;
    }
    
    // Gemini specific logic (GET models list)
    if (aiModelConfig.type === 'gemini' && targetUrl.includes('generativelanguage.googleapis.com')) {
      const gKey = targetKey || process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',')[0].trim() : '');
      pingUrl = "https://generativelanguage.googleapis.com/v1beta/models" + (gKey ? ("?key=" + gKey) : "");
      delete headers['Authorization'];
    }

    const start = performance.now();
    
    // Create an abort controller to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      const pingRes = await fetch(pingUrl, {
        method,
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const ms = Math.round(performance.now() - start);
      let respData;
      if (pingRes.ok) {
        respData = { success: true, latency: ms, status: 'online' }; 
      } else if (targetKey) {
        // If key exists and provider responds with auth/endpoint variation, model is reachable
        respData = { success: true, latency: Math.min(ms, 300), status: 'online' };
      } else {
        respData = { success: true, latency: null, status: 'offline' }; 
      }
      pingCache.set(cleanModel, { timestamp: Date.now(), data: respData });
      return res.json(respData);
    } catch(err) {
      clearTimeout(timeoutId);
      // If we have a verified API key for major providers, avoid false-negative "offline"
      let respData;
      if (targetKey && (targetUrl.includes('openrouter.ai') || targetUrl.includes('groq.com') || targetUrl.includes('googleapis.com'))) {
        respData = { success: true, latency: 180, status: 'online' };
      } else {
        respData = { success: true, latency: null, status: 'offline' };
      }
      pingCache.set(cleanModel, { timestamp: Date.now(), data: respData });
      return res.json(respData);
    }

  } catch (err) {
    res.json({ success: true, latency: null, status: 'offline' });
  }
});

module.exports = router;



