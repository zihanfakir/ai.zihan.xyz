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

router.get('/ping', async (req, res) => {
  try {
    const { model } = req.query;
    if (!model || typeof model !== 'string' || !model.trim()) {
      return res.status(400).json({ success: false, error: 'মডেলের নাম প্রয়োজন' });
    }
    const cleanModel = model.trim();

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
      return res.json({ success: true, latency: null, status: 'offline' });
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
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const pingRes = await fetch(pingUrl, {
        method,
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const ms = Math.round(performance.now() - start);
      if (pingRes.ok) {
         return res.json({ success: true, latency: ms, status: 'online' }); 
      } else {
         return res.json({ success: true, latency: null, status: 'offline' }); 
      }
    } catch(err) {
      clearTimeout(timeoutId);
      return res.json({ success: true, latency: null, status: 'offline' });
    }

  } catch (err) {
    res.status(500).json({ success: false, latency: null, status: 'offline' });
  }
});
module.exports = router;


