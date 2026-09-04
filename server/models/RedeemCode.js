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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  used_at: {
    type: Date,
    default: null
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('RedeemCode', RedeemCodeSchema);
