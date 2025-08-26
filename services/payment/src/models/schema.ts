import { pgTable, uuid, varchar, decimal, timestamp, text, pgEnum, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Payment status enum
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'processing', 
  'succeeded',
  'failed',
  'canceled',
  'refunded'
]);

// Payment method enum
export const paymentMethodEnum = pgEnum('payment_method', [
  'card',
  'bank_transfer',
  'paypal',
  'wallet'
]);

// Payments table
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  courseId: uuid('course_id'),
  subscriptionPlanId: uuid('subscription_plan_id'),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  
  // Payment details
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('usd'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  
  // Metadata
  description: text('description'),
  metadata: text('metadata'), // JSON string for additional data
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  paidAt: timestamp('paid_at'),
});

// Refunds table
export const refunds = pgTable('refunds', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').notNull().references(() => payments.id),
  stripeRefundId: varchar('stripe_refund_id', { length: 255 }),
  
  // Refund details
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  reason: varchar('reason', { length: 100 }),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
});

// Payment attempts table (for failed payments)
export const paymentAttempts = pgTable('payment_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').notNull().references(() => payments.id),
  
  // Attempt details
  attemptNumber: integer('attempt_number').notNull().default(1),
  errorCode: varchar('error_code', { length: 100 }),
  errorMessage: text('error_message'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Subscriptions table (for recurring payments)
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  
  // Subscription details
  planId: varchar('plan_id', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  
  // Pricing
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  
  // Settings
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  canceledAt: timestamp('canceled_at'),
});

// Define relationships
export const paymentsRelations = relations(payments, ({ many }) => ({
  refunds: many(refunds),
  attempts: many(paymentAttempts),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, {
    fields: [refunds.paymentId],
    references: [payments.id],
  }),
}));

export const paymentAttemptsRelations = relations(paymentAttempts, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentAttempts.paymentId],
    references: [payments.id],
  }),
}));
