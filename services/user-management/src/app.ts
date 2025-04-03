import { NodeSDK } from "@opentelemetry/sdk-node";
import { Redis } from "@upstash/redis";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import helmet from "helmet";
import { connect, NatsConnection } from "nats";
import userRoutes from "./routes/userroutes";

config();

export const redis = new Redis({
  url: process.env.REDIS_URL || "",
  token: process.env.REDIS_TOKEN || "",
});

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

app.use("/api/users", userRoutes);

const sdk = new NodeSDK();
sdk.start();

export let nats: NatsConnection;

const initialize = async () => {
  try {
    nats = await connect({
      servers: process.env.NATS_URL || "nats://localhost:4222",
    });
    console.log("Connected to NATS");
  } catch (error) {
    console.error("Failed to connect to NATS:", error);
    process.exit(1);
  }
};

initialize();

export default app;