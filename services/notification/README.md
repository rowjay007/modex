# Notification Service with Novu Integration

A powerful notification service that leverages Novu to deliver notifications across multiple channels (email, SMS, push, in-app) from a single API.

## Features

- Multi-channel notifications (email, SMS, push, in-app) through a unified API
- Real-time in-app notifications with Redis caching
- Notification templates with support for dynamic content
- Subscriber management for personalized notification preferences
- Database persistence for notification history and audit trails
- Automatic retry logic for failed notifications

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Server configuration
PORT=3001
NODE_ENV=development

# Database configuration
DIRECT_URL=postgres://username:password@host:port/database
DATABASE_URL=postgres://username:password@host:port/database

# Redis configuration
REDIS_URL=redis://username:password@host:port

# JWT configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1d

# Email configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
EMAIL_FROM=noreply@modex.com

# AWS configuration for SMS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Novu configuration
NOVU_SECRET_KEY=your-novu-api-key
NOVU_API_URL=https://api.novu.co

# Message broker configuration
RABBITMQ_URL=amqp://localhost
```

## Setup and Installation

1. Clone the repository
2. Install dependencies: `yarn install` or `npm install`
3. Set up environment variables as described above
4. Run database migration: `yarn migrate:novu`
5. Start the development server: `yarn dev`

## API Documentation

The API documentation is available at `/docs` when the server is running.

## Novu Integration

This service integrates with [Novu](https://novu.co/), an open-source notification infrastructure. The integration provides:

1. **Subscriber Management**: Register and manage users as Novu subscribers
2. **Template Support**: Create and manage notification templates in Novu
3. **Multi-channel Delivery**: Send notifications through email, SMS, push, and in-app channels
4. **Notification Preferences**: Allow users to manage their notification preferences

### Using the Notification Service

```typescript
// Example: Sending a notification
const notification = await notificationService.sendNotification({
  recipientId: 123,
  recipientEmail: 'user@example.com',
  channel: 'email',
  subject: 'Welcome to Modex',
  content: 'Thank you for joining our platform!',
  priority: 'high',
  data: { firstName: 'John', activationLink: 'https://example.com/activate' }
});
```

## Database Schema

The service uses the following main database tables:

1. `notifications`: Stores notification records
2. `notification_templates`: Stores notification templates
3. `notification_settings`: Stores user notification preferences

## Development

### Running Tests

```bash
yarn test
```

### Code Linting

```bash
yarn lint
```

### Building for Production

```bash
yarn build
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.