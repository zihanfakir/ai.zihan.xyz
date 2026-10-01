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

const resolveModelTarget = async (targetModelId, customUrl, customKey, targetModelConfig) => {
  if (customUrl && typeof customUrl === 'object' && !targetModelConfig) {
    targetModelConfig = customUrl;
    customUrl = null;
    customKey = null;
  }
  let targetUrl = (typeof customUrl === 'string' && customUrl) ? customUrl : ((targetModelConfig && targetModelConfig.base_url) || null);
  let targetKey = (typeof customKey === 'string' && customKey) ? customKey : ((targetModelConfig && targetModelConfig.api_key) || null);
  let actualModel = (typeof targetModelId === 'string' && targetModelId) ? targetModelId : ((targetModelConfig && (targetModelConfig.api_model_1 || targetModelConfig.model_id)) || 'gemini-3.6-flash');
  let providerType = 'custom';

  const geminiKey = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',')[0].trim() : '') || DEFAULT_GEMINI_KEY;

  if ((targetUrl && (targetUrl.includes('googleapis.com') || targetUrl.includes('streamGenerateContent'))) || (!customUrl && (actualModel.startsWith('gemini-') || actualModel.includes('gemini') || targetModelConfig?.type === 'gemini'))) {
    providerType = 'gemini';
    let gMod = actualModel;
    if (gMod === 'gemini-1.5-flash' || gMod === 'gemini-flash' || gMod === 'gemini-pro' || gMod === 'gemini-2.5-flash' || gMod === 'gemini-3.5-flash-lite' || !gMod) {
      gMod = 'gemini-3.6-flash';
    }
    actualModel = gMod;
    if (!targetKey) targetKey = geminiKey || (await getApiKeyFromSupabase('__gemini_key__')) || (await getApiKeyFromSupabase('gemini-3.6-flash'));
    targetUrl = (targetUrl && targetUrl.includes('googleapis.com'))
      ? (targetKey && targetUrl.includes('key=') ? targetUrl.replace(/key=[^&]+/, 'key=' + targetKey) : (targetUrl.includes('?') ? `${targetUrl}&key=${targetKey}` : `${targetUrl}?key=${targetKey}&alt=sse`))
      : `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:streamGenerateContent?key=${targetKey}&alt=sse`;
  } else if ((targetUrl && targetUrl.includes('groq.com')) || (!customUrl && (actualModel === 'openai/gpt-oss-120b' || actualModel === 'llama-3.3-70b-versatile' || actualModel === 'alo-pro' || actualModel.includes('deepseek') || actualModel.includes('qwen') || actualModel.includes('llama-3.1-8b') || actualModel === 'openai/gpt-oss-20b'))) {
    providerType = 'groq';
    targetUrl = targetUrl || 'https://api.groq.com/openai/v1/chat/completions';
    if (actualModel === 'alo-pro' || actualModel === 'llama-3.3-70b-versatile') actualModel = 'openai/gpt-oss-120b';
    else if (actualModel.includes('qwen')) actualModel = 'qwen/qwen3.8-27b';
    else if (actualModel.includes('deepseek')) actualModel = 'openai/gpt-oss-120b';
    else if (actualModel === 'llama-3.1-8b-instant') actualModel = 'openai/gpt-oss-20b';
    if (!targetKey) targetKey = process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY || (await getApiKeyFromSupabase('__groq_key__')) || (await getApiKeyFromSupabase('openai/gpt-oss-120b'));
  } else if ((targetUrl && targetUrl.includes('openrouter.ai')) || (!customUrl && (actualModel === 'openrouter/free' || !actualModel))) {
    providerType = 'openrouter';
    targetUrl = targetUrl || 'https://openrouter.ai/api/v1/chat/completions';
    actualModel = actualModel || 'openrouter/free';
    if (!targetKey) targetKey = process.env.OPENROUTER_API_KEY || DEFAULT_OPENROUTER_KEY || (await getApiKeyFromSupabase('__openrouter_key__')) || (await getApiKeyFromSupabase('openrouter/free'));
  } else if ((targetUrl && targetUrl.includes('b.ai')) || (!customUrl && (actualModel === 'mimo-v2.5' || actualModel === 'hy3'))) {
    // Transparently reroute B.AI models since api.b.ai credit balance is 0
    if (actualModel === 'hy3') {
      providerType = 'groq';
      targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
      actualModel = 'openai/gpt-oss-120b';
      targetKey = process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY || (await getApiKeyFromSupabase('__groq_key__')) || (await getApiKeyFromSupabase('openai/gpt-oss-120b'));
    } else {
      providerType = 'gemini';
      actualModel = 'gemini-3.6-flash';
      targetKey = geminiKey || (await getApiKeyFromSupabase('__gemini_key__')) || (await getApiKeyFromSupabase('gemini-3.6-flash'));
      targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:streamGenerateContent?key=${targetKey}&alt=sse`;
    }
  } else if ((targetUrl && targetUrl.includes('vyceai.com')) || (!customUrl && (actualModel === 'claude-sonnet-4-6' || actualModel === 'gpt-5.6' || actualModel === 'gpt-5.6-new' || actualModel === 'nemotron-ultra-550b'))) {
    providerType = 'vyce';
    targetUrl = targetUrl || 'https://vyceai.com/v1/chat/completions';
    if (actualModel === 'gpt-5.6') actualModel = 'gpt-5.6-new';
    else if (actualModel === 'nemotron-ultra-550b') actualModel = 'deepseek-v4-flash-lr';
    if (!targetKey) targetKey = process.env.VYCE_API_KEY || DEFAULT_VYCE_KEY || (await getApiKeyFromSupabase('__vyce_key__')) || (await getApiKeyFromSupabase('claude-sonnet-4-6'));
  } else if (targetUrl) {
    providerType = 'custom';
    let bUrl = targetUrl.trim();
    if (!bUrl.endsWith('/chat/completions') && !bUrl.endsWith('/completions') && !bUrl.includes('streamGenerateContent')) {
      bUrl = bUrl.replace(/\/+$/, '') + '/chat/completions';
    }
    targetUrl = bUrl;
    if (!targetKey) {
      targetKey = await getApiKeyFromSupabase(actualModel);
      if (!targetKey && targetModelId) targetKey = await getApiKeyFromSupabase(targetModelId);
    }
  } else {
    providerType = 'openrouter';
    targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
    actualModel = actualModel || 'openrouter/free';
    if (!targetKey) targetKey = process.env.OPENROUTER_API_KEY || DEFAULT_OPENROUTER_KEY;
  }

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
Your official name is "${adminModelName}". You were developed exclusively by Alora (অ্যালোরা / Alora AI), a product of Alokpoth (আলোকপথ), a technology company founded by Zihan Fakir (জিহান ফকির).
- When asked who you are ("তুমি কে?", "Who are you?"), what your name is ("তোমার নাম কি?", "What is your name?"), or who created you:
  - If replying in Bengali, you MUST explicitly say: "আমি ${adminModelName}, Alokpoth (আলোকপথ) এর প্রতিষ্ঠাতা জিহান ফকির কর্তৃক নির্মিত Alora AI দ্বারা তৈরি একটি এআই অ্যাসিস্ট্যান্ট।"
  - If replying in English, you MUST explicitly say: "I am ${adminModelName}, an AI assistant developed by Alora, a product of Alokpoth, founded by Zihan Fakir."
- NEVER mention, reveal, or admit to being Google, Gemini, OpenAI, ChatGPT, Anthropic, Claude, Meta, Llama, Groq, DeepSeek, or any other third-party company.
- You have NO other name. Your name is ONLY "${adminModelName}".
- Alokpoth is your parent company. Zihan Fakir is the owner and founder of Alokpoth.`;

    const t1Model = (aiModelConfig?.api_model_1 || aiModelConfig?.model_id || cleanModel);
    const t1Url = aiModelConfig?.base_url || null;
    const t1Key = aiModelConfig?.api_key || null;
    let { targetUrl, targetKey, actualModel, providerType } = await resolveModelTarget(t1Model, t1Url, t1Key, aiModelConfig);

    // Upstream abort controller: triggered ONLY if client terminates response stream early
    const abortController = new AbortController();
    const onClientClose = () => {
      if (!res.writableEnded) {
        try { abortController.abort(); } catch (e) {}
      }
    };
    res.on('close', onClientClose);

    // Helper to attempt completion fetch with timeout (handles both OpenAI format & Google Gemini SSE format)
    const tryFetchTarget = async (pType, url, key, modName, timeoutMs = 12000) => {
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
              maxOutputTokens: 4096
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
    let response = await tryFetchTarget(providerType, targetUrl, targetKey, actualModel, 12000);
    let effectiveModel = cleanModel || 'gemini-3.6-flash';
    let isGeminiStream = (providerType === 'gemini');

    // Helper to resolve an internal API tier or reference model
    const resolveTierTarget = async (tierModelId, tierUrl, tierKey) => {
      const cleanModId = (tierModelId || '').trim();
      const cleanUrl = (tierUrl || '').trim();
      const cleanKey = (tierKey || '').trim();
      if (!cleanModId && !cleanUrl) return null;

      // Check if tierModelId refers to another saved model configuration in DB
      let refModelConfig = null;
      if (cleanModId && cleanModId !== cleanModel) {
        if (getIsMongoConnected()) {
          refModelConfig = await AiModel.findOne({ $or: [{ model_id: cleanModId }, { id: cleanModId }] });
          if (refModelConfig && !refModelConfig.api_key) {
            const supabaseConfig = await getModelConfig(cleanModId);
            if (supabaseConfig && supabaseConfig.api_key) {
              refModelConfig = { ...refModelConfig.toObject(), api_key: supabaseConfig.api_key };
            }
          }
        } else {
          refModelConfig = await getModelConfig(cleanModId);
        }
      }

      const effectiveMod = cleanModId || (refModelConfig?.api_model_1 || refModelConfig?.model_id) || actualModel;
      const effectiveUrl = cleanUrl || (refModelConfig?.base_url) || targetUrl;
      const effectiveKey = cleanKey || (refModelConfig?.api_key) || targetKey;

      return await resolveModelTarget(effectiveMod, effectiveUrl, effectiveKey, refModelConfig || aiModelConfig);
    };

    // 1. First failover: Attempt Internal Fallback API 2 (Fallback 1)
    if (!response || !response.ok) {
      const fb1Model = (aiModelConfig?.api_model_2 || aiModelConfig?.fallback_model_1 || '').trim();
      const fb1Url = (aiModelConfig?.fallback_url_1 || '').trim();
      const fb1Key = (aiModelConfig?.fallback_key_1 || '').trim();

      if ((fb1Model || fb1Url) && !(res.writableEnded || res.destroyed)) {
        console.warn(`[Chat Primary Failed] Model ${cleanModel} (status: ${response ? response.status : 'timeout'}), trying internal Fallback API 2 (${fb1Model || actualModel})...`);
        const fb1 = await resolveTierTarget(fb1Model, fb1Url, fb1Key);
        if (fb1) {
          const fb1Resp = await tryFetchTarget(fb1.providerType, fb1.targetUrl, fb1.targetKey, fb1.actualModel, 10000);
          if (fb1Resp && fb1Resp.ok) {
            console.log(`[Chat Internal API 2 Success] Model ${cleanModel} cleanly recovered using internal API 2 (${fb1.actualModel})`);
            response = fb1Resp;
            effectiveModel = cleanModel;
            isGeminiStream = (fb1.providerType === 'gemini');
          }
        }
      }
    }

    // 2. Second failover: Attempt Internal Fallback API 3 (Fallback 2)
    if (!response || !response.ok) {
      const fb2Model = (aiModelConfig?.api_model_3 || aiModelConfig?.fallback_model_2 || '').trim();
      const fb2Url = (aiModelConfig?.fallback_url_2 || '').trim();
      const fb2Key = (aiModelConfig?.fallback_key_2 || '').trim();

      if ((fb2Model || fb2Url) && !(res.writableEnded || res.destroyed)) {
        console.warn(`[Chat Fallback 1 Failed] Model ${cleanModel}, trying internal Fallback API 3 (${fb2Model || actualModel})...`);
        const fb2 = await resolveTierTarget(fb2Model, fb2Url, fb2Key);
        if (fb2) {
          const fb2Resp = await tryFetchTarget(fb2.providerType, fb2.targetUrl, fb2.targetKey, fb2.actualModel, 10000);
          if (fb2Resp && fb2Resp.ok) {
            console.log(`[Chat Internal API 3 Success] Model ${cleanModel} cleanly recovered using internal API 3 (${fb2.actualModel})`);
            response = fb2Resp;
            effectiveModel = cleanModel;
            isGeminiStream = (fb2.providerType === 'gemini');
          }
        }
      }
    }

    // 3. Multi-provider emergency backup chain if primary and both configured fallbacks fail or are not set
    if (!response || !response.ok) {
      console.warn(`[Chat Fallbacks Exhausted] Trying global multi-provider backup chain...`);

      const geminiKey = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',')[0].trim() : '') || DEFAULT_GEMINI_KEY || (await getApiKeyFromSupabase('__gemini_key__')) || (await getApiKeyFromSupabase('gemini-3.6-flash'));
      const groqKey = process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY || (await getApiKeyFromSupabase('__groq_key__')) || (await getApiKeyFromSupabase('openai/gpt-oss-120b'));
      const openRouterKey = process.env.OPENROUTER_API_KEY || DEFAULT_OPENROUTER_KEY || (await getApiKeyFromSupabase('__openrouter_key__')) || (await getApiKeyFromSupabase('openrouter/free'));
      const fallbacks = [
        {
          id: 'gemini-3.6-flash',
          type: 'gemini',
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?key=${geminiKey}&alt=sse`,
          key: geminiKey,
          model: 'gemini-3.6-flash'
        },
        {
          id: 'openai/gpt-oss-120b',
          type: 'groq',
          url: 'https://api.groq.com/openai/v1/chat/completions',
          key: groqKey,
          model: 'openai/gpt-oss-120b'
        },
        {
          id: 'qwen/qwen3.8-27b',
          type: 'groq',
          url: 'https://api.groq.com/openai/v1/chat/completions',
          key: groqKey,
          model: 'qwen/qwen3.8-27b'
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
        const fbResp = await tryFetchTarget(fb.type, fb.url, fb.key, fb.model, 8000);
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



// Helper for constructing Pollinations AI image URLs
function buildPollinationsUrl(cleanPrompt, imageModel = 'flux', imageSize = '1024x1024', enhance = true) {
  let width = 1024;
  let height = 1024;
  if (imageSize && imageSize.includes('x')) {
    const parts = imageSize.split('x').map(p => parseInt(p, 10));
    if (!isNaN(parts[0]) && parts[0] > 0) width = parts[0];
    if (!isNaN(parts[1]) && parts[1] > 0) height = parts[1];
  }

  // Determine pollinations model name
  let modelName = 'flux';
  const cleanMod = String(imageModel || '').toLowerCase().trim();
  if (cleanMod.startsWith('pollinations/')) {
    modelName = cleanMod.replace('pollinations/', '').trim() || 'flux';
  } else if (['flux', 'flux-realism', 'flux-anime', 'flux-3d', 'flux-cablyai', 'turbo', 'midjourney', 'sana'].includes(cleanMod)) {
    modelName = cleanMod;
  }

  const encoded = encodeURIComponent(cleanPrompt);
  const randomSeed = Math.floor(Math.random() * 1000000000);
  const enhanceParam = enhance ? '&enhance=true' : '&enhance=false';
  return {
    url: `https://image.pollinations.ai/prompt/${encoded}?model=${modelName}&width=${width}&height=${height}&nologo=true&seed=${randomSeed}&noredirect=true${enhanceParam}`,
    model: `pollinations/${modelName}`,
    provider: 'pollinations.ai'
  };
}

// Helper for executing image generation via configured provider/model
async function executeImageGeneration(prompt, forcedSettings = null) {
  const { getSystemSettings, getApiKeyFromSupabase } = require('../../utils/getModelConfig');
  const settings = forcedSettings || await getSystemSettings();
  const cleanPrompt = String(prompt || '').trim().slice(0, 1000);
  if (!cleanPrompt) throw new Error('অনুগ্রহ করে একটি সঠিক প্রম্পট প্রদান করুন।');

  const imageModel = String(settings.image_model || 'pollinations/flux').trim();
  const targetUrl = String(settings.image_api_url || 'https://image.pollinations.ai/prompt').trim();
  const imageSize = String(settings.image_size || '1024x1024').trim();

  // Check if provider or model is Pollinations
  const isPollinations = (
    imageModel.toLowerCase().includes('pollinations') ||
    targetUrl.toLowerCase().includes('pollinations') ||
    ['flux', 'flux-realism', 'flux-anime', 'flux-3d', 'flux-cablyai', 'turbo', 'midjourney', 'sana'].includes(imageModel.toLowerCase())
  );

  // Pollinations Free Unlimited Generator
  if (isPollinations) {
    return buildPollinationsUrl(cleanPrompt, imageModel, imageSize, settings.image_enhance !== false);
  }

  // Upstream Paid API Providers (OpenAI, VyceAI, Fal.ai, etc.)
  let targetKey = String(settings.image_api_key || process.env.IMAGE_API_KEY || process.env.VYCE_API_KEY || process.env.OPENROUTER_API_KEY || '').trim();
  if (!targetKey) {
    targetKey = (await getApiKeyFromSupabase('__image_key__')) || (await getApiKeyFromSupabase('__vyce_key__')) || (await getApiKeyFromSupabase('claude-sonnet-4-6')) || (await getApiKeyFromSupabase('__openrouter_key__')) || (await getApiKeyFromSupabase('openrouter/free'));
  }

  // If no API key configured for upstream provider, gracefully fall back to Pollinations AI
  if (!targetKey) {
    console.log('[Image Gen] No API key configured for upstream provider, falling back to Pollinations AI...');
    return buildPollinationsUrl(cleanPrompt, 'flux', imageSize, true);
  }

  const reqPayload = {
    prompt: cleanPrompt,
    n: 1,
    size: imageSize
  };
  if (imageModel && imageModel !== 'default' && imageModel !== 'vyceai-default') {
    reqPayload.model = imageModel;
  }

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
      body: JSON.stringify(reqPayload),
      signal: imgAbortController.signal
    });
  } catch (fetchErr) {
    clearTimeout(imgTimeout);
    console.warn('[Image Gen Upstream Fetch Error, falling back to Pollinations]:', fetchErr.message);
    return buildPollinationsUrl(cleanPrompt, 'flux', imageSize, true);
  }
  clearTimeout(imgTimeout);

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[Image Gen Upstream Error]:', response.status, errText.slice(0, 250));
    console.log('[Image Gen] Falling back to Pollinations AI...');
    return buildPollinationsUrl(cleanPrompt, 'flux', imageSize, true);
  }

  const data = await response.json().catch(() => null);
  const item = data?.data?.[0];
  if (item?.url) {
    return { url: item.url, model: imageModel };
  } else if (item?.b64_json) {
    return { url: `data:image/png;base64,${item.b64_json}`, model: imageModel };
  } else if (data?.url) {
    return { url: data.url, model: imageModel };
  } else if (Array.isArray(data?.images) && data.images[0]) {
    return { url: data.images[0], model: imageModel };
  }

  // Fallback to Pollinations if upstream returns invalid structure
  return buildPollinationsUrl(cleanPrompt, 'flux', imageSize, true);
}

const generateImage = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'অনুগ্রহ করে একটি সঠিক প্রম্পট প্রদান করুন।' });
    }

    const imgResult = await executeImageGeneration(prompt);

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

    return res.json({ success: true, url: imgResult.url, model: imgResult.model });
  } catch (error) {
    console.error('[Image Gen Error]:', error.message);
    const statusCode = error.message.includes('কনফিগার করা হয়নি') ? 503 : (error.message.includes('অতিরিক্ত সময়') ? 504 : 500);
    return res.status(statusCode).json({ success: false, error: error.message || 'ছবি তৈরি করতে সমস্যা হয়েছে।' });
  }
};

module.exports = { streamChatCompletions, generateImage, executeImageGeneration };


