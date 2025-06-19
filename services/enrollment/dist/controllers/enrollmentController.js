"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollmentController = void 0;
const enrollmentService_1 = require("../services/enrollmentService");
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const appError_1 = __importDefault(require("../utils/appError"));
class EnrollmentController {
    constructor() {
        this.createEnrollment = (0, catchAsync_1.default)(async (req, res, next) => {
            const enrollment = await enrollmentService_1.enrollmentService.createEnrollment(req.body);
            res.status(201).json({
                status: 'success',
                data: { enrollment },
            });
        });
        this.getEnrollmentById = (0, catchAsync_1.default)(async (req, res, next) => {
            const id = parseInt(req.params.id, 10);
            const enrollment = await enrollmentService_1.enrollmentService.getEnrollmentById(id);
            if (!enrollment) {
                return next(new appError_1.default('No enrollment found with that ID', 404));
            }
            res.status(200).json({
                status: 'success',
                data: { enrollment },
            });
        });
        this.getEnrollmentsByUser = (0, catchAsync_1.default)(async (req, res, next) => {
            const userId = parseInt(req.params.userId, 10);
            const enrollments = await enrollmentService_1.enrollmentService.getEnrollmentsByUser(userId);
            res.status(200).json({
                status: 'success',
                results: enrollments.length,
                data: { enrollments },
            });
        });
        this.updateEnrollmentStatus = (0, catchAsync_1.default)(async (req, res, next) => {
            const id = parseInt(req.params.id, 10);
            const { status } = req.body;
            const updatedEnrollment = await enrollmentService_1.enrollmentService.updateEnrollmentStatus(id, status);
            if (!updatedEnrollment) {
                return next(new appError_1.default('No enrollment found with that ID to update', 404));
            }
            res.status(200).json({
                status: 'success',
                data: { enrollment: updatedEnrollment },
            });
        });
        this.deleteEnrollment = (0, catchAsync_1.default)(async (req, res, next) => {
            const id = parseInt(req.params.id, 10);
            await enrollmentService_1.enrollmentService.deleteEnrollment(id);
            res.status(204).json({
                status: 'success',
                data: null,
            });
        });
    }
}
exports.enrollmentController = new EnrollmentController();
