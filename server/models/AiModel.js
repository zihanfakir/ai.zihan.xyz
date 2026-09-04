const mongoose = require('mongoose');

const AiModelSchema = new mongoose.Schema({
  model_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  provider: { type: String, default: 'Alokpoth' },
  type: { type: String, default: 'custom' },
  base_url: { type: String, default: '' },
  api_key: { type: String, default: '' },
  premium: { type: Boolean, default: false },
  efficient: { type: Boolean, default: false },
  order: { type: Number, default: 0 }
}, { timestamps: true });

AiModelSchema.statics.seedDefaultModels = async function() {
  const count = await this.countDocuments();
  if (count === 0) {
    await this.create([
      { model_id: "openrouter/free", name: "Alo Go", provider: "Alokpoth", type: "openrouter", premium: false, efficient: false, order: 1 },
      { model_id: "gemini-1.5-flash", name: "Alo Flash", provider: "Alokpoth", type: "gemini", premium: false, efficient: false, order: 2 },
      { model_id: "llama-3.3-70b-versatile", name: "Alo Pro", provider: "Alokpoth", type: "groq", premium: true, efficient: false, order: 3 },
      { model_id: "claude-sonnet-4-6", name: "Alo Elite", provider: "Alokpoth", type: "openrouter", premium: true, efficient: false, order: 4 },
      { model_id: "nemotron-ultra-550b", name: "Alo Ultra", provider: "Alokpoth", type: "openrouter", premium: true, efficient: false, order: 5 },
      { model_id: "nemotron-vision", name: "Alo Vision", provider: "Alokpoth", type: "openrouter", premium: true, efficient: false, order: 6 },
      { model_id: "gpt-5.6", name: "Alo Max", provider: "Alokpoth", type: "openrouter", premium: true, efficient: true, order: 7 },
      { model_id: "mimo-v2.5", name: "Alo Mimo", provider: "Alokpoth", type: "bai", premium: false, efficient: false, order: 8 },
      { model_id: "hy3", name: "Alo HY3", provider: "Alokpoth", type: "bai", premium: false, efficient: false, order: 9 },
      { model_id: "deepseek-v4-flash", name: "Alo DeepSeek Flash", provider: "Alokpoth", type: "bai", premium: false, efficient: false, order: 10 },
      { model_id: "deepseek-v4-flash-vision-exp", name: "Alo DeepSeek Vision", provider: "Alokpoth", type: "bai", premium: true, efficient: false, order: 11 }
    ]);
    console.log('[Database Seed] Default AI Models created.');
  }
};

module.exports = mongoose.model('AiModel', AiModelSchema);
