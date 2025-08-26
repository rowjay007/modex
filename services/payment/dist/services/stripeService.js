"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const config_1 = require("../config/config");
class StripeService {
    constructor() {
        if (!config_1.config.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is required');
        }
        this.stripe = new stripe_1.default(config_1.config.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        });
    }
    async createCustomer(customerData) {
        return await this.stripe.customers.create({
            email: customerData.email,
            name: customerData.name,
            metadata: customerData.metadata || {},
        });
    }
    async createPaymentIntent(paymentData) {
        return await this.stripe.paymentIntents.create({
            amount: Math.round(paymentData.amount * 100),
            currency: paymentData.currency || config_1.config.CURRENCY,
            customer: paymentData.customerId,
            metadata: paymentData.metadata || {},
            description: paymentData.description,
            automatic_payment_methods: {
                enabled: true,
            },
        });
    }
    async confirmPaymentIntent(paymentIntentId) {
        return await this.stripe.paymentIntents.confirm(paymentIntentId);
    }
    async cancelPaymentIntent(paymentIntentId) {
        return await this.stripe.paymentIntents.cancel(paymentIntentId);
    }
    async createRefund(refundData) {
        return await this.stripe.refunds.create({
            payment_intent: refundData.paymentIntentId,
            amount: refundData.amount ? Math.round(refundData.amount * 100) : undefined,
            reason: refundData.reason,
            metadata: refundData.metadata || {},
        });
    }
    async createSubscription(subscriptionData) {
        return await this.stripe.subscriptions.create({
            customer: subscriptionData.customerId,
            items: [{ price: subscriptionData.priceId }],
            trial_period_days: subscriptionData.trialPeriodDays || config_1.config.SUBSCRIPTION_TRIAL_DAYS,
            metadata: subscriptionData.metadata || {},
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
        });
    }
    async cancelSubscription(subscriptionId) {
        return await this.stripe.subscriptions.cancel(subscriptionId);
    }
    async updateSubscription(subscriptionId, updateData) {
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
    async retrievePaymentIntent(paymentIntentId) {
        return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    }
    async retrieveCustomer(customerId) {
        return await this.stripe.customers.retrieve(customerId);
    }
    async retrieveSubscription(subscriptionId) {
        return await this.stripe.subscriptions.retrieve(subscriptionId);
    }
    async constructWebhookEvent(body, signature) {
        if (!config_1.config.STRIPE_WEBHOOK_SECRET) {
            throw new Error('STRIPE_WEBHOOK_SECRET is required for webhook verification');
        }
        return this.stripe.webhooks.constructEvent(body, signature, config_1.config.STRIPE_WEBHOOK_SECRET);
    }
    async listCustomerPaymentMethods(customerId) {
        const paymentMethods = await this.stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
        });
        return paymentMethods.data;
    }
    async createPrice(priceData) {
        return await this.stripe.prices.create({
            product: priceData.productId,
            unit_amount: Math.round(priceData.unitAmount * 100),
            currency: priceData.currency || config_1.config.CURRENCY,
            recurring: priceData.recurring,
        });
    }
}
exports.stripeService = new StripeService();
//# sourceMappingURL=stripeService.js.map