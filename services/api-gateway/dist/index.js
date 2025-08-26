"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const config_1 = require("./config/config");
const logger_1 = require("./utils/logger");
const routes_1 = require("./routes");
const middleware_1 = require("./middleware");
const metrics_1 = require("./middleware/metrics");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_1.config.CORS_ORIGINS,
    credentials: true
}));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('combined', { stream: { write: (message) => logger_1.logger.info(message.trim()) } }));
app.use((0, metrics_1.createPrometheusMetrics)());
(0, middleware_1.setupMiddleware)(app);
(0, routes_1.setupRoutes)(app);
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'api-gateway'
    });
});
app.use((err, req, res, next) => {
    logger_1.logger.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        requestId: req.headers['x-request-id']
    });
});
const PORT = config_1.config.PORT || 3000;
app.listen(PORT, () => {
    logger_1.logger.info(`API Gateway running on port ${PORT}`);
    logger_1.logger.info(`Environment: ${config_1.config.NODE_ENV}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map