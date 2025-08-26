"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsHandler = exports.createPrometheusMetrics = void 0;
const prom_client_1 = require("prom-client");
const httpRequests = new prom_client_1.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'service']
});
const httpDuration = new prom_client_1.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    labelNames: ['method', 'route', 'status_code', 'service'],
    buckets: [0.1, 5, 15, 50, 100, 500]
});
const createPrometheusMetrics = () => {
    return (req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            const route = req.route?.path || req.path;
            httpRequests.inc({
                method: req.method,
                route,
                status_code: res.statusCode,
                service: 'api-gateway'
            });
            httpDuration.observe({
                method: req.method,
                route,
                status_code: res.statusCode,
                service: 'api-gateway'
            }, duration);
        });
        next();
    };
};
exports.createPrometheusMetrics = createPrometheusMetrics;
const metricsHandler = (req, res) => {
    res.set('Content-Type', prom_client_1.register.contentType);
    res.end(prom_client_1.register.metrics());
};
exports.metricsHandler = metricsHandler;
//# sourceMappingURL=metrics.js.map