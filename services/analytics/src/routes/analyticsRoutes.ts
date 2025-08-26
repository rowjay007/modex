import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();
const analyticsController = new AnalyticsController();

// Public endpoint for event tracking (no auth required for flexibility)
router.post('/events', optionalAuth, analyticsController.trackEvent);

// Protected endpoints requiring authentication
router.get('/courses/:courseId', authenticateToken, analyticsController.getCourseAnalytics);
router.get('/users/:userId/progress', authenticateToken, analyticsController.getUserProgress);
router.put('/users/:userId/courses/:courseId/progress', authenticateToken, analyticsController.updateUserProgress);

// User's own progress (authenticated)
router.get('/me/progress', authenticateToken, analyticsController.getMyProgress);

// Admin/instructor dashboard analytics
router.get('/dashboard', authenticateToken, analyticsController.getDashboardAnalytics);

// Internal endpoint for batch processing (should be secured at network level)
router.post('/internal/process-events', analyticsController.processBatchedEvents);

export default router;