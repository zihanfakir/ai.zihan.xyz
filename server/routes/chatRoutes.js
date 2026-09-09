const express = require('express');
const router = express.Router();
const { streamChatCompletions, generateImage, saveChatSession, getChatSessions, deleteChatSession } = require('../controllers/chatController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { checkRateLimit } = require('../middleware/rateLimitMiddleware');

router.post('/completions', optionalProtect, checkRateLimit, streamChatCompletions);
router.post('/image', optionalProtect, checkRateLimit, generateImage);
router.post('/sessions', protect, saveChatSession);
router.get('/sessions', protect, getChatSessions);
router.delete('/sessions/:session_id', protect, deleteChatSession);


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
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/ping', async (req, res) => {
  try {
    const { model } = req.query;
    if (!model) {
      return res.status(400).json({ success: false, error: 'মডেলের নাম প্রয়োজন' });
    }

    const { getPersistedModels, getApiKeyFromSupabase } = require('../../utils/getModelConfig');
    let aiModelConfig = null;
    if (getIsMongoConnected()) {
      aiModelConfig = await AiModel.findOne({ $or: [{ model_id: model }, { id: model }] });
    } else {
      const allModels = await getPersistedModels();
      aiModelConfig = allModels.find(m => (m.id === model || m.model_id === model));
    }
    
    if (!aiModelConfig) {
      return res.json({ success: true, latency: null, status: 'offline', error: 'Model not found' });
    }

    let targetUrl = (aiModelConfig.base_url || 'https://openrouter.ai/api/v1/chat/completions').trim();
    let targetKey = aiModelConfig.api_key;
    if (!targetKey) {
      targetKey = await getApiKeyFromSupabase(model);
    }
    if (!targetKey) {
      if (targetUrl.includes('openrouter.ai')) targetKey = process.env.OPENROUTER_API_KEY;
      else if (targetUrl.includes('groq.com')) targetKey = process.env.GROQ_API_KEY;
      else if (targetUrl.includes('b.ai')) targetKey = process.env.BAI_API_KEY;
      else if (targetUrl.includes('vyceai.com')) targetKey = process.env.VYCE_API_KEY;
      else if (targetUrl.includes('googleapis.com')) targetKey = process.env.GEMINI_API_KEY;
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
    if (aiModelConfig.type === 'gemini' || targetUrl.includes('generativelanguage.googleapis.com')) {
      const gKey = targetKey || process.env.GEMINI_API_KEY;
      pingUrl = "https://generativelanguage.googleapis.com/v1beta/models?key=" + gKey;
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
      return res.json({ success: true, latency: null, status: 'offline', error: err.message });
    }

  } catch (err) {
    res.status(500).json({ success: false, latency: null, status: 'offline', error: err.message });
  }
});
module.exports = router;


