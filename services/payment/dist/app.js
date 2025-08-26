"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = require("./config/config");
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_1.config.CORS_ORIGINS,
    credentials: true
}));
app.use((0, compression_1.default)());
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.RATE_LIMIT_WINDOW,
    max: config_1.config.RATE_LIMIT_MAX,
    message: {
        error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
app.use('/webhooks', express_1.default.raw({ type: 'application/json' }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
app.use('/api', paymentRoutes_1.default);
app.get('/health', async (req, res) => {
    try {
        const dbStatus = await (0, database_1.testConnection)();
        await redis_1.redisClient.connect();
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            service: 'payment-service',
            database: dbStatus ? 'connected' : 'disconnected',
            redis: 'connected'
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            service: 'payment-service',
            error: 'Service dependencies unavailable'
        });
    }
});
app.get('/ready', async (req, res) => {
    try {
        const dbStatus = await (0, database_1.testConnection)();
        if (!dbStatus) {
            throw new Error('Database not ready');
        }
        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString(),
            service: 'payment-service'
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'not ready',
            timestamp: new Date().toISOString(),
            service: 'payment-service',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.get('/api', (req, res) => {
    res.json({
        service: 'Modex Payment Service',
        version: '1.0.0',
        description: 'Payment processing service with Stripe integration',
        endpoints: {
            '/api/payments': 'Payment management endpoints',
            '/api/subscriptions': 'Subscription management endpoints',
            '/api/payment-methods': 'Payment methods endpoints',
            '/webhooks/stripe': 'Stripe webhook endpoint'
        },
        documentation: 'https://docs.modex.com/payment-service'
    });
});
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
        path: req.path
    });
});
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map