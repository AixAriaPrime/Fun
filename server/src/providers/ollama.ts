import type { GenerateOptions, Provider } from "./types.js";

/**
 * Adapter for a local Ollama server (https://ollama.com). Runs open models such
 * as llama3, qwen2 or mistral with no API key and no cost. Enabled when
 * OLLAMA_BASE_URL is reachable (defaults to http://localhost:11434).
 */
export class OllamaProvider implements Provider {
  readonly name = "ollama";
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    this.enabled = (process.env.ENABLE_OLLAMA ?? "false").toLowerCase() === "true";
  }

  isConfigured(): boolean {
    return this.enabled;
  }

  async generate(opts: GenerateOptions): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      signal: opts.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        stream: false,
        options: { temperature: opts.temperature ?? 0.7 },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama error ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new Error("Ollama returned an empty completion");
    }
    return content;
  }
}
