import { describe, it, expect } from "vitest";
import { fanOut, synthesize, bestPick, runEmpire } from "../src/empire/engine.js";
import { MockProvider } from "../src/providers/mock.js";
import type { Provider, GenerateOptions } from "../src/providers/types.js";
import type { ModelSpec, ChatMessage, CandidateAnswer } from "../src/providers/types.js";

class ThrowingProvider implements Provider {
  readonly name = "throwing";
  isConfigured() {
    return true;
  }
  async generate(_opts: GenerateOptions): Promise<string> {
    throw new Error("boom");
  }
}

function mockProviders(): Map<string, Provider> {
  const m = new Map<string, Provider>();
  m.set("mock", new MockProvider());
  m.set("throwing", new ThrowingProvider());
  return m;
}

const mockModels: ModelSpec[] = [
  { id: "mock:a", label: "A", provider: "mock", model: "mock-a" },
  { id: "mock:b", label: "B", provider: "mock", model: "mock-b" },
  { id: "mock:c", label: "C", provider: "mock", model: "mock-c" },
  { id: "mock:judge", label: "Judge", provider: "mock", model: "mock-judge", judge: true },
];

const messages: ChatMessage[] = [{ role: "user", content: "How do I sort a list?" }];

describe("fanOut", () => {
  it("returns one candidate per non-judge model", async () => {
    const candidates = await fanOut({ models: mockModels, providers: mockProviders(), messages });
    expect(candidates).toHaveLength(3);
    expect(candidates.every((c) => c.ok)).toBe(true);
    expect(candidates.every((c) => c.content.length > 0)).toBe(true);
  });

  it("marks a failing model as not ok but keeps others", async () => {
    const models: ModelSpec[] = [
      { id: "mock:a", label: "A", provider: "mock", model: "mock-a" },
      { id: "bad", label: "Bad", provider: "throwing", model: "x" },
    ];
    const candidates = await fanOut({ models, providers: mockProviders(), messages });
    const bad = candidates.find((c) => c.modelId === "bad");
    const good = candidates.find((c) => c.modelId === "mock:a");
    expect(bad?.ok).toBe(false);
    expect(bad?.error).toContain("boom");
    expect(good?.ok).toBe(true);
  });

  it("reports unconfigured providers as errors", async () => {
    const models: ModelSpec[] = [{ id: "x", label: "X", provider: "missing", model: "y" }];
    const candidates = await fanOut({ models, providers: mockProviders(), messages });
    expect(candidates[0].ok).toBe(false);
    expect(candidates[0].error).toContain("not configured");
  });
});

describe("bestPick", () => {
  it("chooses the longest successful candidate", () => {
    const cands: CandidateAnswer[] = [
      { modelId: "a", label: "A", content: "short", ok: true, latencyMs: 0 },
      { modelId: "b", label: "B", content: "a much longer answer here", ok: true, latencyMs: 0 },
      { modelId: "c", label: "C", content: "", ok: false, latencyMs: 0 },
    ];
    expect(bestPick(cands)?.modelId).toBe("b");
  });

  it("returns null when nothing succeeded", () => {
    const cands: CandidateAnswer[] = [
      { modelId: "a", label: "A", content: "", ok: false, latencyMs: 0 },
    ];
    expect(bestPick(cands)).toBeNull();
  });
});

describe("synthesize", () => {
  it("uses the judge to merge candidates", async () => {
    const providers = mockProviders();
    const candidates = await fanOut({ models: mockModels, providers, messages });
    const { answer, judgeModelId } = await synthesize(
      { models: mockModels, providers, messages },
      candidates,
    );
    expect(judgeModelId).toBe("mock:judge");
    expect(answer.toLowerCase()).toContain("synthesized");
  });

  it("falls back to best-pick when there is no judge", async () => {
    const providers = mockProviders();
    const noJudge = mockModels.filter((m) => !m.judge);
    const candidates = await fanOut({ models: noJudge, providers, messages });
    const { answer, judgeModelId } = await synthesize(
      { models: noJudge, providers, messages },
      candidates,
    );
    expect(judgeModelId).toBeNull();
    expect(answer.length).toBeGreaterThan(0);
  });
});

describe("runEmpire", () => {
  it("produces an answer and candidate list", async () => {
    const result = await runEmpire({ models: mockModels, providers: mockProviders(), messages });
    expect(result.answer.length).toBeGreaterThan(0);
    expect(result.candidates).toHaveLength(3);
    expect(result.judgeModelId).toBe("mock:judge");
  });
});
