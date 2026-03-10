const buckets = new Map();

function rateLimit({ windowMs = 60_000, max = 5 }) {
  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    const bucket = buckets.get(key) || [];
    const recent = bucket.filter((ts) => ts > windowStart);
    recent.push(now);
    buckets.set(key, recent);
    if (recent.length > max) {
      return res.status(429).json({ message: 'Too many requests, please try again later' });
    }
    next();
  };
}

module.exports = { rateLimit };
