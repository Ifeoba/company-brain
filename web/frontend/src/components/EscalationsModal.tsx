import { useState } from "react";
import { useEscalations, useResolveEscalation } from "../api/hooks";
import type { EscalationOut } from "../types";

interface Props {
  onClose: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ArgRow({ args }: { args: Record<string, unknown> }) {
  const entries = Object.entries(args);
  if (!entries.length) return null;
  return (
    <div className="tc-args" style={{ marginBottom: 10 }}>
      {entries.map(([k, v]) => (
        <div key={k} className="tc-arg-row">
          <span className="tc-arg-key">{k}</span>
          <span className="tc-arg-val">{typeof v === "string" ? v : JSON.stringify(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function EscalationsModal({ onClose }: Props) {
  const { data: escalations = [], isLoading } = useEscalations();
  const resolve = useResolveEscalation();
  const [resolutionText, setResolutionText] = useState<Record<string, string>>({});

  const pending = escalations.filter((e) => e.status === "pending");
  const resolved = escalations.filter((e) => e.status === "resolved");

  function handleResolve(esc: EscalationOut, verdict: "approved" | "denied") {
    resolve.mutate({
      escId: esc.id,
      verdict,
      resolution: resolutionText[esc.id] || "",
    });
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal-card escalations-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Actions waiting for review</h2>
        <div className="modal-sub">
          These actions were flagged by your brains as needing a human decision before they run.
          Approve to let them proceed, or deny to skip them.
        </div>

        {isLoading && <p className="dim" style={{ fontSize: 13 }}>Loading…</p>}

        {!isLoading && pending.length === 0 && (
          <div className="escalations-empty">
            <p className="dim" style={{ fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              No pending actions — you're all caught up.
            </p>
          </div>
        )}

        {pending.map((esc) => (
          <div key={esc.id} className="esc-card esc-pending">
            <div className="esc-meta">
              <span className="esc-brain">{esc.brain_name}</span>
              <span className="dim" style={{ fontSize: 11 }}>{relativeTime(esc.created_at)}</span>
            </div>
            {esc.run_case_snippet && (
              <div className="esc-case dim">{esc.run_case_snippet}{esc.run_case_snippet.length === 120 ? "…" : ""}</div>
            )}
            {esc.tool_call && (
              <div className="esc-tool">
                <span className="tc-name">{esc.tool_call.tool_name}</span>
                <ArgRow args={esc.tool_call.arguments} />
              </div>
            )}
            <div className="esc-reason dim" style={{ fontSize: 12, marginBottom: 8 }}>{esc.reason}</div>
            <input
              className="input"
              style={{ fontSize: 12, marginBottom: 8 }}
              placeholder="Notes (optional)"
              value={resolutionText[esc.id] || ""}
              onChange={(e) =>
                setResolutionText((prev) => ({ ...prev, [esc.id]: e.target.value }))
              }
            />
            <div className="tc-actions">
              <button
                className="btn btn-sm"
                style={{ color: "var(--bad)" }}
                disabled={resolve.isPending}
                onClick={() => handleResolve(esc, "denied")}
              >
                Deny
              </button>
              <button
                className="btn btn-sm btn-primary"
                disabled={resolve.isPending}
                onClick={() => handleResolve(esc, "approved")}
              >
                Approve
              </button>
            </div>
          </div>
        ))}

        {resolved.length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary className="dim" style={{ fontSize: 12, cursor: "pointer" }}>
              {resolved.length} resolved
            </summary>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {resolved.map((esc) => (
                <div key={esc.id} className="esc-card esc-resolved">
                  <div className="esc-meta">
                    <span className="esc-brain">{esc.brain_name}</span>
                    <span className={`pill ${esc.resolution?.startsWith("approved") || esc.tool_call?.status === "approved" ? "ok" : "bad"}`} style={{ fontSize: 10 }}>
                      {esc.tool_call?.status === "approved" ? "Approved" : "Denied"}
                    </span>
                    <span className="dim" style={{ fontSize: 11 }}>{esc.resolved_at ? relativeTime(esc.resolved_at) : ""}</span>
                  </div>
                  {esc.tool_call && <span className="tc-name" style={{ fontSize: 12 }}>{esc.tool_call.tool_name}</span>}
                  {esc.resolution && <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{esc.resolution}</div>}
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="footer-row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
