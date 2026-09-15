const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.Mixed,
    default: () => new mongoose.Types.ObjectId()
  },
  avatar: {
    type: String,
    default: 'default'
  },
  name: {
    type: String,
    required: [true, 'নাম প্রদান করুন'],
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: [true, 'ইমেইল প্রদান করুন'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'সঠিক ইমেইল ঠিকানা প্রদান করুন']
  },
  password: {
    type: String,
    required: [true, 'পাসওয়ার্ড প্রদান করুন'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  is_blocked: {
    type: Boolean,
    default: false
  },
  subscription: {
    plan_name: {
      type: String,
      enum: ['Free', 'Pro', 'Max'],
      default: 'Free'
    },
    starts_at: {
      type: Date,
      default: Date.now
    },
    expires_at: {
      type: Date,
      default: null
    },
    is_active: {
      type: Boolean,
      default: true
    }
  }
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Database indexes for fast querying, sorting, and user lookups
UserSchema.index({ role: 1, is_blocked: 1 });
UserSchema.index({ 'subscription.plan_name': 1, 'subscription.expires_at': 1 });
UserSchema.index({ createdAt: -1, _id: 1 });

module.exports = mongoose.model('User', UserSchema);