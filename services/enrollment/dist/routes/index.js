"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const enrollmentRoutes_1 = __importDefault(require("./enrollmentRoutes"));
const router = (0, express_1.Router)();
router.use('/enrollments', enrollmentRoutes_1.default);
exports.default = router;
