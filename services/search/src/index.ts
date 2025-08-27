import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { body, query, validationResult } from 'express-validator'
import { Pool } from 'pg'
import Redis from 'ioredis'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import dotenv from 'dotenv'
import cron from 'node-cron'

import { SearchService } from './services/search-service'
import { ElasticsearchClient } from './services/elasticsearch-client'
import { IndexManager } from './services/index-manager'
import { QueryBuilder } from './services/query-builder'
import { SearchRepository } from './repositories/search-repository'
import { CircuitBreaker } from '@modex/circuit-breaker'
import { logger } from './utils/logger'
import { 
  SearchRequest,
  SearchType,
  AutocompleteRequest,
  ComplianceReportType,
  SortOption
} from './types/search'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3008

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
const esClient = new ElasticsearchClient()
const searchRepository = new SearchRepository(db, redis)
const indexManager = new IndexManager(esClient)
const queryBuilder = new QueryBuilder()
const searchService = new SearchService(
  esClient,
  searchRepository,
  indexManager,
  queryBuilder,
  redis
)

// Circuit breaker for Elasticsearch
const circuitBreaker = new CircuitBreaker('search-service', {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  timeout: 10000
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

// Search-specific rate limiting (more restrictive)
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 searches per minute per IP
  message: 'Too many search requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
})

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

// Optional authentication (for public search)
const optionalAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err: any, user: any) => {
      if (!err) {
        req.user = user
      }
    })
  }
  next()
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
  req.sessionId = req.headers['x-session-id'] || uuidv4()
  
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    sessionId: req.sessionId
  })
  next()
})

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1')
    await redis.ping()
    const esHealthy = await esClient.isHealthy()
    
    res.json({
      status: esHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'connected',
        redis: 'connected',
        elasticsearch: esHealthy ? 'connected' : 'disconnected'
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

// Search endpoints
app.post('/api/v1/search', 
  searchLimiter,
  optionalAuth,
  [
    body('query').notEmpty().withMessage('Search query is required'),
    body('type').optional().isArray().withMessage('Type must be an array'),
    body('type.*').optional().isIn(Object.values(SearchType)).withMessage('Invalid search type'),
    body('pagination.page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    body('pagination.size').optional().isInt({ min: 1, max: 100 }).withMessage('Size must be between 1 and 100')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const searchRequest: SearchRequest = req.body
      
      const result = await searchService.search(
        searchRequest,
        req.user?.id,
        req.sessionId,
        req.ip
      )

      res.json({
        success: true,
        data: result
      })

    } catch (error) {
      logger.error('Search request failed', {
        requestId: req.requestId,
        query: req.body.query,
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Search request failed',
        requestId: req.requestId
      })
    }
  }
)

app.get('/api/v1/search/autocomplete',
  searchLimiter,
  optionalAuth,
  [
    query('q').notEmpty().withMessage('Query parameter is required'),
    query('types').optional().isString().withMessage('Types must be a comma-separated string'),
    query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const autocompleteRequest: AutocompleteRequest = {
        query: req.query.q,
        types: req.query.types ? req.query.types.split(',') as SearchType[] : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : 10
      }
      
      const result = await searchService.autocomplete(autocompleteRequest)

      res.json({
        success: true,
        data: result
      })

    } catch (error) {
      logger.error('Autocomplete request failed', {
        requestId: req.requestId,
        query: req.query.q,
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Autocomplete request failed',
        requestId: req.requestId
      })
    }
  }
)

app.get('/api/v1/search/suggestions',
  optionalAuth,
  [
    query('q').notEmpty().withMessage('Query parameter is required'),
    query('limit').optional().isInt({ min: 1, max: 10 }).withMessage('Limit must be between 1 and 10')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const suggestions = await searchService.getSuggestions(
        req.query.q,
        req.query.limit ? parseInt(req.query.limit) : 5
      )

      res.json({
        success: true,
        data: { suggestions }
      })

    } catch (error) {
      logger.error('Suggestions request failed', {
        requestId: req.requestId,
        query: req.query.q,
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Suggestions request failed',
        requestId: req.requestId
      })
    }
  }
)

app.get('/api/v1/search/popular',
  optionalAuth,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const popularQueries = await searchService.getPopularQueries(
        req.query.limit ? parseInt(req.query.limit) : 10
      )

      res.json({
        success: true,
        data: { queries: popularQueries }
      })

    } catch (error) {
      logger.error('Popular queries request failed', {
        requestId: req.requestId,
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Popular queries request failed',
        requestId: req.requestId
      })
    }
  }
)

// Admin endpoints (require authentication)
app.post('/api/v1/search/index',
  authenticateToken,
  [
    body('type').isIn(Object.values(SearchType)).withMessage('Invalid search type'),
    body('id').notEmpty().withMessage('Document ID is required'),
    body('document').isObject().withMessage('Document must be an object')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const { type, id, document } = req.body
      
      await searchService.indexDocument(type, id, document)

      res.json({
        success: true,
        message: 'Document indexed successfully',
        documentId: id
      })

    } catch (error) {
      logger.error('Index document failed', {
        requestId: req.requestId,
        type: req.body.type,
        id: req.body.id,
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to index document',
        requestId: req.requestId
      })
    }
  }
)

app.put('/api/v1/search/index',
  authenticateToken,
  [
    body('type').isIn(Object.values(SearchType)).withMessage('Invalid search type'),
    body('id').notEmpty().withMessage('Document ID is required'),
    body('document').isObject().withMessage('Document must be an object')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const { type, id, document } = req.body
      
      await searchService.updateDocument(type, id, document)

      res.json({
        success: true,
        message: 'Document updated successfully',
        documentId: id
      })

    } catch (error) {
      logger.error('Update document failed', {
        requestId: req.requestId,
        type: req.body.type,
        id: req.body.id,
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to update document',
        requestId: req.requestId
      })
    }
  }
)

app.delete('/api/v1/search/index/:type/:id',
  authenticateToken,
  async (req: any, res) => {
    try {
      const { type, id } = req.params
      
      if (!Object.values(SearchType).includes(type as SearchType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid search type'
        })
      }
      
      await searchService.deleteDocument(type as SearchType, id)

      res.json({
        success: true,
        message: 'Document deleted successfully',
        documentId: id
      })

    } catch (error) {
      logger.error('Delete document failed', {
        requestId: req.requestId,
        type: req.params.type,
        id: req.params.id,
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete document',
        requestId: req.requestId
      })
    }
  }
)

app.post('/api/v1/search/reindex',
  authenticateToken,
  [
    body('type').optional().isIn(Object.values(SearchType)).withMessage('Invalid search type')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const { type } = req.body
      
      if (type) {
        await searchService.reindexType(type)
        res.json({
          success: true,
          message: `Reindex completed for type: ${type}`
        })
      } else {
        // Start full reindex asynchronously
        searchService.reindexAll().catch(error => {
          logger.error('Full reindex failed', { error: error.message })
        })
        
        res.json({
          success: true,
          message: 'Full reindex started in background'
        })
      }

    } catch (error) {
      logger.error('Reindex request failed', {
        requestId: req.requestId,
        type: req.body.type,
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Reindex request failed',
        requestId: req.requestId
      })
    }
  }
)

app.get('/api/v1/search/analytics',
  authenticateToken,
  [
    query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO8601'),
    query('endDate').optional().isISO8601().withMessage('End date must be valid ISO8601'),
    query('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('Limit must be between 1 and 10000')
  ],
  handleValidationErrors,
  async (req: any, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date()
      const limit = req.query.limit ? parseInt(req.query.limit) : 1000

      const analytics = await searchRepository.getSearchAnalytics(startDate, endDate, limit)
      const trends = await searchRepository.getSearchTrends(30)

      res.json({
        success: true,
        data: {
          analytics,
          trends,
          period: { startDate, endDate }
        }
      })

    } catch (error) {
      logger.error('Analytics request failed', {
        requestId: req.requestId,
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Analytics request failed',
        requestId: req.requestId
      })
    }
  }
)

app.get('/api/v1/search/health/indices',
  authenticateToken,
  async (req: any, res) => {
    try {
      const health = await indexManager.getIndexHealth()

      res.json({
        success: true,
        data: { indices: health }
      })

    } catch (error) {
      logger.error('Index health check failed', {
        requestId: req.requestId,
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Index health check failed',
        requestId: req.requestId
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

// Scheduled tasks
// Refresh search indices every hour
cron.schedule('0 * * * *', async () => {
  try {
    await indexManager.refreshAllIndices()
    logger.info('Scheduled index refresh completed')
  } catch (error) {
    logger.error('Scheduled index refresh failed', { error: error.message })
  }
})

// Update popular queries every 6 hours
cron.schedule('0 */6 * * *', async () => {
  try {
    // Popular queries are updated via materialized view refresh in repository
    logger.info('Popular queries update scheduled')
  } catch (error) {
    logger.error('Popular queries update failed', { error: error.message })
  }
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

    // Close Elasticsearch connection
    await esClient.disconnect()
    logger.info('Elasticsearch connection closed')

    logger.info('Graceful shutdown completed')
    process.exit(0)

  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message })
    process.exit(1)
  }
}

// Initialize service
const initializeService = async () => {
  try {
    // Connect to Elasticsearch
    await esClient.connect()
    logger.info('Elasticsearch connection established')

    // Initialize database schema
    await searchRepository.initializeSchema()
    logger.info('Database schema initialized')

    // Initialize search indices
    await indexManager.initializeIndices()
    logger.info('Search indices initialized')

    // Test connections
    await db.query('SELECT 1')
    await redis.ping()
    logger.info('Database and Redis connections established')

    logger.info('Search Service initialized successfully')

  } catch (error) {
    logger.error('Failed to initialize service', { error: error.message })
    process.exit(1)
  }
}

const server = app.listen(PORT, async () => {
  logger.info(`Search Service running on port ${PORT}`)
  await initializeService()
})

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')) // Nodemon restart

export default app
