import { RedisClientType } from 'redis';
declare class RedisClient {
    private client;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getClient(): RedisClientType;
    cacheAnalyticsData(key: string, data: any, ttlSeconds?: number): Promise<void>;
    getCachedAnalyticsData(key: string): Promise<any | null>;
    addEventToBatch(batchKey: string, event: any): Promise<void>;
    getEventBatch(batchKey: string, batchSize?: number): Promise<any[]>;
    incrementCounter(key: string, value?: number): Promise<void>;
}
export declare const redisClient: RedisClient;
export {};
