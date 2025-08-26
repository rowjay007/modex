import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/config';
import paymentRoutes from './routes/paymentRoutes';
import { testConnection } from './config/database';
import { redisClient } from './config/redis';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGINS,
  credentials: true
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use('/webhooks', express.raw({ type: 'application/json' })); // Raw body for webhooks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', paymentRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    await redisClient.connect(); // Test Redis connection
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'payment-service',
      database: dbStatus ? 'connected' : 'disconnected',
      redis: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'payment-service',
      error: 'Service dependencies unavailable'
    });
  }
});

// Ready check endpoint
app.get('/ready', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    if (!dbStatus) {
      throw new Error('Database not ready');
    }
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      service: 'payment-service'
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      service: 'payment-service',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'Modex Payment Service',
    version: '1.0.0',
    description: 'Payment processing service with Stripe integration',
    endpoints: {
      '/api/payments': 'Payment management endpoints',
      '/api/subscriptions': 'Subscription management endpoints',
      '/api/payment-methods': 'Payment methods endpoints',
      '/webhooks/stripe': 'Stripe webhook endpoint'
    },
    documentation: 'https://docs.modex.com/payment-service'
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

export default app;
