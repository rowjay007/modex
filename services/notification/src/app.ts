import cors from "cors";
import express, { Request, Response } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./middleware/error";

// Initialize express app
const app = express();

// Apply middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "success", message: "Service is healthy" });
});

// Swagger documentation setup
import swaggerSpec from "./config/swagger";
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes with versioning
import apiRoutes from "./routes/index";
app.use("/api", apiRoutes);

// Handle 404 routes
app.all("*", (req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    message: `Can't find ${req.originalUrl} on this server!`,
  });
});

// Global error handler
app.use(errorHandler);

export default app;
