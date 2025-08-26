# Modex - Microservices Learning Platform

A comprehensive learning management system built with microservices architecture, featuring course management, user enrollment, assessments, payments, and analytics.

## 🏗️ Architecture Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │────│     Nginx   │────│ API Gateway │
└─────────────┘    └─────────────┘    └─────────────┘
                                              │
                   ┌──────────────────────────┼──────────────────────────┐
                   │                          │                          │
            ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
            │   Course    │           │ Enrollment  │           │ Assessment  │
            │ Management  │           │   Service   │           │   Service   │
            └─────────────┘           └─────────────┘           └─────────────┘
                   │                          │                          │
                   └──────────────────────────┼──────────────────────────┘
                                              │
                   ┌──────────────────────────┼──────────────────────────┐
                   │                          │                          │
            ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
            │   Payment   │           │  Analytics  │           │    Redis    │
            │   Service   │           │   Service   │           │   (Cache)   │
            └─────────────┘           └─────────────┘           └─────────────┘
                   │                          │                          
                   └──────────────────────────┴──────────────────────────
                                              │
                                    ┌─────────────┐
                                    │ PostgreSQL  │
                                    │ (Database)  │
                                    └─────────────┘
```

## 🚀 Services

### API Gateway (Port 3000)
- **Technology**: Node.js + Express + TypeScript
- **Purpose**: Routes and proxies requests to microservices
- **Features**: Authentication, rate limiting, CORS, request logging

### Course Management (Port 3002)
- **Technology**: Go + Gin Framework
- **Purpose**: Manages courses, modules, lessons, and categories
- **Database**: PostgreSQL with GORM

### Enrollment Service (Port 3003)
- **Technology**: Node.js + Express + TypeScript
- **Purpose**: Handles student enrollments and course progress
- **Database**: PostgreSQL with Drizzle ORM

### Assessment Service (Port 3004)  
- **Technology**: Go + Gin Framework
- **Purpose**: Quiz/test creation, submissions, and grading
- **Database**: PostgreSQL with GORM

### Payment Service (Port 3005)
- **Technology**: Node.js + Express + TypeScript
- **Purpose**: Payment processing with Stripe integration
- **Features**: Subscriptions, refunds, webhook handling

### Analytics Service (Port 3006)
- **Technology**: Node.js + Express + TypeScript
- **Purpose**: User behavior tracking and course performance analytics
- **Features**: Real-time event processing, Redis batching

## 🏃 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for development)
- Go 1.19+ (for development)

### Environment Setup

1. **Clone and configure**
```bash
git clone <repository-url>
cd modex
cp .env.example .env
```

2. **Start all services with Docker**
```bash
docker-compose up -d
```

3. **View logs**
```bash
docker-compose logs -f
```

## 📡 API Endpoints

All requests go through the API Gateway at `http://localhost:3000`

### Core Routes
- **Health**: `GET /health`
- **Courses**: `GET|POST /api/courses`
- **Enrollment**: `POST /api/enrollment/enroll`
- **Assessment**: `GET|POST /api/assessments`  
- **Payment**: `POST /api/payment/create`
- **Analytics**: `POST /api/analytics/events`

## 🔧 Technology Stack

- **Languages**: TypeScript, Go
- **Frameworks**: Express.js, Gin
- **Database**: PostgreSQL with Drizzle ORM (TS) / GORM (Go)
- **Cache**: Redis
- **Infrastructure**: Docker, Nginx
- **Authentication**: JWT
- **Payments**: Stripe

## 🚀 Deployment

### Docker Compose (Recommended)
```bash
# Production deployment
docker-compose up -d

# With custom environment
docker-compose --env-file .env.production up -d
```

### Individual Services
Each service can be run independently for development:

```bash
# API Gateway
cd services/api-gateway && npm run dev

# Course Management  
cd services/course-management && go run src/main.go

# Other services...
```

## 🔒 Security Features

- JWT authentication across all services
- Rate limiting via Nginx and API Gateway
- CORS protection
- Input validation
- SQL injection prevention via ORM
- Docker container isolation

## 📊 Monitoring

- Health check endpoints on all services
- Structured logging with Pino
- Analytics service for behavior tracking
- Database and Redis health monitoring

---

**Enterprise-grade microservices learning platform** 🎓
