import { eq, and, desc } from 'drizzle-orm';
import { db } from '../config/database';
import { payments, refunds, paymentAttempts, subscriptions } from '../models/schema';
import { stripeService } from './stripeService';
import { redisClient } from '../config/redis';
import { config } from '../config/config';

export interface CreatePaymentData {
  userId: string;
  courseId?: string;
  subscriptionPlanId?: string;
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CreateSubscriptionData {
  userId: string;
  planId: string;
  priceId: string;
  trialPeriodDays?: number;
  metadata?: Record<string, any>;
}

class PaymentService {
  
  async createPayment(paymentData: CreatePaymentData) {
    try {
      // Get or create Stripe customer
      let stripeCustomerId = await this.getOrCreateStripeCustomer(paymentData.userId);

      // Create Stripe PaymentIntent
      const paymentIntent = await stripeService.createPaymentIntent({
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

      // Create payment record in database
      const [payment] = await db.insert(payments).values({
        id: crypto.randomUUID(),
        userId: paymentData.userId,
        courseId: paymentData.courseId,
        subscriptionPlanId: paymentData.subscriptionPlanId,
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentData.amount,
        currency: paymentData.currency || config.CURRENCY,
        status: 'pending',
        description: paymentData.description,
        metadata: paymentData.metadata,
      }).returning();

      // Create payment attempt record
      await db.insert(paymentAttempts).values({
        id: crypto.randomUUID(),
        paymentId: payment.id,
        status: 'pending',
        stripePaymentIntentId: paymentIntent.id,
        errorMessage: null,
      });

      // Cache payment data for quick access
      await this.cachePaymentData(payment.id, payment);

      return {
        payment,
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  }

  async createSubscription(subscriptionData: CreateSubscriptionData) {
    try {
      // Get or create Stripe customer
      let stripeCustomerId = await this.getOrCreateStripeCustomer(subscriptionData.userId);

      // Create Stripe subscription
      const stripeSubscription = await stripeService.createSubscription({
        customerId: stripeCustomerId,
        priceId: subscriptionData.priceId,
        trialPeriodDays: subscriptionData.trialPeriodDays,
        metadata: {
          userId: subscriptionData.userId,
          planId: subscriptionData.planId,
          ...subscriptionData.metadata,
        },
      });

      // Create subscription record in database
      const [subscription] = await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        userId: subscriptionData.userId,
        planId: subscriptionData.planId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomerId,
        status: 'active',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        metadata: subscriptionData.metadata,
      }).returning();

      return {
        subscription,
        stripeSubscription,
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  async getPaymentById(paymentId: string) {
    try {
      // Try cache first
      const cached = await this.getCachedPaymentData(paymentId);
      if (cached) return cached;

      // Fetch from database
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId));

      if (payment) {
        await this.cachePaymentData(paymentId, payment);
      }

      return payment;
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error;
    }
  }

  async getUserPayments(userId: string, limit = 20, offset = 0) {
    try {
      return await db
        .select()
        .from(payments)
        .where(eq(payments.userId, userId))
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error fetching user payments:', error);
      throw error;
    }
  }

  async updatePaymentStatus(paymentId: string, status: string, metadata?: Record<string, any>) {
    try {
      const [updatedPayment] = await db
        .update(payments)
        .set({
          status,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId))
        .returning();

      // Update cache
      if (updatedPayment) {
        await this.cachePaymentData(paymentId, updatedPayment);
      }

      return updatedPayment;
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  }

  async createRefund(paymentId: string, amount?: number, reason?: string) {
    try {
      const payment = await this.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Create Stripe refund
      const stripeRefund = await stripeService.createRefund({
        paymentIntentId: payment.stripePaymentIntentId,
        amount,
        reason: reason as any,
        metadata: { paymentId },
      });

      // Create refund record
      const [refund] = await db.insert(refunds).values({
        id: crypto.randomUUID(),
        paymentId,
        stripeRefundId: stripeRefund.id,
        amount: stripeRefund.amount / 100, // Convert from cents
        currency: stripeRefund.currency,
        status: stripeRefund.status,
        reason: stripeRefund.reason,
      }).returning();

      // Update payment status
      await this.updatePaymentStatus(paymentId, 'refunded');

      return refund;
    } catch (error) {
      console.error('Error creating refund:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string) {
    try {
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Cancel Stripe subscription
      const canceledSubscription = await stripeService.cancelSubscription(
        subscription.stripeSubscriptionId
      );

      // Update subscription status
      const [updatedSubscription] = await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          canceledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscriptionId))
        .returning();

      return updatedSubscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  async getUserSubscriptions(userId: string) {
    try {
      return await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt));
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      throw error;
    }
  }

  async handleWebhookEvent(event: any) {
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
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }

  private async getOrCreateStripeCustomer(userId: string): Promise<string> {
    try {
      // Check if customer exists in cache
      const cachedCustomerId = await redisClient.get(`stripe_customer:${userId}`);
      if (cachedCustomerId) return cachedCustomerId;

      // For now, create a basic customer - in production, you'd fetch user details
      const customer = await stripeService.createCustomer({
        email: `user-${userId}@example.com`, // This should come from user service
        metadata: { userId },
      });

      // Cache customer ID
      await redisClient.set(`stripe_customer:${userId}`, customer.id, 86400); // 24 hours

      return customer.id;
    } catch (error) {
      console.error('Error getting or creating Stripe customer:', error);
      throw error;
    }
  }

  private async cachePaymentData(paymentId: string, payment: any): Promise<void> {
    try {
      await redisClient.set(
        `payment:${paymentId}`,
        JSON.stringify(payment),
        3600 // 1 hour
      );
    } catch (error) {
      console.error('Error caching payment data:', error);
    }
  }

  private async getCachedPaymentData(paymentId: string): Promise<any | null> {
    try {
      const cached = await redisClient.get(`payment:${paymentId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting cached payment data:', error);
      return null;
    }
  }

  private async handlePaymentSucceeded(paymentIntent: any): Promise<void> {
    try {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

      if (payment) {
        await this.updatePaymentStatus(payment.id, 'completed', {
          stripeData: paymentIntent,
        });
      }
    } catch (error) {
      console.error('Error handling payment succeeded:', error);
    }
  }

  private async handlePaymentFailed(paymentIntent: any): Promise<void> {
    try {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

      if (payment) {
        await this.updatePaymentStatus(payment.id, 'failed', {
          stripeData: paymentIntent,
        });

        // Record failed attempt
        await db.insert(paymentAttempts).values({
          id: crypto.randomUUID(),
          paymentId: payment.id,
          status: 'failed',
          stripePaymentIntentId: paymentIntent.id,
          errorMessage: paymentIntent.last_payment_error?.message,
        });
      }
    } catch (error) {
      console.error('Error handling payment failed:', error);
    }
  }

  private async handleSubscriptionPaymentSucceeded(invoice: any): Promise<void> {
    try {
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription));

      if (subscription) {
        await db
          .update(subscriptions)
          .set({
            status: 'active',
            currentPeriodStart: new Date(invoice.period_start * 1000),
            currentPeriodEnd: new Date(invoice.period_end * 1000),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id));
      }
    } catch (error) {
      console.error('Error handling subscription payment succeeded:', error);
    }
  }

  private async handleSubscriptionCanceled(stripeSubscription: any): Promise<void> {
    try {
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id));

      if (subscription) {
        await db
          .update(subscriptions)
          .set({
            status: 'canceled',
            canceledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id));
      }
    } catch (error) {
      console.error('Error handling subscription canceled:', error);
    }
  }
}

export const paymentService = new PaymentService();
