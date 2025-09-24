const attempts = new Map();

function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxAttempts = 5;
  const entry = attempts.get(ip) || { fails: [], lastClean: now };
  entry.fails = entry.fails.filter(ts => now - ts < windowMs);
  if (entry.fails.length >= maxAttempts) {
    return res.status(429).json({ error: 'Too many attempts. Try later' });
  }
  req._loginLimiter = entry;
  attempts.set(ip, entry);
  next();
}

function recordLoginFailure(req) {
  const now = Date.now();
  const entry = req._loginLimiter;
  if (entry) {
    entry.fails.push(now);
  }
}

module.exports = { loginRateLimiter, recordLoginFailure };