// scripts/migrate_keys_to_supabase.js
// বর্তমান memory_backup.json থেকে api_key গুলো Supabase এ এককালীন migrate করার script।
// Run: node scripts/migrate_keys_to_supabase.js

require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL এবং SUPABASE_SERVICE_ROLE_KEY server/.env ফাইলে সেট করুন।');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  // memory_backup.json থেকে মডেল লোড করা
  const backupPath = path.join(__dirname, '..', 'server', 'data', 'memory_backup.json');
  if (!fs.existsSync(backupPath)) {
    console.error('memory_backup.json পাওয়া যায়নি:', backupPath);
    process.exit(1);
  }

  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const models = backup.models || [];

  console.log(মোট  টি মডেল পাওয়া গেছে।\n);

  let successCount = 0;
  let skipCount = 0;

  for (const model of models) {
    const modelId = model.id || model.model_id;
    const apiKey = model.api_key;

    if (!modelId) { skipCount++; continue; }
    if (!apiKey || apiKey.trim() === '') {
      console.log(⏭️  Skip:  (api_key নেই));
      skipCount++;
      continue;
    }

    const { error } = await supabase
      .from('api_keys')
      .upsert(
        { model_id: modelId, api_key: apiKey, updated_at: new Date().toISOString() },
        { onConflict: 'model_id' }
      );

    if (error) {
      console.error(❌ Error:  →, error.message);
    } else {
      console.log(✅ Saved: );
      successCount++;
    }
  }

  console.log(\n✅ সফলভাবে সেভ হয়েছে:  টি);
  console.log(⏭️  Skip করা হয়েছে:  টি);
  console.log('\nMigration সম্পন্ন! এখন memory_backup.json থেকে api_key গুলো মুছে ফেলা নিরাপদ।');
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
