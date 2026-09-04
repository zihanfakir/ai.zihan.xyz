const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ['Free', 'Pro', 'Max'],
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  message_limit: {
    type: Number,
    required: true
  },
  window_hours: {
    type: Number,
    required: true
  },
  allowed_models: [{
    type: String
  }],
  is_active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Seed default plans if not existing
PlanSchema.statics.seedDefaultPlans = async function() {
  const count = await this.countDocuments();
  if (count === 0) {
    await this.create([
      {
        name: 'Free',
        displayName: 'ফ্রি প্ল্যান',
        message_limit: 10,
        window_hours: 3,
        allowed_models: ['openrouter/free', 'gemini-1.5-flash']
      },
      {
        name: 'Pro',
        displayName: 'প্রো প্ল্যান',
        message_limit: 30,
        window_hours: 3,
        allowed_models: ['*']
      },
      {
        name: 'Max',
        displayName: 'ম্যাক্স প্ল্যান',
        message_limit: 50,
        window_hours: 1,
        allowed_models: ['*']
      }
    ]);
    console.log('[Database Seed] Default subscription plans created (Free, Pro, Max).');
  }
};

module.exports = mongoose.model('Plan', PlanSchema);
