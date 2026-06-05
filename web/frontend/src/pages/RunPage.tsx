import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useApproveToolCall, useBrain, useBrainStats, useCreateRun, useDenyToolCall, useRetryRun, useReviewRun, useRun, useRunEvents, useRunToolCalls, useRuns } from "../api/hooks";
import Icon from "../components/Icon";
import type { RunListItem, RunOut, ToolCallOut } from "../types";

// ── Markdown renderer (minimal, no dependency) ────────────────────────────────
function renderMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}

// ── Verdict badge ─────────────────────────────────────────────────────────────
function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return null;
  const map: Record<string, { cls: string; label: string }> = {
    approved: { cls: "ok", label: "Approved" },
    corrected: { cls: "warn", label: "Corrected" },
    rejected: { cls: "bad", label: "Rejected" },
  };
  const { cls, label } = map[verdict] ?? { cls: "info", label: verdict };
  return (
    <span className={`pill ${cls}`} style={{ fontSize: 11 }}>
      <span className="dot" style={{ background: "currentColor" }} />
      {label}
    </span>
  );
}

// ── Correction modal ──────────────────────────────────────────────────────────
function CorrectionModal({
  run,
  onClose,
  onSubmit,
  isPending,
}: {
  run: RunOut;
  onClose: () => void;
  onSubmit: (corrected: string, notes: string) => void;
  isPending: boolean;
}) {
  const [corrected, setCorrected] = useState(run.decision_text ?? "");
  const [notes, setNotes] = useState("");

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2>What should the correct decision have been?</h2>
        <div className="modal-sub">
          Edit the response below to show the right answer. Your correction will be saved as a test case for this brain.
        </div>
        <div className="modal-row">
          <span className="label">Correct decision</span>
          <textarea
            className="textarea"
            style={{ minHeight: 160, fontFamily: "var(--font-mono)", fontSize: 12 }}
            value={corrected}
            onChange={(e) => setCorrected(e.target.value)}
          />
        </div>
        <div className="modal-row">
          <span className="label">Why was the original wrong? (optional)</span>
          <textarea
            className="textarea"
            style={{ minHeight: 60 }}
            placeholder="e.g. The rule about large transactions wasn't applied correctly"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="footer-row">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!corrected.trim() || isPending}
            onClick={() => onSubmit(corrected, notes)}
          >
            {isPending ? "Saving…" : "Save correction"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tool call approval panel ───────────────────────────────────────────────────
function ArgList({ args }: { args: Record<string, unknown> }) {
  const entries = Object.entries(args);
  if (entries.length === 0) return null;
  return (
    <div className="tc-args">
      {entries.map(([k, v]) => (
        <div key={k} className="tc-arg-row">
          <span className="tc-arg-key">{k}</span>
          <span className="tc-arg-val">{typeof v === "string" ? v : JSON.stringify(v)}</span>
        </div>
      ))}
    </div>
  );
}

function ApprovalPanel({ slug, run }: { slug: string; run: RunOut }) {
  const { data: toolCalls = [], isLoading } = useRunToolCalls(slug, run.id);
  const approve = useApproveToolCall(slug);
  const deny = useDenyToolCall(slug);

  if (isLoading) return null;

  const hasPending = toolCalls.some((tc) => tc.status === "pending_approval");

  return (
    <div className="approval-panel">
      <div className="approval-head">
        <strong>Approval needed</strong>
        <p className="dim" style={{ fontSize: 13, margin: "4px 0 0" }}>
          This brain wants to take the following actions. Review each one and approve or deny — it will continue once you've decided.
        </p>
      </div>
      <div className="tc-list">
        {toolCalls.map((tc: ToolCallOut) => (
          <div key={tc.id} className={`tc-card tc-${tc.status}`}>
            <div className="tc-header">
              <span className="tc-name">{tc.tool_name}</span>
              {tc.status !== "pending_approval" && (
                <span
                  className={`pill ${tc.status === "executed" || tc.status === "approved" ? "ok" : "bad"}`}
                  style={{ fontSize: 10 }}
                >
                  {tc.status === "executed" ? "Done" : tc.status === "approved" ? "Approved" : "Denied"}
                </span>
              )}
            </div>
            {tc.tool_description && (
              <div className="tc-desc dim">{tc.tool_description}</div>
            )}
            <ArgList args={tc.arguments} />
            {tc.status === "pending_approval" && (
              <div className="tc-actions">
                <button
                  className="btn btn-sm"
                  style={{ color: "var(--bad)" }}
                  disabled={deny.isPending}
                  onClick={() => deny.mutate({ runId: run.id, tcId: tc.id })}
                >
                  Deny
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={approve.isPending}
                  onClick={() => approve.mutate({ runId: run.id, tcId: tc.id })}
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!hasPending && toolCalls.length > 0 && (
        <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>
          All actions decided — finishing the run…
        </p>
      )}
    </div>
  );
}

// ── Decision output ────────────────────────────────────────────────────────────
function DecisionPanel({
  run,
  onReview,
  onRetry,
}: {
  run: RunOut;
  onReview: (verdict: "approved" | "corrected" | "rejected") => void;
  onRetry?: () => void;
}) {
  const [showCorrection, setShowCorrection] = useState(false);
  const [notes, setNotes] = useState("");
  const reviewMutation = useReviewRun();

  async function submitReview(verdict: "approved" | "corrected" | "rejected", corrected?: string, reviewNotes?: string) {
    await reviewMutation.mutateAsync({
      runId: run.id,
      verdict,
      notes: reviewNotes ?? notes,
      corrected_decision: corrected,
    });
    onReview(verdict);
  }

  if (run.status === "pending" || run.status === "queued" || run.status === "running") {
    return (
      <div className="run-pending">
        <svg className="spin" width={20} height={20} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" strokeDasharray="20" strokeDashoffset="5" />
        </svg>
        <span>Running… this usually takes 5–20 seconds</span>
      </div>
    );
  }

  if (run.status === "awaiting_approval") {
    return null;
  }

  if (run.status === "failed") {
    return (
      <div className="run-error">
        <div><strong>Run failed.</strong> {run.error_text ?? "Unknown error."}</div>
        {onRetry && (
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  const costLabel = run.cost_usd > 0
    ? `$${run.cost_usd.toFixed(4)}`
    : run.tokens_in > 0 ? `~${run.tokens_in + run.tokens_out} tokens` : "";

  return (
    <div className="run-output">
      <div className="run-output-meta">
        <span className="dim" style={{ fontSize: 11.5 }}>
          {run.model_used}
          {costLabel && ` · ${costLabel}`}
        </span>
      </div>

      <div
        className="run-decision"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(run.decision_text ?? "") }}
      />

      {run.cited_rules.length > 0 && (
        <div className="run-chips">
          <span className="run-chips-label">Rules applied:</span>
          {run.cited_rules.map((rule, i) => (
            <span key={i} className="run-chip" title={rule}>
              {rule.length > 60 ? rule.slice(0, 57) + "…" : rule}
            </span>
          ))}
        </div>
      )}

      {run.review ? (
        <div className="run-reviewed">
          <VerdictBadge verdict={run.review.verdict} />
          {run.review.notes && <span className="dim" style={{ fontSize: 12.5, marginLeft: 8 }}>{run.review.notes}</span>}
        </div>
      ) : (
        <div className="run-review-bar">
          <span className="dim" style={{ fontSize: 12.5 }}>Was this decision correct?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-sm"
              style={{ color: "var(--ok)" }}
              disabled={reviewMutation.isPending}
              onClick={() => submitReview("approved")}
            >
              <Icon name="check" size={12} /> Approve
            </button>
            <button
              className="btn btn-sm"
              style={{ color: "var(--warn)" }}
              disabled={reviewMutation.isPending}
              onClick={() => setShowCorrection(true)}
            >
              <Icon name="edit" size={12} /> Correct
            </button>
            <button
              className="btn btn-sm"
              style={{ color: "var(--bad)" }}
              disabled={reviewMutation.isPending}
              onClick={() => submitReview("rejected")}
            >
              <Icon name="x" size={12} /> Reject
            </button>
          </div>
          <input
            className="input"
            style={{ fontSize: 12, flex: 1, maxWidth: 260 }}
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      )}

      {showCorrection && (
        <CorrectionModal
          run={run}
          onClose={() => setShowCorrection(false)}
          onSubmit={(corrected, reviewNotes) => {
            setShowCorrection(false);
            submitReview("corrected", corrected, reviewNotes);
          }}
          isPending={reviewMutation.isPending}
        />
      )}
    </div>
  );
}

// ── History list ──────────────────────────────────────────────────────────────
function RunHistory({ slug, onSelect, selectedId }: { slug: string; onSelect: (id: string) => void; selectedId: string | null }) {
  const { data: runs = [] } = useRuns(slug);
  if (runs.length === 0) return null;

  return (
    <div className="run-history">
      <div className="run-history-head">Past runs</div>
      {runs.map((r: RunListItem) => (
        <div
          key={r.id}
          className={`run-history-item${r.id === selectedId ? " active" : ""}`}
          onClick={() => onSelect(r.id)}
        >
          <div className="run-history-case">
            {(r.case_filename ?? r.case_text).slice(0, 80)}
            {(r.case_filename ?? r.case_text).length > 80 ? "…" : ""}
          </div>
          <div className="run-history-meta">
            <span className="dim" style={{ fontSize: 11 }}>
              {new Date(r.created_at).toLocaleString()}
            </span>
            {(r.status === "pending" || r.status === "queued" || r.status === "running") && <span className="pill info" style={{ fontSize: 10 }}>Running…</span>}
            {r.status === "awaiting_approval" && <span className="pill warn" style={{ fontSize: 10 }}>Needs approval</span>}
            {r.status === "failed" && <span className="pill bad" style={{ fontSize: 10 }}>Failed</span>}
            <VerdictBadge verdict={r.verdict} />
            {r.cost_usd > 0 && (
              <span className="dim" style={{ fontSize: 11 }}>${r.cost_usd.toFixed(4)}</span>
            )}
            <Link
              to={`/brains/${slug}/runs/${r.id}`}
              className="run-trace-link"
              style={{ fontSize: 11, marginLeft: "auto" }}
              onClick={(e) => e.stopPropagation()}
            >
              Trace →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RunPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: brain } = useBrain(slug!);
  const createRun = useCreateRun(slug!);
  const retryRun = useRetryRun(slug!);
  const { data: stats } = useBrainStats(slug!);
  const qc = useQueryClient();

  const [caseText, setCaseText] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [runError, setRunError] = useState("");

  const { data: activeRun } = useRun(slug!, activeRunId);

  // SSE: invalidate immediately on run state changes, cutting polling latency to ~0
  useRunEvents((event) => {
    if (
      event.type === "run.completed" ||
      event.type === "run.failed" ||
      event.type === "run.awaiting_approval"
    ) {
      qc.invalidateQueries({ queryKey: ["run", slug, event.run_id as string] });
      qc.invalidateQueries({ queryKey: ["runs", slug] });
      if (event.type === "run.awaiting_approval") {
        qc.invalidateQueries({ queryKey: ["run-tool-calls", slug, event.run_id as string] });
      }
    }
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  async function handleRun() {
    if (!caseText.trim()) return;
    setRunError("");
    try {
      const result = await createRun.mutateAsync({ case_text: caseText });
      setActiveRunId(result.run_id);
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : "Run failed.");
    }
  }

  function handleReview(verdict: "approved" | "corrected" | "rejected") {
    if (verdict === "corrected") {
      showToast("Correction saved as a test case for this brain. Use Sync evals to fold it in.");
    }
  }

  return (
    <div className="run-shell">
      {/* Topbar */}
      <div className="ba-topbar">
        <span className="wordmark">
          <img src="/logo.png" className="brand-mark" alt="" />
          Company Brain
        </span>
        <span style={{ color: "var(--dimmer)" }}>/</span>
        <div className="crumb">
          <Link to="/">Brains</Link>
          <span className="sep">›</span>
          <Link to={`/brains/${slug}`}>{brain?.name ?? slug}</Link>
          <span className="sep">›</span>
          <span>Run</span>
        </div>
        <div className="spacer" />
      </div>

      <div className="run-body">
        {/* Left: input */}
        <div className="run-left">
          <div className="run-left-head">
            <h2>Paste a case</h2>
            <p className="dim" style={{ fontSize: 13, margin: "4px 0 16px" }}>
              Describe one real situation — a transaction, email, request, ticket, anything. The brain will tell you what should happen.
            </p>
          </div>
          <textarea
            className="textarea run-textarea"
            placeholder="Paste your case here…&#10;&#10;e.g. Transaction ID: TXN-9821&#10;Amount: $1,240&#10;Category: NETFLIX SUBSCRIPTION&#10;Confidence: 0.41"
            value={caseText}
            onChange={(e) => setCaseText(e.target.value)}
          />
          {runError && <div className="ba-draft-error">{runError}</div>}
          <button
            className="btn btn-primary run-btn"
            onClick={handleRun}
            disabled={createRun.isPending || !caseText.trim()}
          >
            {createRun.isPending ? (
              <>
                <svg className="spin" width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" strokeDasharray="20" strokeDashoffset="5" />
                </svg>
                Starting…
              </>
            ) : (
              <><Icon name="spark" size={13} /> Run</>
            )}
          </button>
        </div>

        {/* Right: output */}
        <div className="run-right">
          {!activeRun && (
            <div className="run-empty">
              <p>Paste a case and click Run. The brain will apply its decision rules and tell you what should happen — and why.</p>
            </div>
          )}
          {activeRun && activeRun.status === "awaiting_approval" && (
            <ApprovalPanel slug={slug!} run={activeRun} />
          )}
          {activeRun && (
            <DecisionPanel
              run={activeRun}
              onReview={handleReview}
              onRetry={activeRun.status === "failed" ? () => {
                retryRun.mutate(activeRun.id, {
                  onSuccess: (r) => setActiveRunId((r as { run_id: string }).run_id),
                });
              } : undefined}
            />
          )}

          {stats && stats.total_runs > 0 && (
            <div className="run-stats-bar">
              <span className="dim">{stats.total_runs} run{stats.total_runs !== 1 ? "s" : ""}</span>
              <span className="dot-sep" />
              <span className="dim">{stats.completed_runs} completed</span>
              {stats.failed_runs > 0 && (
                <><span className="dot-sep" /><span style={{ color: "var(--bad)", fontSize: 11.5 }}>{stats.failed_runs} failed</span></>
              )}
              {stats.total_cost_usd > 0 && (
                <><span className="dot-sep" /><span className="dim">${stats.total_cost_usd.toFixed(4)} total</span></>
              )}
            </div>
          )}

          <RunHistory
            slug={slug!}
            selectedId={activeRunId}
            onSelect={(id) => setActiveRunId(id)}
          />
        </div>
      </div>

      {toast && <div className="ba-toast">{toast}</div>}
    </div>
  );
}
