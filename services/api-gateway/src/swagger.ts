import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { Application } from 'express'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Modex API Gateway',
      version: '1.0.0',
      description: 'Enterprise Learning Platform - Microservices API Gateway',
      contact: {
        name: 'Modex Development Team',
        email: 'dev@modex.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.modex.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { 
              type: 'string', 
              enum: ['admin', 'instructor', 'student'] 
            },
            avatar: { type: 'string', format: 'uri' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Course: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            instructor: { type: 'string' },
            instructorId: { type: 'string', format: 'uuid' },
            duration: { type: 'string' },
            students: { type: 'integer' },
            rating: { type: 'number', format: 'float' },
            level: { 
              type: 'string', 
              enum: ['Beginner', 'Intermediate', 'Advanced'] 
            },
            price: { type: 'number', format: 'float' },
            thumbnail: { type: 'string', format: 'uri' },
            category: { type: 'string' },
            tags: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Enrollment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            courseId: { type: 'string', format: 'uuid' },
            progress: { type: 'number', format: 'float', minimum: 0, maximum: 100 },
            completedLessons: { type: 'integer' },
            totalLessons: { type: 'integer' },
            status: { 
              type: 'string', 
              enum: ['active', 'completed', 'paused', 'cancelled'] 
            },
            enrolledAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
            lastAccessed: { type: 'string', format: 'date-time' }
          }
        },
        Assessment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            courseId: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            type: { 
              type: 'string', 
              enum: ['quiz', 'assignment', 'exam'] 
            },
            timeLimit: { type: 'integer' },
            maxAttempts: { type: 'integer' },
            passingScore: { type: 'number', format: 'float' },
            questions: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            courseId: { type: 'string', format: 'uuid' },
            amount: { type: 'number', format: 'float' },
            currency: { type: 'string', default: 'USD' },
            status: { 
              type: 'string', 
              enum: ['pending', 'completed', 'failed', 'refunded'] 
            },
            paymentMethod: { type: 'string' },
            transactionId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'integer' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts']
}

const specs = swaggerJsdoc(options)

export const setupSwagger = (app: Application): void => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Modex API Documentation',
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true
    }
  }))
}

export { specs }
