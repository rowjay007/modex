import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config/config';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { metricsHandler } from '../middleware/metrics';
import logger from '../utils/logger';

interface AuthenticatedRequest extends express.Request {
  user?: any;
}

export const setupRoutes = (app: express.Application) => {
  // Metrics endpoint
  app.get('/metrics', metricsHandler);

  // Service proxy routes with authentication
  
  // User Management Service - Authentication required
  app.use('/api/users', authenticateToken as any, createProxyMiddleware({
    target: config.SERVICES.USER_MANAGEMENT,
    changeOrigin: true,
    pathRewrite: { '^/api/users': '' },
    onError: (err: any, req: any, res: any) => {
      logger.error('User Management Service proxy error:', err);
      res.status(503).json({ error: 'User Management Service unavailable' });
    }
  }));

  // Auth routes - No authentication required
  app.use('/api/auth', createProxyMiddleware({
    target: config.SERVICES.USER_MANAGEMENT,
    changeOrigin: true,
    pathRewrite: { '^/api/auth': '/auth' },
    onError: (err: any, req: any, res: any) => {
      logger.error('Auth Service proxy error:', err);
      res.status(503).json({ error: 'Auth Service unavailable' });
    }
  }));

  // Content Delivery Service - Optional authentication
  app.use('/api/content', optionalAuth as any, createProxyMiddleware({
    target: config.SERVICES.CONTENT_DELIVERY,
    changeOrigin: true,
    pathRewrite: { '^/api/content': '' },
    onError: (err: any, req: any, res: any) => {
      logger.error('Content Delivery Service proxy error:', err);
      res.status(503).json({ error: 'Content Delivery Service unavailable' });
    }
  }));

  // Course Management Service - Authentication required for modifications
  app.use('/api/courses', (req: any, res: any, next: any) => {
    if (req.method === 'GET') {
      optionalAuth(req, res, next);
    } else {
      authenticateToken(req, res, next);
    }
  }, createProxyMiddleware({
    target: config.SERVICES.COURSE_MANAGEMENT,
    changeOrigin: true,
    pathRewrite: { '^/api/courses': '' },
    onError: (err: any, req: any, res: any) => {
      logger.error('Course Management Service proxy error:', err);
      res.status(503).json({ error: 'Course Management Service unavailable' });
    }
  }));

  // Enrollment Service - Authentication required
  app.use('/api/enrollments', authenticateToken as any, createProxyMiddleware({
    target: config.SERVICES.ENROLLMENT,
    changeOrigin: true,
    pathRewrite: { '^/api/enrollments': '' },
    onError: (err: any, req: any, res: any) => {
      logger.error('Enrollment Service proxy error:', err);
      res.status(503).json({ error: 'Enrollment Service unavailable' });
    }
  }));

  // Assessment Service - Authentication required
  app.use('/api/assessments', authenticateToken as any, createProxyMiddleware({
    target: config.SERVICES.ASSESSMENT,
    changeOrigin: true,
    pathRewrite: { '^/api/assessments': '' },
    onError: (err: any, req: any, res: any) => {
      logger.error('Assessment Service proxy error:', err);
      res.status(503).json({ error: 'Assessment Service unavailable' });
    }
  }));

  // Payment Service - Authentication required
  app.use('/api/payments', authenticateToken as any, createProxyMiddleware({
    target: config.SERVICES.PAYMENT,
    changeOrigin: true,
    pathRewrite: { '^/api/payments': '' },
    onError: (err: any, req: any, res: any) => {
      logger.error('Payment Service proxy error:', err);
      res.status(503).json({ error: 'Payment Service unavailable' });
    }
  }));

  // Analytics Service - Authentication required (admin/instructor only)
  app.use('/api/analytics', authenticateToken as any, createProxyMiddleware({
    target: config.SERVICES.ANALYTICS,
    changeOrigin: true,
    pathRewrite: { '^/api/analytics': '' },
    onError: (err: any, req: any, res: any) => {
      logger.error('Analytics Service proxy error:', err);
      res.status(503).json({ error: 'Analytics Service unavailable' });
    }
  }));

  // Notification Service - Authentication required
  app.use('/api/notifications', authenticateToken as any, createProxyMiddleware({
    target: config.SERVICES.NOTIFICATION,
    changeOrigin: true,
    pathRewrite: { '^/api/notifications': '' },
    onError: (err: any, req: any, res: any) => {
      logger.error('Notification Service proxy error:', err);
      res.status(503).json({ error: 'Notification Service unavailable' });
    }
  }));

  // API documentation
  app.get('/api', (req, res) => {
    res.json({
      service: 'Modex API Gateway',
      version: '1.0.0',
      endpoints: {
        '/api/auth': 'Authentication endpoints',
        '/api/users': 'User management endpoints',
        '/api/content': 'Content delivery endpoints',
        '/api/courses': 'Course management endpoints',
        '/api/enrollments': 'Enrollment endpoints',
        '/api/assessments': 'Assessment endpoints',
        '/api/payments': 'Payment endpoints',
        '/api/analytics': 'Analytics endpoints',
        '/api/notifications': 'Notification endpoints'
      }
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      path: req.originalUrl,
      requestId: req.headers['x-request-id']
    });
  });
};
