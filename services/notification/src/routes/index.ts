import { Router } from "express";
import notificationRoutes from "./notificationRoutes";

const v1Router = Router();
v1Router.use("/notifications", notificationRoutes);

const apiRouter = Router();
apiRouter.use("/v1", v1Router);

apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

export default apiRouter;
