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
            console.log('Redis disconnected');
            this.isConnected = false;
        });
    }
    async connect() {
        if (!this.isConnected) {
            try {
                await this.client.connect();
            }
            catch (error) {
                console.error('Failed to connect to Redis:', error);
                throw error;
            }
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
    async set(key, value, expireInSeconds) {
        await this.ensureConnection();
        if (expireInSeconds) {
            await this.client.setEx(key, expireInSeconds, value);
        }
        else {
            await this.client.set(key, value);
        }
    }
    async get(key) {
        await this.ensureConnection();
        return await this.client.get(key);
    }
    async del(key) {
        await this.ensureConnection();
        return await this.client.del(key);
    }
    async ensureConnection() {
        if (!this.isConnected) {
            await this.connect();
        }
    }
}
exports.redisClient = new RedisClient();
//# sourceMappingURL=redis.js.map