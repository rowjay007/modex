import { Router } from 'express';
import { register, login, verifyEmail, requestPasswordReset, resetPassword, getProfile, updateProfile, getAllUsers, getUserById } from '../controllers/UserController';
import { authenticate, authorize } from '../middleware/auth';
import { authRateLimiter, emailVerificationLimiter, passwordResetLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.get('/verify-email', emailVerificationLimiter, verifyEmail);
router.post('/request-password-reset', passwordResetLimiter, requestPasswordReset);
router.post('/reset-password', passwordResetLimiter, resetPassword);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);

// Admin routes
router.get('/', authenticate, authorize('admin'), getAllUsers);
router.get('/:id', authenticate, authorize('admin'), getUserById);

export default router;
