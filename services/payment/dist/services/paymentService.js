"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../config/database");
const schema_1 = require("../models/schema");
const stripeService_1 = require("./stripeService");
const redis_1 = require("../config/redis");
const config_1 = require("../config/config");
class PaymentService {
    async createPayment(paymentData) {
        try {
            let stripeCustomerId = await this.getOrCreateStripeCustomer(paymentData.userId);
            const paymentIntent = await stripeService_1.stripeService.createPaymentIntent({
                amount: paymentData.amount,
                currency: paymentData.currency,
                customerId: stripeCustomerId,
                description: paymentData.description,
                metadata: {
                    userId: paymentData.userId,
                    courseId: paymentData.courseId || '',
                    subscriptionPlanId: paymentData.subscriptionPlanId || '',
                    ...paymentData.metadata,
                },
            });
            const [payment] = await database_1.db.insert(schema_1.payments).values({
                userId: paymentData.userId,
                courseId: paymentData.courseId || null,
                subscriptionPlanId: paymentData.subscriptionPlanId || null,
                stripePaymentIntentId: paymentIntent.id,
                amount: paymentData.amount.toString(),
                currency: paymentData.currency || config_1.config.CURRENCY,
                status: 'pending',
                description: paymentData.description || null,
                metadata: paymentData.metadata ? JSON.stringify(paymentData.metadata) : null,
            }).returning();
            await database_1.db.insert(schema_1.paymentAttempts).values({
                paymentId: payment.id,
                attemptNumber: 1,
                errorCode: null,
                errorMessage: null,
            });
            await this.cachePaymentData(payment.id, payment);
            return {
                payment,
                clientSecret: paymentIntent.client_secret,
            };
        }
        catch (error) {
            console.error('Error creating payment:', error);
            throw error;
        }
    }
    async createSubscription(subscriptionData) {
        try {
            let stripeCustomerId = await this.getOrCreateStripeCustomer(subscriptionData.userId);
            const stripeSubscription = await stripeService_1.stripeService.createSubscription({
                customerId: stripeCustomerId,
                priceId: subscriptionData.priceId,
                trialPeriodDays: subscriptionData.trialPeriodDays,
                metadata: {
                    userId: subscriptionData.userId,
                    planId: subscriptionData.planId,
                    ...subscriptionData.metadata,
                },
            });
            const [subscription] = await database_1.db.insert(schema_1.subscriptions).values({
                userId: subscriptionData.userId,
                planId: subscriptionData.planId,
                stripeSubscriptionId: stripeSubscription.id,
                status: 'active',
                currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
                currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
                amount: '0.00',
                currency: config_1.config.CURRENCY,
            }).returning();
            return {
                subscription,
                stripeSubscription,
            };
        }
        catch (error) {
            console.error('Error creating subscription:', error);
            throw error;
        }
    }
    async getPaymentById(paymentId) {
        try {
            const cached = await this.getCachedPaymentData(paymentId);
            if (cached)
                return cached;
            const [payment] = await database_1.db
                .select()
                .from(schema_1.payments)
                .where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId));
            if (payment) {
                await this.cachePaymentData(paymentId, payment);
            }
            return payment;
        }
        catch (error) {
            console.error('Error fetching payment:', error);
            throw error;
        }
    }
    async getUserPayments(userId, limit = 20, offset = 0) {
        try {
            return await database_1.db
                .select()
                .from(schema_1.payments)
                .where((0, drizzle_orm_1.eq)(schema_1.payments.userId, userId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.payments.createdAt))
                .limit(limit)
                .offset(offset);
        }
        catch (error) {
            console.error('Error fetching user payments:', error);
            throw error;
        }
    }
    async updatePaymentStatus(paymentId, status, metadata) {
        try {
            const [updatedPayment] = await database_1.db
                .update(schema_1.payments)
                .set({
                status,
                metadata: metadata ? JSON.stringify(metadata) : null,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId))
                .returning();
            if (updatedPayment) {
                await this.cachePaymentData(paymentId, updatedPayment);
            }
            return updatedPayment;
        }
        catch (error) {
            console.error('Error updating payment status:', error);
            throw error;
        }
    }
    async createRefund(paymentId, amount, reason) {
        try {
            const payment = await this.getPaymentById(paymentId);
            if (!payment) {
                throw new Error('Payment not found');
            }
            const stripeRefund = await stripeService_1.stripeService.createRefund({
                paymentIntentId: payment.stripePaymentIntentId,
                amount,
                reason: reason,
                metadata: { paymentId },
            });
            const [refund] = await database_1.db.insert(schema_1.refunds).values({
                amount: (stripeRefund.amount / 100).toString(),
                paymentId: paymentId,
                reason: stripeRefund.reason || undefined,
                status: stripeRefund.status || 'pending',
                stripeRefundId: stripeRefund.id,
            }).returning();
            await this.updatePaymentStatus(paymentId, 'refunded');
            return refund;
        }
        catch (error) {
            console.error('Error creating refund:', error);
            throw error;
        }
    }
    async cancelSubscription(subscriptionId) {
        try {
            const [subscription] = await database_1.db
                .select()
                .from(schema_1.subscriptions)
                .where((0, drizzle_orm_1.eq)(schema_1.subscriptions.id, subscriptionId));
            if (!subscription) {
                throw new Error('Subscription not found');
            }
            if (!subscription.stripeSubscriptionId) {
                throw new Error('Stripe subscription ID not found');
            }
            const canceledSubscription = await stripeService_1.stripeService.cancelSubscription(subscription.stripeSubscriptionId);
            const [updatedSubscription] = await database_1.db
                .update(schema_1.subscriptions)
                .set({
                status: 'canceled',
                canceledAt: new Date(),
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.subscriptions.id, subscriptionId))
                .returning();
            return updatedSubscription;
        }
        catch (error) {
            console.error('Error canceling subscription:', error);
            throw error;
        }
    }
    async getUserSubscriptions(userId) {
        try {
            return await database_1.db
                .select()
                .from(schema_1.subscriptions)
                .where((0, drizzle_orm_1.eq)(schema_1.subscriptions.userId, userId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.subscriptions.createdAt));
        }
        catch (error) {
            console.error('Error fetching user subscriptions:', error);
            throw error;
        }
    }
    async handleWebhookEvent(event) {
        try {
            console.log('Processing webhook event:', event.type);
            switch (event.type) {
                case 'payment_intent.succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
                case 'invoice.payment_succeeded':
                    await this.handleSubscriptionPaymentSucceeded(event.data.object);
                    break;
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionCanceled(event.data.object);
                    break;
                default:
                    console.log('Unhandled webhook event type:', event.type);
            }
        }
        catch (error) {
            console.error('Error handling webhook event:', error);
            throw error;
        }
    }
    async getOrCreateStripeCustomer(userId) {
        try {
            const cachedCustomerId = await redis_1.redisClient.get(`stripe_customer:${userId}`);
            if (cachedCustomerId)
                return cachedCustomerId;
            const customer = await stripeService_1.stripeService.createCustomer({
                email: `user-${userId}@example.com`,
                metadata: { userId },
            });
            await redis_1.redisClient.set(`stripe_customer:${userId}`, customer.id, 86400);
            return customer.id;
        }
        catch (error) {
            console.error('Error getting or creating Stripe customer:', error);
            throw error;
        }
    }
    async cachePaymentData(paymentId, payment) {
        try {
            await redis_1.redisClient.set(`payment:${paymentId}`, JSON.stringify(payment), 3600);
        }
        catch (error) {
            console.error('Error caching payment data:', error);
        }
    }
    async getCachedPaymentData(paymentId) {
        try {
            const cached = await redis_1.redisClient.get(`payment:${paymentId}`);
            return cached ? JSON.parse(cached) : null;
        }
        catch (error) {
            console.error('Error getting cached payment data:', error);
            return null;
        }
    }
    async handlePaymentSucceeded(paymentIntent) {
        try {
            const [payment] = await database_1.db
                .select()
                .from(schema_1.payments)
                .where((0, drizzle_orm_1.eq)(schema_1.payments.stripePaymentIntentId, paymentIntent.id));
            if (payment) {
                await this.updatePaymentStatus(payment.id, 'completed', {
                    stripeData: paymentIntent,
                });
            }
        }
        catch (error) {
            console.error('Error handling payment succeeded:', error);
        }
    }
    async handlePaymentFailed(paymentIntent) {
        try {
            const [payment] = await database_1.db
                .select()
                .from(schema_1.payments)
                .where((0, drizzle_orm_1.eq)(schema_1.payments.stripePaymentIntentId, paymentIntent.id));
            if (payment) {
                await this.updatePaymentStatus(payment.id, 'failed', {
                    stripeData: paymentIntent,
                });
                await database_1.db.insert(schema_1.paymentAttempts).values({
                    paymentId: payment.id,
                    attemptNumber: 1,
                    errorCode: paymentIntent.last_payment_error?.code || null,
                    errorMessage: paymentIntent.last_payment_error?.message || null,
                });
            }
        }
        catch (error) {
            console.error('Error handling payment failed:', error);
        }
    }
    async handleSubscriptionPaymentSucceeded(invoice) {
        try {
            const [subscription] = await database_1.db
                .select()
                .from(schema_1.subscriptions)
                .where((0, drizzle_orm_1.eq)(schema_1.subscriptions.stripeSubscriptionId, invoice.subscription));
            if (subscription) {
                await database_1.db
                    .update(schema_1.subscriptions)
                    .set({
                    status: 'active',
                    currentPeriodStart: new Date(invoice.period_start * 1000),
                    currentPeriodEnd: new Date(invoice.period_end * 1000),
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.subscriptions.id, subscription.id));
            }
        }
        catch (error) {
            console.error('Error handling subscription payment succeeded:', error);
        }
    }
    async handleSubscriptionCanceled(stripeSubscription) {
        try {
            const [subscription] = await database_1.db
                .select()
                .from(schema_1.subscriptions)
                .where((0, drizzle_orm_1.eq)(schema_1.subscriptions.stripeSubscriptionId, stripeSubscription.id));
            if (subscription) {
                await database_1.db
                    .update(schema_1.subscriptions)
                    .set({
                    status: 'canceled',
                    canceledAt: new Date(),
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.subscriptions.id, subscription.id));
            }
        }
        catch (error) {
            console.error('Error handling subscription canceled:', error);
        }
    }
}
exports.paymentService = new PaymentService();
//# sourceMappingURL=paymentService.js.map