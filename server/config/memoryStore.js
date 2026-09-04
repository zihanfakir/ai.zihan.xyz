const bcrypt = require('bcryptjs');

// In-Memory Database Fallback Store for when MongoDB is not running locally
const memoryStore = {
  users: [],
  plans: [
    { name: 'Free', displayName: 'ফ্রি প্ল্যান', message_limit: 10, window_hours: 3, allowed_models: ['openrouter/free', 'gemini-1.5-flash'], is_active: true },
    { name: 'Pro', displayName: 'প্রো প্ল্যান', message_limit: 30, window_hours: 3, allowed_models: ['*'], is_active: true },
    { name: 'Max', displayName: 'ম্যাক্স প্ল্যান', message_limit: 50, window_hours: 1, allowed_models: ['*'], is_active: true }
  ],
  redeemCodes: [],
  usageLogs: [],
  models: [
      { id: "openrouter/free", name: "Alo Go", provider: "Alokpoth", base_url: "https://openrouter.ai/api/v1/chat/completions", api_key: process.env.OPENROUTER_API_KEY, premium: false, efficient: false, order: 1 },
      { id: "gemini-1.5-flash", name: "Alo Flash", provider: "Alokpoth", base_url: "https://openrouter.ai/api/v1/chat/completions", api_key: process.env.OPENROUTER_API_KEY, premium: false, efficient: false, order: 2 },
      { id: "llama-3.3-70b-versatile", name: "Alo Pro", provider: "Alokpoth", base_url: "https://api.groq.com/openai/v1/chat/completions", api_key: process.env.GROQ_API_KEY, premium: true, efficient: false, order: 3 },
      { id: "claude-sonnet-4-6", name: "Alo Elite", provider: "Alokpoth", base_url: "https://vyceai.com/v1/chat/completions", api_key: process.env.VYCE_API_KEY, premium: true, efficient: false, order: 4 },
      { id: "nemotron-ultra-550b", name: "Alo Ultra", provider: "Alokpoth", base_url: "https://vyceai.com/v1/chat/completions", api_key: process.env.VYCE_API_KEY, premium: true, efficient: false, order: 5 },
      { id: "nemotron-vision", name: "Alo Vision", provider: "Alokpoth", base_url: "https://vyceai.com/v1/chat/completions", api_key: process.env.VYCE_API_KEY, premium: true, efficient: false, order: 6 },
      { id: "gpt-5.6", name: "Alo Max", provider: "Alokpoth", base_url: "https://vyceai.com/v1/chat/completions", api_key: process.env.VYCE_API_KEY, premium: true, efficient: true, order: 7 },
      { id: "mimo-v2.5", name: "Alo Mimo", provider: "Alokpoth", base_url: "https://api.b.ai/v1/chat/completions", api_key: process.env.BAI_API_KEY, premium: false, efficient: false, order: 8 },
      { id: "hy3", name: "Alo HY3", provider: "Alokpoth", base_url: "https://api.b.ai/v1/chat/completions", api_key: process.env.BAI_API_KEY, premium: false, efficient: false, order: 9 },
      { id: "deepseek-v4-flash", name: "Alo DeepSeek Flash", provider: "Alokpoth", base_url: "https://api.b.ai/v1/chat/completions", api_key: process.env.BAI_API_KEY, premium: false, efficient: false, order: 10 },
      { id: "deepseek-v4-flash-vision-exp", name: "Alo DeepSeek Vision", provider: "Alokpoth", base_url: "https://api.b.ai/v1/chat/completions", api_key: process.env.BAI_API_KEY, premium: true, efficient: false, order: 11 }
  ]
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
    const backupData = {
      users: memoryStore.users,
      plans: memoryStore.plans,
      redeemCodes: memoryStore.redeemCodes,
      usageLogs: memoryStore.usageLogs,
      models: memoryStore.models,
      chatSessions: memoryStore.chatSessions || []
    };
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2), 'utf8');
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
      if (data.chatSessions && data.chatSessions.length) memoryStore.chatSessions = data.chatSessions;
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



