import { Redis } from 'ioredis'
import { logger } from './utils/logger'

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringPeriod: number
  halfOpenMaxCalls: number
  timeout: number
  name: string
  redis?: Redis
}

export interface CircuitBreakerMetrics {
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  state: CircuitState
  lastFailureTime?: Date
  lastSuccessTime?: Date
  consecutiveFailures: number
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig
  private redis?: Redis
  private localMetrics: CircuitBreakerMetrics
  private nextAttempt: Date = new Date()

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 60000,
      halfOpenMaxCalls: 3,
      timeout: 30000,
      ...config
    }
    
    this.redis = config.redis
    this.localMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      state: CircuitState.CLOSED,
      consecutiveFailures: 0
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const metrics = await this.getMetrics()
    
    if (metrics.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        await this.setState(CircuitState.HALF_OPEN)
      } else {
        throw new CircuitBreakerError('Circuit breaker is OPEN', this.config.name)
      }
    }

    if (metrics.state === CircuitState.HALF_OPEN && metrics.totalCalls >= this.config.halfOpenMaxCalls) {
      throw new CircuitBreakerError('Circuit breaker is HALF_OPEN and max calls exceeded', this.config.name)
    }

    try {
      const result = await this.executeWithTimeout(fn)
      await this.onSuccess()
      return result
    } catch (error) {
      await this.onFailure(error)
      throw error
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Operation timed out after ${this.config.timeout}ms`))
      }, this.config.timeout)
    })

    return Promise.race([fn(), timeoutPromise])
  }

  private async onSuccess(): Promise<void> {
    await this.incrementCounter('totalCalls')
    await this.incrementCounter('successfulCalls')
    await this.resetConsecutiveFailures()
    
    const metrics = await this.getMetrics()
    
    if (metrics.state === CircuitState.HALF_OPEN) {
      await this.setState(CircuitState.CLOSED)
      logger.info('Circuit breaker transitioned to CLOSED', { 
        name: this.config.name,
        metrics 
      })
    }

    await this.updateLastSuccessTime()
  }

  private async onFailure(error: any): Promise<void> {
    await this.incrementCounter('totalCalls')
    await this.incrementCounter('failedCalls')
    await this.incrementCounter('consecutiveFailures')
    await this.updateLastFailureTime()

    const metrics = await this.getMetrics()
    const failureRate = metrics.failedCalls / metrics.totalCalls

    if (metrics.state === CircuitState.HALF_OPEN) {
      await this.setState(CircuitState.OPEN)
      this.scheduleNextAttempt()
      logger.warn('Circuit breaker opened from HALF_OPEN due to failure', {
        name: this.config.name,
        error: error.message
      })
    } else if (
      metrics.consecutiveFailures >= this.config.failureThreshold ||
      (metrics.totalCalls >= 10 && failureRate >= 0.5)
    ) {
      await this.setState(CircuitState.OPEN)
      this.scheduleNextAttempt()
      logger.error('Circuit breaker OPENED due to failure threshold', {
        name: this.config.name,
        metrics,
        failureThreshold: this.config.failureThreshold,
        error: error.message
      })
    }
  }

  private async getMetrics(): Promise<CircuitBreakerMetrics> {
    if (this.redis) {
      return this.getDistributedMetrics()
    }
    return this.localMetrics
  }

  private async getDistributedMetrics(): Promise<CircuitBreakerMetrics> {
    if (!this.redis) return this.localMetrics

    try {
      const key = `circuit-breaker:${this.config.name}`
      const data = await this.redis.hgetall(key)
      
      if (Object.keys(data).length === 0) {
        return this.localMetrics
      }

      return {
        totalCalls: parseInt(data.totalCalls) || 0,
        successfulCalls: parseInt(data.successfulCalls) || 0,
        failedCalls: parseInt(data.failedCalls) || 0,
        state: (data.state as CircuitState) || CircuitState.CLOSED,
        lastFailureTime: data.lastFailureTime ? new Date(data.lastFailureTime) : undefined,
        lastSuccessTime: data.lastSuccessTime ? new Date(data.lastSuccessTime) : undefined,
        consecutiveFailures: parseInt(data.consecutiveFailures) || 0
      }
    } catch (error) {
      logger.warn('Failed to get distributed metrics, falling back to local', {
        name: this.config.name,
        error: error.message
      })
      return this.localMetrics
    }
  }

  private async setState(state: CircuitState): Promise<void> {
    if (this.redis) {
      const key = `circuit-breaker:${this.config.name}`
      await this.redis.hset(key, 'state', state)
      await this.redis.expire(key, this.config.monitoringPeriod * 2)
    }
    this.localMetrics.state = state
  }

  private async incrementCounter(counter: keyof CircuitBreakerMetrics): Promise<void> {
    if (this.redis) {
      const key = `circuit-breaker:${this.config.name}`
      await this.redis.hincrby(key, counter, 1)
      await this.redis.expire(key, this.config.monitoringPeriod * 2)
    }
    
    if (counter === 'totalCalls') this.localMetrics.totalCalls++
    else if (counter === 'successfulCalls') this.localMetrics.successfulCalls++
    else if (counter === 'failedCalls') this.localMetrics.failedCalls++
    else if (counter === 'consecutiveFailures') this.localMetrics.consecutiveFailures++
  }

  private async resetConsecutiveFailures(): Promise<void> {
    if (this.redis) {
      const key = `circuit-breaker:${this.config.name}`
      await this.redis.hset(key, 'consecutiveFailures', 0)
    }
    this.localMetrics.consecutiveFailures = 0
  }

  private async updateLastFailureTime(): Promise<void> {
    const now = new Date()
    if (this.redis) {
      const key = `circuit-breaker:${this.config.name}`
      await this.redis.hset(key, 'lastFailureTime', now.toISOString())
    }
    this.localMetrics.lastFailureTime = now
  }

  private async updateLastSuccessTime(): Promise<void> {
    const now = new Date()
    if (this.redis) {
      const key = `circuit-breaker:${this.config.name}`
      await this.redis.hset(key, 'lastSuccessTime', now.toISOString())
    }
    this.localMetrics.lastSuccessTime = now
  }

  private shouldAttemptReset(): boolean {
    return Date.now() >= this.nextAttempt.getTime()
  }

  private scheduleNextAttempt(): void {
    this.nextAttempt = new Date(Date.now() + this.config.recoveryTimeout)
  }

  async getStatus(): Promise<CircuitBreakerMetrics> {
    return this.getMetrics()
  }

  async reset(): Promise<void> {
    if (this.redis) {
      const key = `circuit-breaker:${this.config.name}`
      await this.redis.del(key)
    }
    
    this.localMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      state: CircuitState.CLOSED,
      consecutiveFailures: 0
    }
    
    this.nextAttempt = new Date()
    
    logger.info('Circuit breaker reset', { name: this.config.name })
  }

  async forceOpen(): Promise<void> {
    await this.setState(CircuitState.OPEN)
    this.scheduleNextAttempt()
    logger.warn('Circuit breaker forced OPEN', { name: this.config.name })
  }

  async forceClose(): Promise<void> {
    await this.setState(CircuitState.CLOSED)
    await this.resetConsecutiveFailures()
    logger.info('Circuit breaker forced CLOSED', { name: this.config.name })
  }
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public circuitName: string) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}
