import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import apiRouter from "./routes";
import { errorHandler } from "./middleware/error";
import { logger } from "./utils/logger";
import swaggerSpec from "./config/swagger";

const app = express();

app.use(helmet());
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (!req.url.startsWith('/docs')) {
    logger.info(`${req.method} ${req.url}`);
  }
  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api", apiRouter);

app.use(errorHandler);

export { app };
