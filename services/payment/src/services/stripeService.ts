import Stripe from 'stripe';
import { config } from '../config/config';

class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!config.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    
    this.stripe = new Stripe(config.STRIPE_SECRET_KEY, {
      apiVersion: '2024-04-10',
    });
  }

  async createCustomer(customerData: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    return await this.stripe.customers.create({
      email: customerData.email,
      name: customerData.name,
      metadata: customerData.metadata || {},
    });
  }

  async createPaymentIntent(paymentData: {
    amount: number;
    currency?: string;
    customerId?: string;
    metadata?: Record<string, string>;
    description?: string;
  }): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.create({
      amount: Math.round(paymentData.amount * 100), // Convert to cents
      currency: paymentData.currency || config.CURRENCY,
      customer: paymentData.customerId,
      metadata: paymentData.metadata || {},
      description: paymentData.description,
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.confirm(paymentIntentId);
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  async createRefund(refundData: {
    paymentIntentId: string;
    amount?: number;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
    metadata?: Record<string, string>;
  }): Promise<Stripe.Refund> {
    return await this.stripe.refunds.create({
      payment_intent: refundData.paymentIntentId,
      amount: refundData.amount ? Math.round(refundData.amount * 100) : undefined,
      reason: refundData.reason,
      metadata: refundData.metadata || {},
    });
  }

  async createSubscription(subscriptionData: {
    customerId: string;
    priceId: string;
    trialPeriodDays?: number;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.create({
      customer: subscriptionData.customerId,
      items: [{ price: subscriptionData.priceId }],
      trial_period_days: subscriptionData.trialPeriodDays || config.SUBSCRIPTION_TRIAL_DAYS,
      metadata: subscriptionData.metadata || {},
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.cancel(subscriptionId);
  }

  async updateSubscription(subscriptionId: string, updateData: {
    priceId?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    
    return await this.stripe.subscriptions.update(subscriptionId, {
      items: updateData.priceId ? [{ 
        id: subscription.items.data[0].id,
        price: updateData.priceId 
      }] : undefined,
      metadata: updateData.metadata || {},
      proration_behavior: 'create_prorations',
    });
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  async retrieveCustomer(customerId: string): Promise<Stripe.Customer> {
    return await this.stripe.customers.retrieve(customerId) as Stripe.Customer;
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async constructWebhookEvent(body: Buffer, signature: string): Promise<Stripe.Event> {
    if (!config.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required for webhook verification');
    }
    
    return this.stripe.webhooks.constructEvent(
      body,
      signature,
      config.STRIPE_WEBHOOK_SECRET
    );
  }

  async listCustomerPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return paymentMethods.data;
  }

  async createPrice(priceData: {
    productId: string;
    unitAmount: number;
    currency?: string;
    recurring?: {
      interval: 'month' | 'year';
      intervalCount?: number;
    };
  }): Promise<Stripe.Price> {
    return await this.stripe.prices.create({
      product: priceData.productId,
      unit_amount: Math.round(priceData.unitAmount * 100),
      currency: priceData.currency || config.CURRENCY,
      recurring: priceData.recurring,
    });
  }
}

export const stripeService = new StripeService();
