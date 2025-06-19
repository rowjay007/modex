import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({
  path: '.env',
});

export default defineConfig({
  schema: "./src/models/schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // @ts-ignore
    url: process.env.DIRECT_URL!,
  },
  verbose: true,
  strict: true,
});
