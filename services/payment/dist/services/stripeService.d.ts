import Stripe from 'stripe';
declare class StripeService {
    private stripe;
    constructor();
    createCustomer(customerData: {
        email: string;
        name?: string;
        metadata?: Record<string, string>;
    }): Promise<Stripe.Customer>;
    createPaymentIntent(paymentData: {
        amount: number;
        currency?: string;
        customerId?: string;
        metadata?: Record<string, string>;
        description?: string;
    }): Promise<Stripe.PaymentIntent>;
    confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
    cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
    createRefund(refundData: {
        paymentIntentId: string;
        amount?: number;
        reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
        metadata?: Record<string, string>;
    }): Promise<Stripe.Refund>;
    createSubscription(subscriptionData: {
        customerId: string;
        priceId: string;
        trialPeriodDays?: number;
        metadata?: Record<string, string>;
    }): Promise<Stripe.Subscription>;
    cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
    updateSubscription(subscriptionId: string, updateData: {
        priceId?: string;
        metadata?: Record<string, string>;
    }): Promise<Stripe.Subscription>;
    retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
    retrieveCustomer(customerId: string): Promise<Stripe.Customer>;
    retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
    constructWebhookEvent(body: Buffer, signature: string): Promise<Stripe.Event>;
    listCustomerPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]>;
    createPrice(priceData: {
        productId: string;
        unitAmount: number;
        currency?: string;
        recurring?: {
            interval: 'month' | 'year';
            intervalCount?: number;
        };
    }): Promise<Stripe.Price>;
}
export declare const stripeService: StripeService;
export {};
