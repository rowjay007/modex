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
  deleteAccount,
  exportUserData,
  updateConsent,
  setup2FA,
  verify2FA
} from '../controllers/UserController';
import { authenticate, authorize } from '../middleware/auth';
import { authRateLimiter, emailVerificationLimiter, passwordResetLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *               role:
 *                 type: string
 *                 enum: [student, instructor, admin]
 *                 default: student
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input or email already registered
 */
router.post('/register', authRateLimiter, register);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Log in a user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
 */
router.post('/login', authRateLimiter, login);

/**
 * @swagger
 * /verify-email:
 *   get:
 *     summary: Verify user email with token
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: Email verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.get('/verify-email', emailVerificationLimiter, verifyEmail);

/**
 * @swagger
 * /request-password-reset:
 *   post:
 *     summary: Request password reset email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset email sent if account exists
 */
router.post('/request-password-reset', passwordResetLimiter, requestPasswordReset);

/**
 * @swagger
 * /reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid token or password format
 */
router.post('/reset-password', passwordResetLimiter, resetPassword);

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 */
router.get('/profile', authenticate, getProfile);

/**
 * @swagger
 * /profile:
 *   patch:
 *     summary: Update user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.patch('/profile', authenticate, updateProfile);

/**
 * @swagger
 * /profile:
 *   delete:
 *     summary: Delete user account
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Account deleted successfully
 */
router.delete('/profile', authenticate, deleteAccount);

// /me endpoints (aliases for profile operations)
router.get('/me', authenticate, getProfile);
router.patch('/me', authenticate, updateProfile);
router.delete('/me', authenticate, deleteAccount);

/**
 * @swagger
 * /me/export:
 *   get:
 *     summary: Export all user data (GDPR)
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User data exported successfully
 */
router.get('/me/export', authenticate, exportUserData);

/**
 * @swagger
 * /me/consent:
 *   post:
 *     summary: Update user consent preferences
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cookieConsent:
 *                 type: boolean
 *               marketingConsent:
 *                 type: boolean
 *               privacyPolicyAccepted:
 *                 type: boolean
 *               termsAccepted:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Consent preferences updated
 */
router.post('/me/consent', authenticate, updateConsent);

/**
 * @swagger
 * /me/2fa/setup:
 *   post:
 *     summary: Setup two-factor authentication
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA setup initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 secret:
 *                   type: string
 *                 qrCodeUrl:
 *                   type: string
 */
router.post('/me/2fa/setup', authenticate, setup2FA);

/**
 * @swagger
 * /me/2fa/verify:
 *   post:
 *     summary: Verify and enable 2FA
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA enabled successfully
 *       401:
 *         description: Invalid 2FA token
 */
router.post('/me/2fa/verify', authenticate, verify2FA);

/**
 * @swagger
 * /:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *       403:
 *         description: Not authorized
 */
router.get('/', authenticate, authorize('admin'), getAllUsers);

/**
 * @swagger
 * /{id}:
 *   get:
 *     summary: Get user by ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User data
 *       403:
 *         description: Not authorized
 *       404:
 *         description: User not found
 */
router.get('/:id', authenticate, authorize('admin'), getUserById);

export default router;
