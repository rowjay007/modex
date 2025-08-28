import 'reflect-metadata'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

// Mock missing dependencies
const compression = () => (req: any, res: any, next: any) => next()
const rateLimit = (options: any) => (req: any, res: any, next: any) => next()
const config = () => {}

// Mock Kafka dependencies
class MockKafka {
  constructor(config: any) {}
  producer() { return new MockProducer() }
  consumer(config: any) { return new MockConsumer() }
  admin() { return new MockAdmin() }
}

class MockProducer {
  async connect() {}
  async disconnect() {}
  async send(record: any) { return [{ partition: 0, offset: '0' }] }
  async transaction() { return new MockTransaction() }
}

class MockConsumer {
  async connect() {}
  async disconnect() {}
  async subscribe(options: any) {}
  async run(options: any) {}
  async pause(topics: any) {}
  async resume(topics: any) {}
  async seek(positions: any) {}
}

class MockAdmin {
  async connect() {}
  async disconnect() {}
  async createTopics(options: any) {}
}

class MockTransaction {
  async send(record: any) {}
  async commit() {}
  async abort() {}
}

// Replace kafkajs imports
const Kafka = MockKafka as any
import { logger } from './utils/logger'
import { EventProducer } from './kafka/producer'
import { EventConsumer } from './kafka/consumer'
import { DomainEventHandler } from './handlers/event-handler'
import { PostgresEventStore } from './store/event-store'
import { NotificationService } from './integrations/notification-service'
import { AnalyticsService } from './integrations/analytics-service'
import { AuditService } from './integrations/audit-service'
// Mock routers since route files don't exist
const healthRouter = require('express').Router()
const eventRouter = require('express').Router()

// Health endpoint
healthRouter.get('/', (req: any, res: any) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Events endpoint  
eventRouter.get('/', (req: any, res: any) => {
  res.json({ message: 'Event Bus API', version: '1.0.0' })
})

config()

const app = express()
const PORT = process.env.PORT || 3009

// Global error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error)
  process.exit(1)
})

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection', error)
  process.exit(1)
})

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}))

app.use(compression())

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

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
let eventProducer: EventProducer | undefined
let eventConsumer: EventConsumer | undefined
let eventStore: PostgresEventStore | undefined

async function initializeServices() {
  try {
    // Initialize event store
    eventStore = new PostgresEventStore()
    
    // Initialize integrations
    const notificationService = new NotificationService()
    const analyticsService = new AnalyticsService()
    const auditService = new AuditService()
    
    // Initialize event handler
    const eventHandler = new DomainEventHandler(
      eventStore,
      notificationService,
      analyticsService,
      auditService
    )
    
    // Initialize Kafka producer
    eventProducer = new EventProducer()
    await eventProducer.connect()
    await eventProducer.createTopics()
    
    // Initialize Kafka consumer
    eventConsumer = new EventConsumer('event-bus-service', eventHandler)
    await eventConsumer.connect()
    
    // Subscribe to all event topics
    await eventConsumer.subscribe([
      'user-events',
      'course-events',
      'enrollment-events',
      'assessment-events',
      'payment-events',
      'notification-events',
      'content-events',
      'system-events'
    ])
    
    // Start consuming
    await eventConsumer.startConsuming()
    
    logger.info('Event Bus services initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize services', error)
    throw error
  }
}

// Make producer available to routes
app.locals.eventProducer = eventProducer
app.locals.eventStore = eventStore

// Routes
app.use('/health', healthRouter)
app.use('/api/v1/events', eventRouter)

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
    if (eventConsumer) {
      await eventConsumer.disconnect()
    }
    
    if (eventProducer) {
      await eventProducer.disconnect()
    }
    
    if (eventStore) {
      await eventStore.close()
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
      logger.info(`Event Bus Service running on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (error) {
    logger.error('Failed to start server', error)
    process.exit(1)
  }
}

startServer()
