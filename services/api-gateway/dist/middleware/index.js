"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMiddleware = exports.urlencodedParser = exports.jsonParser = exports.rateLimiter = exports.requestId = void 0;
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const redis_1 = require("redis");
const uuid_1 = require("uuid");
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const redisClient = (0, redis_1.createClient)({ url: config_1.config.REDIS_URL });
redisClient.connect().catch((err) => logger_1.logger.error('Redis connection error:', err));
const requestId = (req, res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || (0, uuid_1.v4)();
    res.set('x-request-id', req.headers['x-request-id']);
    next();
};
exports.requestId = requestId;
exports.rateLimiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.RATE_LIMIT_WINDOW,
    max: config_1.config.RATE_LIMIT_MAX,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config_1.config.RATE_LIMIT_WINDOW / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.jsonParser = express_1.default.json({ limit: '10mb' });
exports.urlencodedParser = express_1.default.urlencoded({ extended: true, limit: '10mb' });
const setupMiddleware = (app) => {
    app.use(exports.requestId);
    app.use(exports.rateLimiter);
    app.use(exports.jsonParser);
    app.use(exports.urlencodedParser);
};
exports.setupMiddleware = setupMiddleware;
//# sourceMappingURL=index.js.map