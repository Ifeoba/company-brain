import { Link, useParams } from "react-router-dom";
import { useBrain, useBrainActivity } from "../api/hooks";
import type { DailyBrainStatsOut } from "../types";

function ActivityChart({ days }: { days: DailyBrainStatsOut[] }) {
  const W = 640;
  const H = 120;
  const pad = { left: 32, right: 8, top: 8, bottom: 28 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const n = days.length;
  const barW = Math.floor(innerW / n) - 1;

  const max = Math.max(...days.map((d) => d.runs_total), 1);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {/* Y gridlines */}
      {[0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + innerH * (1 - frac);
        return (
          <line key={frac} x1={pad.left} x2={W - pad.right} y1={y} y2={y}
            stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
        );
      })}

      {/* Stacked bars */}
      {days.map((day, i) => {
        const x = pad.left + i * (barW + 1);
        const total = day.runs_total || 0;
        const autoH = total > 0 ? Math.round((day.runs_auto_completed / max) * innerH) : 0;
        const escalH = total > 0 ? Math.round((day.runs_escalated / max) * innerH) : 0;
        const failH = total > 0 ? Math.round((day.runs_failed / max) * innerH) : 0;
        const baseY = pad.top + innerH;

        return (
          <g key={day.date}>
            <rect x={x} y={baseY - autoH} width={barW} height={autoH}
              fill="var(--ok)" rx={1} opacity={0.85} />
            <rect x={x} y={baseY - autoH - escalH} width={barW} height={escalH}
              fill="var(--warn)" rx={1} opacity={0.85} />
            <rect x={x} y={baseY - autoH - escalH - failH} width={barW} height={failH}
              fill="var(--bad)" rx={1} opacity={0.85} />
            {total === 0 && (
              <rect x={x} y={baseY - 2} width={barW} height={2}
                fill="var(--border)" rx={1} />
            )}
          </g>
        );
      })}

      {/* X axis date labels — show every 5th day */}
      {days.map((day, i) => {
        if (i % 5 !== 0 && i !== days.length - 1) return null;
        const x = pad.left + i * (barW + 1) + barW / 2;
        const label = day.date.slice(5); // MM-DD
        return (
          <text key={day.date} x={x} y={H - 4} textAnchor="middle"
            fontSize={9} fill="var(--dimmer)">{label}</text>
        );
      })}
    </svg>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="act-tile">
      <div className="act-tile-val">{value}</div>
      <div className="act-tile-label dim">{label}</div>
      {sub && <div className="act-tile-sub dim">{sub}</div>}
    </div>
  );
}

export default function ActivityPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: brain } = useBrain(slug!);
  const { data, isLoading } = useBrainActivity(slug!);

  const days = data?.days ?? [];
  const totalRuns = days.reduce((s, d) => s + d.runs_total, 0);
  const totalCompleted = days.reduce((s, d) => s + d.runs_auto_completed, 0);
  const totalEscalated = days.reduce((s, d) => s + d.runs_escalated, 0);
  const totalFailed = days.reduce((s, d) => s + d.runs_failed, 0);
  const totalCostCents = days.reduce((s, d) => s + d.cost_cents, 0);
  const activeDays = days.filter((d) => d.runs_total > 0).length;

  return (
    <div className="act-page">
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
          <span>Activity</span>
        </div>
        <div className="spacer" />
      </div>

      <div className="act-content">
        <div className="act-header">
          <h2>Activity — last 30 days</h2>
          <Link to={`/brains/${slug}/run`} className="btn btn-sm btn-ghost">
            Run now →
          </Link>
        </div>

        {/* Legend */}
        <div className="act-legend">
          <span className="act-legend-dot" style={{ background: "var(--ok)" }} />
          <span className="dim" style={{ fontSize: 12 }}>Auto-completed</span>
          <span className="act-legend-dot" style={{ background: "var(--warn)" }} />
          <span className="dim" style={{ fontSize: 12 }}>Escalated</span>
          <span className="act-legend-dot" style={{ background: "var(--bad)" }} />
          <span className="dim" style={{ fontSize: 12 }}>Failed</span>
        </div>

        {/* Chart */}
        <div className="act-chart-wrap">
          {isLoading ? (
            <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="dim">Loading…</span>
            </div>
          ) : totalRuns === 0 ? (
            <div className="act-empty dim">No runs in the last 30 days.</div>
          ) : (
            <ActivityChart days={days} />
          )}
        </div>

        {/* Stats */}
        {!isLoading && (
          <div className="act-tiles">
            <StatTile label="Total runs" value={totalRuns} />
            <StatTile label="Auto-completed" value={totalCompleted}
              sub={totalRuns > 0 ? `${Math.round((totalCompleted / totalRuns) * 100)}%` : undefined} />
            <StatTile label="Escalated" value={totalEscalated} />
            <StatTile label="Failed" value={totalFailed} />
            <StatTile label="Total cost" value={`$${(totalCostCents / 100).toFixed(4)}`} />
            <StatTile label="Active days" value={activeDays} sub="of 30" />
          </div>
        )}
      </div>
    </div>
  );
}
