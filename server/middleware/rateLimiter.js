const createRateLimiter = ({ windowMs = 60 * 1000, max = 30, message } = {}) => {
  const hitsByKey = new Map();

  return (req, res, next) => {
    const key = String(req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown');
    const now = Date.now();
    const entry = hitsByKey.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count += 1;
    hitsByKey.set(key, entry);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return res.status(429).json({ message: message || 'Too many requests, please try again later.' });
    }

    next();
  };
};

module.exports = { createRateLimiter };
