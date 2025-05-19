import { app } from "./app";
import { config } from "./config";
import { logger } from "./utils/logger";

const server = app.listen(config.port, () => {
  logger.info(
    `🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`
  );
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
