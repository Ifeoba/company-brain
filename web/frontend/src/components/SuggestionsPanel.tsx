import { useState } from "react";
import { useSuggestions, useAcceptSuggestion, useDismissSuggestion, useTriggerMaintainer } from "../api/hooks";
import type { MaintainerSuggestionOut } from "../types";

interface Props {
  slug: string;
  onClose: () => void;
}

const PATTERN_LABELS: Record<string, { label: string; cls: string }> = {
  recurring_escalation: { label: "Recurring escalation", cls: "warn" },
  repeated_corrections: { label: "Repeated corrections", cls: "warn" },
  drifting_eval: { label: "Drifting accuracy", cls: "bad" },
  quiet_brain: { label: "Unused brain", cls: "info" },
};

export default function SuggestionsPanel({ slug, onClose }: Props) {
  const { data: suggestions = [], isLoading, refetch } = useSuggestions(slug);
  const accept = useAcceptSuggestion(slug);
  const dismiss = useDismissSuggestion(slug);
  const trigger = useTriggerMaintainer(slug);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleAccept(s: MaintainerSuggestionOut) {
    await accept.mutateAsync(s.id);
    showToast(`Applied to ${s.target_file}`);
  }

  async function handleDismiss(s: MaintainerSuggestionOut) {
    await dismiss.mutateAsync(s.id);
  }

  // Extract the content after "APPEND TO filename:" prefix for display
  function displayDiff(s: MaintainerSuggestionOut): string {
    const prefix = `APPEND TO ${s.target_file}:`;
    const raw = s.proposed_diff || "";
    return raw.startsWith(prefix) ? raw.slice(prefix.length).trim() : raw;
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card suggestions-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Improvement suggestions</h2>
        <div className="modal-sub">
          The maintainer analyzed your run history and found patterns that suggest updates to this brain.
        </div>

        {isLoading && <p className="dim" style={{ fontSize: 13 }}>Analyzing…</p>}

        {!isLoading && suggestions.length === 0 && (
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <p className="dim" style={{ fontSize: 13, marginBottom: 12 }}>
              No suggestions right now — the brain looks healthy.
            </p>
            <button
              className="btn btn-sm btn-ghost"
              disabled={trigger.isPending}
              onClick={() => trigger.mutate(undefined, { onSuccess: () => { showToast("Analysis running…"); setTimeout(() => refetch(), 4000); } })}
            >
              {trigger.isPending ? "Running…" : "Run analysis now"}
            </button>
          </div>
        )}

        <div className="suggestion-list">
          {suggestions.map((s) => {
            const meta = PATTERN_LABELS[s.pattern_type] ?? { label: s.pattern_type, cls: "info" };
            const isExpanded = expandedId === s.id;
            return (
              <div key={s.id} className="suggestion-card">
                <div className="suggestion-header">
                  <span className={`pill ${meta.cls}`} style={{ fontSize: 10 }}>{meta.label}</span>
                  <span className="dim" style={{ fontSize: 11 }}>{s.target_file}</span>
                </div>
                <p style={{ fontSize: 13, margin: "8px 0" }}>{s.finding}</p>
                <button
                  className="btn-link"
                  style={{ fontSize: 12, marginBottom: isExpanded ? 8 : 0 }}
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                >
                  {isExpanded ? "Hide proposed change" : "View proposed change"}
                </button>
                {isExpanded && (
                  <pre className="suggestion-diff">{displayDiff(s)}</pre>
                )}
                <div className="tc-actions" style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={dismiss.isPending}
                    onClick={() => handleDismiss(s)}
                  >
                    Dismiss
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={accept.isPending}
                    onClick={() => handleAccept(s)}
                  >
                    Apply to brain
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {suggestions.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn btn-sm btn-ghost"
              disabled={trigger.isPending}
              onClick={() => trigger.mutate(undefined, { onSuccess: () => { showToast("Analysis running…"); setTimeout(() => refetch(), 4000); } })}
            >
              {trigger.isPending ? "Running…" : "Re-run analysis"}
            </button>
          </div>
        )}

        <div className="footer-row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        {toast && <div className="ba-toast">{toast}</div>}
      </div>
    </div>
  );
}
