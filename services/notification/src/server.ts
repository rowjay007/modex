import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { db, sql } from './config/database';
import { notificationService } from './services/notificationService';

// Initialize database connections and services on startup
async function initializeServices() {
  try {
    // Verify database connection
    await sql`SELECT 1`;
    logger.info('🔌 Database connection established');
    
    // Initialize notification service
    await notificationService.initialize();
    logger.info('📨 Notification service initialized');
    
    // Initialize any other required services here
    logger.info('✅ All services initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize services', { error });
    process.exit(1);
  }
}

// Start the server
const server = app.listen(config.port, async () => {
  await initializeServices();
  logger.info(`🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`);
  logger.info(`📚 API Documentation available at http://localhost:${config.port}/docs`);
  
  // For nodemon restart detection
  if (process.env.NODE_ENV === 'development') {
    logger.info('🔄 Nodemon: Watching for file changes...');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('💥 UNHANDLED REJECTION! Shutting down...', { error: err });
  console.error(err);
  
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM signal
process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received. Shutting down gracefully');
  server.close(() => {
    logger.info('👋 Process terminated!');
  });
});

// Handle nodemon restart
process.once('SIGUSR2', () => {
  logger.info('🔄 Nodemon restart detected');
  server.close(() => {
    process.kill(process.pid, 'SIGUSR2');
  });
});

export default server;
