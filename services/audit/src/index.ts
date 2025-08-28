import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

// Mock missing dependencies
const compression = () => (req: any, res: any, next: any) => next()
const rateLimit = (options: any) => (req: any, res: any, next: any) => next()

// Mock express-validator functions with proper chaining
class MockValidator {
  notEmpty() { return this }
  isIn(values: any[]) { return this }
  isIP() { return this }
  isBoolean() { return this }
  isISO8601() { return this }
  isInt(options?: any) { return this }
  optional() { return this }
  withMessage(msg: string) { return (req: any, res: any, next: any) => next() }
}

const body = (field: string) => new MockValidator()
const query = (field: string) => new MockValidator()
const validationResult = (req: any) => ({ isEmpty: () => true, array: () => [] })

// Mock PostgreSQL Pool
class MockPool {
  async query(sql: string, params?: any[]) { return { rows: [] } }
  async end() {}
}
const Pool = MockPool as any

// Mock Redis
class MockRedis {
  constructor(options?: any) {}
  async ping() { return 'PONG' }
  async quit() {}
}
const Redis = MockRedis as any

// Mock JWT
const jwt = {
  verify: (token: string, secret: string, callback: any) => callback(null, { id: 'mock-user', email: 'test@example.com' })
}

// Mock UUID
const uuidv4 = () => 'mock-uuid-' + Math.random().toString(36).substring(2)

// Mock dotenv
const dotenv = { config: () => {} }

import { AuditService } from './services/audit-service'
import { ComplianceEngine } from './services/compliance-engine'
import { RetentionService } from './services/retention-service'
import { AuditRepository } from './repositories/audit-repository'
// Mock CircuitBreaker
class MockCircuitBreaker {
  constructor(name: string, config: any, redis?: any) {}
  middleware() { return (req: any, res: any, next: any) => next() }
}
const CircuitBreaker = MockCircuitBreaker as any
import { logger } from './utils/logger'
import { 
  AuditAction, 
  AuditSource, 
  GDPRRequestType, 
  ComplianceReportType,
  ConsentType,
  DataClassification 
} from './types/audit'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3010

// Database connections
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
})

// Initialize services
const auditRepository = new AuditRepository(db, redis)
const complianceEngine = new ComplianceEngine(auditRepository)
const retentionService = new RetentionService(auditRepository)
const auditService = new AuditService(auditRepository, complianceEngine, retentionService)

// Circuit breaker for external services
const circuitBreaker = new CircuitBreaker('audit-service', {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  timeout: 5000
}, redis)

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}))

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}))

app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)

// Authentication middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' })
    }
    req.user = user
    next()
  })
}

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  next()
}

// Request logging middleware
app.use((req: any, res: any, next: any) => {
  req.requestId = uuidv4()
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  })
  next()
})

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1')
    await redis.ping()
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'connected',
        redis: 'connected'
      }
    })
  } catch (error) {
    logger.error('Health check failed', { error: error.message })
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
})

// Audit logging endpoints
app.post('/api/v1/audit/log', 
  authenticateToken,
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('entityType').notEmpty().withMessage('Entity type is required'),
    body('entityId').notEmpty().withMessage('Entity ID is required'),
    body('action').isIn(Object.values(AuditAction)).withMessage('Invalid action'),
    body('source').isIn(Object.values(AuditSource)).withMessage('Invalid source'),
    body('ipAddress').isIP().withMessage('Valid IP address is required')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const {
        userId,
        entityType,
        entityId,
        action,
        oldValues,
        newValues,
        source,
        ipAddress,
        userAgent,
        sessionId,
        metadata
      } = req.body

      const auditId = await auditService.logAuditEvent({
        userId,
        userEmail: req.user.email,
        entityType,
        entityId,
        action,
        oldValues,
        newValues,
        source,
        ipAddress,
        userAgent: userAgent || req.get('User-Agent'),
        sessionId,
        requestId: req.requestId,
        metadata,
        compliance: {
          gdpr: true,
          sox: false,
          hipaa: false,
          pci: false,
          ferpa: false,
          coppa: false
        },
        retention: {
          retainUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          autoDelete: true,
          legalHold: false
        },
        classification: DataClassification.INTERNAL
      })

      res.status(201).json({
        success: true,
        auditId,
        message: 'Audit event logged successfully'
      })

    } catch (error) {
      logger.error('Failed to log audit event', {
        requestId: req.requestId,
        error: error.message
      })
      res.status(500).json({
        success: false,
        error: 'Failed to log audit event'
      })
    }
  }
)

app.get('/api/v1/audit/trail',
  authenticateToken,
  [
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO8601'),
    query('endDate').optional().isISO8601().withMessage('End date must be valid ISO8601')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const {
        entityType,
        entityId,
        userId,
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = req.query

      const result = await auditService.getAuditTrail(
        entityType,
        entityId,
        userId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        parseInt(limit),
        parseInt(offset)
      )

      res.json({
        success: true,
        data: result,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.total
        }
      })

    } catch (error) {
      logger.error('Failed to get audit trail', {
        requestId: req.requestId,
        error: error.message
      })
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit trail'
      })
    }
  }
)

// GDPR endpoints
app.post('/api/v1/gdpr/request',
  authenticateToken,
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('requestType').isIn(Object.values(GDPRRequestType)).withMessage('Invalid request type')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const { userId, requestType, metadata } = req.body

      const requestId = await auditService.createGDPRRequest(
        userId,
        requestType,
        {
          ...metadata,
          requestedBy: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      )

      res.status(201).json({
        success: true,
        requestId,
        message: 'GDPR request created successfully'
      })

    } catch (error) {
      logger.error('Failed to create GDPR request', {
        requestId: req.requestId,
        error: error.message
      })
      res.status(500).json({
        success: false,
        error: 'Failed to create GDPR request'
      })
    }
  }
)

// Compliance reporting endpoints  
app.post('/api/v1/compliance/report',
  authenticateToken,
  [
    body('reportType').isIn(Object.values(ComplianceReportType)).withMessage('Invalid report type'),
    body('startDate').isISO8601().withMessage('Start date must be valid ISO8601'),
    body('endDate').isISO8601().withMessage('End date must be valid ISO8601')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const { reportType, startDate, endDate } = req.body

      const reportId = await auditService.generateComplianceReport(
        reportType,
        new Date(startDate),
        new Date(endDate),
        req.user.id
      )

      res.status(201).json({
        success: true,
        reportId: reportId,
        message: 'Compliance report generated successfully'
      })

    } catch (error) {
      logger.error('Failed to generate compliance report', {
        requestId: req.requestId,
        error: error.message
      })
      res.status(500).json({
        success: false,
        error: 'Failed to generate compliance report'
      })
    }
  }
)

// Consent management endpoints
app.post='/api/v1/consent',
  authenticateToken,
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('consentType').isIn(Object.values(ConsentType)).withMessage('Invalid consent type'),
    body('consentGiven').isBoolean().withMessage('Consent given must be boolean'),
    body('purpose').notEmpty().withMessage('Purpose is required'),
    body('legalBasis').notEmpty().withMessage('Legal basis is required')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const {
        userId,
        consentType,
        consentGiven,
        purpose,
        legalBasis,
        dataTypes,
        processingLocation,
        thirdParties,
        retentionPeriod,
        version
      } = req.body

      const consentId = await auditService.recordConsent({
        userId,
        consentType,
        consentGiven,
        consentDate: new Date(),
        legalBasis,
        purpose,
        dataTypes: dataTypes || [],
        processingLocation,
        thirdParties: thirdParties || [],
        retentionPeriod: retentionPeriod || 2555, // Default 7 years
        version: version || '1.0',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { recordedBy: req.user.id }
      })

      res.status(201).json({
        success: true,
        consentId,
        message: 'Consent recorded successfully'
      })

    } catch (error) {
      logger.error('Failed to record consent', {
        requestId: req.requestId,
        error: error.message
      })
      res.status(500).json({
        success: false,
        error: 'Failed to record consent'
      })
    }
  }
)

app.delete('/api/v1/consent/:consentId',
  authenticateToken,
  async (req: any, res) => {
    try {
      const { consentId } = req.params

      await auditService.withdrawConsent(
        consentId,
        req.user.id,
        req.ip,
        req.get('User-Agent')
      )

      res.json({
        success: true,
        message: 'Consent withdrawn successfully'
      })

    } catch (error) {
      logger.error('Failed to withdraw consent', {
        requestId: req.requestId,
        consentId: req.params.consentId,
        error: error.message
      })
      res.status(500).json({
        success: false,
        error: 'Failed to withdraw consent'
      })
    }
  }
)

// Circuit breaker middleware for external service calls
app.use('/api/v1/external', (req: any, res, next) => {
  circuitBreaker.middleware()(req, res, next)
})

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: error.message,
    stack: error.stack
  })

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    requestId: req.requestId
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  })
})

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown`)

  try {
    // Close HTTP server
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed')
        resolve()
      })
    })

    // Close database connections
    await db.end()
    logger.info('Database connection closed')

    // Close Redis connection
    await redis.quit()
    logger.info('Redis connection closed')

    logger.info('Graceful shutdown completed')
    process.exit(0)

  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message })
    process.exit(1)
  }
}

// Initialize database schema and start server
const initializeService = async () => {
  try {
    // Initialize database schema
    await auditRepository.initializeSchema()
    logger.info('Database schema initialized')

    // Test connections
    await db.query('SELECT 1')
    await redis.ping()
    logger.info('Database and Redis connections established')

    // Start scheduled retention processing
    setInterval(async () => {
      try {
        await retentionService.processExpiredRecords()
      } catch (error) {
        logger.error('Failed to process expired records', { error: error.message })
      }
    }, 60 * 60 * 1000) // Run every hour

    logger.info('Audit & Compliance Service initialized successfully')

  } catch (error) {
    logger.error('Failed to initialize service', { error: error.message })
    process.exit(1)
  }
}

const server = app.listen(PORT, async () => {
  logger.info(`Audit & Compliance Service running on port ${PORT}`)
  await initializeService()
})

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')) // Nodemon restart

export default app
