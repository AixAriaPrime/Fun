import { useEffect, useRef, useState } from "react";
import {
  fetchModels,
  streamChat,
  type Candidate,
  type ModelsResponse,
} from "./api";
import { SourcesPanel } from "./components/SourcesPanel";
import "./App.css";

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  candidates?: Candidate[];
  status?: string;
  pending?: boolean;
}

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("empire-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("empire-theme", theme);
  }, [theme]);
  return { theme, setTheme };
}

export default function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const { theme, setTheme } = useTheme();
  const stopRef = useRef<null | (() => void)>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchModels()
      .then(setModels)
      .catch(() => setModels(null));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  function patchLast(update: (t: Turn) => Turn) {
    setTurns((prev) => {
      const next = prev.slice();
      const idx = next.length - 1;
      if (idx >= 0) next[idx] = update(next[idx]);
      return next;
    });
  }

  function send() {
    const text = input.trim();
    if (!text || busy) return;

    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    const userTurn: Turn = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantTurn: Turn = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      pending: true,
      status: "starting",
    };
    setTurns((prev) => [...prev, userTurn, assistantTurn]);
    setInput("");
    setBusy(true);

    stopRef.current = streamChat(
      [...history, { role: "user", content: text }],
      {
        onStatus: (stage) => patchLast((t) => ({ ...t, status: stage })),
        onCandidates: (candidates) => patchLast((t) => ({ ...t, candidates })),
        onToken: (chunk) =>
          patchLast((t) => ({ ...t, content: t.content + chunk })),
        onDone: () => {
          patchLast((t) => ({ ...t, pending: false, status: undefined }));
          setBusy(false);
          stopRef.current = null;
        },
        onError: (message) => {
          patchLast((t) => ({
            ...t,
            pending: false,
            status: undefined,
            content: t.content || `WARNING: ${message}`,
          }));
          setBusy(false);
          stopRef.current = null;
        },
      },
    );
  }

  function stop() {
    stopRef.current?.();
    stopRef.current = null;
    patchLast((t) => ({ ...t, pending: false, status: undefined }));
    setBusy(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const memberCount = models?.members.length ?? 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">♛</span>
          <span className="brand-name">Empire of Free LLMs</span>
        </div>
        <div className="topbar-right">
          {memberCount > 0 && (
            <span className="model-count">{memberCount} models</span>
          )}
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <main className="chat">
        {turns.length === 0 ? (
          <div className="empty">
            <h2>Ask once. Answered by an empire.</h2>
            <p>
              Your question is sent to {memberCount > 0 ? memberCount : "several"}{" "}
              free models in parallel, then a judge merges them into one best
              answer.
            </p>
          </div>
        ) : (
          <div className="thread">
            {turns.map((t) => (
              <div key={t.id} className={`turn ${t.role}`}>
                <div className="bubble">
                  {t.content ||
                    (t.pending ? (
                      <span className="thinking">
                        {t.status === "synthesis"
                          ? "Synthesizing best answer..."
                          : t.status === "fanout"
                            ? "Consulting the empire..."
                            : "Thinking..."}
                      </span>
                    ) : (
                      ""
                    ))}
                </div>
                {t.role === "assistant" && t.candidates && (
                  <SourcesPanel candidates={t.candidates} />
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <footer className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message the empire..."
          rows={1}
        />
        {busy ? (
          <button className="stop" onClick={stop}>
            Stop
          </button>
        ) : (
          <button className="send" onClick={send} disabled={!input.trim()}>
            Send
          </button>
        )}
      </footer>
    </div>
  );
}
