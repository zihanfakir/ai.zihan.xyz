// DEPRECATED & INACTIVE:
// Per user privacy and data retention policy, chat sessions are strictly maintained client-side 
// on the user's device (browser localStorage) and are NEVER saved or persisted to MongoDB or Supabase.
// This schema is retained only for historical backwards compatibility and is not actively written to.

const mongoose = require('mongoose');

const ChatSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  session_id: { type: String, required: true },
  title: { type: String, default: 'নতুন চ্যাট' },
  messagesHistory: { type: Array, default: [] },
  updatedAt: { type: Number, default: Date.now }
}, { timestamps: true });

ChatSessionSchema.index({ user_id: 1, session_id: 1 }, { unique: true });
ChatSessionSchema.index({ user_id: 1, updatedAt: -1 });

module.exports = mongoose.model('ChatSession', ChatSessionSchema);
