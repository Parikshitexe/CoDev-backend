const WINDOW_MS = 30000; // 30 seconds
const MAX_REQUESTS = 5; // 5 executions max per window

const ipMap = new Map();

// Periodic cleanup to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipMap.entries()) {
    const validTimestamps = data.timestamps.filter(time => now - time < WINDOW_MS);
    if (validTimestamps.length === 0) {
      ipMap.delete(ip);
    } else {
      ipMap.set(ip, { ...data, timestamps: validTimestamps });
    }
  }
}, 60000); // Clean up every minute

export const executionRateLimiter = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'unknown';
  const now = Date.now();

  if (!ipMap.has(ip)) {
    ipMap.set(ip, { timestamps: [now] });
    return next();
  }

  const data = ipMap.get(ip);
  // Filter timestamps within the current window
  const validTimestamps = data.timestamps.filter(time => now - time < WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS) {
    const oldestTimestamp = validTimestamps[0];
    const msRemaining = WINDOW_MS - (now - oldestTimestamp);
    const secondsRemaining = Math.ceil(msRemaining / 1000);

    return res.status(429).json({
      error: `Too many code executions. Please wait ${secondsRemaining}s before running code again.`
    });
  }

  validTimestamps.push(now);
  ipMap.set(ip, { timestamps: validTimestamps });
  next();
};
