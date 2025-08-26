import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends express.Request {
  user?: any;
}

export const authenticateToken = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied. No token provided.',
      requestId: req.headers['x-request-id']
    });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Invalid token attempt', { 
      requestId: req.headers['x-request-id'],
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(403).json({ 
      error: 'Invalid token.',
      requestId: req.headers['x-request-id']
    });
  }
};

export const optionalAuth = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    logger.debug('Optional auth failed', { error });
  }
  
  next();
};
