import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useWorkspaceInsights,
  useAcceptInsight,
  useDismissInsight,
  useTriggerAllMaintainer,
} from "../api/hooks";
import AppTopbar from "../components/Layout";
import type { InsightSuggestion } from "../types";

const PATTERN_COLORS: Record<string, string> = {
  recurring_escalation: "var(--bad)",
  repeated_corrections: "var(--warn)",
  drifting_eval: "var(--warn)",
  quiet_brain: "var(--dim)",
  silent_corrections: "var(--accent)",
  untouched_brain: "var(--dim)",
};

function SuggestionCard({ s }: { s: InsightSuggestion }) {
  const [expanded, setExpanded] = useState(false);
  const accept = useAcceptInsight();
  const dismiss = useDismissInsight();

  const color = PATTERN_COLORS[s.pattern_type] ?? "var(--dim)";

  return (
    <div className="insight-card">
      <div className="insight-card-head">
        <div style={{ flex: 1 }}>
          <div className="insight-card-brain">
            <Link to={`/brains/${s.brain_slug}`} className="dim" style={{ fontSize: 11.5 }}>
              {s.brain_name}
            </Link>
          </div>
          <div className="insight-card-finding">{s.finding}</div>
        </div>
        <span
          className="pill"
          style={{
            background: `color-mix(in srgb, ${color} 15%, var(--bg-2))`,
            color,
            flexShrink: 0,
          }}
        >
          {s.pattern_type.replace(/_/g, " ")}
        </span>
      </div>

      {s.proposed_diff && (
        <>
          <button
            className="btn btn-sm btn-ghost"
            style={{ marginTop: 6, fontSize: 11.5 }}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide diff ▲" : "Show proposed diff ▼"}
          </button>
          {expanded && (
            <pre className="insight-diff">{s.proposed_diff}</pre>
          )}
        </>
      )}

      <div className="insight-card-actions">
        <span className="dim" style={{ fontSize: 11, marginRight: "auto" }}>
          {new Date(s.created_at).toLocaleDateString()}
          {s.target_file && ` · ${s.target_file}`}
        </span>
        <button
          className="btn btn-sm btn-ghost"
          disabled={dismiss.isPending}
          onClick={() => dismiss.mutate(s.id)}
        >
          Dismiss
        </button>
        <button
          className="btn btn-sm btn-primary"
          disabled={accept.isPending}
          onClick={() => accept.mutate(s.id)}
        >
          {accept.isPending ? "Applying…" : "Accept"}
        </button>
      </div>
    </div>
  );
}

function ActivityItem({ item }: { item: { id: string; action: string; resource_type: string; resource_id: string | null; occurred_at: string | null; actor_id: string | null } }) {
  return (
    <div className="insight-activity-row">
      <span className="dim" style={{ fontSize: 11, width: 110, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
        {item.occurred_at
          ? new Date(item.occurred_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
          : "—"}
      </span>
      <span style={{ fontSize: 12.5 }}>{item.action}</span>
      <span className="dim" style={{ fontSize: 11.5 }}>{item.resource_type}</span>
    </div>
  );
}

export default function InsightsPage() {
  const { data, isLoading } = useWorkspaceInsights();
  const triggerAll = useTriggerAllMaintainer();
  const [showActivity, setShowActivity] = useState(false);

  return (
    <div className="insights-page">
      <AppTopbar />
      <div className="insights-main">
        <div className="inner">
          <div className="insights-head">
            <div>
              <h1>Insights</h1>
              <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>
                Workspace-wide maintainer suggestions and patterns
              </div>
            </div>
            <button
              className="btn btn-ghost btn-lg"
              disabled={triggerAll.isPending}
              onClick={() => triggerAll.mutate()}
            >
              {triggerAll.isPending ? "Queueing…" : "Analyse all brains"}
            </button>
          </div>

          {isLoading ? (
            <div className="dim" style={{ padding: "32px 0" }}>Loading…</div>
          ) : data ? (
            <>
              {/* Summary tiles */}
              <div className="dash-hero" style={{ marginBottom: 24 }}>
                <div className="dash-tile">
                  <div
                    className="dash-tile-val"
                    style={{ color: data.pending_count > 0 ? "var(--warn)" : undefined }}
                  >
                    {data.pending_count}
                  </div>
                  <div className="dash-tile-label dim">Pending suggestions</div>
                </div>
                <div className="dash-tile">
                  <div className="dash-tile-val">{data.brains_with_pending}</div>
                  <div className="dash-tile-label dim">Brains with issues</div>
                </div>
                <div className="dash-tile">
                  <div className="dash-tile-val" style={{ color: "var(--accent)" }}>
                    {data.accepted_this_week}
                  </div>
                  <div className="dash-tile-label dim">Accepted this week</div>
                </div>
                <div className="dash-tile">
                  <div className="dash-tile-val">{data.dismissed_this_week}</div>
                  <div className="dash-tile-label dim">Dismissed this week</div>
                </div>
              </div>

              {/* Pattern breakdown */}
              {data.pattern_summary.length > 0 && (
                <div className="insights-patterns">
                  {data.pattern_summary.map((p) => (
                    <span
                      key={p.pattern_type}
                      className="pill"
                      style={{
                        background: `color-mix(in srgb, ${PATTERN_COLORS[p.pattern_type] ?? "var(--dim)"} 15%, var(--bg-2))`,
                        color: PATTERN_COLORS[p.pattern_type] ?? "var(--dim)",
                      }}
                    >
                      {p.label} · {p.count}
                    </span>
                  ))}
                </div>
              )}

              {/* Suggestions list */}
              {data.suggestions.length === 0 ? (
                <div className="insights-empty dim">
                  No pending suggestions — all brains look healthy.
                </div>
              ) : (
                <div className="insights-list">
                  {data.suggestions.map((s) => (
                    <SuggestionCard key={s.id} s={s} />
                  ))}
                </div>
              )}

              {/* Recent activity */}
              {data.recent_activity.length > 0 && (
                <div className="insights-activity">
                  <button
                    className="insights-activity-toggle"
                    onClick={() => setShowActivity((v) => !v)}
                  >
                    Recent workspace activity {showActivity ? "▲" : "▼"}
                  </button>
                  {showActivity && (
                    <div className="insights-activity-list">
                      {data.recent_activity.map((item) => (
                        <ActivityItem key={item.id} item={item} />
                      ))}
                      <div style={{ marginTop: 8 }}>
                        <Link to="/audit" className="dim" style={{ fontSize: 12 }}>
                          View full audit log →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
