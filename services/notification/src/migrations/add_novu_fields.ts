import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config';
import { logger } from '../utils/logger';

// Set up the connection with SSL required for Supabase
const migrationClient = postgres(config.dbUrl, { 
  max: 1,
  ssl: {
    rejectUnauthorized: false
  }
});

// Use drizzle for more complex operations if needed
const db = drizzle(migrationClient);

// Migration to add Novu-specific fields
async function runMigration() {
  try {
    logger.info('Starting migration to add Novu integration fields');

    // Add novu_template_id to templates table
    await migrationClient`
      ALTER TABLE notification_templates
      ADD COLUMN IF NOT EXISTS novu_template_id VARCHAR(100);
    `;
    logger.info('Added novu_template_id to notification_templates table');

    // Add external_id to notifications table
    await migrationClient`
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
    `;
    logger.info('Added external_id to notifications table');

    // Add is_read to notifications table
    await migrationClient`
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
    `;
    logger.info('Added is_read to notifications table');

    // Add novu_subscriber_id and preferences to notification_settings table
    await migrationClient`
      ALTER TABLE notification_settings
      ADD COLUMN IF NOT EXISTS novu_subscriber_id VARCHAR(100);
    `;
    
    await migrationClient`
      ALTER TABLE notification_settings
      ADD COLUMN IF NOT EXISTS preferences JSONB;
    `;
    logger.info('Added Novu fields to notification_settings table');

    logger.info('Migration completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error });
    throw error;
  } finally {
    await migrationClient.end();
  }
}

// Run the migration when this script is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      logger.info('Novu integration fields migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed', { error });
      process.exit(1);
    });
}

export default runMigration;
