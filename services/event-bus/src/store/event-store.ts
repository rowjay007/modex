// Mock PostgreSQL and Redis dependencies
class MockPool {
  async connect() { return new MockClient() }
  async query(sql: string, params?: any[]) { return { rows: [] } }
  async end() {}
}

class MockClient {
  async query(sql: string, params?: any[]) { return { rows: [] } }
  async release() {}
}

class MockRedis {
  constructor(url?: string, options?: any) {}
  async zadd(key: string, score: number, value: string) {}
  async zremrangebyrank(key: string, start: number, stop: number) {}
  async expire(key: string, seconds: number) {}
  async zrange(key: string, start: number, stop: number) { return [] }
  async get(key: string) { return null }
  async setex(key: string, seconds: number, value: string) {}
  async quit() {}
  pipeline() { return new MockPipeline() }
}

class MockPipeline {
  zadd(key: string, score: number, value: string) { return this }
  expire(key: string, seconds: number) { return this }
  async exec() { return [] }
}

const Pool = MockPool as any
const Redis = MockRedis as any
import { DomainEvent } from '../types/events'
import { logger } from '../utils/logger'

export interface EventStore {
  saveEvent(event: DomainEvent): Promise<void>
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>
  getEventsByType(eventType: string, limit?: number): Promise<DomainEvent[]>
  getAllEvents(offset?: number, limit?: number): Promise<DomainEvent[]>
}

export class PostgresEventStore implements EventStore {
  private pool: MockPool
  private redis: MockRedis

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
    })

    this.initializeDatabase()
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS event_store (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          aggregate_id VARCHAR(255) NOT NULL,
          aggregate_type VARCHAR(100) NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          event_data JSONB NOT NULL,
          metadata JSONB,
          version INTEGER NOT NULL,
          user_id VARCHAR(255),
          timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(aggregate_id, version)
        );

        CREATE INDEX IF NOT EXISTS idx_event_store_aggregate_id ON event_store(aggregate_id);
        CREATE INDEX IF NOT EXISTS idx_event_store_event_type ON event_store(event_type);
        CREATE INDEX IF NOT EXISTS idx_event_store_timestamp ON event_store(timestamp);
        CREATE INDEX IF NOT EXISTS idx_event_store_aggregate_type ON event_store(aggregate_type);
      `)
      logger.info('Event store database initialized')
    } catch (error) {
      logger.error('Failed to initialize event store database', error)
      throw error
    }
  }

  async saveEvent(event: DomainEvent): Promise<void> {
    const client = await this.pool.connect()
    
    try {
      await client.query('BEGIN')

      // Check for version conflicts (optimistic locking)
      const existingEvent = await client.query(
        'SELECT version FROM event_store WHERE aggregate_id = $1 AND version = $2',
        [event.aggregateId, event.version]
      )

      if (existingEvent.rows.length > 0) {
        throw new Error(`Event version conflict for aggregate ${event.aggregateId} version ${event.version}`)
      }

      // Insert event
      await client.query(
        `INSERT INTO event_store 
         (aggregate_id, aggregate_type, event_type, event_data, metadata, version, user_id, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          event.aggregateId,
          event.aggregateType,
          event.eventType,
          JSON.stringify(event.data),
          JSON.stringify(event.metadata || {}),
          event.version,
          event.userId,
          event.timestamp
        ]
      )

      await client.query('COMMIT')

      // Cache recent events for faster access
      await this.cacheRecentEvent(event)

      logger.info('Event saved to store', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        version: event.version
      })

    } catch (error) {
      await client.query('ROLLBACK')
      logger.error('Failed to save event', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        error
      })
      throw error
    } finally {
      client.release()
    }
  }

  async getEvents(aggregateId: string, fromVersion: number = 0): Promise<DomainEvent[]> {
    try {
      // Try cache first
      const cachedEvents = await this.getCachedEvents(aggregateId, fromVersion)
      if (cachedEvents.length > 0) {
        return cachedEvents
      }

      // Fallback to database
      const result = await this.pool.query(
        `SELECT * FROM event_store 
         WHERE aggregate_id = $1 AND version >= $2 
         ORDER BY version ASC`,
        [aggregateId, fromVersion]
      )

      const events = result.rows.map(row => this.mapRowToEvent(row))
      
      // Cache the results
      await this.cacheEvents(aggregateId, events)
      
      return events
    } catch (error) {
      logger.error('Failed to get events', { aggregateId, fromVersion, error })
      throw error
    }
  }

  async getEventsByType(eventType: string, limit: number = 100): Promise<DomainEvent[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM event_store 
         WHERE event_type = $1 
         ORDER BY timestamp DESC 
         LIMIT $2`,
        [eventType, limit]
      )

      return result.rows.map(row => this.mapRowToEvent(row))
    } catch (error) {
      logger.error('Failed to get events by type', { eventType, error })
      throw error
    }
  }

  async getAllEvents(offset: number = 0, limit: number = 100): Promise<DomainEvent[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM event_store 
         ORDER BY timestamp DESC 
         OFFSET $1 LIMIT $2`,
        [offset, limit]
      )

      return result.rows.map(row => this.mapRowToEvent(row))
    } catch (error) {
      logger.error('Failed to get all events', { offset, limit, error })
      throw error
    }
  }

  private mapRowToEvent(row: any): DomainEvent {
    return {
      id: row.id,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      data: row.event_data,
      metadata: row.metadata,
      version: row.version,
      userId: row.user_id,
      timestamp: new Date(row.timestamp)
    } as DomainEvent
  }

  private async cacheRecentEvent(event: DomainEvent): Promise<void> {
    try {
      const cacheKey = `events:${event.aggregateId}`
      const eventString = JSON.stringify(event)
      
      // Add to sorted set with timestamp as score
      await this.redis.zadd(cacheKey, event.timestamp.getTime(), eventString)
      
      // Keep only last 50 events per aggregate
      await this.redis.zremrangebyrank(cacheKey, 0, -51)
      
      // Set expiration
      await this.redis.expire(cacheKey, 3600) // 1 hour
    } catch (error) {
      logger.warn('Failed to cache event', { error })
    }
  }

  private async getCachedEvents(aggregateId: string, fromVersion: number): Promise<DomainEvent[]> {
    try {
      const cacheKey = `events:${aggregateId}`
      const cachedEvents = await this.redis.zrange(cacheKey, 0, -1)
      
      return cachedEvents
        .map(eventString => JSON.parse(eventString) as DomainEvent)
        .filter(event => event.version >= fromVersion)
        .sort((a, b) => a.version - b.version)
    } catch (error) {
      logger.warn('Failed to get cached events', { error })
      return []
    }
  }

  private async cacheEvents(aggregateId: string, events: DomainEvent[]): Promise<void> {
    try {
      if (events.length === 0) return

      const cacheKey = `events:${aggregateId}`
      const pipeline = this.redis.pipeline()

      events.forEach(event => {
        pipeline.zadd(cacheKey, event.timestamp.getTime(), JSON.stringify(event))
      })

      pipeline.expire(cacheKey, 3600)
      await pipeline.exec()
    } catch (error) {
      logger.warn('Failed to cache events', { error })
    }
  }

  async getSnapshot(aggregateId: string): Promise<any> {
    try {
      const cacheKey = `snapshot:${aggregateId}`
      const snapshot = await this.redis.get(cacheKey)
      return snapshot ? JSON.parse(snapshot) : null
    } catch (error) {
      logger.warn('Failed to get snapshot', { aggregateId, error })
      return null
    }
  }

  async saveSnapshot(aggregateId: string, snapshot: any, version: number): Promise<void> {
    try {
      const cacheKey = `snapshot:${aggregateId}`
      const snapshotData = {
        ...snapshot,
        version,
        timestamp: new Date().toISOString()
      }
      
      await this.redis.setex(cacheKey, 7200, JSON.stringify(snapshotData)) // 2 hours
      
      logger.info('Snapshot saved', { aggregateId, version })
    } catch (error) {
      logger.warn('Failed to save snapshot', { aggregateId, error })
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
    await this.redis.quit()
    logger.info('Event store connections closed')
  }
}
