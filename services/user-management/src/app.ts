import cors from "cors";
import express from "express";
import helmet from "helmet";
import userRoutes from "./routes/userRoutes";
import { logger } from "./utils/logger";

// Initialize express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Simple health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// API Routes
app.use("/api/users", userRoutes);

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
);

export { app };
