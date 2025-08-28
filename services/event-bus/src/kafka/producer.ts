// Mock Kafka dependencies
class MockKafka {
  constructor(config: any) {}
  producer(config?: any) { return new MockProducer() }
  admin() { return new MockAdmin() }
}

class MockProducer {
  async connect() {}
  async disconnect() {}
  async send(record: any) { return [{ partition: 0, offset: '0' }] }
  async transaction() { return new MockTransaction() }
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

const Kafka = MockKafka as any
type Producer = MockProducer
type ProducerRecord = any

// Mock uuid
const uuidv4 = () => 'mock-uuid-' + Math.random().toString(36).substring(2)

import { logger } from '../utils/logger'
import { DomainEvent } from '../types/events'

export class EventProducer {
  private kafka: MockKafka
  private producer: MockProducer
  private isConnected: boolean = false

  constructor() {
    this.kafka = new Kafka({
      clientId: 'modex-event-producer',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8
      },
      connectionTimeout: 3000,
      requestTimeout: 30000
    })

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 3
      }
    })
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect()
      this.isConnected = true
      logger.info('Event producer connected to Kafka')
    } catch (error) {
      logger.error('Failed to connect event producer', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect()
      this.isConnected = false
      logger.info('Event producer disconnected from Kafka')
    } catch (error) {
      logger.error('Failed to disconnect event producer', error)
      throw error
    }
  }

  async publishEvent(event: DomainEvent): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Producer is not connected')
    }

    try {
      const topic = this.getTopicForEvent(event.eventType)
      const message = {
        key: event.aggregateId,
        value: JSON.stringify(event),
        headers: {
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          version: event.version.toString(),
          timestamp: event.timestamp.toISOString(),
          messageId: uuidv4()
        },
        timestamp: event.timestamp.getTime().toString()
      }

      const result = await this.producer.send({
        topic,
        messages: [message]
      })

      logger.info(`Event published successfully`, {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        topic,
        partition: result[0].partition,
        offset: result[0].offset
      })
    } catch (error) {
      logger.error('Failed to publish event', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        error
      })
      throw error
    }
  }

  async publishEvents(events: DomainEvent[]): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Producer is not connected')
    }

    try {
      const transaction = await this.producer.transaction()

      try {
        for (const event of events) {
          const topic = this.getTopicForEvent(event.eventType)
          const message = {
            key: event.aggregateId,
            value: JSON.stringify(event),
            headers: {
              eventType: event.eventType,
              aggregateType: event.aggregateType,
              version: event.version.toString(),
              timestamp: event.timestamp.toISOString(),
              messageId: uuidv4()
            },
            timestamp: event.timestamp.getTime().toString()
          }

          await transaction.send({
            topic,
            messages: [message]
          })
        }

        await transaction.commit()
        logger.info(`Published ${events.length} events in transaction`)
      } catch (error) {
        await transaction.abort()
        throw error
      }
    } catch (error) {
      logger.error('Failed to publish events in transaction', { error })
      throw error
    }
  }

  private getTopicForEvent(eventType: string): string {
    const topicMap: Record<string, string> = {
      // User events
      'USER_REGISTERED': 'user-events',
      'USER_PROFILE_UPDATED': 'user-events',
      
      // Course events
      'COURSE_CREATED': 'course-events',
      'COURSE_UPDATED': 'course-events',
      'COURSE_PUBLISHED': 'course-events',
      
      // Enrollment events
      'STUDENT_ENROLLED': 'enrollment-events',
      'LESSON_COMPLETED': 'enrollment-events',
      'COURSE_COMPLETED': 'enrollment-events',
      
      // Assessment events
      'ASSESSMENT_ATTEMPTED': 'assessment-events',
      'ASSESSMENT_COMPLETED': 'assessment-events',
      
      // Payment events
      'PAYMENT_INITIATED': 'payment-events',
      'PAYMENT_COMPLETED': 'payment-events',
      'PAYMENT_FAILED': 'payment-events',
      'REFUND_PROCESSED': 'payment-events',
      
      // Notification events
      'NOTIFICATION_REQUESTED': 'notification-events',
      
      // Content events
      'CONTENT_UPLOADED': 'content-events',
      
      // System events
      'SYSTEM_HEALTH_CHECK': 'system-events'
    }

    return topicMap[eventType] || 'general-events'
  }

  async createTopics(): Promise<void> {
    try {
      const admin = this.kafka.admin()
      await admin.connect()

      const topics = [
        'user-events',
        'course-events',
        'enrollment-events',
        'assessment-events',
        'payment-events',
        'notification-events',
        'content-events',
        'system-events',
        'general-events'
      ]

      await admin.createTopics({
        topics: topics.map(topic => ({
          topic,
          numPartitions: 3,
          replicationFactor: 1,
          configEntries: [
            { name: 'cleanup.policy', value: 'delete' },
            { name: 'retention.ms', value: '604800000' }, // 7 days
            { name: 'compression.type', value: 'snappy' }
          ]
        }))
      })

      await admin.disconnect()
      logger.info('Kafka topics created successfully')
    } catch (error) {
      logger.error('Failed to create Kafka topics', error)
      throw error
    }
  }
}
