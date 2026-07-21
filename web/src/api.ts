export interface Candidate {
  modelId: string;
  label: string;
  content: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ModelInfo {
  id: string;
  label: string;
  provider: string;
}

export interface ModelsResponse {
  members: ModelInfo[];
  judge: ModelInfo | null;
}

export interface StreamHandlers {
  onStatus?: (stage: string, models?: string[]) => void;
  onCandidates?: (candidates: Candidate[]) => void;
  onToken?: (text: string) => void;
  onDone?: (judgeModelId: string | null) => void;
  onError?: (message: string) => void;
}

export async function fetchModels(): Promise<ModelsResponse> {
  const res = await fetch("/api/models");
  if (!res.ok) throw new Error(`Failed to load models (${res.status})`);
  return (await res.json()) as ModelsResponse;
}

/**
 * POSTs the conversation and consumes the Server-Sent-Events stream, invoking
 * the matching handler for each event. Returns a function that aborts the call.
 */
export function streamChat(
  messages: ChatMessage[],
  handlers: StreamHandlers,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        handlers.onError?.(`Request failed (${res.status}): ${text}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          dispatchFrame(frame, handlers);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        handlers.onError?.((err as Error).message);
      }
    }
  })();

  return () => controller.abort();
}

function dispatchFrame(frame: string, handlers: StreamHandlers): void {
  let event = "message";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return;

  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return;
  }

  switch (event) {
    case "status": {
      const p = payload as { stage: string; models?: string[] };
      handlers.onStatus?.(p.stage, p.models);
      break;
    }
    case "candidates": {
      const p = payload as { candidates: Candidate[] };
      handlers.onCandidates?.(p.candidates);
      break;
    }
    case "token": {
      const p = payload as { text: string };
      handlers.onToken?.(p.text);
      break;
    }
    case "done": {
      const p = payload as { judgeModelId: string | null };
      handlers.onDone?.(p.judgeModelId);
      break;
    }
    case "error": {
      const p = payload as { message: string };
      handlers.onError?.(p.message);
      break;
    }
  }
}
