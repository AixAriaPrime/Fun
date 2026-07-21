import { describe, it, expect } from "vitest";
import { MockProvider } from "../src/providers/mock.js";
import { OpenRouterProvider } from "../src/providers/openrouter.js";
import { OllamaProvider } from "../src/providers/ollama.js";

describe("MockProvider", () => {
  it("is always configured", () => {
    expect(new MockProvider().isConfigured()).toBe(true);
  });

  it("produces non-empty, deterministic output", async () => {
    const p = new MockProvider();
    const opts = { model: "mock-a", messages: [{ role: "user" as const, content: "hi" }] };
    const a = await p.generate(opts);
    const b = await p.generate(opts);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toBe(b);
  });

  it("gives different flavour to different models", async () => {
    const p = new MockProvider();
    const base = { messages: [{ role: "user" as const, content: "hi" }] };
    const a = await p.generate({ ...base, model: "mock-a" });
    const c = await p.generate({ ...base, model: "mock-c" });
    expect(a).not.toBe(c);
  });

  it("synthesizes when acting as judge", async () => {
    const p = new MockProvider();
    const out = await p.generate({
      model: "mock-judge",
      messages: [
        { role: "system", content: "SYNTHESIS_JUDGE merge these" },
        { role: "user", content: "question" },
      ],
    });
    expect(out.toLowerCase()).toContain("synthesized");
  });
});

describe("OpenRouterProvider", () => {
  it("is not configured without an API key", () => {
    expect(new OpenRouterProvider("").isConfigured()).toBe(false);
  });

  it("is configured when an API key is provided", () => {
    expect(new OpenRouterProvider("sk-test").isConfigured()).toBe(true);
  });
});

describe("OllamaProvider", () => {
  it("is disabled by default", () => {
    const prev = process.env.ENABLE_OLLAMA;
    delete process.env.ENABLE_OLLAMA;
    expect(new OllamaProvider().isConfigured()).toBe(false);
    if (prev !== undefined) process.env.ENABLE_OLLAMA = prev;
  });
});
