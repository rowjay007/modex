import { Redis } from "@upstash/redis";
import { config } from "../config";
import { logger } from "../utils/logger";

// Initialize Redis client with config from environment variables
export const redis = new Redis({
  url: config.redisUrl,
  token: config.redisToken,
});

// Log Redis connection status
logger.info('Redis client initialized');

// Helper functions for common Redis operations
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    return await redis.get(key);
  } catch (error) {
    logger.error("Redis get error:", error);
    return null;
  }
};

export const cacheSet = async <T>(
  key: string,
  value: T,
  expireInSeconds?: number
): Promise<void> => {
  try {
    if (expireInSeconds) {
      await redis.set(key, value, { ex: expireInSeconds });
    } else {
      await redis.set(key, value);
    }
  } catch (error) {
    logger.error("Redis set error:", error);
  }
};

export const cacheDelete = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (error) {
    logger.error("Redis delete error:", error);
  }
};
