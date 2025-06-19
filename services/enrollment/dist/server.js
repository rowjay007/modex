"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const database_1 = require("./config/database");
const PORT = process.env.PORT || 3002;
const startServer = async () => {
    try {
        console.log('🔵 Initializing services...');
        await (0, database_1.connectToDatabase)();
        console.log('✅ Services initialized successfully.');
        const server = app_1.default.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
            console.log(`📚 API Documentation available at http://localhost:${PORT}/docs`);
        });
        const gracefulShutdown = (signal) => {
            console.log(`
${signal} received. Shutting down gracefully...`);
            server.close(() => {
                console.log('🔴 Server closed.');
                // Add any cleanup logic here (e.g., close db connection)
                process.exit(0);
            });
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
    catch (error) {
        console.error('🔴 Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
