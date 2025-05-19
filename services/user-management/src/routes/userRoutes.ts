import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate, authorize } from '../middleware/auth';
import { authRateLimiter, emailVerificationLimiter, passwordResetLimiter } from '../middleware/rateLimiter';

const router = Router();
const userController = new UserController();

// Public routes
router.post('/register', authRateLimiter, userController.register.bind(userController));
router.post('/login', authRateLimiter, userController.login.bind(userController));
router.get('/verify-email', emailVerificationLimiter, userController.verifyEmail.bind(userController));
router.post('/request-password-reset', passwordResetLimiter, userController.requestPasswordReset.bind(userController));
router.post('/reset-password', passwordResetLimiter, userController.resetPassword.bind(userController));

// Protected routes
router.get('/profile', authenticate, userController.getProfile.bind(userController));
router.patch('/profile', authenticate, userController.updateProfile.bind(userController));

// Admin routes
router.get('/', authenticate, authorize('admin'), userController.getAllUsers.bind(userController));
router.get('/:id', authenticate, authorize('admin'), userController.getUserById.bind(userController));

export default router;
