import { useState } from "react";
import Icon from "./Icon";
import type { SemanticReviewOut } from "../types";

interface Props {
  slug: string;
  onClose: () => void;
  onRun: () => void;
  isPending: boolean;
  result: SemanticReviewOut | null;
  error: string;
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <div className="sr-section">
      <button className="sr-section-head" onClick={() => setOpen(!open)}>
        <span style={{ color }}>{title}</span>
        <span className="sr-count">{items.length}</span>
        <span className="sr-chevron">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="sr-list">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SemanticReviewDrawer({ onClose, onRun, isPending, result, error }: Props) {
  return (
    <div className="vd-scrim">
      <div className="vd-backdrop" onClick={onClose} />
      <aside className="vd-panel">
        <div className="vd-header">
          <h2>AI Review</h2>
          <button className="vd-close" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {!result && !isPending && (
          <div className="sr-empty">
            <p>Run an AI review to get a deep analysis of your brain's content — what's solid, what's missing, and what to improve.</p>
            <button className="btn btn-primary" onClick={onRun} disabled={isPending}>
              <Icon name="spark" size={13} /> Run AI Review
            </button>
            {error && <div className="ba-draft-error" style={{ marginTop: 12 }}>{error}</div>}
          </div>
        )}

        {isPending && (
          <div className="sr-loading">
            <svg className="spin" width={20} height={20} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" strokeDasharray="20" strokeDashoffset="5" />
            </svg>
            <span>Reviewing your brain…</span>
          </div>
        )}

        {result && !isPending && (
          <>
            <div className="vd-score">
              <span className="big">{result.score}</span>
              <span className="small">/ 100</span>
            </div>

            <div className="sr-summary">{result.summary}</div>

            <Section title="Strengths" items={result.strengths} color="var(--accent)" />
            <Section title="Gaps" items={result.gaps} color="var(--warn, #e07b2a)" />
            <Section title="Contradictions" items={result.contradictions} color="var(--danger, #d94f4f)" />
            <Section title="Suggestions" items={result.suggestions} color="var(--dim)" />

            <div style={{ padding: "16px 20px" }}>
              <button className="btn" onClick={onRun} disabled={isPending}>
                <Icon name="spark" size={13} /> Re-run review
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
