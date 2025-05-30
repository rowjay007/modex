import { Router } from 'express';
import { notificationController } from '../controllers/notificationController';
import { templateController } from '../controllers/templateController';
import { novuController } from '../controllers/novuController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /notifications:
 *   post:
 *     summary: Send a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *               - channel
 *             properties:
 *               recipientId:
 *                 type: number
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *               recipientPhone:
 *                 type: string
 *               recipientDeviceToken:
 *                 type: string
 *               templateId:
 *                 type: number
 *               channel:
 *                 type: string
 *                 enum: [email, sms, push, in_app]
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *               data:
 *                 type: object
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 default: medium
 *     responses:
 *       201:
 *         description: Notification sent successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, authorize('admin'), notificationController.sendNotification);

/**
 * @swagger
 * /notifications/{id}:
 *   get:
 *     summary: Get a notification by ID
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification details
 *       404:
 *         description: Notification not found
 *       401:
 *         description: Not authenticated
 */
router.get('/:id', authenticate, authorize('admin'), notificationController.getNotification);

/**
 * @swagger
 * /notifications/{id}/status:
 *   patch:
 *     summary: Update notification status
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, sent, delivered, failed]
 *               errorMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 */
router.patch('/:id/status', authenticate, authorize('admin'), notificationController.updateNotificationStatus);

/**
 * @swagger
 * /notifications/me:
 *   get:
 *     summary: Get current user's notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of notifications to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *     responses:
 *       200:
 *         description: List of notifications
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticate, notificationController.getUserNotifications);

/**
 * @swagger
 * /notifications/me/in-app:
 *   get:
 *     summary: Get in-app notifications for current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of notifications to return
 *       - in: query
 *         name: markAsRead
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Mark retrieved notifications as read
 *     responses:
 *       200:
 *         description: List of in-app notifications
 *       401:
 *         description: Not authenticated
 */
router.get('/me/in-app', authenticate, notificationController.getInAppNotifications);

/**
 * @swagger
 * /notifications/templates:
 *   post:
 *     summary: Create a new notification template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - channel
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *               description:
 *                 type: string
 *               channel:
 *                 type: string
 *                 enum: [email, sms, push, in_app]
 *               subject:
 *                 type: string
 *                 maxLength: 255
 *               content:
 *                 type: string
 *               variables:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Template created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 */
router.post('/templates', authenticate, authorize('admin'), templateController.createTemplate);

/**
 * @swagger
 * /notifications/templates:
 *   get:
 *     summary: Get all notification templates
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *           enum: [email, sms, push, in_app]
 *         description: Filter by notification channel
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of templates to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of templates to skip
 *     responses:
 *       200:
 *         description: List of notification templates
 *       401:
 *         description: Not authenticated
 */
router.get('/templates', authenticate, templateController.getAllTemplates);

/**
 * @swagger
 * /notifications/templates/{id}:
 *   get:
 *     summary: Get a template by ID
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template details
 *       404:
 *         description: Template not found
 *       401:
 *         description: Not authenticated
 */
router.get('/templates/:id', authenticate, templateController.getTemplate);

/**
 * @swagger
 * /notifications/templates/{id}:
 *   patch:
 *     summary: Update a template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *               description:
 *                 type: string
 *               channel:
 *                 type: string
 *                 enum: [email, sms, push, in_app]
 *               subject:
 *                 type: string
 *                 maxLength: 255
 *               content:
 *                 type: string
 *               variables:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Template updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Template not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 */
router.patch('/templates/:id', authenticate, authorize('admin'), templateController.updateTemplate);

/**
 * @swagger
 * /notifications/templates/{id}:
 *   delete:
 *     summary: Delete a template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID
 *     responses:
 *       204:
 *         description: Template deleted successfully
 *       404:
 *         description: Template not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 */
router.delete('/templates/:id', authenticate, authorize('admin'), templateController.deleteTemplate);

/**
 * @swagger
 * /notifications/novu/register:
 *   post:
 *     summary: Register current user with Novu notification service
 *     tags: [Novu]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/novu/register', authenticate, novuController.registerUser);

/**
 * @swagger
 * /notifications/novu/preferences:
 *   patch:
 *     summary: Update notification preferences for current user
 *     tags: [Novu]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailEnabled:
 *                 type: boolean
 *               smsEnabled:
 *                 type: boolean
 *               pushEnabled:
 *                 type: boolean
 *               inAppEnabled:
 *                 type: boolean
 *               marketingEnabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.patch('/novu/preferences', authenticate, novuController.updatePreferences);

/**
 * @swagger
 * /notifications/novu/users/{userId}:
 *   post:
 *     summary: Send notification to a specific user via Novu
 *     tags: [Novu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel
 *               - content
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [email, sms, push, in_app]
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 default: medium
 *               templateId:
 *                 type: string
 *               payload:
 *                 type: object
 *               overrides:
 *                 type: object
 *     responses:
 *       201:
 *         description: Notification sent successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.post('/novu/users/:userId', authenticate, authorize('admin'), novuController.sendNotification);

/**
 * @swagger
 * /notifications/novu/me:
 *   post:
 *     summary: Send notification to current user via Novu
 *     tags: [Novu]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel
 *               - content
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [email, sms, push, in_app]
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 default: medium
 *               templateId:
 *                 type: string
 *               payload:
 *                 type: object
 *               overrides:
 *                 type: object
 *     responses:
 *       201:
 *         description: Notification sent successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/novu/me', authenticate, novuController.sendToCurrentUser);

/**
 * @swagger
 * /notifications/novu/unsubscribe:
 *   delete:
 *     summary: Delete current user from Novu notification service
 *     tags: [Novu]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: User deleted successfully
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.delete('/novu/unsubscribe', authenticate, novuController.deleteUserFromNovu);

export default router;