import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import type { ModelSpec } from "./providers/types.js";
import type { Provider } from "./providers/index.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AppConfig {
  port: number;
  perModelTimeoutMs: number;
  models: ModelSpec[];
}

function loadModelsFile(): ModelSpec[] {
  // models.json lives at the server workspace root (one level above src/dist).
  const candidates = [
    resolve(__dirname, "..", "models.json"),
    resolve(__dirname, "..", "..", "models.json"),
  ];
  for (const path of candidates) {
    try {
      const raw = readFileSync(path, "utf8");
      const parsed = JSON.parse(raw) as { models?: ModelSpec[] };
      if (Array.isArray(parsed.models)) {
        return parsed.models;
      }
    } catch {
      // try next candidate
    }
  }
  return [];
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 8080);
  const perModelTimeoutMs = Number(process.env.MODEL_TIMEOUT_MS ?? 30000);
  return { port, perModelTimeoutMs, models: loadModelsFile() };
}

/**
 * Returns the models that are actually usable given which providers are
 * configured. If no external provider is configured, the mock models remain so
 * the empire still runs offline.
 */
export function activeModels(
  models: ModelSpec[],
  providers: Map<string, Provider>,
): ModelSpec[] {
  return models.filter((m) => {
    const provider = providers.get(m.provider);
    return provider != null && provider.isConfigured();
  });
}
