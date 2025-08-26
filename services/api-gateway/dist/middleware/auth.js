"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({
            error: 'Access denied. No token provided.',
            requestId: req.headers['x-request-id']
        });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        logger_1.logger.warn('Invalid token attempt', {
            requestId: req.headers['x-request-id'],
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(403).json({
            error: 'Invalid token.',
            requestId: req.headers['x-request-id']
        });
        return;
    }
};
exports.authenticateToken = authenticateToken;
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        next();
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
        req.user = decoded;
    }
    catch (error) {
        logger_1.logger.debug('Optional auth failed', { error });
    }
    next();
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map