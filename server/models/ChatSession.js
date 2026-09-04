const mongoose = require('mongoose');

const ChatSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  session_id: { type: String, required: true },
  title: { type: String, default: 'নতুন চ্যাট' },
  messagesHistory: { type: Array, default: [] },
  updatedAt: { type: Number, default: Date.now }
}, { timestamps: true });

// Compound index to ensure session_id is unique per user
ChatSessionSchema.index({ user_id: 1, session_id: 1 }, { unique: true });

module.exports = mongoose.model('ChatSession', ChatSessionSchema);
