import express from 'express';
import { executeCode } from '../controllers/executeController.js';
import { executionRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/', executionRateLimiter, executeCode);

export default router;
