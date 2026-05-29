import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useBrain, useCreateRun, useReviewRun, useRun, useRuns } from "../api/hooks";
import Icon from "../components/Icon";
import type { RunListItem, RunOut } from "../types";

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

// ── Decision output ────────────────────────────────────────────────────────────
function DecisionPanel({
  run,
  onReview,
}: {
  run: RunOut;
  onReview: (verdict: "approved" | "corrected" | "rejected") => void;
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

  if (run.status === "pending") {
    return (
      <div className="run-pending">
        <svg className="spin" width={20} height={20} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" strokeDasharray="20" strokeDashoffset="5" />
        </svg>
        <span>Running… this usually takes 5–20 seconds</span>
      </div>
    );
  }

  if (run.status === "failed") {
    return (
      <div className="run-error">
        <strong>Run failed.</strong> {run.error_text ?? "Unknown error."}
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
            {r.status === "pending" && <span className="pill info" style={{ fontSize: 10 }}>Running</span>}
            {r.status === "failed" && <span className="pill bad" style={{ fontSize: 10 }}>Failed</span>}
            <VerdictBadge verdict={r.verdict} />
            {r.cost_usd > 0 && (
              <span className="dim" style={{ fontSize: 11 }}>${r.cost_usd.toFixed(4)}</span>
            )}
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

  const [caseText, setCaseText] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [runError, setRunError] = useState("");

  const { data: activeRun } = useRun(slug!, activeRunId);

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
          {activeRun && (
            <DecisionPanel run={activeRun} onReview={handleReview} />
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
