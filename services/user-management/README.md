# User Management Service

A microservice for handling user authentication, authorization, and profile management in the Modex platform.

## Features

- User registration and authentication
- Role-based access control (student, instructor, admin)
- Profile management
- Session management with Redis
- Event publishing via NATS
- gRPC support for inter-service communication
- OpenTelemetry integration for observability
- Sentry for error tracking

## Tech Stack

- TypeScript
- Express.js
- PostgreSQL with Drizzle ORM
- Redis (UpStash)
- NATS for event streaming
- gRPC for service communication
- Docker for containerization
- Kubernetes for orchestration

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL
- Redis (UpStash)
- NATS Server

### Environment Variables

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/user_management
JWT_SECRET=your-secret-key
REDIS_URL=your-upstash-redis-url
NATS_URL=nats://localhost:4222
SENTRY_DSN=your-sentry-dsn
```

### Installation

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Docker

```bash
# Build image
docker build -t user-management .

# Run container
docker run -p 3000:3000 user-management
```

## API Documentation

Swagger UI is available at `/api-docs` when the server is running.

## Contributing

Please follow the project's coding standards and commit message conventions.

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request