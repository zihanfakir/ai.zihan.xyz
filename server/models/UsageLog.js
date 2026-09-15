const mongoose = require('mongoose');

const UsageLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    index: true
  },
  model_id: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// High-Performance Compound Indexes:
// 1. Fully covered index for message rate limit counts & oldest log lookups
UsageLogSchema.index({ user_id: 1, model_id: 1, timestamp: 1 });

// 2. High-speed user timestamp range query index
UsageLogSchema.index({ user_id: 1, timestamp: 1, model_id: 1 });
UsageLogSchema.index({ user_id: 1, timestamp: -1 });

// 3. TTL index to auto-purge logs older than 14 days (keeps DB lean and working set in RAM)
UsageLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

module.exports = mongoose.model('UsageLog', UsageLogSchema);

