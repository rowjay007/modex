import app from './app';
import { config } from './config/config';
import { testConnection, closeConnection } from './config/database';
import { redisClient } from './config/redis';

const PORT = config.PORT || 3005;

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
      console.log(`💳 Payment Service running on port ${PORT}`);
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
          console.log('Payment Service shut down gracefully');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start Payment Service:', error);
    process.exit(1);
  }
}

startServer();