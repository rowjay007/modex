// Mock Kafka dependencies
class MockKafka {
  constructor(config: any) {}
  consumer(config: any) { return new MockConsumer() }
  producer() { return new MockProducer() }
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

class MockProducer {
  async connect() {}
  async disconnect() {}
  async send(record: any) {}
}

const Kafka = MockKafka as any
type Consumer = MockConsumer
type EachMessagePayload = {
  topic: string
  partition: number
  message: {
    key: any
    value: Buffer | null
    offset: string
    headers?: any
  }
}

import { logger } from '../utils/logger'
import { DomainEvent } from '../types/events'
import { EventHandler } from '../handlers/event-handler'

export class EventConsumer {
  private kafka: MockKafka
  private consumer: MockConsumer
  private eventHandler: EventHandler
  private isConnected: boolean = false

  constructor(groupId: string, eventHandler: EventHandler) {
    this.kafka = new Kafka({
      clientId: 'modex-event-consumer',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8
      },
      connectionTimeout: 3000,
      requestTimeout: 30000
    })

    this.consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576,
      minBytes: 1,
      maxBytes: 10485760,
      maxWaitTimeInMs: 5000,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    })

    this.eventHandler = eventHandler
  }

  async connect(): Promise<void> {
    try {
      await this.consumer.connect()
      this.isConnected = true
      logger.info('Event consumer connected to Kafka')
    } catch (error) {
      logger.error('Failed to connect event consumer', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.consumer.disconnect()
      this.isConnected = false
      logger.info('Event consumer disconnected from Kafka')
    } catch (error) {
      logger.error('Failed to disconnect event consumer', error)
      throw error
    }
  }

  async subscribe(topics: string[]): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Consumer is not connected')
    }

    try {
      await this.consumer.subscribe({
        topics,
        fromBeginning: false
      })
      logger.info(`Subscribed to topics: ${topics.join(', ')}`)
    } catch (error) {
      logger.error('Failed to subscribe to topics', { topics, error })
      throw error
    }
  }

  async startConsuming(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Consumer is not connected')
    }

    try {
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.processMessage(payload)
        }
      })
      logger.info('Event consumer started consuming messages')
    } catch (error) {
      logger.error('Failed to start consuming messages', error)
      throw error
    }
  }

  private async processMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload
    
    try {
      if (!message.value) {
        logger.warn('Received message with no value', { topic, partition, offset: message.offset })
        return
      }

      const event: DomainEvent = JSON.parse(message.value.toString())
      
      // Validate event structure
      if (!this.isValidEvent(event)) {
        logger.error('Invalid event structure', { event, topic, partition })
        return
      }

      logger.info('Processing event', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        topic,
        partition,
        offset: message.offset
      })

      // Handle the event with retry logic
      await this.handleEventWithRetry(event, topic, partition, message.offset!)

    } catch (error) {
      logger.error('Failed to process message', {
        topic,
        partition,
        offset: message.offset,
        error
      })

      // Send to dead letter queue if processing fails multiple times
      await this.sendToDeadLetterQueue(payload, error)
    }
  }

  private async handleEventWithRetry(
    event: DomainEvent,
    topic: string,
    partition: number,
    offset: string,
    maxRetries: number = 3
  ): Promise<void> {
    let retryCount = 0
    
    while (retryCount < maxRetries) {
      try {
        await this.eventHandler.handle(event)
        logger.info('Event processed successfully', {
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          retryCount
        })
        return
      } catch (error) {
        retryCount++
        logger.warn('Event processing failed, retrying', {
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          retryCount,
          maxRetries,
          error
        })

        if (retryCount < maxRetries) {
          // Exponential backoff
          await this.delay(Math.pow(2, retryCount) * 1000)
        }
      }
    }

    throw new Error(`Failed to process event after ${maxRetries} retries`)
  }

  private isValidEvent(event: any): event is DomainEvent {
    return (
      event &&
      typeof event.id === 'string' &&
      typeof event.aggregateId === 'string' &&
      typeof event.aggregateType === 'string' &&
      typeof event.eventType === 'string' &&
      typeof event.version === 'number' &&
      event.timestamp &&
      event.data
    )
  }

  private async sendToDeadLetterQueue(payload: EachMessagePayload, error: any): Promise<void> {
    try {
      const producer = this.kafka.producer()
      await producer.connect()

      const deadLetterMessage = {
        key: payload.message.key,
        value: payload.message.value,
        headers: {
          ...payload.message.headers,
          'original-topic': payload.topic,
          'original-partition': payload.partition.toString(),
          'original-offset': payload.message.offset!,
          'error-message': error.message,
          'error-timestamp': new Date().toISOString(),
          'dlq-timestamp': Date.now().toString()
        }
      }

      await producer.send({
        topic: `${payload.topic}-dlq`,
        messages: [deadLetterMessage]
      })

      await producer.disconnect()

      logger.error('Message sent to dead letter queue', {
        originalTopic: payload.topic,
        partition: payload.partition,
        offset: payload.message.offset,
        error: error.message
      })
    } catch (dlqError) {
      logger.error('Failed to send message to dead letter queue', {
        originalError: error,
        dlqError
      })
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async pauseConsumer(): Promise<void> {
    await this.consumer.pause([{ topic: /.*/ }])
    logger.info('Event consumer paused')
  }

  async resumeConsumer(): Promise<void> {
    await this.consumer.resume([{ topic: /.*/ }])
    logger.info('Event consumer resumed')
  }

  async seekToBeginning(topics: string[]): Promise<void> {
    const topicPartitions = topics.map(topic => ({ topic, partition: 0 }))
    await this.consumer.seek(topicPartitions.reduce((acc, tp) => {
      acc[tp.topic] = { partition: tp.partition, offset: '0' }
      return acc
    }, {} as Record<string, { partition: number; offset: string }>))
    
    logger.info('Consumer seeked to beginning', { topics })
  }
}
