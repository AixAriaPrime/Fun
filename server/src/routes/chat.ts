import { Router } from "express";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { activeModels } from "../config.js";
import type { Provider } from "../providers/index.js";
import { fanOut, synthesize } from "../empire/engine.js";
import type { ChatMessage } from "../providers/types.js";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1),
});

export function chatRouter(config: AppConfig, providers: Map<string, Provider>): Router {
  const router = Router();

  router.post("/chat", async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      return;
    }

    const models = activeModels(config.models, providers);
    if (models.filter((m) => !m.judge).length === 0) {
      res.status(503).json({ error: "No models are configured" });
      return;
    }

    // Server-Sent Events stream.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const ac = new AbortController();
    // Abort only when the client actually disconnects. Note: req "close" fires
    // once the request body has been read, so we listen on the response.
    res.on("close", () => ac.abort());

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const messages = parsed.data.messages as ChatMessage[];

    try {
      send("status", { stage: "fanout", models: models.filter((m) => !m.judge).map((m) => m.label) });

      const candidates = await fanOut({
        models,
        providers,
        messages,
        perModelTimeoutMs: config.perModelTimeoutMs,
        signal: ac.signal,
      });
      send("candidates", { candidates });

      send("status", { stage: "synthesis" });
      const { answer, judgeModelId } = await synthesize(
        { models, providers, messages, perModelTimeoutMs: config.perModelTimeoutMs, signal: ac.signal },
        candidates,
      );

      // Stream the final answer in small chunks for a live typing effect.
      const chunkSize = 24;
      for (let i = 0; i < answer.length; i += chunkSize) {
        if (ac.signal.aborted) break;
        send("token", { text: answer.slice(i, i + chunkSize) });
      }

      send("done", { judgeModelId });
    } catch (err) {
      send("error", { message: err instanceof Error ? err.message : String(err) });
    } finally {
      res.end();
    }
  });

  return router;
}
