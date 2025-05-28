import dotenv from "dotenv";
import { Secret } from "jsonwebtoken";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  port: z.string().default("3000"),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  dbUrl: z.string(),
  jwtSecret: z.string().transform((val): Secret => val),
  jwtExpiresIn: z.string().default("1d"),
  bcryptSaltRounds: z.number().default(10),
  smtpHost: z.string().default("smtp.gmail.com"),
  smtpPort: z.number().default(465),
  smtpUser: z.string(),
  smtpPassword: z.string(),
  emailFrom: z.string(),
  appUrl: z.string().default("http://localhost:3000"),
  redisUrl: z.string(),
  redisToken: z.string(),
});

type Config = z.infer<typeof configSchema>;

export const config: Config = {
  port: process.env.PORT || "3000",
  nodeEnv: (process.env.NODE_ENV as Config["nodeEnv"]) || "development",
  dbUrl: process.env.DATABASE_URL || process.env.DIRECT_URL || "",
  jwtSecret: process.env.JWT_SECRET || "your-secret-key",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  // Email configuration
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT) || 465,
  smtpUser: process.env.SMTP_USER || "",
  smtpPassword: process.env.SMTP_PASSWORD || "",
  emailFrom: process.env.EMAIL_FROM || "noreply@yourdomain.com",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  // Redis configuration
  redisUrl: process.env.UPSTASH_REDIS_REST_URL || "",
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
};

try {
  configSchema.parse(config);
} catch (error) {
  throw new Error(`Configuration validation error: ${error}`);
}
