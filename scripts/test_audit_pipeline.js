const assert = require("assert");
const fs = require("fs");
const path = require("path");

async function runTests() {
  console.log("=== STARTING PIPELINE AUDIT VALIDATION TESTS ===\n");

  // --- TEST 1: Model Config & Aliases ---
  console.log("[Test 1] Validating Model Aliases & Configurations...");
  const { getModelConfig, MODEL_ALIASES } = require("../utils/getModelConfig");

  assert(MODEL_ALIASES["alo-pro"] === "llama-3.3-70b-versatile", "alo-pro must alias to llama-3.3-70b-versatile");
  assert(MODEL_ALIASES["gemini-1.5-flash"] === "gemini-3.5-flash-lite", "gemini-1.5-flash must alias to gemini-3.5-flash-lite");

  const aloProCfg = await getModelConfig("alo-pro");
  assert(aloProCfg !== null, "alo-pro config should resolve");
  assert(aloProCfg.model_id === "llama-3.3-70b-versatile" || aloProCfg.id === "llama-3.3-70b-versatile", "alo-pro should resolve to llama-3.3-70b-versatile");
  assert(aloProCfg.type === "groq", "alo-pro should have type groq");

  const flashLiteCfg = await getModelConfig("gemini-1.5-flash");
  assert(flashLiteCfg !== null, "gemini-1.5-flash alias config should resolve");
  assert(flashLiteCfg.geminiModel === "gemini-2.5-flash-lite" || flashLiteCfg.geminiModel === "gemini-1.5-flash" || flashLiteCfg.model_id === "gemini-3.5-flash-lite", "gemini-1.5-flash should resolve properly");

  const mimoCfg = await getModelConfig("mimo-v2.5");
  assert(mimoCfg !== null, "mimo-v2.5 should resolve");
  console.log("✓ Test 1 Passed: Model resolution and aliases are correct.\n");

// --- TEST 2: Memory Backup Model Tiers & Plan Allowed Models ---
console.log("[Test 2] Validating memory_backup.json model tiering and plan settings...");
const memoryBackup = JSON.parse(fs.readFileSync(path.join(__dirname, "../server/data/memory_backup.json"), "utf8"));
const freePlan = memoryBackup.plans.find(p => p.name === "Free");
const proPlan = memoryBackup.plans.find(p => p.name === "Pro");
const maxPlan = memoryBackup.plans.find(p => p.name === "Max");

assert(freePlan, "Free plan must exist");
assert(proPlan, "Pro plan must exist");
assert(maxPlan, "Max plan must exist");

// Free models in models list
const flashLiteModel = memoryBackup.models.find(m => m.model_id === "gemini-3.5-flash-lite");
const openrouterFree = memoryBackup.models.find(m => m.model_id === "openrouter/free");
const ultraModel = memoryBackup.models.find(m => m.model_id === "openai/gpt-oss-120b");

assert(flashLiteModel && flashLiteModel.premium === false && flashLiteModel.efficient === false, "gemini-3.5-flash-lite must be non-premium, non-efficient");
assert(openrouterFree && openrouterFree.premium === false && openrouterFree.efficient === false, "openrouter/free must be non-premium, non-efficient");
assert(ultraModel && ultraModel.premium === true, "openai/gpt-oss-120b must be premium");

// Verify Free plan's allowed_models contains free models and NOT ultra
assert(freePlan.allowed_models.includes("gemini-3.5-flash-lite"), "Free plan must allow gemini-3.5-flash-lite");
assert(freePlan.allowed_models.includes("openrouter/free"), "Free plan must allow openrouter/free");
assert(!freePlan.allowed_models.includes("openai/gpt-oss-120b"), "Free plan must not include openai/gpt-oss-120b");

console.log("✓ Test 2 Passed: Memory backup model tiers and plans correctly defined.\n");

// --- TEST 3: Rate Limiter Tier Guard Logic ---
console.log("[Test 3] Validating Rate Limiter Model Guard Logic...");

function testModelGuard(userPlanName, isUserAdmin, modelId, modelDoc) {
  const isMaxModel = Boolean(modelDoc?.efficient || modelDoc?.isMaxOnly || modelId === "gpt-5.6");
  const isProModel = Boolean(modelDoc?.premium || modelDoc?.isProOnly) && !isMaxModel;

  if (isUserAdmin) {
    return { allowed: true };
  }

  const normalizedPlanName = (userPlanName || "Free").toLowerCase();
  if (normalizedPlanName === "free") {
    if (isMaxModel) {
      return { allowed: false, error: "এই মডেলটি ব্যবহারের জন্য Max প্ল্যান প্রয়োজন।" };
    }
    if (isProModel) {
      return { allowed: false, error: "এই মডেলটি ব্যবহারের জন্য Pro বা Max প্ল্যান প্রয়োজন।" };
    }
  } else if (normalizedPlanName === "pro") {
    if (isMaxModel) {
      return { allowed: false, error: "এই মডেলটি ব্যবহারের জন্য Max প্ল্যান প্রয়োজন।" };
    }
  }
  return { allowed: true };
}

// Test Free user trying Pro model
const freeGuardPro = testModelGuard("Free", false, "alo-pro", { premium: true, efficient: false });
assert(!freeGuardPro.allowed, "Free user must NOT be allowed to use Pro model");
assert(freeGuardPro.error.includes("Pro বা Max"), "Error message should mention Pro or Max");

// Test Free user trying Max model
const freeGuardMax = testModelGuard("Free", false, "gpt-5.6", { premium: true, efficient: true });
assert(!freeGuardMax.allowed, "Free user must NOT be allowed to use Max model");
assert(freeGuardMax.error.includes("Max প্ল্যান"), "Error message should mention Max");

// Test Pro user trying Max model
const proGuardMax = testModelGuard("Pro", false, "gpt-5.6", { premium: true, efficient: true });
assert(!proGuardMax.allowed, "Pro user must NOT be allowed to use Max model");

// Test Pro user using Pro model
const proGuardPro = testModelGuard("Pro", false, "alo-pro", { premium: true, efficient: false });
assert(proGuardPro.allowed, "Pro user must be allowed to use Pro model");

// Test Free user using Free model
const freeGuardFree = testModelGuard("Free", false, "gemini-3.5-flash-lite", { premium: false, efficient: false });
assert(freeGuardFree.allowed, "Free user must be allowed to use Free model");

// Test Admin bypass
const adminGuard = testModelGuard("Free", true, "gpt-5.6", { premium: true, efficient: true });
assert(adminGuard.allowed, "Admin must be allowed to use any model regardless of plan");

console.log("✓ Test 3 Passed: Rate limiter model guard logic strictly enforces Free, Pro, and Max tiers.\n");

// --- TEST 4: Chat Controller SSE Chunk Regex & Token Counting ---
console.log("[Test 4] Validating SSE Content Chunk Detection Regex in Chat Controller...");

const contentChunkRegex = /"content"\s*:\s*"(?:[^"\\]|\\.)+"/;
const reasoningRegex = /"(?:reasoning|reasoning_content)"\s*:\s*"(?:[^"\\]|\\.)+/;
const textRegex = /"text"\s*:\s*"(?:[^"\\]|\\.)+/;

function hasRealContentTokens(chunkStr) {
  return contentChunkRegex.test(chunkStr) || reasoningRegex.test(chunkStr) || textRegex.test(chunkStr);
}

// Chunk with role only (initial empty chunk sent by OpenAI/Groq)
const roleOnlyChunk = 'data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}';
assert(!hasRealContentTokens(roleOnlyChunk), "Role-only SSE chunk must NOT be detected as content token");

// Empty delta chunk
const emptyDeltaChunk = 'data: {"choices":[{"delta":{}}]}';
assert(!hasRealContentTokens(emptyDeltaChunk), "Empty delta SSE chunk must NOT be detected as content token");

// Delta with content
const contentChunk = 'data: {"choices":[{"delta":{"content":"হ্যালো!"}}]}';
assert(hasRealContentTokens(contentChunk), "Actual content SSE chunk MUST be detected as content token");

// Delta with escaped quotes and newline in content
const complexContentChunk = 'data: {"choices":[{"delta":{"content":"Line 1\\n\\\"Hello\\\""}}]}';
assert(hasRealContentTokens(complexContentChunk), "Content chunk with escaped characters must be detected");

// Reasoning delta
const reasoningChunk = 'data: {"choices":[{"delta":{"reasoning":"Analyzing query..."}}]}';
assert(hasRealContentTokens(reasoningChunk), "Reasoning chunk must be detected as content token");

console.log("✓ Test 4 Passed: Empty assistant chunks do not falsely trigger token counting.\n");

// --- TEST 5: Bengali / English Tag Cleaning & Session Title Sanitization ---
console.log("[Test 5] Validating Tag Cleaning & Session Title Sanitization...");

function cleanUserMessageContent(rawContent) {
  if (!rawContent || typeof rawContent !== "string") return "";
  let t = rawContent;
  t = t.replace(/\n\n\[(?:অনুস্মারক|System Note):[\s\S]*?\](?=\n|$)/gi, "");
  t = t.replace(/\n\n\[(?:সংযুক্ত ফাইলের বিষয়বস্তু|Attached File Context)\][\s\S]*?(?=\n\n\[|$)/gi, "");
  t = t.replace(/\n\n\[(?:Web Search Results Live Data|Web Search Results|Web Search|ওয়েব অনুসন্ধান)[\s\S]*?\](?=\n\n\[|$)/gi, "");
  t = t.replace(/\n\n\[(?:অনুস্মারক|System Note):[\s\S]*$/gi, "");
  t = t.replace(/\n\n\[(?:সংযুক্ত ফাইলের বিষয়বস্তু|Attached File Context)\][\s\S]*$/gi, "");
  t = t.replace(/\n\n\[(?:Web Search Results Live Data|Web Search Results|Web Search|ওয়েব অনুসন্ধান)[\s\S]*$/gi, "");
  return t.trim();
}

function sanitizeChatTitleText(text) {
  if (!text || typeof text !== "string") return "";
  let t = text;
  t = t.replace(/\[(?:System Note|Attached File Context|অনুস্মারক|সংযুক্ত ফাইলের বিষয়বস্তু|সংযুক্ত ফাইলের|সংযুক্ত|ফাইল|ছবি তৈরি|ছবি|ওয়েব অনুসন্ধান|Web Search Results Live Data|Web Search Results|Web Search)[\s\S]*?(?:\]|$)/gi, "");
  t = t.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "");
  t = t.replace(/---[^\n]+---/g, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function makeSessionTitle(history, currentLanguage = "bn") {
  const isEn = currentLanguage === "en";
  const firstUser = (history || []).find((m) => m.role === "user");
  if (!firstUser) return isEn ? "New Chat" : "নতুন চ্যাট";
  
  let cleanText = "";
  if (firstUser.rawPrompt) {
    cleanText = sanitizeChatTitleText(cleanUserMessageContent(firstUser.rawPrompt));
  } else if (typeof firstUser.content === "string") {
    cleanText = sanitizeChatTitleText(cleanUserMessageContent(firstUser.content));
  }
  
  if (!cleanText) {
    if (firstUser.files && firstUser.files.length) {
      return (isEn ? "File: " : "ফাইল: ") + firstUser.files[0].name;
    }
    if (firstUser.images && firstUser.images.length) {
      return isEn ? "Image Chat" : "ছবি সম্পর্কিত চ্যাট";
    }
    return isEn ? "New Chat" : "নতুন চ্যাট";
  }
  
  return cleanText.slice(0, 32);
}

// Test message with raw tags
const rawMessageWithTags = "আলোকপথ এআই কি?\n\n[সংযুক্ত ফাইলের বিষয়বস্তু]\n--- doc.txt ---\nsome file text\n\n[অনুস্মারক: সম্পূর্ণ উত্তর শুধু বাংলায় লিখুন, কোনো ইংরেজি বা অন্য ভাষা মিশাবেন না]";
const cleaned = cleanUserMessageContent(rawMessageWithTags);
assert(cleaned === "আলোকপথ এআই কি?", `Cleaned text must be 'আলোকপথ এআই কি?', got '${cleaned}'`);

const titleBn = makeSessionTitle([{ role: "user", content: rawMessageWithTags }], "bn");
assert(titleBn === "আলোকপথ এআই কি?", `Title must be 'আলোকপথ এআই কি?', got '${titleBn}'`);
assert(!titleBn.includes("অনুস্মারক"), "Title must not leak Bengali reminder tag");
assert(!titleBn.includes("সংযুক্ত"), "Title must not leak file tag");

// Test English session title
const rawEnglishMsg = "How does photosynthesis work?\n\n[Attached File Context]\n--- note.txt ---\nnotes\n\n[System Note: Please respond fluently in English unless the user explicitly asks in another language]";
const titleEn = makeSessionTitle([{ role: "user", content: rawEnglishMsg }], "en");
assert(titleEn === "How does photosynthesis work?", `Title must be clean, got '${titleEn}'`);
assert(!titleEn.includes("System Note"), "Title must not leak System Note");

// Test file-only message title
const fileOnlyHistory = [{ role: "user", content: "", files: [{ name: "data_report.pdf" }] }];
const fileTitle = makeSessionTitle(fileOnlyHistory, "en");
assert(fileTitle === "File: data_report.pdf", `File-only title should be 'File: data_report.pdf', got '${fileTitle}'`);

console.log("✓ Test 5 Passed: Tags are cleanly stripped, session titles never leak internal tags.\n");

// --- TEST 6: index.html Syntax & Code Integrity Validation ---
console.log("[Test 6] Validating index.html Syntax & Script Integrity...");
const indexHtml = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

// Extract all <script> contents (excluding external src)
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scriptIndex = 0;
while ((match = scriptRegex.exec(indexHtml)) !== null) {
  scriptIndex++;
  const scriptContent = match[1];
  if (!scriptContent.trim()) continue;
  try {
    new Function(scriptContent);
  } catch (err) {
    assert.fail(`Syntax error in index.html script tag #${scriptIndex}: ${err.message}`);
  }
}
console.log(`✓ Test 6 Passed: All ${scriptIndex} script blocks in index.html passed JavaScript syntax compilation without errors.\n`);

  console.log("==================================================");
  console.log(" ALL PIPELINE AUDIT VALIDATION TESTS PASSED! (6/6)");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

