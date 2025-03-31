import { NodeSDK } from '@opentelemetry/sdk-node';
import * as Sentry from '@sentry/node';
import { Redis } from '@upstash/redis';
import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { connect } from 'nats';
import swaggerUi from 'swagger-ui-express';

// Load environment variables
config();

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// Initialize Redis
export const redis = new Redis({
  url: process.env.REDIS_URL || '',
  token: process.env.REDIS_TOKEN || '',
});

// Initialize NATS
export const nats = await connect({
  servers: process.env.NATS_URL || 'nats://localhost:4222',
});

// Initialize OpenTelemetry
const sdk = new NodeSDK();
sdk.start();

// Initialize Express app
const app = express();

// Middleware
app.use(Sentry.Handlers.requestHandler());
app.use(express.json());
app.use(cors());
app.use(helmet());

// Routes
import userRoutes from './routes/userRoutes';
app.use('/api/users', userRoutes);

// Swagger documentation
if (process.env.NODE_ENV === 'development') {
  const swaggerDocument = require('../docs/swagger.json');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Error handling
app.use(Sentry.Handlers.errorHandler());
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.warn(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.warn('SIGTERM received. Shutting down...');
  await nats.close();
  await redis.close();
  sdk.shutdown();
  process.exit(0);
});