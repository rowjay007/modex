"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const redis_1 = require("redis");
const config_1 = require("./config");
class RedisClient {
    constructor() {
        this.isConnected = false;
        this.client = (0, redis_1.createClient)({
            url: config_1.config.REDIS_URL,
            socket: {
                connectTimeout: 60000,
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
            console.log('❌ Redis disconnected');
            this.isConnected = false;
        });
    }
    async connect() {
        if (!this.isConnected) {
            await this.client.connect();
        }
    }
    async disconnect() {
        if (this.isConnected) {
            await this.client.disconnect();
        }
    }
    getClient() {
        return this.client;
    }
    // Analytics-specific caching methods
    async cacheAnalyticsData(key, data, ttlSeconds = 3600) {
        try {
            await this.client.setEx(key, ttlSeconds, JSON.stringify(data));
        }
        catch (error) {
            console.error('Error caching analytics data:', error);
        }
    }
    async getCachedAnalyticsData(key) {
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            console.error('Error retrieving cached analytics data:', error);
            return null;
        }
    }
    // Event batching for high-throughput analytics
    async addEventToBatch(batchKey, event) {
        try {
            await this.client.rPush(batchKey, JSON.stringify(event));
        }
        catch (error) {
            console.error('Error adding event to batch:', error);
        }
    }
    async getEventBatch(batchKey, batchSize = 100) {
        try {
            const events = await this.client.lRange(batchKey, 0, batchSize - 1);
            if (events.length > 0) {
                await this.client.lTrim(batchKey, events.length, -1);
            }
            return events.map(event => JSON.parse(event));
        }
        catch (error) {
            console.error('Error retrieving event batch:', error);
            return [];
        }
    }
    async incrementCounter(key, value = 1) {
        try {
            await this.client.incrBy(key, value);
        }
        catch (error) {
            console.error('Error incrementing counter:', error);
        }
    }
}
exports.redisClient = new RedisClient();
