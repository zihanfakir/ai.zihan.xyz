const fetch = require('node-fetch');
const mongoose = require('mongoose');
const UsageLog = require('../models/UsageLog');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore, debouncedSave } = require('../config/memoryStore');
const AiModel = require('../models/AiModel');
const { getModelConfig, getApiKeyFromSupabase, incrementUserUsage, getSystemSettings } = require('../../utils/getModelConfig');

const resolveModelTarget = async (targetModelId, targetModelConfig) => {
  let targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
  let targetKey = (targetModelConfig && targetModelConfig.api_key) || null;
  let actualModel = targetModelId || 'gemini-3.5-flash-lite';

  // 1. Model ID Normalization & Provider Resolution
  if (targetModelId === 'openai/gpt-oss-120b' || targetModelId === 'llama-3.3-70b-versatile') {
    targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
    actualModel = 'openai/gpt-oss-120b';
    if (!targetKey) targetKey = process.env.GROQ_API_KEY;
  } else if (targetModelId === 'qwen/qwen3.8-27b' || targetModelId === 'qwen3.8-27b') {
    targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
    actualModel = 'qwen/qwen3.8-27b';
    if (!targetKey) targetKey = process.env.GROQ_API_KEY;
  } else if (targetModelId === 'gemini-1.5-flash' || targetModelId === 'gemini-3.5-flash-lite' || targetModelId === 'openrouter/free' || !targetModelId) {
    targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
    actualModel = 'google/gemini-2.5-flash';
    if (!targetKey) targetKey = process.env.OPENROUTER_API_KEY;
  } else if (targetModelId === 'deepseek-v4-flash' || targetModelId === 'deepseek-v4-flash-vision-exp') {
    targetUrl = 'https://vyceai.com/v1/chat/completions';
    actualModel = targetModelId === 'deepseek-v4-flash-vision-exp' ? 'deepseek-v4-flash-lr' : 'deepseek-v4-flash';
    if (!targetKey) targetKey = process.env.VYCE_API_KEY;
  } else if (targetModelId === 'claude-sonnet-4-6') {
    targetUrl = 'https://vyceai.com/v1/chat/completions';
    actualModel = 'claude-sonnet-4-6';
    if (!targetKey) targetKey = process.env.VYCE_API_KEY;
  } else if (targetModelId === 'gpt-5.6') {
    targetUrl = 'https://vyceai.com/v1/chat/completions';
    actualModel = 'gpt-5.6-new';
    if (!targetKey) targetKey = process.env.VYCE_API_KEY;
  } else if (targetModelId === 'nemotron-ultra-550b' || targetModelId === 'nemotron-vision') {
    targetUrl = 'https://vyceai.com/v1/chat/completions';
    actualModel = targetModelId;
    if (!targetKey) targetKey = process.env.VYCE_API_KEY;
  } else if (targetModelId === 'mimo-v2.5' || targetModelId === 'hy3') {
    targetUrl = 'https://api.b.ai/v1/chat/completions';
    actualModel = targetModelId;
    if (!targetKey) targetKey = process.env.BAI_API_KEY;
  } else if (targetModelConfig && targetModelConfig.base_url) {
    let bUrl = targetModelConfig.base_url.trim();
    if (!bUrl.endsWith('/chat/completions') && !bUrl.endsWith('/completions')) {
      bUrl = bUrl.replace(/\/+$/, '') + '/chat/completions';
    }
    targetUrl = bUrl;
    actualModel = targetModelConfig.id || targetModelId;
  }

  // 2. Global Key Fallback from Supabase if not found
  if (!targetKey) {
    targetKey = await getApiKeyFromSupabase(targetModelId);
    if (!targetKey && actualModel !== targetModelId) {
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

  return { targetUrl, targetKey, actualModel };
};

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
      role: ['user', 'assistant', 'system'].includes(m.role) ? m.role : 'user',
      content: typeof m.content === 'string' ? m.content.slice(0, MAX_CONTENT_LENGTH) : (Array.isArray(m.content) ? m.content.filter(c => c && typeof c === 'object' && (c.type === 'text' || c.type === 'image_url')).slice(0, 20) : '')
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

    const { targetUrl, targetKey, actualModel } = await resolveModelTarget(model, aiModelConfig);

    // Upstream abort controller: triggered ONLY if client terminates response stream early
    const abortController = new AbortController();
    const onClientClose = () => {
      if (!res.writableEnded) {
        try { abortController.abort(); } catch (e) {}
      }
    };
    res.on('close', onClientClose);

    // Helper to attempt completion fetch with timeout
    const tryFetchCompletion = async (url, key, modName, timeoutMs = 25000) => {
      const fetchController = new AbortController();
      const timeoutId = setTimeout(() => fetchController.abort(), timeoutMs);

      const onAbort = () => { try { fetchController.abort(); } catch (e) {} };
      abortController.signal.addEventListener('abort', onAbort);

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
        abortController.signal.removeEventListener('abort', onAbort);
        return r;
      } catch (err) {
        clearTimeout(timeoutId);
        abortController.signal.removeEventListener('abort', onAbort);
        console.warn(`[Fetch Attempt Error] ${url} (${modName}):`, err.message);
        return null;
      }
    };

    // Primary model attempt
    let response = await tryFetchCompletion(targetUrl, targetKey, actualModel, 25000);
    let effectiveModel = model || 'gemini-3.5-flash-lite';

    // Guard against client socket abort / closure
    if (res.writableEnded || res.destroyed) {
      return;
    }

    // Auto-fallback check if primary model failed or timed out
    if (!response || !response.ok) {
      const sysSettings = await getSystemSettings().catch(() => ({}));
      const autoFallbackEnabled = sysSettings.auto_fallback !== false;

      if (autoFallbackEnabled) {
        console.warn(`[Auto-Fallback] Primary model '${model}' failed. Attempting fallback...`);
        const fallbackCandidates = Array.isArray(sysSettings.fallback_models) && sysSettings.fallback_models.length > 0
          ? sysSettings.fallback_models
          : ['gemini-3.5-flash-lite', 'openrouter/free', 'deepseek-v4-flash'];

        const currentPlanName = req.currentPlan ? req.currentPlan.name : (user && user.subscription && user.subscription.plan_name ? user.subscription.plan_name : 'Free');
        const freeModelIds = ['openrouter/free', 'gemini-3.5-flash-lite', 'gemini-1.5-flash', 'mimo-v2.5', 'hy3', 'deepseek-v4-flash'];

        for (const candidateId of fallbackCandidates) {
          if (!candidateId || candidateId === model) continue;

          // Strictly enforce user plan authorization on fallback candidate
          if (currentPlanName === 'Free') {
            if (!freeModelIds.includes(candidateId)) continue;
          } else if (currentPlanName === 'Pro') {
            if (candidateId === 'gpt-5.6') continue;
          }

          let candidateConfig = null;
          if (getIsMongoConnected()) {
            candidateConfig = await AiModel.findOne({ $or: [{ model_id: candidateId }, { id: candidateId }] }).catch(() => null);
          } else {
            candidateConfig = await getModelConfig(candidateId).catch(() => null);
          }

          // Double check badge restrictions
          if (currentPlanName === 'Free' && candidateConfig && (candidateConfig.premium || candidateConfig.efficient)) {
            continue;
          }
          if (currentPlanName === 'Pro' && candidateConfig && candidateConfig.efficient) {
            continue;
          }

          const target = await resolveModelTarget(candidateId, candidateConfig);
          console.log(`[Auto-Fallback] Trying candidate '${candidateId}'...`);
          const fbResponse = await tryFetchCompletion(target.targetUrl, target.targetKey, target.actualModel, 15000);

          if (fbResponse && fbResponse.ok) {
            console.log(`[Auto-Fallback] Candidate '${candidateId}' succeeded! Switching stream.`);
            response = fbResponse;
            effectiveModel = candidateId;
            break;
          }
        }
      }
    }

    // If model failed or timed out, send proper HTTP error JSON before headers are locked
    if (!response || !response.ok) {
      const status = response ? response.status : 504;
      const modelDisplayName = (aiModelConfig && (aiModelConfig.name || aiModelConfig.id)) || model || 'AI Model';
      let userSafeError = `নির্বাচিত AI মডেলটি (${modelDisplayName}) এই মুহূর্তে সাড়া দিচ্ছে না। অনুগ্রহ করে অন্য কোনো মডেল নির্বাচন করুন।`;
      if (status === 429) {
        userSafeError = 'মেসেজ পাঠানোর সীমা শেষ হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।';
      } else if (status === 401 || status === 403) {
        userSafeError = 'এই মডেল ব্যবহারের জন্য অনুমোদন প্রয়োজন।';
      } else if (status === 502 || status === 503 || status === 504) {
        userSafeError = `AI মডেল প্রোভাইডার সার্ভার (${modelDisplayName}) সাময়িকভাবে ডাউন বা রেসপন্স করতে ব্যর্থ হয়েছে।`;
      }
      return res.status(status >= 400 && status < 600 ? status : 503).json({ success: false, error: userSafeError });
    }

    // Model is verified healthy and responding: Now establish SSE streaming
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();
    res.write(': keepalive\n\n');

    let hasStreamedData = false;
    let hasContentTokens = false;
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
          res.removeListener('close', onClientClose);
          resolve();
        }
      };

      response.body.on('data', (chunk) => {
        hasStreamedData = true;
        if (!hasContentTokens) { try { const s = chunk.toString(); if (s.includes('"delta"') || s.includes('"content"')) hasContentTokens = true; } catch {} }
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
          if (hasContentTokens) {
            const userId = user ? String(user._id || user.id) : req.guestId;
            if (userId) {
              if (user && getIsMongoConnected()) {
                UsageLog.create({
                  user_id: userId,
                  model_id: effectiveModel || model || 'gemini-3.5-flash-lite',
                  timestamp: new Date()
                }).catch(err => console.error('[UsageLog Write Error]:', err.message));
                incrementUserUsage(userId, req.currentPlan ? req.currentPlan.window_hours : 3).catch(() => {});
              } else {
                memoryStore.usageLogs.push({
                  _id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                  user_id: userId,
                  model_id: effectiveModel || model || 'gemini-3.5-flash-lite',
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


