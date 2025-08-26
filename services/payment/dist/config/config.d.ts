export declare const config: {
    NODE_ENV: string;
    PORT: number;
    DATABASE_URL: string;
    DIRECT_URL: string;
    REDIS_URL: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_PUBLISHABLE_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    CORS_ORIGINS: string[];
    RATE_LIMIT_WINDOW: number;
    RATE_LIMIT_MAX: number;
    SERVICES: {
        API_GATEWAY: string;
        USER_MANAGEMENT: string;
        COURSE_MANAGEMENT: string;
        ENROLLMENT: string;
    };
    WEBHOOK_BASE_URL: string;
    CURRENCY: string;
    PAYMENT_TIMEOUT: number;
    SUBSCRIPTION_TRIAL_DAYS: number;
};
