import { Request, Response } from 'express';
import { paymentService, CreatePaymentData, CreateSubscriptionData } from '../services/paymentService';
import { stripeService } from '../services/stripeService';
import { config } from '../config/config';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class PaymentController {
  
  async createPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const paymentData: CreatePaymentData = {
        userId,
        courseId,
        subscriptionPlanId,
        amount,
        currency,
        description,
        metadata,
      };

      const result = await paymentService.createPayment(paymentData);

      res.status(201).json({
        success: true,
        data: {
          paymentId: result.payment.id,
          clientSecret: result.clientSecret,
          amount: result.payment.amount,
          currency: result.payment.currency,
        },
      });
    } catch (error) {
      console.error('Error creating payment:', error);
      res.status(500).json({ 
        error: 'Failed to create payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async createSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const subscriptionData: CreateSubscriptionData = {
        userId,
        planId,
        priceId,
        trialPeriodDays,
        metadata,
      };

      const result = await paymentService.createSubscription(subscriptionData);

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
    } catch (error) {
      console.error('Error creating subscription:', error);
      res.status(500).json({ 
        error: 'Failed to create subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const payment = await paymentService.getPaymentById(paymentId);

      if (!payment) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      // Check if user owns this payment
      if (!payment || payment.userId !== userId) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error('Error fetching payment:', error);
      res.status(500).json({ 
        error: 'Failed to fetch payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getUserPayments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const payments = await paymentService.getUserPayments(userId, limit, offset);

      res.json({
        success: true,
        data: payments,
        pagination: {
          limit,
          offset,
          total: payments.length,
        },
      });
    } catch (error) {
      console.error('Error fetching user payments:', error);
      res.status(500).json({ 
        error: 'Failed to fetch payments',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async createRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const { amount, reason } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Verify payment ownership
      const payment = await paymentService.getPaymentById(paymentId);
      if (!payment) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }
      if (!payment || payment.userId !== userId) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      const refund = await paymentService.createRefund(paymentId, amount, reason);

      res.status(201).json({
        success: true,
        data: refund,
      });
    } catch (error) {
      console.error('Error creating refund:', error);
      res.status(500).json({ 
        error: 'Failed to create refund',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getUserSubscriptions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const subscriptions = await paymentService.getUserSubscriptions(userId);

      res.json({
        success: true,
        data: subscriptions,
      });
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      res.status(500).json({ 
        error: 'Failed to fetch subscriptions',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async cancelSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const canceledSubscription = await paymentService.cancelSubscription(subscriptionId);

      res.json({
        success: true,
        data: canceledSubscription,
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      res.status(500).json({ 
        error: 'Failed to cancel subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      
      if (!signature) {
        res.status(400).json({ error: 'Missing Stripe signature' });
        return;
      }

      const event = await stripeService.constructWebhookEvent(req.body, signature);
      
      await paymentService.handleWebhookEvent(event);

      res.json({ received: true });
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.status(400).json({ 
        error: 'Webhook handling failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // This would require getting the Stripe customer ID first
      // For now, return empty array - in production, implement proper customer lookup
      res.json({
        success: true,
        data: [],
        message: 'Payment methods endpoint - implementation pending customer management integration'
      });
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      res.status(500).json({ 
        error: 'Failed to fetch payment methods',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const paymentController = new PaymentController();