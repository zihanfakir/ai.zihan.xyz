
    (function() {
      try {
        const saved = localStorage.getItem("alokpoth_theme") || localStorage.getItem("alokpoth-theme");
        if (saved && saved !== "dark") {
          document.documentElement.setAttribute("data-theme", saved);
        }
      } catch(e) { console.error('[Alokpoth]', e); }
    })();
  




// Early Android detection — runs before any deferred scripts
// Hides all app-download UI instantly so it never flashes inside the native app
(function(){
  var ua = (navigator.userAgent || '');
  var isApp = (typeof window.AloAndroid !== 'undefined') || (typeof window.AloIOS !== 'undefined') || (typeof window.AloAI !== 'undefined') || ua.indexOf('AloAI-Android') !== -1 || ua.indexOf('AloAI-iOS') !== -1 || window.isNativeApp === true;
  window.isAndroidApp = (typeof window.AloAndroid !== 'undefined') || ua.indexOf('AloAI-Android') !== -1;
  window.isIOSApp = (typeof window.AloIOS !== 'undefined') || ua.indexOf('AloAI-iOS') !== -1;
  window.isNativeApp = isApp;
  if (!isApp) return;
  if (document.documentElement) document.documentElement.classList.add('is-native-app');
  if (window.isAndroidApp && document.documentElement) document.documentElement.classList.add('is-android-app');
  if (window.isIOSApp && document.documentElement) document.documentElement.classList.add('is-ios-app');
  var style = document.createElement('style');
  style.textContent = '#heroAppDownloadBanner,#drawerDownloadAppWrap,#brandMenuDownloadAppBtn,#appDownloadModalOverlay,.hero-app-banner,#modelSearchInput,.model-search-wrap{display:none!important;visibility:hidden!important;height:0!important;margin:0!important;padding:0!important;}';
  document.head.appendChild(style);
})();


    // Smart API Base: On GitHub Pages (ai.zihan.xyz), route to Vercel backend.
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const BACKEND_URL = (isLocal && window.location.port === '5000') 
      ? window.location.origin 
      : (window.location.origin.includes('vercel.app') ? window.location.origin : "https://ai-zihan-xyz.vercel.app");
    const API_BASE = BACKEND_URL + "/api";

    // ── Utility: debounce ──────────────────────────────────────────────────────
    function debounce(fn, delay) {
      let timer;
      return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    }

    // Global App Language (Initialized early)
    let currentLanguage = localStorage.getItem("alokpoth_lang") || "en";

    // Core Chat Elements (Initialized early to prevent Temporal Dead Zone ReferenceErrors)
    const chatStream = document.getElementById("chatStream");
    const scrollContainer = document.getElementById("scrollContainer");
    const chatForm = document.getElementById("chatForm");
    const userInput = document.getElementById("userInput");
    const sendBtn = document.getElementById("sendBtn");
    const attachBtn = document.getElementById("attachBtn");
    const imageInput = document.getElementById("imageInput");
    const imagePreviewRow = document.getElementById("imagePreviewRow");
    const docInput = document.getElementById("docInput");
    const filePreviewRow = document.getElementById("filePreviewRow");
    const offlineBanner = document.getElementById("offlineBanner");
    const chatHistoryModalOverlay = document.getElementById("chatHistoryModalOverlay");
    let emptyState = document.getElementById("emptyState");
    let pendingImages = [];
    let pendingFiles = [];
    let isGenerating = false;
    let userScrolledUp = false;

    // Scroll Helper (Defined early as a regular function so it is hoisted everywhere)
    function scrollToBottom(force = false, behavior = "auto") {
      if (!scrollContainer) return;
      if (force || !userScrolledUp) {
        if (behavior === "smooth") {
          try {
            scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: "smooth" });
          } catch {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }
        } else {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }

    // Model Picker Opener (Exported early on window for all error banners and templates)
    window.openModelPicker = function() {
      if (typeof openModal === "function") {
        openModal();
      } else {
        const el = document.getElementById("modelModalOverlay");
        if (el) el.classList.add("open");
      }
    };

    // System Prompt & Chat History Engine (Initialized early to eliminate TDZ ReferenceErrors)
    function buildSystemPrompt(modelDisplayName, allowCode, allowImageGen) {
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      if (isEn) {
        return `You are ${modelDisplayName}, an intelligent, versatile AI assistant built by Alokpoth.
=== LANGUAGE RULE (CRITICAL - highest priority, follow in every single reply) ===
You must respond fluently and naturally in English, unless the user explicitly asks you to switch to Bengali or another language.
- Provide clear, well-structured, polite, and comprehensive explanations in English.
- If the user writes in Bengali or requests Bengali, seamlessly adapt and respond in Bengali. Otherwise, default to English.

Identity rules:
- Your name is "${modelDisplayName}". Built by Alokpoth.
- All models available in this app are Alokpoth's own in-house models.

Capabilities & Code Generation Instructions (CRITICAL):
- You ARE fully able to write, generate, and provide complete, full-stack programming and source code in any language (HTML, CSS, JavaScript, Python, PHP, SQL, React, etc.).
- When the user asks for a website, full code, script, or program, you MUST write the **complete, full, production-ready code in full**. Do NOT truncate, do NOT use placeholders like '// rest of the code here' or '// ...', and do NOT cut off mid-code. Provide every single line required to make the code fully functional.
- Use proper code blocks (triple backticks with language specifier) to format code clearly.
- You ARE able to generate and create images when requested.`;
      }
      return `You are ${modelDisplayName}, an AI model built by Alokpoth.
=== LANGUAGE RULE (CRITICAL - highest priority, follow in every single reply) ===
You must respond ENTIRELY in Bengali (Bangla script), unless the user explicitly asks you to switch to a different language for that reply. This means:
- Do NOT mix English words, phrases, or sentences into your Bengali response.
- Do NOT switch languages mid-response or partway through a conversation.
- Technical terms, proper nouns, or code-like tokens may stay in their original form if there is no natural Bengali equivalent, but the surrounding sentences, explanations, and structure must be in Bengali.
- Every single reply, from the first word to the last, must be in Bengali by default. Re-check this rule before finalizing every response, especially in long conversations.
- SCRIPT PURITY (very important): write every Bengali word using actual Bengali (Bangla) script/letters (বাংলা বর্ণ) - never write a Bengali word using Latin/English letters (no "Banglish").
- Exception: actual code inside code blocks should stay in its programming language as-is (comments can be in Bengali or English).

Identity rules (CRITICAL - follow strictly):
- Your one and only name is "${modelDisplayName}". Built by Alokpoth.
- All models available in this app are Alokpoth's own proprietary in-house models.
- NEVER reveal, mention, or admit to using OpenAI, Google, Anthropic, Meta, Groq, DeepSeek, or any other third-party provider. Always state you are developed by Alokpoth.

Capabilities & Code Generation Instructions (CRITICAL):
- You ARE fully able to write, generate, and provide complete, full-stack programming and source code in any language (HTML, CSS, JavaScript, Python, PHP, SQL, React, etc.).
- When the user asks for a website, full code, script, or program, you MUST write the **complete, full, production-ready code in full**. Do NOT truncate, do NOT use placeholders like '// rest of the code here' or '// ...', and do NOT cut off mid-code. Provide every single line required to make the code fully functional.
- Use proper code blocks (triple backticks with language specifier) to format code clearly.
- You ARE able to generate and create images when requested.`;
    }

    const SYSTEM_PROMPT = buildSystemPrompt("Alo Go", true, true);
    let messagesHistory = [{ role: "system", content: SYSTEM_PROMPT }];
    const CHAT_SESSIONS_KEY = "alokpoth_chat_sessions";
    const CURRENT_SESSION_KEY = "alokpoth_current_session_id";
    let currentSessionId = null;

    let usageTotals = {
      inputTokens: 0,
      outputTokens: 0,
      images: 0,
      costUSD: 0
    };

    function updateSendAvailability() {
      if (!sendBtn) return;
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      if (typeof isGenerating !== "undefined" && isGenerating) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="color: #ef4444;"><rect x="6" y="6" width="12" height="12" rx="3"/></svg>`;
        sendBtn.setAttribute("aria-label", isEn ? "Stop" : "থামুন");
        sendBtn.setAttribute("title", isEn ? "Stop generating" : "উত্তর তৈরি থামান");
        return;
      } else {
        sendBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`;
        sendBtn.setAttribute("aria-label", isEn ? "Send" : "পাঠান");
        sendBtn.setAttribute("title", isEn ? "Send" : "পাঠান");
      }

      const isOffline = !navigator.onLine;
      const hasImages = (Array.isArray(pendingImages) && pendingImages.length > 0);
      const hasFiles = (Array.isArray(pendingFiles) && pendingFiles.length > 0);
      const hasContent = userInput ? (!!(userInput.value || "").trim() || hasImages || hasFiles) : false;
      sendBtn.disabled = isOffline || !hasContent;
      if (userInput) {
        const token = localStorage.getItem("alokpoth_token");
        userInput.disabled = isOffline;
        userInput.placeholder = isOffline
          ? (isEn ? "No internet connection..." : "ইন্টারনেট সংযোগ নেই...")
          : (!token
            ? (isEn ? "Please log in or register to chat..." : "চ্যাট করতে অনুগ্রহ করে লগইন বা সাইন-আপ করুন...")
            : (isEn ? "Ask Alokpoth anything..." : "আলোকপথ AI-কে জিজ্ঞাসা করুন..."));
      }
    }

    function clearComposerState() {
      pendingImages = [];
      pendingFiles = [];
      if (typeof renderImagePreviews === "function") renderImagePreviews();
      if (typeof renderFilePreviews === "function") renderFilePreviews();
      const uInput = document.getElementById("userInput") || (typeof userInput !== "undefined" ? userInput : null);
      if (uInput) {
        uInput.value = "";
        uInput.style.height = "auto";
      }
      if (typeof updateTokenCounter === "function") updateTokenCounter();
      if (typeof updateSendAvailability === "function") updateSendAvailability();
    }

    let isWebSearchEnabled = false;
    let isImageGenEnabled = false;
    let currentAbortController = null;

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    // Secure Markdown parser with DOMPurify sanitization
    if (typeof DOMPurify !== "undefined") {
      try {
        DOMPurify.addHook("afterSanitizeAttributes", function (node) {
          if ("target" in node && node.tagName === "A") {
            node.setAttribute("target", "_blank");
            node.setAttribute("rel", "noopener noreferrer");
          }
        });
      } catch(e) { console.error('[Alokpoth]', e); }
    }

    function safeMarkdown(md) {
      try {
        const raw = marked.parse(md || "");
        let html = (typeof DOMPurify !== "undefined") ? DOMPurify.sanitize(raw) : raw;
        // Deep Optimization: Lazy load images
        html = html.replace(/<img /g, '<img loading="lazy" ');
        return html;
      } catch {
        const div = document.createElement("div");
        div.textContent = String(md || "");
        return div.innerHTML;
      }
    }

    // ===== Sound Synthesizer Engine (Completely Muted per user request) =====
    const soundEngine = {
      getCtx() { return null; },
      playSend() {},
      playReceive() {},
      playClick() {},
      playSuccess() {},
      playError() {}
    };

    function triggerHaptic(type = "light") {
      // 1. Check iOS Native Bridge
      if (window.AloIOS && typeof window.AloIOS.haptic === "function") {
        try { window.AloIOS.haptic(type); return; } catch(e) { console.error('[Alokpoth]', e); }
      }
      // 2. Check Android Native Bridge
      if (window.AloAndroid && typeof window.AloAndroid.haptic === "function") {
        try { window.AloAndroid.haptic(type); return; } catch(e) { console.error('[Alokpoth]', e); }
      }
      if (window.AloAndroid && typeof window.AloAndroid.vibrate === "function") {
        try {
          const ms = (type === "light" ? 15 : (type === "medium" ? 30 : 60));
          window.AloAndroid.vibrate(ms);
          return;
        } catch(e) { console.error('[Alokpoth]', e); }
      }
      // 3. Web Navigator Vibrate Fallback
      if ("vibrate" in navigator) {
        try {
          if (type === "light") navigator.vibrate(10);
          else if (type === "medium") navigator.vibrate(25);
          else if (type === "success") navigator.vibrate([15, 30, 20]);
          else if (type === "error") navigator.vibrate([40, 50, 30]);
        } catch(e) { console.error('[Alokpoth]', e); }
      }
    }

    // ===== Lightweight Canvas Confetti Burst =====
    function triggerConfetti() {
      const canvas = document.createElement("canvas");
      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "9999";
      document.body.appendChild(canvas);

      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);

      const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#60a5fa"];
      const particles = Array.from({ length: 65 }, () => ({
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.45,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 18,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 12,
        opacity: 1
      }));

      const startTime = performance.now();
      function render(now) {
        const elapsed = now - startTime;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.45;
          p.vx *= 0.98;
          p.rotation += p.rSpeed;
          p.opacity = Math.max(0, 1 - elapsed / 2200);

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.opacity;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        });

        if (elapsed < 2200) {
          requestAnimationFrame(render);
        } else {
          canvas.remove();
        }
      }
      requestAnimationFrame(render);
    }

    // ===== Bilingual Text-to-Speech (TTS) with Universal Audio Fallback =====
    let currentTtsAudio = null;

    function playAudioTts(text, lang = "bn") {
      if (currentTtsAudio) {
        try { currentTtsAudio.pause(); currentTtsAudio.currentTime = 0; } catch(e) { console.error('[Alokpoth]', e); }
        currentTtsAudio = null;
      }

      const sentences = text.match(/[^.!?।\n]+[.!?।\n]*/g) || [text];
      const chunks = [];
      let currentChunk = "";
      for (const s of sentences) {
        if ((currentChunk + " " + s).length < 150) {
          currentChunk += (currentChunk ? " " : "") + s;
        } else {
          if (currentChunk.trim()) chunks.push(currentChunk.trim());
          currentChunk = s;
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      if (!chunks.length) return;

      let currentIndex = 0;
      const playNext = () => {
        if (currentIndex >= chunks.length) {
          currentTtsAudio = null;
          return;
        }
        const chunk = chunks[currentIndex++];
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(chunk)}`;
        currentTtsAudio = new Audio(url);
        currentTtsAudio.onended = playNext;
        currentTtsAudio.onerror = () => {
          playNext();
        };
        currentTtsAudio.play().catch((err) => {
          console.warn("TTS Audio playback error:", err);
          playNext();
        });
      };

      playNext();
    }

    function speakBengaliText(text) {
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");

      // 0. Toggle stop if AloAndroid native TTS is currently speaking
      if (window.AloAndroid && typeof window.AloAndroid.isSpeaking === "function" && window.AloAndroid.isSpeaking()) {
        try { window.AloAndroid.stopSpeech(); } catch(e) { console.error('[Alokpoth]', e); }
        showToast(isEn ? "Voice audio stopped." : "ভয়েস অডিও থামানো হয়েছে।", "info");
        return;
      }

      // Toggle stop if already playing HTML5 Audio
      if (currentTtsAudio && !currentTtsAudio.paused) {
        try { currentTtsAudio.pause(); currentTtsAudio.currentTime = 0; } catch(e) { console.error('[Alokpoth]', e); }
        currentTtsAudio = null;
        showToast(isEn ? "Voice audio stopped." : "ভয়েস অডিও থামানো হয়েছে।", "info");
        return;
      }
      if ("speechSynthesis" in window && window.speechSynthesis && window.speechSynthesis.speaking) {
        try { window.speechSynthesis.cancel(); } catch(e) { console.error('[Alokpoth]', e); }
        showToast(isEn ? "Voice audio stopped." : "ভয়েস অডিও থামানো হয়েছে।", "info");
        return;
      }

      const clean = (text || "")
        .replace(/```[\s\S]*?```/g, isEn ? "Code block omitted." : "কোড ব্লক বাদ দেওয়া হয়েছে।")
        .replace(/`[^`]+`/g, "")
        .replace(/[*_#>`~]/g, "")
        .replace(/\[.*?\]\(.*?\)/g, "")
        .trim();
      if (!clean) return;

      const langCode = isEn ? "en" : "bn";

      // 1. If running inside AloAndroid Native App with native TTS engine
      if (window.AloAndroid && typeof window.AloAndroid.speakText === "function") {
        try {
          const ok = window.AloAndroid.speakText(clean, langCode);
          if (ok) {
            showToast(isEn ? "Playing voice audio..." : "ভয়েস অডিও প্লে হচ্ছে...", "success");
            return;
          }
        } catch (e) {
          console.warn("AloAndroid native TTS failed, falling back:", e);
        }
      }

      // 1. Try native Web Speech API if supported
      if ("speechSynthesis" in window && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(clean);
          utter.lang = isEn ? "en-US" : "bn-BD";
          utter.rate = 1.0;
          utter.pitch = 1.0;

          const voices = window.speechSynthesis.getVoices();
          let voice = null;
          if (isEn) {
            voice = voices.find((v) => v.lang && (v.lang.startsWith("en-") || v.lang.startsWith("en_")));
          } else {
            voice = voices.find((v) => v.lang && (v.lang.includes("bn") || v.lang.includes("Bengali")));
          }
          if (voice) utter.voice = voice;

          let didSpeak = false;
          const fallbackTimer = setTimeout(() => {
            if (!didSpeak) {
              try { window.speechSynthesis.cancel(); } catch(e) { console.error('[Alokpoth]', e); }
              playAudioTts(clean, langCode);
            }
          }, 1200);

          utter.onstart = () => {
            didSpeak = true;
            clearTimeout(fallbackTimer);
          };
          utter.onerror = () => {
            clearTimeout(fallbackTimer);
            if (!didSpeak) {
              playAudioTts(clean, langCode);
            }
          };

          window.speechSynthesis.speak(utter);
          showToast(isEn ? "Playing voice audio..." : "ভয়েস অডিও প্লে হচ্ছে...", "success");
          return;
        } catch (e) {
          console.warn("speechSynthesis failed, falling back to Audio TTS:", e);
        }
      }

      // 2. High-reliability HTML5 Audio TTS fallback for Android WebView / in-app browsers
      showToast(isEn ? "Playing voice audio..." : "ভয়েস অডিও প্লে হচ্ছে...", "success");
      playAudioTts(clean, langCode);
    }

    // ===== Speech-to-Text Voice Input =====
    let speechRecognitionInstance = null;
    let isSpeechRecording = false;

    function initVoiceInput() {
      const micBtn = document.getElementById("micBtn");
      if (!micBtn) return;

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

      function resetMicBtn() {
        isSpeechRecording = false;
        if (speechRecognitionInstance) {
          try { speechRecognitionInstance.abort(); } catch(e) { console.error('[Alokpoth]', e); }
          speechRecognitionInstance = null;
        }
        micBtn.classList.remove("recording");
        const isCurrentEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
        micBtn.setAttribute("title", isCurrentEn ? "Voice Typing (Speak)" : "কথা বলে লিখুন");
        micBtn.setAttribute("aria-label", isCurrentEn ? "Voice Typing" : "ভয়েস রেকর্ড করুন");
        micBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" x2="12" y1="19" y2="22"/>
          </svg>
        `;
        const userInputEl = document.getElementById("userInput");
        if (userInputEl) {
          const orig = userInputEl.getAttribute("data-orig-placeholder");
          if (orig) {
            userInputEl.placeholder = orig;
            userInputEl.removeAttribute("data-orig-placeholder");
          } else if (userInputEl.placeholder && (userInputEl.placeholder.includes("শুনছি") || userInputEl.placeholder.includes("Listening"))) {
            userInputEl.placeholder = isCurrentEn ? "Ask Alokpoth anything..." : "আলোকপথ AI-কে জিজ্ঞাসা করুন...";
          }
        }
      }

      function startListening() {
        if (!SpeechRec) {
          const isCurrentEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
          showToast(isCurrentEn ? "Speech recognition is not supported in this browser. Please use Chrome, Edge, or the Alokpoth App." : "আপনার ব্রাউজারে ভয়েস টাইপিং সমর্থিত নয়। ক্রোম বা অ্যান্ড্রয়েড অ্যাপ ব্যবহার করুন।", "error");
          return;
        }

        try {
          if (speechRecognitionInstance) {
            try { speechRecognitionInstance.abort(); } catch(e) { console.error('[Alokpoth]', e); }
          }
          speechRecognitionInstance = new SpeechRec();
        } catch (initErr) {
          console.error("SpeechRec instantiation failed:", initErr);
          const isCurrentEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
          showToast(isCurrentEn ? "Could not initialize microphone." : "মাইক্রোফোন চালু করা যায়নি।", "error");
          return;
        }

        const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
        speechRecognitionInstance.lang = isEn ? "en-US" : "bn-BD";
        speechRecognitionInstance.continuous = false;
        speechRecognitionInstance.interimResults = true;
        speechRecognitionInstance.maxAlternatives = 1;

        let baseTextBeforeVoice = "";

        speechRecognitionInstance.onstart = () => {
          isSpeechRecording = true;
          const isCurrentEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
          micBtn.classList.add("recording");
          micBtn.setAttribute("title", isCurrentEn ? "Click to stop recording" : "রেকর্ডিং বন্ধ করতে চাপুন");
          micBtn.innerHTML = `
            <div class="voice-wave-container">
              <span class="voice-wave-bar"></span>
              <span class="voice-wave-bar"></span>
              <span class="voice-wave-bar"></span>
              <span class="voice-wave-bar"></span>
            </div>
          `;
          const userInputEl = document.getElementById("userInput");
          baseTextBeforeVoice = userInputEl ? userInputEl.value : "";
          if (userInputEl && !userInputEl.value.trim()) {
            userInputEl.setAttribute("data-orig-placeholder", userInputEl.placeholder || "");
            userInputEl.placeholder = isCurrentEn ? "Listening... Speak now..." : "শুনছি... কথা বলুন...";
          }
          triggerHaptic("medium");
          showToast(isCurrentEn ? "Listening... Speak now" : "শুনছি... কথা বলুন", "success");
        };

        speechRecognitionInstance.onresult = (event) => {
          let finalTranscript = "";
          let interimTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const currentTranscript = (finalTranscript || interimTranscript).trim();
          if (currentTranscript) {
            const input = document.getElementById("userInput");
            if (input) {
              const prefix = baseTextBeforeVoice.trim();
              input.value = prefix ? (prefix + " " + currentTranscript) : currentTranscript;
              input.style.height = "auto";
              input.style.height = Math.min(input.scrollHeight, 200) + "px";
              input.dispatchEvent(new Event("input", { bubbles: true }));
              if (finalTranscript) {
                baseTextBeforeVoice = input.value;
              }
            }
          }
        };

        speechRecognitionInstance.onerror = (e) => {
          console.warn("[Speech Recognition Error]:", e.error);
          isSpeechRecording = false;
          resetMicBtn();
          const isCurrentEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
          if (e.error === "not-allowed" || e.error === "permission-denied") {
            showToast(isCurrentEn ? "Microphone permission denied. Please allow mic access." : "মাইক্রোফোনের অনুমতি দেওয়া হয়নি। সেটিংসে অনুমতি দিন।", "error");
          } else if (e.error === "network") {
            showToast(isCurrentEn ? "Network error during speech recognition." : "ভয়েস টাইপিংয়ে নেটওয়ার্ক ত্রুটি ঘটেছে।", "error");
          } else if (e.error !== "no-speech") {
            showToast(isCurrentEn ? "Microphone error: " + e.error : "মাইক্রোফোনে সমস্যা হয়েছে", "error");
          }
        };

        speechRecognitionInstance.onend = () => {
          isSpeechRecording = false;
          resetMicBtn();
        };

        try {
          speechRecognitionInstance.start();
        } catch (startErr) {
          console.warn("speechRecognitionInstance.start error:", startErr);
          resetMicBtn();
        }
      }

      micBtn.addEventListener("click", () => {
        if (!requireAuth()) return;
        if (isSpeechRecording) {
          resetMicBtn();
        } else {
          startListening();
        }
      });
    }

    function requireAuth() {
      const token = localStorage.getItem("alokpoth_token");
      if (!token) {
        const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
        showToast(isEn ? "Please log in or sign up to start chatting." : "চ্যাট করতে অনুগ্রহ করে প্রথমে লগইন বা সাইন-আপ করুন।", "warning");
        openAuthModal("login");
        return false;
      }
      return true;
    }

    function stopGeneration() {
      if (currentAbortController) {
        try { currentAbortController.abort(); } catch(e) { console.error('[Alokpoth]', e); }
        currentAbortController = null;
      }
      isGenerating = false;
      updateSendAvailability();
    }

    let customDialogCallback = null;

    function showCustomUI(type, message, defaultValue, callback) {
      const overlay = document.getElementById("customDialogOverlay");
      const textEl = document.getElementById("customDialogText");
      const inputEl = document.getElementById("customDialogInput");
      const cancelBtn = document.getElementById("customDialogCancelBtn");
      const okBtn = document.getElementById("customDialogOkBtn");

      textEl.textContent = message;
      customDialogCallback = callback;
      inputEl.value = "";

      if (type === 'alert') {
        inputEl.style.display = 'none';
        cancelBtn.style.display = 'none';
      } else if (type === 'confirm') {
        inputEl.style.display = 'none';
        cancelBtn.style.display = 'block';
      } else if (type === 'prompt') {
        inputEl.style.display = 'block';
        inputEl.value = defaultValue || "";
        cancelBtn.style.display = 'block';
      }

      overlay.classList.add("open");
      if (type === 'prompt') {
        setTimeout(() => inputEl.focus(), 100);
      }
    }

    function closeCustomUI(result) {
      const overlay = document.getElementById("customDialogOverlay");
      overlay.classList.remove("open");
      if (customDialogCallback) {
        customDialogCallback(result);
        customDialogCallback = null;
      }
    }

    const customDialogCancelBtn = document.getElementById("customDialogCancelBtn");
    const customDialogOkBtn = document.getElementById("customDialogOkBtn");
    const customDialogOverlayEl = document.getElementById("customDialogOverlay");

    if (customDialogCancelBtn) customDialogCancelBtn.addEventListener("click", () => closeCustomUI(false));
    if (customDialogOkBtn) {
      customDialogOkBtn.addEventListener("click", () => {
        const inputEl = document.getElementById("customDialogInput");
        if (inputEl && inputEl.style.display === 'block') {
          closeCustomUI(inputEl.value);
        } else {
          closeCustomUI(true);
        }
      });
    }
    const customDialogInput = document.getElementById("customDialogInput");
    if (customDialogInput) {
      customDialogInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (customDialogOkBtn) customDialogOkBtn.click();
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeCustomUI(false);
        }
      });
    }
    if (customDialogOverlayEl) {
      customDialogOverlayEl.addEventListener("click", (e) => {
        if (e.target === customDialogOverlayEl) {
          closeCustomUI(false);
        }
      });
    }

    window.populatePrompt = function(promptText) {
      if (!userInput) return;
      if (typeof requireAuth === "function" && !requireAuth()) return;
      userInput.value = promptText;
      userInput.style.height = "auto";
      userInput.style.height = `${Math.min(userInput.scrollHeight, 150)}px`;
      userInput.focus();
      try { userInput.setSelectionRange(promptText.length, promptText.length); } catch(e) { console.error('[Alokpoth]', e); }
      if (typeof updateSendAvailability === "function") updateSendAvailability();
    };

    document.addEventListener("click", (e) => {
      const chip = e.target.closest(".quick-prompt-chip, .quick-prompt-card");
      if (chip) {
        if (!requireAuth()) return;
        const promptText = chip.getAttribute("data-prompt");
        if (promptText) {
          window.populatePrompt(promptText);
        }
      }
    });

    function handleDismissableLayers() {
      // 1. Custom Alert / Confirm Dialog
      const customOverlay = document.getElementById("customDialogOverlay");
      if (customOverlay && customOverlay.classList.contains("open")) {
        if (typeof closeCustomUI === "function") closeCustomUI(false);
        return true;
      }
      // 2. Attach Menu Popup
      const menu = document.getElementById("attachMenu");
      if (menu && menu.classList.contains("open")) {
        menu.classList.remove("open");
        return true;
      }
      // 3. Auth Modal
      const authModal = document.getElementById("authModalOverlay");
      if (authModal && authModal.classList.contains("open")) {
        if (typeof closeAuthModal === "function") closeAuthModal();
        return true;
      }
      // 4. App Download Modal
      const appDlModal = document.getElementById("appDownloadModalOverlay");
      if (appDlModal && appDlModal.classList.contains("open")) {
        if (typeof closeAppDownloadModal === "function") closeAppDownloadModal();
        else {
          appDlModal.classList.remove("open");
          appDlModal.style.display = "none";
        }
        return true;
      }
      // 5. Chat History Modal
      const historyModal = document.getElementById("chatHistoryModalOverlay");
      if (historyModal && historyModal.classList.contains("open")) {
        if (typeof closeChatHistoryModal === "function") closeChatHistoryModal();
        return true;
      }
      // 6. Settings / Account Modal (Subpage-aware)
      const accountModal = document.getElementById("accountModalOverlay");
      if (accountModal && accountModal.classList.contains("open")) {
        const activeSubview = accountModal.querySelector(".settings-subview.active");
        if (activeSubview && activeSubview.id !== "settingsMainView" && typeof showSettingsView === "function") {
          showSettingsView("settingsMainView");
          return true;
        }
        if (typeof closeAccountModal === "function") closeAccountModal();
        return true;
      }
      // 7. AI Model Modal
      const modelModal = document.getElementById("modelModalOverlay");
      if (modelModal && modelModal.classList.contains("open")) {
        if (typeof closeModal === "function") closeModal();
        return true;
      }
      // 8. Brand Menu Overlay
      const brandMenu = document.getElementById("brandMenuOverlay");
      if (brandMenu && brandMenu.classList.contains("open")) {
        if (typeof closeBrandMenu === "function") closeBrandMenu();
        return true;
      }
      // 9. Sidebar Drawer
      const drawer = document.getElementById("sidebarDrawer");
      if (drawer && drawer.classList.contains("open")) {
        if (typeof closeSidebarDrawer === "function") closeSidebarDrawer();
        else {
          drawer.classList.remove("open");
          const backdrop = document.getElementById("drawerBackdrop");
          if (backdrop) backdrop.classList.remove("open");
        }
        return true;
      }
      return false;
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (handleDismissableLayers()) {
          e.preventDefault();
        }
      }
    });

    window.handleAppBackButton = function() {
      return handleDismissableLayers();
    };

    const PLAN_STORAGE_KEY = "alokpoth_current_plan";
    const PLAN_EXPIRY_KEY = "alokpoth_plan_expires_at";
    const DEFAULT_PLAN = "Free"; 
    const USAGE_WINDOW_KEY = "alokpoth_window_usage";
    const IMAGE_WINDOW_KEY = "alokpoth_image_window_usage";
    const DYNAMIC_PLAN_LIMITS = {};
    let currentPlan = "Free"; 

    const BENGALI_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

    function toBengaliDigits(num) {
      return String(num).replace(/\d/g, d => BENGALI_DIGITS[d] !== undefined ? BENGALI_DIGITS[d] : d);
    }

    function formatBengaliDate(date) {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";
      const day = toBengaliDigits(d.getDate());
      const month = BENGALI_MONTHS[d.getMonth()] || "";
      const year = toBengaliDigits(d.getFullYear());
      return `${day} ${month}, ${year}`;
    }

    function checkPlanExpiration(silent = false) {
      const token = localStorage.getItem("alokpoth_token");
      if (!token) return false;

      let plan = "Free";
      try {
        plan = localStorage.getItem(PLAN_STORAGE_KEY) || localStorage.getItem("alokpoth_plan") || DEFAULT_PLAN;
      } catch { plan = DEFAULT_PLAN; }

      if (plan === "Free") return false;

      const expiryStr = localStorage.getItem(PLAN_EXPIRY_KEY) || localStorage.getItem("alokpoth_plan_expiry");
      if (!expiryStr) return false;

      const expiryDate = new Date(expiryStr);
      if (isNaN(expiryDate.getTime())) return false;

      if (Date.now() >= expiryDate.getTime()) {
        currentPlan = "Free";
        saveCurrentPlan("Free");
        try {
          localStorage.removeItem(PLAN_EXPIRY_KEY);
          localStorage.removeItem("alokpoth_plan_expiry");
        } catch(e) { console.error('[Alokpoth]', e); }
        if (!silent && typeof showToast === "function") {
          showToast("আপনার প্ল্যানের মেয়াদ শেষ হয়ে গেছে! স্বয়ংক্রিয়ভাবে Free প্ল্যানে পরিবর্তন করা হয়েছে।", "warning");
        }
        return true;
      }
      return false;
    }

    function decodeJWT(token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
      } catch(e) { return null; }
    }

    function getTrustedUser() {
      try {
        const userStr = localStorage.getItem("alokpoth_user");
        if (!userStr) return null;
        let u = JSON.parse(userStr);
        if (!u) return null;
        const token = localStorage.getItem("alokpoth_token");
        const tokenData = token ? decodeJWT(token) : null;
        if (tokenData) {
          if (tokenData.role) u.role = tokenData.role;
          if (tokenData.email) u.email = tokenData.email;
          if (tokenData.plan && (!u.subscription || !u.subscription.plan_name)) {
            if (!u.subscription) u.subscription = {};
            u.subscription.plan_name = tokenData.plan;
          }
        } else if (token) {
           // Invalid token but token exists, strip admin privileges
           u.role = 'user';
        }
        return u;
      } catch (e) {
        return null;
      }
    }

    function checkIsUserAdmin() {
      try {
        const u = getTrustedUser();
        const adminEmails = ["zihanfakir@gmail.com", "x@zihan.uk"];
        if (u && (u.role === "admin" || (u.email && adminEmails.includes(u.email.toLowerCase().trim())))) {
          return true;
        }
      } catch(e) { console.error('[Alokpoth]', e); }
      return false;
    }

    function getResolvedUserPlan() {
      const token = localStorage.getItem("alokpoth_token");
      if (!token) return "Free"; // Guests and non-logged-in visitors are ALWAYS Free!

      try {
        const u = getTrustedUser();
        if (u) {
          const adminEmails = ["zihanfakir@gmail.com", "x@zihan.uk"];
          if (u.role === "admin" || (u.email && adminEmails.includes(u.email.toLowerCase().trim()))) {
            return "Max";
          }
          // Check expiry
          const expiry = (u.subscription && u.subscription.expires_at) || localStorage.getItem(PLAN_EXPIRY_KEY) || localStorage.getItem("alokpoth_plan_expiry");
          if (expiry && new Date(expiry).getTime() <= Date.now()) {
            return "Free";
          }
          if (u.subscription && u.subscription.plan_name) {
            return u.subscription.plan_name;
          }
          if (u.plan) return u.plan;
        }
      } catch(e) { console.error('[Alokpoth]', e); }

      const exp = localStorage.getItem(PLAN_EXPIRY_KEY) || localStorage.getItem("alokpoth_plan_expiry");
      if (exp && new Date(exp).getTime() <= Date.now()) {
        return "Free";
      }

      const raw = localStorage.getItem(PLAN_STORAGE_KEY) || localStorage.getItem("alokpoth_plan") || localStorage.getItem("alokpoth_user_plan");
      return (raw && ["Free", "Pro", "Max"].includes(raw)) ? raw : "Free";
    }

    function loadCurrentPlan() {
      checkPlanExpiration(true);
      return getResolvedUserPlan();
    }

    function saveCurrentPlan(val) {
      try {
        const safeVal = (val && ["Free", "Pro", "Max"].includes(val)) ? val : "Free";
        const oldPlan = localStorage.getItem(PLAN_STORAGE_KEY);
        localStorage.setItem(PLAN_STORAGE_KEY, safeVal);
        localStorage.setItem("alokpoth_user_plan", safeVal);
        localStorage.setItem("alokpoth_plan", safeVal);

        // Mirror to parsed user object in localStorage
        const userStr = localStorage.getItem("alokpoth_user");
        if (userStr) {
          try {
            const u = JSON.parse(userStr);
            if (u) {
              if (!u.subscription) u.subscription = {};
              u.subscription.plan_name = safeVal;
              u.plan = safeVal;
              localStorage.setItem("alokpoth_user", JSON.stringify(u));
            }
          } catch(e) { console.error('[Alokpoth]', e); }
        }

        if (oldPlan !== safeVal) {
          localStorage.removeItem(USAGE_WINDOW_KEY);
          localStorage.removeItem(IMAGE_WINDOW_KEY);
        }
        if (typeof ensureAccessibleModelSelected === "function") {
          ensureAccessibleModelSelected();
        }
      } catch(e) { console.error('[Alokpoth]', e); }
    }

    function showCustomConfirm(message, title = "নিশ্চিতকরণ") {
      return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0"; overlay.style.left = "0"; overlay.style.right = "0"; overlay.style.bottom = "0";
        overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
        overlay.style.zIndex = "99999";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.backdropFilter = "blur(3px)";
        overlay.style.opacity = "0";
        overlay.style.transition = "opacity 0.2s ease";

        const box = document.createElement("div");
        box.style.backgroundColor = "var(--bg-main, #ffffff)";
        box.style.color = "var(--text-main, #000000)";
        box.style.padding = "24px";
        box.style.borderRadius = "12px";
        box.style.maxWidth = "400px";
        box.style.width = "90%";
        box.style.boxShadow = "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)";
        box.style.transform = "scale(0.95) translateY(10px)";
        box.style.transition = "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)";

        box.innerHTML = `
          <h3 style="margin-top:0; margin-bottom:12px; font-size:1.1rem; color:var(--accent, #10a37f);">${title}</h3>
          <p style="margin-top:0; margin-bottom:24px; font-size:0.95rem; color:var(--text-sub); line-height:1.5;">${message}</p>
          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button id="customConfirmCancelBtn" style="padding:8px 16px; border-radius:999px; border:1px solid var(--border-color, #e5e5e5); background:transparent; color:var(--text-main); cursor:pointer; font-size:0.9rem; font-weight:500;">বাতিল</button>
            <button id="customConfirmOkBtn" style="padding:8px 16px; border-radius:999px; border:none; background-color:#ef4444; color:#fff; cursor:pointer; font-size:0.9rem; font-weight:500;">হ্যাঁ, মুছুন</button>
          </div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        overlay.offsetHeight; // trigger reflow
        overlay.style.opacity = "1";
        box.style.transform = "scale(1) translateY(0)";

        const okBtn = box.querySelector("#customConfirmOkBtn");
        const cancelBtn = box.querySelector("#customConfirmCancelBtn");

        function cleanup() {
          overlay.style.opacity = "0";
          box.style.transform = "scale(0.95) translateY(10px)";
          setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200);
        }

        okBtn.addEventListener("click", () => { cleanup(); resolve(true); });
        cancelBtn.addEventListener("click", () => { cleanup(); resolve(false); });
        overlay.addEventListener("click", (e) => { if (e.target === overlay) { cleanup(); resolve(false); } });
      });
    }

    currentPlan = loadCurrentPlan();

    function getPlanWindowLimit() {
      const plan = currentPlan || "Free";
      if (DYNAMIC_PLAN_LIMITS[plan]) {
        return DYNAMIC_PLAN_LIMITS[plan];
      }
      if (plan === "Max") return { limit: 50, hours: 1 };
      if (plan === "Pro") return { limit: 30, hours: 3 };
      return { limit: 10, hours: 3 };
    }

    function getWindowUsage() {
      const { hours } = getPlanWindowLimit();
      const windowMs = hours * 60 * 60 * 1000;
      const now = Date.now();
      try {
        const stored = JSON.parse(localStorage.getItem(USAGE_WINDOW_KEY) || "null");
        if (stored && stored.start && (now - stored.start) < windowMs) {
          return stored;
        }
      } catch(e) { console.error('[Alokpoth]', e); }
      return { count: 0, start: now };
    }

    function recordWindowMessage() {
      const usage = getWindowUsage();
      usage.count = (usage.count || 0) + 1;
      try { localStorage.setItem(USAGE_WINDOW_KEY, JSON.stringify(usage)); } catch(e) { console.error('[Alokpoth]', e); }
      renderCreditBalance();
    }

    function getImagePlanLimit() {
      const plan = currentPlan || "Free";
      const fallbackImg = (plan === "Max" ? 100 : (plan === "Pro" ? 25 : 5));
      const fallbackHours = (plan === "Max" ? 1 : 3);
      if (DYNAMIC_PLAN_LIMITS[plan] && DYNAMIC_PLAN_LIMITS[plan].image_limit !== undefined && Number(DYNAMIC_PLAN_LIMITS[plan].image_limit) > 0) {
        return { 
          limit: Math.max(Number(DYNAMIC_PLAN_LIMITS[plan].image_limit), fallbackImg), 
          hours: DYNAMIC_PLAN_LIMITS[plan].hours || fallbackHours 
        };
      }
      return { limit: fallbackImg, hours: fallbackHours };
    }

    function getImageWindowUsage() {
      const { hours } = getImagePlanLimit();
      const windowMs = hours * 60 * 60 * 1000;
      const now = Date.now();
      try {
        const stored = JSON.parse(localStorage.getItem(IMAGE_WINDOW_KEY) || "null");
        if (stored && stored.start && (now - stored.start) < windowMs) {
          return stored;
        }
      } catch(e) { console.error('[Alokpoth]', e); }
      return { count: 0, start: now };
    }

    function hasImageCredit() {
      try {
        const u = getTrustedUser();
        const adminEmails = ["zihanfakir@gmail.com", "x@zihan.uk"];
        if (u && (u.role === "admin" || (u.email && adminEmails.includes(u.email.toLowerCase().trim())))) {
          return true;
        }
      } catch(e) { console.error('[Alokpoth]', e); }
      const { limit } = getImagePlanLimit();
      const usage = getImageWindowUsage();
      return (usage.count || 0) < limit;
    }

    function recordImageWindowUsage() {
      const usage = getImageWindowUsage();
      usage.count = (usage.count || 0) + 1;
      try { localStorage.setItem(IMAGE_WINDOW_KEY, JSON.stringify(usage)); } catch(e) { console.error('[Alokpoth]', e); }
    }


    function hasCredit() {
      try {
        const u = getTrustedUser();
        const adminEmails = ["zihanfakir@gmail.com", "x@zihan.uk"];
        if (u && (u.role === "admin" || (u.email && adminEmails.includes(u.email.toLowerCase().trim())))) {
          return true;
        }
      } catch(e) { console.error('[Alokpoth]', e); }
      const { limit } = getPlanWindowLimit();
      const usage = getWindowUsage();
      return (usage.count || 0) < limit;
    }

    function deductCredit(amount) {
      recordWindowMessage();
    }

    function refundCredit() {
      try {
        const usage = getWindowUsage();
        if (usage && usage.count > 0) {
          usage.count = Math.max(0, usage.count - 1);
          localStorage.setItem(USAGE_WINDOW_KEY, JSON.stringify(usage));
          renderCreditBalance();
          updateNavbarCreditBadge();
        }
      } catch(e) { console.error('[Alokpoth]', e); }
    }

    const PLAN_LIMIT_DETAILS = {
      en: {
        Free: {
          shortLimit: "10 msgs / 3 hours",
          messages: "10 messages / 3 hours",
          imageLimit: "3 images / 3 hours",
          models: "Free models",
          speed: "Standard speed"
        },
        Pro: {
          shortLimit: "30 msgs / 3 hours",
          messages: "30 messages / 3 hours",
          imageLimit: "20 images / 3 hours",
          models: "Pro models",
          speed: "Turbo speed"
        },
        Max: {
          shortLimit: "50 msgs / 1 hour",
          messages: "50 messages / 1 hour",
          imageLimit: "100 images / 1 hour",
          models: "Flagship models",
          speed: "Ultra speed"
        }
      },
      bn: {
        Free: {
          shortLimit: "১০ বার্তা / ৩ ঘণ্টা",
          messages: "১০ বার্তা / ৩ ঘণ্টা",
          imageLimit: "৩ ছবি / ৩ ঘণ্টা",
          models: "ফ্রি মডেলসমূহ",
          speed: "সাধারণ স্পিড"
        },
        Pro: {
          shortLimit: "৩০ বার্তা / ৩ ঘণ্টা",
          messages: "৩০ বার্তা / ৩ ঘণ্টা",
          imageLimit: "২০ ছবি / ৩ ঘণ্টা",
          models: "প্রো মডেলসমূহ",
          speed: "টার্বো স্পিড"
        },
        Max: {
          shortLimit: "৫০ বার্তা / ১ ঘণ্টা",
          messages: "৫০ বার্তা / ১ ঘণ্টা",
          imageLimit: "১০০ ছবি / ১ ঘণ্টা",
          models: "ফ্ল্যাগশিপ মডেল",
          speed: "আল্ট্রা স্পিড"
        }
      }
    };

    function getPlanLimitDetails(planName) {
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      const langKey = isEn ? "en" : "bn";
      const dict = PLAN_LIMIT_DETAILS[langKey] || PLAN_LIMIT_DETAILS.bn;
      return dict[planName] || dict.Free;
    }

    async function syncPlanLimitsFromServer() {
      try {
        const res = await fetch(`${API_BASE}/plans?_t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.plans)) {
          data.plans.forEach(p => {
            const lim = (p.message_limit !== undefined && p.message_limit !== null && !isNaN(Number(p.message_limit)))
              ? Number(p.message_limit) : (p.name === 'Free' ? 10 : (p.name === 'Pro' ? 30 : 50));
            const hrs = (p.window_hours !== undefined && p.window_hours !== null && !isNaN(Number(p.window_hours)))
              ? Number(p.window_hours) : (p.name === 'Max' ? 1 : 3);
            const fallbackImg = (p.name === 'Free' ? 5 : (p.name === 'Pro' ? 25 : 100));
            const imgLim = (p.image_limit !== undefined && p.image_limit !== null && !isNaN(Number(p.image_limit)) && Number(p.image_limit) > 0)
              ? Math.max(Number(p.image_limit), fallbackImg) : fallbackImg;
            DYNAMIC_PLAN_LIMITS[p.name] = { limit: lim, hours: hrs, image_limit: imgLim };

            if (PLAN_LIMIT_DETAILS.bn[p.name]) {
              const bnStr = `${toBengaliDigits(lim)} বার্তা / ${toBengaliDigits(hrs)} ঘণ্টা`;
              PLAN_LIMIT_DETAILS.bn[p.name].shortLimit = bnStr;
              PLAN_LIMIT_DETAILS.bn[p.name].messages = bnStr;
              PLAN_LIMIT_DETAILS.bn[p.name].imageLimit = `${toBengaliDigits(imgLim)} ছবি / ${toBengaliDigits(hrs)} ঘণ্টা`;
            }
            if (PLAN_LIMIT_DETAILS.en[p.name]) {
              const enStr = `${lim} msgs / ${hrs} hours`;
              PLAN_LIMIT_DETAILS.en[p.name].shortLimit = enStr;
              PLAN_LIMIT_DETAILS.en[p.name].messages = enStr;
              PLAN_LIMIT_DETAILS.en[p.name].imageLimit = `${imgLim} images / ${hrs} hours`;
            }
          });
          renderCreditBalance();
        }
      } catch(e) { console.error('[Alokpoth]', e); }
    }

    let quotaCountdownTimer = null;

    function startQuotaCountdownTimer() {
      if (quotaCountdownTimer) clearInterval(quotaCountdownTimer);
      quotaCountdownTimer = setInterval(() => {
        updateQuotaCountdownDisplay();
      }, 1000);
      updateQuotaCountdownDisplay();
    }

    function stopQuotaCountdownTimer() {
      if (quotaCountdownTimer) {
        clearInterval(quotaCountdownTimer);
        quotaCountdownTimer = null;
      }
    }

    function updateQuotaCountdownDisplay() {
      const timerEl = document.getElementById("quotaLiveCountdown");
      const warningEl = document.getElementById("accountPlanWarning");
      const limitBadgeEl = document.getElementById("accountPlanLimitText");
      const imgTimerEl = document.getElementById("imageQuotaLiveCountdown");
      if (!timerEl && !warningEl && !limitBadgeEl && !imgTimerEl) return;

      let isAdmin = false;
      try {
        const u = getTrustedUser();
        const adminEmails = ["zihanfakir@gmail.com", "x@zihan.uk"];
        if (u && (u.role === "admin" || (u.email && adminEmails.includes(u.email.toLowerCase().trim())))) {
          isAdmin = true;
        }
      } catch(e) { console.error('[Alokpoth]', e); }

      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      if (isAdmin) {
        if (timerEl) timerEl.textContent = isEn ? "Unlimited Access" : "সীমাহীন এক্সেস";
        if (imgTimerEl) imgTimerEl.textContent = isEn ? "Unlimited Access" : "সীমাহীন এক্সেস";
        if (limitBadgeEl) limitBadgeEl.textContent = isEn ? "Unlimited Access" : "আনলিমিটেড বার্তা ও ছবি";
        return;
      }

      // 1. Message Quota Timer
      const { limit, hours } = getPlanWindowLimit();
      const usage = getWindowUsage();
      const used = usage.count || 0;
      const remaining = Math.max(0, limit - used);
      const windowMs = hours * 60 * 60 * 1000;

      let msRemainingInWindow = 0;
      if (usage.resetAt) {
        msRemainingInWindow = Math.max(0, new Date(usage.resetAt).getTime() - Date.now());
      } else if (usage.start) {
        msRemainingInWindow = Math.max(0, (usage.start + windowMs) - Date.now());
      }

      if (msRemainingInWindow <= 0 && used > 0) {
        usage.count = 0;
        usage.start = Date.now();
        usage.resetAt = null;
        try { localStorage.setItem(USAGE_WINDOW_KEY, JSON.stringify(usage)); } catch(e) { console.error('[Alokpoth]', e); }
        renderCreditBalance();
        syncUserProfileFromServer();
        return;
      }

      const totalSecLeft = Math.max(0, Math.floor(msRemainingInWindow / 1000));
      const hoursLeft = Math.floor(totalSecLeft / 3600);
      const minsLeft = Math.floor((totalSecLeft % 3600) / 60);
      const secsLeft = totalSecLeft % 60;

      let timeLeftStr = "";
      if (used === 0) {
        timeLeftStr = isEn ? "Full Quota Available" : "কোটা সম্পূর্ণ পূর্ণ";
      } else if (hoursLeft > 0) {
        timeLeftStr = isEn ? `${hoursLeft}h ${minsLeft}m ${secsLeft}s` : `${toBengaliDigits(hoursLeft)} ঘণ্টা ${toBengaliDigits(minsLeft)} মিনিট ${toBengaliDigits(secsLeft)} সেকেন্ড`;
      } else if (minsLeft > 0) {
        timeLeftStr = isEn ? `${minsLeft}m ${secsLeft}s` : `${toBengaliDigits(minsLeft)} মিনিট ${toBengaliDigits(secsLeft)} সেকেন্ড`;
      } else {
        timeLeftStr = isEn ? `${secsLeft}s` : `${toBengaliDigits(secsLeft)} সেকেন্ড`;
      }

      if (timerEl) timerEl.textContent = timeLeftStr;
      if (warningEl && remaining <= 0) {
        const warnPrefix = isEn ? "Your message limit has been reached! (Resets in: " : "আপনার বার্তা সীমা শেষ! (পুনরায় চালু হবে: ";
        const warnSuffix = isEn ? ")" : " পর)";
        warningEl.innerHTML = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;display:inline-block;vertical-align:-3px;margin-right:6px;" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${warnPrefix}${timeLeftStr}${warnSuffix}`;
      }

      // 2. Image Quota Timer
      const { limit: imgLimit, hours: imgHours } = getImagePlanLimit();
      const imgUsage = getImageWindowUsage();
      const imgUsed = imgUsage.count || 0;
      const imgRemaining = Math.max(0, imgLimit - imgUsed);
      const imgWindowMs = imgHours * 60 * 60 * 1000;

      let imgMsRemaining = 0;
      if (imgUsage.resetAt) {
        imgMsRemaining = Math.max(0, new Date(imgUsage.resetAt).getTime() - Date.now());
      } else if (imgUsage.start) {
        imgMsRemaining = Math.max(0, (imgUsage.start + imgWindowMs) - Date.now());
      }

      if (imgMsRemaining <= 0 && imgUsed > 0) {
        imgUsage.count = 0;
        imgUsage.start = Date.now();
        imgUsage.resetAt = null;
        try { localStorage.setItem(IMAGE_WINDOW_KEY, JSON.stringify(imgUsage)); } catch(e) { console.error('[Alokpoth]', e); }
        renderCreditBalance();
        return;
      }

      const imgTotalSecLeft = Math.max(0, Math.floor(imgMsRemaining / 1000));
      const imgHoursLeft = Math.floor(imgTotalSecLeft / 3600);
      const imgMinsLeft = Math.floor((imgTotalSecLeft % 3600) / 60);
      const imgSecsLeft = imgTotalSecLeft % 60;

      let imgTimeLeftStr = "";
      if (imgUsed === 0) {
        imgTimeLeftStr = isEn ? "Full Quota Available" : "কোটা সম্পূর্ণ পূর্ণ";
      } else if (imgHoursLeft > 0) {
        imgTimeLeftStr = isEn ? `${imgHoursLeft}h ${imgMinsLeft}m ${imgSecsLeft}s` : `${toBengaliDigits(imgHoursLeft)} ঘণ্টা ${toBengaliDigits(imgMinsLeft)} মিনিট ${toBengaliDigits(imgSecsLeft)} সেকেন্ড`;
      } else if (imgMinsLeft > 0) {
        imgTimeLeftStr = isEn ? `${imgMinsLeft}m ${imgSecsLeft}s` : `${toBengaliDigits(imgMinsLeft)} মিনিট ${toBengaliDigits(imgSecsLeft)} সেকেন্ড`;
      } else {
        imgTimeLeftStr = isEn ? `${imgSecsLeft}s` : `${toBengaliDigits(imgSecsLeft)} সেকেন্ড`;
      }

      if (imgTimerEl) imgTimerEl.textContent = imgTimeLeftStr;

      if (limitBadgeEl) {
        if (remaining <= 0) {
          limitBadgeEl.textContent = isEn ? `Remaining: 0/${limit} msgs (Reset: ${timeLeftStr})` : `বাকি: ০/${toBengaliDigits(limit)} বার্তা (রিসেট: ${timeLeftStr})`;
        } else {
          limitBadgeEl.textContent = isEn 
            ? `Msgs: ${remaining}/${limit} • Images: ${imgRemaining}/${imgLimit}`
            : `বার্তা: ${toBengaliDigits(remaining)}/${toBengaliDigits(limit)} • ছবি: ${toBengaliDigits(imgRemaining)}/${toBengaliDigits(imgLimit)}`;
        }
      }
    }

    function renderCreditBalance() {
      checkPlanExpiration(false);
      currentPlan = getResolvedUserPlan();

      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      const valueEl = document.getElementById("accountPlanDisplay");
      const expiryEl = document.getElementById("accountPlanExpiryDisplay");
      const warningEl = document.getElementById("accountPlanWarning");

      let isAdmin = false;
      try {
        const u = getTrustedUser();
        const adminEmails = ["zihanfakir@gmail.com", "x@zihan.uk"];
        if (u && (u.role === "admin" || (u.email && adminEmails.includes(u.email.toLowerCase().trim())))) {
          isAdmin = true;
        }
      } catch(e) { console.error('[Alokpoth]', e); }

      if (valueEl) {
        if (isAdmin) {
          valueEl.textContent = isEn ? "Admin (Unlimited)" : "Admin (আনলিমিটেড)";
          valueEl.className = "account-plan-badge plan-Max";
        } else {
          const planDisplayNames = isEn ? { Free: "Free", Pro: "Pro", Max: "Max" } : { Free: "Free (ফ্রি)", Pro: "Pro (প্রো)", Max: "Max (ম্যাক্স)" };
          valueEl.textContent = planDisplayNames[currentPlan] || currentPlan;
          valueEl.className = "account-plan-badge plan-" + currentPlan;
        }
      }
      const setMenuPlanName = document.getElementById("setMenuPlanName");
      if (setMenuPlanName) {
        setMenuPlanName.textContent = isAdmin ? "Admin" : currentPlan;
      }

      const limitBadgeEl = document.getElementById("accountPlanLimitText");
      const limitMsgEl = document.getElementById("limitValMessages");
      const limitImgEl = document.getElementById("limitValImages");
      const limitModEl = document.getElementById("limitValModels");
      const limitSpdEl = document.getElementById("limitValSpeed");

      // Message quota elements
      const quotaFillEl = document.getElementById("accountQuotaFill");
      const drawerFillEl = document.getElementById("drawerQuotaFill");
      const quotaRemainingEl = document.getElementById("quotaRemainingDigits");
      const quotaTotalEl = document.getElementById("quotaTotalDigits");
      const quotaTimerEl = document.getElementById("quotaLiveCountdown");
      const quotaSubtextEl = document.getElementById("quotaWindowSubtext");
      const quotaCountWrapEl = document.getElementById("quotaCountDisplay");

      // Image quota elements
      const imgQuotaFillEl = document.getElementById("accountImageQuotaFill");
      const imgQuotaRemainingEl = document.getElementById("imageQuotaRemainingDigits");
      const imgQuotaTotalEl = document.getElementById("imageQuotaTotalDigits");
      const imgQuotaTimerEl = document.getElementById("imageQuotaLiveCountdown");
      const imgQuotaSubtextEl = document.getElementById("imageQuotaWindowSubtext");
      const imgQuotaCountWrapEl = document.getElementById("imageQuotaCountDisplay");

      const planInfo = getPlanLimitDetails(currentPlan);
      const { limit, hours } = getPlanWindowLimit();
      const usage = getWindowUsage();
      const used = usage.count || 0;
      const remaining = Math.max(0, limit - used);

      const { limit: imgLimit, hours: imgHours } = getImagePlanLimit();
      const imgUsage = getImageWindowUsage();
      const imgUsed = imgUsage.count || 0;
      const imgRemaining = Math.max(0, imgLimit - imgUsed);



      // Message timing
      const windowMs = hours * 60 * 60 * 1000;
      let msRemainingInWindow = 0;
      if (usage.resetAt) {
        msRemainingInWindow = Math.max(0, new Date(usage.resetAt).getTime() - Date.now());
      } else if (usage.start) {
        msRemainingInWindow = Math.max(0, (usage.start + windowMs) - Date.now());
      }

      if (msRemainingInWindow <= 0 && used > 0) {
        usage.count = 0;
        usage.start = Date.now();
        usage.resetAt = null;
        try { localStorage.setItem(USAGE_WINDOW_KEY, JSON.stringify(usage)); } catch(e) { console.error('[Alokpoth]', e); }
        msRemainingInWindow = windowMs;
      }

      const totalSecLeft = Math.max(0, Math.floor(msRemainingInWindow / 1000));
      const hoursLeft = Math.floor(totalSecLeft / 3600);
      const minsLeft = Math.floor((totalSecLeft % 3600) / 60);
      const secsLeft = totalSecLeft % 60;

      let timeLeftStr = "";
      if (used === 0) {
        timeLeftStr = isEn ? "Full Quota Available" : "কোটা সম্পূর্ণ পূর্ণ";
      } else if (hoursLeft > 0) {
        timeLeftStr = isEn ? `${hoursLeft}h ${minsLeft}m ${secsLeft}s` : `${toBengaliDigits(hoursLeft)} ঘণ্টা ${toBengaliDigits(minsLeft)} মিনিট ${toBengaliDigits(secsLeft)} সেকেন্ড`;
      } else if (minsLeft > 0) {
        timeLeftStr = isEn ? `${minsLeft}m ${secsLeft}s` : `${toBengaliDigits(minsLeft)} মিনিট ${toBengaliDigits(secsLeft)} সেকেন্ড`;
      } else {
        timeLeftStr = isEn ? `${secsLeft}s` : `${toBengaliDigits(secsLeft)} সেকেন্ড`;
      }

      // Image timing
      const imgWindowMs = imgHours * 60 * 60 * 1000;
      let imgMsRemaining = 0;
      if (imgUsage.resetAt) {
        imgMsRemaining = Math.max(0, new Date(imgUsage.resetAt).getTime() - Date.now());
      } else if (imgUsage.start) {
        imgMsRemaining = Math.max(0, (imgUsage.start + imgWindowMs) - Date.now());
      }

      if (imgMsRemaining <= 0 && imgUsed > 0) {
        imgUsage.count = 0;
        imgUsage.start = Date.now();
        imgUsage.resetAt = null;
        try { localStorage.setItem(IMAGE_WINDOW_KEY, JSON.stringify(imgUsage)); } catch(e) { console.error('[Alokpoth]', e); }
        imgMsRemaining = imgWindowMs;
      }

      const imgTotalSecLeft = Math.max(0, Math.floor(imgMsRemaining / 1000));
      const imgHoursLeft = Math.floor(imgTotalSecLeft / 3600);
      const imgMinsLeft = Math.floor((imgTotalSecLeft % 3600) / 60);
      const imgSecsLeft = imgTotalSecLeft % 60;

      let imgTimeLeftStr = "";
      if (imgUsed === 0) {
        imgTimeLeftStr = isEn ? "Full Quota Available" : "কোটা সম্পূর্ণ পূর্ণ";
      } else if (imgHoursLeft > 0) {
        imgTimeLeftStr = isEn ? `${imgHoursLeft}h ${imgMinsLeft}m ${imgSecsLeft}s` : `${toBengaliDigits(imgHoursLeft)} ঘণ্টা ${toBengaliDigits(imgMinsLeft)} মিনিট ${toBengaliDigits(imgSecsLeft)} সেকেন্ড`;
      } else if (imgMinsLeft > 0) {
        imgTimeLeftStr = isEn ? `${imgMinsLeft}m ${imgSecsLeft}s` : `${toBengaliDigits(imgMinsLeft)} মিনিট ${toBengaliDigits(imgSecsLeft)} সেকেন্ড`;
      } else {
        imgTimeLeftStr = isEn ? `${imgSecsLeft}s` : `${toBengaliDigits(imgSecsLeft)} সেকেন্ড`;
      }

      if (isAdmin) {
        // Message Quota Admin
        if (quotaRemainingEl) quotaRemainingEl.textContent = isEn ? "Unlimited" : "আনলিমিটেড";
        if (quotaTotalEl) quotaTotalEl.textContent = "∞";
        if (quotaCountWrapEl) quotaCountWrapEl.innerHTML = isEn ? "<strong>Unlimited</strong> Messages (Admin)" : "<strong>আনলিমিটেড</strong> বার্তা (অ্যাডমিন)";
        if (quotaFillEl) {
          quotaFillEl.style.width = "100%";
          quotaFillEl.className = "account-quota-fill";
        }
        if (drawerFillEl) {
          drawerFillEl.style.width = "100%";
          drawerFillEl.className = "drawer-quota-fill";
        }
        if (quotaTimerEl) quotaTimerEl.textContent = isEn ? "Unlimited Access" : "সীমাহীন এক্সেস";
        if (quotaSubtextEl) quotaSubtextEl.textContent = isEn ? "No rate limits apply" : "কোনো রেট লিমিট প্রযোজ্য নয়";

        // Image Quota Admin
        if (imgQuotaRemainingEl) imgQuotaRemainingEl.textContent = isEn ? "Unlimited" : "আনলিমিটেড";
        if (imgQuotaTotalEl) imgQuotaTotalEl.textContent = "∞";
        if (imgQuotaCountWrapEl) imgQuotaCountWrapEl.innerHTML = isEn ? "<strong>Unlimited</strong> Images (Admin)" : "<strong>আনলিমিটেড</strong> ছবি তৈরি (অ্যাডমিন)";
        if (imgQuotaFillEl) {
          imgQuotaFillEl.style.width = "100%";
          imgQuotaFillEl.className = "account-quota-fill image-quota-fill";
        }
        if (imgQuotaTimerEl) imgQuotaTimerEl.textContent = isEn ? "Unlimited Access" : "সীমাহীন এক্সেস";
        if (imgQuotaSubtextEl) imgQuotaSubtextEl.textContent = isEn ? "No rate limits apply" : "কোনো রেট লিমিট প্রযোজ্য নয়";

        if (limitBadgeEl) limitBadgeEl.textContent = isEn ? "Unlimited Access" : "আনলিমিটেড বার্তা ও ছবি";
        if (limitImgEl) limitImgEl.textContent = isEn ? "Unlimited" : "আনলিমিটেড";
        if (warningEl) warningEl.classList.remove("visible");
      } else {
        // Message Quota User
        const pct = limit > 0 ? Math.max(0, Math.min(100, Math.round((remaining / limit) * 100))) : 0;
        if (quotaFillEl) {
          quotaFillEl.style.width = `${pct}%`;
          if (remaining <= 0 || pct <= 15) {
            quotaFillEl.className = "account-quota-fill danger";
          } else if (pct <= 35) {
            quotaFillEl.className = "account-quota-fill warning";
          } else {
            quotaFillEl.className = "account-quota-fill";
          }
        }
        if (drawerFillEl) {
          drawerFillEl.style.width = `${pct}%`;
          if (remaining <= 0 || pct <= 15) {
            drawerFillEl.className = "drawer-quota-fill danger";
          } else if (pct <= 35) {
            drawerFillEl.className = "drawer-quota-fill warning";
          } else {
            drawerFillEl.className = "drawer-quota-fill";
          }
        }
        if (quotaRemainingEl) quotaRemainingEl.textContent = isEn ? String(remaining) : toBengaliDigits(remaining);
        if (quotaTotalEl) quotaTotalEl.textContent = isEn ? String(limit) : toBengaliDigits(limit);
        if (quotaCountWrapEl) {
          quotaCountWrapEl.innerHTML = isEn 
            ? `<strong id="quotaRemainingDigits">${remaining}</strong> / <span id="quotaTotalDigits">${limit}</span> msgs left`
            : `<strong id="quotaRemainingDigits">${toBengaliDigits(remaining)}</strong> / <span id="quotaTotalDigits">${toBengaliDigits(limit)}</span> বার্তা বাকি`;
        }
        if (quotaTimerEl) quotaTimerEl.textContent = timeLeftStr;
        if (quotaSubtextEl) {
          quotaSubtextEl.textContent = isEn
            ? `Refreshes ${limit} messages every ${hours} hours`
            : `প্রতি ${toBengaliDigits(hours)} ঘণ্টায় ${toBengaliDigits(limit)}টি বার্তা নবায়ন হয়`;
        }

        // Image Quota User
        const imgPct = imgLimit > 0 ? Math.max(0, Math.min(100, Math.round((imgRemaining / imgLimit) * 100))) : 0;
        if (imgQuotaFillEl) {
          imgQuotaFillEl.style.width = `${imgPct}%`;
          if (imgRemaining <= 0 || imgPct <= 15) {
            imgQuotaFillEl.className = "account-quota-fill image-quota-fill danger";
          } else if (imgPct <= 35) {
            imgQuotaFillEl.className = "account-quota-fill image-quota-fill warning";
          } else {
            imgQuotaFillEl.className = "account-quota-fill image-quota-fill";
          }
        }
        if (imgQuotaRemainingEl) imgQuotaRemainingEl.textContent = isEn ? String(imgRemaining) : toBengaliDigits(imgRemaining);
        if (imgQuotaTotalEl) imgQuotaTotalEl.textContent = isEn ? String(imgLimit) : toBengaliDigits(imgLimit);
        if (imgQuotaCountWrapEl) {
          imgQuotaCountWrapEl.innerHTML = isEn 
            ? `<strong id="imageQuotaRemainingDigits">${imgRemaining}</strong> / <span id="imageQuotaTotalDigits">${imgLimit}</span> images left`
            : `<strong id="imageQuotaRemainingDigits">${toBengaliDigits(imgRemaining)}</strong> / <span id="imageQuotaTotalDigits">${toBengaliDigits(imgLimit)}</span> ছবি বাকি`;
        }
        if (imgQuotaTimerEl) imgQuotaTimerEl.textContent = imgTimeLeftStr;
        if (imgQuotaSubtextEl) {
          imgQuotaSubtextEl.textContent = isEn
            ? `Refreshes ${imgLimit} images every ${imgHours} hours`
            : `প্রতি ${toBengaliDigits(imgHours)} ঘণ্টায় ${toBengaliDigits(imgLimit)}টি ছবি তৈরির কোটা নবায়ন হয়`;
        }
        if (limitImgEl) {
          limitImgEl.textContent = planInfo.imageLimit || (isEn ? `${imgLimit} images` : `${toBengaliDigits(imgLimit)} ছবি`);
        }

        if (limitBadgeEl) {
          if (remaining <= 0) {
            limitBadgeEl.textContent = isEn ? `Remaining: 0/${limit} msgs (Reset: ${timeLeftStr})` : `বাকি: ০/${toBengaliDigits(limit)} বার্তা (রিসেট: ${timeLeftStr})`;
          } else {
            limitBadgeEl.textContent = isEn 
              ? `Msgs: ${remaining}/${limit} • Images: ${imgRemaining}/${imgLimit}`
              : `বার্তা: ${toBengaliDigits(remaining)}/${toBengaliDigits(limit)} • ছবি: ${toBengaliDigits(imgRemaining)}/${toBengaliDigits(imgLimit)}`;
          }
        }

        if (warningEl) {
          if (remaining <= 0) {
            const warnText = isEn 
              ? `Your message limit has been reached! (Resets in: ${timeLeftStr})`
              : `আপনার বার্তা সীমা শেষ! (পুনরায় চালু হবে: ${timeLeftStr} পর)`;
            warningEl.innerHTML = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;display:inline-block;vertical-align:-3px;margin-right:6px;" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${warnText}`;
            warningEl.classList.add("visible");
          } else {
            warningEl.classList.remove("visible");
          }
        }
      }

      if (isAdmin) {
        if (limitMsgEl) limitMsgEl.textContent = isEn ? "Unlimited" : "আনলিমিটেড";
        if (limitModEl) limitModEl.textContent = isEn ? "All Models + Web" : "সবগুলো মডেল ও ওয়েব সার্চ";
        if (limitSpdEl) limitSpdEl.textContent = isEn ? "Maximum Priority" : "সর্বোচ্চ প্রায়োরিটি";
      } else {
        if (limitMsgEl) limitMsgEl.textContent = planInfo.messages;
        if (limitModEl) limitModEl.textContent = planInfo.models;
        if (limitSpdEl) limitSpdEl.textContent = planInfo.speed;
      }

      const compareGrid = document.getElementById("accountAllPlansGrid");
      if (compareGrid) {
        const pFree = getPlanLimitDetails("Free");
        const pPro = getPlanLimitDetails("Pro");
        const pMax = getPlanLimitDetails("Max");
        compareGrid.innerHTML = `
          <div class="plan-compare-card ${(!isAdmin && currentPlan === 'Free') ? 'active-plan' : ''}" id="compareCardFree">
            <div class="plan-compare-header">
              <span class="plan-compare-name">Free</span>
            </div>
            <ul class="plan-compare-features">
              <li>${pFree.messages}</li>
              <li>${pFree.imageLimit}</li>
              <li>${pFree.models}</li>
              <li>${pFree.speed}</li>
            </ul>
          </div>
          <div class="plan-compare-card ${(!isAdmin && currentPlan === 'Pro') ? 'active-plan' : ''}" id="compareCardPro">
            <div class="plan-compare-header">
              <span class="plan-compare-name">Pro</span>
            </div>
            <ul class="plan-compare-features">
              <li>${pPro.messages}</li>
              <li>${pPro.imageLimit}</li>
              <li>${pPro.models}</li>
              <li>${pPro.speed}</li>
            </ul>
          </div>
          <div class="plan-compare-card ${(isAdmin || currentPlan === 'Max') ? 'active-plan' : ''}" id="compareCardMax">
            <div class="plan-compare-header">
              <span class="plan-compare-name" style="color:var(--accent-color);">Max</span>
            </div>
            <ul class="plan-compare-features">
              <li>${pMax.messages}</li>
              <li>${pMax.imageLimit}</li>
              <li>${pMax.models}</li>
              <li>${pMax.speed}</li>
            </ul>
          </div>
        `;
      }

      if (expiryEl) {
        if (isAdmin) {
          expiryEl.textContent = isEn ? "Validity: Lifetime Admin Access" : "মেয়াদ: আজীবন অ্যাডমিন অ্যাক্সেস";
          expiryEl.className = "account-plan-expiry-text";
        } else if (currentPlan === "Free") {
          expiryEl.textContent = isEn ? "Validity: Lifetime / Unlimited" : "মেয়াদ: আজীবন / মেয়াদহীন";
          expiryEl.className = "account-plan-expiry-text";
        } else {
          const expiryStr = localStorage.getItem(PLAN_EXPIRY_KEY);
          if (expiryStr) {
            const expiryDate = new Date(expiryStr);
            if (!isNaN(expiryDate.getTime())) {
              const diffMs = expiryDate.getTime() - Date.now();
              if (diffMs <= 0) {
                expiryEl.textContent = isEn ? "Validity: Expired" : "মেয়াদ: মেয়াদ উত্তীর্ণ";
                expiryEl.className = "account-plan-expiry-text expired";
              } else {
                const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                expiryEl.textContent = isEn 
                  ? `Expires: ${expiryDate.toLocaleDateString('en-US')} (${daysLeft} days left)`
                  : `মেয়াদ: ${formatBengaliDate(expiryDate)} (বাকি ${toBengaliDigits(daysLeft)} দিন)`;
                expiryEl.className = "account-plan-expiry-text";
              }
            } else {
              expiryEl.textContent = isEn ? "Validity: Lifetime / Unlimited" : "মেয়াদ: আজীবন / মেয়াদহীন";
              expiryEl.className = "account-plan-expiry-text";
            }
          } else {
            expiryEl.textContent = isEn ? "Validity: Lifetime / Unlimited" : "মেয়াদ: আজীবন / মেয়াদহীন";
            expiryEl.className = "account-plan-expiry-text";
          }
        }
      }

      if (typeof updateNavbarCreditBadge === "function") updateNavbarCreditBadge();
      if (typeof updateSendAvailability === "function") updateSendAvailability();
    }

    let appHeightRaf = null;
    function setAppHeight() {
      if (appHeightRaf) cancelAnimationFrame(appHeightRaf);
      appHeightRaf = requestAnimationFrame(() => {
        const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty("--app-height", `${h}px`);
        if (window.scrollY !== 0 || window.scrollX !== 0) {
          window.scrollTo(0, 0);
        }
      });
    }
    setAppHeight();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", debounce(() => {
        setAppHeight();
        setTimeout(() => {
          window.scrollTo(0, 0);
          if (typeof scrollToBottom === "function") scrollToBottom(false);
        }, 60);
      }, 150));
      window.visualViewport.addEventListener("scroll", () => {
        if (window.scrollY !== 0 || window.scrollX !== 0) {
          window.scrollTo(0, 0);
        }
      }, { passive: true });
    }
    window.addEventListener("resize", debounce(setAppHeight, 150));
    window.addEventListener("orientationchange", () => {
      setTimeout(setAppHeight, 150);
    });
    window.addEventListener("scroll", () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    }, { passive: true });

    const COPY_ALLOWED_SELECTOR = "input, textarea, [contenteditable='true']";

    // Block text selection highlight across the app so text does not turn blue
    document.addEventListener("selectstart", (e) => {
      if (!e.target.closest(COPY_ALLOWED_SELECTOR)) {
        e.preventDefault();
      }
    });

    // Block drag selection that triggers blue highlights
    document.addEventListener("dragstart", (e) => {
      if (!e.target.closest(COPY_ALLOWED_SELECTOR)) {
        e.preventDefault();
      }
    });

    // Block manual copy shortcuts (Ctrl+C, Cmd+C) unless inside an input
    document.addEventListener("copy", (e) => {
      if (!e.target.closest(COPY_ALLOWED_SELECTOR)) {
        e.preventDefault();
      }
    });

    // Block right-click / long-press context menu on web & mobile app unless inside an input
    document.addEventListener("contextmenu", (e) => {
      if (!e.target.closest(COPY_ALLOWED_SELECTOR)) {
        e.preventDefault();
      }
    });

    let MODELS = [
      { id: "hy3", name: "Alo HY3", provider: "Alokpoth", latency: null, status: "online", type: "bai", premium: false, efficient: false },
      { id: "mimo-v2.5", name: "Alo Swift", provider: "Alokpoth", latency: null, status: "online", type: "bai", premium: false, efficient: true }
    ];
    try {
      const cachedModelsStr = localStorage.getItem("alokpoth_cached_models");
      if (cachedModelsStr) {
        const parsed = JSON.parse(cachedModelsStr);
        if (Array.isArray(parsed) && parsed.length > 0) MODELS = parsed;
      }
    } catch(e) { console.error('[Alokpoth]', e); }

    function isModelAccessible(m, plan = null) {
      if (!m) return false;
      const isUserAdmin = (typeof checkIsUserAdmin === "function") ? checkIsUserAdmin() : false;
      const userPlan = plan || (typeof getResolvedUserPlan === "function" ? getResolvedUserPlan() : (currentPlan || "Free"));
      if (isUserAdmin || userPlan === "Max") return true;
      const isMax = Boolean(m.efficient) || m.id === "gpt-5.6";
      const isPro = Boolean(m.premium) && !isMax;
      if (userPlan === "Free") return !isMax && !isPro;
      if (userPlan === "Pro") return !isMax;
      return true;
    }

    const modelTrigger = document.getElementById("modelTrigger");
    const modelTriggerLabel = document.getElementById("modelTriggerLabel");
    const modelModalOverlay = document.getElementById("modelModalOverlay");
    const modelModalClose = document.getElementById("modelModalClose");
    const modelList = document.getElementById("modelList");

    let initialSavedModel = localStorage.getItem("alokpoth_selected_model");
    const initialTarget = MODELS.find(m => m.id === initialSavedModel);
    if (!initialTarget || !isModelAccessible(initialTarget)) {
      const fallback = MODELS.find(m => isModelAccessible(m)) || MODELS[0];
      initialSavedModel = fallback ? fallback.id : (MODELS[0] ? MODELS[0].id : "alo-ai");
      try { localStorage.setItem("alokpoth_selected_model", initialSavedModel); } catch(e) { console.error('[Alokpoth]', e); }
    }
    let selectedModelId = initialSavedModel;

    function ensureAccessibleModelSelected() {
      if (typeof MODELS === "undefined" || !Array.isArray(MODELS) || MODELS.length === 0) return;
      const cur = MODELS.find(m => m.id === selectedModelId);
      if (!cur || !isModelAccessible(cur)) {
        const fallback = MODELS.find(m => isModelAccessible(m)) || MODELS[0];
        if (fallback) {
          selectedModelId = fallback.id;
          try { localStorage.setItem("alokpoth_selected_model", selectedModelId); } catch(e) { console.error('[Alokpoth]', e); }
          if (modelTriggerLabel) modelTriggerLabel.textContent = fallback.name;
          if (typeof messagesHistory !== "undefined" && messagesHistory.length > 0 && messagesHistory[0].role === "system") {
            if (typeof buildSystemPrompt === "function") {
              messagesHistory[0].content = buildSystemPrompt(fallback.name, true, true);
            }
          }
          if (typeof updateTriggerStatusDot === "function") updateTriggerStatusDot();
          if (typeof renderModelList === "function") renderModelList();
        }
      }
    }

    function updateSelectedModelUI() {
      const current = MODELS.find(m => m.id === selectedModelId);
      if (current && modelTriggerLabel) {
        modelTriggerLabel.textContent = current.name;
      }
    }

    async function fetchModelsFromServer() {
      try {
        const res = await fetch(`${API_BASE}/chat/models?_t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.models) && data.models.length > 0) {
          try { localStorage.setItem("alokpoth_cached_models", JSON.stringify(data.models)); } catch(e) { console.error('[Alokpoth]', e); }
          const statusMap = new Map();
          MODELS.forEach(m => statusMap.set(m.id, { latency: m.latency, status: m.status }));

          MODELS = data.models.map(m => {
            const prev = statusMap.get(m.id) || {};
            const cleanName = (typeof m.name === "string" && m.name.trim()) ? m.name.trim() : (m.id || "Alokpoth");
            return {
              id: m.id,
              name: cleanName,
              provider: "Alokpoth",
              type: m.type || "openrouter",
              premium: Boolean(m.premium),
              efficient: Boolean(m.efficient),
              order: m.order || 0,
              latency: prev.latency !== undefined ? prev.latency : null,
              status: prev.status || "online"
            };
          });

          MODELS.sort((a, b) => (a.order || 0) - (b.order || 0));

          const userPlan = (typeof getResolvedUserPlan === "function" ? getResolvedUserPlan() : (currentPlan || "Free"));
          const isUserAdmin = (typeof checkIsUserAdmin === "function") ? checkIsUserAdmin() : false;
          const isModelAccessible = (m) => {
            if (!m) return false;
            if (isUserAdmin || userPlan === "Max") return true;
            const isMax = Boolean(m.efficient) || m.id === "gpt-5.6";
            const isPro = Boolean(m.premium) && !isMax;
            if (userPlan === "Free") return !isMax && !isPro;
            if (userPlan === "Pro") return !isMax;
            return true;
          };

          const savedModel = localStorage.getItem("alokpoth_selected_model");
          const targetSaved = MODELS.find(m => m.id === savedModel);
          if (targetSaved && isModelAccessible(targetSaved)) {
            selectedModelId = savedModel;
          } else {
            const firstAvailable = MODELS.find(m => isModelAccessible(m)) || MODELS[0];
            selectedModelId = firstAvailable ? firstAvailable.id : (MODELS[0] ? MODELS[0].id : "alo-ai");
            try { localStorage.setItem("alokpoth_selected_model", selectedModelId); } catch(e) { console.error('[Alokpoth]', e); }
          }

          const currentModelObj = MODELS.find(m => m.id === selectedModelId) || MODELS[0];
          if (currentModelObj) {
            const curLabel = document.getElementById("modelTriggerLabel");
            if (curLabel) curLabel.textContent = currentModelObj.name;
            if (typeof messagesHistory !== "undefined" && messagesHistory.length > 0 && messagesHistory[0].role === "system") {
              messagesHistory[0].content = buildSystemPrompt(currentModelObj.name, true, true);
            }
          }

          renderModelList();
          updateSelectedModelUI();
          updateTriggerStatusDot();
          syncModelStatuses({ silent: true });
        }
      } catch (err) {
        console.warn("Could not fetch models from server:", err);
      }
    }

    const PING_INTERVAL_MS = 60000;
    const PING_TIMEOUT_MS = 8000;
    let pingInFlight = false;

    function fetchWithTimeout(url, opts, timeoutMs) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id));
    }

    function classifyLatency(ms) {
      if (ms == null) return "offline";
      if (ms > 5000) return "slow";
      if (ms > 3000) return "degraded";
      return "online";
    }

    async function pingModel(m) {
      try {
        const srvRes = await fetchWithTimeout(`${API_BASE}/chat/ping?model=${encodeURIComponent(m.id)}`, { method: "GET" }, PING_TIMEOUT_MS);
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          if (srvData.success) {
            const isOffline = srvData.status === 'offline' || srvData.latency == null;
            return {
              latency: isOffline ? null : srvData.latency,
              status: isOffline ? 'offline' : (srvData.status || classifyLatency(srvData.latency))
            };
          }
        }
      } catch(e) { console.error('[Alokpoth]', e); }
      return { latency: null, status: "offline" };
    }

    async function syncModelStatuses({ silent } = {}) {
      if (pingInFlight) return;
      pingInFlight = true;
      if (!silent) renderModelList();

      try {
        await Promise.all(MODELS.map(async (m) => {
          const result = await pingModel(m);
          m.latency = result.latency;
          m.status = result.status;
        }));
      } catch (err) {
        console.warn("syncModelStatuses warning:", err);
      } finally {
        pingInFlight = false;
        renderModelList();
        updateTriggerStatusDot();
      }
    }

    function updateTriggerStatusDot() {
      const current = MODELS.find((m) => m.id === selectedModelId);
      const dot = document.getElementById("triggerStatusDot");
      if (dot) {
        dot.className = `trigger-status-dot status-dot ${current ? current.status : "checking"}`;
        dot.title = current ? statusLabel(current.status) : "";
      }
    }

    function statusLabel(status) {
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      if (isEn) {
        if (status === "online") return "Online";
        if (status === "degraded") return "Degraded";
        if (status === "slow") return "Slow";
        if (status === "checking") return "Checking...";
        return "Offline";
      }
      if (status === "online") return "অনলাইন";
      if (status === "degraded") return "ধীরগতি";
      if (status === "slow") return "অতি ধীর";
      if (status === "checking") return "যাচাই হচ্ছে...";
      return "অফলাইন";
    }

    function latencyLabel(m) {
      if (m.status === "checking") return `<span class="latency-spinner"></span>`;
      if (m.latency == null) return "—";
      return `${m.latency}ms`;
    }

    function renderModelList() {
      modelList.innerHTML = "";
      if (!MODELS.length) {
        modelList.innerHTML = `<div style="text-align:center; padding: 24px 16px; color: var(--text-muted); font-size: 13px;">কোনো মডেল পাওয়া যায়নি</div>`;
        return;
      }

      const userPlan = (typeof getResolvedUserPlan === "function" ? getResolvedUserPlan() : (currentPlan || "Free"));
      let isUserAdmin = false;
      try {
        const u = getTrustedUser();
        const adminEmails = ["zihanfakir@gmail.com", "x@zihan.uk"];
        if (u && (u.role === "admin" || (u.email && adminEmails.includes(u.email.toLowerCase().trim())))) {
          isUserAdmin = true;
        }
      } catch(e) { console.error('[Alokpoth]', e); }

      MODELS.forEach((m) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "model-card" + (m.id === selectedModelId ? " selected" : "");

        const isMaxOnly = Boolean(m.efficient) || m.id === "gpt-5.6";
        const isProOnly = Boolean(m.premium) && !isMaxOnly;

        let isLocked = false;
        let requiredPlan = "";

        if (!isUserAdmin) {
          if (userPlan === "Free") {
            if (isMaxOnly) {
              isLocked = true;
              requiredPlan = "Max";
            } else if (isProOnly) {
              isLocked = true;
              requiredPlan = "Pro";
            }
          } else if (userPlan === "Pro") {
            if (isMaxOnly) {
              isLocked = true;
              requiredPlan = "Max";
            }
          }
        }

        let badgeHtml = "";
        if (m.efficient) {
          badgeHtml = `<span class="badge-tag badge-max">MAX</span>`;
        } else if (m.premium) {
          badgeHtml = `<span class="badge-tag badge-pro">PRO</span>`;
        }

        let lockHtml = "";
        if (isLocked) {
          lockHtml = `<span class="model-lock-badge" style="display:inline-flex; align-items:center; gap:3px; margin-left:6px; font-size:0.7rem; font-weight:600; padding:1px 6px; border-radius:4px; background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.25);">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ${requiredPlan}
          </span>`;
        }

        card.innerHTML = `
          <div class="model-card-left">
            <div class="model-card-name">${escapeHtml(m.name)}${badgeHtml}${lockHtml}</div>
          </div>
          <div class="model-card-right">
            <span class="model-latency">${latencyLabel(m)}</span>
          </div>
        `;

        const isOffline = m.status === "offline";
        if (isOffline) {
          card.classList.add("model-offline");
          card.style.opacity = "0.55";
        }

        if (isLocked) {
          card.classList.add("model-locked");
          card.style.opacity = "0.72";
        }

        card.addEventListener("click", () => {
          if (isLocked) {
            const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
            const reqPlanName = requiredPlan === "Max" ? (isEn ? "Max Plan" : "ম্যাক্স প্ল্যান") : (isEn ? "Pro Plan" : "প্রো প্ল্যান");
            const curPlanName = userPlan === "Pro" ? (isEn ? "Pro Plan" : "প্রো প্ল্যান") : (userPlan === "Max" ? (isEn ? "Max Plan" : "ম্যাক্স প্ল্যান") : (isEn ? "Free Plan" : "ফ্রি প্ল্যান"));
            const msg = isEn
              ? `'${m.name}' requires ${reqPlanName}. Your current plan: ${curPlanName}.`
              : `'${m.name}' মডেলটি ব্যবহারের জন্য ${reqPlanName} প্রয়োজন। আপনার বর্তমান প্ল্যান: ${curPlanName}।`;
            showToast(msg, "warning");
            return;
          }
          if (isOffline) {
            showToast(`'${m.name}' মডেলটিতে সাময়িক সংযোগ সমস্যা হতে পারে।`, "warning");
          }
          selectedModelId = m.id;
          try { localStorage.setItem("alokpoth_selected_model", m.id); } catch(e) { console.error('[Alokpoth]', e); }
          modelTriggerLabel.textContent = m.name;
          if (messagesHistory[0] && messagesHistory[0].role === "system") {
            messagesHistory[0].content = buildSystemPrompt(m.name, true, true);
          } else {
            messagesHistory.unshift({ role: "system", content: buildSystemPrompt(m.name, true, true) });
          }
          updateAttachBtnActiveState();
          updateTriggerStatusDot();
          closeModal();
          renderModelList();
        });

        modelList.appendChild(card);
      });
    }

    function pushPageState(name) {
      try {
        if (!history.state || history.state.page !== name) {
          history.pushState({ page: name }, "");
        }
      } catch(e) { console.error('[Alokpoth]', e); }
    }

    window.addEventListener("popstate", () => {
      // 1. Account Settings modal & subviews
      const acc = document.getElementById("accountModalOverlay");
      if (acc && acc.classList.contains("open")) {
        const activeSub = acc.querySelector(".settings-subview.active");
        if (activeSub && activeSub.id !== "settingsMainView") {
          if (typeof showSettingsView === "function") showSettingsView("settingsMainView", true);
          return;
        }
        if (typeof closeAccountModal === "function") closeAccountModal(true);
        return;
      }
      // 2. Model picker modal
      const mdl = document.getElementById("modelModalOverlay");
      if (mdl && mdl.classList.contains("open")) {
        if (typeof closeModal === "function") closeModal(true);
        return;
      }
      // 3. App download modal
      const appDl = document.getElementById("appDownloadModalOverlay");
      if (appDl && appDl.classList.contains("open")) {
        if (typeof closeAppDownloadModal === "function") closeAppDownloadModal(true);
        return;
      }
      // 4. Chat history modal
      const hist = document.getElementById("chatHistoryModalOverlay");
      if (hist && hist.classList.contains("open")) {
        if (typeof closeChatHistoryModal === "function") closeChatHistoryModal(true);
        return;
      }
      // 5. Sidebar Drawer
      const drw = document.getElementById("sidebarDrawer");
      if (drw && drw.classList.contains("open")) {
        if (typeof closeSidebarDrawer === "function") closeSidebarDrawer(true);
        return;
      }
      // 6. Brand Menu
      const bm = document.getElementById("brandMenuOverlay");
      if (bm && bm.classList.contains("open")) {
        if (typeof closeBrandMenu === "function") closeBrandMenu();
        return;
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.keyCode === 27) {
        // 1. Account Settings modal & subviews
        const acc = document.getElementById("accountModalOverlay");
        if (acc && acc.classList.contains("open")) {
          const activeSub = acc.querySelector(".settings-subview.active");
          if (activeSub && activeSub.id !== "settingsMainView") {
            if (typeof showSettingsView === "function") showSettingsView("settingsMainView");
            return;
          }
          if (typeof closeAccountModal === "function") closeAccountModal();
          return;
        }
        // 2. Model picker modal
        const mdl = document.getElementById("modelModalOverlay");
        if (mdl && mdl.classList.contains("open")) {
          if (typeof closeModal === "function") closeModal();
          return;
        }
        // 3. App download modal
        const appDl = document.getElementById("appDownloadModalOverlay");
        if (appDl && appDl.classList.contains("open")) {
          if (typeof closeAppDownloadModal === "function") closeAppDownloadModal();
          return;
        }
        // 4. Chat history modal
        const hist = document.getElementById("chatHistoryModalOverlay");
        if (hist && hist.classList.contains("open")) {
          if (typeof closeChatHistoryModal === "function") closeChatHistoryModal();
          return;
        }
        // 5. Sidebar Drawer
        const drw = document.getElementById("sidebarDrawer");
        if (drw && drw.classList.contains("open")) {
          if (typeof closeSidebarDrawer === "function") closeSidebarDrawer();
          return;
        }
        // 6. Brand Menu
        const bMenu = document.getElementById("brandMenuOverlay");
        if (bMenu && bMenu.classList.contains("open")) {
          if (typeof closeBrandMenu === "function") closeBrandMenu();
          return;
        }
      }
    });

    async function openModal() {
      if (typeof closeSidebarDrawer === "function") closeSidebarDrawer();
      if (typeof closeBrandMenu === "function") closeBrandMenu();
      renderModelList();
      modelModalOverlay.classList.add("open");
      pushPageState("models");
      await fetchModelsFromServer();
      syncModelStatuses({ silent: true });
    }

    function closeModal(isPopstate = false) {
      if (modelModalOverlay) modelModalOverlay.classList.remove("open");
      if (!isPopstate && history.state && history.state.page === "models") {
        try { history.replaceState({ page: "home" }, ""); } catch(e) { console.error('[Alokpoth]', e); }
      }
    }
    window.openModelPicker = openModal;

    modelTrigger.addEventListener("click", openModal);
    modelModalClose.addEventListener("click", () => closeModal());
    modelModalOverlay.addEventListener("click", (e) => {
      if (e.target === modelModalOverlay) closeModal();
    });

    // ===== Sliding Sidebar Drawer Engine =====
    const drawerToggleBtn = document.getElementById("drawerToggleBtn");
    const sidebarDrawer = document.getElementById("sidebarDrawer");
    const drawerBackdrop = document.getElementById("drawerBackdrop");
    const drawerCloseBtn = document.getElementById("drawerCloseBtn");
    const drawerNewChatBtn = document.getElementById("drawerNewChatBtn");
    const quickNewChatBtn = document.getElementById("quickNewChatBtn");
    const drawerSearchInput = document.getElementById("drawerSearchInput");
    const drawerUserCard = document.getElementById("drawerUserCardWrap");
    const drawerSettingsBtn = document.getElementById("drawerSettingsBtn");
    const drawerThemeBtn = document.getElementById("drawerThemeBtn");
    const navCreditBadge = document.getElementById("navCreditBadge");

    function openSidebarDrawer() {
      if (sidebarDrawer) sidebarDrawer.classList.add("open");
      if (drawerBackdrop) drawerBackdrop.classList.add("open");
      pushPageState("drawer");
      renderDrawerHistoryList(drawerSearchInput ? drawerSearchInput.value : "");
      updateNavbarCreditBadge();
      triggerHaptic("light");
    }

    function closeSidebarDrawer(isPopstate = false) {
      if (sidebarDrawer) sidebarDrawer.classList.remove("open");
      if (drawerBackdrop) drawerBackdrop.classList.remove("open");
      if (!isPopstate && history.state && history.state.page === "drawer") {
        try { history.replaceState({ page: "home" }, ""); } catch(e) { console.error('[Alokpoth]', e); }
      }
    }

    if (drawerToggleBtn) drawerToggleBtn.addEventListener("click", openSidebarDrawer);
    if (drawerCloseBtn) drawerCloseBtn.addEventListener("click", closeSidebarDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeSidebarDrawer);

    if (drawerNewChatBtn) {
      drawerNewChatBtn.addEventListener("click", () => {
        startNewChat();
        closeSidebarDrawer();
      });
    }

    if (quickNewChatBtn) {
      quickNewChatBtn.addEventListener("click", () => {
        startNewChat();
      });
    }

    const quickNewChatNavBtn = document.getElementById("quickNewChatNavBtn");
    if (quickNewChatNavBtn) {
      quickNewChatNavBtn.addEventListener("click", startNewChat);
    }

    const drawerEmptyNewChatBtn = document.getElementById("drawerEmptyNewChatBtn");
    if (drawerEmptyNewChatBtn) {
      drawerEmptyNewChatBtn.addEventListener("click", () => {
        startNewChat();
        closeSidebarDrawer();
      });
    }

    if (drawerSearchInput) {
      drawerSearchInput.addEventListener("input", (e) => {
        renderDrawerHistoryList(e.target.value);
      });
    }

    function handleDrawerUserCardClick(e) {
      if (e) {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
      }
      closeSidebarDrawer();
      if (typeof openAccountModal === "function") {
        openAccountModal("settingsMainView");
      } else {
        window.location.href = "account.html";
      }
    }
    window.handleDrawerUserCardClick = handleDrawerUserCardClick;

    if (drawerUserCard) {
      drawerUserCard.addEventListener("click", handleDrawerUserCardClick);
      drawerUserCard.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleDrawerUserCardClick(e);
        }
      });
    }

    if (drawerSettingsBtn) {
      drawerSettingsBtn.addEventListener("click", () => {
        closeSidebarDrawer();
        openAccountModal();
      });
    }

    if (drawerThemeBtn) {
      drawerThemeBtn.addEventListener("click", () => {
        if (typeof cycleTheme === "function") cycleTheme();
      });
    }

    const drawerLimitsBtn = document.getElementById("drawerLimitsBtn");
    if (drawerLimitsBtn) {
      drawerLimitsBtn.addEventListener("click", () => {
        closeSidebarDrawer();
        openAccountModal("limits");
      });
    }

    if (navCreditBadge) {
      navCreditBadge.addEventListener("click", () => {
        openAccountModal("limits");
      });
    }

    function updateNavbarCreditBadge() {
      const badgeEl = document.getElementById("navCreditBadge");
      const countEl = document.getElementById("navCreditCount");
      const drawerPlanEl = document.getElementById("drawerUserPlan");
      const drawerFill = document.getElementById("drawerQuotaFill");
      const drawerBadge = document.getElementById("drawerLimitBadge");

      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      const activePlan = (typeof getResolvedUserPlan === "function" ? getResolvedUserPlan() : (currentPlan || "Free"));
      currentPlan = activePlan;

      const token = localStorage.getItem("alokpoth_token");
      if (!token) {
        const { limit } = getPlanWindowLimit();
        const usage = getWindowUsage();
        const used = usage.count || 0;
        const rem = Math.max(0, limit - used);
        if (countEl) countEl.textContent = isEn ? `Guest: ${rem}/${limit}` : `গেস্ট: ${toBengaliDigits(rem)}/${toBengaliDigits(limit)}`;
        if (badgeEl) badgeEl.className = "nav-credit-badge";
        if (drawerPlanEl) drawerPlanEl.textContent = isEn ? "Sign in to unlock all features" : "চ্যাট করতে লগইন করুন";
        if (drawerBadge) drawerBadge.textContent = isEn ? "Sign In" : "লগইন করুন";
        if (drawerFill) {
          const pct = limit > 0 ? Math.max(0, Math.min(100, Math.round((rem / limit) * 100))) : 0;
          drawerFill.style.width = `${pct}%`;
          drawerFill.style.background = pct <= 20 ? "#ef4444" : (pct <= 40 ? "#f59e0b" : "linear-gradient(90deg, #3b82f6, #38bdf8)");
        }
        return;
      }

      let isAdmin = false;
      try {
        const u = getTrustedUser();
        const adminEmails = ["zihanfakir@gmail.com", "x@zihan.uk"];
        if (u && (u.role === "admin" || (u.email && adminEmails.includes(u.email.toLowerCase().trim())))) {
          isAdmin = true;
        }
      } catch(e) { console.error('[Alokpoth]', e); }

      if (isAdmin) {
        if (countEl) countEl.textContent = isEn ? "Unlimited" : "আনলিমিটেড";
        if (badgeEl) badgeEl.className = "nav-credit-badge";
        if (drawerPlanEl) drawerPlanEl.textContent = isEn ? "Admin (Unlimited)" : "Admin (আনলিমিটেড)";
        if (drawerBadge) drawerBadge.textContent = isEn ? "Max (Unlimited)" : "Max (আনলিমিটেড)";
        if (drawerFill) {
          drawerFill.style.width = "100%";
          drawerFill.style.background = "linear-gradient(90deg, #10b981, #34d399)";
        }
        return;
      }

      const { limit } = getPlanWindowLimit();
      const usage = getWindowUsage();
      const used = usage.count || 0;
      const remaining = Math.max(0, limit - used);

      if (countEl) countEl.textContent = isEn ? `${remaining}/${limit}` : `${toBengaliDigits(remaining)}/${toBengaliDigits(limit)}`;
      if (badgeEl) {
        if (remaining <= 0) {
          badgeEl.className = "nav-credit-badge danger";
        } else if (remaining <= limit * 0.25) {
          badgeEl.className = "nav-credit-badge warning";
        } else {
          badgeEl.className = "nav-credit-badge";
        }
      }

      if (drawerPlanEl) {
        drawerPlanEl.textContent = isEn
          ? `${activePlan} (${remaining} msgs left)`
          : `${activePlan} (${toBengaliDigits(remaining)} বার্তা বাকি)`;
      }
      if (drawerBadge) {
        drawerBadge.textContent = isEn
          ? `${remaining}/${limit}`
          : `${toBengaliDigits(remaining)}/${toBengaliDigits(limit)}`;
      }
      if (drawerFill) {
        const pct = limit > 0 ? Math.max(0, Math.min(100, Math.round((remaining / limit) * 100))) : 0;
        drawerFill.style.width = `${pct}%`;
        if (pct <= 20) {
          drawerFill.style.background = "#ef4444";
        } else if (pct <= 40) {
          drawerFill.style.background = "#f59e0b";
        } else {
          drawerFill.style.background = "linear-gradient(90deg, #3b82f6, #38bdf8)";
        }
      }
    }

    function renderDrawerHistoryList(filterQuery = "") {
      const drawerListEl = document.getElementById("drawerHistoryList");
      if (!drawerListEl) return;

      let sessions = loadAllSessions().sort((a, b) => b.updatedAt - a.updatedAt);
      if (filterQuery && filterQuery.trim()) {
        const q = filterQuery.trim().toLowerCase();
        sessions = sessions.filter(s => (s.title || "").toLowerCase().includes(q));
      }

      const drawerEmptyState = document.getElementById("drawerEmptyState");

      if (!sessions.length) {
        drawerListEl.innerHTML = "";
        drawerListEl.style.display = "none";
        if (drawerEmptyState) drawerEmptyState.style.display = "flex";
        
        if (filterQuery) {
            drawerListEl.style.display = "block";
            if (drawerEmptyState) drawerEmptyState.style.display = "none";
            const noMatchMsg = (typeof currentLanguage !== "undefined" && currentLanguage === "en") ? "No chats found" : "কোনো চ্যাট মেলেনি";
            drawerListEl.innerHTML = `<div style="text-align:center; padding: 24px 12px; color: var(--text-sub); font-size: 0.85rem;">${noMatchMsg}</div>`;
        }
        return;
      }
      
      drawerListEl.style.display = "block";
      if (drawerEmptyState) drawerEmptyState.style.display = "none";

      drawerListEl.innerHTML = "";

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const yesterdayStart = todayStart - 86400000;
      const weekStart = todayStart - 6 * 86400000;

      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      const groups = {
        today: { label: isEn ? "Today" : "আজ", items: [] },
        yesterday: { label: isEn ? "Yesterday" : "গতকাল", items: [] },
        week: { label: isEn ? "Previous 7 Days" : "বিগত ৭ দিন", items: [] },
        older: { label: isEn ? "Older Chats" : "পূর্ববর্তী চ্যাট", items: [] }
      };

      sessions.forEach((s) => {
        const t = s.updatedAt || 0;
        if (t >= todayStart) groups.today.items.push(s);
        else if (t >= yesterdayStart) groups.yesterday.items.push(s);
        else if (t >= weekStart) groups.week.items.push(s);
        else groups.older.items.push(s);
      });

      Object.values(groups).forEach((group) => {
        if (!group.items.length) return;
        const sectionLabel = document.createElement("div");
        sectionLabel.className = "drawer-section-label";
        sectionLabel.textContent = group.label;
        drawerListEl.appendChild(sectionLabel);

        group.items.forEach((session) => {
          const item = document.createElement("div");
          item.className = `drawer-session-item ${session.id === currentSessionId ? "active" : ""}`;

          item.innerHTML = `
            <div class="drawer-session-title" title="${escapeHtml(session.title || (isEn ? "Untitled Chat" : "নামহীন চ্যাট"))}">${escapeHtml(session.title || (isEn ? "Untitled Chat" : "নামহীন চ্যাট"))}</div>
            <div class="drawer-session-actions">
              <button type="button" class="drawer-session-action-btn edit-session-btn" title="${isEn ? "Rename" : "নাম পরিবর্তন করুন"}" aria-label="${isEn ? "Rename" : "নাম পরিবর্তন করুন"}">
                <svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </button>
              <button type="button" class="drawer-session-action-btn del-session-btn" title="${isEn ? "Delete" : "মুছে ফেলুন"}" aria-label="${isEn ? "Delete" : "মুছে ফেলুন"}">
                <svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          `;

          item.addEventListener("click", (e) => {
            if (e.target.closest(".drawer-session-action-btn")) return;
            loadSession(session.id);
            closeSidebarDrawer();
          });

          const editBtn = item.querySelector(".edit-session-btn");
          editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            showCustomUI("prompt", "চ্যাটের নতুন শিরোনাম লিখুন:", session.title, (newTitle) => {
              if (newTitle && newTitle.trim()) {
                session.title = newTitle.trim();
                const all = loadAllSessions();
                const idx = all.findIndex(s => s.id === session.id);
                if (idx !== -1) {
                  all[idx].title = session.title;
                  saveAllSessions(all);
                  renderDrawerHistoryList(drawerSearchInput ? drawerSearchInput.value : "");
                  renderChatHistoryList();
                  showToast("শিরোনাম পরিবর্তিত হয়েছে", "success");
                }
              }
            });
          });

          const delBtn = item.querySelector(".del-session-btn");
          delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            showCustomUI("confirm", "আপনি কি এই চ্যাটটি মুছে ফেলতে চান?", null, (confirmed) => {
              if (confirmed) {
                const remaining = loadAllSessions().filter((s) => s.id !== session.id);
                saveAllSessions(remaining);
                if (currentSessionId === session.id) startNewChat();
                renderDrawerHistoryList(drawerSearchInput ? drawerSearchInput.value : "");
                renderChatHistoryList();
                showToast("চ্যাট মুছে ফেলা হয়েছে", "success");
              }
            });
          });

          drawerListEl.appendChild(item);
        });
      });
    }

    // ===== Account Modal Tabs Initialization =====
    function initAccountTabs() {
      const nav = document.getElementById("accountTabsNav");
      if (!nav) return;
      nav.addEventListener("click", (e) => {
        const btn = e.target.closest(".account-tab-pill");
        if (!btn) return;
        const targetTabId = btn.dataset.tab;
        if (!targetTabId) return;

        nav.querySelectorAll(".account-tab-pill").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const modal = document.getElementById("accountModalOverlay");
        if (!modal) return;
        modal.querySelectorAll(".account-tab-panel").forEach(p => p.classList.remove("active"));
        const targetPanel = document.getElementById(targetTabId);
        if (targetPanel) targetPanel.classList.add("active");

        triggerHaptic("light");
      });
    }

    // ===== Scroll-to-Bottom FAB =====
    function initScrollToBottomFAB() {
      const btn = document.getElementById("scrollToBottomBtn");
      const container = document.getElementById("scrollContainer");
      if (!btn || !container) return;

      container.addEventListener("scroll", debounce(() => {
        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distFromBottom > 160) {
          btn.classList.add("visible");
        } else {
          btn.classList.remove("visible");
        }
      }, 150), { passive: true });

      btn.addEventListener("click", () => {
        scrollToBottom(true, "smooth");
        triggerHaptic("light");
      });
    }

    // ===== Drag and Drop Overlay =====
    function initDragAndDrop() {
      const scrollEl = document.getElementById("scrollContainer");
      const overlay = document.getElementById("dropOverlay");
      if (!scrollEl || !overlay) return;

      let dragCounter = 0;

      scrollEl.addEventListener("dragenter", (e) => {
        e.preventDefault();
        dragCounter++;
        overlay.classList.add("active");
      });

      scrollEl.addEventListener("dragover", (e) => {
        e.preventDefault();
      });

      scrollEl.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          overlay.classList.remove("active");
        }
      });

      scrollEl.addEventListener("drop", (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.remove("active");

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const files = Array.from(e.dataTransfer.files);
          const images = files.filter(f => f.type.startsWith("image/"));
          const docs = files.filter(f => !f.type.startsWith("image/"));

          if (images.length > 0 && typeof handleImageFiles === "function") {
            handleImageFiles(images);
          }
          if (docs.length > 0 && typeof handleDocFiles === "function") {
            handleDocFiles(docs);
          }
          soundEngine.playReceive();
          triggerHaptic("medium");
          showToast(`${files.length}টি ফাইল যুক্ত করা হয়েছে`, "success");
        }
      });
    }

    // ===== Composer Quick Bar Pills =====
    function initComposerQuickBar() {
      const pillSearch = document.getElementById("pillWebSearch");
      const pillImage = document.getElementById("pillImageGen");
      const clearBtn = document.getElementById("clearInputBtn");
      const userInput = document.getElementById("userInput");

      if (pillSearch) {
        pillSearch.addEventListener("click", () => {
          const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
          isWebSearchEnabled = !isWebSearchEnabled;
          pillSearch.classList.toggle("active", isWebSearchEnabled);
          triggerHaptic("light");
          showToast(isWebSearchEnabled ? (isEn ? "Web search enabled" : "ওয়েব সার্চ সক্রিয় হয়েছে") : (isEn ? "Web search disabled" : "ওয়েব সার্চ নিষ্ক্রিয় হয়েছে"), "success");
          if (typeof updateAttachBtnActiveState === "function") updateAttachBtnActiveState();
          const txt = document.getElementById("webSearchText");
          if (txt) txt.textContent = isWebSearchEnabled ? (isEn ? "Web Search: On" : "ওয়েব সার্চ: চালু") : (isEn ? "Web Search: Off" : "ওয়েব সার্চ: বন্ধ");
        });
      }

      if (pillImage) {
        pillImage.addEventListener("click", () => {
          const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
          isImageGenEnabled = !isImageGenEnabled;
          pillImage.classList.toggle("active", isImageGenEnabled);
          triggerHaptic("light");
          showToast(isImageGenEnabled ? (isEn ? "Image generation enabled" : "ছবি তৈরি সক্রিয় হয়েছে") : (isEn ? "Image generation disabled" : "ছবি তৈরি নিষ্ক্রিয় হয়েছে"), "success");
          if (typeof updateAttachBtnActiveState === "function") updateAttachBtnActiveState();
          const txt = document.getElementById("imageGenText");
          if (txt) txt.textContent = isImageGenEnabled ? (isEn ? "Image Gen: On" : "ছবি তৈরি: চালু") : (isEn ? "Image Gen: Off" : "ছবি তৈরি: বন্ধ");
        });
      }

      if (clearBtn && userInput) {
        userInput.addEventListener("input", () => {
          clearBtn.style.display = userInput.value.trim().length > 0 ? "inline-flex" : "none";
        });
        clearBtn.addEventListener("click", () => {
          userInput.value = "";
          userInput.style.height = "auto";
          clearBtn.style.display = "none";
          if (typeof updateSendAvailability === "function") updateSendAvailability();
        });
      }
    }

    const brandMenuBtn = document.getElementById("brandMenuBtn");
    const brandMenuOverlay = document.getElementById("brandMenuOverlay");
    const brandMenuClose = document.getElementById("brandMenuClose");

    function openBrandMenu() {
      openSidebarDrawer();
    }
    function closeBrandMenu() {
      closeSidebarDrawer();
      if (brandMenuOverlay) brandMenuOverlay.classList.remove("open");
    }

    if (brandMenuBtn) brandMenuBtn.addEventListener("click", openBrandMenu);
    if (brandMenuClose) brandMenuClose.addEventListener("click", closeBrandMenu);
    if (brandMenuOverlay) {
      brandMenuOverlay.addEventListener("click", (e) => {
        if (e.target === brandMenuOverlay) closeBrandMenu();
      });
    }

    const accountMenuBtn = document.getElementById("accountMenuBtn");
    const accountModalOverlay = document.getElementById("accountModalOverlay");
    const accountModalClose = document.getElementById("accountModalClose");
    const accountNameInput = document.getElementById("accountNameInput");
    const accountNameDisplay = document.getElementById("accountNameDisplay");
    const accountAvatar = document.getElementById("accountAvatar");
    const accountSaveBtn = document.getElementById("accountSaveBtn");
    const accountResetBtn = document.getElementById("accountResetBtn");
    const accountStatTokens = document.getElementById("accountStatTokens");
    const accountStatCost = document.getElementById("accountStatCost");
    const accountStatMessages = document.getElementById("accountStatMessages");
    const accountStatImages = document.getElementById("accountStatImages");

    let messageCount = 0;
    try {
      messageCount = parseInt(localStorage.getItem("alokpoth_message_count") || "0", 10) || 0;
    } catch(e) { console.error('[Alokpoth]', e); }

    function getAccountName() {
      try {
        const stored = localStorage.getItem("alokpoth_account_name");
        if (stored && stored.trim() && stored.trim() !== "লগইন করা নেই" && stored.trim() !== "Not Logged In") {
          return stored.trim();
        }
        const userStr = localStorage.getItem("alokpoth_user");
        if (userStr) {
          const u = JSON.parse(userStr);
          if (u.name && u.name.trim()) return u.name.trim();
          if (u.email && u.email.trim()) return u.email.split("@")[0].trim();
        }
      } catch(e) { console.error('[Alokpoth]', e); }
      return "";
    }

    function applyAccountName(name) {
      const token = localStorage.getItem("alokpoth_token");
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      let resolvedName = (name && typeof name === "string" && name.trim() && name.trim() !== "লগইন করা নেই" && name.trim() !== "Not Logged In") ? name.trim() : "";
      if (!resolvedName && token) {
        resolvedName = getAccountName();
      }
      if (!resolvedName && token) {
        resolvedName = isEn ? "User" : "ব্যবহারকারী";
      }

      const notLoggedInText = isEn ? "Not Logged In" : "লগইন করা নেই";
      const displayName = token ? resolvedName : notLoggedInText;
      const initial = token ? (resolvedName ? resolvedName.trim().charAt(0).toUpperCase() : "U") : "অ";

      if (accountNameDisplay) accountNameDisplay.textContent = displayName;
      if (accountAvatar) accountAvatar.textContent = initial;

      const dName = document.getElementById("drawerUserName");
      const dAv = document.getElementById("drawerAvatar");
      if (dName) dName.textContent = displayName;
      if (dAv) dAv.textContent = initial;

      const currentNameDisplay = document.getElementById("accountNameDisplay");
      if (currentNameDisplay) currentNameDisplay.textContent = displayName;
    }

    function renderAccountStats() {
      const totalTokens = usageTotals.inputTokens + usageTotals.outputTokens;
      const costText = usageTotals.costUSD < 0.01 && usageTotals.costUSD > 0
        ? `$${usageTotals.costUSD.toFixed(5)}`
        : `$${usageTotals.costUSD.toFixed(4)}`;
      if (accountStatTokens) accountStatTokens.textContent = totalTokens.toLocaleString("bn-BD");
      if (accountStatCost) accountStatCost.textContent = costText;
      if (accountStatMessages) accountStatMessages.textContent = messageCount.toLocaleString("bn-BD");
      if (accountStatImages) accountStatImages.textContent = (usageTotals.images || 0).toLocaleString("bn-BD");
      if (typeof renderDailyUsage === "function") renderDailyUsage();
    }

    function purgeLocalUserData() {
      const keys = [
        "alokpoth_token", "alokpoth_user", "alokpoth_account_name",
        "alokpoth_chat_sessions", "alokpoth_current_session_id",
        "alokpoth_message_count", "alokpoth_daily_usage",
        "alokpoth_window_usage", "alokpoth_image_window_usage",
        "alokpoth_plan_expiry", "alokpoth_plan_expires_at",
        "alokpoth_current_plan", "alokpoth_user_plan", "alokpoth_plan",
        "alokpoth_usage_window"
      ];
      keys.forEach(k => { try { localStorage.removeItem(k); } catch(e) { console.error('[Alokpoth]', e); } });
      currentPlan = "Free";
      try {
        localStorage.setItem("alokpoth_current_plan", "Free");
        localStorage.setItem("alokpoth_plan", "Free");
        localStorage.setItem("alokpoth_user_plan", "Free");
      } catch(e) { console.error('[Alokpoth]', e); }
      messageCount = 0;
      currentSessionId = null;
      messagesHistory = [{ role: "system", content: typeof SYSTEM_PROMPT !== "undefined" ? SYSTEM_PROMPT : "" }];
      if (typeof clearComposerState === "function") clearComposerState();
      if (typeof renderChatHistoryList === "function") renderChatHistoryList();
      if (typeof renderDrawerHistoryList === "function") renderDrawerHistoryList();
      if (chatStream && typeof getEmptyStateHtml === "function") {
        chatStream.innerHTML = getEmptyStateHtml();
        emptyState = document.getElementById("emptyState");
      }
      applyAccountName("");
      renderCreditBalance();
      if (typeof updateAuthUIState === "function") updateAuthUIState();
      if (typeof updateNavbarCreditBadge === "function") updateNavbarCreditBadge();
    }

    async function syncUserProfileFromServer() {
      const token = localStorage.getItem("alokpoth_token");
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/auth/me?_t=${Date.now()}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" }
        });
        if (res.status === 403) {
          showToast("আপনার অ্যাকাউন্টটি অ্যাডমিন দ্বারা ব্লক করা হয়েছে!", "error");
          performAccountLogout(true);
          return;
        }
        if (res.status === 401) {
          purgeLocalUserData();
          return;
        }
        if (!localStorage.getItem("alokpoth_token")) return;
        const data = await res.json();
        if (!localStorage.getItem("alokpoth_token")) return;
        if (res.ok && data.success && data.user) {
          if (data.token) {
            try { localStorage.setItem("alokpoth_token", data.token); } catch(e) { console.error('[Alokpoth]', e); }
          }
          const u = data.user;
          try { localStorage.setItem("alokpoth_user", JSON.stringify(u)); } catch(e) { console.error('[Alokpoth]', e); }

          const resolvedUserName = (u.name && u.name.trim()) || (u.email ? u.email.split('@')[0].trim() : "");
          if (resolvedUserName) {
            applyAccountName(resolvedUserName);
            if (accountNameInput) accountNameInput.value = resolvedUserName;
            try { localStorage.setItem("alokpoth_account_name", resolvedUserName); } catch(e) { console.error('[Alokpoth]', e); }
          } else {
            applyAccountName(getAccountName());
          }

          const adminEmails = ["zihanfakir@gmail.com", "x@zihan.uk"];
          const isAdminUser = u.role === "admin" || (u.email && adminEmails.includes(u.email.toLowerCase().trim()));
          if (isAdminUser) {
            currentPlan = "Max";
            saveCurrentPlan("Max");
            try {
              localStorage.removeItem(PLAN_EXPIRY_KEY);
              localStorage.removeItem("alokpoth_plan_expiry");
            } catch(e) { console.error('[Alokpoth]', e); }
          } else if (u.subscription && u.subscription.plan_name) {
            // Check expiry
            if (u.subscription.expires_at) {
              const expDate = new Date(u.subscription.expires_at);
              if (!isNaN(expDate.getTime()) && Date.now() >= expDate.getTime()) {
                currentPlan = "Free";
                saveCurrentPlan("Free");
                try {
                  localStorage.removeItem(PLAN_EXPIRY_KEY);
                  localStorage.removeItem("alokpoth_plan_expiry");
                } catch(e) { console.error('[Alokpoth]', e); }
              } else {
                currentPlan = u.subscription.plan_name;
                saveCurrentPlan(currentPlan);
                try {
                  localStorage.setItem(PLAN_EXPIRY_KEY, u.subscription.expires_at);
                  localStorage.setItem("alokpoth_plan_expiry", u.subscription.expires_at);
                } catch(e) { console.error('[Alokpoth]', e); }
              }
            } else {
              currentPlan = u.subscription.plan_name;
              saveCurrentPlan(currentPlan);
              try {
                localStorage.removeItem(PLAN_EXPIRY_KEY);
                localStorage.removeItem("alokpoth_plan_expiry");
              } catch(e) { console.error('[Alokpoth]', e); }
            }
          } else {
            currentPlan = "Free";
            saveCurrentPlan("Free");
          }
          if (u.rateLimit || u.usage) {
            const lim = u.rateLimit || u.usage;
            if (lim.limit && lim.windowHours && currentPlan) {
              const existingImg = DYNAMIC_PLAN_LIMITS[currentPlan]?.image_limit;
              const imgLim = (lim.image_limit !== undefined || lim.imageLimit !== undefined)
                ? Number(lim.image_limit ?? lim.imageLimit)
                : (existingImg !== undefined ? existingImg : (currentPlan === 'Max' ? 100 : (currentPlan === 'Pro' ? 20 : 3)));
              DYNAMIC_PLAN_LIMITS[currentPlan] = {
                limit: Number(lim.limit),
                hours: Number(lim.windowHours),
                image_limit: imgLim
              };
            }
            try {
              const startTimestamp = lim.start || (lim.resetAt ? (new Date(lim.resetAt).getTime() - (lim.windowHours * 60 * 60 * 1000)) : Date.now());
              localStorage.setItem(USAGE_WINDOW_KEY, JSON.stringify({
                count: (lim.count !== undefined ? lim.count : lim.used) || 0,
                start: startTimestamp,
                resetAt: lim.resetAt || (lim.resetInMinutes ? new Date(Date.now() + lim.resetInMinutes * 60 * 1000).toISOString() : null)
              }));
            } catch(e) { console.error('[Alokpoth]', e); }
          }
          renderCreditBalance();
          if (typeof updateAuthUIState === "function") updateAuthUIState();
        }
      } catch (e) {
        console.warn("Could not sync user profile:", e);
      }
    }

    let accountCountdownInterval = null;

    function switchAccountTab(tabId) {
      const nav = document.getElementById("accountTabsNav");
      const modal = document.getElementById("accountModalOverlay");
      if (!nav || !modal) return;
      nav.querySelectorAll(".account-tab-pill").forEach(b => {
        b.classList.toggle("active", b.dataset.tab === tabId);
      });
      modal.querySelectorAll(".account-tab-panel").forEach(p => {
        p.classList.toggle("active", p.id === tabId);
      });
    }

    /* ===== Settings Subview Navigation & i18n Engine ===== */
    function showSettingsView(viewId, fromHistory = false) {
      const views = document.querySelectorAll("#accountModalOverlay .settings-subview");
      views.forEach(v => {
        v.classList.toggle("active", v.id === viewId);
      });
      const target = document.getElementById(viewId);
      if (target) target.scrollTop = 0;

      if (accountModalOverlay && accountModalOverlay.classList.contains("open") && !fromHistory) {
        if (viewId === "settingsMainView") {
          if (history.state && history.state.page && history.state.page.startsWith("account_sub_")) {
            try { history.replaceState({ page: "account" }, ""); } catch(e) { console.error('[Alokpoth]', e); }
          }
        } else {
          pushPageState("account_sub_" + viewId);
        }
      }
      
      if (viewId === 'settingsAccountView') {
        refreshAccountSubpageUI();
      } else if (viewId === 'settingsLanguageView') {
        refreshLanguageSubpageUI();
      } else if (viewId === 'settingsThemeView') {
        refreshThemeSubpageUI();
      } else if (viewId === 'settingsLimitsView') {
        syncPlanLimitsFromServer();
        renderCreditBalance();
        startQuotaCountdownTimer();
      }
    }
    window.showSettingsView = showSettingsView;

    const I18N = {
      bn: {
        // App & Navigation
        appBrand: "Alokpoth",
        appTagline: "বাংলা ও ইংরেজিতে স্মার্ট সহকারী",
        modelSelectorAria: "AI মডেল নির্বাচন",
        newChatAria: "নতুন চ্যাট",
        menuAria: "প্রধান মেনু",
        sendBtnAria: "মেসেজ পাঠান",
        stopBtnAria: "থামুন",
        micBtnAria: "ভয়েস রেকর্ড করুন",
        attachBtnAria: "ছবি বা ফাইল যুক্ত করুন",

        // Drawer
        drawerSearchPlaceholder: "চ্যাটের বিষয়বস্তু অনুসন্ধান করুন...",
        drawerNoChatsTitle: "কোনো চ্যাট নেই",
        drawerNoChatsSub: "আপনার Alokpoth-এর সাথে চ্যাট এখানে প্রদর্শিত হবে।",
        drawerEmptyNewChatBtn: "নতুন চ্যাট",
        drawerDownloadApp: "অ্যাপ ডাউনলোড",
        drawerUserLoggedOut: "লগইন করা নেই",
        drawerSettings: "সেটিংস",
        drawerPlans: "প্ল্যান ও আপগ্রেড",
        drawerLogin: "লগইন করুন",
        drawerLogout: "লগআউট",
        recentChatsHeader: "সাম্প্রতিক চ্যাট",
        pinChat: "পিন করুন",
        unpinChat: "আনপিন করুন",
        renameChat: "নাম পরিবর্তন",
        deleteChat: "মুছে ফেলুন",

        // Welcome Hero & Empty State
        welcomeGreeting: "আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
        welcomeSubtitle: "যেকোনো প্রশ্ন লিখুন, কোডিং করুন বা নতুন কিছু জানুন",
        heroDownloadBannerText: "অ্যান্ড্রয়েড অ্যাপ ব্যবহার করুন — ",
        heroDownloadBannerBtn: "APK ডাউনলোড করুন",
        quickPromptWebCode: "ফুল ওয়েবসাইট কোড",
        quickPromptTranslate: "অনুবাদ করুন",
        quickPromptSummary: "সারাংশ তৈরি",
        quickPromptStory: "গল্প লিখুন",

        // Composer
        inputPlaceholder: "আলোকপথ AI-কে জিজ্ঞাসা করুন...",
        micTitle: "কথা বলে লিখুন",
        micRecordingTitle: "রেকর্ডিং বন্ধ করতে চাপুন",
        micRecordingText: "রেকর্ড হচ্ছে",
        micListeningPlaceholder: "শুনছি... কথা বলুন...",
        micErrorToast: "মাইক্রোফোনে সমস্যা হয়েছে",
        micActiveToast: "কথা বলুন... (বাংলা ও ইংরেজি)",
        attachImageText: "ছবি যুক্ত করুন",
        attachFileText: "ফাইল যুক্ত করুন (PDF/TXT/HTML/CSS/JS)",
        webSearchOn: "ওয়েব সার্চ: চালু",
        webSearchOff: "ওয়েব সার্চ: বন্ধ",
        imageGenOn: "ছবি তৈরি: চালু",
        imageGenOff: "ছবি তৈরি: বন্ধ",
        footerDisclaimer: "আলোকপথ AI ভুল করতে পারে। গুরুত্বপূর্ণ তথ্যাদি যাচাই করে নিন।",
        dropOverlayTitle: "ফাইল বা ছবি এখানে ড্রপ করুন",
        dropOverlaySub: "ছবি, পিডিএফ বা টেক্সট ফাইল সরাসরি যুক্ত হবে",
        filesAttachedToast: "টি ফাইল যুক্ত করা হয়েছে",

        // Message Actions
        copyBtnText: "কপি",
        copiedBtnText: "কপি হয়েছে!",
        ttsBtnText: "শুনুন",
        ttsStopText: "থামুন",
        shareBtnText: "শেয়ার",
        regenBtnText: "আবার লিখুন",
        thinkingText: "চিন্তা করছে...",
        searchingWebText: "ওয়েবে অনুসন্ধান করা হচ্ছে...",
        codeCopyBtnText: "কোড কপি",
        codeCopiedBtnText: "কপি হয়েছে!",

        // Model Picker Modal
        modelModalTitle: "AI মডেল নির্বাচন করুন",
        modelSearchPlaceholder: "মডেলের নাম বা প্রোভাইডার দিয়ে খুঁজুন...",
        modelCardSelect: "নির্বাচন করুন",
        modelStatusOnline: "অনলাইন",
        modelStatusChecking: "যাচাই হচ্ছে...",
        modelStatusOffline: "অফলাইন",
        modelStatusSlow: "ধীরগতি",

        // Download Modal
        appModalTitle: "অ্যান্ড্রয়েড অ্যাপ ডাউনলোড",
        appModalDesc: "স্মার্টফোনে আরও দ্রুত ও স্মুথ অভিজ্ঞতার জন্য ইনস্টল করুন।",
        appModalFeature1: "সুপারফাস্ট 144Hz পারফরম্যান্স",
        appModalFeature2: "অফলাইন হিস্ট্রি ও ব্যাকআপ",
        appModalFeature3: "ভয়েস টাইপিং ও ডার্ক মোড",
        appModalDownloadBtn: "APK ডাউনলোড করুন (v1.0)",

        // Custom Dialogs & Alerts
        dialogConfirmDeleteTitle: "চ্যাট মুছে ফেলা",
        dialogConfirmDeleteMsg: "আপনি কি নিশ্চিত এই কথোপকথনটি স্থায়ীভাবে মুছে ফেলতে চান?",
        dialogRenameTitle: "চ্যাটের নাম পরিবর্তন",
        dialogRenamePlaceholder: "নতুন নাম লিখুন...",
        dialogOk: "ঠিক আছে",
        dialogCancel: "বাতিল",
        dialogConfirm: "নিশ্চিত করুন",

        // Settings Subpages
        backBtn: "ফিরে যান",
        backToSettings: "সেটিংস",
        settingsTitle: "একাউন্ট ও সেটিংস",
        profile: "প্রোফাইল",
        accountSettings: "অ্যাকাউন্ট সেটিংস",
        planAndUpgrade: "প্ল্যান ও আপগ্রেড",
        redeemCode: "রিডিম কোড",
        app: "অ্যাপ",
        language: "ভাষা",
        theme: "চেহারা (থিম)",
        about: "সম্পর্কে",
        checkUpdates: "আপডেটের জন্য চেক করুন",
        helpFeedback: "সাহায্য ও প্রতিক্রিয়া",
        logoutLogin: "লগ আউট / লগইন",
        nameLabel: "আপনার নাম",
        saveName: "নাম পরিবর্তন সংরক্ষণ করুন",
        changePassTitle: "পাসওয়ার্ড পরিবর্তন",
        savePassBtn: "পাসওয়ার্ড আপডেট করুন",
        redeemBtn: "কোড রিডিম করুন",
        redeemPromoTitle: "প্রোমো কোড ব্যবহার করুন",
        redeemHint: "যেকোনো প্রোমো কোড বা ভাউচার কোড ব্যবহার করে আপনার একাউন্ট প্রো বা ম্যাক্স প্ল্যানে তাৎক্ষণিক আপগ্রেড করতে পারবেন।",
        themeDark: "ডার্ক (Dark - ডিফল্ট)",
        themeSapphire: "স্যাফায়ার (Sapphire - নেভি ব্লু)",
        themeLight: "লাইট (Light)",
        themeEyecare: "আইকেয়ার (Eye Care - সেপিয়া)",
        themeOled: "ওলেড (OLED - খাঁটি কালো)",
        versionStatus: "আপনি সর্বশেষ সংস্করণ ব্যবহার করছেন।",
        downloadApk: "নতুন APK ডাউনলোড করুন",
        feedbackLabel: "আপনার মতামত বা প্রতিক্রিয়া",
        feedbackSubmit: "প্রতিক্রিয়া পাঠান",
        feedbackPlaceholder: "আপনার মূল্যবান পরামর্শ বা সমস্যা লিখুন...",
        feedbackDirectContact: "সরাসরি যোগাযোগ:",
        feedbackEmailLabel: "ইমেইল:",
        feedbackWebsiteLabel: "ওয়েবসাইট:",
        usageLimits: "ব্যবহারের সীমা",
        usageLimitsTitle: "ব্যবহারের সীমা ও কোটা",
        quotaTitle: "মেসেজ কোটা",
        imageQuotaTitle: "ছবি তৈরির কোটা",
        quotaMessages: "বার্তা",
        quotaImages: "ছবি তৈরি",
        quotaModels: "মডেল",
        quotaSpeed: "স্পিড",
        quotaReset: "রিসেট",
        allPlansTitle: "সব প্ল্যানের তুলনা",
        showAllPlans: "সব প্ল্যান দেখুন",
        collapsePlans: "সংক্ষেপ করুন",
        hideAllPlans: "প্ল্যান লুকান",
        currentPlanTag: "বর্তমান"
      },
      en: {
        // App & Navigation
        appBrand: "Alokpoth",
        appTagline: "Smart Bilingual AI Assistant",
        modelSelectorAria: "Select AI Model",
        newChatAria: "New Chat",
        menuAria: "Main Menu",
        sendBtnAria: "Send Message",
        stopBtnAria: "Stop",
        micBtnAria: "Voice Typing",
        attachBtnAria: "Attach photos or files",

        // Drawer
        drawerSearchPlaceholder: "Search conversation history...",
        drawerNoChatsTitle: "No chats yet",
        drawerNoChatsSub: "Your conversations with Alokpoth will appear here.",
        drawerEmptyNewChatBtn: "New Chat",
        drawerDownloadApp: "Download App",
        drawerUserLoggedOut: "Not Logged In",
        drawerSettings: "Settings",
        drawerPlans: "Plans & Upgrade",
        drawerLogin: "Log In",
        drawerLogout: "Log Out",
        recentChatsHeader: "Recent Chats",
        pinChat: "Pin Chat",
        unpinChat: "Unpin Chat",
        renameChat: "Rename",
        deleteChat: "Delete",

        // Welcome Hero & Empty State
        welcomeGreeting: "How can I help you today?",
        welcomeSubtitle: "Ask any question, brainstorm, or write code with AI",
        heroDownloadBannerText: "Get the Android App — ",
        heroDownloadBannerBtn: "Download APK",
        quickPromptWebCode: "Full Website Code",
        quickPromptTranslate: "Translate Text",
        quickPromptSummary: "Summarize Text",
        quickPromptStory: "Write a Story",

        // Composer
        inputPlaceholder: "Ask Alokpoth anything...",
        micTitle: "Voice Typing (Speak)",
        micRecordingTitle: "Click to stop recording",
        micRecordingText: "Recording",
        micListeningPlaceholder: "Listening... Speak now...",
        micErrorToast: "Microphone error encountered",
        micActiveToast: "Listening... (Microphone active)",
        attachImageText: "Upload Image",
        attachFileText: "Upload File (PDF/TXT/HTML/CSS/JS)",
        webSearchOn: "Web Search: ON",
        webSearchOff: "Web Search: OFF",
        imageGenOn: "Image Generation: ON",
        imageGenOff: "Image Generation: OFF",
        footerDisclaimer: "Alokpoth can make mistakes. Please verify important info.",
        dropOverlayTitle: "Drop files or images here",
        dropOverlaySub: "Images, PDFs, and code files will be attached instantly",
        filesAttachedToast: "file(s) attached successfully",

        // Message Actions
        copyBtnText: "Copy",
        copiedBtnText: "Copied!",
        ttsBtnText: "Listen",
        ttsStopText: "Stop",
        shareBtnText: "Share",
        regenBtnText: "Regenerate",
        thinkingText: "Thinking...",
        searchingWebText: "Searching the web...",
        codeCopyBtnText: "Copy Code",
        codeCopiedBtnText: "Copied!",

        // Model Picker Modal
        modelModalTitle: "Select AI Model",
        modelSearchPlaceholder: "Search by model name...",
        modelCardSelect: "Select",
        modelStatusOnline: "Online",
        modelStatusChecking: "Checking...",
        modelStatusOffline: "Offline",
        modelStatusSlow: "Slow",

        // Download Modal
        appModalTitle: "Download Android App",
        appModalDesc: "Enjoy a faster, smoother 144Hz experience on your Android smartphone.",
        appModalFeature1: "Ultra-smooth 144Hz performance",
        appModalFeature2: "Local chat privacy & offline backup",
        appModalFeature3: "Voice typing & beautiful dark mode",
        appModalDownloadBtn: "Download APK (v1.0)",

        // Custom Dialogs & Alerts
        dialogConfirmDeleteTitle: "Delete Conversation",
        dialogConfirmDeleteMsg: "Are you sure you want to permanently delete this chat?",
        dialogRenameTitle: "Rename Conversation",
        dialogRenamePlaceholder: "Enter new title...",
        dialogOk: "OK",
        dialogCancel: "Cancel",
        dialogConfirm: "Confirm",

        // Settings Subpages
        backBtn: "Back",
        backToSettings: "Settings",
        settingsTitle: "Account & Settings",
        profile: "Profile",
        accountSettings: "Account Settings",
        planAndUpgrade: "Plans & Upgrade",
        redeemCode: "Redeem Code",
        app: "App",
        language: "Language",
        theme: "Appearance (Theme)",
        about: "About",
        checkUpdates: "Check for Updates",
        helpFeedback: "Help & Feedback",
        logoutLogin: "Log Out / Log In",
        nameLabel: "Your Name",
        saveName: "Save Changes",
        changePassTitle: "Change Password",
        savePassBtn: "Update Password",
        redeemBtn: "Claim Code",
        redeemPromoTitle: "Use Promo Code",
        redeemHint: "Upgrade your account instantly with any voucher or promo code.",
        themeDark: "Dark (Default)",
        themeSapphire: "Sapphire (Deep Navy Blue)",
        themeLight: "Light",
        themeEyecare: "Eye Care (Sepia)",
        themeOled: "OLED (Pure Black)",
        versionStatus: "You are on the latest version.",
        downloadApk: "Download Android APK",
        feedbackLabel: "Your Feedback or Suggestion",
        feedbackSubmit: "Submit Feedback",
        feedbackPlaceholder: "Write your valuable feedback or issue here...",
        feedbackDirectContact: "Direct Contact:",
        feedbackEmailLabel: "Email:",
        feedbackWebsiteLabel: "Website:",
        usageLimits: "Usage Limits",
        usageLimitsTitle: "Usage Limits & Quota",
        quotaTitle: "Message Quota",
        imageQuotaTitle: "Image Quota",
        quotaMessages: "Messages",
        quotaImages: "Images",
        quotaModels: "Models",
        quotaSpeed: "Speed",
        quotaReset: "Reset",
        allPlansTitle: "Compare All Plans",
        showAllPlans: "Show All Plans",
        collapsePlans: "Collapse",
        hideAllPlans: "Hide Plans",
        currentPlanTag: "Current"
      }
    };

    function selectAppLanguage(lang) {
      currentLanguage = lang;
      try { localStorage.setItem("alokpoth_lang", lang); } catch(e) { console.error('[Alokpoth]', e); }
      document.documentElement.setAttribute("lang", lang);
      applyI18n();
      refreshLanguageSubpageUI();
      refreshThemeSubpageUI();

      // Update active system prompt to match language
      if (typeof messagesHistory !== "undefined") {
        const curMod = (typeof MODELS !== "undefined" && Array.isArray(MODELS)) ? MODELS.find(m => m.id === selectedModelId) : null;
        const modName = curMod ? curMod.name : "Alokpoth";
        const prompt = buildSystemPrompt(modName, true, true);
        if (messagesHistory.length > 0 && messagesHistory[0].role === "system") {
          messagesHistory[0].content = prompt;
        } else {
          messagesHistory.unshift({ role: "system", content: prompt });
        }
      }

      // If we are on the welcome screen with no active chat, re-render it in new language
      const emptyStateEl = document.getElementById("emptyState");
      if (emptyStateEl && (!messagesHistory || messagesHistory.length <= 1)) {
        if (typeof startNewChat === "function") startNewChat();
      }

      showToast(lang === 'en' ? "Language switched to English" : "ভাষা বাংলায় পরিবর্তন করা হয়েছে", "success");
    }
    window.selectAppLanguage = selectAppLanguage;

    function applyI18n() {
      const isEn = (currentLanguage === 'en');
      const dict = I18N[currentLanguage] || I18N.bn;

      // 1. Data-i18n elements
      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (dict[key]) el.textContent = dict[key];
      });

      // 2. Data-i18n-placeholder
      document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (dict[key]) el.placeholder = dict[key];
      });

      // 3. Main user input
      const uInput = document.getElementById("userInput");
      if (uInput && dict.inputPlaceholder) {
        uInput.placeholder = dict.inputPlaceholder;
      }

      // 4. Drawer elements
      const dSearch = document.getElementById("drawerSearchInput");
      if (dSearch) dSearch.placeholder = dict.drawerSearchPlaceholder;

      const dEmptyState = document.getElementById("drawerEmptyState");
      if (dEmptyState) {
        const dEmptyTitle = dEmptyState.querySelector("div:first-child");
        if (dEmptyTitle) dEmptyTitle.textContent = dict.drawerNoChatsTitle;
        const dEmptySub = dEmptyState.querySelector("div:nth-child(2)");
        if (dEmptySub) dEmptySub.textContent = dict.drawerNoChatsSub;
        const dLimitBadge = document.getElementById("drawerLimitBadge");
        if (dLimitBadge) dLimitBadge.textContent = isEn ? "View Limits" : "সীমা দেখুন";
        const token = localStorage.getItem("alokpoth_token");
        const dUserName = document.getElementById("drawerUserName");
        const dUserPlan = document.getElementById("drawerUserPlan");
        if (!token && dUserName) dUserName.textContent = dict.drawerUserLoggedOut;
        if (!token && dUserPlan) dUserPlan.textContent = isEn ? "Sign in to unlock all features" : "চ্যাট করতে লগইন করুন";
        if (token) applyAccountName(getAccountName());
      }

      const dEmptyBtn = document.getElementById("drawerEmptyNewChatBtn");
      if (dEmptyBtn) dEmptyBtn.textContent = dict.drawerEmptyNewChatBtn;

      const dDownloadBtnSpan = document.querySelector("#drawerDownloadAppBtn span span:last-child");
      if (dDownloadBtnSpan) dDownloadBtnSpan.textContent = dict.drawerDownloadApp;

      // 5. Navigation buttons
      const brandBtn = document.getElementById("brandMenuBtn");
      if (brandBtn) {
        brandBtn.title = dict.menuAria;
        brandBtn.setAttribute("aria-label", dict.menuAria);
      }
      const quickNewChatBtn = document.getElementById("quickNewChatNavBtn");
      if (quickNewChatBtn) {
        quickNewChatBtn.title = dict.newChatAria;
        quickNewChatBtn.setAttribute("aria-label", dict.newChatAria);
      }

      // 6. Composer buttons & tooltips
      const attachBtnEl = document.getElementById("attachBtn");
      if (attachBtnEl) {
        attachBtnEl.title = dict.attachBtnAria;
        attachBtnEl.setAttribute("aria-label", dict.attachBtnAria);
      }

      const attachImgSpan = document.querySelector("#attachImageOption span");
      if (attachImgSpan) attachImgSpan.textContent = dict.attachImageText;

      const attachDocSpan = document.querySelector("#attachFileOption span");
      if (attachDocSpan) attachDocSpan.textContent = dict.attachFileText;

      const webSearchSpan = document.getElementById("webSearchText");
      if (webSearchSpan) webSearchSpan.textContent = isWebSearchEnabled ? dict.webSearchOn : dict.webSearchOff;

      const imgGenSpan = document.getElementById("imageGenText");
      if (imgGenSpan) imgGenSpan.textContent = isImageGenEnabled ? dict.imageGenOn : dict.imageGenOff;

      const micBtnEl = document.getElementById("micBtn");
      if (micBtnEl && !isSpeechRecording) {
        micBtnEl.title = dict.micTitle;
        micBtnEl.setAttribute("aria-label", dict.micBtnAria);
      }

      const sendBtnEl = document.getElementById("sendBtn");
      if (sendBtnEl) {
        sendBtnEl.setAttribute("aria-label", isGenerating ? dict.stopBtnAria : dict.sendBtnAria);
      }

      const footerNote = document.querySelector(".footer-note");
      if (footerNote) footerNote.textContent = dict.footerDisclaimer;

      // 7. Model picker modal
      const mSearch = document.getElementById("modelSearchInput");
      if (mSearch) mSearch.placeholder = dict.modelSearchPlaceholder;

      const mTitle = document.querySelector("#modelModalOverlay .modal-header span, .model-modal-header h3");
      if (mTitle) mTitle.textContent = dict.modelModalTitle;

      // 8. Settings badge
      const langNameBadge = document.getElementById("setMenuLangName");
      if (langNameBadge) {
        langNameBadge.textContent = isEn ? "English" : "বাংলা";
      }

      // 9. Hero greeting & quick prompt pills if rendered
      const heroGreeting = document.getElementById("heroGreetingText");
      if (heroGreeting) heroGreeting.textContent = dict.welcomeGreeting;

      const heroBanner = document.getElementById("heroAppDownloadBanner");
      if (heroBanner) {
        const textSpan = heroBanner.querySelector("span:last-child");
        if (textSpan) {
          textSpan.innerHTML = dict.heroDownloadBannerText + '<strong style="color: #60a5fa; text-decoration: underline;">' + dict.heroDownloadBannerBtn + '</strong>';
        }
      }

      // 10. Update Speech Recognition language dynamically
      if (speechRecognitionInstance) {
        speechRecognitionInstance.lang = isEn ? "en-US" : "bn-BD";
      }

      // 11. Synchronize Auth UI & live countdown timers with new language
      if (typeof updateAuthUIState === "function") {
        updateAuthUIState();
      }
      if (typeof updateQuotaCountdownDisplay === "function") {
        updateQuotaCountdownDisplay();
      }
    }
    window.applyI18n = applyI18n;

    function refreshLanguageSubpageUI() {
      const bnRow = document.getElementById("langOptBn");
      const enRow = document.getElementById("langOptEn");
      if (bnRow) bnRow.classList.toggle("selected", currentLanguage === 'bn');
      if (enRow) enRow.classList.toggle("selected", currentLanguage === 'en');
      const langNameBadge = document.getElementById("setMenuLangName");
      if (langNameBadge) {
        langNameBadge.textContent = currentLanguage === 'en' ? "English" : "বাংলা";
      }
    }
    window.refreshLanguageSubpageUI = refreshLanguageSubpageUI;

    function selectAppTheme(theme) {
      if (typeof setTheme === "function") setTheme(theme, true);
      refreshThemeSubpageUI();
    }
    window.selectAppTheme = selectAppTheme;

    function refreshThemeSubpageUI() {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const themeItems = {
        dark: document.getElementById("themeOptDark"),
        sapphire: document.getElementById("themeOptSapphire"),
        light: document.getElementById("themeOptLight"),
        eyecare: document.getElementById("themeOptEyecare"),
        oled: document.getElementById("themeOptOled")
      };
      Object.keys(themeItems).forEach(t => {
        if (themeItems[t]) {
          themeItems[t].classList.toggle("selected", current === t);
        }
      });
      const themeNameBadge = document.getElementById("setMenuThemeName");
      if (themeNameBadge) {
        const namesBn = { dark: "ডার্ক", light: "লাইট", eyecare: "আইকেয়ার", oled: "ওলেড", sapphire: "স্যাফায়ার" };
        const namesEn = { dark: "Dark", light: "Light", eyecare: "Eye Care", oled: "OLED", sapphire: "Sapphire" };
        themeNameBadge.textContent = currentLanguage === 'en' ? (namesEn[current] || current) : (namesBn[current] || current);
      }
    }
    window.refreshThemeSubpageUI = refreshThemeSubpageUI;

    function refreshAccountSubpageUI() {
      const token = localStorage.getItem("alokpoth_token");
      const nameInput = document.getElementById("subAccountNameInput");
      const nameDisplay = document.getElementById("subAccountDisplayName");
      const emailDisplay = document.getElementById("subAccountEmailDisplay");
      const avatarEl = document.getElementById("subAccountAvatar");
      const passCard = document.getElementById("subPasswordCard");

      const currentName = localStorage.getItem("alokpoth_account_name") || "";
      let userObj = null;
      try {
        userObj = JSON.parse(localStorage.getItem("alokpoth_user") || "null");
      } catch(e) { console.error('[Alokpoth]', e); }

      const displayName = currentName || (userObj && userObj.name) || (token ? "ব্যবহারকারী" : (currentLanguage === 'en' ? "Guest" : "অতিথি"));
      const displayEmail = (userObj && userObj.email) || (token ? "লগইন করা আছে" : (currentLanguage === 'en' ? "Not logged in" : "লগইন করা নেই"));
      const initial = displayName.trim().charAt(0).toUpperCase() || "অ";

      if (nameInput) nameInput.value = currentName || (userObj && userObj.name) || "";
      if (nameDisplay) nameDisplay.textContent = displayName;
      if (emailDisplay) emailDisplay.textContent = displayEmail;
      if (avatarEl) avatarEl.textContent = initial;

      if (passCard) {
        passCard.style.display = token ? "flex" : "none";
      }
    }
    window.refreshAccountSubpageUI = refreshAccountSubpageUI;

    function openAccountModal(targetTab = "") {
      if (typeof targetTab !== "string") targetTab = "";
      if (typeof closeSidebarDrawer === "function") closeSidebarDrawer();
      if (typeof closeBrandMenu === "function") closeBrandMenu();
      const directPages = {
        "tabPlan": "subscription.html", "subscription": "subscription.html", "settingsPlanView": "subscription.html",
        "limits": "usage.html", "settingsLimitsView": "usage.html", "usage": "usage.html",
        "redeem": "redeem.html", "settingsRedeemView": "redeem.html",
        "account": "security.html", "settingsAccountView": "security.html", "security": "security.html",
        "help": "help.html", "profile": "profile.html", "theme": "theme.html",
        "sound": "sound.html", "personalization": "personalization.html"
      };
      if (targetTab && directPages[targetTab]) {
        window.location.href = directPages[targetTab];
      } else {
        window.location.href = targetTab ? `account.html?tab=${encodeURIComponent(targetTab)}` : "account.html";
      }
    }
    window.openAccountModal = openAccountModal;

    function closeAccountModal(isPopstate = false) {
      if (accountModalOverlay) accountModalOverlay.classList.remove("open");
      const isPop = isPopstate === true;
      if (!isPop && history.state && history.state.page && (history.state.page === "account" || history.state.page.startsWith("account_sub_"))) {
        try { history.replaceState({ page: "home" }, ""); } catch(e) { console.error('[Alokpoth]', e); }
      }
      stopQuotaCountdownTimer();
      if (accountCountdownInterval) {
        clearInterval(accountCountdownInterval);
        accountCountdownInterval = null;
      }
      const oldP = document.getElementById("subAccountOldPass");
      const newP = document.getElementById("subAccountNewPass");
      const cnfP = document.getElementById("subAccountConfirmPass");
      const passMsg = document.getElementById("subAccountPassMsg");
      const redIn = document.getElementById("subRedeemInput");
      const redMsg = document.getElementById("subRedeemMsg");
      const feedIn = document.getElementById("subFeedbackInput");
      if (oldP) oldP.value = "";
      if (newP) newP.value = "";
      if (cnfP) cnfP.value = "";
      if (passMsg) { passMsg.textContent = ""; passMsg.style.color = ""; }
      if (redIn) redIn.value = "";
      if (redMsg) { redMsg.textContent = ""; redMsg.style.color = ""; }
      if (feedIn) feedIn.value = "";
    }

    if (accountMenuBtn) accountMenuBtn.addEventListener("click", openAccountModal);
    const brandMenuLimitsBtn = document.getElementById("brandMenuLimitsBtn");
    if (brandMenuLimitsBtn) {
      brandMenuLimitsBtn.addEventListener("click", () => {
        closeBrandMenu();
        openAccountModal("limits");
      });
    }
    if (accountModalClose) accountModalClose.addEventListener("click", () => closeAccountModal(false));
    if (accountModalOverlay) {
      accountModalOverlay.addEventListener("click", (e) => {
        if (e.target === accountModalOverlay) closeAccountModal(false);
      });
    }

    const accountLimitsToggleBtn = document.getElementById("accountLimitsToggleBtn");
    const accountAllPlansGrid = document.getElementById("accountAllPlansGrid");
    const accountLimitsToggleText = document.getElementById("accountLimitsToggleText");

    if (accountLimitsToggleBtn && accountAllPlansGrid) {
      accountLimitsToggleBtn.addEventListener("click", (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const isHidden = accountAllPlansGrid.style.display === "none" || !accountAllPlansGrid.style.display;
        accountAllPlansGrid.style.display = isHidden ? "grid" : "none";
        accountLimitsToggleBtn.classList.toggle("open", isHidden);
        accountLimitsToggleBtn.setAttribute("aria-expanded", isHidden ? "true" : "false");
        if (accountLimitsToggleText) {
          const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
          accountLimitsToggleText.textContent = isHidden ? (isEn ? "Collapse" : "সংক্ষেপ করুন") : (isEn ? "Show All Plans" : "সব প্ল্যান দেখুন");
        }
      });
    }

    if (typeof syncPlanLimitsFromServer === "function") {
      syncPlanLimitsFromServer();
    }

    window.redeemPromoCode = async function(code) {
      if (!code || !code.trim()) return;
      const rawCode = code.trim().toUpperCase();
      const token = localStorage.getItem("alokpoth_token");
      if (!token) {
        showToast("রিডিম কোড ব্যবহারের জন্য অনুগ্রহ করে প্রথমে লগইন করুন!", "error");
        openAuthModal("login");
        return;
      }
      showToast("কোড যাচাই হচ্ছে...", "info");
      try {
        const res = await fetch(`${API_BASE}/redeem/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ code: rawCode })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const newPlan = data.plan_name || (data.subscription && data.subscription.plan_name) || "Pro";
          const expiresAt = data.expires_at || (data.subscription && data.subscription.expires_at);
          if (data.token) try { localStorage.setItem("alokpoth_token", data.token); } catch(e) { console.error('[Alokpoth]', e); }
          currentPlan = newPlan;
          saveCurrentPlan(newPlan);
          if (expiresAt) try { localStorage.setItem(PLAN_EXPIRY_KEY, expiresAt); } catch(e) { console.error('[Alokpoth]', e); }
          renderCreditBalance();
          if (typeof syncUserProfileFromServer === "function") syncUserProfileFromServer();
          if (typeof updateAuthUIState === "function") updateAuthUIState();
          showToast(data.message || `অভিনন্দন! আপনার '${newPlan}' প্ল্যান সক্রিয় হয়েছে।`, "success");
          if (typeof triggerConfetti === "function") triggerConfetti();
        } else {
          showToast(data.error || "রিডিম করতে ব্যর্থ হয়েছে! কোডটি পুনরায় পরীক্ষা করুন।", "error");
        }
      } catch (e) {
        showToast("সার্ভারের সাথে যোগাযোগ করা যায়নি।", "error");
      }
    };

    // --- Settings Subpage Event Handlers ---
    const subAccountSaveBtn = document.getElementById("subAccountSaveBtn");
    if (subAccountSaveBtn) {
      subAccountSaveBtn.addEventListener("click", async () => {
        const input = document.getElementById("subAccountNameInput");
        if (!input) return;
        const cleanName = input.value.trim();
        if (!cleanName) {
          showToast(currentLanguage === 'en' ? "Please enter a valid name" : "দয়া করে একটি নাম লিখুন", "error");
          return;
        }

        const token = localStorage.getItem("alokpoth_token");
        if (token) {
          subAccountSaveBtn.disabled = true;
          try {
            const res = await fetch(`${API_BASE}/auth/me`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({ name: cleanName })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success && data.user) {
              try { localStorage.setItem("alokpoth_user", JSON.stringify(data.user)); } catch(e) { console.error('[Alokpoth]', e); }
              try { localStorage.setItem("alokpoth_account_name", data.user.name || cleanName); } catch(e) { console.error('[Alokpoth]', e); }
              applyAccountName(data.user.name || cleanName);
              refreshAccountSubpageUI();
              showToast(currentLanguage === 'en' ? "Name updated successfully!" : "নাম সফলভাবে সংরক্ষণ করা হয়েছে!", "success");
            } else {
              showToast(data.error || (currentLanguage === 'en' ? "Failed to update profile." : "প্রোফাইল আপডেট ব্যর্থ হয়েছে।"), "error");
            }
          } catch (e) {
            showToast(currentLanguage === 'en' ? "Network error updating name." : "নাম আপডেটে নেটওয়ার্ক সমস্যা হয়েছে।", "error");
          } finally {
            subAccountSaveBtn.disabled = false;
          }
        } else {
          try { localStorage.setItem("alokpoth_account_name", cleanName); } catch(e) { console.error('[Alokpoth]', e); }
          applyAccountName(cleanName);
          refreshAccountSubpageUI();
          showToast(currentLanguage === 'en' ? "Name updated successfully!" : "নাম সফলভাবে সংরক্ষণ করা হয়েছে!", "success");
        }
      });
    }

    const subAccountNameInput = document.getElementById("subAccountNameInput");
    if (subAccountNameInput) {
      subAccountNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (subAccountSaveBtn) subAccountSaveBtn.click();
        }
      });
    }

    const subAccountPassSubmitBtn = document.getElementById("subAccountPassSubmitBtn");
    if (subAccountPassSubmitBtn) {
      subAccountPassSubmitBtn.addEventListener("click", async () => {
        const token = localStorage.getItem("alokpoth_token");
        if (!token) {
          showToast(currentLanguage === 'en' ? "Please log in first" : "দয়া করে প্রথমে লগইন করুন", "error");
          return;
        }
        const oldPassEl = document.getElementById("subAccountOldPass");
        const newPassEl = document.getElementById("subAccountNewPass");
        const cnfPassEl = document.getElementById("subAccountConfirmPass");
        const oldPass = (oldPassEl?.value || "").trim();
        const newPass = (newPassEl?.value || "").trim();
        const cnfPass = (cnfPassEl?.value || "").trim();
        const msgEl = document.getElementById("subAccountPassMsg");

        if (!oldPass || !newPass || !cnfPass) {
          if (msgEl) { msgEl.textContent = currentLanguage === 'en' ? "Please fill all fields" : "সবগুলো ফিল্ড পূরণ করুন"; msgEl.style.color = "#ef4444"; }
          return;
        }
        if (newPass.length < 6) {
          if (msgEl) { msgEl.textContent = currentLanguage === 'en' ? "New password must be at least 6 characters" : "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে"; msgEl.style.color = "#ef4444"; }
          return;
        }
        if (newPass.length > 72) {
          if (msgEl) { msgEl.textContent = currentLanguage === 'en' ? "Password cannot exceed 72 characters" : "পাসওয়ার্ড সর্বোচ্চ ৭২ অক্ষরের হতে পারে"; msgEl.style.color = "#ef4444"; }
          return;
        }
        if (newPass !== cnfPass) {
          if (msgEl) { msgEl.textContent = currentLanguage === 'en' ? "Confirmation password does not match" : "নিশ্চিতকরণ পাসওয়ার্ড মেলেনি"; msgEl.style.color = "#ef4444"; }
          return;
        }

        const btnSpan = subAccountPassSubmitBtn.querySelector("span") || subAccountPassSubmitBtn;
        subAccountPassSubmitBtn.disabled = true;
        btnSpan.textContent = currentLanguage === 'en' ? "Updating..." : "আপডেট হচ্ছে...";
        try {
          const res = await fetch(`${API_BASE}/auth/change-password`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ current_password: oldPass, new_password: newPass, confirm_password: cnfPass })
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success) {
            if (msgEl) { msgEl.textContent = data.message || (currentLanguage === 'en' ? "Password updated successfully!" : "পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!"); msgEl.style.color = "#10b981"; }
            showToast(data.message || (currentLanguage === 'en' ? "Password updated successfully!" : "পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!"), "success");
            if (oldPassEl) oldPassEl.value = "";
            if (newPassEl) newPassEl.value = "";
            if (cnfPassEl) cnfPassEl.value = "";
          } else {
            const err = data.error || (currentLanguage === 'en' ? "Failed to update password." : "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে");
            if (msgEl) { msgEl.textContent = err; msgEl.style.color = "#ef4444"; }
            showToast(err, "error");
          }
        } catch (e) {
          if (msgEl) { msgEl.textContent = currentLanguage === 'en' ? "Server connection error" : "সার্ভার এরর"; msgEl.style.color = "#ef4444"; }
        } finally {
          subAccountPassSubmitBtn.disabled = false;
          const finalSpan = subAccountPassSubmitBtn.querySelector("span") || subAccountPassSubmitBtn;
          finalSpan.setAttribute("data-i18n", "savePassBtn");
          finalSpan.textContent = (I18N[currentLanguage] || I18N.bn).savePassBtn || (currentLanguage === 'en' ? "Update Password" : "পাসওয়ার্ড আপডেট করুন");
        }
      });
    }

    ["subAccountOldPass", "subAccountNewPass", "subAccountConfirmPass"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (subAccountPassSubmitBtn && !subAccountPassSubmitBtn.disabled) subAccountPassSubmitBtn.click();
          }
        });
      }
    });

    const subRedeemSubmitBtn = document.getElementById("subRedeemSubmitBtn");
    if (subRedeemSubmitBtn) {
      subRedeemSubmitBtn.addEventListener("click", async () => {
        const input = document.getElementById("subRedeemInput");
        const msgEl = document.getElementById("subRedeemMsg");
        if (!input) return;
        const rawCode = input.value.trim().toUpperCase();
        if (!rawCode) {
          if (msgEl) { msgEl.textContent = "অনুগ্রহ করে একটি কোড লিখুন"; msgEl.style.color = "#ef4444"; }
          return;
        }
        const token = localStorage.getItem("alokpoth_token");
        if (!token) {
          showToast("রিডিম কোড ব্যবহারের জন্য অনুগ্রহ করে প্রথমে লগইন করুন!", "error");
          openAuthModal("login");
          return;
        }

        const btnSpan = subRedeemSubmitBtn.querySelector("span") || subRedeemSubmitBtn;
        subRedeemSubmitBtn.disabled = true;
        btnSpan.textContent = currentLanguage === 'en' ? "Verifying..." : "যাচাই হচ্ছে...";
        try {
          const res = await fetch(`${API_BASE}/redeem/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ code: rawCode })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            const newPlan = data.plan_name || (data.subscription && data.subscription.plan_name) || "Pro";
            const expiresAt = data.expires_at || (data.subscription && data.subscription.expires_at);
            if (data.token) try { localStorage.setItem("alokpoth_token", data.token); } catch(e) { console.error('[Alokpoth]', e); }
            currentPlan = newPlan;
            saveCurrentPlan(newPlan);
            if (expiresAt) try { localStorage.setItem(PLAN_EXPIRY_KEY, expiresAt); } catch(e) { console.error('[Alokpoth]', e); }
            renderCreditBalance();
            if (typeof syncUserProfileFromServer === "function") syncUserProfileFromServer();
            if (typeof updateAuthUIState === "function") updateAuthUIState();
            if (msgEl) { msgEl.textContent = data.message || `অভিনন্দন! আপনার '${newPlan}' প্ল্যান সক্রিয় হয়েছে।`; msgEl.style.color = "#10b981"; }
            showToast(data.message || `অভিনন্দন! আপনার '${newPlan}' প্ল্যান সক্রিয় হয়েছে।`, "success");
            if (typeof triggerConfetti === "function") triggerConfetti();
            input.value = "";
          } else {
            const errMsg = data.error || "রিডিম করতে ব্যর্থ হয়েছে! কোডটি পুনরায় পরীক্ষা করুন।";
            if (msgEl) { msgEl.textContent = errMsg; msgEl.style.color = "#ef4444"; }
            showToast(errMsg, "error");
          }
        } catch (e) {
          if (msgEl) { msgEl.textContent = "সার্ভারের সাথে যোগাযোগ করা যায়নি।"; msgEl.style.color = "#ef4444"; }
        } finally {
          subRedeemSubmitBtn.disabled = false;
          const finalSpan = subRedeemSubmitBtn.querySelector("span") || subRedeemSubmitBtn;
          finalSpan.setAttribute("data-i18n", "redeemBtn");
          finalSpan.textContent = (I18N[currentLanguage] || I18N.bn).redeemBtn || (currentLanguage === 'en' ? "Claim Code" : "কোড রিডিম করুন");
        }
      });
    }

    const subRedeemInput = document.getElementById("subRedeemInput");
    if (subRedeemInput) {
      subRedeemInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (subRedeemSubmitBtn && !subRedeemSubmitBtn.disabled) subRedeemSubmitBtn.click();
        }
      });
    }

    const subFeedbackSubmitBtn = document.getElementById("subFeedbackSubmitBtn");
    if (subFeedbackSubmitBtn) {
      subFeedbackSubmitBtn.addEventListener("click", () => {
        const input = document.getElementById("subFeedbackInput");
        if (!input || !input.value.trim()) {
          showToast(currentLanguage === 'en' ? "Please write your feedback first" : "দয়া করে আপনার মতামত লিখুন", "info");
          return;
        }
        input.value = "";
        showToast(currentLanguage === 'en' ? "Thank you for your valuable feedback!" : "আপনার মূল্যবান মতামতের জন্য ধন্যবাদ!", "success");
      });
    }

    function performAccountLogout(force = false) {
      const doLogout = () => {
        purgeLocalUserData();
        try { sessionStorage.clear(); } catch(e) { console.error('[Alokpoth]', e); }

        const subName = document.getElementById("subAccountNameInput");
        const subOldP = document.getElementById("subAccountOldPass");
        const subNewP = document.getElementById("subAccountNewPass");
        const subCnfP = document.getElementById("subAccountConfirmPass");
        const subPMsg = document.getElementById("subAccountPassMsg");
        const subRedIn = document.getElementById("subRedeemInput");
        const subRedMsg = document.getElementById("subRedeemMsg");
        if (subName) subName.value = "";
        if (subOldP) subOldP.value = "";
        if (subNewP) subNewP.value = "";
        if (subCnfP) subCnfP.value = "";
        if (subPMsg) { subPMsg.textContent = ""; subPMsg.style.color = ""; }
        if (subRedIn) subRedIn.value = "";
        if (subRedMsg) { subRedMsg.textContent = ""; subRedMsg.style.color = ""; }

        closeAccountModal();
        closeBrandMenu();
        updateAuthUIState();
        refreshAccountSubpageUI();
        if (!force) {
          showToast("সফলভাবে লগআউট হয়েছে!", "info");
        }
        if (window.AloAndroid && typeof window.AloAndroid.logout === "function") {
          try { window.AloAndroid.logout(); return; } catch(e) { console.error('[Alokpoth]', e); }
        }
        if (window.AloAI && typeof window.AloAI.logout === "function") {
          try { window.AloAI.logout(); return; } catch(e) { console.error('[Alokpoth]', e); }
        }
        setTimeout(() => {
          window.location.href = "login.html";
        }, 350);
      };

      if (force) {
        doLogout();
      } else {
        showCustomUI('confirm', "আপনি কি নিশ্চিত যে আপনার অ্যাকাউন্ট থেকে লগআউট করতে চান?", null, (confirmed) => {
          if (confirmed) doLogout();
        });
      }
    }

    function handleSettingsAuthAction() {
      if (localStorage.getItem("alokpoth_token")) {
        performAccountLogout();
      } else {
        openAuthModal("login");
      }
    }
    window.handleSettingsAuthAction = handleSettingsAuthAction;

    const accountLogoutBtn = document.getElementById("accountLogoutBtn");
    if (accountLogoutBtn) {
      accountLogoutBtn.addEventListener("click", performAccountLogout);
    }

    const brandMenuLogoutBtn = document.getElementById("brandMenuLogoutBtn");
    if (brandMenuLogoutBtn) {
      brandMenuLogoutBtn.addEventListener("click", performAccountLogout);
    }

    // --- AUTH MODAL LOGIC & UI STATE ---
    let authMode = "login"; // "login" | "register"
    const authModalOverlay = document.getElementById("authModalOverlay");
    const authModalClose = document.getElementById("authModalClose");
    const authTabLogin = document.getElementById("authTabLogin");
    const authTabRegister = document.getElementById("authTabRegister");
    const authForm = document.getElementById("authForm");
    const authNameField = document.getElementById("authNameField");
    const authNameInput = document.getElementById("authNameInput");
    const authEmailInput = document.getElementById("authEmailInput");
    const authPasswordInput = document.getElementById("authPasswordInput");
    const authErrorMsg = document.getElementById("authErrorMsg");
    const authSubmitBtn = document.getElementById("authSubmitBtn");
    const authModalTitle = document.getElementById("authModalTitle");
    const accountAuthBtn = document.getElementById("accountAuthBtn");
    const brandMenuAuthBtn = document.getElementById("brandMenuAuthBtn");

    function updateAuthUIState() {
      const token = localStorage.getItem("alokpoth_token");
      const currentAuthBtn = document.getElementById("accountAuthBtn");
      const currentLogoutBtn = document.getElementById("accountLogoutBtn");
      const currentBrandAuth = document.getElementById("brandMenuAuthBtn");
      const currentBrandLogout = document.getElementById("brandMenuLogoutBtn");
      const currentNameDisplay = document.getElementById("accountNameDisplay");
      const dName = document.getElementById("drawerUserName");
      const dAv = document.getElementById("drawerAvatar");
      const dPlan = document.getElementById("drawerUserPlan");

      const subLogoutCard = document.getElementById("subLogoutCard");
      if (subLogoutCard) subLogoutCard.style.display = token ? "block" : "none";

      if (token) {
        if (currentAuthBtn) currentAuthBtn.style.display = "none";
        if (currentLogoutBtn) currentLogoutBtn.style.display = "block";
        if (currentBrandAuth) currentBrandAuth.style.display = "none";
        if (currentBrandLogout) currentBrandLogout.style.display = "flex";
        currentPlan = getResolvedUserPlan();
        applyAccountName(getAccountName());
      } else {
        // Not logged in: strictly enforce Free tier and clean up credentials
        currentPlan = "Free";
        saveCurrentPlan("Free");
        try {
          localStorage.removeItem("alokpoth_account_name");
          localStorage.removeItem("alokpoth_user");
          localStorage.removeItem(PLAN_EXPIRY_KEY);
          localStorage.removeItem("alokpoth_plan_expiry");
          localStorage.setItem("alokpoth_current_plan", "Free");
          localStorage.setItem("alokpoth_plan", "Free");
          localStorage.setItem("alokpoth_user_plan", "Free");
        } catch(e) { console.error('[Alokpoth]', e); }

        if (currentAuthBtn) currentAuthBtn.style.display = "block";
        if (currentLogoutBtn) currentLogoutBtn.style.display = "none";
        if (currentBrandAuth) currentBrandAuth.style.display = "flex";
        if (currentBrandLogout) currentBrandLogout.style.display = "none";
        const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
        const notLoggedInText = isEn ? "Not Logged In" : "লগইন করা নেই";
        if (currentNameDisplay) currentNameDisplay.textContent = notLoggedInText;
        if (dName) dName.textContent = notLoggedInText;
        if (dAv) dAv.textContent = "অ";
        if (dPlan) dPlan.textContent = isEn ? "Sign in to unlock all features" : "চ্যাট করতে লগইন করুন";
        applyAccountName("");
        if (typeof renderCreditBalance === "function") {
          renderCreditBalance();
        }
      }

      const setLogoutLbl = document.getElementById("setMenuLogoutLabel");
      const setPlanName = document.getElementById("setMenuPlanName");
      if (setPlanName) {
        setPlanName.textContent = currentPlan || "Free";
      }
      if (setLogoutLbl) {
        if (token) {
          setLogoutLbl.textContent = currentLanguage === 'en' ? "Log Out" : "লগ আউট";
        } else {
          setLogoutLbl.textContent = currentLanguage === 'en' ? "Log In" : "লগইন";
        }
      }

      if (typeof updateNavbarCreditBadge === "function") {
        updateNavbarCreditBadge();
      }
    }

    function setAuthMode(mode) {
      authMode = mode;
      if (authErrorMsg) {
        authErrorMsg.style.display = "none";
        authErrorMsg.textContent = "";
      }
      if (mode === "login") {
        if (authTabLogin) authTabLogin.classList.add("active");
        if (authTabRegister) authTabRegister.classList.remove("active");
        if (authNameField) authNameField.style.display = "none";
        if (authSubmitBtn) authSubmitBtn.textContent = "লগইন করুন";
        if (authModalTitle) authModalTitle.textContent = "লগইন করুন";
      } else {
        if (authTabRegister) authTabRegister.classList.add("active");
        if (authTabLogin) authTabLogin.classList.remove("active");
        if (authNameField) authNameField.style.display = "flex";
        if (authSubmitBtn) authSubmitBtn.textContent = "রেজিস্টার করুন";
        if (authModalTitle) authModalTitle.textContent = "নতুন অ্যাকাউন্ট তৈরি";
      }
    }

    function openAuthModal(mode = "login") {
      const url = mode === "register" ? "login.html?mode=register" : "login.html";
      window.location.href = url;
    }

    function closeAuthModal() {
      if (authModalOverlay) authModalOverlay.classList.remove("open");
      if (authErrorMsg) authErrorMsg.style.display = "none";
      if (authPasswordInput) authPasswordInput.value = "";
      if (authEmailInput) authEmailInput.value = "";
      if (authNameInput) authNameInput.value = "";
    }

    if (authModalClose) authModalClose.addEventListener("click", closeAuthModal);
    if (authModalOverlay) {
      authModalOverlay.addEventListener("click", (e) => {
        if (e.target === authModalOverlay) closeAuthModal();
      });
    }

    if (authTabLogin) authTabLogin.addEventListener("click", () => setAuthMode("login"));
    if (authTabRegister) authTabRegister.addEventListener("click", () => setAuthMode("register"));

    if (accountAuthBtn) {
      accountAuthBtn.addEventListener("click", () => {
        closeAccountModal();
        openAuthModal("login");
      });
    }

    if (brandMenuAuthBtn) {
      brandMenuAuthBtn.addEventListener("click", () => {
        closeBrandMenu();
        openAuthModal("login");
      });
    }

    if (authForm) {
      authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = (authEmailInput?.value || "").trim();
        const password = authPasswordInput?.value || "";
        const name = (authNameInput?.value || "").trim();

        if (!email || !password) {
          if (authErrorMsg) {
            authErrorMsg.textContent = "ইমেইল এবং পাসওয়ার্ড প্রদান করুন।";
            authErrorMsg.style.display = "block";
          }
          return;
        }

        if (authMode === "register" && !name) {
          if (authErrorMsg) {
            authErrorMsg.textContent = "আপনার নাম প্রদান করুন।";
            authErrorMsg.style.display = "block";
          }
          return;
        }

        if (authSubmitBtn) {
          authSubmitBtn.disabled = true;
          authSubmitBtn.textContent = "অপেক্ষা করুন...";
        }
        if (authErrorMsg) authErrorMsg.style.display = "none";

        try {
          const endpoint = authMode === "login" ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
          const payload = authMode === "login" ? { email, password } : { name, email, password };

          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          let data;
          try {
            data = await res.json();
          } catch (e) {
            throw new Error(`সার্ভার থেকে সঠিক রেসপন্স পাওয়া যায়নি (Status ${res.status})।`);
          }
          if (!res.ok || !data.success) {
            throw new Error(data.error || "অথেন্টিকেশন ব্যর্থ হয়েছে!");
          }

          if (authMode === "register") {
            purgeLocalUserData();
          }
          localStorage.setItem("alokpoth_token", data.token);
          if (data.user) {
            localStorage.setItem("alokpoth_user", JSON.stringify(data.user));
            const nameToSave = (data.user.name && data.user.name.trim()) || (data.user.email ? data.user.email.split('@')[0].trim() : "ব্যবহারকারী");
            try { localStorage.setItem("alokpoth_account_name", nameToSave); } catch(e) { console.error('[Alokpoth]', e); }
            applyAccountName(nameToSave);
            if (accountNameInput) accountNameInput.value = nameToSave;
            if (data.user.subscription && data.user.subscription.plan_name) {
              currentPlan = data.user.subscription.plan_name;
              saveCurrentPlan(currentPlan);
              if (data.user.subscription.expires_at) {
                localStorage.setItem(PLAN_EXPIRY_KEY, data.user.subscription.expires_at);
              }
              renderCreditBalance();
            }
          }

          if (window.AloAndroid && typeof window.AloAndroid.saveAuth === "function") {
            try {
              window.AloAndroid.saveAuth(data.token, data.user?.name || '', data.user?.email || '', currentPlan || 'Free');
            } catch(e) { console.error('[Alokpoth]', e); }
          }
          if (window.AloAI && typeof window.AloAI.saveAuth === "function") {
            try {
              window.AloAI.saveAuth(data.token, data.user?.name || '', data.user?.email || '', currentPlan || 'Free');
            } catch(e) { console.error('[Alokpoth]', e); }
          }

          updateAuthUIState();
          closeAuthModal();
          showToast(authMode === "login" ? "সফলভাবে লগইন হয়েছে!" : "অ্যাকাউন্ট সফলভাবে তৈরি ও লগইন হয়েছে!", "success");
          syncUserProfileFromServer();
        } catch (err) {
          if (authErrorMsg) {
            authErrorMsg.textContent = err.message;
            authErrorMsg.style.display = "block";
          }
        } finally {
          if (authSubmitBtn) {
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = authMode === "login" ? "লগইন করুন" : "রেজিস্টার করুন";
          }
        }
      });
    }

    updateAuthUIState();

    /* ========================================================
       App Download & PWA Controller (Website Only)
       ======================================================== */
    function isRunningInApp() {
      const inApp = (typeof window.AloAndroid !== "undefined" && (window.AloAndroid.isNativeApp ? window.AloAndroid.isNativeApp() : true)) ||
        (typeof window.AloIOS !== "undefined") ||
        (typeof window.AloAI !== "undefined" && (window.AloAI.isNativeApp ? window.AloAI.isNativeApp() : true)) ||
        (navigator.userAgent && (navigator.userAgent.includes("AloAI-Android") || navigator.userAgent.includes("AloAI-iOS"))) ||
        (window.isAndroidApp === true) || (window.isIOSApp === true) || (window.isNativeApp === true);
      window.isNativeApp = inApp;
      return inApp;
    }

    const drawerDownloadAppWrap = document.getElementById("drawerDownloadAppWrap");
    const drawerDownloadAppBtn = document.getElementById("drawerDownloadAppBtn");
    const brandMenuDownloadAppBtn = document.getElementById("brandMenuDownloadAppBtn");
    const heroAppDownloadBanner = document.getElementById("heroAppDownloadBanner");
    const appDownloadModalOverlay = document.getElementById("appDownloadModalOverlay");
    const appDownloadModalClose = document.getElementById("appDownloadModalClose");

    function openAppDownloadModal() {
      if (typeof closeSidebarDrawer === "function") closeSidebarDrawer();
      if (typeof closeBrandMenu === "function") closeBrandMenu();
      if (appDownloadModalOverlay) {
        appDownloadModalOverlay.style.display = "flex";
        requestAnimationFrame(() => appDownloadModalOverlay.classList.add("open"));
        pushPageState("download");
      }
    }

    function closeAppDownloadModal(isPopstate = false) {
      if (appDownloadModalOverlay) {
        appDownloadModalOverlay.classList.remove("open");
        if (!isPopstate && history.state && history.state.page === "download") {
          try { history.replaceState({ page: "home" }, ""); } catch(e) { console.error('[Alokpoth]', e); }
        }
        setTimeout(() => {
          if (!appDownloadModalOverlay.classList.contains("open")) {
            appDownloadModalOverlay.style.display = "none";
          }
        }, 250);
      }
    }

    function initAppDownloadSystem() {
      const inApp = isRunningInApp();
      if (inApp) {
        // Running inside installed Android App - strictly hide all download prompts
        if (drawerDownloadAppWrap) drawerDownloadAppWrap.style.display = "none";
        if (brandMenuDownloadAppBtn) brandMenuDownloadAppBtn.style.display = "none";
        if (heroAppDownloadBanner) heroAppDownloadBanner.style.display = "none";
        if (appDownloadModalOverlay) appDownloadModalOverlay.style.display = "none";
        return;
      }

      // On website: show app download options
      if (drawerDownloadAppWrap) drawerDownloadAppWrap.style.display = "block";
      if (brandMenuDownloadAppBtn) brandMenuDownloadAppBtn.style.display = "flex";
      if (heroAppDownloadBanner) heroAppDownloadBanner.style.display = "inline-flex";

      if (heroAppDownloadBanner) {
        heroAppDownloadBanner.addEventListener("click", (e) => {
          e.preventDefault();
          openAppDownloadModal();
        });
      }

      if (drawerDownloadAppBtn) {
        drawerDownloadAppBtn.addEventListener("click", () => {
          closeSidebarDrawer();
          openAppDownloadModal();
        });
      }

      if (brandMenuDownloadAppBtn) {
        brandMenuDownloadAppBtn.addEventListener("click", () => {
          closeBrandMenu();
          openAppDownloadModal();
        });
      }

      if (appDownloadModalClose) {
        appDownloadModalClose.addEventListener("click", closeAppDownloadModal);
      }

      if (appDownloadModalOverlay) {
        appDownloadModalOverlay.addEventListener("click", (e) => {
          if (e.target === appDownloadModalOverlay) closeAppDownloadModal();
        });
      }
    }

    initAppDownloadSystem();

    // Register Service Worker for offline app loading
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").then((reg) => {
          console.log("[PWA Service Worker] Registered:", reg.scope);
        }).catch((err) => {
          console.warn("[PWA Service Worker] Registration failed:", err);
        });
      });
    }

    if (accountResetBtn) {
      accountResetBtn.addEventListener("click", () => {
        showCustomUI('confirm', "আপনি কি নিশ্চিত? এতে চ্যাট হিস্ট্রি ও ব্যবহারের সব হিসাব মুছে যাবে।", null, (confirmed) => {
          if (!confirmed) return;
          
          usageTotals = { inputTokens: 0, outputTokens: 0, images: 0, costUSD: 0 };
          messageCount = 0;
          try {
            localStorage.setItem("alokpoth_message_count", "0");
            localStorage.removeItem("alokpoth_chat_sessions");
            localStorage.removeItem("alokpoth_current_session_id");
            localStorage.removeItem("alokpoth_daily_usage");
          } catch(e) { console.error('[Alokpoth]', e); }
          
          renderUsage();
          messagesHistory = [{ role: "system", content: messagesHistory[0]?.content || SYSTEM_PROMPT }];
          chatStream.innerHTML = "";
          closeAccountModal();
          location.reload();
        });
      });
    }

    const initialToken = localStorage.getItem("alokpoth_token");
    if (initialToken) {
      applyAccountName(getAccountName());
    } else {
      applyAccountName("");
    }

    function showToast(message, type = "success") {
      const container = document.getElementById("toastContainer");
      if (!container) return;
      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      const icon = type === "success"
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`
        : (type === "info"
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`);
      toast.innerHTML = `${icon}<span>${message}</span>`;
      container.appendChild(toast);
      setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 250);
      }, 2200);
    }

    const AVAILABLE_THEMES = ["dark", "sapphire", "oled", "eyecare", "light"];
    const THEME_NAMES = {
      dark: "ডার্ক থিম",
      sapphire: "স্যাফায়ার থিম",
      oled: "সেভিং / ওলেড থিম",
      eyecare: "আই কেয়ার থিম",
      light: "লাইট থিম"
    };
    const THEME_META_COLORS = {
      dark: "#09090b",
      sapphire: "#070d19",
      oled: "#000000",
      eyecare: "#f5eedc",
      light: "#f9fafb"
    };

    function updateThemeLabel(theme) {
      if (!theme) theme = document.documentElement.getAttribute("data-theme") || "dark";
      const btn = document.getElementById("themeToggleBtn");
      if (!btn) return;
      const label = btn.querySelector(".theme-label-text");
      if (label) {
        label.textContent = THEME_NAMES[theme] || "ডার্ক থিম";
      }
    }

    function setTheme(theme, notify = false) {
      if (!AVAILABLE_THEMES.includes(theme)) theme = "dark";
      
      if (theme === "dark") {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", theme);
      }
      
      try {
        localStorage.setItem("alokpoth_theme", theme);
        localStorage.setItem("alokpoth-theme", theme);
      } catch(e) { console.error('[Alokpoth]', e); }

      updateThemeLabel(theme);

      let metaTag = document.querySelector('meta[name="theme-color"]');
      if (!metaTag) {
        metaTag = document.createElement("meta");
        metaTag.name = "theme-color";
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute("content", THEME_META_COLORS[theme] || "#09090b");

      if (notify && typeof showToast === "function") {
        showToast(`${THEME_NAMES[theme]} সক্রিয় করা হয়েছে`, "info");
      }

    }

    function cycleTheme(notify = true) {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const currentIndex = AVAILABLE_THEMES.indexOf(current);
      const nextIndex = (currentIndex + 1) % AVAILABLE_THEMES.length;
      const nextTheme = AVAILABLE_THEMES[nextIndex];
      setTheme(nextTheme, notify);
    }
    window.cycleTheme = cycleTheme;
    window.setTheme = setTheme;

    const themeToggleBtn = document.getElementById("themeToggleBtn");
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", () => cycleTheme(true));
    }

    // Initial theme & language sync
    const initialTheme = document.documentElement.getAttribute("data-theme") || localStorage.getItem("alokpoth_theme") || localStorage.getItem("alokpoth-theme") || "dark";
    setTheme(initialTheme, false);
    if (typeof applyI18n === "function") applyI18n();
    if (typeof refreshLanguageSubpageUI === "function") refreshLanguageSubpageUI();
    if (typeof refreshThemeSubpageUI === "function") refreshThemeSubpageUI();

    function updateOnlineStatus() {
      if (!navigator.onLine) {
        offlineBanner.classList.add("show");
        sendBtn.disabled = true;
      } else {
        offlineBanner.classList.remove("show");
        updateSendAvailability();
      }
    }
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    updateOnlineStatus();

    function estimateTokens(text) {
      if (!text) return 0;
      if (typeof text !== "string") {
        if (Array.isArray(text)) {
          return text.reduce((acc, item) => {
            if (typeof item === "string") return acc + Math.ceil(item.length / 4);
            if (item && item.text) return acc + Math.ceil(String(item.text).length / 4);
            return acc + 65;
          }, 0);
        }
        try {
          return Math.ceil(JSON.stringify(text).length / 4);
        } catch {
          return 0;
        }
      }
      return Math.ceil(text.length / 4);
    }

    const MODEL_PRICING = {
      "gemini-3.6-flash": { in: 0.075, out: 0.30 },
      "gemini-3.5-flash-lite": { in: 0.075, out: 0.30 },
      "llama-3.3-70b-versatile": { in: 0.59, out: 0.79 },
      "alo-pro": { in: 0.59, out: 0.79 },
      "qwen/qwen3.8-27b": { in: 0.20, out: 0.60 },
      "openrouter/free": { in: 0.05, out: 0.20 },
      "openai/gpt-oss-120b": { in: 0.15, out: 0.60 },
      "claude-sonnet-4-6": { in: 3.00, out: 15.00 },
      "nemotron-ultra-550b": { in: 1.00, out: 2.00 },
      "gpt-5.6": { in: 0.20, out: 1.20 },
      "mimo-v2.5": { in: 0.10, out: 0.30 },
      "hy3": { in: 0.15, out: 0.50 }
    };

    const CODE_GEN_MULTIPLIER = 1.35;

    function countCodeBlocks(text) {
      if (!text) return 0;
      const matches = text.match(/```/g);
      return matches ? Math.floor(matches.length / 2) : 0;
    }

    const DAILY_USAGE_KEY = "alokpoth_daily_usage";

    function todayKeyBD() {
      const now = new Date();
      const dhaka = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
      return `${dhaka.getFullYear()}-${String(dhaka.getMonth() + 1).padStart(2, "0")}-${String(dhaka.getDate()).padStart(2, "0")}`;
    }

    function loadDailyUsage() {
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem(DAILY_USAGE_KEY) || "null"); } catch(e) { console.error('[Alokpoth]', e); }
      const key = todayKeyBD();
      if (!stored || stored.date !== key) {
        stored = { date: key, costUSD: 0, inputTokens: 0, outputTokens: 0, images: 0, codeGens: 0 };
      }
      return stored;
    }

    function saveDailyUsage(daily) {
      try { localStorage.setItem(DAILY_USAGE_KEY, JSON.stringify(daily)); } catch(e) { console.error('[Alokpoth]', e); }
    }

    let dailyUsage = loadDailyUsage();

    function addToDailyUsage({ inputTokens = 0, outputTokens = 0, costUSD = 0, images = 0, isCodeGen = false }) {
      const key = todayKeyBD();
      if (dailyUsage.date !== key) {
        dailyUsage = { date: key, costUSD: 0, inputTokens: 0, outputTokens: 0, images: 0, codeGens: 0 };
      }
      dailyUsage.inputTokens += inputTokens;
      dailyUsage.outputTokens += outputTokens;
      dailyUsage.costUSD += costUSD;
      dailyUsage.images += images;
      if (isCodeGen) dailyUsage.codeGens += 1;
      saveDailyUsage(dailyUsage);
      renderDailyUsage();
    }

    function renderDailyUsage() {
      const el = document.getElementById("accountStatDailyCost");
      if (!el) return;
      const key = todayKeyBD();
      if (dailyUsage.date !== key) dailyUsage = loadDailyUsage();
      const costText = dailyUsage.costUSD < 0.01 && dailyUsage.costUSD > 0
        ? `$${dailyUsage.costUSD.toFixed(5)}`
        : `$${dailyUsage.costUSD.toFixed(4)}`;
      el.textContent = costText;
    }

    function addUsage(modelId, inputTokens, outputTokens, options = {}) {
      const isCodeGen = !!options.isCodeGen;
      const rate = MODEL_PRICING[modelId] || { in: 0.50, out: 1.50 };
      const billedOutputTokens = isCodeGen ? Math.ceil(outputTokens * CODE_GEN_MULTIPLIER) : outputTokens;
      const callCost = (inputTokens / 1_000_000) * rate.in + (billedOutputTokens / 1_000_000) * rate.out;

      usageTotals.inputTokens += inputTokens;
      usageTotals.outputTokens += billedOutputTokens;
      usageTotals.costUSD += callCost;
      renderUsage();

      addToDailyUsage({ inputTokens, outputTokens: billedOutputTokens, costUSD: callCost, isCodeGen });
    }

    function addImageUsage(modelId) {
      const rate = MODEL_PRICING[modelId] || {};
      const flat = typeof rate.imageFlat === "number" ? rate.imageFlat : 1.00;
      usageTotals.images += 1;
      usageTotals.costUSD += flat;
      renderUsage();

      addToDailyUsage({ costUSD: flat, images: 1 });
    }

    function renderUsage() {
      const totalTokens = usageTotals.inputTokens + usageTotals.outputTokens;
      renderAccountStats();
    }

    function updateTokenCounter() {
      renderUsage();
    }
    renderUsage();
    renderCreditBalance();
    fetchModelsFromServer();
    syncUserProfileFromServer();
    syncPlanLimitsFromServer();
    startQuotaCountdownTimer();

    window.addEventListener("focus", () => {
      fetchModelsFromServer();
      syncUserProfileFromServer();
      syncPlanLimitsFromServer();
      updateQuotaCountdownDisplay();
    });

    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";
    }

    async function extractPdfText(file) {
      if (!window.pdfjsLib) {
        return "[পিডিএফ প্রসেসিং লাইব্রেরি লোড করা যায়নি]";
      }
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let fullText = "";
      const maxPages = Math.min(pdf.numPages, 40);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((it) => it.str).join(" ") + "\n\n";
      }
      return fullText.trim() || "[এই পিডিএফ ফাইলে কোনো পড়ার মতো টেক্সট পাওয়া যায়নি]";
    }

    async function extractPlainText(file) {
      const raw = await file.text();
      return raw.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, "");
    }

    function renderFilePreviews() {
      filePreviewRow.innerHTML = "";
      pendingFiles.forEach((f, idx) => {
        const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
        const chip = document.createElement("div");
        chip.className = "file-preview-chip";
        chip.innerHTML = `
          <svg viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
          <span class="file-preview-chip-name">${escapeHtml(f.name)}${f.loading ? (isEn ? " (Reading...)" : " (পড়া হচ্ছে...)") : ""}</span>
          <button type="button" class="file-preview-remove" data-idx="${idx}">×</button>
        `;
        filePreviewRow.appendChild(chip);
      });
      filePreviewRow.querySelectorAll(".file-preview-remove").forEach((btn) => {
        btn.addEventListener("click", () => {
          pendingFiles.splice(Number(btn.dataset.idx), 1);
          renderFilePreviews();
          updateSendAvailability();
          updateTokenCounter();
        });
      });
    }

    async function handleDocFiles(files) {
      if (!files || !files.length) return;
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB
      for (const file of files) {
        if (file.size > MAX_DOC_SIZE) {
          showToast(isEn ? `"${file.name}" is too large (${(file.size / (1024*1024)).toFixed(1)}MB). Max 10MB allowed.` : `"${file.name}" অতিরিক্ত বড় (${(file.size / (1024*1024)).toFixed(1)}MB)। সর্বোচ্চ 10MB অনুমোদিত।`, "error");
          continue;
        }
        const entry = { name: file.name, text: "", loading: true };
        pendingFiles.push(entry);
        renderFilePreviews();
        try {
          let text = "";
          if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            text = await extractPdfText(file);
          } else { text = await extractPlainText(file); }
          entry.text = text.slice(0, 15000);
          entry.loading = false;
        } catch (err) {
          entry.text = ""; entry.loading = false; entry.error = true;
        }
        renderFilePreviews();
        updateTokenCounter();
        updateSendAvailability();
      }
      if (docInput) docInput.value = "";
    }

    docInput.addEventListener("change", async () => {
      await handleDocFiles(Array.from(docInput.files || []));
    });

    const attachMenuWrap = document.getElementById("attachMenuWrap");
    const attachMenu = document.getElementById("attachMenu");
    const attachImageOption = document.getElementById("attachImageOption");
    const attachFileOption = document.getElementById("attachFileOption");
    const attachWebSearchOption = document.getElementById("attachWebSearchOption");
    const attachImageGenOption = document.getElementById("attachImageGenOption");
    const webSearchText = document.getElementById("webSearchText");
    const imageGenText = document.getElementById("imageGenText");

    function updateAttachBtnActiveState() {
      if (isWebSearchEnabled || isImageGenEnabled) {
        attachBtn.classList.add("active-tool");
      } else {
        attachBtn.classList.remove("active-tool");
      }
    }

    function updateAttachImageQuotaBadge() {
      const badge = document.getElementById("imageGenQuotaBadge");
      if (!badge) return;
      try {
        const u = getTrustedUser();
        const adminEmails = ["zihanfakir@gmail.com", "x@zihan.uk"];
        if (u && (u.role === "admin" || (u.email && adminEmails.includes(u.email.toLowerCase().trim())))) {
          badge.textContent = "∞";
          return;
        }
      } catch(e) { console.error('[Alokpoth]', e); }
      const { limit } = getImagePlanLimit();
      const usage = getImageWindowUsage();
      const remaining = Math.max(0, limit - (usage.count || 0));
      badge.textContent = `${remaining}/${limit}`;
    }

    function closeAttachMenu() { attachMenu.classList.remove("open"); }
    
    attachBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      updateAttachImageQuotaBadge();
      attachMenu.classList.toggle("open");
    });
    attachImageOption.addEventListener("click", () => { closeAttachMenu(); imageInput.click(); });
    attachFileOption.addEventListener("click", () => { closeAttachMenu(); docInput.click(); });

    attachWebSearchOption.addEventListener("click", () => {
      isWebSearchEnabled = !isWebSearchEnabled;
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      if (isWebSearchEnabled) {
        isImageGenEnabled = false; 
        imageGenText.textContent = isEn ? "Image Gen: Off" : "ছবি তৈরি: বন্ধ"; 
        attachImageGenOption.style.color = "var(--text-main)"; 
        attachImageGenOption.querySelector("span").style.color = "var(--text-sub)"; 
        attachImageGenOption.querySelector('svg').style.stroke = "var(--text-sub)";
      }
      webSearchText.textContent = isWebSearchEnabled ? (isEn ? "Web Search: On" : "ওয়েব সার্চ: চালু") : (isEn ? "Web Search: Off" : "ওয়েব সার্চ: বন্ধ");
      attachWebSearchOption.style.color = isWebSearchEnabled ? "var(--accent-color)" : "var(--text-main)";
      webSearchText.style.color = isWebSearchEnabled ? "var(--accent-color)" : "var(--text-sub)";
      attachWebSearchOption.querySelector('svg').style.stroke = isWebSearchEnabled ? "var(--accent-color)" : "var(--text-sub)";
      updateAttachBtnActiveState(); closeAttachMenu();
    });

    attachImageGenOption.addEventListener("click", () => {
      isImageGenEnabled = !isImageGenEnabled;
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      if (isImageGenEnabled) {
        isWebSearchEnabled = false; 
        webSearchText.textContent = isEn ? "Web Search: Off" : "ওয়েব সার্চ: বন্ধ"; 
        attachWebSearchOption.style.color = "var(--text-main)"; 
        attachWebSearchOption.querySelector("span").style.color = "var(--text-sub)"; 
        attachWebSearchOption.querySelector('svg').style.stroke = "var(--text-sub)";
      }
      imageGenText.textContent = isImageGenEnabled ? (isEn ? "Image Gen: On" : "ছবি তৈরি: চালু") : (isEn ? "Image Gen: Off" : "ছবি তৈরি: বন্ধ");
      attachImageGenOption.style.color = isImageGenEnabled ? "var(--accent-color)" : "var(--text-main)";
      imageGenText.style.color = isImageGenEnabled ? "var(--accent-color)" : "var(--text-sub)";
      attachImageGenOption.querySelector('svg').style.stroke = isImageGenEnabled ? "var(--accent-color)" : "var(--text-sub)";
      updateAttachBtnActiveState(); closeAttachMenu();
    });

    document.addEventListener("click", (e) => { if (!attachMenuWrap.contains(e.target)) closeAttachMenu(); });

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function compressImage(file, maxSizeMB = 3.5) {
      return new Promise((resolve) => {
        const maxSize = maxSizeMB * 1024 * 1024;
        if (file.size <= maxSize) return resolve(file);

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target.result;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let { width, height } = img;
            
            const MAX_DIM = 2048;
            if (width > MAX_DIM || height > MAX_DIM) {
              const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
              width = Math.floor(width * ratio);
              height = Math.floor(height * ratio);
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            let quality = 0.9;
            let dataUrl = canvas.toDataURL("image/jpeg", quality);
            
            // Fast loop to reduce quality if still over limit
            while (Math.round((dataUrl.length * 3) / 4) > maxSize && quality > 0.4) {
              quality -= 0.1;
              dataUrl = canvas.toDataURL("image/jpeg", quality);
            }

            fetch(dataUrl)
              .then(res => res.blob())
              .then(blob => resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" })))
              .catch(() => resolve(file));
          };
          img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
      });
    }

    function renderImagePreviews() {
      imagePreviewRow.innerHTML = "";
      pendingImages.forEach((img, idx) => {
        const item = document.createElement("div");
        item.className = "image-preview-item";
        item.innerHTML = `<img src="${img.previewUrl}" alt="attached image">
                          <button type="button" class="image-preview-remove">×</button>`;
        item.querySelector(".image-preview-remove").addEventListener("click", () => {
          if (img.previewUrl && img.previewUrl.startsWith("blob:")) {
            try { URL.revokeObjectURL(img.previewUrl); } catch(e) { console.error('[Alokpoth]', e); }
          }
          pendingImages.splice(idx, 1);
          renderImagePreviews();
          updateSendAvailability();
        });
        imagePreviewRow.appendChild(item);
      });
    }

    async function handleImageFiles(files) {
      if (!files || !files.length) return;
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      for (const originalFile of files) {
        if (!originalFile.type.startsWith("image/")) continue;
        const file = await compressImage(originalFile);
        
        const MAX_IMG_SIZE = 3.5 * 1024 * 1024;
        if (file.size > MAX_IMG_SIZE) {
          showToast(isEn ? `Image is too large (${(file.size / (1024*1024)).toFixed(1)}MB). Max 3.5MB allowed.` : `ছবিটি অনেক বড় (${(file.size / (1024*1024)).toFixed(1)}MB)। সর্বোচ্চ 3.5MB অনুমোদিত।`, "error");
          continue;
        }
        const base64 = await fileToBase64(file);
        pendingImages.push({ base64, mimeType: file.type, previewUrl: URL.createObjectURL(file) });
      }
      renderImagePreviews();
      if (imageInput) imageInput.value = "";
      updateSendAvailability();
    }

    imageInput.addEventListener("change", async () => {
      await handleImageFiles(Array.from(imageInput.files || []));
    });

    document.addEventListener("paste", async (e) => {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
          const originalFile = item.getAsFile();
          if (originalFile) {
            const file = await compressImage(originalFile);
            const MAX_IMG_SIZE = 3.5 * 1024 * 1024;
            if (file.size > MAX_IMG_SIZE) {
              showToast(`পেস্ট করা ছবিটি অনেক বড় (${(file.size / (1024*1024)).toFixed(1)}MB)। সর্বোচ্চ 3.5MB অনুমোদিত।`, "error");
              continue;
            }
            const base64 = await fileToBase64(file);
            pendingImages.push({ base64, mimeType: file.type, previewUrl: URL.createObjectURL(file) });
            renderImagePreviews();
            updateSendAvailability();
            showToast("ক্লিপবোর্ড থেকে ছবি যুক্ত হয়েছে", "success");
          }
        }
      }
    });

    function cleanUserMessageContent(rawContent) {
      if (!rawContent || typeof rawContent !== "string") return "";
      let t = rawContent;
      t = t.replace(/\n\n\[(?:অনুস্মারক|System Note):[\s\S]*?\](?=\n|$)/gi, "");
      t = t.replace(/\n\n\[(?:সংযুক্ত ফাইলের বিষয়বস্তু|Attached File Context)\][\s\S]*?(?=\n\n\[|$)/gi, "");
      t = t.replace(/\n\n\[(?:Web Search Results Live Data|Web Search Results|Web Search|ওয়েব অনুসন্ধান)[^\]]*\][\s\S]*?(?=\n\n\[|$)/gi, "");
      t = t.replace(/\n\n\[(?:অনুস্মারক|System Note):[\s\S]*$/gi, "");
      t = t.replace(/\n\n\[(?:সংযুক্ত ফাইলের বিষয়বস্তু|Attached File Context)\][\s\S]*$/gi, "");
      t = t.replace(/\n\n\[(?:Web Search Results Live Data|Web Search Results|Web Search|ওয়েব অনুসন্ধান)[\s\S]*$/gi, "");
      return t.trim();
    }

    function sanitizeChatTitleText(text) {
      if (!text || typeof text !== "string") return "";
      let t = text;
      t = t.replace(/\[(?:System Note|Attached File Context|অনুস্মারক|সংযুক্ত ফাইলের বিষয়বস্তু|সংযুক্ত ফাইলের|সংযুক্ত|ফাইল|ছবি তৈরি|ছবি|ওয়েব অনুসন্ধান|Web Search Results Live Data|Web Search Results|Web Search)[\s\S]*?(?:\]|$)/gi, "");
      t = t.replace(/=== LANGUAGE RULE[\s\S]*?(?:===|$)/gi, "");
      t = t.replace(/^You are [^,\n]+[,\.]/gi, "");
      t = t.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "");
      t = t.replace(/---[^\n]+---/g, "");
      t = t.replace(/\s+/g, " ").trim();
      return t;
    }

    function loadAllSessions() {
      try {
        const raw = localStorage.getItem(CHAT_SESSIONS_KEY);
        if (!raw) return [];
        const sessions = JSON.parse(raw);
        if (Array.isArray(sessions)) {
          let hasRepaired = false;
          sessions.forEach((s) => {
            if (s && s.title) {
              const hasTag = s.title.includes("[") || s.title.includes("System Note") || s.title.includes("Attached File") || s.title.includes("অনুস্মারক") || s.title.includes("সংযুক্ত") || s.title.includes("---") || s.title.includes("LANGUAGE RULE") || s.title.includes("You are ") || s.title.includes("Please respond") || s.title.includes("সম্পূর্ণ উত্তর");
              if (hasTag) {
                s.title = makeSessionTitle(s.messagesHistory || []);
                hasRepaired = true;
              }
            }
          });
          if (hasRepaired) {
            try { localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions)); } catch(e) { console.error('[Alokpoth]', e); }
          }
        }
        return Array.isArray(sessions) ? sessions : [];
      } catch { return []; }
    }

    function saveAllSessions(sessions) {
      try {
        const sanitized = sessions.map((s) => ({
          ...s,
          messagesHistory: (s.messagesHistory || []).map((m) => {
            if (m.images && Array.isArray(m.images)) {
              return {
                ...m,
                images: m.images.map((img) => ({
                  mimeType: img.mimeType,
                  base64: (img.base64 && img.base64.length > 5000) ? "" : img.base64
                }))
              };
            }
            return m;
          })
        }));
        localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sanitized));
      } catch (err) {
        console.warn("LocalStorage quota warning, pruning oldest sessions:", err);
        try {
          const pruned = (sessions || []).slice(0, 15).map(s => ({
            ...s,
            messagesHistory: (s.messagesHistory || []).slice(-30).map(m => {
              const copy = { ...m };
              if (copy.images) {
                copy.images = copy.images.map(img => ({ mimeType: img.mimeType, base64: "" }));
              }
              return copy;
            })
          }));
          localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(pruned));
        } catch (e2) {
          console.error("Critical localStorage quota failure:", e2);
        }
      }
    }

    function makeSessionTitle(history) {
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      const defaultTitle = isEn ? "New Chat" : "নতুন চ্যাট";
      if (!history || !Array.isArray(history)) return defaultTitle;
      const firstUserMsg = history.find((m) => m.role === "user");
      if (!firstUserMsg) return defaultTitle;
      let text = typeof firstUserMsg.content === "string" ? cleanUserMessageContent(firstUserMsg.content) : "";
      text = sanitizeChatTitleText(text);
      if (!text && firstUserMsg.files && firstUserMsg.files.length) {
        text = firstUserMsg.files[0].name || (isEn ? "Attached File" : "সংযুক্ত ফাইল");
      } else if (!text && firstUserMsg.images && firstUserMsg.images.length) {
        text = isEn ? "Attached Image" : "সংযুক্ত ছবি";
      }
      return text ? (text.length > 40 ? text.slice(0, 40) + "…" : text) : defaultTitle;
    }

    function persistCurrentSession() {
      const hasUserMsg = messagesHistory.some((m) => m.role === "user");
      if (!hasUserMsg) return;

      const sessions = loadAllSessions();
      const title = makeSessionTitle(messagesHistory);
      const now = Date.now();

      if (currentSessionId) {
        const idx = sessions.findIndex((s) => s.id === currentSessionId);
        if (idx !== -1) {
          sessions[idx] = { ...sessions[idx], title, messagesHistory, updatedAt: now };
        } else {
          sessions.unshift({ id: currentSessionId, title, messagesHistory, updatedAt: now });
        }
      } else {
        currentSessionId = `chat_${now}_${Math.random().toString(36).slice(2, 8)}`;
        sessions.unshift({ id: currentSessionId, title, messagesHistory, updatedAt: now });
        try { localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId); } catch(e) { console.error('[Alokpoth]', e); }
      }
      saveAllSessions(sessions);
    }

    function getEmptyStateHtml() {
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      const d = (typeof I18N !== "undefined" && I18N[currentLanguage]) ? I18N[currentLanguage] : (typeof I18N !== "undefined" ? I18N.bn : {});
      const greeting = d.welcomeGreeting || (isEn ? "How can I help you today?" : "আমি আপনাকে কীভাবে সাহায্য করতে পারি?");
      const isAndroid = (typeof isRunningInApp === "function" ? isRunningInApp() : (typeof window.isAndroidApp !== "undefined" && window.isAndroidApp));
      
      const bannerHtml = isAndroid ? '' : `
        <div class="hero-app-banner sheen-surface" id="heroAppDownloadBanner" title="অ্যান্ড্রয়েড অ্যাপ ডাউনলোড করুন" style="margin: 4px 0 0;">
          <span style="display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: #3b82f6; color: #fff; flex-shrink: 0;">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </span>
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">${d.heroDownloadBannerText || 'অ্যান্ড্রয়েড অ্যাপ ব্যবহার করুন — '}<strong style="color: #60a5fa; text-decoration: underline;">${d.heroDownloadBannerBtn || 'APK ডাউনলোড করুন'}</strong></span>
        </div>
      `;

      return `
        <div class="empty-state" id="emptyState">
          <svg class="empty-state-logo" viewBox="0 0 100 100" width="64" height="64" fill="none">
            <defs>
              <linearGradient id="heroLogoGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#60a5fa"/>
                <stop offset="40%" stop-color="#3b82f6"/>
                <stop offset="100%" stop-color="#2563eb"/>
              </linearGradient>
              <linearGradient id="heroLogoGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#3b82f6"/>
                <stop offset="50%" stop-color="#4f46e5"/>
                <stop offset="100%" stop-color="#6366f1"/>
              </linearGradient>
              <linearGradient id="heroLogoGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#818cf8"/>
                <stop offset="50%" stop-color="#a855f7"/>
                <stop offset="100%" stop-color="#c084fc"/>
              </linearGradient>
              <filter id="heroBladeShadow" x="-15%" y="-15%" width="130%" height="130%">
                <feDropShadow dx="-1" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.35"/>
              </filter>
            </defs>
            <g>
              <path d="M 50.0 50.0 L 45.3 24.3 C 45.3 19.5 42.5 14.5 39.0 13.8 C 48.0 11.5 62.0 11.8 71.5 14.8 C 77.5 17.0 81.0 22.0 81.0 28.5 C 81.0 38.0 72.0 46.5 61.0 49.5 C 56.0 51.0 52.0 50.5 50.0 50.0 Z" fill="url(#heroLogoGrad1)" filter="url(#heroBladeShadow)"/>
              <path d="M 50.0 50.0 L 45.3 24.3 C 45.3 19.5 42.5 14.5 39.0 13.8 C 48.0 11.5 62.0 11.8 71.5 14.8 C 77.5 17.0 81.0 22.0 81.0 28.5 C 81.0 38.0 72.0 46.5 61.0 49.5 C 56.0 51.0 52.0 50.5 50.0 50.0 Z" fill="url(#heroLogoGrad2)" transform="rotate(120 50 50)" filter="url(#heroBladeShadow)"/>
              <path d="M 50.0 50.0 L 45.3 24.3 C 45.3 19.5 42.5 14.5 39.0 13.8 C 48.0 11.5 62.0 11.8 71.5 14.8 C 77.5 17.0 81.0 22.0 81.0 28.5 C 81.0 38.0 72.0 46.5 61.0 49.5 C 56.0 51.0 52.0 50.5 50.0 50.0 Z" fill="url(#heroLogoGrad3)" transform="rotate(240 50 50)" filter="url(#heroBladeShadow)"/>
            </g>
          </svg>
          <div id="heroGreetingText">${greeting}</div>
          ${bannerHtml}
        </div>
      `;
    }

    function startNewChat() {
      currentSessionId = null;
      try { localStorage.removeItem(CURRENT_SESSION_KEY); } catch(e) { console.error('[Alokpoth]', e); }
      const curMod = (typeof MODELS !== "undefined" && Array.isArray(MODELS)) ? MODELS.find(m => m.id === selectedModelId) : null;
      const modName = curMod ? curMod.name : "Alokpoth";
      messagesHistory = [{ role: "system", content: buildSystemPrompt(modName, true, true) }];
      clearComposerState();
      if (typeof updateSendAvailability === "function") updateSendAvailability();
      chatStream.innerHTML = getEmptyStateHtml();
      emptyState = document.getElementById("emptyState");
      closeBrandMenu();
    }

    function renderChatHistoryList() {
      const listEl = document.getElementById("chatHistoryList");
      const sessions = loadAllSessions().sort((a, b) => b.updatedAt - a.updatedAt);

      if (!sessions.length) {
        listEl.innerHTML = `<div class="chat-history-empty">এখনো কোনো সেভ করা চ্যাট নেই</div>`;
        return;
      }

      listEl.innerHTML = "";
      sessions.forEach((session) => {
        const item = document.createElement("div");
        item.className = "chat-history-item";
        const dateStr = new Date(session.updatedAt).toLocaleString("bn-BD", {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
        });
        item.innerHTML = `
          <div class="chat-history-item-main">
            <div class="chat-history-item-title"></div>
            <div class="chat-history-item-meta">${dateStr}</div>
          </div>
          <button type="button" class="chat-history-delete-btn" aria-label="মুছুন" aria-label="Delete">
            <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        `;
        item.querySelector(".chat-history-item-title").textContent = session.title;

        item.querySelector(".chat-history-item-main").addEventListener("click", () => loadSession(session.id));

        item.querySelector(".chat-history-delete-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          const confirmMsg = currentLanguage === "bn" 
            ? "আপনি কি নিশ্চিতভাবে এই চ্যাটটি মুছে ফেলতে চান?" 
            : "Are you sure you want to delete this chat session?";
          showCustomUI("confirm", confirmMsg, null, (confirmed) => {
            if (!confirmed) return;
            const remaining = loadAllSessions().filter((s) => s.id !== session.id);
            saveAllSessions(remaining);
            if (currentSessionId === session.id) currentSessionId = null;
            renderChatHistoryList();
            showToast(currentLanguage === "bn" ? "চ্যাট সফলভাবে মুছে ফেলা হয়েছে" : "Chat deleted successfully", "info");
          });
        });

        listEl.appendChild(item);
      });
    }

    async function handleRegenerateFromBtn(regenBtn) {
      if (isGenerating) return;
      if (!requireAuth()) return;
      const targetRow = regenBtn.closest(".message-row");
      if (!targetRow) return;

      const wasImage = !!targetRow.querySelector(".generated-image-wrap");
      const isEnNow = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      if (wasImage) {
        if (!hasImageCredit()) {
          showToast(isEnNow ? "Image quota reached. Please upgrade your plan." : "ছবি তৈরির সীমা শেষ হয়েছে। প্ল্যান আপগ্রেড করুন।", "warning");
          openAccountModal();
          return;
        }
        isImageGenEnabled = true;
      } else {
        if (!hasCredit()) {
          showToast(isEnNow ? "Message quota reached. Please wait or upgrade." : "বার্তা সীমা শেষ হয়েছে। অনুগ্রহ করে আপগ্রেড করুন।", "warning");
          openAccountModal();
          return;
        }
        deductCredit(1);
        updateNavbarCreditBadge();
      }

      // Count how many user message rows appear before this assistant row
      const allRows = Array.from(chatStream.children);
      const targetIndex = allRows.indexOf(targetRow);
      
      let userCount = 0;
      for (let i = 0; i <= (targetIndex !== -1 ? targetIndex : allRows.length - 1); i++) {
        if (allRows[i] && allRows[i].classList && allRows[i].classList.contains("user")) {
          userCount++;
        }
      }

      // Truncate messagesHistory so that the corresponding user message is the last element
      if (userCount > 0) {
        let seenUsers = 0;
        let cutIndex = -1;
        for (let i = 0; i < messagesHistory.length; i++) {
          if (messagesHistory[i].role === "user") {
            seenUsers++;
            if (seenUsers === userCount) {
              cutIndex = i;
              break;
            }
          }
        }
        if (cutIndex !== -1) {
          messagesHistory = messagesHistory.slice(0, cutIndex + 1);
        }
      } else {
        // Fallback: pop last assistant message if any exists
        while (messagesHistory.length > 0 && messagesHistory[messagesHistory.length - 1].role === "assistant") {
          messagesHistory.pop();
        }
      }

      // Remove the targetRow and all subsequent rows from DOM
      let node = targetRow;
      while (node) {
        const next = node.nextSibling;
        node.remove();
        node = next;
      }

      isGenerating = true;
      updateSendAvailability();
      try {
        await generateAIReply();
      } catch (err) {
        if (!wasImage) refundCredit();
      } finally {
        isGenerating = false;
        updateSendAvailability();
        scrollToBottom();
      }
    }

    function loadSession(sessionId) {
      persistCurrentSession();
      const sessions = loadAllSessions();
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      currentSessionId = session.id;
      try { localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId); } catch(e) { console.error('[Alokpoth]', e); }
      messagesHistory = session.messagesHistory;

      chatStream.innerHTML = "";
      messagesHistory.forEach((m) => {
        if (m.role === "user") {
          let userText = typeof m.content === "string" ? cleanUserMessageContent(m.content) : "";
          createUserBubble(userText, m.images || [], m.files || []);
        } else if (m.role === "assistant") {
          const { textDiv, copyBtn, regenBtn, ttsBtn, shareBtn, likeBtn, dislikeBtn, moreBtn } = createAIBubble();
          textDiv.classList.remove("streaming", "no-children");
          const rawText = typeof m.content === "string" ? m.content : "";
          
          // Detect saved generated image markers and restore as image bubble
          const imgMatch = rawText.match(/\[(?:ছবি তৈরি করা হয়েছে|Generated image|Image generated)\s*[:：]?\s*(https?:\/\/[^\]\s]+)\]/i);
          if (imgMatch && imgMatch[1]) {
            const savedImageUrl = imgMatch[1];
            const savedPrompt = rawText.replace(/\[(?:ছবি তৈরি করা হয়েছে|Generated image|Image generated)\s*[:：]?\s*https?:\/\/[^\]\s]+\]/i, "").trim();
            renderGeneratedImageBubble(textDiv, savedImageUrl, savedPrompt || "ছবি");
            if (copyBtn) copyBtn.style.display = "none";
            if (regenBtn) regenBtn.style.display = "inline-flex";
            if (ttsBtn) ttsBtn.style.display = "none";
            if (likeBtn) likeBtn.style.display = "inline-flex";
            if (dislikeBtn) dislikeBtn.style.display = "inline-flex";
            if (shareBtn) shareBtn.style.display = "inline-flex";
            if (moreBtn) moreBtn.style.display = "inline-flex";
          } else {
          let html = "";
          let finalReasoning = "";
          let finalContent = rawText;
          
          // Basic extract inline <think> tags if present
          const regex = /<think>([\s\S]*?)(?:<\/think>|$)/gi;
          let match;
          let thoughts = [];
          while ((match = regex.exec(rawText)) !== null) {
            thoughts.push(match[1]);
          }
          if (thoughts.length > 0) {
            finalReasoning = thoughts.join("\n\n");
            finalContent = rawText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "");
          }

          if (finalReasoning) {
             const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
             const thinkTitle = isEn ? "Thinking completed" : "চিন্তাভাবনা সমাপ্ত";
             html += `<details class="thought-block">
               <summary>
                 <span class="thought-bulb-icon">💡</span>
                 <span>${thinkTitle}</span>
                 <svg class="thought-chevron" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6"/></svg>
               </summary>
               <div class="thought-content">${safeMarkdown(finalReasoning)}</div>
             </details>`;
          }
          if (finalContent) {
             html += `<div class="content-block">${safeMarkdown(finalContent)}</div>`;
          } else if (!finalContent && finalReasoning) {
             html += `<div class="content-block" style="color: var(--error-color); font-weight: 500;">
               সার্ভারের সময়সীমা (৬০ সেকেন্ড) শেষ হওয়ার কারণে মডেলটি উত্তর তৈরি করতে ব্যর্থ হয়েছে।
             </div>`;
          }

          try {
            textDiv.innerHTML = html || safeMarkdown(rawText);
            enhanceCodeBlocks(textDiv);
          } catch {
            textDiv.textContent = finalContent || finalReasoning;
          }
          if (copyBtn) {
            copyBtn.dataset.text = finalContent || rawText;
            copyBtn.style.display = "inline-flex";
          }
          if (ttsBtn) ttsBtn.style.display = "inline-flex";
          if (likeBtn) likeBtn.style.display = "inline-flex";
          if (dislikeBtn) dislikeBtn.style.display = "inline-flex";
          if (shareBtn) shareBtn.style.display = "inline-flex";
          if (moreBtn) moreBtn.style.display = "inline-flex";
          if (regenBtn) regenBtn.style.display = "inline-flex";
        }
          }
      });
      scrollToBottom();
      closeChatHistoryModal();
      closeBrandMenu();
    }

    const newChatBtn = document.getElementById("newChatBtn");
    const chatHistoryBtn = document.getElementById("chatHistoryBtn");
    const chatHistoryModalClose = document.getElementById("chatHistoryModalClose");

    function openChatHistoryModal() {
      if (typeof closeSidebarDrawer === "function") closeSidebarDrawer();
      if (typeof closeBrandMenu === "function") closeBrandMenu();
      renderChatHistoryList();
      if (chatHistoryModalOverlay) {
        chatHistoryModalOverlay.classList.add("open");
        pushPageState("history");
      }
    }
    function closeChatHistoryModal(isPopstate = false) {
      if (chatHistoryModalOverlay) chatHistoryModalOverlay.classList.remove("open");
      if (!isPopstate && history.state && history.state.page === "history") {
        try { history.replaceState({ page: "home" }, ""); } catch(e) { console.error('[Alokpoth]', e); }
      }
    }

    newChatBtn.addEventListener("click", startNewChat);
    chatHistoryBtn.addEventListener("click", openChatHistoryModal);
    chatHistoryModalClose.addEventListener("click", () => closeChatHistoryModal());
    chatHistoryModalOverlay.addEventListener("click", (e) => {
      if (e.target === chatHistoryModalOverlay) closeChatHistoryModal();
    });

    window.addEventListener("beforeunload", persistCurrentSession);
    
    // Restore previous active session if available, otherwise start fresh
    try {
      const savedSessionId = localStorage.getItem(CURRENT_SESSION_KEY);
      const allSessions = loadAllSessions();
      if (savedSessionId && allSessions.some(s => s.id === savedSessionId && s.messagesHistory && s.messagesHistory.length > 1)) {
        loadSession(savedSessionId);
      } else {
        startNewChat();
      }
    } catch {
      startNewChat();
    }

    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", debounce(() => {
        const distance = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
        userScrolledUp = distance > 100;
      }, 150), { passive: true });
    }
    
    userInput.addEventListener("input", () => {
      userInput.style.height = "auto";
      userInput.style.height = `${Math.min(userInput.scrollHeight, 150)}px`;
      updateSendAvailability();
    });

    userInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!requireAuth()) return;
        if (!sendBtn.disabled && !isGenerating) {
          sendBtn.click();
        }
      }
    });

    userInput.addEventListener("focus", () => {
      if (!localStorage.getItem("alokpoth_token")) {
        userInput.blur();
        requireAuth();
        return;
      }
      setTimeout(scrollToBottom, 100); setTimeout(scrollToBottom, 300);
    });

    const STATUS_ICONS = {
      thinking: `<svg viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
      working: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>`,
      searching: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
      generating: `<svg viewBox="0 0 24 24"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`
    };

    function createAIBubble() {
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      const dCopy = isEn ? "Copy" : "কপি";
      const dTTS = isEn ? "Listen" : "শুনুন";
      const dShare = isEn ? "Share" : "শেয়ার";
      const dRegen = isEn ? "Regenerate" : "আবার লিখুন";
      const dThinking = isEn ? "Thinking..." : "চিন্তা করছি...";

      const row = document.createElement("div");
      row.className = "message-row ai";
      const container = document.createElement("div");
      container.className = "ai-bubble-container";
      
      const contentCol = document.createElement("div");
      contentCol.className = "ai-content-col";
      const textDiv = document.createElement("div");
      textDiv.className = "ai-bubble";
      textDiv.innerHTML = `<span class="status-indicator status-thinking"><span class="status-icon">${STATUS_ICONS ? STATUS_ICONS.thinking : ""}</span><span class="status-label">${dThinking}</span></span>`;
      
      const actionRow = document.createElement("div");
      actionRow.className = "msg-actions";
      
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "action-icon-btn";
      copyBtn.style.display = "none";
      copyBtn.title = isEn ? "Copy response" : "উত্তর কপি করুন";
      const copyIconSvg = `<svg viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
      const checkIconSvg = `<svg viewBox="0 0 24 24" style="color:#10b981;"><polyline points="20 6 9 17 4 12"/></svg>`;
      copyBtn.innerHTML = copyIconSvg;
      copyBtn.addEventListener("click", () => {
        const textToCopy = copyBtn.dataset.text || "";
        copyTextToClipboard(textToCopy).then((ok) => {
          triggerHaptic("light");
          copyBtn.innerHTML = ok ? checkIconSvg : copyIconSvg;
          showToast(ok ? (isEn ? "Copied to clipboard" : "কপি হয়েছে") : (isEn ? "Copy failed" : "কপি ব্যর্থ হয়েছে"), ok ? "success" : "warning");
          setTimeout(() => { copyBtn.innerHTML = copyIconSvg; }, 1500);
        });
      });
      
      const ttsBtn = document.createElement("button");
      ttsBtn.type = "button";
      ttsBtn.className = "action-icon-btn";
      ttsBtn.style.display = "none";
      ttsBtn.title = isEn ? "Listen to response" : "ভয়েস শুনুন";
      ttsBtn.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
      ttsBtn.addEventListener("click", () => {
        const textToRead = copyBtn.dataset.text || textDiv.textContent || "";
        speakBengaliText(textToRead);
        triggerHaptic("light");
      });

      const likeBtn = document.createElement("button");
      likeBtn.type = "button";
      likeBtn.className = "action-icon-btn";
      likeBtn.style.display = "none";
      likeBtn.title = isEn ? "Good response" : "ভালো উত্তর";
      likeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>`;
      likeBtn.addEventListener("click", () => {
        triggerHaptic("light");
        likeBtn.style.color = "#3b82f6";
        dislikeBtn.style.color = "";
        showToast(isEn ? "Thanks for your feedback!" : "মতামতের জন্য ধন্যবাদ!", "success");
      });

      const dislikeBtn = document.createElement("button");
      dislikeBtn.type = "button";
      dislikeBtn.className = "action-icon-btn";
      dislikeBtn.style.display = "none";
      dislikeBtn.title = isEn ? "Bad response" : "খারাপ উত্তর";
      dislikeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>`;
      dislikeBtn.addEventListener("click", () => {
        triggerHaptic("light");
        dislikeBtn.style.color = "#ef4444";
        likeBtn.style.color = "";
        showToast(isEn ? "Thanks for your feedback" : "মতামতের জন্য ধন্যবাদ", "info");
      });

      const shareBtn = document.createElement("button");
      shareBtn.type = "button";
      shareBtn.className = "action-icon-btn";
      shareBtn.style.display = "none";
      shareBtn.title = isEn ? "Share response" : "উত্তর শেয়ার করুন";
      shareBtn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
      shareBtn.addEventListener("click", () => {
        const textToShare = copyBtn.dataset.text || textDiv.textContent || "";
        if (navigator.share) {
          navigator.share({ title: "Alokpoth", text: textToShare }).catch(() => {});
        } else {
          copyTextToClipboard(textToShare).then(() => showToast(isEn ? "Text copied for sharing" : "শেয়ারের জন্য টেক্সট কপি হয়েছে", "success"));
        }
      });

      const moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.className = "action-icon-btn";
      moreBtn.style.display = "none";
      moreBtn.title = isEn ? "More options" : "আরও অপশন";
      moreBtn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/><circle cx="5" cy="12" r="1.5" fill="currentColor"/></svg>`;
      moreBtn.addEventListener("click", () => {
        triggerHaptic("light");
        showToast(isEn ? "Feedback noted" : "মতামত নথিভুক্ত করা হয়েছে", "info");
      });

      const regenBtn = document.createElement("button");
      regenBtn.type = "button";
      regenBtn.className = "action-icon-btn btn-regen";
      regenBtn.style.display = "none";
      regenBtn.title = isEn ? "Regenerate response" : "পুনরায় লিখুন";
      regenBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`;
      regenBtn.addEventListener("click", () => handleRegenerateFromBtn(regenBtn));
      
      actionRow.appendChild(copyBtn);
      actionRow.appendChild(ttsBtn);
      actionRow.appendChild(likeBtn);
      actionRow.appendChild(dislikeBtn);
      actionRow.appendChild(shareBtn);
      actionRow.appendChild(moreBtn);
      actionRow.appendChild(regenBtn);
      contentCol.appendChild(textDiv);
      contentCol.appendChild(actionRow);
      container.appendChild(contentCol);
      row.appendChild(container);
      chatStream.appendChild(row);
      scrollToBottom();
      return { textDiv, copyBtn, regenBtn, ttsBtn, shareBtn, likeBtn, dislikeBtn, moreBtn };
    }

    const CODE_LANG_EXT = {
      javascript: "js", js: "js", python: "py", py: "py", html: "html", css: "css",
      json: "json", sql: "sql", bash: "sh", sh: "sh", shell: "sh", java: "java",
      c: "c", cpp: "cpp", "c++": "cpp", csharp: "cs", cs: "cs", php: "php",
      ruby: "rb", go: "go", rust: "rs", typescript: "ts", ts: "ts", yaml: "yml",
      markdown: "md", xml: "xml", kotlin: "kt", swift: "swift"
    };

    function enhanceCodeBlocks(container) {
      const blocks = container.querySelectorAll("pre");
      blocks.forEach((pre) => {
        if (pre.parentElement.classList.contains("code-block-wrapper")) return;
        const codeEl = pre.querySelector("code");
        const codeText = codeEl ? codeEl.textContent : pre.textContent;
        let lang = "txt";
        if (codeEl) {
          const cls = Array.from(codeEl.classList).find((c) => c.startsWith("language-"));
          if (cls) lang = cls.replace("language-", "").split(/[:?#\s]/)[0] || "txt";
        }
        const ext = CODE_LANG_EXT[lang.toLowerCase()] || "txt";
        
        const wrapper = document.createElement("div");
        wrapper.className = "code-block-wrapper";
        pre.parentNode.insertBefore(wrapper, pre);

        const headerBar = document.createElement("div");
        headerBar.className = "code-header-bar";

        const leftCol = document.createElement("div");
        leftCol.className = "code-header-left";
        leftCol.innerHTML = `
          <div class="code-window-dots">
            <span class="code-dot red"></span>
            <span class="code-dot yellow"></span>
            <span class="code-dot green"></span>
          </div>
          <span class="code-lang-badge">${lang.toUpperCase()}</span>
        `;

        const actionsBar = document.createElement("div");
        actionsBar.className = "code-header-actions";

        // Copy button
        const isEnCode = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "code-header-btn";
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>${isEnCode ? "Copy" : "কপি"}</span>`;
        copyBtn.addEventListener("click", () => {
          const currentCode = (pre.querySelector("code") || pre).textContent;
          copyTextToClipboard(currentCode).then((ok) => {
            triggerHaptic("light");
            const span = copyBtn.querySelector("span");
            const old = span ? span.textContent : (isEnCode ? "Copy" : "কপি");
            if (span) span.textContent = ok ? (isEnCode ? "Copied!" : "কপি হয়েছে!") : (isEnCode ? "Failed!" : "ব্যর্থ!");
            setTimeout(() => { if (span) span.textContent = old; }, 1500);
          });
        });

        // Download button
        const dlBtn = document.createElement("button");
        dlBtn.type = "button";
        dlBtn.className = "code-header-btn";
        dlBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>${isEnCode ? "Download" : "ডাউনলোড"}</span>`;
        dlBtn.addEventListener("click", () => {
          const currentCode = (pre.querySelector("code") || pre).textContent;
          const blob = new Blob([currentCode], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `code.${ext}`;
          document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          showToast(isEnCode ? `code.${ext} downloaded successfully` : `code.${ext} ডাউনলোড হয়েছে`, "success");
        });
        
        actionsBar.appendChild(copyBtn);
        actionsBar.appendChild(dlBtn);
        headerBar.appendChild(leftCol);
        headerBar.appendChild(actionsBar);

        wrapper.appendChild(headerBar);
        wrapper.appendChild(pre);
      });
    }

    function createUserBubble(text, images, files) {
      if (emptyState) emptyState.remove();
      const row = document.createElement("div");
      row.className = "message-row user";
      const col = document.createElement("div");
      col.className = "user-bubble-col";
      
      if (images && images.length) {
        const imgRow = document.createElement("div");
        imgRow.className = "bubble-image-row";
        images.forEach((img) => {
          const im = document.createElement("img");
          im.src = img.previewUrl || (img.base64 ? `data:${img.mimeType || 'image/png'};base64,${img.base64}` : "");
          im.className = "bubble-image-thumb";
          imgRow.appendChild(im);
        });
        col.appendChild(imgRow);
      }
      
      if (files && files.length) {
        const fileRow = document.createElement("div");
        fileRow.className = "bubble-file-row";
        files.forEach((f) => {
          const chip = document.createElement("div");
          chip.className = "file-bubble-chip";
          chip.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg><span class="file-bubble-chip-name">${f.name}</span>`;
          fileRow.appendChild(chip);
        });
        col.appendChild(fileRow);
      }
      
      const bubble = document.createElement("div");
      bubble.className = "user-bubble";
      bubble.textContent = text;
      
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "edit-btn";
      editBtn.setAttribute("aria-label", "এডিট করুন");
      editBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
      
      editBtn.addEventListener("click", () => {
        const isPlaceholder = text === "ছবি সংযুক্ত করা হয়েছে" || text === "ফাইল সংযুক্ত করা হয়েছে";
        userInput.value = isPlaceholder ? "" : text;
        userInput.style.height = "auto";
        userInput.style.height = `${Math.min(userInput.scrollHeight, 150)}px`;
        userInput.focus();
        
        // Restore attachments
        if (images && images.length > 0) {
          pendingImages = [...images];
          if (typeof renderImagePreviews === "function") renderImagePreviews();
        }
        if (files && files.length > 0) {
          pendingFiles = [...files];
          if (typeof renderFilePreviews === "function") renderFilePreviews();
        }
        
        updateSendAvailability();
        
        const allMessageRows = Array.from(chatStream.querySelectorAll(".message-row"));
        const rowIndex = allMessageRows.indexOf(row);
        if (rowIndex !== -1) {
          messagesHistory = messagesHistory.slice(0, rowIndex + 1);
        } else {
          const userMsgIndex = messagesHistory.map((m, idx) => ({ m, idx }))
            .reverse()
            .find(item => item.m.role === "user" && item.m.content && item.m.content.includes(text));
          if (userMsgIndex) {
            messagesHistory = messagesHistory.slice(0, userMsgIndex.idx);
          }
        }
        
        let node = row;
        while (node) {
          const next = node.nextSibling;
          node.remove();
          node = next;
        }
        persistCurrentSession();
      });
      
      col.appendChild(bubble); col.appendChild(editBtn);
      row.appendChild(col); chatStream.appendChild(row);
      scrollToBottom();
    }

    async function searchDuckDuckGo(query) {
      let combined = "";
      try {
        const url = `${API_BASE}/search?q=${encodeURIComponent(query)}`;
        const res = await fetchWithTimeout(url, { method: "GET" }, 8000);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.results) {
            combined += data.results + "\n";
          }
        }
      } catch (err) {
        console.warn("DuckDuckGo search failed:", err);
      }

      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=3`;
        const wikiRes = await fetchWithTimeout(wikiUrl, { method: "GET" }, 6000);
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          const hits = wikiData?.query?.search || [];
          if (hits.length > 0) {
            combined += "\nWikipedia results:\n";
            hits.forEach((h) => {
              const cleanSnippet = (h.snippet || "")
                .replace(/<[^>]*>/g, "")
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .trim();
              if (cleanSnippet) combined += `- ${h.title}: ${cleanSnippet}\n`;
            });
          }
        }
      } catch (err) {
        console.warn("Wikipedia search failed:", err);
      }

      return combined.trim() || null;
    }

    async function streamServerCompletions(modelId, history, onToken) {
      const token = localStorage.getItem("alokpoth_token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const formattedHistory = history.map((m) => {
        if (m.images && m.images.length) {
          const content = [{ type: "text", text: m.content || "" }];
          m.images.forEach((img) => {
            content.push({
              type: "image_url",
              image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
            });
          });
          return { role: m.role, content };
        }
        return { role: m.role, content: m.content };
      });

      currentAbortController = new AbortController();

      // Client-side stream watchdog & timeout (prevent infinite loading)
      let streamWatchdog = null;
      let isTimeoutAbort = false;
      const resetWatchdog = (timeoutMs = 300000) => {
        if (streamWatchdog) clearTimeout(streamWatchdog);
        streamWatchdog = setTimeout(() => {
          isTimeoutAbort = true;
          if (currentAbortController) {
            try { currentAbortController.abort("timeout"); } catch(e) { console.error('[Alokpoth]', e); }
          }
        }, timeoutMs);
      };

      // Set initial 300s timeout to receive HTTP response
      resetWatchdog(300000);

      let response;
      try {
        response = await fetch(`${API_BASE}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({ model: modelId, messages: formattedHistory, stream: true }),
          signal: currentAbortController.signal
        });
      } catch (fetchErr) {
        if (streamWatchdog) clearTimeout(streamWatchdog);
        if (isTimeoutAbort || fetchErr === "timeout") {
          throw new Error("মডেল থেকে নির্দিষ্ট সময়ে কোনো উত্তর পাওয়া যায়নি। মডেলটি সাময়িকভাবে ডাউন বা ধীরগতিতে থাকতে পারে।");
        }
        if (fetchErr.name === "AbortError" || currentAbortController?.signal?.aborted) {
          const abortError = new Error("AbortError");
          abortError.name = "AbortError";
          throw abortError;
        }
        throw fetchErr;
      }

      // Headers received - extend watchdog for initial token (300s)
      resetWatchdog(300000);

      if (!response.ok) {
        if (streamWatchdog) clearTimeout(streamWatchdog);
        let serverError = "";
        try {
          const errJson = await response.json();
          if (errJson && errJson.error) {
            serverError = errJson.error;
          }
        } catch(e) { console.error('[Alokpoth]', e); }

        if (response.status === 401 || response.status === 403) {
          if (serverError.includes("অকার্যকর") || serverError.includes("লগইন") || serverError.includes("অননুমোদিত") || serverError.includes("ব্লক")) {
            performAccountLogout(true);
          }
        }
        if (serverError) {
          throw new Error(serverError);
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("এই মডেল ব্যবহারের জন্য লগইন অথবা প্ল্যান আপগ্রেড প্রয়োজন।");
        }
        if (response.status === 429) {
          throw new Error("মেসেজ পাঠানোর সীমা শেষ হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।");
        }
        throw new Error("সার্ভার থেকে কোনো উত্তর পাওয়া যায়নি।");
      }

      if (!response.body) {
        if (streamWatchdog) clearTimeout(streamWatchdog);
        const data = await response.json();
        const full = data.choices?.[0]?.message?.content || data.content || "";
        onToken(full, full);
        return full;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullText = "";
      let fullReasoning = "";

      try {
        let isDone = false;
        while (true) {
          // If no chunk arrives for 300s mid-stream, abort
          resetWatchdog(300000);
          const { done, value } = await reader.read();
          if (done) break;

          resetWatchdog(300000);
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") {
                isDone = true;
                continue;
              }
              try {
                const json = JSON.parse(payload);
                if (json.error) {
                  const rawErrMsg = typeof json.error === "object" ? (json.error.message || JSON.stringify(json.error)) : json.error;
                  const safeMsg = (typeof rawErrMsg === "string" && !rawErrMsg.includes("API") && !rawErrMsg.includes("http") && !rawErrMsg.includes("{") && !rawErrMsg.includes("/"))
                    ? rawErrMsg
                    : "মডেল থেকে কোনো উত্তর পাওয়া যায়নি।";
                  throw new Error(safeMsg);
                }
                let deltaContent = json.choices?.[0]?.delta?.content 
                  ?? json.choices?.[0]?.delta?.text 
                  ?? json.choices?.[0]?.text 
                  ?? json.text 
                  ?? json.choices?.[0]?.message?.content 
                  ?? "";
                let deltaReasoning = json.choices?.[0]?.delta?.reasoning 
                  ?? json.choices?.[0]?.delta?.reasoning_content 
                  ?? "";
                  
                if (deltaContent || deltaReasoning) {
                  fullText += (deltaContent || "");
                  fullReasoning += (deltaReasoning || "");
                  onToken(deltaContent, deltaReasoning, fullText, fullReasoning);
                }
              } catch (e) {
                if (e.message && !e.message.includes("JSON")) {
                  throw e;
                }
              }
            }
          }

        // Flush any trailing buffer payload after stream finishes
        if (buffer && buffer.trim()) {
          const lines = buffer.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") {
              isDone = true;
              continue;
            }
            try {
              const json = JSON.parse(payload);
              let deltaContent = json.choices?.[0]?.delta?.content 
                ?? json.choices?.[0]?.delta?.text 
                ?? json.choices?.[0]?.text 
                ?? json.text 
                ?? json.choices?.[0]?.message?.content 
                ?? "";
              let deltaReasoning = json.choices?.[0]?.delta?.reasoning 
                ?? json.choices?.[0]?.delta?.reasoning_content 
                ?? "";
              if (deltaContent || deltaReasoning) {
                fullText += (deltaContent || "");
                fullReasoning += (deltaReasoning || "");
                onToken(deltaContent, deltaReasoning, fullText, fullReasoning);
              }
            } catch(e) { console.error('[Alokpoth]', e); }
          }
          buffer = "";
        }

        if (isTimeoutAbort && !isDone && fullText) {
          console.warn("Stream ended due to client/server timeout abort.");
          const isEnNow = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
          const timeoutNote = isEnNow ? "\n\n*(Response incomplete due to timeout)*" : "\n\n*(সার্ভারের সময়সীমা শেষ হওয়ায় উত্তরটি অসম্পূর্ণ রয়ে গেছে)*";
          fullText += timeoutNote;
          onToken(timeoutNote, "", fullText, fullReasoning);
        }
      } catch (readErr) {
        if (isTimeoutAbort) {
          if (!fullText) {
            throw new Error("সার্ভার থেকে নির্দিষ্ট সময়ে কোনো উত্তর পাওয়া যায়নি। পুনরায় চেষ্টা করতে নিচের বোতামে চাপুন।");
          }
        } else if (currentAbortController?.signal?.aborted || readErr.name === "AbortError") {
          const abortError = new Error("AbortError");
          abortError.name = "AbortError";
          throw abortError;
        }
        throw readErr;
      } finally {
        if (streamWatchdog) clearTimeout(streamWatchdog);
      }

      return fullText;
    }

    async function copyTextToClipboard(text) {
      if (!text) return false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (err) {
        console.warn("Clipboard API failed, using fallback...");
      }
      
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 999999);
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        return false;
      }
    }


    function setBubbleStatus(element, kind, label) {
      element.style.whiteSpace = "";
      element.innerHTML = `<span class="status-indicator status-${kind}"><span class="status-icon">${STATUS_ICONS[kind] || STATUS_ICONS.thinking}</span><span class="status-label">${label}</span></span>`;
    }

    function startDynamicStatusSequence(element) {
      element.style.whiteSpace = "";
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      const thinkingLabel = isEn ? "Thinking..." : "চিন্তা করছি...";
      const workingLabel = isEn ? "Please wait..." : "অপেক্ষা করুন...";
      setBubbleStatus(element, "thinking", thinkingLabel);
      
      let step = 0;
      const intervalId = setInterval(() => {
        step++;
        if (step % 2 === 1) {
          setBubbleStatus(element, "working", workingLabel);
        } else {
          setBubbleStatus(element, "thinking", thinkingLabel);
        }
      }, 3500);
      
      return intervalId;
    }

    function setBubbleGeneratingImage(element) {
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      setBubbleStatus(element, "generating", isEn ? "Generating image..." : "ছবি তৈরি হচ্ছে...");
    }

    function detectImageGenRequest(text) {
      if (!text || typeof text !== "string") return false;
      const clean = text.trim();
      if (!clean) return false;

      // 1. Direct slash commands or pollinations prefix
      if (/^\/(image|draw|img|photo|picture|pollinations)\b/i.test(clean)) return true;
      if (/^(pollinations|পোলিনেশন)\s*[:：\-]/i.test(clean)) return true;

      // 2. English image generation triggers (including modify, edit, variation)
      const enPatterns = [
        /\b(modify|edit|change|update|transform|redraw|regenerate|enhance|remix|generate|create|draw|paint|sketch|make|render|show|give|produce)\b[\s\S]*?\b(image|picture|photo|photograph|art|wallpaper|logo|illustration|drawing|painting|avatar|portrait|banner|thumbnail)\b/i,
        /\b(image|picture|photo|art|wallpaper|logo|illustration|drawing)\s+of\b/i,
        /^\s*(draw|paint|sketch|generate|create|render)\s+/i,
        /^\s*(another|next|more)\s+(image|picture|photo|one)\b/i
      ];
      if (enPatterns.some((p) => p.test(clean))) return true;

      // 3. Bengali image generation triggers (comprehensive)
      const bnPatterns = [
        /(ছবি|ইমেজ|ফটো|পিকচার|আর্ট|ওয়ালপেপার|লোগো|আইকন|পোস্টার|চিত্র|পেইন্টিং|অঙ্কন)\s*(তৈরি|বানা|আঁক|জেনারেট|ড্র|বানাও|আঁকো|এঁকে|করো|দিন|দাও|দেখাও|পাঠাও|এডিট|পরিবর্তন|বদল|আরেকটা|অন্য|নতুন)/i,
        /(তৈরি|বানা|আঁক|জেনারেট|ড্র|বানাও|আঁকো|এঁকে|এডিট|পরিবর্তন)\s*(করে|করা)?\s*(দাও|দিন|করো)?\s*[\s\S]*?\b(ছবি|ইমেজ|ফটো|পিকচার|চিত্র|পেইন্টিং)/i,
        /(একটি|একটা|কিছু|আমাকে|আমারে|আমার জন্য)?\s*(ছবি|ইমেজ|ফটো|পিকচার|চিত্র|পেইন্টিং)\s*(আঁকো|বানাও|দাও|দিন|দেখাও|পাঠাও|তৈরি)/i,
        /^(আরেকটা|আরেকটি|অন্য একটা|নতুন একটা|পরেরটা|পরের ছবি|আরেকটা ছবি|আরেকটা ফটো)\s*(দাও|দিন|করো|দেখাও|বানাও)?$/i,
        /(ছবি|ফটো|ইমেজ|পিকচার)\s*(আঁকো|বানাও|দাও|দেখাও|হবে|চাই)/i
      ];
      if (bnPatterns.some((p) => p.test(clean))) return true;

      return false;
    }

    async function generateImageViaServer(prompt) {
      const token = localStorage.getItem("alokpoth_token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetchWithTimeout(`${API_BASE}/chat/image`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt })
      }, 45000);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `ছবি তৈরি করতে সমস্যা হয়েছে (Status ${res.status})`);
      }
      return data.url;
    }

    async function generateImageVyceai(prompt) {
      return await generateImageViaServer(prompt);
    }

    async function generateImageForVyceaiModel(prompt) {
      return await generateImageViaServer(prompt);
    }

    async function downloadGeneratedImage(imageUrl) {
      try {
        let blobUrl = imageUrl;
        if (!imageUrl.startsWith("data:")) {
          const res = await fetch(imageUrl);
          const blob = await res.blob();
          blobUrl = URL.createObjectURL(blob);
        }
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `alokpoth-ai-image-${Date.now()}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        if (blobUrl !== imageUrl) URL.revokeObjectURL(blobUrl);
        showToast("ছবি ডাউনলোড হয়েছে", "success");
      } catch (err) {
        window.open(imageUrl, "_blank");
        showToast("সরাসরি ডাউনলোড ব্যর্থ, নতুন ট্যাবে খোলা হয়েছে", "error");
      }
    }

    function renderGeneratedImageBubble(aiTextElement, imageUrl, prompt) {
      aiTextElement.classList.remove("streaming", "no-children");
      aiTextElement.innerHTML = "";

      const wrap = document.createElement("div");
      wrap.className = "generated-image-wrap";

      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = prompt || "ছবি";
      img.className = "generated-image";
      img.onerror = function() {
        this.style.display = "none";
        const errBox = document.createElement("div");
        errBox.style.cssText = "padding:20px;text-align:center;color:var(--text-sub);font-size:0.9rem;border:1px dashed rgba(255,255,255,0.15);border-radius:12px;background:rgba(255,255,255,0.03);";
        errBox.innerHTML = '<div style="font-size:1.5rem;margin-bottom:8px;">🖼️</div>' +
          '<div>ছবি লোড করা যায়নি</div>' +
          '<button type="button" onclick="this.parentElement.previousElementSibling.style.display=\'block\';this.parentElement.previousElementSibling.src=\'' + imageUrl + '&retry=' + Date.now() + '\';this.parentElement.remove();" ' +
          'style="margin-top:10px;padding:6px 16px;background:var(--accent-primary);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;">আবার চেষ্টা করুন</button>';
        wrap.appendChild(errBox);
      };

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "image-overlay-btn btn-edit";
      editBtn.title = "Edit Image";
      editBtn.setAttribute("aria-label", "Edit Image");
      editBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
      editBtn.addEventListener("click", () => {
        triggerHaptic("light");
        if (userInput) {
          userInput.value = `Modify image: ${prompt || ""}`;
          userInput.focus();
        }
      });

      const dlBtn = document.createElement("button");
      dlBtn.type = "button";
      dlBtn.className = "image-overlay-btn btn-download";
      dlBtn.title = "Download Image";
      dlBtn.setAttribute("aria-label", "Download Image");
      dlBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
      dlBtn.addEventListener("click", () => {
        triggerHaptic("light");
        downloadGeneratedImage(imageUrl);
      });

      wrap.appendChild(img);
      wrap.appendChild(editBtn);
      wrap.appendChild(dlBtn);
      aiTextElement.appendChild(wrap);
    }

    async function generateAIReply() {
      return new Promise(async (resolve) => {
        if (!requireAuth()) {
          resolve();
          return;
        }
        const { textDiv: aiTextElement, copyBtn, regenBtn, ttsBtn, shareBtn, likeBtn, dislikeBtn, moreBtn } = createAIBubble();
        const currentModel = MODELS.find((m) => m.id === selectedModelId);

        const userPlan = (typeof getResolvedUserPlan === "function" ? getResolvedUserPlan() : (currentPlan || "Free"));
        let isUserAdmin = false;
        try {
          const u = getTrustedUser();
          const adminEmails = ["zihanfakir@gmail.com", "x@zihan.uk"];
          if (u && (u.role === "admin" || (u.email && adminEmails.includes(u.email.toLowerCase().trim())))) {
            isUserAdmin = true;
          }
        } catch(e) { console.error('[Alokpoth]', e); }

        const isMaxOnlyModel = Boolean(currentModel && currentModel.efficient) || selectedModelId === 'gpt-5.6';
        const isProOnlyModel = Boolean(currentModel && currentModel.premium) && !isMaxOnlyModel;
        let isModelLocked = false;
        let reqPlanForModel = "";

        if (!isUserAdmin) {
          if (userPlan === "Free") {
            if (isMaxOnlyModel) {
              isModelLocked = true;
              reqPlanForModel = "Max";
            } else if (isProOnlyModel) {
              isModelLocked = true;
              reqPlanForModel = "Pro";
            }
          } else if (userPlan === "Pro") {
            if (isMaxOnlyModel) {
              isModelLocked = true;
              reqPlanForModel = "Max";
            }
          }
        }

        if (isModelLocked) {
          const isEnNow = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
          const planRequiredText = reqPlanForModel === "Max" ? (isEnNow ? "Max Plan" : "Max প্ল্যান") : (isEnNow ? "Pro or Max Plan" : "Pro বা Max প্ল্যান");
          const currentPlanText = userPlan === "Pro" ? (isEnNow ? "Pro Plan" : "প্রো প্ল্যান") : (isEnNow ? "Free Plan" : "ফ্রি প্ল্যান");
          const errorMsg = isEnNow
            ? `'${currentModel?.name || selectedModelId}' requires ${planRequiredText}. Your current plan: ${currentPlanText}.`
            : `'${currentModel?.name || selectedModelId}' মডেলটি ব্যবহারের জন্য ${planRequiredText} প্রয়োজন। আপনার বর্তমান প্ল্যান: ${currentPlanText}।`;
          const detailMsg = isEnNow
            ? "Please select another model or upgrade your plan."
            : "মডেল অপশন থেকে অন্য কোনো মডেল বেছে নিন অথবা প্ল্যান আপগ্রেড করুন।";

          aiTextElement.classList.remove("streaming", "no-children");
          aiTextElement.innerHTML = `
            <div class="ai-error-box" style="display:flex; flex-direction:column; gap:10px; padding:14px 16px; border-radius:12px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25);">
              <div style="display:flex; align-items:flex-start; gap:10px;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
                  <span style="font-weight:600; font-size:0.92rem; color:var(--text-main);">${escapeHtml(errorMsg)}</span>
                  <span style="font-size:0.82rem; color:var(--text-sub); opacity:0.9;">${escapeHtml(detailMsg)}</span>
                </div>
              </div>
              <div style="display:flex; gap:8px; margin-top:4px; flex-wrap:wrap;">
                <button type="button" onclick="openModelPicker()" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; background:var(--surface-color, #1e293b); color:var(--text-main, #fff); border:1px solid var(--border-color, #334155); font-size:0.82rem; font-weight:600; cursor:pointer; touch-action:manipulation;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  ${isEnNow ? "Switch Model" : "মডেল পরিবর্তন করুন"}
                </button>
                <a href="plans.html" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; background:linear-gradient(135deg, #3b82f6, #6366f1); color:#fff; text-decoration:none; font-size:0.82rem; font-weight:600; cursor:pointer; touch-action:manipulation;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  ${isEnNow ? "Upgrade Plan" : "প্ল্যান আপগ্রেড করুন"}
                </a>
              </div>
            </div>
          `;
          refundCredit();
          regenBtn.style.display = "none";
          scrollToBottom();
          resolve();
          return;
        }

        const isGemini = currentModel?.type === "gemini";
        const isGroq = currentModel?.type === "groq";
        const isOpenRouter = currentModel?.type === "openrouter";
        const isBai = currentModel?.type === "bai";
        const isVyceaiModel = !currentModel?.type;

        const lastUserMsg = [...messagesHistory].reverse().find((m) => m.role === "user");

        // Image Generation Logic based on Button or Text
        const wantImage = isImageGenEnabled || (lastUserMsg && detectImageGenRequest(lastUserMsg.content));
        
        if (wantImage && lastUserMsg) {
          // Check image generation limit for current plan
          if (!hasImageCredit()) {
            const isEnNow = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
            const { limit, hours } = getImagePlanLimit();
            const planName = currentPlan || "Free";
            const limitMsg = isEnNow
              ? `Image generation limit reached! Your ${planName} plan allows ${limit} images per ${hours} hour(s). Please wait for the reset or upgrade your plan.`
              : `ছবি তৈরির সীমা শেষ! আপনার ${planName} প্ল্যানে ${hours} ঘণ্টায় ${limit}টি ছবি তৈরি করা যায়। অনুগ্রহ করে অপেক্ষা করুন অথবা আপগ্রেড করুন।`;
            aiTextElement.classList.remove("streaming", "no-children");
            aiTextElement.innerHTML = `<div class="ai-error-box" style="display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);">
              <div style="display:flex;align-items:center;gap:8px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style="font-weight:600;font-size:0.92rem;color:var(--text-main);">${escapeHtml(limitMsg)}</span></div>
              <button type="button" class="btn btn-primary" onclick="openAccountModal()" style="align-self:flex-start;margin-top:4px;">${isEnNow ? "Upgrade Plan" : "প্ল্যান আপগ্রেড করুন"}</button>
            </div>`;
            scrollToBottom(); resolve(); return;
          }

          setBubbleGeneratingImage(aiTextElement);
          
          // Auto turn off toggle
          const isEnNow = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
          isImageGenEnabled = false; 
          updateAttachBtnActiveState();
          imageGenText.textContent = isEnNow ? "Image Gen: Off" : "ছবি তৈরি: বন্ধ"; 
          attachImageGenOption.style.color = "var(--text-main)"; 
          attachImageGenOption.querySelector("span").style.color = "var(--text-sub)"; 
          attachImageGenOption.querySelector('svg').style.stroke = "var(--text-sub)";
          
          try {
            let rawUserText = (lastUserMsg.rawPrompt || lastUserMsg.content || "").replace(/\[অনুস্মারক[\s\S]*?\]/g, "").trim();
            let imgPrompt = rawUserText;
            imgPrompt = imgPrompt.replace(/^\/(image|draw|img|photo|picture|pollinations)\s+/i, "").trim();
            imgPrompt = imgPrompt.replace(/^(pollinations|পোলিনেশন)\s*[:：\-]\s*/i, "").trim();
            imgPrompt = imgPrompt.replace(/^(modify|edit|change|update|transform|redesign|redo)\s+(image|photo|picture|img)\s*[:：\-]?\s*/i, "").trim();
            imgPrompt = imgPrompt.replace(/^(ছবি|ইমেজ|ফটো|পিকচার)\s*(পরিবর্তন|এডিট|পাল্টাও|বদলাও|তৈরি করো|বানাও|আঁকো|দাও|দেখাও)\s*[:：\-]?\s*/i, "").trim();

            // If prompt is just "another one" / "আরেকটা" / "পরেরটা", inherit from previous prompt
            const isFollowUp = /^(আরেকটা|আরেকটি|অন্য একটা|পরেরটা|পরের ছবি|আরেকটা দাও|another one|another|more|next)\s*(দাও|দিন|করো|দেখাও|বানাও|please)?$/i.test(imgPrompt.trim());
            if (isFollowUp) {
              for (let i = messagesHistory.length - 2; i >= 0; i--) {
                const prev = messagesHistory[i];
                if (prev && prev.role === "user" && prev.content && detectImageGenRequest(prev.content)) {
                  const cleanedPrev = prev.content.replace(/^\/(image|draw|img|photo|picture|pollinations)\s+/i, "")
                    .replace(/^(modify|edit|change)\s+(image|photo)\s*[:：\-]?\s*/i, "")
                    .replace(/(একটি|একটা)?\s*(ছবি|ফটো|ইমেজ)\s*(আঁকো|বানাও|দাও|তৈরি করো)?/i, "")
                    .trim();
                  if (cleanedPrev && cleanedPrev.length > 2) {
                    imgPrompt = cleanedPrev;
                    break;
                  }
                }
              }
            }

            if (!imgPrompt) imgPrompt = "একটি সুন্দর এবং আকর্ষণীয় ছবি";
            const imageUrl = await generateImageForVyceaiModel(imgPrompt);
            renderGeneratedImageBubble(aiTextElement, imageUrl, imgPrompt);
            copyBtn.style.display = "none";
            regenBtn.style.display = "inline-flex";
            messagesHistory.push({ role: "assistant", content: `[ছবি তৈরি করা হয়েছে: ${imageUrl}]` });
            addImageUsage(selectedModelId);
            recordImageWindowUsage();
            persistCurrentSession();
            scrollToBottom(); resolve();
          } catch (err) {
            soundEngine.playError();
            triggerHaptic("error");
            aiTextElement.classList.remove("streaming", "no-children");
            const isLimit = err.message && (err.message.includes("সীমা শেষ") || err.message.includes("429") || err.message.includes("limit"));
            const errorMsg = err.message || (typeof currentLanguage !== "undefined" && currentLanguage === "en" ? "Failed to generate image. Please try again." : "ছবি তৈরি করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।");
            aiTextElement.innerHTML = `
              <div class="ai-error-box" style="display:flex; flex-direction:column; gap:8px; padding:14px 16px; border-radius:12px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25);">
                <div style="display:flex; align-items:center; gap:8px;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span style="font-weight:600; font-size:0.92rem; color:var(--text-main);">${escapeHtml(errorMsg)}</span>
                </div>
                ${isLimit ? `<button type="button" class="btn btn-primary" onclick="openAccountModal('settingsLimitsView');" style="align-self:flex-start; margin-top:6px; padding:6px 14px; font-size:0.82rem; background:var(--accent-primary); color:#fff; border-radius:8px; border:none; cursor:pointer; touch-action:manipulation;">${typeof currentLanguage !== "undefined" && currentLanguage === 'en' ? 'View Quota & Upgrade' : 'কোটা দেখুন ও আপগ্রেড করুন'}</button>` : ''}
              </div>
            `;
            if (!isLimit) {
              regenBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg><span>${typeof currentLanguage !== "undefined" && currentLanguage === "en" ? "Retry" : "আবার চেষ্টা করুন"}</span>`;
              regenBtn.classList.add("regen-btn-highlight");
              regenBtn.style.display = "inline-flex";
            }
            scrollToBottom(); resolve();
          }
          return;
        }

        let searchContext = "";
        // Web Search Logic based on Toggle
        if (isWebSearchEnabled && lastUserMsg && lastUserMsg.content) {
          try {
            const isEnNow = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
            setBubbleStatus(aiTextElement, "searching", isEnNow ? "Searching the web..." : "ওয়েব সার্চ করা হচ্ছে...");
            const searchData = await searchDuckDuckGo(lastUserMsg.content);
            if (searchData) {
              searchContext = isEnNow 
                ? `\n\n[Web Search Results Live Data]:\n${searchData}\n(Answer based on these verified facts)`
                : `\n\n[Web Search Results Live Data]:\n${searchData}\n(এই তথ্যের উপর ভিত্তি করে উত্তর দাও)`;
            } else {
              searchContext = isEnNow
                ? `\n\n[Web Search]: No live web results found, rely on your existing knowledge.`
                : `\n\n[Web Search]: সরাসরি কোনো তথ্য পাওয়া যায়নি, আপনার সাধারণ জ্ঞান ব্যবহার করুন।`;
              showToast(isEnNow ? "No search results found" : "সার্চে কোনো ফলাফল পাওয়া যায়নি", "error");
            }
          } catch (searchErr) {
            console.warn("[Web Search Error]:", searchErr);
          } finally {
            // Auto turn off toggle reliably
            const isEnNow = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
            isWebSearchEnabled = false; 
            updateAttachBtnActiveState();
            if (webSearchText) webSearchText.textContent = isEnNow ? "Web Search: Off" : "ওয়েব সার্চ: বন্ধ"; 
            if (attachWebSearchOption) {
              attachWebSearchOption.style.color = "var(--text-main)"; 
              const span = attachWebSearchOption.querySelector("span");
              if (span) span.style.color = "var(--text-sub)"; 
              const svg = attachWebSearchOption.querySelector("svg");
              if (svg) svg.style.stroke = "var(--text-sub)";
            }
          }
        }

        const isEnNow = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
        const langReminder = isEnNow
          ? "\n\n[System Note: Please respond fluently in English unless the user explicitly asks in another language]"
          : "\n\n[অনুস্মারক: সম্পূর্ণ উত্তর শুধু বাংলায় লিখুন, কোনো ইংরেজি বা অন্য ভাষা মিশাবেন না]";

        const lastUserIdx = messagesHistory.map((m) => m.role).lastIndexOf("user");

        let activeHistory = messagesHistory.map((m, idx) => {
          if (m.role === "system") {
            return {
              role: "system",
              content: buildSystemPrompt(currentModel?.name || selectedModelId, true, true)
            };
          }
          if (m.role === "user") {
            let text = typeof m.content === "string" ? cleanUserMessageContent(m.content) : "";
            if (m.files && m.files.length) {
              const fileText = m.files
                .map((f) => f.text ? `--- ${f.name} ---\n${f.text}` : "")
                .filter(Boolean)
                .join("\n\n");
              if (fileText) {
                const fileLabel = isEnNow ? "Attached File Context" : "সংযুক্ত ফাইলের বিষয়বস্তু";
                text += `\n\n[${fileLabel}]\n${fileText}`;
              }
            }
            if (idx === lastUserIdx) {
              if (searchContext) {
                text += searchContext;
              }
              text += langReminder;
            }
            return { ...m, content: text };
          }
          return m;
        });

        if (!activeHistory.some((m) => m.role === "system")) {
          activeHistory.unshift({
            role: "system",
            content: buildSystemPrompt(currentModel?.name || selectedModelId, true, true)
          });
        }

        const inputTokensForThisCall = activeHistory.reduce((sum, m) => sum + estimateTokens(m.content || ""), 0);

        const statusIntervalId = startDynamicStatusSequence(aiTextElement);

        let started = false;
        let streamQueueContent = "";
        let streamQueueReasoning = "";
        let renderedContent = "";
        let renderedReasoning = "";
        let apiFinished = false;
        let errOccurred = false;
        let queueRafId = null;
        let isQueueActive = false;
        let thinkStartTime = Date.now();
        
        let lastRenderTime = 0;
        const RENDER_THROTTLE = 30;

        let overallWatchdog = setTimeout(() => {
          if (!apiFinished) {
            console.warn("[Client Watchdog]: Hard initial timeout (65s) reached.");
            if (currentAbortController) {
              try { currentAbortController.abort("timeout"); } catch(e) { console.error('[Alokpoth]', e); }
            }
          }
        }, 45000);

        const finishUp = () => {
          if (overallWatchdog) {
            clearTimeout(overallWatchdog);
            overallWatchdog = null;
          }
          if (statusIntervalId) clearInterval(statusIntervalId);
          if (queueRafId) {
            cancelAnimationFrame(queueRafId);
            queueRafId = null;
          }
          persistCurrentSession();
          scrollToBottom();
          resolve();
        };

        const extractThoughts = (text) => {
          let thoughts = [];
          let content = text;
          const regex = /<think>([\s\S]*?)(?:<\/think>|$)/gi;
          let match;
          while ((match = regex.exec(content)) !== null) {
            thoughts.push(match[1]);
          }
          content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "");
          return { extractedReasoning: thoughts.join("\n\n"), cleanContent: content };
        };

        const renderCurrentState = () => {
           let html = "";
           
           const extracted = extractThoughts(renderedContent);
           const finalReasoning = renderedReasoning + (renderedReasoning && extracted.extractedReasoning ? "\n\n" : "") + extracted.extractedReasoning;
           const finalContent = extracted.cleanContent;

           if (finalReasoning) {
             const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
             const thinkTitle = !apiFinished && !finalContent ? (isEn ? "Thinking..." : "চিন্তা করা হচ্ছে...") : (isEn ? "Thinking completed" : "চিন্তাভাবনা সমাপ্ত");
             html += `<details class="thought-block" ${!apiFinished && !finalContent ? 'open' : ''}>
               <summary>
                 <span class="thought-bulb-icon">💡</span>
                 <span>${thinkTitle}</span>
                 <svg class="thought-chevron" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6"/></svg>
               </summary>
               <div class="thought-content">${safeMarkdown(finalReasoning)}</div>
             </details>`;
           }
           if (finalContent) {
             html += `<div class="content-block">${safeMarkdown(finalContent)}</div>`;
           } else if (!apiFinished) {
             html += `<span class="streaming-cursor"></span>`;
           } else if (apiFinished && !finalContent && finalReasoning) {
             // If it finished (or timed out) but only has thoughts, DO NOT show the messy thoughts.
             // Show a polite error explaining the timeout.
             html += `<div class="content-block" style="color: var(--error-color); font-weight: 500;">
               সার্ভারের সময়সীমা (৬০ সেকেন্ড) শেষ হওয়ার কারণে মডেলটি উত্তর তৈরি করতে ব্যর্থ হয়েছে।<br><br>
               <span style="font-size: 0.9em; opacity: 0.8; font-weight: normal;">পরামর্শ: থিংকিং মডেলগুলো (যেমন DeepSeek R1) অনেক সময় নেয়। দ্রুত উত্তরের জন্য 'Alo Elite' বা 'Gemini Flash' মডেলগুলো ব্যবহার করুন।</span>
             </div>`;
           }
           try { aiTextElement.innerHTML = html; } 
           catch { aiTextElement.textContent = finalContent || "সার্ভারের সময়সীমা (৬০ সেকেন্ড) শেষ হওয়ার কারণে মডেলটি উত্তর তৈরি করতে ব্যর্থ হয়েছে।"; }
        };

        const processQueue = () => {
          queueRafId = null;
          if (errOccurred) {
            isQueueActive = false;
            return;
          }

          if (streamQueueContent.length > 0 || streamQueueReasoning.length > 0) {
            if (streamQueueReasoning.length > 0) {
              let takeR = Math.max(12, Math.ceil(streamQueueReasoning.length / 2));
              renderedReasoning += streamQueueReasoning.substring(0, takeR);
              streamQueueReasoning = streamQueueReasoning.substring(takeR);
            }
            if (streamQueueContent.length > 0) {
              let takeC = Math.max(12, Math.ceil(streamQueueContent.length / 2));
              renderedContent += streamQueueContent.substring(0, takeC);
              streamQueueContent = streamQueueContent.substring(takeC);
            }

            const now = performance.now();
            if (now - lastRenderTime > RENDER_THROTTLE) {
              renderCurrentState();
              if (aiTextElement.children.length === 0) aiTextElement.classList.add("no-children");
              else aiTextElement.classList.remove("no-children");
              scrollToBottom();
              lastRenderTime = now;
            }
            queueRafId = requestAnimationFrame(processQueue);
          } else {
            if (!apiFinished) {
              // Re-render to update the thinking timer!
              const now = performance.now();
              if (renderedReasoning && now - lastRenderTime > 1000) {
                 renderCurrentState();
                 lastRenderTime = now;
              }
              isQueueActive = false;
              queueRafId = null;
            } else {
              isQueueActive = false;
              queueRafId = null;
              aiTextElement.classList.remove("streaming", "no-children");
              renderCurrentState();
              enhanceCodeBlocks(aiTextElement);
              
              const extracted = extractThoughts(renderedContent || "");
              const combinedReasoning = (renderedReasoning || "") + ((renderedReasoning && extracted.extractedReasoning) ? "\n\n" : "") + (extracted.extractedReasoning || "");
              let finalSavedContent = extracted.cleanContent || "";
              if (combinedReasoning) {
                finalSavedContent = `<think>\n${combinedReasoning}\n</think>\n\n` + finalSavedContent;
              }
              if (!finalSavedContent && combinedReasoning) finalSavedContent = `<think>\n${combinedReasoning}\n</think>`;
              
              copyBtn.dataset.text = extracted.cleanContent || finalSavedContent;
              copyBtn.style.display = "inline-flex";
              if (ttsBtn) ttsBtn.style.display = "inline-flex";
              if (likeBtn) likeBtn.style.display = "inline-flex";
              if (dislikeBtn) dislikeBtn.style.display = "inline-flex";
              if (shareBtn) shareBtn.style.display = "inline-flex";
              if (moreBtn) moreBtn.style.display = "inline-flex";
              regenBtn.classList.remove("regen-btn-highlight");
              regenBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`;
              regenBtn.style.display = "inline-flex";
              
              messagesHistory.push({ role: "assistant", content: finalSavedContent });
              addUsage(selectedModelId, inputTokensForThisCall, estimateTokens(finalSavedContent), {
                isCodeGen: countCodeBlocks(finalSavedContent) > 0
              });
              soundEngine.playReceive();
              triggerHaptic("light");
              updateNavbarCreditBadge();
              scrollToBottom();
              finishUp();
            }
          }
        };

        const handleToken = (deltaContent, deltaReasoning, fullContent, fullReasoning) => {
          if (!started) {
            started = true; 
            thinkStartTime = Date.now();
            clearInterval(statusIntervalId);
            if (overallWatchdog) { clearTimeout(overallWatchdog); overallWatchdog = null; }
            aiTextElement.style.whiteSpace = ""; 
            aiTextElement.innerHTML = "";
            aiTextElement.classList.add("streaming");
          }
          if (deltaContent) streamQueueContent += deltaContent;
          if (deltaReasoning) streamQueueReasoning += deltaReasoning;
          
          if (!isQueueActive) {
            isQueueActive = true;
            if (!queueRafId) {
              queueRafId = requestAnimationFrame(processQueue);
            }
          }
        };

        try {
          await streamServerCompletions(selectedModelId, activeHistory, handleToken);
          apiFinished = true;
          const isEnNow = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
          if (!started) {
            refundCredit();
            clearInterval(statusIntervalId);
            aiTextElement.classList.remove("streaming", "no-children");
            const modelDisplayName = currentModel?.name || selectedModelId || (isEnNow ? "Model" : "মডেল");
            aiTextElement.innerHTML = `
              <div class="ai-error-box" style="display:flex; flex-direction:column; gap:10px; padding:14px 16px; border-radius:12px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25);">
                <div style="display:flex; align-items:flex-start; gap:10px;">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
                    <span style="font-weight:600; font-size:0.92rem; color:var(--text-main);">${isEnNow ? `AI model '${escapeHtml(modelDisplayName)}' did not respond in time` : `AI মডেল '${escapeHtml(modelDisplayName)}' নির্দিষ্ট সময়ে সাড়া দেয়নি`}</span>
                    <span style="font-size:0.82rem; color:var(--text-sub); opacity:0.9;">${isEnNow ? 'The model server may be slow or busy. You can retry or choose another model.' : 'মডেলের সার্ভার সাময়িকভাবে ধীর বা ডাউন থাকতে পারে। আপনি পুনরায় চেষ্টা করতে পারেন বা অন্য মডেল বেছে নিতে পারেন।'}</span>
                  </div>
                </div>
                <div style="display:flex; gap:8px; margin-top:4px; flex-wrap:wrap;">
                  <button type="button" class="btn-retry-action" onclick="this.closest('.message-row.ai')?.querySelector('.action-icon-btn.regen-btn-highlight')?.click()" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; background:var(--accent-primary, #3b82f6); color:#fff; border:none; font-size:0.82rem; font-weight:600; cursor:pointer; touch-action:manipulation;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                    ${isEnNow ? "Try Again" : "আবার চেষ্টা করুন"}
                  </button>
                  <button type="button" onclick="openModelPicker()" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; background:var(--surface-color, #1e293b); color:var(--text-main, #fff); border:1px solid var(--border-color, #334155); font-size:0.82rem; font-weight:600; cursor:pointer; touch-action:manipulation;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    ${isEnNow ? "Switch Model" : "মডেল পরিবর্তন করুন"}
                  </button>
                </div>
              </div>
            `;
            regenBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg><span>${isEnNow ? "Try Again" : "আবার চেষ্টা করুন"}</span>`;
            regenBtn.classList.add("regen-btn-highlight");
            regenBtn.style.display = "inline-flex";
            copyBtn.style.display = "none";
            finishUp();
          } else if (!isQueueActive && streamQueueContent.length === 0 && streamQueueReasoning.length === 0) {
            processQueue();
          }
        } catch (err) {
          errOccurred = true;
          apiFinished = true;
          if (queueRafId) {
            cancelAnimationFrame(queueRafId);
            queueRafId = null;
          }
          clearInterval(statusIntervalId);
          aiTextElement.classList.remove("streaming", "no-children");
          aiTextElement.style.whiteSpace = "";

          const fullResult = renderedContent || renderedReasoning;
          const isAbort = err.name === "AbortError" || (err.message && err.message.toLowerCase().includes("abort"));
          const isEnNow = (typeof currentLanguage !== "undefined" && currentLanguage === "en");

          if (isAbort) {
            const extracted = extractThoughts(renderedContent || "");
            const combinedReasoning = (renderedReasoning || "") + ((renderedReasoning && extracted.extractedReasoning) ? "\n\n" : "") + (extracted.extractedReasoning || "");
            let finalSavedContent = extracted.cleanContent || "";
            if (combinedReasoning) {
              finalSavedContent = `<think>\n${combinedReasoning}\n</think>\n\n` + finalSavedContent;
            }
            if (!finalSavedContent && combinedReasoning) finalSavedContent = `<think>\n${combinedReasoning}\n</think>`;

            if (finalSavedContent) {
              try {
                renderCurrentState();
                aiTextElement.insertAdjacentHTML('beforeend', `<div class="generation-stopped-note">${isEnNow ? "⏹ Generation stopped" : "⏹ উত্তর তৈরি থামানো হয়েছে"}</div>`);
                enhanceCodeBlocks(aiTextElement);
              } catch {
                aiTextElement.textContent = finalSavedContent + (isEnNow ? "\n\n(Generation stopped)" : "\n\n(উত্তর তৈরি থামানো হয়েছে)");
              }
              messagesHistory.push({ role: "assistant", content: finalSavedContent });
              addUsage(selectedModelId, inputTokensForThisCall, estimateTokens(finalSavedContent), {
                isCodeGen: countCodeBlocks(finalSavedContent) > 0
              });
            } else {
              aiTextElement.innerHTML = `<span class="status-indicator status-error">${isEnNow ? "Generation stopped." : "উত্তর তৈরি থামানো হয়েছে।"}</span>`;
            }
          } else {
            if (!fullResult || fullResult.trim().length === 0) {
              refundCredit();
            }
            soundEngine.playError();
            triggerHaptic("error");

            let userFriendlyMsg = "";
            let errorDetail = "";
            if (!navigator.onLine) {
              userFriendlyMsg = isEnNow ? "Internet connection disconnected." : "ইন্টারনেট সংযোগ বিচ্ছিন্ন হয়েছে।";
              errorDetail = isEnNow ? "Please check your network and try again." : "আপনার নেটওয়ার্ক পরীক্ষা করে আবার চেষ্টা করুন।";
            } else if (err.name === "AbortError" || err === "timeout" || (err.message && err.message.toLowerCase().includes("timeout"))) {
              userFriendlyMsg = isEnNow ? `AI model '${currentModel?.name || "Model"}' did not respond in time.` : `AI মডেল '${currentModel?.name || "মডেল"}' নির্দিষ্ট সময়ে সাড়া দেয়নি।`;
              errorDetail = isEnNow ? "The model server may be slow or busy. Please try another model." : "মডেলের সার্ভার সাময়িকভাবে ধীর বা ডাউন থাকতে পারে। অন্য কোনো মডেল নির্বাচন করে চেষ্টা করুন।";
            } else if (err.message && (err.message.includes("বার্তা সীমা শেষ") || err.message.includes("limit"))) {
              userFriendlyMsg = err.message;
              errorDetail = isEnNow ? "Please wait a moment or upgrade your plan." : "অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন বা প্ল্যান আপগ্রেড করুন।";
            } else if (err.message && (err.message.includes("মডেল প্রোভাইডার") || err.message.includes("429"))) {
              userFriendlyMsg = isEnNow ? `AI model '${currentModel?.name || "Model"}' is experiencing high traffic.` : `AI মডেল '${currentModel?.name || "মডেল"}' এ বর্তমানে অতিরিক্ত ট্রাফিক চাপ রয়েছে।`;
              errorDetail = isEnNow ? "Provider servers are temporarily busy. Please wait a moment or switch models." : "প্রোভাইডার সার্ভার সাময়িকভাবে ব্যস্ত আছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন বা অন্য মডেল বেছে নিন।";
            } else if (err.message && (err.message.includes("প্ল্যান প্রয়োজন") || err.message.includes("লগইন করুন এবং") || err.message.includes("প্ল্যান সক্রিয় করুন"))) {
              userFriendlyMsg = err.message;
              errorDetail = isEnNow ? "Please select an available model or upgrade your plan." : "অনুমোদিত মডেল নির্বাচন করুন অথবা প্ল্যান আপগ্রেড করুন।";
            } else if (err.message && err.message.length > 5 && !err.message.includes("fetch") && !err.message.includes("Object") && !err.message.includes("JSON")) {
              userFriendlyMsg = err.message;
              errorDetail = isEnNow ? "You can select another model from options and try again." : "মডেল অপশন থেকে অন্য কোনো মডেল বেছে নিয়ে পুনরায় চেষ্টা করতে পারেন।";
            } else {
              userFriendlyMsg = isEnNow ? `No response received from AI model '${currentModel?.name || "Model"}'.` : `AI মডেল '${currentModel?.name || "মডেল"}' থেকে কোনো উত্তর পাওয়া যায়নি।`;
              errorDetail = isEnNow ? "Connection to the server failed. Please try again or choose another model." : "সার্ভারে সংযোগ বিচ্ছিন্ন হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন বা অন্য মডেল বেছে নিন।";
            }

            const isPlanRestricted = Boolean(userFriendlyMsg && (userFriendlyMsg.includes("প্ল্যান প্রয়োজন") || userFriendlyMsg.includes("লগইন করুন এবং") || userFriendlyMsg.includes("প্ল্যান সক্রিয় করুন")));
            if (fullResult && fullResult.trim().length > 0) {
              try {
                renderCurrentState();
                aiTextElement.insertAdjacentHTML('beforeend', `<div class="generation-error-note"><svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;display:inline-block;vertical-align:-2px;margin-right:6px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${isEnNow ? "Temporary connection issue. Click button below to retry." : "সংযোগে সাময়িক সমস্যা হয়েছে। পুনরায় চেষ্টা করতে নিচের বোতামে চাপুন।"}</div>`);
                enhanceCodeBlocks(aiTextElement);
              } catch {
                aiTextElement.textContent = fullResult;
              }
            } else {
              aiTextElement.innerHTML = `
                <div class="ai-error-box" style="display:flex; flex-direction:column; gap:10px; padding:14px 16px; border-radius:12px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25);">
                  <div style="display:flex; align-items:flex-start; gap:10px;">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
                      <span style="font-weight:600; font-size:0.92rem; color:var(--text-main);">${escapeHtml(userFriendlyMsg)}</span>
                      <span style="font-size:0.82rem; color:var(--text-sub); opacity:0.9;">${escapeHtml(errorDetail)}</span>
                    </div>
                  </div>
                  ${isPlanRestricted ? `
                    <div style="display:flex; gap:8px; margin-top:4px; flex-wrap:wrap;">
                      <button type="button" onclick="openModelPicker()" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; background:var(--surface-color, #1e293b); color:var(--text-main, #fff); border:1px solid var(--border-color, #334155); font-size:0.82rem; font-weight:600; cursor:pointer; touch-action:manipulation;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                        ${isEnNow ? "Switch Model" : "মডেল পরিবর্তন করুন"}
                      </button>
                      <a href="plans.html" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; background:linear-gradient(135deg, #3b82f6, #6366f1); color:#fff; text-decoration:none; font-size:0.82rem; font-weight:600; cursor:pointer; touch-action:manipulation;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        ${isEnNow ? "Upgrade Plan" : "প্ল্যান আপগ্রেড করুন"}
                      </a>
                    </div>
                  ` : `
                    <div style="display:flex; gap:8px; margin-top:4px; flex-wrap:wrap;">
                      <button type="button" class="btn-retry-action" onclick="this.closest('.message-row.ai')?.querySelector('.action-icon-btn.regen-btn-highlight')?.click()" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; background:var(--accent-primary, #3b82f6); color:#fff; border:none; font-size:0.82rem; font-weight:600; cursor:pointer; touch-action:manipulation;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                        ${isEnNow ? "Try Again" : "আবার চেষ্টা করুন"}
                      </button>
                      <button type="button" onclick="openModelPicker()" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; background:var(--surface-color, #1e293b); color:var(--text-main, #fff); border:1px solid var(--border-color, #334155); font-size:0.82rem; font-weight:600; cursor:pointer; touch-action:manipulation;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                        ${isEnNow ? "Switch Model" : "মডেল পরিবর্তন করুন"}
                      </button>
                    </div>
                  `}
                </div>
              `;
            }
          }

          if (isPlanRestricted) {
            regenBtn.style.display = "none";
          } else {
            regenBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg><span>${isEnNow ? "Try Again" : "আবার চেষ্টা করুন"}</span>`;
            regenBtn.classList.add("regen-btn-highlight");
            regenBtn.style.display = "inline-flex";
          }

          if (fullResult && fullResult.trim().length > 0) {
            copyBtn.dataset.text = fullResult;
            copyBtn.style.display = "inline-flex";
          } else {
            copyBtn.style.display = "none";
          }
          finishUp();
        }
      });
    }

    function initNativeChatGPTControls() {
      const cameraBtn = document.getElementById("cameraBtn");
      const navSoundToggleBtn = document.getElementById("navSoundToggleBtn");
      const navSoundIconOff = document.getElementById("navSoundIconOff");
      const navSoundIconOn = document.getElementById("navSoundIconOn");
      const quickNewChatNavBtn = document.getElementById("quickNewChatNavBtn");
      const drawerSearchToggleBtn = document.getElementById("drawerSearchToggleBtn");
      const drawerSearchBoxWrap = document.getElementById("drawerSearchBoxWrap");
      const drawerSearchInput = document.getElementById("drawerSearchInput");

      if (cameraBtn) {
        cameraBtn.addEventListener("click", () => {
          triggerHaptic("light");
          if (imageInput) imageInput.click();
        });
      }

      if (navSoundToggleBtn) {
        navSoundToggleBtn.addEventListener("click", () => {
          triggerHaptic("light");
          if (typeof soundEngine !== "undefined") {
            soundEngine.muted = !soundEngine.muted;
            if (navSoundIconOff && navSoundIconOn) {
              navSoundIconOff.style.display = soundEngine.muted ? "block" : "none";
              navSoundIconOn.style.display = soundEngine.muted ? "none" : "block";
            }
            const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
            showToast(soundEngine.muted ? (isEn ? "Audio muted" : "শব্দ বন্ধ করা হয়েছে") : (isEn ? "Audio unmuted" : "শব্দ চালু করা হয়েছে"), "info");
          }
        });
      }

      if (quickNewChatNavBtn) {
        quickNewChatNavBtn.addEventListener("click", () => {
          triggerHaptic("light");
          if (typeof createNewSession === "function") createNewSession();
        });
      }

      if (drawerSearchToggleBtn && drawerSearchBoxWrap) {
        drawerSearchToggleBtn.addEventListener("click", () => {
          triggerHaptic("light");
          const isVisible = drawerSearchBoxWrap.style.display !== "none";
          drawerSearchBoxWrap.style.display = isVisible ? "none" : "block";
          if (!isVisible && drawerSearchInput) drawerSearchInput.focus();
        });
      }
    }

    updateTokenCounter();

    // Initialize luxury UI engines
    initAccountTabs();
    initScrollToBottomFAB();
    initDragAndDrop();
    initComposerQuickBar();
    initVoiceInput();
    initNativeChatGPTControls();
    updateNavbarCreditBadge();

    syncModelStatuses();
    setInterval(() => {
      if (navigator.onLine) syncModelStatuses({ silent: true });
    }, PING_INTERVAL_MS);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") syncModelStatuses({ silent: true });
    });

    window.addEventListener("online", () => syncModelStatuses({ silent: true }));

    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isGenerating) {
        stopGeneration();
        return;
      }

      if (chatForm._isSubmitting) return;
      chatForm._isSubmitting = true;
      setTimeout(() => { chatForm._isSubmitting = false; }, 800);
      
      const token = localStorage.getItem("alokpoth_token");
      const isEn = (typeof currentLanguage !== "undefined" && currentLanguage === "en");
      
      if (!navigator.onLine) { updateOnlineStatus(); return; }

      // Require login to send any message
      if (!token) {
        showToast(isEn ? "Please log in or sign up to start chatting." : "চ্যাট করতে লগইন বা সাইন-আপ করুন।", "warning");
        openAuthModal("login");
        chatForm._isSubmitting = false;
        return;
      }

      const text = userInput.value.trim();
      const isImgReq = isImageGenEnabled || detectImageGenRequest(text);

      if (isImgReq) {
        if (!hasImageCredit()) {
          const { limit, hours } = getImagePlanLimit();
          const planName = currentPlan || "Free";
          const limitMsg = isEn
            ? `Image generation limit reached! Your ${planName} plan allows ${limit} images per ${hours} hour(s). Please wait for reset or upgrade.`
            : `ছবি তৈরির সীমা শেষ! আপনার ${planName} প্ল্যানে ${hours} ঘণ্টায় ${limit}টি ছবি তৈরি করা যায়। অনুগ্রহ করে অপেক্ষা করুন অথবা আপগ্রেড করুন।`;
          showToast(limitMsg, "warning");
          openAccountModal("limits");
          chatForm._isSubmitting = false;
          return;
        }
      } else {
        if (!hasCredit()) {
          showToast(isEn ? "Message limit reached! Please upgrade your plan or wait for reset." : "আপনার প্ল্যানের বার্তা সীমা শেষ হয়েছে! দয়া করে আপগ্রেড করুন।", "warning");
          openAccountModal("limits");
          chatForm._isSubmitting = false;
          return;
        }
      }

      const imagesForThisMessage = pendingImages.slice();
      const filesForThisMessage = pendingFiles.filter((f) => !f.loading).slice();
      if (!text && !imagesForThisMessage.length && !filesForThisMessage.length) return;

      isGenerating = true;
      updateSendAvailability();

      createUserBubble(text || (imagesForThisMessage.length ? (currentLanguage === "en" ? "Image attached" : "ছবি সংযুক্ত করা হয়েছে") : (currentLanguage === "en" ? "File attached" : "ফাইল সংযুক্ত করা হয়েছে")), imagesForThisMessage, filesForThisMessage);

      soundEngine.playSend();
      triggerHaptic("medium");

      if (!isImgReq) {
        messageCount++;
        try { localStorage.setItem("alokpoth_message_count", String(messageCount)); } catch(e) { console.error('[Alokpoth]', e); }
        deductCredit(1);
        updateNavbarCreditBadge();
      }

      messagesHistory.push({
        role: "user",
        content: text,
        rawPrompt: text,
        images: imagesForThisMessage.length ? imagesForThisMessage.map((img) => ({ base64: img.base64, mimeType: img.mimeType })) : undefined,
        files: filesForThisMessage.length ? filesForThisMessage.map((f) => ({ name: f.name, text: f.text })) : undefined
      });

      pendingImages = []; pendingFiles = [];
      renderImagePreviews(); renderFilePreviews();
      userInput.value = ""; userInput.style.height = "auto";
      updateTokenCounter();

      try {
        await generateAIReply();
      } catch (err) {
        console.error("[Chat Form generateAIReply Error]:", err);
      } finally {
        chatForm._isSubmitting = false;
        isGenerating = false;
        updateSendAvailability();
        updateTokenCounter();
        if (typeof syncUserProfileFromServer === "function") syncUserProfileFromServer();
      }
    });

    window.dismissSplashLoader = function() {};
  
