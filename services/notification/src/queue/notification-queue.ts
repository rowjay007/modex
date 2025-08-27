// Simple Bull queue mock implementation
interface Job<T = any> {
  id: string | number
  data: T
  attemptsMade: number
}

class Queue {
  private handlers: Map<string, Function> = new Map()
  private jobs: Job[] = []
  
  constructor(private name: string, private options: any) {}
  
  process(jobName: string, concurrency: number | Function, handler?: Function): void {
    const actualHandler = typeof concurrency === 'function' ? concurrency : handler
    if (actualHandler) {
      this.handlers.set(jobName, actualHandler)
    }
  }
  
  async add(jobName: string, data: any, options?: any): Promise<Job> {
    const job: Job = {
      id: options?.jobId || Math.random().toString(36).substr(2, 9),
      data,
      attemptsMade: 0
    }
    
    this.jobs.push(job)
    
    // Process job immediately in mock
    setTimeout(async () => {
      const handler = this.handlers.get(jobName)
      if (handler) {
        try {
          await handler(job)
          this.emit('completed', job)
        } catch (error) {
          job.attemptsMade++
          this.emit('failed', job, error)
        }
      }
    }, 10)
    
    return job
  }
  
  async addBulk(jobs: any[]): Promise<Job[]> {
    const results: Job[] = []
    for (const job of jobs) {
      results.push(await this.add(job.name, job.data, job.opts))
    }
    return results
  }
  
  private eventHandlers: Map<string, Function[]> = new Map()
  
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }
  
  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event) || []
    handlers.forEach(handler => handler(...args))
  }
  
  async getWaiting(): Promise<Job[]> { return [] }
  async getActive(): Promise<Job[]> { return [] }
  async getCompleted(): Promise<Job[]> { return [] }
  async getFailed(): Promise<Job[]> { return [] }
  async getDelayed(): Promise<Job[]> { return [] }
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}
  async close(): Promise<void> {}
}

class Bull {
  static Queue = Queue
  constructor(name: string, options: any) {
    return new Queue(name, options)
  }
}

// Simple Redis mock
class Redis {
  private store = new Map<string, string>()
  
  constructor(url?: string) {}
  
  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null
  }
  
  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.store.set(key, value)
    setTimeout(() => this.store.delete(key), seconds * 1000)
    return 'OK'
  }
  
  async del(key: string): Promise<number> {
    const existed = this.store.has(key)
    this.store.delete(key)
    return existed ? 1 : 0
  }
  
  async ping(): Promise<string> {
    return 'PONG'
  }
  
  async quit(): Promise<string> {
    this.store.clear()
    return 'OK'
  }
}
import { NotificationRequest } from '../types/notification'
import { NotificationService } from '../services/notification-service'
import { logger } from '../utils/logger'

export class NotificationQueue {
  private emailQueue: Queue
  private smsQueue: Queue
  private pushQueue: Queue
  private redis: Redis
  private notificationService: NotificationService

  constructor(notificationService: NotificationService) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
    this.notificationService = notificationService

    // Create queues with different priorities and processing rates
    this.emailQueue = new Queue('email notifications', {
      redis: { host: 'localhost', port: 6379 },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    })

    this.smsQueue = new Queue('sms notifications', {
      redis: { host: 'localhost', port: 6379 },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    })

    this.pushQueue = new Queue('push notifications', {
      redis: { host: 'localhost', port: 6379 },
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 500
        }
      }
    })

    this.setupProcessors()
    this.setupEventHandlers()
  }

  private setupProcessors(): void {
    // Email processor with rate limiting
    this.emailQueue.process('send-email', 5, async (job: Job<NotificationRequest>) => {
      await this.notificationService.processEmailNotification(job.data)
    })

    // SMS processor with strict rate limiting
    this.smsQueue.process('send-sms', 2, async (job: Job<NotificationRequest>) => {
      await this.notificationService.processSMSNotification(job.data)
    })

    // Push processor with high throughput
    this.pushQueue.process('send-push', 20, async (job: Job<NotificationRequest>) => {
      await this.notificationService.processPushNotification(job.data)
    })
  }

  private setupEventHandlers(): void {
    // Email queue events
    this.emailQueue.on('completed', (job) => {
      logger.info('Email notification completed', {
        jobId: job.id,
        notificationId: job.data.id
      })
    })

    this.emailQueue.on('failed', (job, err) => {
      logger.error('Email notification failed', {
        jobId: job.id,
        notificationId: job.data.id,
        error: err.message,
        attempts: job.attemptsMade
      })
    })

    // SMS queue events
    this.smsQueue.on('completed', (job) => {
      logger.info('SMS notification completed', {
        jobId: job.id,
        notificationId: job.data.id
      })
    })

    this.smsQueue.on('failed', (job, err) => {
      logger.error('SMS notification failed', {
        jobId: job.id,
        notificationId: job.data.id,
        error: err.message,
        attempts: job.attemptsMade
      })
    })

    // Push queue events
    this.pushQueue.on('completed', (job) => {
      logger.info('Push notification completed', {
        jobId: job.id,
        notificationId: job.data.id
      })
    })

    this.pushQueue.on('failed', (job, err) => {
      logger.error('Push notification failed', {
        jobId: job.id,
        notificationId: job.data.id,
        error: err.message,
        attempts: job.attemptsMade
      })
    })
  }

  async addNotification(notification: NotificationRequest): Promise<void> {
    const priority = this.getPriority(notification.priority)
    const delay = this.getDelay(notification.scheduledAt)

    try {
      switch (notification.type) {
        case 'email':
          await this.emailQueue.add('send-email', notification, {
            priority,
            delay,
            jobId: notification.id
          })
          break

        case 'sms':
          await this.smsQueue.add('send-sms', notification, {
            priority,
            delay,
            jobId: notification.id
          })
          break

        case 'push':
          await this.pushQueue.add('send-push', notification, {
            priority,
            delay,
            jobId: notification.id
          })
          break

        case 'in_app':
          // Process in-app notifications immediately (no queue needed)
          await this.notificationService.processInAppNotification(notification)
          break

        default:
          throw new Error(`Unsupported notification type: ${notification.type}`)
      }

      logger.info('Notification added to queue', {
        notificationId: notification.id,
        type: notification.type,
        priority: notification.priority,
        delay
      })

    } catch (error) {
      logger.error('Failed to add notification to queue', {
        notificationId: notification.id,
        error: error.message
      })
      throw error
    }
  }

  async addBulkNotifications(notifications: NotificationRequest[]): Promise<void> {
    const jobs = notifications.map(notification => ({
      name: `send-${notification.type}`,
      data: notification,
      opts: {
        priority: this.getPriority(notification.priority),
        delay: this.getDelay(notification.scheduledAt),
        jobId: notification.id
      }
    }))

    // Group by type for bulk adding
    const emailJobs = jobs.filter(job => job.name === 'send-email')
    const smsJobs = jobs.filter(job => job.name === 'send-sms')
    const pushJobs = jobs.filter(job => job.name === 'send-push')

    try {
      await Promise.all([
        emailJobs.length > 0 ? this.emailQueue.addBulk(emailJobs) : Promise.resolve(),
        smsJobs.length > 0 ? this.smsQueue.addBulk(smsJobs) : Promise.resolve(),
        pushJobs.length > 0 ? this.pushQueue.addBulk(pushJobs) : Promise.resolve()
      ])

      logger.info('Bulk notifications added to queues', {
        total: notifications.length,
        email: emailJobs.length,
        sms: smsJobs.length,
        push: pushJobs.length
      })

    } catch (error) {
      logger.error('Failed to add bulk notifications', {
        total: notifications.length,
        error: error.message
      })
      throw error
    }
  }

  private getPriority(priority: string): number {
    const priorityMap = {
      'urgent': 1,
      'high': 2,
      'medium': 3,
      'low': 4
    }
    return priorityMap[priority] || 3
  }

  private getDelay(scheduledAt?: Date): number {
    if (!scheduledAt) return 0
    const delay = scheduledAt.getTime() - Date.now()
    return Math.max(0, delay)
  }

  async getQueueStats(): Promise<any> {
    const [emailStats, smsStats, pushStats] = await Promise.all([
      this.getQueueStatus(this.emailQueue),
      this.getQueueStatus(this.smsQueue),
      this.getQueueStatus(this.pushQueue)
    ])

    return {
      email: emailStats,
      sms: smsStats,
      push: pushStats,
      timestamp: new Date().toISOString()
    }
  }

  private async getQueueStatus(queue: Queue): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed()
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length
    }
  }

  async pauseQueues(): Promise<void> {
    await Promise.all([
      this.emailQueue.pause(),
      this.smsQueue.pause(),
      this.pushQueue.pause()
    ])
    logger.info('All notification queues paused')
  }

  async resumeQueues(): Promise<void> {
    await Promise.all([
      this.emailQueue.resume(),
      this.smsQueue.resume(),
      this.pushQueue.resume()
    ])
    logger.info('All notification queues resumed')
  }

  async close(): Promise<void> {
    await Promise.all([
      this.emailQueue.close(),
      this.smsQueue.close(),
      this.pushQueue.close(),
      this.redis.quit()
    ])
    logger.info('Notification queues closed')
  }
}
