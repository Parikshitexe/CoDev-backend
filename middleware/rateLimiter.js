import rateLimit from 'express-rate-limit';

// Increased rate limiter since we use local Docker now (unlimited free executions)
export const executionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // limit each IP to 15 execution requests per minute
  message: { error: 'Execution limit reached. Please wait a minute before running code again.' }
});
