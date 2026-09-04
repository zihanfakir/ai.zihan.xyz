// Zero-dependency IP Rate Limiter for DDoS and Brute Force Protection
const rateLimits = new Map();

// Periodic cleanup of expired records every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimits.entries()) {
    if (now > record.resetTime) {
      rateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (cleanupTimer.unref) cleanupTimer.unref();

const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = 'অতিরিক্ত অনুরোধ করা হয়েছে, অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
} = {}) => {
  return (req, res, next) => {
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';
    const cleanIp = String(rawIp).replace(/^::ffff:/, '');
    const prefix = req.baseUrl || req.path || 'rate';
    const key = `${prefix}:${cleanIp}`;
    const now = Date.now();

    let record = rateLimits.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimits.set(key, record);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (record.count > max) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({ success: false, error: message });
    }

    next();
  };
};

module.exports = { createRateLimiter };
