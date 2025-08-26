import { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, register } from 'prom-client';

// Metrics
const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service']
});

const httpDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.1, 5, 15, 50, 100, 500]
});

export const createPrometheusMetrics = () => {
  return (req: Request, res: Response, next: NextFunction) => {
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

// Metrics endpoint
export const metricsHandler = (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
};
