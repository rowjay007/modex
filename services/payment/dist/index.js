"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config/config");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const PORT = config_1.config.PORT || 3005;
async function startServer() {
    try {
        const dbConnected = await (0, database_1.testConnection)();
        if (!dbConnected) {
            console.error('Failed to connect to database');
            process.exit(1);
        }
        await redis_1.redisClient.connect();
        console.log('Redis connected successfully');
        const server = app_1.default.listen(PORT, () => {
            console.log(`💳 Payment Service running on port ${PORT}`);
            console.log(`Environment: ${config_1.config.NODE_ENV}`);
            console.log(`Database: Connected`);
            console.log(`Redis: Connected`);
        });
        const gracefulShutdown = async (signal) => {
            console.log(`\n${signal} received. Starting graceful shutdown...`);
            server.close(async () => {
                try {
                    await (0, database_1.closeConnection)();
                    await redis_1.redisClient.disconnect();
                    console.log('Payment Service shut down gracefully');
                    process.exit(0);
                }
                catch (error) {
                    console.error('Error during shutdown:', error);
                    process.exit(1);
                }
            });
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
    catch (error) {
        console.error('Failed to start Payment Service:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map