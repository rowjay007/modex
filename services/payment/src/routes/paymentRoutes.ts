import { Router } from 'express';
import { paymentController } from '../controllers/paymentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Payment routes
router.post('/payments', authenticateToken, paymentController.createPayment.bind(paymentController));
router.get('/payments/:paymentId', authenticateToken, paymentController.getPayment.bind(paymentController));
router.get('/payments', authenticateToken, paymentController.getUserPayments.bind(paymentController));
router.post('/payments/:paymentId/refund', authenticateToken, paymentController.createRefund.bind(paymentController));

// Subscription routes
router.post('/subscriptions', authenticateToken, paymentController.createSubscription.bind(paymentController));
router.get('/subscriptions', authenticateToken, paymentController.getUserSubscriptions.bind(paymentController));
router.delete('/subscriptions/:subscriptionId', authenticateToken, paymentController.cancelSubscription.bind(paymentController));

// Payment methods routes
router.get('/payment-methods', authenticateToken, paymentController.getPaymentMethods.bind(paymentController));

// Webhook route (no authentication required)
router.post('/webhooks/stripe', paymentController.handleWebhook.bind(paymentController));

export default router;