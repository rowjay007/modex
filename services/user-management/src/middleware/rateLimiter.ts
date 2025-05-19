import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';

export const createRateLimiter = (
  prefix: string,
  maxRequests: number,
  windowMs: number
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip;
    const key = `${prefix}:${ip}`;

    try {
      const requests = await redis.incr(key);
      
      if (requests === 1) {
        await redis.expire(key, Math.floor(windowMs / 1000));
      }

      if (requests > maxRequests) {
        res.status(429).json({
          status: 'error',
          message: 'Too many requests, please try again later'
        });
        return;
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requests));

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // If Redis fails, allow the request to proceed
      next();
    }
  };
};

// Rate limiters for different endpoints
export const authRateLimiter = createRateLimiter('auth', 5, 15 * 60 * 1000); // 5 requests per 15 minutes
export const emailVerificationLimiter = createRateLimiter('email-verify', 3, 60 * 60 * 1000); // 3 requests per hour
export const passwordResetLimiter = createRateLimiter('password-reset', 3, 60 * 60 * 1000); // 3 requests per hour