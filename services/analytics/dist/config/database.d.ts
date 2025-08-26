import * as schema from '../models/schema';
export declare const db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema>;
export declare function testConnection(): Promise<boolean>;
export declare function closeConnection(): Promise<void>;
