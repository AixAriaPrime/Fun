import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type { ModelSpec } from "../src/providers/types.js";

const models: ModelSpec[] = [
  { id: "mock:a", label: "A", provider: "mock", model: "mock-a" },
  { id: "mock:b", label: "B", provider: "mock", model: "mock-b" },
  { id: "mock:judge", label: "Judge", provider: "mock", model: "mock-judge", judge: true },
];

const config: AppConfig = { port: 8080, perModelTimeoutMs: 5000, models };

describe("API", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(createApp(config)).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/models lists members and a judge", async () => {
    const res = await request(createApp(config)).get("/api/models");
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);
    expect(res.body.judge.id).toBe("mock:judge");
  });

  it("POST /api/chat streams SSE events ending in done", async () => {
    const res = await request(createApp(config))
      .post("/api/chat")
      .send({ messages: [{ role: "user", content: "hello" }] });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain("event: candidates");
    expect(res.text).toContain("event: token");
    expect(res.text).toContain("event: done");
  });

  it("POST /api/chat rejects an invalid body", async () => {
    const res = await request(createApp(config)).post("/api/chat").send({ messages: [] });
    expect(res.status).toBe(400);
  });
});
