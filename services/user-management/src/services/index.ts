import { nats } from '../app';
import { redis } from '../config/redis';
import { UserService } from './userService';

// Initialize services with dependencies
export const userService = new UserService(redis, nats);

// Export service types
export type { UserService };
