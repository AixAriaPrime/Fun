import { Router } from "express";
import type { AppConfig } from "../config.js";
import { activeModels } from "../config.js";
import type { Provider } from "../providers/index.js";

export function modelsRouter(config: AppConfig, providers: Map<string, Provider>): Router {
  const router = Router();

  router.get("/models", (_req, res) => {
    const active = activeModels(config.models, providers);
    res.json({
      members: active
        .filter((m) => !m.judge)
        .map((m) => ({ id: m.id, label: m.label, provider: m.provider })),
      judge: active
        .filter((m) => m.judge)
        .map((m) => ({ id: m.id, label: m.label, provider: m.provider }))[0] ?? null,
    });
  });

  return router;
}
