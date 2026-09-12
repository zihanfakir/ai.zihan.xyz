const fetch = require('node-fetch');
const mongoose = require('mongoose');
const UsageLog = require('../models/UsageLog');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore, debouncedSave } = require('../config/memoryStore');
const AiModel = require('../models/AiModel');
const { getModelConfig, getApiKeyFromSupabase, incrementUserUsage, getSystemSettings } = require('../../utils/getModelConfig');

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
      actualModel = 'openai/gpt-oss-120b';
      targetKey = (aiModelConfig && aiModelConfig.api_key) || process.env.GROQ_API_KEY;
    } else if (model === 'gemini-1.5-flash' || model === 'gemini-3.5-flash-lite') {
      targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
      actualModel = 'google/gemini-2.5-flash';
      targetKey = (aiModelConfig && aiModelConfig.api_key) || process.env.OPENROUTER_API_KEY;
    } else if (model === 'deepseek-v4-flash' || model === 'deepseek-v4-flash-vision-exp') {
      targetUrl = 'https://vyceai.com/v1/chat/completions';
      actualModel = model === 'deepseek-v4-flash-vision-exp' ? 'deepseek-v4-flash-lr' : 'deepseek-v4-flash';
      targetKey = (aiModelConfig && aiModelConfig.api_key) || process.env.VYCE_API_KEY;
    } else if (model === 'gpt-5.6') {
      targetUrl = 'https://vyceai.com/v1/chat/completions';
      actualModel = 'gpt-5.6-new';
      targetKey = (aiModelConfig && aiModelConfig.api_key) || process.env.VYCE_API_KEY;
    } else if (aiModelConfig && aiModelConfig.base_url) {
      let bUrl = aiModelConfig.base_url.trim();
      if (!bUrl.endsWith('/chat/completions') && !bUrl.endsWith('/completions')) {
        bUrl = bUrl.replace(/\/+$/, '') + '/chat/completions';
      }
      targetUrl = bUrl;
      if (aiModelConfig.api_key) targetKey = aiModelConfig.api_key;
      actualModel = aiModelConfig.id || model;
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

    // Abort upstream immediately if client disconnects
    const abortController = new AbortController();
    req.on('close', () => {
      try { abortController.abort(); } catch (e) {}
    });

    // Helper to attempt completion fetch with timeout
    const tryFetchCompletion = async (url, key, modName, timeoutMs = 12000) => {
      const fetchController = new AbortController();
      const timeoutId = setTimeout(() => fetchController.abort(), timeoutMs);

      const onClientAbort = () => { try { fetchController.abort(); } catch (e) {} };
      abortController.signal.addEventListener('abort', onClientAbort);

      try {
        const h = { 'Content-Type': 'application/json' };
        if (key) h['Authorization'] = `Bearer ${key}`;

        const p = {
          model: modName,
          messages: safeMessages,
          max_tokens: 4096,
          stream: true
        };

        const r = await fetch(url, {
          method: 'POST',
          headers: h,
          body: JSON.stringify(p),
          signal: fetchController.signal
        });
        clearTimeout(timeoutId);
        abortController.signal.removeEventListener('abort', onClientAbort);
        return r;
      } catch (err) {
        clearTimeout(timeoutId);
        abortController.signal.removeEventListener('abort', onClientAbort);
        console.warn(`[Fetch Attempt Error] ${url} (${modName}):`, err.message);
        return null;
      }
    };

    let response = await tryFetchCompletion(targetUrl, targetKey, actualModel);

    // 4. Intelligent Pre-Stream Fallback: Check if Auto Fallback is enabled
    const sysSettings = await getSystemSettings().catch(() => ({ auto_fallback: true }));
    const isAutoFallback = sysSettings ? sysSettings.auto_fallback !== false : true;

    if ((!response || !response.ok) && isAutoFallback) {
      if (response) {
        try {
          const errBody = await response.text();
          console.warn(`[Primary Upstream Failed] Status ${response.status} for ${actualModel} at ${targetUrl}:`, errBody.slice(0, 200));
        } catch {}
      }

      // Step 4a: Fallback to Groq openai/gpt-oss-120b
      if (!targetUrl.includes('groq.com')) {
        console.log(`[Chat Fallback] Trying Groq openai/gpt-oss-120b for ${model}...`);
        const groqKey = (await getApiKeyFromSupabase('openai/gpt-oss-120b')) || process.env.GROQ_API_KEY;
        response = await tryFetchCompletion('https://api.groq.com/openai/v1/chat/completions', groqKey, 'openai/gpt-oss-120b', 10000);
      }

      // Step 4b: Fallback to OpenRouter google/gemini-2.5-flash
      if ((!response || !response.ok) && actualModel !== 'google/gemini-2.5-flash') {
        console.log(`[Chat Fallback] Trying OpenRouter google/gemini-2.5-flash for ${model}...`);
        const orKey = (await getApiKeyFromSupabase('openrouter/free')) || process.env.OPENROUTER_API_KEY;
        response = await tryFetchCompletion('https://openrouter.ai/api/v1/chat/completions', orKey, 'google/gemini-2.5-flash', 10000);
      }

      // Step 4c: Fallback to OpenRouter openrouter/free
      if ((!response || !response.ok) && actualModel !== 'openrouter/free') {
        console.log(`[Chat Fallback] Trying OpenRouter openrouter/free for ${model}...`);
        const orKey = (await getApiKeyFromSupabase('openrouter/free')) || process.env.OPENROUTER_API_KEY;
        response = await tryFetchCompletion('https://openrouter.ai/api/v1/chat/completions', orKey, 'openrouter/free', 10000);
      }
    } else if (!response || !response.ok) {
      console.log(`[Chat Fallback] Auto Fallback is disabled by Admin. Returning upstream error directly for ${model}.`);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    if (!response || !response.ok) {
      const status = response ? response.status : 500;
      let userSafeError = 'সার্ভার থেকে কোনো উত্তর পাওয়া যায়নি। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।';
      if (status === 429) {
        userSafeError = 'মেসেজ পাঠানোর সীমা শেষ হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।';
      } else if (status === 401 || status === 403) {
        userSafeError = 'এই মডেল ব্যবহারের জন্য অনুমোদন প্রয়োজন।';
      }
      res.write(`data: ${JSON.stringify({ error: userSafeError })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    let hasStreamedData = false;

    response.body.on('data', (chunk) => {
      hasStreamedData = true;
      res.write(chunk);
    });

    response.body.on('end', async () => {
      try {
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
      } catch (streamErr) {
        console.error('[Stream End Callback Error]:', streamErr.message);
      } finally {
        if (!res.writableEnded) res.end();
      }
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

    if (!session_id || typeof session_id !== 'string' || !session_id.trim()) {
      return res.status(400).json({ success: false, error: 'সঠিক Session ID প্রদান করুন' });
    }

    const cleanTitle = (typeof title === 'string' ? title.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 100) : 'নতুন চ্যাট') || 'নতুন চ্যাট';
    const cleanHistory = Array.isArray(messagesHistory) ? messagesHistory.slice(-100).map(m => {
      if (m && typeof m === 'object') {
        const item = { role: m.role || 'user', content: typeof m.content === 'string' ? m.content : '' };
        if (m.images && Array.isArray(m.images)) {
          item.images = m.images.map(img => ({
            mimeType: img.mimeType || 'image/png',
            base64: (img.base64 && img.base64.length > 5000) ? '' : (img.base64 || '')
          }));
        }
        if (m.files && Array.isArray(m.files)) {
          item.files = m.files.map(f => ({ name: f.name || 'file' }));
        }
        return item;
      }
      return null;
    }).filter(Boolean) : [];

    const validUpdatedAt = (updatedAt && !isNaN(new Date(updatedAt).getTime())) ? new Date(updatedAt).getTime() : Date.now();
    const userId = String(user._id || user.id);

    if (getIsMongoConnected()) {
      await ChatSession.findOneAndUpdate(
        { user_id: userId, session_id: session_id.trim() },
        { title: cleanTitle, messagesHistory: cleanHistory, updatedAt: validUpdatedAt },
        { upsert: true, new: true }
      );
    } else {
      if (!memoryStore.chatSessions) memoryStore.chatSessions = [];
      const trimmedSid = session_id.trim();
      const idx = memoryStore.chatSessions.findIndex(s => s.session_id === trimmedSid && String(s.user_id) === userId);
      const sessionDoc = { user_id: userId, session_id: trimmedSid, title: cleanTitle, messagesHistory: cleanHistory, updatedAt: validUpdatedAt };
      if (idx !== -1) {
        memoryStore.chatSessions[idx] = sessionDoc;
      } else {
        memoryStore.chatSessions.push(sessionDoc);
      }
      debouncedSave();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'চ্যাট সেশন সেভ করতে সমস্যা হয়েছে।' });
  }
};

const getChatSessions = async (req, res) => {
  try {
    const user = req.user;
    const userId = String(user._id || user.id);
    let sessions = [];
    if (getIsMongoConnected()) {
      sessions = await ChatSession.find({ user_id: userId }).sort({ updatedAt: -1 });
    } else {
      if (!memoryStore.chatSessions) memoryStore.chatSessions = [];
      sessions = memoryStore.chatSessions
        .filter(s => String(s.user_id) === userId)
        .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    }
    res.json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: 'চ্যাট সেশন লোড করতে সমস্যা হয়েছে।' });
  }
};

const deleteChatSession = async (req, res) => {
  try {
    const { session_id } = req.params;
    if (!session_id || typeof session_id !== 'string' || !session_id.trim()) {
      return res.status(400).json({ success: false, error: 'সঠিক Session ID প্রদান করুন' });
    }
    const cleanSessionId = session_id.trim();
    const user = req.user;
    const userId = String(user._id || user.id);
    if (getIsMongoConnected()) {
      await ChatSession.findOneAndDelete({ user_id: userId, session_id: cleanSessionId });
    } else {
      if (memoryStore.chatSessions) {
        memoryStore.chatSessions = memoryStore.chatSessions.filter(s => !(s.session_id === cleanSessionId && String(s.user_id) === userId));
        debouncedSave();
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'চ্যাট সেশন মুছতে সমস্যা হয়েছে।' });
  }
};

const generateImage = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'অনুগ্রহ করে একটি সঠিক প্রম্পট প্রদান করুন।' });
    }

    const cleanPrompt = prompt.trim().slice(0, 1000);
    const targetKey = process.env.VYCE_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!targetKey) {
      return res.status(503).json({ success: false, error: 'ছবি তৈরির সার্ভিস এই মুহূর্তে কনফিগার করা হয়নি।' });
    }

    const targetUrl = 'https://vyceai.com/v1/images/generations';

    const imgAbortController = new AbortController();
    const imgTimeout = setTimeout(() => imgAbortController.abort(), 35000);

    let response;
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${targetKey}`
        },
        body: JSON.stringify({ prompt: cleanPrompt, n: 1, size: '1024x1024' }),
        signal: imgAbortController.signal
      });
    } catch (fetchErr) {
      clearTimeout(imgTimeout);
      if (fetchErr.name === 'AbortError') {
        return res.status(504).json({ success: false, error: 'ছবি তৈরিতে অতিরিক্ত সময় লেগেছে, অনুগ্রহ করে আবার চেষ্টা করুন।' });
      }
      throw fetchErr;
    }
    clearTimeout(imgTimeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[Image Gen Upstream Error]:', response.status, errText.slice(0, 200));
      return res.status(response.status).json({ success: false, error: 'ছবি তৈরি করতে সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।' });
    }

    const data = await response.json().catch(() => null);
    const item = data?.data?.[0];
    if (item?.url || item?.b64_json) {
      // Record usage log for image generation
      const userId = req.user ? String(req.user._id || req.user.id) : (req.guestId ? String(req.guestId) : null);
      if (userId) {
        if (req.user && getIsMongoConnected() && mongoose.Types.ObjectId.isValid(userId)) {
          UsageLog.create({
            user_id: userId,
            model_id: 'image-generation',
            timestamp: new Date()
          }).catch(() => {});
        } else {
          memoryStore.usageLogs.push({
            _id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            user_id: userId,
            model_id: 'image-generation',
            timestamp: new Date()
          });
          if (memoryStore.usageLogs.length > 5000) {
            memoryStore.usageLogs = memoryStore.usageLogs.slice(-5000);
          }
          debouncedSave();
          try {
            await incrementUserUsage(userId, req.currentPlan ? req.currentPlan.window_hours : 3);
          } catch (e) {}
        }
      }

      if (item?.url) {
        return res.json({ success: true, url: item.url });
      } else {
        return res.json({ success: true, url: `data:image/png;base64,${item.b64_json}` });
      }
    }
    return res.status(500).json({ success: false, error: 'রেসপন্সে কোনো ছবি পাওয়া যায়নি।' });
  } catch (error) {
    console.error('[Image Gen Error]:', error.message);
    return res.status(500).json({ success: false, error: 'সার্ভারে অভ্যন্তরীণ সমস্যা হয়েছে।' });
  }
};

module.exports = { streamChatCompletions, generateImage, saveChatSession, getChatSessions, deleteChatSession };


