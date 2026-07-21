# Empire of Free LLMs

Ask once, get answered by an **empire** of free large language models.

Your question is fanned out to several free/open models **in parallel**; a judge
model then merges their strongest points into a single, most-accurate answer.
All of this is presented through a clean, minimalistic, ChatGPT-style chat UI.

> Runs out of the box with **no API keys** thanks to a built-in mock provider.
> Add an OpenRouter key or a local Ollama server to use real models.

---

## How it works

```
                    ┌─────────── fan-out (parallel) ───────────┐
  your question ───►│  model A     model B     model C  ...     │
                    └──────────────────┬───────────────────────┘
                                       ▼
                              judge / synthesis
                                       ▼
                            one best, merged answer  ──► streamed to the UI
```

- **Fan-out** — the prompt is sent to every member model concurrently.
- **Aggregate** — a *judge* model merges the candidate answers (synthesis).
  If no judge is configured, a *best-pick* heuristic selects the strongest
  candidate instead.
- **Provenance** — a subtle, collapsible "Show sources" panel reveals what each
  model answered, keeping the main chat minimal.

## Project layout

```
.
├── server/            # Node + Express + TypeScript backend
│   ├── src/
│   │   ├── providers/  # adapters: mock, openrouter, ollama (+ registry)
│   │   ├── empire/     # the ensemble engine (fan-out + synthesis)
│   │   ├── routes/     # POST /api/chat (SSE), GET /api/models
│   │   ├── config.ts   # env + models.json loader
│   │   └── app.ts      # Express app factory
│   ├── test/           # vitest: engine, providers, api
│   └── models.json     # which models form the empire (+ the judge)
└── web/               # React + Vite + TypeScript frontend (minimalistic chat)
```

## Prerequisites

- Node.js >= 20

## Quick start (no keys required)

```bash
npm install

# terminal A – backend on http://localhost:8080
npm run dev:server

# terminal B – frontend on http://localhost:5080 (proxies /api to the backend)
npm run dev:web
```

Open http://localhost:5080 and start chatting. With no keys, the built-in
**mock** models answer so you can see the full fan-out + synthesis pipeline.

## Enabling real free models

Copy the example env file and fill in what you have:

```bash
cp server/.env.example server/.env
```

### Option A — OpenRouter (one key, many free models)

******. Create a free key at https://openrouter.ai/keys
2. Set `OPENROUTER_API_KEY` in `server/.env`

Free models used by default (see `server/models.json`, ids ending in `:free`):
`meta-llama/llama-3.1-8b-instruct`, `qwen/qwen-2.5-7b-instruct`,
`google/gemma-2-9b-it`, with `meta-llama/llama-3.3-70b-instruct` as the judge.

### Option B — Ollama (fully local, no key, no cost)

******. Install Ollama from https://ollama.com
2. Pull some models: `ollama pull llama3 && ollama pull qwen2 && ollama pull mistral`
3. In `server/.env` set `ENABLE_OLLAMA=true` (defaults to `http://localhost:11434`)

> **Security:** never commit real keys. `server/.env` is git-ignored; provide
> keys via environment variables or CI/hosting secrets only.

## Configuration (`server/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Backend port |
| `MODEL_TIMEOUT_MS` | `30000` | Per-model timeout for each fan-out call |
| `OPENROUTER_API_KEY` | _(empty)_ | Enables the OpenRouter provider |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Override OpenRouter endpoint |
| `ENABLE_OLLAMA` | `false` | Enables the local Ollama provider |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |

Edit `server/models.json` to choose which models form the empire. Mark exactly
one entry with `"judge": true` to make it the synthesizer.

## API

- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/models` → active member models and the judge
- `POST /api/chat` → Server-Sent-Events stream. Body: `{ "messages": [{ "role": "user", "content": "..." }] }`
  Events: `status`, `candidates`, `token` (streamed final answer), `done`, `error`.

## Testing

```bash
npm test            # runs the server vitest suite (engine + providers + api)
```

## Production build

```bash
npm run build       # builds server (tsc) and web (vite)
npm start           # runs the compiled backend
```

Serve the static `web/dist` behind any static host or reverse-proxy, and point
`/api` at the running backend.

## License

MIT
