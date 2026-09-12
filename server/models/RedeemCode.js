const mongoose = require('mongoose');

const RedeemCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  plan_name: {
    type: String,
    enum: ['Pro', 'Max'],
    required: true
  },
  duration_days: {
    type: Number,
    default: 30
  },
  is_used: {
    type: Boolean,
    default: false
  },
  used_by: {
    type: mongoose.Schema.Types.Mixed,
    ref: 'User',
    default: null
  },
  used_at: {
    type: Date,
    default: null
  },
  created_by: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Custom reusable code fields
  is_custom: {
    type: Boolean,
    default: false
  },
  max_uses: {
    type: Number,
    default: 1
  },
  use_count: {
    type: Number,
    default: 0
  },
  used_by_list: {
    type: [{
      user_id: mongoose.Schema.Types.Mixed,
      email: String,
      used_at: { type: Date, default: Date.now }
    }],
    default: []
  }
}, { timestamps: true });

// Database indexes for fast querying, sorting, and filtering
RedeemCodeSchema.index({ createdAt: -1 });
RedeemCodeSchema.index({ is_used: 1 });
RedeemCodeSchema.index({ is_custom: 1, is_used: 1 });

module.exports = mongoose.model('RedeemCode', RedeemCodeSchema);
