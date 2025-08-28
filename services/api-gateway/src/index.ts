import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config/config';
import { logger } from './utils/logger';
import { setupRoutes } from './routes';
import { setupMiddleware } from './middleware';
import { createPrometheusMetrics } from './middleware/metrics';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGINS,
  credentials: true
}));
app.use(compression());

// Logging
app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } }));

// Metrics
app.use(createPrometheusMetrics());

// Setup middleware and routes
setupMiddleware(app);
setupRoutes(app);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'api-gateway'
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.headers['x-request-id']
  });
});

const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
});

export default app;