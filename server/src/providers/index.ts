import type { Provider } from "./types.js";
import { MockProvider } from "./mock.js";
import { OpenRouterProvider } from "./openrouter.js";
import { OllamaProvider } from "./ollama.js";

/**
 * Builds the provider registry. The Mock provider is always present so the app
 * works with no API keys; OpenRouter and Ollama are added when configured.
 */
export function buildProviders(): Map<string, Provider> {
  const providers: Provider[] = [
    new MockProvider(),
    new OpenRouterProvider(),
    new OllamaProvider(),
  ];
  const map = new Map<string, Provider>();
  for (const p of providers) {
    map.set(p.name, p);
  }
  return map;
}

export type { Provider };
