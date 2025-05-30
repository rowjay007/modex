import { Redis } from '@upstash/redis';
import { config } from './index';
import { logger } from '../utils/logger';

// Create Upstash Redis REST client
export const redis = new Redis({
  url: config.upstashRedisUrl,
  token: config.upstashRedisToken
});

// Log successful initialization
logger.info('Upstash Redis client initialized');

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return data as T;
  } catch (error) {
    logger.error('Error retrieving data from cache', { error, key });
    return null;
  }
}

export async function cacheSet(key: string, value: any, expirySeconds?: number): Promise<void> {
  try {
    if (expirySeconds) {
      await redis.set(key, value, { ex: expirySeconds });
    } else {
      await redis.set(key, value);
    }
  } catch (error) {
    logger.error('Error setting data in cache', { error, key });
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    logger.error('Error deleting data from cache', { error, key });
  }
}
