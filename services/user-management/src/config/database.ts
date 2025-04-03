import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const connectionOptions = {
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Max idle time in seconds
  connect_timeout: 10, // Connection timeout in seconds
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
};

const client = postgres(process.env.DATABASE_URL, connectionOptions);

export const db = drizzle(client, {
  logger: process.env.NODE_ENV === "development",
});


