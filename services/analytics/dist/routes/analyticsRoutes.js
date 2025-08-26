"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analyticsController_1 = require("../controllers/analyticsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const analyticsController = new analyticsController_1.AnalyticsController();
// Public endpoint for event tracking (no auth required for flexibility)
router.post('/events', auth_1.optionalAuth, analyticsController.trackEvent);
// Protected endpoints requiring authentication
router.get('/courses/:courseId', auth_1.authenticateToken, analyticsController.getCourseAnalytics);
router.get('/users/:userId/progress', auth_1.authenticateToken, analyticsController.getUserProgress);
router.put('/users/:userId/courses/:courseId/progress', auth_1.authenticateToken, analyticsController.updateUserProgress);
// User's own progress (authenticated)
router.get('/me/progress', auth_1.authenticateToken, analyticsController.getMyProgress);
// Admin/instructor dashboard analytics
router.get('/dashboard', auth_1.authenticateToken, analyticsController.getDashboardAnalytics);
// Internal endpoint for batch processing (should be secured at network level)
router.post('/internal/process-events', analyticsController.processBatchedEvents);
exports.default = router;
