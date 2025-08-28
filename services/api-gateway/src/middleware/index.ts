import express from 'express';
import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/config';
import { logger } from '../utils/logger';

// Redis client for rate limiting
const redisClient = createClient({ url: config.REDIS_URL });
redisClient.connect().catch((err) => logger.error('Redis connection error:', err));

// Request ID middleware
export const requestId = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  res.set('x-request-id', req.headers['x-request-id'] as string);
  next();
};

// Rate limiting middleware
export const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// JSON parsing middleware
export const jsonParser = express.json({ limit: '10mb' });
export const urlencodedParser = express.urlencoded({ extended: true, limit: '10mb' });

export const setupMiddleware = (app: express.Application) => {
  // Apply middleware in order
  app.use(requestId);
  app.use(rateLimiter);
  app.use(jsonParser);
  app.use(urlencodedParser);
};
