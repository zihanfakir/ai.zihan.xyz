const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = 'অতিরিক্ত অনুরোধ করা হয়েছে, অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
} = {}) => {
  const localStore = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of localStore.entries()) {
      if (now > record.resetTime) {
        localStore.delete(key);
      }
    }
  }, Math.max(windowMs, 60 * 1000));
  if (cleanup.unref) cleanup.unref();

  return (req, res, next) => {
    const vercelIp = req.headers['x-real-ip'] || req.headers['x-vercel-forwarded-for'];
    const xff = req.headers['x-forwarded-for'];
    // X-Forwarded-For can be spoofed. In Vercel/AWS, the true IP is often appended last, or better, use x-real-ip.
    let resolvedIp = req.socket?.remoteAddress || req.ip || '127.0.0.1';
    if (vercelIp) resolvedIp = Array.isArray(vercelIp) ? vercelIp[0] : vercelIp.split(',')[0].trim();
    else if (xff) {
      const parts = Array.isArray(xff) ? xff[0].split(',') : xff.split(',');
      resolvedIp = parts[parts.length - 1].trim(); // Get the last appended IP (the real one added by the trusted proxy)
    }
    const rawIp = resolvedIp;
    const cleanIp = String(rawIp).replace(/^::ffff:/, '');
    const prefix = req.baseUrl || req.route?.path || 'rate';
    const key = `${prefix}:${cleanIp}`;
    const now = Date.now();

    // Prevent memory bloat under spoofed IP floods
    if (localStore.size > 5000) {
      for (const [k, r] of localStore.entries()) {
        if (now > r.resetTime) localStore.delete(k);
      }
      if (localStore.size > 5000) localStore.clear();
    }

    let record = localStore.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      localStore.set(key, record);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (record.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({ success: false, error: message });
    }

    next();
  };
};

module.exports = { createRateLimiter };
