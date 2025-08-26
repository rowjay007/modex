# Content Delivery Service

Enterprise-grade content delivery service for file uploads, storage, and CDN distribution with support for images, videos, documents, and other media assets.

## Features

### Core Functionality
- **File Upload**: Support for images, videos, documents, and other media types
- **Cloud Storage**: AWS S3 integration with multi-region support
- **CDN Distribution**: Global content delivery network integration
- **Presigned URLs**: Secure direct upload capabilities
- **Thumbnail Generation**: Automatic thumbnail creation for images and videos
- **Content Variants**: Multiple format support (HD, SD, thumbnails)

### Enterprise Features
- **Authentication & Authorization**: JWT-based authentication with role-based access
- **Rate Limiting**: Configurable rate limiting per user/IP
- **Security**: Input validation, file type restrictions, size limits
- **Caching**: Redis-based caching for metadata and access tokens
- **Monitoring**: Comprehensive health checks and performance metrics
- **Structured Logging**: JSON-formatted logs with request tracing

### Scalability & Performance
- **Horizontal Scaling**: Stateless service design for easy scaling
- **Async Processing**: Background jobs for thumbnail generation
- **Database**: PostgreSQL with connection pooling
- **Caching**: Multi-level caching (Redis + CDN)
- **Graceful Shutdown**: Proper resource cleanup on shutdown

## Architecture

### Service Structure
```
src/
├── config/           # Configuration management
├── handlers/         # HTTP request handlers
├── middleware/       # Request middleware (auth, rate limiting, etc.)
├── models/          # Database models
├── routes/          # Route definitions
├── services/        # Business logic services
└── utils/           # Utility functions and logging
```

### Technology Stack
- **Language**: Go 1.23
- **Framework**: Gin HTTP framework
- **Database**: PostgreSQL with GORM ORM
- **Cache**: Redis (Upstash)
- **Storage**: AWS S3
- **Monitoring**: Health checks and structured logging

## API Endpoints

### Content Management
- `POST /api/v1/content` - Upload new content
- `GET /api/v1/content` - List user content (paginated)
- `GET /api/v1/content/:id` - Get specific content
- `DELETE /api/v1/content/:id` - Delete content
- `POST /api/v1/content/presigned-url` - Generate presigned upload URL

### Health & Monitoring
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness probe with dependencies
- `GET /health/live` - Liveness probe

## Environment Variables

### Required
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/content_delivery

# Redis
UPSTASH_REDIS_REST_URL=localhost:6379
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=your-bucket-name

# Security
JWT_SECRET=your_jwt_secret
API_KEY=your_service_api_key
```

### Optional
```bash
# Service Configuration
PORT=8084
ENV=development
CDN_BASE_URL=https://cdn.yourdomain.com
MAX_FILE_SIZE=104857600  # 100MB in bytes

# S3 Configuration (for MinIO or other S3-compatible services)
S3_ENDPOINT=http://localhost:9000
```

## Quick Start

### 1. Install Dependencies
```bash
go mod tidy
go mod download
```

### 2. Set Environment Variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup
```bash
# Run database migrations (when implemented)
go run cmd/migrate/main.go
```

### 4. Start the Service
```bash
# Development with hot reload
make dev

# Production
make build
./content-delivery

# Using Docker
docker-compose up
```

## Usage Examples

### Upload Content
```bash
curl -X POST http://localhost:8084/api/v1/content \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/image.jpg" \
  -F "title=My Image" \
  -F "description=Sample image upload" \
  -F "isPublic=true"
```

### Get Presigned Upload URL
```bash
curl -X POST http://localhost:8084/api/v1/content/presigned-url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "document.pdf",
    "contentType": "application/pdf"
  }'
```

### List User Content
```bash
curl -X GET http://localhost:8084/api/v1/content?page=1&limit=10 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Security Features

### Authentication
- JWT token validation
- API key authentication for service-to-service communication
- Role-based access control

### File Security
- File type validation
- File size limits
- MIME type verification
- Content scanning (extensible)

### Access Control
- Private/Public content visibility
- Course/module/lesson association
- Owner-based permissions

## Monitoring & Observability

### Health Checks
- Basic health: `/health`
- Readiness: `/health/ready` (checks DB, Redis, S3)
- Liveness: `/health/live`

### Logging
- Structured JSON logging
- Request ID tracking
- Performance metrics
- Error tracking with context

### Metrics (Future)
- Prometheus metrics
- Grafana dashboards
- Jaeger tracing

## Development

### Project Structure
```
services/content-delivery/
├── src/
│   ├── config/          # Configuration
│   ├── handlers/        # HTTP handlers
│   ├── middleware/      # Middleware
│   ├── models/          # Database models
│   ├── routes/          # Route definitions
│   ├── services/        # Business logic
│   └── utils/           # Utilities
├── tests/               # Test files
├── Dockerfile          # Container configuration
├── docker-compose.yml  # Local development
├── Makefile           # Build commands
└── README.md          # This file
```

### Testing
```bash
# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run specific test
go test ./src/handlers -v
```

### Database Schema
The service uses the following database tables:
- `contents` - Main content records
- `content_variants` - Different formats/versions of content
- `upload_sessions` - Temporary upload sessions for resumable uploads

## Production Deployment

### Docker Deployment
```bash
# Build image
docker build -t content-delivery:latest .

# Run container
docker run -p 8084:8084 \
  -e DATABASE_URL=... \
  -e UPSTASH_REDIS_REST_URL=... \
  content-delivery:latest
```

### Kubernetes Deployment
```yaml
# See k8s/ directory for Kubernetes manifests
kubectl apply -f k8s/
```

### Environment-Specific Configurations
- **Development**: Local PostgreSQL, Redis, MinIO
- **Staging**: Cloud services with test data
- **Production**: Production-grade AWS services with monitoring

## Contributing

1. Follow Go best practices
2. Use camelCase for JSON and Go identifiers
3. Add comprehensive logging
4. Write tests for new features
5. Update documentation
6. Follow enterprise patterns established in other services

## Enterprise Integration

This service is designed to integrate seamlessly with the existing microservices architecture:
- **API Gateway**: Route requests through the gateway
- **Authentication**: Shared JWT validation with user-management service
- **Event Bus**: Future integration for content processing events
- **Service Mesh**: Ready for Istio/Linkerd integration

## Future Enhancements

- [ ] Content processing pipeline (video transcoding, image optimization)
- [ ] CDN integration with CloudFront/CloudFlare
- [ ] Real-time upload progress tracking
- [ ] Content versioning and history
- [ ] Advanced search and filtering
- [ ] Usage analytics and reporting
- [ ] Multi-tenant support
- [ ] GDPR compliance features (data export, deletion)

## Support

For issues and questions, please refer to the main project documentation or create an issue in the project repository.