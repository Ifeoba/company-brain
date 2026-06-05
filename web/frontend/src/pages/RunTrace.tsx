import { Link, useParams } from "react-router-dom";
import { useBrain, useRunTrace } from "../api/hooks";
import type { RunStepOut } from "../types";

const KIND_CONFIG: Record<string, { label: string; symbol: string; cls: string }> = {
  thinking:            { label: "Thinking",            symbol: "◯", cls: "step-thinking" },
  tool_call:           { label: "Tool call",           symbol: "⚡", cls: "step-tool-call" },
  approval_requested:  { label: "Approval requested",  symbol: "⏸", cls: "step-approval-requested" },
  approval_granted:    { label: "Approval granted",    symbol: "✓", cls: "step-approval-granted" },
  tool_executed:       { label: "Tool executed",       symbol: "✓", cls: "step-tool-executed" },
  tool_failed:         { label: "Tool failed",         symbol: "✕", cls: "step-tool-failed" },
  guardrail_blocked:   { label: "Guardrail triggered", symbol: "⛉", cls: "step-guardrail-blocked" },
  final_decision:      { label: "Final decision",      symbol: "▶", cls: "step-final-decision" },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  queued: "Queued",
  running: "Running…",
  awaiting_approval: "Needs approval",
  completed: "Completed",
  failed: "Failed",
};

function StepCard({ step }: { step: RunStepOut }) {
  const config = KIND_CONFIG[step.kind] ?? { label: step.kind, symbol: "●", cls: "step-unknown" };
  const meta = step.metadata as Record<string, string>;
  const toolName = meta?.tool_name;
  const verdict = meta?.verdict;

  const displayContent = step.content
    ? step.content.length > 800
      ? step.content.slice(0, 800) + "…"
      : step.content
    : null;

  return (
    <li className={`trace-step ${config.cls}`}>
      <div className="trace-step-spine">
        <span className="trace-step-icon">{config.symbol}</span>
        <div className="trace-step-line" />
      </div>
      <div className="trace-step-body">
        <div className="trace-step-header">
          <strong className="trace-step-label">{config.label}</strong>
          {toolName && <span className="trace-tool-badge">{toolName}</span>}
          {verdict && (
            <span className={`trace-verdict-badge trace-verdict-${verdict}`}>{verdict}</span>
          )}
          {step.occurred_at && (
            <span className="trace-step-time dim">
              {new Date(step.occurred_at).toLocaleTimeString()}
            </span>
          )}
        </div>
        {displayContent && (
          <pre className="trace-step-content">{displayContent}</pre>
        )}
      </div>
    </li>
  );
}

export default function RunTrace() {
  const { slug, run_id } = useParams<{ slug: string; run_id: string }>();
  const { data: brain } = useBrain(slug!);
  const { data, isLoading, isError } = useRunTrace(slug!, run_id ?? null);

  if (isLoading) {
    return (
      <div className="trace-page">
        <div className="ba-topbar">
          <span className="wordmark">
            <img src="/logo.png" className="brand-mark" alt="" />
            Company Brain
          </span>
        </div>
        <div style={{ padding: "2rem", color: "var(--dimmer)" }}>Loading trace…</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="trace-page">
        <div className="ba-topbar">
          <span className="wordmark">
            <img src="/logo.png" className="brand-mark" alt="" />
            Company Brain
          </span>
        </div>
        <div style={{ padding: "2rem", color: "var(--bad)" }}>Run not found.</div>
      </div>
    );
  }

  const { run, steps } = data;

  const statusCls =
    run.status === "completed" ? "ok" :
    run.status === "failed" ? "bad" :
    run.status === "awaiting_approval" ? "warn" : "info";

  const costLabel = run.cost_usd > 0
    ? `$${run.cost_usd.toFixed(4)}`
    : run.tokens_in > 0 ? `~${run.tokens_in + run.tokens_out} tokens` : null;

  return (
    <div className="trace-page">
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
          <Link to={`/brains/${slug}/run`}>Runs</Link>
          <span className="sep">›</span>
          <span>Trace</span>
        </div>
        <div className="spacer" />
      </div>

      <div className="trace-content">
        {/* Run summary header */}
        <div className="trace-run-header">
          <div className="trace-run-meta">
            <span className={`pill ${statusCls}`} style={{ fontSize: 11 }}>
              <span className="dot" style={{ background: "currentColor" }} />
              {STATUS_LABELS[run.status] ?? run.status}
            </span>
            {run.model_used && (
              <span className="dim" style={{ fontSize: 11.5 }}>{run.model_used}</span>
            )}
            {costLabel && (
              <span className="dim" style={{ fontSize: 11.5 }}>{costLabel}</span>
            )}
            <span className="dim" style={{ fontSize: 11 }}>
              {new Date(run.created_at).toLocaleString()}
            </span>
          </div>
          <div className="trace-run-case">
            <span className="trace-case-label dim">Case</span>
            <p className="trace-case-text">
              {run.case_text.length > 300
                ? run.case_text.slice(0, 300) + "…"
                : run.case_text}
            </p>
          </div>
        </div>

        {/* Step count */}
        <div className="trace-step-count dim">
          {steps.length === 0
            ? "No trace steps recorded — run this case again to see the trace."
            : `${steps.length} step${steps.length !== 1 ? "s" : ""}`}
        </div>

        {/* Timeline */}
        {steps.length > 0 && (
          <ol className="trace-timeline">
            {steps.map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
