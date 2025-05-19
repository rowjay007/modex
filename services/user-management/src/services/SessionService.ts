import { redis, cacheGet, cacheSet, cacheDelete } from '../lib/redis';
import { User } from '../db/schema';

export class SessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly SESSION_DURATION = 24 * 60 * 60; // 24 hours in seconds

  async createSession(userId: number, token: string): Promise<void> {
    const sessionKey = this.getSessionKey(userId);
    await cacheSet(sessionKey, {
      userId,
      token,
      createdAt: new Date().toISOString()
    }, this.SESSION_DURATION);
  }

  async getSession(userId: number): Promise<{ userId: number; token: string; createdAt: string } | null> {
    const sessionKey = this.getSessionKey(userId);
    return await cacheGet(sessionKey);
  }

  async invalidateSession(userId: number): Promise<void> {
    const sessionKey = this.getSessionKey(userId);
    await cacheDelete(sessionKey);
  }

  async invalidateAllUserSessions(userId: number): Promise<void> {
    const pattern = `${this.SESSION_PREFIX}${userId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  private getSessionKey(userId: number): string {
    return `${this.SESSION_PREFIX}${userId}`;
  }
}

export const sessionService = new SessionService();
