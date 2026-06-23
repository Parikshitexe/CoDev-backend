import rateLimit from 'express-rate-limit';

// Very strict rate limiter to protect the 20/day JDoodle API quota
export const executionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 execution requests per hour
  message: { error: 'Execution limit reached. To conserve our 20/day quota, you can only run code 3 times per hour.' }
});
