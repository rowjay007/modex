import { cacheDelete, cacheGet, cacheSet, redis } from "../lib/redis";

const SESSION_PREFIX = "session:";
const SESSION_DURATION = 24 * 60 * 60;

function getSessionKey(userId: number): string {
  return `${SESSION_PREFIX}${userId}`;
}

export async function createSession(
  userId: number,
  token: string
): Promise<void> {
  const sessionKey = getSessionKey(userId);
  await cacheSet(
    sessionKey,
    {
      userId,
      token,
      createdAt: new Date().toISOString(),
    },
    SESSION_DURATION
  );
}

export async function getSession(
  userId: number
): Promise<{ userId: number; token: string; createdAt: string } | null> {
  const sessionKey = getSessionKey(userId);
  return await cacheGet(sessionKey);
}

export async function invalidateSession(userId: number): Promise<void> {
  const sessionKey = getSessionKey(userId);
  await cacheDelete(sessionKey);
}


export async function invalidateAllUserSessions(userId: number): Promise<void> {
  const pattern = `${SESSION_PREFIX}${userId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export const sessionService = {
  createSession,
  getSession,
  invalidateSession,
  invalidateAllUserSessions,
};
