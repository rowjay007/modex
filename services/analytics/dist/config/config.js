"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    // Server configuration
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3006', 10),
    // Database configuration
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/modex_analytics',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
    DB_NAME: process.env.DB_NAME || 'modex_analytics',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || 'password',
    DB_SSL: process.env.DB_SSL === 'true',
    // Redis configuration
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    // JWT configuration
    JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    // CORS configuration
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    // Rate limiting
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    // Analytics specific configuration
    BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '100', 10),
    FLUSH_INTERVAL: parseInt(process.env.FLUSH_INTERVAL || '5000', 10), // 5 seconds
    RETENTION_DAYS: parseInt(process.env.RETENTION_DAYS || '365', 10),
    // Service URLs for inter-service communication
    USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    COURSE_SERVICE_URL: process.env.COURSE_SERVICE_URL || 'http://localhost:3002',
    ENROLLMENT_SERVICE_URL: process.env.ENROLLMENT_SERVICE_URL || 'http://localhost:3003',
    ASSESSMENT_SERVICE_URL: process.env.ASSESSMENT_SERVICE_URL || 'http://localhost:3004',
    PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005',
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
exports.default = exports.config;
