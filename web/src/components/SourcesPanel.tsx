import { useState } from "react";
import type { Candidate } from "../api";

/**
 * A subtle, collapsible panel that reveals how each model in the empire
 * answered. Hidden by default to keep the main chat minimal.
 */
export function SourcesPanel({ candidates }: { candidates: Candidate[] }) {
  const [open, setOpen] = useState(false);
  if (candidates.length === 0) return null;

  const okCount = candidates.filter((c) => c.ok).length;

  return (
    <div className="sources">
      <button
        className="sources-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "▾" : "▸"} Show sources ({okCount}/{candidates.length} models)
      </button>
      {open && (
        <div className="sources-list">
          {candidates.map((c) => (
            <div key={c.modelId} className={`source ${c.ok ? "ok" : "fail"}`}>
              <div className="source-head">
                <span className="source-label">{c.label}</span>
                <span className="source-meta">
                  {c.ok ? `${c.latencyMs} ms` : "failed"}
                </span>
              </div>
              <div className="source-body">
                {c.ok ? c.content : c.error ?? "No response"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
