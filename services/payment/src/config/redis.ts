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
        lazyConnect: true,
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
      console.log('Redis disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
      } catch (error) {
        console.error('Failed to connect to Redis:', error);
        throw error;
      }
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

  async set(key: string, value: string, expireInSeconds?: number): Promise<void> {
    await this.ensureConnection();
    if (expireInSeconds) {
      await this.client.setEx(key, expireInSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    await this.ensureConnection();
    return await this.client.get(key);
  }

  async del(key: string): Promise<number> {
    await this.ensureConnection();
    return await this.client.del(key);
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }
}

export const redisClient = new RedisClient();
