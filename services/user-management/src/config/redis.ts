import { Redis } from '@upstash/redis';

if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) {
  throw new Error('Redis configuration is missing in environment variables');
}

export const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

// Session configuration
export const sessionConfig = {
  prefix: 'session:', 
  ttl: 24 * 60 * 60,    
};

// Cache configuration
export const cacheConfig = {
  prefix: 'cache:', // Key prefix for cached data
  ttl: 60 * 60, // Cache TTL in seconds (1 hour)
};

// Helper functions for session management
export const sessionHelpers = {
  async set(userId: string, sessionData: any) {
    const key = `${sessionConfig.prefix}${userId}`;
    await redis.set(key, JSON.stringify(sessionData), {
      ex: sessionConfig.ttl,
    });
  },

  async get(userId: string) {
    const key = `${sessionConfig.prefix}${userId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data as string) : null;
  },

  async delete(userId: string) {
    const key = `${sessionConfig.prefix}${userId}`;
    await redis.del(key);
  },
};

// Helper functions for caching
export const cacheHelpers = {
  async set(key: string, data: any) {
    const cacheKey = `${cacheConfig.prefix}${key}`;
    await redis.set(cacheKey, JSON.stringify(data), {
      ex: cacheConfig.ttl,
    });
  },

  async get(key: string) {
    const cacheKey = `${cacheConfig.prefix}${key}`;
    const data = await redis.get(cacheKey);
    return data ? JSON.parse(data as string) : null;
  },

  async delete(key: string) {
    const cacheKey = `${cacheConfig.prefix}${key}`;
    await redis.del(cacheKey);
  },
};