import express from "express";
import cors from "cors";
import type { AppConfig } from "./config.js";
import { buildProviders } from "./providers/index.js";
import { chatRouter } from "./routes/chat.js";
import { modelsRouter } from "./routes/models.js";

/** Builds the Express app. Exported separately so tests can mount it. */
export function createApp(config: AppConfig) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  const providers = buildProviders();

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", modelsRouter(config, providers));
  app.use("/api", chatRouter(config, providers));

  return app;
}
