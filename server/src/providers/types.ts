/**
 * Core types shared across the Empire of Free LLMs backend.
 */

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

/** A model that participates in the empire. */
export interface ModelSpec {
  /** Stable id used in the API, e.g. "openrouter:meta-llama/llama-3-8b". */
  id: string;
  /** Human friendly label shown in the UI. */
  label: string;
  /** Which provider adapter handles this model. */
  provider: string;
  /** The provider specific model name passed to the underlying API. */
  model: string;
  /** If true, this model is used as the judge that synthesizes the final answer. */
  judge?: boolean;
}

export interface GenerateOptions {
  messages: ChatMessage[];
  model: string;
  /** Abort signal so slow models can be cancelled. */
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

/**
 * A provider adapter. Every backend (OpenRouter, Ollama, Mock, ...) implements
 * this same contract, so the empire engine can treat them uniformly.
 */
export interface Provider {
  /** Unique provider name, e.g. "openrouter". */
  readonly name: string;
  /** True when the provider is configured well enough to be used. */
  isConfigured(): boolean;
  /** Produce a single completion for the given messages. */
  generate(opts: GenerateOptions): Promise<string>;
}

/** The answer produced by one member of the empire. */
export interface CandidateAnswer {
  modelId: string;
  label: string;
  content: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
}

/** Final result returned by the empire engine. */
export interface EmpireResult {
  answer: string;
  judgeModelId: string | null;
  candidates: CandidateAnswer[];
}
