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
    PORT: parseInt(process.env.PORT || '3005'),
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/modex_payment',
    DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/modex_payment',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    JWT_SECRET: process.env.JWT_SECRET || 'payment-service-secret-key',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
    CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    SERVICES: {
        API_GATEWAY: process.env.API_GATEWAY_URL || 'http://localhost:3000',
        USER_MANAGEMENT: process.env.USER_MANAGEMENT_URL || 'http://localhost:3001',
        COURSE_MANAGEMENT: process.env.COURSE_MANAGEMENT_URL || 'http://localhost:3002',
        ENROLLMENT: process.env.ENROLLMENT_URL || 'http://localhost:3003',
    },
    WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL || 'http://localhost:3005/webhooks',
    CURRENCY: process.env.DEFAULT_CURRENCY || 'usd',
    PAYMENT_TIMEOUT: parseInt(process.env.PAYMENT_TIMEOUT || '1800'),
    SUBSCRIPTION_TRIAL_DAYS: parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS || '7'),
};
//# sourceMappingURL=config.js.map