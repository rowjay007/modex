import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database settings
  dbUrl: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  
  // Upstash Redis settings
  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL || '',
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  
  // JWT settings
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  
  // Email settings (Mailtrap)
  emailHost: process.env.EMAIL_HOST || 'sandbox.smtp.mailtrap.io',
  emailPort: parseInt(process.env.EMAIL_PORT || '2525', 10),
  emailUsername: process.env.EMAIL_USERNAME || '',
  emailPassword: process.env.EMAIL_PASSWORD || '',
  emailAddress: process.env.EMAIL_ADDRESS || 'noreply@modex.com',
  
  // AWS settings removed - using Novu for all notification channels
  
  // Novu settings
  novuApiKey: process.env.NOVU_SECRET_KEY || '',
  novuApiUrl: process.env.NOVU_API_URL || 'https://api.novu.co',
  
  // Message broker settings
  rabbitMqUrl: process.env.RABBITMQ_URL || 'amqp://localhost',
  
  // Templates directory
  templatesDir: process.env.TEMPLATES_DIR || 'src/templates',
};
