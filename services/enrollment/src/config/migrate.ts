import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error('🔴 DIRECT_URL environment variable is not set for migration.');
}

const runMigrations = async () => {
  console.log('🔵 Starting database migration...');

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder: 'src/migrations' });
    console.log('✅ Migrations completed successfully.');
  } catch (error) {
    console.error('🔴 Error running migrations:', error);
    process.exit(1);
  } finally {
    await sql.end();
    console.log('🔵 Migration script finished.');
  }
};

runMigrations();
