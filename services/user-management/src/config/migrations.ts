import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Initialize Drizzle ORM
const db = drizzle(pool);

// Run migrations
export const runMigrations = async (): Promise<void> => {
  console.warn("Running database migrations...");
  await migrate(db, { migrationsFolder: "src/config/migrations" });
  console.warn("Migrations completed.");
};

// Export database instance
export { db };
