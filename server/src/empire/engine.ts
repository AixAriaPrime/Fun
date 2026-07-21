import type {
  CandidateAnswer,
  ChatMessage,
  EmpireResult,
  ModelSpec,
} from "../providers/types.js";
import type { Provider } from "../providers/index.js";

export interface EmpireOptions {
  models: ModelSpec[];
  providers: Map<string, Provider>;
  messages: ChatMessage[];
  perModelTimeoutMs?: number;
  signal?: AbortSignal;
}

const JUDGE_MARKER = "SYNTHESIS_JUDGE";

function withTimeout(parent: AbortSignal | undefined, ms: number): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("model timeout")), ms);
  const onAbort = () => ctrl.abort(parent?.reason);
  if (parent) {
    if (parent.aborted) ctrl.abort(parent.reason);
    else parent.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cancel: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}

/** Fan a query out to every member model concurrently. */
export async function fanOut(opts: EmpireOptions): Promise<CandidateAnswer[]> {
  const members = opts.models.filter((m) => !m.judge);
  const timeoutMs = opts.perModelTimeoutMs ?? 30000;

  const tasks = members.map(async (spec): Promise<CandidateAnswer> => {
    const provider = opts.providers.get(spec.provider);
    const started = Date.now();
    if (!provider || !provider.isConfigured()) {
      return {
        modelId: spec.id,
        label: spec.label,
        content: "",
        ok: false,
        error: `provider "${spec.provider}" is not configured`,
        latencyMs: 0,
      };
    }
    const t = withTimeout(opts.signal, timeoutMs);
    try {
      const content = await provider.generate({
        messages: opts.messages,
        model: spec.model,
        signal: t.signal,
      });
      return {
        modelId: spec.id,
        label: spec.label,
        content: content.trim(),
        ok: true,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      return {
        modelId: spec.id,
        label: spec.label,
        content: "",
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - started,
      };
    } finally {
      t.cancel();
    }
  });

  return Promise.all(tasks);
}

function lastUserQuestion(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

/**
 * Best-pick fallback used when no judge is available: choose the longest
 * successful candidate as a rough proxy for the most complete answer.
 */
export function bestPick(candidates: CandidateAnswer[]): CandidateAnswer | null {
  const ok = candidates.filter((c) => c.ok && c.content.length > 0);
  if (ok.length === 0) return null;
  return ok.slice().sort((a, b) => b.content.length - a.content.length)[0];
}

/**
 * Ask the judge model to merge the candidate answers into one improved answer.
 * Falls back to best-pick when the judge is missing or fails.
 */
export async function synthesize(
  opts: EmpireOptions,
  candidates: CandidateAnswer[],
): Promise<{ answer: string; judgeModelId: string | null }> {
  const question = lastUserQuestion(opts.messages);
  const okCandidates = candidates.filter((c) => c.ok && c.content.length > 0);

  const judgeSpec = opts.models.find((m) => m.judge);
  const judgeProvider = judgeSpec
    ? opts.providers.get(judgeSpec.provider)
    : undefined;

  if (okCandidates.length === 0) {
    return { answer: "", judgeModelId: null };
  }

  if (judgeSpec && judgeProvider && judgeProvider.isConfigured()) {
    const answersBlock = okCandidates
      .map((c) => `### ${c.label}\n${c.content}`)
      .join("\n\n");
    const judgeMessages: ChatMessage[] = [
      {
        role: "system",
        content:
          `${JUDGE_MARKER}\nYou are the judge of an empire of language models. ` +
          "Multiple models answered the user's question. Merge their strongest, " +
          "most accurate points into a single best answer. Resolve disagreements, " +
          "drop errors, and be concise. Do not mention that multiple models were used.",
      },
      {
        role: "user",
        content:
          `User question:\n${question}\n\nCandidate answers:\n${answersBlock}\n\n` +
          "Write the single best, most accurate answer.",
      },
    ];
    const t = withTimeout(opts.signal, opts.perModelTimeoutMs ?? 30000);
    try {
      const answer = await judgeProvider.generate({
        messages: judgeMessages,
        model: judgeSpec.model,
        signal: t.signal,
      });
      return { answer: answer.trim(), judgeModelId: judgeSpec.id };
    } catch {
      // fall through to best-pick
    } finally {
      t.cancel();
    }
  }

  const pick = bestPick(candidates);
  return { answer: pick ? pick.content : "", judgeModelId: null };
}

/** Run the full empire: fan-out then synthesis. */
export async function runEmpire(opts: EmpireOptions): Promise<EmpireResult> {
  const candidates = await fanOut(opts);
  const { answer, judgeModelId } = await synthesize(opts, candidates);
  return { answer, judgeModelId, candidates };
}
