import { Request, Response, NextFunction } from 'express'
import { CircuitBreaker, CircuitBreakerConfig, CircuitBreakerError } from '../circuit-breaker'
import { Redis } from 'ioredis'

interface CircuitBreakerMiddlewareOptions extends Partial<CircuitBreakerConfig> {
  redis?: Redis
  onCircuitOpen?: (req: Request, res: Response) => void
  onCircuitHalfOpen?: (req: Request, res: Response) => void
}

export function createCircuitBreakerMiddleware(
  serviceName: string,
  options: CircuitBreakerMiddlewareOptions = {}
) {
  const circuitBreaker = new CircuitBreaker({
    name: serviceName,
    failureThreshold: 5,
    recoveryTimeout: 60000,
    monitoringPeriod: 60000,
    halfOpenMaxCalls: 3,
    timeout: 30000,
    ...options
  })

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await circuitBreaker.execute(async () => {
        return new Promise<void>((resolve, reject) => {
          const originalSend = res.send
          const originalJson = res.json
          let responseSent = false

          // Override response methods to detect success/failure
          res.send = function(data) {
            if (!responseSent) {
              responseSent = true
              if (res.statusCode >= 500) {
                reject(new Error(`HTTP ${res.statusCode}: Internal Server Error`))
              } else {
                resolve()
              }
            }
            return originalSend.call(this, data)
          }

          res.json = function(data) {
            if (!responseSent) {
              responseSent = true
              if (res.statusCode >= 500) {
                reject(new Error(`HTTP ${res.statusCode}: Internal Server Error`))
              } else {
                resolve()
              }
            }
            return originalJson.call(this, data)
          }

          // Handle next() calls
          const originalNext = next
          next = (error?: any) => {
            if (!responseSent) {
              responseSent = true
              if (error) {
                reject(error)
              } else {
                resolve()
              }
            }
            return originalNext(error)
          }

          next()
        })
      })
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        const status = await circuitBreaker.getStatus()
        
        if (options.onCircuitOpen && status.state === 'OPEN') {
          options.onCircuitOpen(req, res)
        } else if (options.onCircuitHalfOpen && status.state === 'HALF_OPEN') {
          options.onCircuitHalfOpen(req, res)
        } else {
          res.status(503).json({
            error: 'Service Unavailable',
            message: 'Circuit breaker is open. Service is temporarily unavailable.',
            circuitBreaker: {
              name: serviceName,
              state: status.state,
              metrics: status
            },
            retryAfter: 60,
            statusCode: 503,
            timestamp: new Date().toISOString()
          })
        }
      } else {
        next(error)
      }
    }
  }
}

export function createHealthCheckMiddleware(circuitBreaker: CircuitBreaker) {
  return async (req: Request, res: Response) => {
    const status = await circuitBreaker.getStatus()
    const isHealthy = status.state !== 'OPEN'
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      circuitBreaker: {
        state: status.state,
        metrics: status
      },
      timestamp: new Date().toISOString()
    })
  }
}
