import { Router } from 'express';
import { 
  register, 
  login, 
  verifyEmail, 
  requestPasswordReset, 
  resetPassword, 
  getProfile, 
  updateProfile, 
  getAllUsers, 
  getUserById,
  deleteAccount
} from '../controllers/UserController';
import { authenticate, authorize } from '../middleware/auth';
import { authRateLimiter, emailVerificationLimiter, passwordResetLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.get('/verify-email', emailVerificationLimiter, verifyEmail);
router.post('/request-password-reset', passwordResetLimiter, requestPasswordReset);
router.post('/reset-password', passwordResetLimiter, resetPassword);

router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);
router.delete('/profile', authenticate, deleteAccount);

router.get('/me', authenticate, getProfile);
router.patch('/me', authenticate, updateProfile);
router.delete('/me', authenticate, deleteAccount);

router.get('/', authenticate, authorize('admin'), getAllUsers);
router.get('/:id', authenticate, authorize('admin'), getUserById);

export default router;
