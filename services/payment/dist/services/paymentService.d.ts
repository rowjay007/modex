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
declare class PaymentService {
    createPayment(paymentData: CreatePaymentData): Promise<{
        payment: {
            id: string;
            userId: string;
            courseId: string | null;
            subscriptionPlanId: string | null;
            stripePaymentIntentId: string | null;
            amount: string;
            currency: string;
            status: string;
            description: string | null;
            metadata: string | null;
            createdAt: Date;
            updatedAt: Date;
            paidAt: Date | null;
        };
        clientSecret: string | null;
    }>;
    createSubscription(subscriptionData: CreateSubscriptionData): Promise<{
        subscription: {
            id: string;
            userId: string;
            amount: string;
            currency: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            stripeSubscriptionId: string | null;
            planId: string;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            cancelAtPeriodEnd: boolean | null;
            canceledAt: Date | null;
        };
        stripeSubscription: import("stripe").Stripe.Subscription;
    }>;
    getPaymentById(paymentId: string): Promise<any>;
    getUserPayments(userId: string, limit?: number, offset?: number): Promise<{
        id: string;
        userId: string;
        courseId: string | null;
        subscriptionPlanId: string | null;
        stripePaymentIntentId: string | null;
        amount: string;
        currency: string;
        status: string;
        description: string | null;
        metadata: string | null;
        createdAt: Date;
        updatedAt: Date;
        paidAt: Date | null;
    }[]>;
    updatePaymentStatus(paymentId: string, status: string, metadata?: Record<string, any>): Promise<{
        id: string;
        userId: string;
        courseId: string | null;
        subscriptionPlanId: string | null;
        stripePaymentIntentId: string | null;
        amount: string;
        currency: string;
        status: string;
        description: string | null;
        metadata: string | null;
        createdAt: Date;
        updatedAt: Date;
        paidAt: Date | null;
    }>;
    createRefund(paymentId: string, amount?: number, reason?: string): Promise<{
        id: string;
        amount: string;
        status: string;
        createdAt: Date;
        paymentId: string;
        stripeRefundId: string | null;
        reason: string | null;
        processedAt: Date | null;
    }>;
    cancelSubscription(subscriptionId: string): Promise<{
        id: string;
        userId: string;
        amount: string;
        currency: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        stripeSubscriptionId: string | null;
        planId: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        cancelAtPeriodEnd: boolean | null;
        canceledAt: Date | null;
    }>;
    getUserSubscriptions(userId: string): Promise<{
        id: string;
        userId: string;
        amount: string;
        currency: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        stripeSubscriptionId: string | null;
        planId: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        cancelAtPeriodEnd: boolean | null;
        canceledAt: Date | null;
    }[]>;
    handleWebhookEvent(event: any): Promise<void>;
    private getOrCreateStripeCustomer;
    private cachePaymentData;
    private getCachedPaymentData;
    private handlePaymentSucceeded;
    private handlePaymentFailed;
    private handleSubscriptionPaymentSucceeded;
    private handleSubscriptionCanceled;
}
export declare const paymentService: PaymentService;
export {};
