# Modex Learning Platform

A comprehensive, enterprise-grade microservices learning management system built with modern cloud-native technologies and deployed on Azure.

## 🚀 Quick Start

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd modex
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Access the platform**
   - API Gateway: http://localhost:3000
   - Health checks: http://localhost:3000/health

### Production Deployment (Azure)

1. **Deploy infrastructure**
   ```bash
   # Full deployment
   ./infrastructure/scripts/deploy.sh

   # Or step by step
   ./infrastructure/scripts/deploy.sh infrastructure
   ./infrastructure/scripts/deploy.sh applications
   ```

2. **Access production endpoints**
   - API: https://api.modex.platform
   - Monitoring: Grafana dashboard in AKS
   - Logs: Azure Application Insights

## 🏗️ Architecture

### Microservices

- **API Gateway** (Port 3000): Request routing, authentication, rate limiting
- **Course Management** (Port 3002): Course CRUD, content management, categories
- **Enrollment** (Port 3003): Student registration, enrollment, progress tracking
- **Assessment** (Port 3004): Quiz creation, submissions, automated grading
- **Payment** (Port 3005): Stripe integration, subscriptions, billing
- **Analytics** (Port 3006): Event tracking, dashboards, performance metrics

### Technology Stack

**Backend:**
- TypeScript/Node.js with Express.js
- Go with Gin framework
- PostgreSQL with Drizzle ORM (TypeScript) / GORM (Go)
- Redis for caching and sessions
- JWT authentication

**Infrastructure:**
- **Azure Kubernetes Service (AKS)** - Container orchestration
- **Azure PostgreSQL Flexible Server** - Managed database
- **Azure Cache for Redis** - Managed caching
- **Azure Container Registry** - Container images
- **Azure Application Insights** - Application monitoring
- **Azure Key Vault** - Secrets management

**DevOps & Automation:**
- **Terraform** - Infrastructure as Code
- **Helm** - Kubernetes application deployment
- **Ansible** - Configuration management
- **GitHub Actions** - CI/CD pipelines
- **Docker** - Containerization

## 🔧 Infrastructure

### Terraform Resources
- AKS cluster with auto-scaling node pools
- PostgreSQL Flexible Server with high availability
- Azure Cache for Redis with private endpoints
- Key Vault for secrets management
- Application Insights for monitoring
- Virtual Network with dedicated subnets

### Kubernetes Deployment
- Helm charts for all microservices
- Horizontal Pod Autoscaler
- Network policies for security
- Service monitors for Prometheus
- Ingress with SSL termination

## 📊 API Endpoints

### API Gateway (Port 3000)
- `GET /health` - Health check
- `POST /auth/login` - User authentication
- `POST /auth/register` - User registration
- `/*` - Proxy to microservices

### Course Management (Port 3002)
- `GET /api/courses` - List courses
- `POST /api/courses` - Create course
- `GET /api/courses/:id` - Get course details
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### Enrollment (Port 3003)
- `POST /api/enrollments` - Enroll in course
- `GET /api/enrollments/user/:userId` - User enrollments
- `PUT /api/enrollments/:id/progress` - Update progress

### Assessment (Port 3004)
- `GET /api/assessments` - List assessments
- `POST /api/assessments` - Create assessment
- `POST /api/submissions` - Submit assessment
- `GET /api/submissions/:id/grade` - Get grade

### Payment (Port 3005)
- `POST /api/payments` - Create payment
- `POST /api/subscriptions` - Manage subscriptions
- `POST /api/stripe/webhook` - Stripe webhooks

### Analytics (Port 3006)
- `POST /api/analytics/events` - Track events
- `GET /api/analytics/dashboard` - Analytics dashboard
- `GET /api/analytics/courses/:id` - Course analytics

## 🔒 Security

- **Authentication**: JWT-based authentication across all services
- **Authorization**: Role-based access control (admin, instructor, student)
- **Network Security**: Azure Network Security Groups and Kubernetes Network Policies
- **Secrets Management**: Azure Key Vault integration
- **SSL/TLS**: Automatic certificate management with cert-manager
- **Input Validation**: Comprehensive validation and sanitization
- **Rate Limiting**: API Gateway and Nginx rate limiting
- **Container Security**: Non-root containers, read-only filesystems

## 🧪 Testing & Quality

### Automated Testing
```bash
# TypeScript services
cd services/api-gateway && npm test
cd services/enrollment && npm test
cd services/payment && npm test
cd services/analytics && npm test

# Go services  
cd services/course-management && go test ./...
cd services/assessment && go test ./...
```

### Security Scanning
- **Trivy** - Container and filesystem vulnerability scanning
- **CodeQL** - Static application security testing
- **Snyk** - Dependency vulnerability scanning
- **GitLeaks** - Secrets detection

## 📈 Monitoring & Observability

### Application Monitoring
- **Azure Application Insights** - Application performance monitoring
- **Prometheus** - Metrics collection
- **Grafana** - Dashboards and visualization
- **Azure Log Analytics** - Centralized logging

### Alerting
- High response time alerts
- Error rate monitoring
- Resource utilization alerts
- Service availability monitoring

### Health Checks
All services expose health endpoints:
- `GET /health` - Service health status
- `GET /ready` - Readiness check

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow
1. **Security Scanning** - Vulnerability and secrets scanning
2. **Testing** - Unit and integration tests
3. **Building** - Container image builds
4. **Infrastructure** - Terraform plan and apply
5. **Deployment** - Helm deployments to AKS
6. **Verification** - Health checks and smoke tests

## 📦 Deployment

### Prerequisites
- Azure CLI
- Terraform 1.6+
- kubectl
- Helm 3.12+
- Docker

### Environment Configuration

**Development:**
```env
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/modex
REDIS_URL=redis://localhost:6379
```

**Production (Azure):**
```env
NODE_ENV=production
DATABASE_URL=# Retrieved from Azure Key Vault
REDIS_URL=# Retrieved from Azure Key Vault
JWT_SECRET=# Retrieved from Azure Key Vault
STRIPE_SECRET_KEY=# Retrieved from Azure Key Vault
```

### Deployment Commands

```bash
# Full production deployment
./infrastructure/scripts/deploy.sh

# Infrastructure only
./infrastructure/scripts/deploy.sh infrastructure

# Applications only
./infrastructure/scripts/deploy.sh applications

# Cleanup
./infrastructure/scripts/cleanup.sh
```

## 🔧 Development

### Adding a New Service

1. Create service directory: `services/new-service/`
2. Add to `docker-compose.yml`
3. Create Dockerfile
4. Add Terraform resources if needed
5. Create Helm templates
6. Update CI/CD pipeline
7. Configure routing in API Gateway

### Database Migrations

TypeScript services use Drizzle migrations:
```bash
cd services/[service-name]
npm run db:generate
npm run db:migrate
```

Go services use GORM auto-migration on startup.

## 🏥 Operational Procedures

### Monitoring Access
```bash
# Grafana dashboard
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Prometheus
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
```

### Troubleshooting
```bash
# Check pod status
kubectl get pods -n modex-platform

# View logs
kubectl logs -n modex-platform deployment/api-gateway

# Exec into pod
kubectl exec -it -n modex-platform deployment/api-gateway -- /bin/sh
```

### Scaling
```bash
# Manual scaling
kubectl scale deployment api-gateway --replicas=5 -n modex-platform

# HPA status
kubectl get hpa -n modex-platform
```

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check Azure Application Insights for application logs
- Review Kubernetes events: `kubectl get events -n modex-platform`
- Monitor Grafana dashboards for performance metrics

## 🎯 Enterprise Features

- **High Availability**: Multi-zone deployment with auto-scaling
- **Disaster Recovery**: Automated backups and geo-redundancy
- **Security Compliance**: Enterprise-grade security controls
- **Monitoring**: Comprehensive observability and alerting
- **DevOps Automation**: Full CI/CD with infrastructure as code
- **Cost Optimization**: Resource optimization and monitoring

---

**Enterprise-grade microservices learning platform** 🎓
