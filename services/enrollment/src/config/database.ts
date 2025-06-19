import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error('🔴 DIRECT_URL environment variable is not set.');
}

// SSL configuration for Supabase
const client = postgres(connectionString, {
  ssl: 'require',
});

export const db = drizzle(client);

export const connectToDatabase = async () => {
  try {
    // Drizzle doesn't have a direct 'connect' method like some other ORMs.
    // Running a simple query is the recommended way to verify the connection.
        await db.execute(sql`SELECT 1`);
    console.log('🔌 Database connection established');
  } catch (error) {
    console.error('🔴 Could not connect to the database:', error);
    process.exit(1);
  }
};
