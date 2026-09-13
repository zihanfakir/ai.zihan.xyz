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

AiModelSchema.index({ order: 1 });

AiModelSchema.statics.seedDefaultModels = async function() {
  const count = await this.countDocuments();
  if (count === 0) {
    await this.create([
      { model_id: "openrouter/free", name: "Alo Go", provider: "Alokpoth", type: "openrouter", premium: false, efficient: false, order: 1 },
      { model_id: "gemini-3.5-flash-lite", name: "Alo Flash", provider: "Alokpoth", type: "gemini", premium: false, efficient: false, order: 2 },
      { model_id: "hy3", name: "Alo HY3", provider: "Alokpoth", type: "bai", premium: false, efficient: false, order: 3 },
      { model_id: "mimo-v2.5", name: "Alo Mimo", provider: "Alokpoth", type: "bai", premium: false, efficient: false, order: 4 },
      { model_id: "openai/gpt-oss-120b", name: "Alo Pro", provider: "Alokpoth", type: "groq", premium: true, efficient: false, order: 5 },
      { model_id: "nemotron-ultra-550b", name: "Alo Ultra", provider: "Alokpoth", type: "vyce", premium: true, efficient: false, order: 6 },
      { model_id: "claude-sonnet-4-6", name: "Alo Elite", provider: "Alokpoth", type: "vyce", premium: true, efficient: false, order: 7 },
      { model_id: "gpt-5.6", name: "Alo Max", provider: "Alokpoth", type: "vyce", premium: true, efficient: true, order: 8 }
    ]);
    console.log('[Database Seed] Default AI Models created.');
  }
};

module.exports = mongoose.model('AiModel', AiModelSchema);
