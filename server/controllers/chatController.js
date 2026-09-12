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

    // Sanitize and cap messages array to prevent memory exhaustion (support string or array multimodal content)
    const MAX_CONTENT_LENGTH = 32000;
    const safeMessages = messages.slice(-100).filter(m => m && typeof m === 'object' && (typeof m.content === 'string' || Array.isArray(m.content))).map(m => ({
      role: m.role || 'user',
      content: typeof m.content === 'string' ? m.content.slice(0, MAX_CONTENT_LENGTH) : m.content
    }));
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
    if (model === 'openai/gpt-oss-120b' || model === 'llama-3.3-70b-versatile' || model === 'qwen/qwen3.8-27b') {
      targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
      actualModel = 'qwen/qwen3.8-27b';
      targetKey = (aiModelConfig && aiModelConfig.api_key) || process.env.GROQ_API_KEY;
    } else if (model === 'gemini-1.5-flash' || model === 'gemini-3.5-flash-lite' || model === 'openrouter/free' || !model) {
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

    // Flush SSE headers early with keep-alive comment so Vercel does not time out or drop the connection
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();
    res.write(': keepalive\n\n');

    // Abort upstream immediately if client disconnects
    const abortController = new AbortController();
    req.on('close', () => {
      try { abortController.abort(); } catch (e) {}
    });

    // Helper to attempt completion fetch with timeout (4.5s max to fit within Vercel serverless window)
    const tryFetchCompletion = async (url, key, modName, timeoutMs = 4500) => {
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

    let response = await tryFetchCompletion(targetUrl, targetKey, actualModel, 8000);

    // Guard against client socket abort / closure
    if (req.destroyed || req.aborted || (abortController && abortController.signal.aborted) || res.writableEnded) {
      return;
    }

    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (res.flushHeaders) res.flushHeaders();
    }

    if (!response || !response.ok) {
      const status = response ? response.status : 500;
      let userSafeError = 'সার্ভার থেকে কোনো উত্তর পাওয়া যায়নি। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।';
      if (status === 429) {
        userSafeError = 'মেসেজ পাঠানোর সীমা শেষ হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।';
      } else if (status === 401 || status === 403) {
        userSafeError = 'এই মডেল ব্যবহারের জন্য অনুমোদন প্রয়োজন।';
      } else if (status === 502 || status === 503) {
        userSafeError = 'AI মডেল প্রোভাইডার সার্ভার সাময়িকভাবে ডাউন রয়েছে। অন্য কোনো মডেল নির্বাচন করুন।';
      }
      res.write(`data: ${JSON.stringify({ error: userSafeError })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    let hasStreamedData = false;
    let streamIdleTimeout = null;

    const resetStreamIdleWatchdog = () => {
      if (streamIdleTimeout) clearTimeout(streamIdleTimeout);
      streamIdleTimeout = setTimeout(() => {
        console.warn('[Stream Watchdog]: Inactivity timeout reached (60s), terminating stream.');
        if (response && response.body && typeof response.body.destroy === 'function') {
          try { response.body.destroy(); } catch {}
        }
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: 'স্ট্রিম সময়সীমা অতিক্রম করেছে।' })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }, 60000);
    };
    return new Promise((resolve) => {
      let isResolved = false;
      const safeResolve = () => {
        if (!isResolved) {
          isResolved = true;
          if (streamIdleTimeout) clearTimeout(streamIdleTimeout);
          resolve();
        }
      };

      const onClose = () => {
        if (response && response.body && typeof response.body.destroy === 'function') {
          try { response.body.destroy(); } catch {}
        }
        safeResolve();
      };
      req.on('close', onClose);

      response.body.on('data', (chunk) => {
        hasStreamedData = true;
        resetStreamIdleWatchdog();
        try {
          res.write(chunk);
          if (typeof res.flush === 'function') res.flush();
        } catch (e) {
          safeResolve();
        }
      });

      response.body.on('end', async () => {
        try {
          // Record usage log only after stream successfully delivers tokens
          if (hasStreamedData) {
            const userId = user ? String(user._id || user.id) : req.guestId;
            if (userId) {
              if (user && getIsMongoConnected()) {
                UsageLog.create({
                  user_id: userId,
                  model_id: model || 'openrouter/free',
                  timestamp: new Date()
                }).catch(err => console.error('[UsageLog Write Error]:', err.message));
                incrementUserUsage(userId, req.currentPlan ? req.currentPlan.window_hours : 3).catch(() => {});
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
          safeResolve();
        }
      });

      response.body.on('error', (err) => {
        console.error('[Stream Error]:', err.message);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: 'স্ট্রিম সংযোগে সমস্যা হয়েছে।' })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
        safeResolve();
      });
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
        if (req.user && getIsMongoConnected()) {
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

module.exports = { streamChatCompletions, generateImage };


