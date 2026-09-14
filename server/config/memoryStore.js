const bcrypt = require('bcryptjs');

// In-Memory Database Fallback Store for when MongoDB is not running locally
const memoryStore = {
  users: [],
  plans: [
    { name: 'Free', displayName: 'ফ্রি প্ল্যান', message_limit: 10, window_hours: 3, allowed_models: ['gemini-3.6-flash', 'llama-3.3-70b-versatile', 'qwen/qwen3.8-27b', 'gemini-3.5-flash-lite', 'openrouter/free', 'mimo-v2.5', 'hy3'], is_active: true },
    { name: 'Pro', displayName: 'প্রো প্ল্যান', message_limit: 30, window_hours: 3, allowed_models: ['*'], is_active: true },
    { name: 'Max', displayName: 'ম্যাক্স প্ল্যান', message_limit: 50, window_hours: 1, allowed_models: ['*'], is_active: true }
  ],
  redeemCodes: [],
  usageLogs: [],
  models: [
      { id: "gemini-3.6-flash", model_id: "gemini-3.6-flash", name: "Alo Flash", provider: "Alokpoth AI", base_url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent", api_key: process.env.GEMINI_API_KEY, premium: false, efficient: false, order: 1, type: "gemini" },
      { id: "llama-3.3-70b-versatile", model_id: "llama-3.3-70b-versatile", name: "Alo Pro", provider: "Alokpoth AI", base_url: "https://api.groq.com/openai/v1/chat/completions", api_key: process.env.GROQ_API_KEY, premium: false, efficient: false, order: 2, type: "groq" },
      { id: "openai/gpt-oss-120b", model_id: "openai/gpt-oss-120b", name: "Alo Ultra", provider: "Alokpoth AI", base_url: "https://api.groq.com/openai/v1/chat/completions", api_key: process.env.GROQ_API_KEY, premium: true, efficient: false, order: 3, type: "groq" },
      { id: "qwen/qwen3.8-27b", model_id: "qwen/qwen3.8-27b", name: "Alo Plus", provider: "Alokpoth AI", base_url: "https://api.groq.com/openai/v1/chat/completions", api_key: process.env.GROQ_API_KEY, premium: false, efficient: false, order: 4, type: "groq" },
      { id: "gemini-3.5-flash-lite", model_id: "gemini-3.5-flash-lite", name: "Alo Lite", provider: "Alokpoth AI", base_url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent", api_key: process.env.GEMINI_API_KEY, premium: false, efficient: false, order: 5, type: "gemini" },
      { id: "openrouter/free", model_id: "openrouter/free", name: "Alo Core", provider: "Alokpoth AI", base_url: "https://openrouter.ai/api/v1/chat/completions", api_key: process.env.OPENROUTER_API_KEY, premium: false, efficient: false, order: 6, type: "openrouter" },
      { id: "hy3", model_id: "hy3", name: "Alo Vision", provider: "Alokpoth AI", base_url: "https://api.b.ai/v1/chat/completions", api_key: process.env.BAI_API_KEY, premium: false, efficient: false, order: 7, type: "bai" },
      { id: "mimo-v2.5", model_id: "mimo-v2.5", name: "Alo Swift", provider: "Alokpoth AI", base_url: "https://api.b.ai/v1/chat/completions", api_key: process.env.BAI_API_KEY, premium: false, efficient: false, order: 8, type: "bai" }
  ],
  settings: {}
};

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) 
  ? require('os').tmpdir() 
  : path.join(__dirname, '../data');
const BACKUP_FILE = path.join(BACKUP_DIR, 'memory_backup.json');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (e) {}
}

let isSaving = false;
const saveBackup = async () => {
  if (isSaving) {
    debouncedSave();
    return;
  }
  isSaving = true;
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
      // chatSessions purposefully excluded
    };
    const tmpFile = BACKUP_FILE + '.tmp';
    await fs.promises.writeFile(tmpFile, JSON.stringify(backupData, null, 2), 'utf8');
    await fs.promises.rename(tmpFile, BACKUP_FILE);
  } catch (err) {
    if (err.code !== 'EROFS' && err.code !== 'ENOENT') {
      console.error('[MemoryStore Backup Error]:', err.message);
    }
  } finally {
    isSaving = false;
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
      if (Array.isArray(data.users)) memoryStore.users = data.users;
      if (Array.isArray(data.plans)) memoryStore.plans = data.plans;
      if (Array.isArray(data.redeemCodes)) memoryStore.redeemCodes = data.redeemCodes;
      if (Array.isArray(data.models)) memoryStore.models = data.models;
      if (data.settings && typeof data.settings === 'object') memoryStore.settings = data.settings;
      console.log('[Memory DB] Restored data from local backup file.');
    } catch (e) {
      console.error('[Memory DB] Backup file read error:', e.message);
    }
  }

  const adminEmails = ['zihanfakir@gmail.com', 'x@zihan.uk'];
  for (const adminEmail of adminEmails) {
    let admin = memoryStore.users.find(u => u.email && u.email.toLowerCase().trim() === adminEmail);
    if (!admin) {
      const hashedPassword = await bcrypt.hash('123456', 10);
      admin = {
        _id: 'user_admin_' + adminEmail.split('@')[0],
        name: adminEmail === 'x@zihan.uk' ? 'Zihan' : 'Zihan Fakir',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        is_blocked: false,
        subscription: { plan_name: 'Max', starts_at: new Date(), expires_at: null, is_active: true },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memoryStore.users.push(admin);
      console.log(`[Memory DB] Created default Admin (${adminEmail} / Pass: 123456)`);
    } else {
      admin.role = 'admin';
      admin.subscription = { plan_name: 'Max', starts_at: new Date(), expires_at: null, is_active: true };
    }
  }
  saveBackup();
};
seedDefaultAdmin();

module.exports = { memoryStore, debouncedSave, saveBackup };



