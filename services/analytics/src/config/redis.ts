import { createClient, RedisClientType } from 'redis';
import { config } from './config';

class RedisClient {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: config.REDIS_URL,
      socket: {
        connectTimeout: 60000,
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('❌ Redis disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }

  // Analytics-specific caching methods
  async cacheAnalyticsData(key: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      console.error('Error caching analytics data:', error);
    }
  }

  async getCachedAnalyticsData(key: string): Promise<any | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error retrieving cached analytics data:', error);
      return null;
    }
  }

  // Event batching for high-throughput analytics
  async addEventToBatch(batchKey: string, event: any): Promise<void> {
    try {
      await this.client.rPush(batchKey, JSON.stringify(event));
    } catch (error) {
      console.error('Error adding event to batch:', error);
    }
  }

  async getEventBatch(batchKey: string, batchSize: number = 100): Promise<any[]> {
    try {
      const events = await this.client.lRange(batchKey, 0, batchSize - 1);
      if (events.length > 0) {
        await this.client.lTrim(batchKey, events.length, -1);
      }
      return events.map(event => JSON.parse(event));
    } catch (error) {
      console.error('Error retrieving event batch:', error);
      return [];
    }
  }

  async incrementCounter(key: string, value: number = 1): Promise<void> {
    try {
      await this.client.incrBy(key, value);
    } catch (error) {
      console.error('Error incrementing counter:', error);
    }
  }
}

export const redisClient = new RedisClient();
