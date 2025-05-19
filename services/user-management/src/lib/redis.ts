import { Redis } from "@upstash/redis";
import { config } from "../config";

export const redis = new Redis({
  url: config.redisUrl,
  token: config.redisToken,
});

// Helper functions for common Redis operations
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    return await redis.get(key);
  } catch (error) {
    console.error("Redis get error:", error);
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
    console.error("Redis set error:", error);
  }
};

export const cacheDelete = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Redis delete error:", error);
  }
};
