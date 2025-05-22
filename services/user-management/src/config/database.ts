import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../models/schema";
import { logger } from "../utils/logger";
import { config } from "./index";

logger.info(
  `Connecting to database with URL: ${config.dbUrl.replace(/:[^:@]*@/, ":****@")}`
);

const client = postgres(config.dbUrl, {
  ssl: "require",
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: {
    application_name: "user-management-service",
  },
});

process.on("unhandledRejection", (err) => {
  if (err instanceof Error) {
    if (err.message.includes("database")) {
      logger.error("❌ Database connection failed:", err);
    }
    // Prevent the process from crashing
    logger.error("Unhandled rejection:", err);
  }
});

export const db = drizzle(client, { schema });

logger.info("Database connection initialized");

export { client };
