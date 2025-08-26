"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentAttemptsRelations = exports.refundsRelations = exports.paymentsRelations = exports.subscriptions = exports.paymentAttempts = exports.refunds = exports.payments = exports.paymentMethodEnum = exports.paymentStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.paymentStatusEnum = (0, pg_core_1.pgEnum)('payment_status', [
    'pending',
    'processing',
    'succeeded',
    'failed',
    'canceled',
    'refunded'
]);
exports.paymentMethodEnum = (0, pg_core_1.pgEnum)('payment_method', [
    'card',
    'bank_transfer',
    'paypal',
    'wallet'
]);
exports.payments = (0, pg_core_1.pgTable)('payments', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').notNull(),
    courseId: (0, pg_core_1.uuid)('course_id'),
    subscriptionPlanId: (0, pg_core_1.uuid)('subscription_plan_id'),
    stripePaymentIntentId: (0, pg_core_1.varchar)('stripe_payment_intent_id', { length: 255 }),
    amount: (0, pg_core_1.decimal)('amount', { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('usd'),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).notNull().default('pending'),
    description: (0, pg_core_1.text)('description'),
    metadata: (0, pg_core_1.text)('metadata'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
    paidAt: (0, pg_core_1.timestamp)('paid_at'),
});
exports.refunds = (0, pg_core_1.pgTable)('refunds', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    paymentId: (0, pg_core_1.uuid)('payment_id').notNull().references(() => exports.payments.id),
    stripeRefundId: (0, pg_core_1.varchar)('stripe_refund_id', { length: 255 }),
    amount: (0, pg_core_1.decimal)('amount', { precision: 10, scale: 2 }).notNull(),
    reason: (0, pg_core_1.varchar)('reason', { length: 100 }),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).notNull().default('pending'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    processedAt: (0, pg_core_1.timestamp)('processed_at'),
});
exports.paymentAttempts = (0, pg_core_1.pgTable)('payment_attempts', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    paymentId: (0, pg_core_1.uuid)('payment_id').notNull().references(() => exports.payments.id),
    attemptNumber: (0, pg_core_1.integer)('attempt_number').notNull().default(1),
    errorCode: (0, pg_core_1.varchar)('error_code', { length: 100 }),
    errorMessage: (0, pg_core_1.text)('error_message'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.subscriptions = (0, pg_core_1.pgTable)('subscriptions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').notNull(),
    stripeSubscriptionId: (0, pg_core_1.varchar)('stripe_subscription_id', { length: 255 }),
    planId: (0, pg_core_1.varchar)('plan_id', { length: 100 }).notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).notNull().default('active'),
    currentPeriodStart: (0, pg_core_1.timestamp)('current_period_start').notNull(),
    currentPeriodEnd: (0, pg_core_1.timestamp)('current_period_end').notNull(),
    amount: (0, pg_core_1.decimal)('amount', { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('USD'),
    cancelAtPeriodEnd: (0, pg_core_1.boolean)('cancel_at_period_end').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
    canceledAt: (0, pg_core_1.timestamp)('canceled_at'),
});
exports.paymentsRelations = (0, drizzle_orm_1.relations)(exports.payments, ({ many }) => ({
    refunds: many(exports.refunds),
    attempts: many(exports.paymentAttempts),
}));
exports.refundsRelations = (0, drizzle_orm_1.relations)(exports.refunds, ({ one }) => ({
    payment: one(exports.payments, {
        fields: [exports.refunds.paymentId],
        references: [exports.payments.id],
    }),
}));
exports.paymentAttemptsRelations = (0, drizzle_orm_1.relations)(exports.paymentAttempts, ({ one }) => ({
    payment: one(exports.payments, {
        fields: [exports.paymentAttempts.paymentId],
        references: [exports.payments.id],
    }),
}));
//# sourceMappingURL=schema.js.map