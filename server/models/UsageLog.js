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

// Compound index for lightning-fast rate limit queries and reset time calculations
UsageLogSchema.index({ user_id: 1, timestamp: 1 });

// TTL index to automatically purge old logs older than 90 days (prevents infinite DB storage growth)
UsageLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('UsageLog', UsageLogSchema);
