import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from './config';
import { logger } from './utils/logger';

// Create a client for database operations
const migrationClient = postgres(config.dbUrl, { 
  max: 1, 
  ssl: { rejectUnauthorized: false } 
});

async function updateSchema() {
  logger.info('Adding new columns for GDPR compliance and 2FA...');
  
  try {
    // Direct SQL alter table statements
    const alterQueries = [
      // GDPR Compliance columns
      "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS cookie_consent BOOLEAN DEFAULT FALSE",
      "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT FALSE",
      "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS privacy_policy_accepted BOOLEAN DEFAULT FALSE",
      "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE",
      "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS consent_updated_at TIMESTAMP",
      
      // 2FA columns
      "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT",
      "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE",
    ];
    
    // Execute each query
    for (const query of alterQueries) {
      logger.info(`Executing: ${query}`);
      await migrationClient.unsafe(query);
    }
    
    logger.info('✅ Schema update completed successfully');
  } catch (error) {
    logger.error('❌ Schema update failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

// Run the function
updateSchema();
