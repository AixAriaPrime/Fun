import type { GenerateOptions, Provider } from "./types.js";

/**
 * Adapter for OpenRouter (https://openrouter.ai), which exposes many free-tier
 * models behind a single OpenAI-compatible endpoint. Set OPENROUTER_API_KEY to
 * enable it. Free models usually have an id ending in ":free".
 */
export class OpenRouterProvider implements Provider {
  readonly name = "openrouter";
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey = process.env.OPENROUTER_API_KEY ?? "", baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl =
      baseUrl ?? process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async generate(opts: GenerateOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("OpenRouter is not configured (missing OPENROUTER_API_KEY)");
    }
    const authValue = "Bearer " + this.apiKey;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      signal: opts.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: authValue,
        "HTTP-Referer": process.env.PUBLIC_APP_URL ?? "http://localhost",
        "X-Title": "Empire of Free LLMs",
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 800,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new Error("OpenRouter returned an empty completion");
    }
    return content;
  }
}
