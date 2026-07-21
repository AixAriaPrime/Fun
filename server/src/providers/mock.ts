import type { GenerateOptions, Provider } from "./types.js";

/**
 * A zero-dependency, no-API-key provider used as the default fallback so the
 * app runs out of the box. It produces deterministic, model-flavoured text so
 * the fan-out and synthesis pipeline can be exercised and tested offline.
 */
export class MockProvider implements Provider {
  readonly name = "mock";

  isConfigured(): boolean {
    return true;
  }

  async generate(opts: GenerateOptions): Promise<string> {
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user");
    const prompt = lastUser?.content?.trim() ?? "";

    // Judge / synthesis path: the mock judge merges the candidate answers that
    // are embedded in its system prompt into one consolidated reply.
    const isJudge = opts.messages.some(
      (m) => m.role === "system" && m.content.includes("SYNTHESIS_JUDGE"),
    );
    if (isJudge) {
      return this.synthesize(prompt);
    }

    return this.flavour(opts.model, prompt);
  }

  private flavour(model: string, prompt: string): string {
    const q = prompt.length > 0 ? prompt : "your question";
    const style = hash(model) % 3;
    if (style === 0) {
      return `Here is a concise take on "${q}": break it into small steps, verify each, then combine.`;
    }
    if (style === 2) {
      return `Considering "${q}", the key idea is to reason from first principles and check edge cases before concluding.`;
    }
    return `Regarding "${q}": a practical answer is to start simple, measure results, and iterate toward the goal.`;
  }

  private synthesize(prompt: string): string {
    const q = prompt.length > 0 ? prompt : "the question";
    return `Synthesized answer for ${q}: combining the strongest points from every model, the best approach is to reason step by step, verify against edge cases, and prefer the simplest solution that fully works.`;
  }
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) {
    h = (h * 37 + ch.charCodeAt(0)) >>> 0;
  }
  return h;
}
