import swaggerJsdoc from 'swagger-jsdoc';

// Swagger configuration options
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User Management API',
      version: '1.0.0',
      description: 'API Documentation for User Management Service',
      contact: {
        name: 'API Support',
        email: 'support@modex.com'
      },
    },
    servers: [
      {
        url: '/api/v1/users',
        description: 'User Management API v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.ts'], // Path to the API docs
};

// Generate Swagger specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;
