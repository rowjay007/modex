"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentController = exports.PaymentController = void 0;
const paymentService_1 = require("../services/paymentService");
const stripeService_1 = require("../services/stripeService");
class PaymentController {
    async createPayment(req, res) {
        try {
            const { courseId, subscriptionPlanId, amount, currency, description, metadata } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            if (!amount || amount <= 0) {
                res.status(400).json({ error: 'Valid amount is required' });
                return;
            }
            const paymentData = {
                userId,
                courseId,
                subscriptionPlanId,
                amount,
                currency,
                description,
                metadata,
            };
            const result = await paymentService_1.paymentService.createPayment(paymentData);
            res.status(201).json({
                success: true,
                data: {
                    paymentId: result.payment.id,
                    clientSecret: result.clientSecret,
                    amount: result.payment.amount,
                    currency: result.payment.currency,
                },
            });
        }
        catch (error) {
            console.error('Error creating payment:', error);
            res.status(500).json({
                error: 'Failed to create payment',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async createSubscription(req, res) {
        try {
            const { planId, priceId, trialPeriodDays, metadata } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            if (!planId || !priceId) {
                res.status(400).json({ error: 'Plan ID and Price ID are required' });
                return;
            }
            const subscriptionData = {
                userId,
                planId,
                priceId,
                trialPeriodDays,
                metadata,
            };
            const result = await paymentService_1.paymentService.createSubscription(subscriptionData);
            res.status(201).json({
                success: true,
                data: {
                    subscriptionId: result.subscription.id,
                    stripeSubscriptionId: result.stripeSubscription.id,
                    status: result.subscription.status,
                    currentPeriodStart: result.subscription.currentPeriodStart,
                    currentPeriodEnd: result.subscription.currentPeriodEnd,
                },
            });
        }
        catch (error) {
            console.error('Error creating subscription:', error);
            res.status(500).json({
                error: 'Failed to create subscription',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getPayment(req, res) {
        try {
            const { paymentId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const payment = await paymentService_1.paymentService.getPaymentById(paymentId);
            if (!payment) {
                res.status(404).json({ error: 'Payment not found' });
                return;
            }
            if (!payment || payment.userId !== userId) {
                res.status(404).json({ error: 'Payment not found' });
                return;
            }
            res.json({
                success: true,
                data: payment,
            });
        }
        catch (error) {
            console.error('Error fetching payment:', error);
            res.status(500).json({
                error: 'Failed to fetch payment',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getUserPayments(req, res) {
        try {
            const userId = req.user?.id;
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const payments = await paymentService_1.paymentService.getUserPayments(userId, limit, offset);
            res.json({
                success: true,
                data: payments,
                pagination: {
                    limit,
                    offset,
                    total: payments.length,
                },
            });
        }
        catch (error) {
            console.error('Error fetching user payments:', error);
            res.status(500).json({
                error: 'Failed to fetch payments',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async createRefund(req, res) {
        try {
            const { paymentId } = req.params;
            const { amount, reason } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const payment = await paymentService_1.paymentService.getPaymentById(paymentId);
            if (!payment) {
                res.status(404).json({ error: 'Payment not found' });
                return;
            }
            if (!payment || payment.userId !== userId) {
                res.status(404).json({ error: 'Payment not found' });
                return;
            }
            const refund = await paymentService_1.paymentService.createRefund(paymentId, amount, reason);
            res.status(201).json({
                success: true,
                data: refund,
            });
        }
        catch (error) {
            console.error('Error creating refund:', error);
            res.status(500).json({
                error: 'Failed to create refund',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getUserSubscriptions(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const subscriptions = await paymentService_1.paymentService.getUserSubscriptions(userId);
            res.json({
                success: true,
                data: subscriptions,
            });
        }
        catch (error) {
            console.error('Error fetching user subscriptions:', error);
            res.status(500).json({
                error: 'Failed to fetch subscriptions',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async cancelSubscription(req, res) {
        try {
            const { subscriptionId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const canceledSubscription = await paymentService_1.paymentService.cancelSubscription(subscriptionId);
            res.json({
                success: true,
                data: canceledSubscription,
            });
        }
        catch (error) {
            console.error('Error canceling subscription:', error);
            res.status(500).json({
                error: 'Failed to cancel subscription',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async handleWebhook(req, res) {
        try {
            const signature = req.headers['stripe-signature'];
            if (!signature) {
                res.status(400).json({ error: 'Missing Stripe signature' });
                return;
            }
            const event = await stripeService_1.stripeService.constructWebhookEvent(req.body, signature);
            await paymentService_1.paymentService.handleWebhookEvent(event);
            res.json({ received: true });
        }
        catch (error) {
            console.error('Error handling webhook:', error);
            res.status(400).json({
                error: 'Webhook handling failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getPaymentMethods(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            res.json({
                success: true,
                data: [],
                message: 'Payment methods endpoint - implementation pending customer management integration'
            });
        }
        catch (error) {
            console.error('Error fetching payment methods:', error);
            res.status(500).json({
                error: 'Failed to fetch payment methods',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
exports.PaymentController = PaymentController;
exports.paymentController = new PaymentController();
//# sourceMappingURL=paymentController.js.map