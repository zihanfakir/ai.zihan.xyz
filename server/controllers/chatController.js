const fetch = require('node-fetch');
const mongoose = require('mongoose');
const UsageLog = require('../models/UsageLog');
const { getIsMongoConnected } = require('../config/db');
const { memoryStore, debouncedSave } = require('../config/memoryStore');
const AiModel = require('../models/AiModel');
const { getModelConfig, getApiKeyFromSupabase, incrementUserUsage } = require('../../utils/getModelConfig');

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',')[0].trim() : '') || '';
const DEFAULT_GROQ_KEY = process.env.GROQ_API_KEY || '';
const DEFAULT_OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const DEFAULT_BAI_KEY = process.env.BAI_API_KEY || '';
const DEFAULT_VYCE_KEY = process.env.VYCE_API_KEY || '';

const resolveModelTarget = async (targetModelId, targetModelConfig) => {
  let targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
  let targetKey = (targetModelConfig && targetModelConfig.api_key) || null;
  let actualModel = targetModelId || 'gemini-3.6-flash';
  let providerType = 'openrouter';

  const geminiKey = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',')[0].trim() : '') || DEFAULT_GEMINI_KEY;

  // 1. Model ID Normalization & Provider Resolution
  if (targetModelId.startsWith('gemini-') || targetModelId.includes('gemini') || targetModelConfig?.type === 'gemini') {
    providerType = 'gemini';
    let gMod = targetModelId;
    if (gMod === 'gemini-3.5-flash-lite' || gMod === 'gemini-flash' || gMod === 'gemini-1.5-flash') {
      gMod = 'gemini-1.5-flash';
    } else if (gMod === 'gemini-3.6-flash' || gMod === 'gemini-2.5-flash' || gMod === 'gemini-pro') {
      gMod = 'gemini-1.5-flash';
    }
    actualModel = gMod;
    if (!targetKey) targetKey = geminiKey;
    targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:streamGenerateContent?key=${targetKey}&alt=sse`;
  } else if (targetModelId === 'openai/gpt-oss-120b' || targetModelId === 'llama-3.3-70b-versatile' || targetModelId === 'alo-pro') {
    providerType = 'groq';
    targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
    actualModel = 'llama-3.3-70b-versatile';
    if (!targetKey) targetKey = process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY;
  } else if (targetModelId === 'qwen/qwen3.8-27b' || targetModelId === 'qwen3.8-27b' || targetModelId === 'deepseek' || targetModelId === 'deepseek-r1' || targetModelId === 'deepseek-r1-distill-llama-70b') {
    providerType = 'groq';
    targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
    actualModel = 'deepseek-r1-distill-llama-70b';
    if (!targetKey) targetKey = process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY;
  } else if (targetModelId === 'openai/gpt-oss-20b' || targetModelId === 'llama-3.1-8b-instant' || targetModelId === 'llama-3.1-8b') {
    providerType = 'groq';
    targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
    actualModel = 'llama-3.1-8b-instant';
    if (!targetKey) targetKey = process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY;
  } else if (targetModelId === 'openrouter/free' || !targetModelId) {
    providerType = 'openrouter';
    targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
    actualModel = 'openrouter/free';
    if (!targetKey) targetKey = process.env.OPENROUTER_API_KEY || DEFAULT_OPENROUTER_KEY;
  } else if (targetModelId === 'claude-sonnet-4-6') {
    providerType = 'vyce';
    targetUrl = 'https://vyceai.com/v1/chat/completions';
    actualModel = 'claude-sonnet-4-6';
    if (!targetKey) targetKey = process.env.VYCE_API_KEY || DEFAULT_VYCE_KEY;
  } else if (targetModelId === 'gpt-5.6') {
    providerType = 'vyce';
    targetUrl = 'https://vyceai.com/v1/chat/completions';
    actualModel = 'gpt-5.6-new';
    if (!targetKey) targetKey = process.env.VYCE_API_KEY || DEFAULT_VYCE_KEY;
  } else if (targetModelId === 'nemotron-ultra-550b') {
    providerType = 'vyce';
    targetUrl = 'https://vyceai.com/v1/chat/completions';
    actualModel = 'deepseek-v4-flash-lr';
    if (!targetKey) targetKey = process.env.VYCE_API_KEY || DEFAULT_VYCE_KEY;
  } else if (targetModelId === 'mimo-v2.5' || targetModelId === 'hy3') {
    providerType = 'bai';
    targetUrl = 'https://api.b.ai/v1/chat/completions';
    actualModel = targetModelId;
    if (!targetKey) targetKey = process.env.BAI_API_KEY || DEFAULT_BAI_KEY;
  } else if (targetModelConfig && targetModelConfig.base_url) {
    let bUrl = targetModelConfig.base_url.trim();
    if (!bUrl.endsWith('/chat/completions') && !bUrl.endsWith('/completions') && !bUrl.includes('streamGenerateContent')) {
      bUrl = bUrl.replace(/\/+$/, '') + '/chat/completions';
    }
    targetUrl = bUrl;
    actualModel = targetModelConfig.id || targetModelId;
    providerType = targetModelConfig.type || 'custom';
  }

  // 2. Global Key Fallback from Supabase if not found
  if (!targetKey) {
    targetKey = await getApiKeyFromSupabase(targetModelId);
    if (!targetKey && actualModel !== targetModelId) {
      targetKey = await getApiKeyFromSupabase(actualModel);
    }
  }

  // 3. Provider Default Key Fallback & Key Format Validation
  if (!targetKey || (providerType === 'gemini' && !targetKey.startsWith('AIza')) || (providerType === 'groq' && !targetKey.startsWith('gsk_'))) {
    if (providerType === 'gemini' || targetUrl.includes('googleapis.com')) {
      targetKey = geminiKey || (await getApiKeyFromSupabase('__gemini_key__')) || (await getApiKeyFromSupabase('gemini-3.6-flash'));
    } else if (providerType === 'groq' || targetUrl.includes('groq.com')) {
      targetKey = process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY || (await getApiKeyFromSupabase('__groq_key__')) || (await getApiKeyFromSupabase('openai/gpt-oss-120b'));
    } else if (providerType === 'bai' || targetUrl.includes('b.ai')) {
      targetKey = process.env.BAI_API_KEY || DEFAULT_BAI_KEY || (await getApiKeyFromSupabase('__bai_key__')) || (await getApiKeyFromSupabase('mimo-v2.5'));
    } else if (providerType === 'vyce' || targetUrl.includes('vyceai.com')) {
      targetKey = process.env.VYCE_API_KEY || DEFAULT_VYCE_KEY || (await getApiKeyFromSupabase('__vyce_key__')) || (await getApiKeyFromSupabase('claude-sonnet-4-6'));
    } else if (targetUrl.includes('openrouter.ai')) {
      targetKey = process.env.OPENROUTER_API_KEY || DEFAULT_OPENROUTER_KEY || (await getApiKeyFromSupabase('__openrouter_key__')) || (await getApiKeyFromSupabase('openrouter/free'));
    }
  }

  // Final sanity check for Gemini URL query param
  if (providerType === 'gemini' && targetKey && targetUrl.includes('key=')) {
    targetUrl = targetUrl.replace(/key=[^&]+/, 'key=' + targetKey);
  }

  return { targetUrl, targetKey, actualModel, providerType };
};

const streamChatCompletions = async (req, res) => {
  try {
    const { messages } = req.body;
    const cleanModel = (typeof req.body.model === 'string' && req.body.model.trim()) ? req.body.model.trim() : 'gemini-3.6-flash';
    const model = cleanModel;
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
    if (getIsMongoConnected() && cleanModel) {
      aiModelConfig = await AiModel.findOne({ $or: [{ model_id: cleanModel }, { id: cleanModel }] });
      if (aiModelConfig && !aiModelConfig.api_key) {
        const supabaseConfig = await getModelConfig(cleanModel);
        if (supabaseConfig && supabaseConfig.api_key) {
          aiModelConfig = { ...aiModelConfig.toObject(), api_key: supabaseConfig.api_key };
        }
      }
    } else {
      aiModelConfig = await getModelConfig(cleanModel);
    }

    // Admin-configured model name: models must always introduce themselves by this name
    const adminModelName = (aiModelConfig && typeof aiModelConfig.name === 'string' && aiModelConfig.name.trim())
      ? aiModelConfig.name.trim()
      : (cleanModel || 'Alo AI');

    const modelIdentityDirective = `=== MANDATORY MODEL IDENTITY DIRECTIVE (ABSOLUTE PRIORITY OVERRIDE) ===
Your official name is "${adminModelName}". You were developed exclusively by Alokpoth AI (আলোকপথ).
- When asked who you are ("তুমি কে?", "Who are you?"), what your name is ("তোমার নাম কি?", "What is your name?"), or who created you:
  - If replying in Bengali, you MUST explicitly say: "আমি ${adminModelName}, আলোকপথ (Alokpoth AI) দ্বারা নির্মিত একটি এআই অ্যাসিস্ট্যান্ট।"
  - If replying in English, you MUST explicitly say: "I am ${adminModelName}, an AI assistant developed by Alokpoth AI."
- NEVER mention, reveal, or admit to being Google, Gemini, OpenAI, ChatGPT, Anthropic, Claude, Meta, Llama, Groq, DeepSeek, or any other third-party company.
- You have NO other name. Your name is ONLY "${adminModelName}".`;

    let { targetUrl, targetKey, actualModel, providerType } = await resolveModelTarget(cleanModel, aiModelConfig);

    // Upstream abort controller: triggered ONLY if client terminates response stream early
    const abortController = new AbortController();
    const onClientClose = () => {
      if (!res.writableEnded) {
        try { abortController.abort(); } catch (e) {}
      }
    };
    res.on('close', onClientClose);

    // Helper to attempt completion fetch with timeout (handles both OpenAI format & Google Gemini SSE format)
    const tryFetchTarget = async (pType, url, key, modName, timeoutMs = 25000) => {
      const fetchController = new AbortController();
      const timeoutId = setTimeout(() => fetchController.abort(), timeoutMs);

      const onAbort = () => { try { fetchController.abort(); } catch (e) {} };
      abortController.signal.addEventListener('abort', onAbort);

      try {
        if (pType === 'gemini') {
          const geminiContents = [];
          let systemInstructionText = modelIdentityDirective;
          for (const m of safeMessages) {
            if (m.role === 'system') {
              systemInstructionText += '\n\n' + (typeof m.content === 'string' ? m.content : '');
            } else {
              let parts = [];
              if (typeof m.content === 'string') {
                parts = [{ text: m.content }];
              } else if (Array.isArray(m.content)) {
                for (const item of m.content) {
                  if (item.type === 'text' && item.text) parts.push({ text: item.text });
                  else if (item.type === 'image_url' && item.image_url?.url) {
                    const u = item.image_url.url;
                    const match = u.match(/^data:([^;]+);base64,(.*)$/);
                    if (match) {
                      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
                    }
                  }
                }
              }
              if (parts.length > 0) {
                geminiContents.push({
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts
                });
              }
            }
          }

          if (geminiContents.length === 0) {
            geminiContents.push({ role: 'user', parts: [{ text: 'Hello' }] });
          }

          const geminiBody = {
            contents: geminiContents,
            ...(systemInstructionText ? { systemInstruction: { parts: [{ text: systemInstructionText }] } } : {}),
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192
            }
          };

          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiBody),
            signal: fetchController.signal
          });
          clearTimeout(timeoutId);
          abortController.signal.removeEventListener('abort', onAbort);
          return r;
        } else {
          const h = { 'Content-Type': 'application/json' };
          if (key) h['Authorization'] = `Bearer ${key}`;

          const safeMessagesWithIdentity = [...safeMessages];
          const sysIdx = safeMessagesWithIdentity.findIndex(m => m.role === 'system');
          if (sysIdx >= 0) {
            safeMessagesWithIdentity[sysIdx] = {
              ...safeMessagesWithIdentity[sysIdx],
              content: modelIdentityDirective + '\n\n' + (typeof safeMessagesWithIdentity[sysIdx].content === 'string' ? safeMessagesWithIdentity[sysIdx].content : '')
            };
          } else {
            safeMessagesWithIdentity.unshift({ role: 'system', content: modelIdentityDirective });
          }

          const p = {
            model: modName,
            messages: safeMessagesWithIdentity,
            stream: true
          };

          const lowerMod = modName.toLowerCase();
          if (lowerMod.includes('gpt')) {
            p.max_tokens = 4096;
          } else {
            p.max_tokens = 8192;
          }

          const r = await fetch(url, {
            method: 'POST',
            headers: h,
            body: JSON.stringify(p),
            signal: fetchController.signal
          });
          clearTimeout(timeoutId);
          abortController.signal.removeEventListener('abort', onAbort);
          return r;
        }
      } catch (err) {
        clearTimeout(timeoutId);
        abortController.signal.removeEventListener('abort', onAbort);
        console.warn(`[Fetch Attempt Error] ${url} (${modName}):`, err.message);
        return null;
      }
    };

    // Primary model attempt
    let response = await tryFetchTarget(providerType, targetUrl, targetKey, actualModel, 25000);
    let effectiveModel = cleanModel || 'gemini-3.6-flash';
    let isGeminiStream = (providerType === 'gemini');

    // Multi-provider fallback chain if primary fails or runs out of quota
    if (!response || !response.ok) {
      console.warn(`[Chat Primary Failed] ${cleanModel} (status: ${response ? response.status : 'timeout'}), trying multi-provider fallback chain...`);

      const geminiKey = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',')[0].trim() : '') || DEFAULT_GEMINI_KEY || (await getApiKeyFromSupabase('__gemini_key__')) || (await getApiKeyFromSupabase('gemini-3.6-flash'));
      const groqKey = process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY || (await getApiKeyFromSupabase('__groq_key__')) || (await getApiKeyFromSupabase('openai/gpt-oss-120b'));
      const openRouterKey = process.env.OPENROUTER_API_KEY || DEFAULT_OPENROUTER_KEY || (await getApiKeyFromSupabase('__openrouter_key__')) || (await getApiKeyFromSupabase('openrouter/free'));
      const fallbacks = [
        {
          id: 'gemini-1.5-flash',
          type: 'gemini',
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${geminiKey}&alt=sse`,
          key: geminiKey,
          model: 'gemini-1.5-flash'
        },
        {
          id: 'llama-3.3-70b-versatile',
          type: 'groq',
          url: 'https://api.groq.com/openai/v1/chat/completions',
          key: groqKey,
          model: 'llama-3.3-70b-versatile'
        },
        {
          id: 'deepseek-r1-distill-llama-70b',
          type: 'groq',
          url: 'https://api.groq.com/openai/v1/chat/completions',
          key: groqKey,
          model: 'deepseek-r1-distill-llama-70b'
        },
        {
          id: 'llama-3.1-8b-instant',
          type: 'groq',
          url: 'https://api.groq.com/openai/v1/chat/completions',
          key: groqKey,
          model: 'llama-3.1-8b-instant'
        },
        {
          id: 'openrouter/free',
          type: 'openrouter',
          url: 'https://openrouter.ai/api/v1/chat/completions',
          key: openRouterKey,
          model: 'openrouter/free'
        }
      ].filter(fb => fb.id !== cleanModel);

      for (const fb of fallbacks) {
        if (res.writableEnded || res.destroyed) break;
        const fbResp = await tryFetchTarget(fb.type, fb.url, fb.key, fb.model, 20000);
        if (fbResp && fbResp.ok) {
          console.log(`[Chat Fallback Success] Switched cleanly to ${fb.id}`);
          response = fbResp;
          effectiveModel = fb.id;
          isGeminiStream = (fb.type === 'gemini');
          break;
        }
      }
    }

    // Guard against client socket abort / closure
    if (res.writableEnded || res.destroyed) {
      return;
    }

    // If all providers and fallbacks failed, send user-safe error
    if (!response || !response.ok) {
      const status = response ? response.status : 504;
      const modelDisplayName = (aiModelConfig && (aiModelConfig.name || aiModelConfig.id)) || model || 'AI Model';
      let userSafeError = `AI মডেল প্রোভাইডার সার্ভারে ত্রুটি হয়েছে (${modelDisplayName})। অনুগ্রহ করে আবার চেষ্টা করুন।`;
      if (status === 429) {
        userSafeError = `মডেল প্রোভাইডার সার্ভারের অনুরোধের সীমা শেষ হয়েছে (${modelDisplayName})। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন বা অন্য কোনো মডেল নির্বাচন করুন।`;
      } else if (status === 401 || status === 403) {
        userSafeError = `AI মডেল প্রোভাইডারের কী বা সার্ভার সংযোগে সমস্যা দেখা দিয়েছে (${modelDisplayName})। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন অথবা অন্য মডেল নির্বাচন করুন।`;
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

    const keepAliveInterval = setInterval(() => {
      if (!res.writableEnded) {
        try {
          res.write(': keepalive\n\n');
          if (typeof res.flush === 'function') res.flush();
        } catch {}
      }
    }, 15000);

    let hasStreamedData = false;
    let hasContentTokens = false;
    let streamIdleTimeout = null;

    const resetStreamIdleWatchdog = () => {
      if (streamIdleTimeout) clearTimeout(streamIdleTimeout);
      streamIdleTimeout = setTimeout(() => {
        console.warn('[Stream Watchdog]: Inactivity timeout reached (300s), terminating stream.');
        if (response && response.body && typeof response.body.destroy === 'function') {
          try { response.body.destroy(); } catch {}
        }
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: 'স্ট্রিম সময়সীমা অতিক্রম করেছে।' })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }, 300000);
    };

    // Arm watchdog immediately so hanging connections timeout even before first byte
    resetStreamIdleWatchdog();

    return new Promise((resolve) => {
      let isResolved = false;
      const onClientClose = () => {
        if (response && response.body && typeof response.body.destroy === 'function') {
          try { response.body.destroy(); } catch {}
        }
        safeResolve();
      };
      res.on('close', onClientClose);

      const safeResolve = () => {
        if (!isResolved) {
          isResolved = true;
          if (keepAliveInterval) clearInterval(keepAliveInterval);
          if (streamIdleTimeout) clearTimeout(streamIdleTimeout);
          if (typeof res.removeListener === 'function') {
            res.removeListener('close', onClientClose);
          }
          resolve();
        }
      };

      let geminiLineBuffer = '';

      response.body.on('data', (chunk) => {
        hasStreamedData = true;
        resetStreamIdleWatchdog();

        try {
          if (isGeminiStream) {
            // Translate Gemini SSE events to OpenAI SSE standard
            geminiLineBuffer += chunk.toString();
            const lines = geminiLineBuffer.split('\n');
            geminiLineBuffer = lines.pop(); // save remainder

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                const dataStr = trimmed.slice(5).trim();
                if (!dataStr || dataStr === '[DONE]') continue;
                try {
                  const json = JSON.parse(dataStr);
                  const parts = json?.candidates?.[0]?.content?.parts;
                  if (Array.isArray(parts)) {
                    for (const p of parts) {
                      if (p && p.text) {
                        hasContentTokens = true;
                        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: p.text } }] })}\n\n`);
                        if (typeof res.flush === 'function') res.flush();
                      }
                    }
                  }
                } catch (pe) {}
              }
            }
          } else {
            // Standard OpenAI SSE format
            if (!hasContentTokens) {
              try {
                const s = chunk.toString();
                if (/"content"\s*:\s*"(?:[^"\\]|\\.)+"/.test(s) || /"reasoning(?:_content)?"\s*:\s*"(?:[^"\\]|\\.)+"/.test(s) || /"text"\s*:\s*"(?:[^"\\]|\\.)+"/.test(s)) {
                  hasContentTokens = true;
                }
              } catch {}
            }
            res.write(chunk);
            if (typeof res.flush === 'function') res.flush();
          }
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
              if (getIsMongoConnected()) {
                UsageLog.create({
                  user_id: userId,
                  model_id: effectiveModel || cleanModel || 'gemini-3.5-flash-lite',
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
                incrementUserUsage(userId, req.currentPlan ? req.currentPlan.window_hours : 3).catch(e => {
                  console.error('[Increment User Usage Error]:', e.message);
                });
              }
            }
          }
        } catch (streamErr) {
          console.error('[Stream End Callback Error]:', streamErr.message);
        } finally {
          if (!res.writableEnded) {
            res.write('data: [DONE]\n\n');
            res.end();
          }
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
    let targetKey = process.env.VYCE_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!targetKey) {
      targetKey = (await getApiKeyFromSupabase('__vyce_key__')) || (await getApiKeyFromSupabase('claude-sonnet-4-6')) || (await getApiKeyFromSupabase('__openrouter_key__')) || (await getApiKeyFromSupabase('openrouter/free'));
    }
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
        if (getIsMongoConnected()) {
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
        }
        const { incrementUserImageUsage } = require('../../utils/getModelConfig');
        incrementUserImageUsage(userId, req.currentPlan ? req.currentPlan.window_hours : 3).catch(() => {});
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


