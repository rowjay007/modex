"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000'),
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    SERVICES: {
        USER_MANAGEMENT: process.env.USER_MANAGEMENT_URL || 'http://localhost:3001',
        CONTENT_DELIVERY: process.env.CONTENT_DELIVERY_URL || 'http://localhost:3002',
        COURSE_MANAGEMENT: process.env.COURSE_MANAGEMENT_URL || 'http://localhost:3003',
        ENROLLMENT: process.env.ENROLLMENT_URL || 'http://localhost:3004',
        ASSESSMENT: process.env.ASSESSMENT_URL || 'http://localhost:3005',
        PAYMENT: process.env.PAYMENT_URL || 'http://localhost:3006',
        ANALYTICS: process.env.ANALYTICS_URL || 'http://localhost:3007',
        NOTIFICATION: process.env.NOTIFICATION_URL || 'http://localhost:3008'
    }
};
//# sourceMappingURL=config.js.map