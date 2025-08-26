import app from './app';
import { config } from './config/config';
import { testConnection, closeConnection } from './config/database';
import { redisClient } from './config/redis';

const PORT = config.PORT || 3006;

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database');
      process.exit(1);
    }

    // Connect to Redis
    await redisClient.connect();
    console.log('Redis connected successfully');

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`📊 Analytics Service running on port ${PORT}`);
      console.log(`Environment: ${config.NODE_ENV}`);
      console.log(`Database: Connected`);
      console.log(`Redis: Connected`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        try {
          await closeConnection();
          await redisClient.disconnect();
          console.log('✅ Analytics Service shut down gracefully');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start Analytics Service:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();