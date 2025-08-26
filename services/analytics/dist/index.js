"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config/config");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const PORT = config_1.config.PORT || 3006;
async function startServer() {
    try {
        // Test database connection
        const dbConnected = await (0, database_1.testConnection)();
        if (!dbConnected) {
            console.error('Failed to connect to database');
            process.exit(1);
        }
        // Connect to Redis
        await redis_1.redisClient.connect();
        console.log('Redis connected successfully');
        // Start server
        const server = app_1.default.listen(PORT, () => {
            console.log(`📊 Analytics Service running on port ${PORT}`);
            console.log(`Environment: ${config_1.config.NODE_ENV}`);
            console.log(`Database: Connected`);
            console.log(`Redis: Connected`);
        });
        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            console.log(`\n${signal} received. Starting graceful shutdown...`);
            server.close(async () => {
                try {
                    await (0, database_1.closeConnection)();
                    await redis_1.redisClient.disconnect();
                    console.log('✅ Analytics Service shut down gracefully');
                    process.exit(0);
                }
                catch (error) {
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
    }
    catch (error) {
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
