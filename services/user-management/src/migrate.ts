import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from './config';
import { logger } from './utils/logger';

const migrationClient = postgres(config.dbUrl, { max: 1, ssl: { rejectUnauthorized: false } });

async function runMigrations() {
  logger.info('Running migrations...');
  
  try {
    const db = drizzle(migrationClient);
    await migrate(db, { migrationsFolder: './supabase/migrations' });
    logger.info('✅ Migrations completed successfully');
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
