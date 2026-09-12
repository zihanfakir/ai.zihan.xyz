const bcrypt = require('bcryptjs');

// In-Memory Database Fallback Store for when MongoDB is not running locally
const memoryStore = {
  users: [],
  plans: [
    { name: 'Free', displayName: 'ফ্রি প্ল্যান', message_limit: 10, window_hours: 3, allowed_models: ['openrouter/free', 'gemini-3.5-flash-lite', 'gemini-1.5-flash', 'mimo-v2.5', 'hy3', 'deepseek-v4-flash'], is_active: true },
    { name: 'Pro', displayName: 'প্রো প্ল্যান', message_limit: 30, window_hours: 3, allowed_models: ['*'], is_active: true },
    { name: 'Max', displayName: 'ম্যাক্স প্ল্যান', message_limit: 50, window_hours: 1, allowed_models: ['*'], is_active: true }
  ],
  redeemCodes: [],
  usageLogs: [],
  models: [
      { id: "openrouter/free", model_id: "openrouter/free", name: "Alo Go", provider: "Alokpoth", base_url: "https://openrouter.ai/api/v1/chat/completions", api_key: process.env.OPENROUTER_API_KEY, premium: false, efficient: false, order: 1, type: "openrouter" },
      { id: "gemini-3.5-flash-lite", model_id: "gemini-3.5-flash-lite", name: "Alo Flash", provider: "Alokpoth", base_url: "https://openrouter.ai/api/v1/chat/completions", api_key: process.env.OPENROUTER_API_KEY, premium: false, efficient: false, order: 2, type: "gemini" },
      { id: "openai/gpt-oss-120b", model_id: "openai/gpt-oss-120b", name: "Alo Pro", provider: "Alokpoth", base_url: "https://api.groq.com/openai/v1/chat/completions", api_key: process.env.GROQ_API_KEY, premium: true, efficient: false, order: 3, type: "groq" },
      { id: "claude-sonnet-4-6", model_id: "claude-sonnet-4-6", name: "Alo Elite", provider: "Alokpoth", base_url: "https://vyceai.com/v1/chat/completions", api_key: process.env.VYCE_API_KEY, premium: true, efficient: false, order: 4, type: "vyce" },
      { id: "nemotron-ultra-550b", model_id: "nemotron-ultra-550b", name: "Alo Ultra", provider: "Alokpoth", base_url: "https://vyceai.com/v1/chat/completions", api_key: process.env.VYCE_API_KEY, premium: true, efficient: false, order: 5, type: "vyce" },
      { id: "nemotron-vision", model_id: "nemotron-vision", name: "Alo Vision", provider: "Alokpoth", base_url: "https://vyceai.com/v1/chat/completions", api_key: process.env.VYCE_API_KEY, premium: true, efficient: false, order: 6, type: "vyce" },
      { id: "gpt-5.6", model_id: "gpt-5.6", name: "Alo Max", provider: "Alokpoth", base_url: "https://vyceai.com/v1/chat/completions", api_key: process.env.VYCE_API_KEY, premium: true, efficient: true, order: 7, type: "vyce" },
      { id: "mimo-v2.5", model_id: "mimo-v2.5", name: "Alo Mimo", provider: "Alokpoth", base_url: "https://api.b.ai/v1/chat/completions", api_key: process.env.BAI_API_KEY, premium: false, efficient: false, order: 8, type: "bai" },
      { id: "hy3", model_id: "hy3", name: "Alo HY3", provider: "Alokpoth", base_url: "https://api.b.ai/v1/chat/completions", api_key: process.env.BAI_API_KEY, premium: false, efficient: false, order: 9, type: "bai" },
      { id: "deepseek-v4-flash", model_id: "deepseek-v4-flash", name: "Alo DeepSeek Flash", provider: "Alokpoth", base_url: "https://vyceai.com/v1/chat/completions", api_key: process.env.VYCE_API_KEY, premium: false, efficient: false, order: 10, type: "vyce" },
      { id: "deepseek-v4-flash-vision-exp", model_id: "deepseek-v4-flash-vision-exp", name: "Alo DeepSeek Vision", provider: "Alokpoth", base_url: "https://vyceai.com/v1/chat/completions", api_key: process.env.VYCE_API_KEY, premium: true, efficient: false, order: 11, type: "vyce" }
  ],
  settings: {}
};

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../data');
const BACKUP_FILE = path.join(BACKUP_DIR, 'memory_backup.json');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (e) {}
}

const saveBackup = () => {
  try {
    if (memoryStore.usageLogs && memoryStore.usageLogs.length > 5000) {
      memoryStore.usageLogs = memoryStore.usageLogs.slice(-5000);
    }
    const backupData = {
      users: memoryStore.users || [],
      plans: memoryStore.plans || [],
      redeemCodes: memoryStore.redeemCodes || [],
      usageLogs: memoryStore.usageLogs || [],
      models: memoryStore.models || [],
      settings: memoryStore.settings || {}
      // chatSessions purposefully excluded: chat privacy is client-side only
    };
    const tmpFile = BACKUP_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(backupData, null, 2), 'utf8');
    fs.renameSync(tmpFile, BACKUP_FILE);
  } catch (err) {
    console.error('[MemoryStore Backup Error]:', err.message);
  }
};

let saveTimer = null;
const debouncedSave = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBackup, 1000);
};

// Seed default zihanfakir@gmail.com admin if not present
const seedDefaultAdmin = async () => {
  // Load from backup if exists
  if (fs.existsSync(BACKUP_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
      if (data.users && data.users.length) memoryStore.users = data.users;
      if (data.plans && data.plans.length) memoryStore.plans = data.plans;
      if (data.redeemCodes && data.redeemCodes.length) memoryStore.redeemCodes = data.redeemCodes;
      if (data.models && data.models.length) memoryStore.models = data.models;
      if (data.settings) memoryStore.settings = data.settings;
      memoryStore.chatSessions = []; // Always keep chatSessions empty in memory store
      console.log('[Memory DB] Restored data from local backup file.');
    } catch (e) {
      console.error('[Memory DB] Backup file read error:', e.message);
    }
  }

  const adminEmail = 'zihanfakir@gmail.com';
  let admin = memoryStore.users.find(u => u.email === adminEmail);
  if (!admin) {
    const hashedPassword = await bcrypt.hash('123456', 10);
    admin = {
      _id: 'user_admin_zihan',
      name: 'Zihan Fakir',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      is_blocked: false,
      subscription: { plan_name: 'Max', starts_at: new Date(), expires_at: null, is_active: true },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.users.push(admin);
    console.log('[Memory DB] Created default Admin (zihanfakir@gmail.com / Pass: 123456)');
  }
  saveBackup();
};
seedDefaultAdmin();

module.exports = { memoryStore, debouncedSave, saveBackup };



