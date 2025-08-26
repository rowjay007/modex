import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from './config';
import * as schema from '../models/schema';

// Create connection string prioritizing DIRECT_URL
const connectionString = config.DIRECT_URL || config.DATABASE_URL;

// Create postgres client with SSL configuration for production
const client = postgres(connectionString, {
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idle_timeout: 20,
  connect_timeout: 60,
});

// Initialize Drizzle with schema
export const db = drizzle(client, { schema });

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    await client`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Close database connection
export const closeConnection = async (): Promise<void> => {
  try {
    await client.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};
