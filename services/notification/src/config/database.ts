import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { logger } from '../utils/logger';
import { config } from './index';

const postgresOptions = {
  ssl: { rejectUnauthorized: false },
  max: 10
};

// Create and export the postgres-js SQL client
export let sql: postgres.Sql;
try {
  sql = postgres(config.dbUrl, postgresOptions);
  logger.info('Database connection established');
} catch (error) {
  logger.error('Failed to connect to the database', { error });
  throw error;
}

// Export the drizzle ORM instance
export const db = drizzle(sql);
