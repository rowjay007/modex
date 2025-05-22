import { app } from "./app";
import { config } from "./config";
import { logger } from "./utils/logger";
import { db } from "./config/database";
import { redis } from "./lib/redis";
import { sql } from "drizzle-orm";

const server = app.listen(config.port, async () => {
  logger.info(
    `🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`
  );
  
  // Check database connection
  try {
    const dbResult = await db.execute(sql`SELECT 1`);
    logger.info('✅ Database connection successful');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
  }
  
  // Check Redis connection
  try {
    const redisResult = await redis.ping();
    if (redisResult === 'PONG') {
      logger.info('✅ Redis connection successful');
    } else {
      logger.error('❌ Redis connection failed: Did not receive expected PONG response');
    }
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
  }
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err: Error) => {
  logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
  logger.error(err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM signal
process.on("SIGTERM", () => {
  logger.info("👋 SIGTERM RECEIVED. Shutting down gracefully");
  server.close(() => {
    logger.info("💥 Process terminated!");
  });
});
