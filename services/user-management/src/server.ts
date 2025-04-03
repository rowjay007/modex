import { NodeSDK } from "@opentelemetry/sdk-node";
import { Server } from "http";
import app, { nats } from "./app";

const sdk: NodeSDK = new NodeSDK();
sdk.start();

const PORT: string | number = process.env.PORT || 3000;
const server: Server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received. Closing HTTP server...");
  server.close(async (err?: Error) => {
    if (err) {
      console.error("Error closing HTTP server:", err);
      process.exit(1);
    }
    
    console.log("HTTP server closed.");
    try {
      await nats.close();
      console.log("NATS connection closed.");      
      await sdk.shutdown();
      console.log("OpenTelemetry SDK shut down.");
      
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  });
});

export default server;