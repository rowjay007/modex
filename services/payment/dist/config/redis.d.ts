import { RedisClientType } from 'redis';
declare class RedisClient {
    private client;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getClient(): RedisClientType;
    set(key: string, value: string, expireInSeconds?: number): Promise<void>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<number>;
    private ensureConnection;
}
export declare const redisClient: RedisClient;
export {};
