import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/config';
import analyticsRoutes from './routes/analyticsRoutes';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'analytics-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness check endpoint
app.get('/ready', (req, res) => {
  // Add database and Redis connectivity checks here if needed
  res.status(200).json({
    status: 'ready',
    service: 'analytics-service',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/v1/analytics', analyticsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    error: 'Internal server error',
    message: config.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
  });
});

export default app;
