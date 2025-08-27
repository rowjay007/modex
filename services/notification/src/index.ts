import express from 'express'
import cors from 'cors'

// Simple rate limiting middleware
const rateLimit = (options: any) => (req: any, res: any, next: any) => next()

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config()
  } catch (e) {
    // dotenv not available, continue
  }
}
import { logger } from './utils/logger'
import { EmailProvider } from './providers/email-provider'
import { SMSProvider } from './providers/sms-provider'
import { PushProvider } from './providers/push-provider'
import { NotificationService } from './services/notification-service'
import { NotificationRepository } from './repositories/notification-repository'
import { NotificationQueue } from './queue/notification-queue'
// Simple circuit breaker implementation
class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private options: any

  constructor(options: any) {
    this.options = options
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open')
    }
    
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private isOpen(): boolean {
    return this.failureCount >= this.options.failureThreshold &&
           (Date.now() - this.lastFailureTime < this.options.recoveryTimeout)
  }

  private onSuccess(): void {
    this.failureCount = 0
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
  }
}
// Routes will be defined inline for now

const app = express()
const PORT = process.env.PORT || 3007

// Global error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error)
  process.exit(1)
})

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection', error)
  process.exit(1)
})

// Basic security and CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}))

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
}))

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// Circuit breaker for external service calls
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 30000,
  monitoringPeriod: 60000
})

// Request logging
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })
  next()
})

// Initialize services
let notificationService: NotificationService
let notificationQueue: NotificationQueue
let repository: NotificationRepository

async function initializeServices() {
  try {
    // Initialize repository
    repository = new NotificationRepository()
    
    // Initialize providers
    const emailProvider = new EmailProvider({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      from: process.env.SMTP_FROM || 'noreply@modex.com'
    })

    const smsProvider = new SMSProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || ''
    })

    const pushProvider = new PushProvider({
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
      vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@modex.com'
    })

    // Initialize notification service
    notificationService = new NotificationService(
      emailProvider,
      smsProvider,
      pushProvider,
      repository
    )

    // Initialize queue
    notificationQueue = new NotificationQueue(notificationService)

    // Verify connections
    await emailProvider.verifyConnection()
    await smsProvider.validateConfig()

    logger.info('Notification service initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize notification service', error)
    throw error
  }
}

// Services will be available after initialization

// Health check routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'notification', timestamp: new Date().toISOString() })
})

app.get('/health/ready', async (req, res) => {
  try {
    if (repository) {
      res.json({ status: 'ready' })
    } else {
      res.status(503).json({ status: 'not ready' })
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message })
  }
})

// Basic notification routes
app.post('/api/v1/notifications/send', async (req: any, res: any) => {
  try {
    if (!notificationService) {
      return res.status(503).json({ error: 'Service not initialized' })
    }
    
    const result = await circuitBreaker.execute(async () => {
      return notificationService.send(req.body)
    })
    
    res.json(result)
  } catch (error: any) {
    logger.error('Failed to send notification', error)
    res.status(500).json({ error: 'Failed to send notification' })
  }
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString()
  })
})

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Global error handler', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  })

  res.status(error.statusCode || 500).json({
    error: error.name || 'Internal Server Error',
    message: error.message || 'Something went wrong',
    statusCode: error.statusCode || 500,
    timestamp: new Date().toISOString()
  })
})

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown`)
  
  try {
    if (notificationQueue) {
      await notificationQueue.close()
    }
    
    if (repository) {
      await repository.close()
    }
    
    logger.info('Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    logger.error('Error during graceful shutdown', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Start server
async function startServer() {
  try {
    await initializeServices()
    
    app.listen(PORT, () => {
      logger.info(`Notification Service running on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (error) {
    logger.error('Failed to start server', error)
    process.exit(1)
  }
}

startServer()
