import * as schema from '../models/schema';
export declare const db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema>;
export declare const testConnection: () => Promise<boolean>;
export declare const closeConnection: () => Promise<void>;
