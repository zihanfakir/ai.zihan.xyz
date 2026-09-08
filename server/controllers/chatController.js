const fetch = require('node-fetch');
const mongoose = require('mongoose');
const UsageLog = require('../models/UsageLog');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore, debouncedSave } = require('../config/memoryStore');
const AiModel = require('../models/AiModel');
const { getModelConfig, getApiKeyFromSupabase, incrementUserUsage } = require('../../utils/getModelConfig');

const streamChatCompletions = async (req, res) => {
  try {
    const { model, messages } = req.body;
    const user = req.user;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'সঠিক মেসেজ অ্যারে প্রদান করুন' });
    }

    // Sanitize and cap messages array to prevent memory exhaustion
    const safeMessages = messages.slice(-100).filter(m => m && typeof m === 'object' && typeof m.content === 'string');
    if (safeMessages.length === 0) {
      return res.status(400).json({ success: false, error: 'মেসেজের বিবরণ সঠিক নয়' });
    }

    // Load model configuration with API key
    let aiModelConfig = null;
    if (getIsMongoConnected()) {
      aiModelConfig = await AiModel.findOne({ $or: [{ model_id: model }, { id: model }] });
      if (aiModelConfig && !aiModelConfig.api_key) {
        const supabaseConfig = await getModelConfig(model);
        if (supabaseConfig && supabaseConfig.api_key) {
          aiModelConfig = { ...aiModelConfig.toObject(), api_key: supabaseConfig.api_key };
        }
      }
    } else {
      aiModelConfig = await getModelConfig(model);
    }

    let targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
    let targetKey = process.env.OPENROUTER_API_KEY;
    let actualModel = model || 'openrouter/free';

    // 1. Model ID Normalization & Provider Resolution
    if (model === 'openai/gpt-oss-120b' || model === 'llama-3.3-70b-versatile') {
      targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
      actualModel = 'llama-3.3-70b-versatile';
      targetKey = (aiModelConfig && aiModelConfig.api_key) || process.env.GROQ_API_KEY;
    } else if (model === 'gemini-1.5-flash' || model === 'gemini-3.5-flash-lite') {
      targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
      actualModel = 'google/gemini-3.5-flash-lite';
      targetKey = (aiModelConfig && aiModelConfig.api_key) || process.env.OPENROUTER_API_KEY;
    } else if (aiModelConfig && aiModelConfig.base_url) {
      targetUrl = aiModelConfig.base_url;
      if (aiModelConfig.api_key) targetKey = aiModelConfig.api_key;
      actualModel = model;
    }

    // 2. Global Key Fallback from Supabase if not found
    if (!targetKey) {
      targetKey = await getApiKeyFromSupabase(model);
      if (!targetKey && actualModel !== model) {
        targetKey = await getApiKeyFromSupabase(actualModel);
      }
    }

    // 3. Provider Default Key Fallback
    if (!targetKey) {
      if (targetUrl.includes('openrouter.ai')) targetKey = process.env.OPENROUTER_API_KEY;
      else if (targetUrl.includes('groq.com')) targetKey = process.env.GROQ_API_KEY;
      else if (targetUrl.includes('b.ai')) targetKey = process.env.BAI_API_KEY;
      else if (targetUrl.includes('vyceai.com')) targetKey = process.env.VYCE_API_KEY;
    }

    // 4. Provider Fallback for down services
    if (targetUrl.includes('b.ai') || targetUrl.includes('vyceai.com')) {
      targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
      targetKey = (await getApiKeyFromSupabase('llama-3.3-70b-versatile')) || process.env.GROQ_API_KEY;
      actualModel = 'llama-3.3-70b-versatile';
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    let payload = {
      model: actualModel,
      messages: safeMessages,
      max_tokens: 4096,
      stream: true
    };

    let headers = { 'Content-Type': 'application/json' };
    if (targetKey) {
      headers['Authorization'] = `Bearer ${targetKey}`;
    }

    // Abort upstream immediately if client disconnects
    const abortController = new AbortController();
    req.on('close', () => {
      try { abortController.abort(); } catch (e) {}
    });

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: abortController.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      res.write(`data: ${JSON.stringify({ error: `[Server API Error] (${response.status}): ${errText}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    let hasStreamedData = false;

    response.body.on('data', (chunk) => {
      hasStreamedData = true;
      res.write(chunk);
    });

    response.body.on('end', async () => {
      // Record usage log only after stream successfully delivers tokens
      if (hasStreamedData) {
        const userId = user ? String(user._id || user.id) : req.guestId;
        if (userId) {
          if (user && getIsMongoConnected() && mongoose.Types.ObjectId.isValid(userId)) {
            UsageLog.create({
              user_id: userId,
              model_id: model || 'openrouter/free',
              timestamp: new Date()
            }).catch(err => console.error('[UsageLog Write Error]:', err.message));
          } else {
            memoryStore.usageLogs.push({
              _id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              user_id: userId,
              model_id: model || 'openrouter/free',
              timestamp: new Date()
            });
            if (memoryStore.usageLogs.length > 5000) {
              memoryStore.usageLogs = memoryStore.usageLogs.slice(-5000);
            }
            debouncedSave();
            try {
              await incrementUserUsage(userId, req.currentPlan ? req.currentPlan.window_hours : 3);
            } catch (e) {
              console.error('[Increment User Usage Error]:', e.message);
            }
          }
        }
      }
      if (!res.writableEnded) res.end();
    });

    response.body.on('error', (err) => {
      console.error('[Stream Error]:', err.message);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: 'স্ট্রিম সংযোগে সমস্যা হয়েছে।' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    });

  } catch (error) {
    console.error('[Chat Completion Error]:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: 'সার্ভারে চ্যাট সম্পন্ন করতে সমস্যা হয়েছে।' });
    } else if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: 'সার্ভারে সমস্যা হয়েছে।' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
};

const ChatSession = require('../models/ChatSession');

const saveChatSession = async (req, res) => {
  try {
    const { session_id, title, messagesHistory, updatedAt } = req.body;
    const user = req.user;

    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({ success: false, error: 'Session ID required' });
    }

    const cleanTitle = (typeof title === 'string' ? title.trim().slice(0, 100) : 'নতুন চ্যাট') || 'নতুন চ্যাট';
    const cleanHistory = Array.isArray(messagesHistory) ? messagesHistory.slice(-200) : [];

    if (getIsMongoConnected()) {
      await ChatSession.findOneAndUpdate(
        { user_id: user._id, session_id },
        { title: cleanTitle, messagesHistory: cleanHistory, updatedAt: updatedAt || Date.now() },
        { upsert: true, new: true }
      );
    } else {
      if (!memoryStore.chatSessions) memoryStore.chatSessions = [];
      const idx = memoryStore.chatSessions.findIndex(s => s.session_id === session_id && String(s.user_id) === String(user._id));
      const sessionDoc = { user_id: user._id, session_id, title: cleanTitle, messagesHistory: cleanHistory, updatedAt: updatedAt || Date.now() };
      if (idx !== -1) {
        memoryStore.chatSessions[idx] = sessionDoc;
      } else {
        memoryStore.chatSessions.push(sessionDoc);
      }
      debouncedSave();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getChatSessions = async (req, res) => {
  try {
    const user = req.user;
    let sessions = [];
    if (getIsMongoConnected()) {
      sessions = await ChatSession.find({ user_id: user._id }).sort({ updatedAt: -1 });
    } else {
      if (!memoryStore.chatSessions) memoryStore.chatSessions = [];
      sessions = memoryStore.chatSessions.filter(s => String(s.user_id) === String(user._id)).sort((a, b) => b.updatedAt - a.updatedAt);
    }
    res.json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteChatSession = async (req, res) => {
  try {
    const { session_id } = req.params;
    const user = req.user;
    if (getIsMongoConnected()) {
      await ChatSession.findOneAndDelete({ user_id: user._id, session_id });
    } else {
      if (memoryStore.chatSessions) {
        memoryStore.chatSessions = memoryStore.chatSessions.filter(s => !(s.session_id === session_id && String(s.user_id) === String(user._id)));
        debouncedSave();
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const generateImage = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'অনুগ্রহ করে একটি সঠিক প্রম্পট প্রদান করুন।' });
    }

    const targetKey = process.env.VYCE_API_KEY || process.env.OPENROUTER_API_KEY;
    const targetUrl = 'https://vyceai.com/v1/images/generations';

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${targetKey}`
      },
      body: JSON.stringify({ prompt, n: 1, size: '1024x1024' })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Image Gen Upstream Error]:', response.status, errText);
      return res.status(response.status).json({ success: false, error: 'ছবি তৈরি করতে সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।' });
    }

    const data = await response.json();
    const item = data?.data?.[0];
    if (item?.url) {
      return res.json({ success: true, url: item.url });
    } else if (item?.b64_json) {
      return res.json({ success: true, url: `data:image/png;base64,${item.b64_json}` });
    }
    return res.status(500).json({ success: false, error: 'রেসপন্সে কোনো ছবি পাওয়া যায়নি।' });
  } catch (error) {
    console.error('[Image Gen Error]:', error);
    return res.status(500).json({ success: false, error: 'সার্ভারে অভ্যন্তরীণ সমস্যা হয়েছে।' });
  }
};

module.exports = { streamChatCompletions, generateImage, saveChatSession, getChatSessions, deleteChatSession };


