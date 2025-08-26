import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3005'),
  
  // Database configuration
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/modex_payment',
  DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/modex_payment',
  
  // Redis configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // JWT configuration
  JWT_SECRET: process.env.JWT_SECRET || 'payment-service-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // Stripe configuration
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  
  // CORS configuration
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  // Rate limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100'), // requests per window
  
  // Service URLs
  SERVICES: {
    API_GATEWAY: process.env.API_GATEWAY_URL || 'http://localhost:3000',
    USER_MANAGEMENT: process.env.USER_MANAGEMENT_URL || 'http://localhost:3001',
    COURSE_MANAGEMENT: process.env.COURSE_MANAGEMENT_URL || 'http://localhost:3002',
    ENROLLMENT: process.env.ENROLLMENT_URL || 'http://localhost:3003',
  },
  
  // Webhook configuration
  WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL || 'http://localhost:3005/webhooks',
  
  // Payment configuration
  CURRENCY: process.env.DEFAULT_CURRENCY || 'usd',
  PAYMENT_TIMEOUT: parseInt(process.env.PAYMENT_TIMEOUT || '1800'), // 30 minutes
  
  // Subscription configuration
  SUBSCRIPTION_TRIAL_DAYS: parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS || '7'),
};
