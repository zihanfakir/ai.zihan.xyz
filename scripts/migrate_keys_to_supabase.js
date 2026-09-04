// scripts/migrate_keys_to_supabase.js
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in server/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  const backupPath = path.join(__dirname, '..', 'server', 'data', 'memory_backup.json');
  if (!fs.existsSync(backupPath)) {
    console.error('memory_backup.json not found:', backupPath);
    process.exit(1);
  }

  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const models = backup.models || [];

  console.log('Total models in backup: ' + models.length);

  let successCount = 0;
  let skipCount = 0;

  for (const model of models) {
    const modelId = model.id || model.model_id;
    const apiKey = model.api_key;

    if (!modelId) { skipCount++; continue; }
    if (!apiKey || apiKey.trim() === '') {
      console.log('Skip (no api_key): ' + modelId);
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
      console.error('Error saving ' + modelId + ':', error.message);
    } else {
      console.log('Successfully saved to Supabase: ' + modelId);
      successCount++;
    }
  }

  console.log('\nSummary:');
  console.log('Successfully saved: ' + successCount);
  console.log('Skipped: ' + skipCount);
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
