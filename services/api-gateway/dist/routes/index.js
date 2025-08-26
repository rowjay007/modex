"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = void 0;
const http_proxy_middleware_1 = require("http-proxy-middleware");
const config_1 = require("../config/config");
const auth_1 = require("../middleware/auth");
const metrics_1 = require("../middleware/metrics");
const logger_1 = require("../utils/logger");
const setupRoutes = (app) => {
    app.get('/metrics', metrics_1.metricsHandler);
    app.use('/api/users', auth_1.authenticateToken, (0, http_proxy_middleware_1.createProxyMiddleware)({
        target: config_1.config.SERVICES.USER_MANAGEMENT,
        changeOrigin: true,
        pathRewrite: { '^/api/users': '' },
        onError: (err, req, res) => {
            logger_1.logger.error('User Management Service proxy error:', err);
            res.status(503).json({ error: 'User Management Service unavailable' });
        }
    }));
    app.use('/api/auth', (0, http_proxy_middleware_1.createProxyMiddleware)({
        target: config_1.config.SERVICES.USER_MANAGEMENT,
        changeOrigin: true,
        pathRewrite: { '^/api/auth': '/auth' },
        onError: (err, req, res) => {
            logger_1.logger.error('Auth Service proxy error:', err);
            res.status(503).json({ error: 'Auth Service unavailable' });
        }
    }));
    app.use('/api/content', auth_1.optionalAuth, (0, http_proxy_middleware_1.createProxyMiddleware)({
        target: config_1.config.SERVICES.CONTENT_DELIVERY,
        changeOrigin: true,
        pathRewrite: { '^/api/content': '' },
        onError: (err, req, res) => {
            logger_1.logger.error('Content Delivery Service proxy error:', err);
            res.status(503).json({ error: 'Content Delivery Service unavailable' });
        }
    }));
    app.use('/api/courses', (req, res, next) => {
        if (req.method === 'GET') {
            (0, auth_1.optionalAuth)(req, res, next);
        }
        else {
            (0, auth_1.authenticateToken)(req, res, next);
        }
    }, (0, http_proxy_middleware_1.createProxyMiddleware)({
        target: config_1.config.SERVICES.COURSE_MANAGEMENT,
        changeOrigin: true,
        pathRewrite: { '^/api/courses': '' },
        onError: (err, req, res) => {
            logger_1.logger.error('Course Management Service proxy error:', err);
            res.status(503).json({ error: 'Course Management Service unavailable' });
        }
    }));
    app.use('/api/enrollments', auth_1.authenticateToken, (0, http_proxy_middleware_1.createProxyMiddleware)({
        target: config_1.config.SERVICES.ENROLLMENT,
        changeOrigin: true,
        pathRewrite: { '^/api/enrollments': '' },
        onError: (err, req, res) => {
            logger_1.logger.error('Enrollment Service proxy error:', err);
            res.status(503).json({ error: 'Enrollment Service unavailable' });
        }
    }));
    app.use('/api/assessments', auth_1.authenticateToken, (0, http_proxy_middleware_1.createProxyMiddleware)({
        target: config_1.config.SERVICES.ASSESSMENT,
        changeOrigin: true,
        pathRewrite: { '^/api/assessments': '' },
        onError: (err, req, res) => {
            logger_1.logger.error('Assessment Service proxy error:', err);
            res.status(503).json({ error: 'Assessment Service unavailable' });
        }
    }));
    app.use('/api/payments', auth_1.authenticateToken, (0, http_proxy_middleware_1.createProxyMiddleware)({
        target: config_1.config.SERVICES.PAYMENT,
        changeOrigin: true,
        pathRewrite: { '^/api/payments': '' },
        onError: (err, req, res) => {
            logger_1.logger.error('Payment Service proxy error:', err);
            res.status(503).json({ error: 'Payment Service unavailable' });
        }
    }));
    app.use('/api/analytics', auth_1.authenticateToken, (0, http_proxy_middleware_1.createProxyMiddleware)({
        target: config_1.config.SERVICES.ANALYTICS,
        changeOrigin: true,
        pathRewrite: { '^/api/analytics': '' },
        onError: (err, req, res) => {
            logger_1.logger.error('Analytics Service proxy error:', err);
            res.status(503).json({ error: 'Analytics Service unavailable' });
        }
    }));
    app.use('/api/notifications', auth_1.authenticateToken, (0, http_proxy_middleware_1.createProxyMiddleware)({
        target: config_1.config.SERVICES.NOTIFICATION,
        changeOrigin: true,
        pathRewrite: { '^/api/notifications': '' },
        onError: (err, req, res) => {
            logger_1.logger.error('Notification Service proxy error:', err);
            res.status(503).json({ error: 'Notification Service unavailable' });
        }
    }));
    app.get('/api', (req, res) => {
        res.json({
            service: 'Modex API Gateway',
            version: '1.0.0',
            endpoints: {
                '/api/auth': 'Authentication endpoints',
                '/api/users': 'User management endpoints',
                '/api/content': 'Content delivery endpoints',
                '/api/courses': 'Course management endpoints',
                '/api/enrollments': 'Enrollment endpoints',
                '/api/assessments': 'Assessment endpoints',
                '/api/payments': 'Payment endpoints',
                '/api/analytics': 'Analytics endpoints',
                '/api/notifications': 'Notification endpoints'
            }
        });
    });
    app.use('*', (req, res) => {
        res.status(404).json({
            error: 'Endpoint not found',
            path: req.originalUrl,
            requestId: req.headers['x-request-id']
        });
    });
};
exports.setupRoutes = setupRoutes;
//# sourceMappingURL=index.js.map