const express = require('express');
const router = express.Router();
const { streamChatCompletions, generateImage, saveChatSession, getChatSessions, deleteChatSession } = require('../controllers/chatController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { checkRateLimit } = require('../middleware/rateLimitMiddleware');

router.post('/completions', optionalProtect, checkRateLimit, streamChatCompletions);
router.post('/image', optionalProtect, generateImage);
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
      const sorted = [...memoryStore.models].sort((a, b) => (a.order || 0) - (b.order || 0));
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
    let aiModelConfig = null;
    if (getIsMongoConnected()) {
      aiModelConfig = await AiModel.findOne({ model_id: model });
    } else {
      aiModelConfig = memoryStore.models.find(m => (m.id === model || m.model_id === model));
    }
    
    if (!aiModelConfig) return res.status(404).json({ success: false });

    let targetUrl = aiModelConfig.base_url || 'https://openrouter.ai/api/v1/chat/completions';
    let targetKey = aiModelConfig.api_key;
    if (!targetKey) {
      if (targetUrl.includes('openrouter.ai')) targetKey = process.env.OPENROUTER_API_KEY;
      else if (targetUrl.includes('groq.com')) targetKey = process.env.GROQ_API_KEY;
      else if (targetUrl.includes('b.ai')) targetKey = process.env.BAI_API_KEY;
      else if (targetUrl.includes('vyceai.com')) targetKey = process.env.VYCE_API_KEY;
      else targetKey = process.env.OPENROUTER_API_KEY;
    }

    let pingUrl = targetUrl.replace('/chat/completions', '/models');
    let method = 'GET';
    let headers = {
      'Authorization': 'Bearer ' + targetKey
    };
    
    // Gemini specific logic (GET models list)
    if (aiModelConfig.type === 'gemini') {
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
         const errorText = await pingRes.text();
         console.log(`[Ping] Model ${model} returned error: ${pingRes.status} ${errorText}`);
         return res.json({ success: true, latency: ms, status: 'offline' }); 
      }
    } catch(err) {
      clearTimeout(timeoutId);
      return res.json({ success: false, error: err.message });
    }

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
module.exports = router;


