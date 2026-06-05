import { Link, useParams } from "react-router-dom";
import { useBrain, useBrainAnalytics, useBrainRelationships, useBrains } from "../api/hooks";
import type { BrainAnalyticsOut, HeatmapDay, RuleCount, RunTimelineItem } from "../types";

// ── Run timeline ──────────────────────────────────────────────────────────────

function colorForRun(r: RunTimelineItem): string {
  if (r.status === "failed") return "var(--bad)";
  if (r.status === "awaiting_approval") return "var(--warn)";
  if (r.status === "completed" && r.verdict === "rejected") return "var(--bad)";
  if (r.status === "completed" && r.verdict === "corrected") return "var(--warn)";
  if (r.status === "completed") return "var(--ok)";
  return "var(--dimmer)";
}

function RunTimeline({ timeline }: { timeline: RunTimelineItem[] }) {
  const W = 680;
  const H = 68;
  const padX = 36;
  const padY = 14;
  const innerW = W - padX * 2;
  const now = Date.now();
  const span = 14 * 24 * 60 * 60 * 1000;
  const start = now - span;

  const dayLabels: { x: number; label: string }[] = [];
  for (let i = 0; i <= 14; i += 2) {
    const t = new Date(start + (i / 14) * span);
    dayLabels.push({
      x: padX + (i / 14) * innerW,
      label: `${t.getMonth() + 1}/${t.getDate()}`,
    });
  }

  if (timeline.length === 0) {
    return <div className="an-empty">No runs in the last 14 days.</div>;
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {/* Axis */}
      <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY}
        stroke="var(--border)" strokeWidth={1.5} />
      {dayLabels.map((l, i) => (
        <g key={i}>
          <line x1={l.x} y1={H - padY - 3} x2={l.x} y2={H - padY + 2}
            stroke="var(--border)" strokeWidth={1} />
          <text x={l.x} y={H - 1} textAnchor="middle" fontSize={8} fill="var(--dimmer)">
            {l.label}
          </text>
        </g>
      ))}
      {/* Run dots */}
      {timeline.map((r) => {
        const t = new Date(r.created_at).getTime();
        const x = padX + ((t - start) / span) * innerW;
        if (x < padX - 4 || x > W - padX + 4) return null;
        const tooltip = `${r.status}${r.verdict ? ` · ${r.verdict}` : ""} · $${r.cost_usd.toFixed(4)}`;
        return (
          <circle key={r.id} cx={x} cy={H - padY - 14} r={4.5}
            fill={colorForRun(r)} opacity={0.88} stroke="var(--panel)" strokeWidth={0.8}>
            <title>{tooltip}</title>
          </circle>
        );
      })}
      {/* Legend */}
      {[
        { color: "var(--ok)", label: "Completed" },
        { color: "var(--warn)", label: "Escalated" },
        { color: "var(--bad)", label: "Failed" },
      ].map(({ color, label }, i) => (
        <g key={i} transform={`translate(${padX + i * 90}, 6)`}>
          <circle cx={5} cy={5} r={4} fill={color} />
          <text x={12} y={9} fontSize={8} fill="var(--dimmer)">{label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Activity heatmap ──────────────────────────────────────────────────────────

function ActivityHeatmap({ heatmap }: { heatmap: HeatmapDay[] }) {
  const CELL = 11;
  const GAP = 2;
  const COLS = 12;
  const ROWS = 7;
  const padL = 18;
  const padT = 14;
  const W = padL + COLS * (CELL + GAP);
  const H = padT + ROWS * (CELL + GAP) + 14;
  const max = Math.max(...heatmap.map((h) => h.count), 1);

  const fill = (count: number) =>
    count === 0
      ? "var(--border)"
      : `color-mix(in srgb, var(--accent) ${Math.max(15, Math.round((count / max) * 100))}%, var(--bg-2))`;

  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const weekLabels: { col: number; label: string }[] = [];
  for (let w = 0; w < COLS; w += 4) {
    const idx = w * 7;
    if (idx < heatmap.length) {
      weekLabels.push({ col: w, label: heatmap[idx].date.slice(5) });
    }
  }

  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      {DAY_LABELS.map((d, i) => (
        <text key={i} x={padL - 3} y={padT + i * (CELL + GAP) + CELL - 1}
          textAnchor="end" fontSize={7} fill="var(--dimmer)">{d}</text>
      ))}
      {heatmap.map((h, i) => {
        const col = Math.floor(i / 7);
        const row = i % 7;
        return (
          <rect key={h.date}
            x={padL + col * (CELL + GAP)} y={padT + row * (CELL + GAP)}
            width={CELL} height={CELL} fill={fill(h.count)} rx={2}>
            <title>{`${h.date}: ${h.count} run${h.count !== 1 ? "s" : ""}`}</title>
          </rect>
        );
      })}
      {weekLabels.map(({ col, label }) => (
        <text key={col} x={padL + col * (CELL + GAP)} y={H - 1}
          fontSize={7} fill="var(--dimmer)">{label}</text>
      ))}
    </svg>
  );
}

// ── Outcome bars ──────────────────────────────────────────────────────────────

function OutcomeBars({ counts, total }: { counts: BrainAnalyticsOut["outcome_counts"]; total: number }) {
  const items = [
    { label: "Completed", value: counts.completed, color: "var(--ok)" },
    { label: "Awaiting approval", value: counts.awaiting_approval, color: "var(--warn)" },
    { label: "Failed", value: counts.failed, color: "var(--bad)" },
    { label: "In progress", value: counts.running, color: "var(--dimmer)" },
  ].filter((i) => i.value > 0);

  if (items.length === 0) return <div className="an-empty">No completed runs yet.</div>;
  const max = Math.max(...items.map((i) => i.value));

  return (
    <div className="an-bar-list">
      {items.map((item) => (
        <div key={item.label} className="an-bar-row">
          <div className="an-bar-label">{item.label}</div>
          <div className="an-bar-track">
            <div className="an-bar-fill"
              style={{ width: `${(item.value / max) * 100}%`, background: item.color }} />
          </div>
          <div className="an-bar-count">{item.value}</div>
          <div className="an-bar-pct dim">
            {total > 0 ? `${Math.round((item.value / total) * 100)}%` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Rules chart ───────────────────────────────────────────────────────────────

function RulesChart({ rules }: { rules: RuleCount[] }) {
  if (rules.length === 0) {
    return <div className="an-empty">No rules cited in recent runs.</div>;
  }
  const max = Math.max(...rules.map((r) => r.count));
  return (
    <div className="an-rules-list">
      {rules.map((r, i) => (
        <div key={i} className="an-rules-row">
          <div className="an-rules-label" title={r.rule}>{r.rule}</div>
          <div className="an-rules-track">
            <div className="an-rules-fill"
              style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <div className="an-rules-count dim">{r.count}</div>
        </div>
      ))}
    </div>
  );
}

// ── Brain flow diagram ────────────────────────────────────────────────────────

function FlowDiagram({ slug, brainName }: { slug: string; brainName: string }) {
  const { data: rels = [] } = useBrainRelationships(slug);
  const { data: allBrains = [] } = useBrains();

  const W = 380;
  const H = 260;
  const CX = W / 2;
  const CY = H / 2;
  const ORBIT = 90;

  const connected = rels.map((rel) => ({
    slug: rel.from_slug === slug ? rel.to_slug : rel.from_slug,
    name: rel.from_slug === slug ? rel.to_name : rel.from_name,
    rel_type: rel.rel_type,
    outgoing: rel.from_slug === slug,
  }));

  const uniqSlugs = [...new Set(connected.map((c) => c.slug))];

  if (uniqSlugs.length === 0) {
    return (
      <div className="an-flow-empty">
        <div className="an-empty">
          No relationships yet.{" "}
          <Link to={`/brains/${slug}`} style={{ color: "var(--accent)" }}>
            Add from the brain's detail page.
          </Link>
        </div>
      </div>
    );
  }

  const step = (2 * Math.PI) / uniqSlugs.length;
  const nodePos: Record<string, { x: number; y: number; name: string }> = {};
  uniqSlugs.forEach((s, i) => {
    const angle = i * step - Math.PI / 2;
    const brain = allBrains.find((b) => b.slug === s);
    nodePos[s] = {
      x: CX + ORBIT * Math.cos(angle),
      y: CY + ORBIT * Math.sin(angle),
      name: brain?.name ?? s,
    };
  });

  const REL_COLOR: Record<string, string> = {
    "depends-on": "#3b82f6",
    "feeds-into": "#8b5cf6",
    "uses": "#10b981",
    "related-to": "#9ca3af",
  };

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {/* Edges */}
      {rels.map((rel, i) => {
        const fromPos = rel.from_slug === slug ? { x: CX, y: CY } : nodePos[rel.from_slug];
        const toPos = rel.to_slug === slug ? { x: CX, y: CY } : nodePos[rel.to_slug];
        if (!fromPos || !toPos) return null;
        const color = REL_COLOR[rel.rel_type] ?? "#9ca3af";
        const mx = (fromPos.x + toPos.x) / 2;
        const my = (fromPos.y + toPos.y) / 2 - 10;
        return (
          <g key={i}>
            <line x1={fromPos.x} y1={fromPos.y} x2={toPos.x} y2={toPos.y}
              stroke={color} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.55} />
            <text x={mx} y={my} textAnchor="middle" fontSize={8} fill={color} opacity={0.9}>
              {rel.rel_type}
            </text>
          </g>
        );
      })}
      {/* Satellite nodes */}
      {Object.entries(nodePos).map(([s, pos]) => (
        <g key={s}>
          <circle cx={pos.x} cy={pos.y} r={24}
            fill="var(--panel)" stroke="var(--border)" strokeWidth={1.5} />
          <text x={pos.x} y={pos.y + 3} textAnchor="middle" fontSize={8}
            fill="var(--text-2)" fontWeight={500}>
            {pos.name.length > 11 ? pos.name.slice(0, 10) + "…" : pos.name}
          </text>
        </g>
      ))}
      {/* This brain — center */}
      <circle cx={CX} cy={CY} r={30}
        fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth={2} />
      <text x={CX} y={CY + 4} textAnchor="middle" fontSize={9}
        fill="var(--accent-strong)" fontWeight={600}>
        {brainName.length > 13 ? brainName.slice(0, 12) + "…" : brainName}
      </text>
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: brain } = useBrain(slug!);
  const { data: analytics, isLoading } = useBrainAnalytics(slug!);

  const total = analytics
    ? analytics.outcome_counts.completed +
      analytics.outcome_counts.failed +
      analytics.outcome_counts.awaiting_approval +
      analytics.outcome_counts.running
    : 0;

  return (
    <div className="an-page">
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
          <span>Analytics</span>
        </div>
        <div className="spacer" />
        <Link to={`/brains/${slug}/activity`} className="btn btn-sm btn-ghost">Activity</Link>
        <Link to={`/brains/${slug}/run`} className="btn btn-sm btn-ghost">Run →</Link>
      </div>

      <div className="an-content">
        {isLoading && (
          <div style={{ padding: "2rem", color: "var(--dimmer)" }}>Loading analytics…</div>
        )}
        {!isLoading && analytics && (
          <>
            {/* Run timeline — full width */}
            <div className="an-panel an-full">
              <div className="an-panel-head">
                <strong>Run timeline</strong>
                <span className="dim" style={{ fontSize: 12 }}>
                  Last 14 days · {analytics.timeline.length} run{analytics.timeline.length !== 1 ? "s" : ""}
                </span>
              </div>
              <RunTimeline timeline={analytics.timeline} />
            </div>

            {/* Heatmap — full width */}
            <div className="an-panel an-full">
              <div className="an-panel-head">
                <strong>Activity heatmap</strong>
                <span className="dim" style={{ fontSize: 12 }}>12 weeks</span>
              </div>
              <div className="an-heatmap-wrap">
                <ActivityHeatmap heatmap={analytics.heatmap} />
                <div className="an-heatmap-legend">
                  <span className="dim" style={{ fontSize: 10 }}>Less</span>
                  {[0, 0.2, 0.5, 0.8, 1].map((v) => (
                    <div key={v} className="an-legend-cell" style={{
                      background: v === 0 ? "var(--border)"
                        : `color-mix(in srgb, var(--accent) ${Math.round(v * 100)}%, var(--bg-2))`,
                    }} />
                  ))}
                  <span className="dim" style={{ fontSize: 10 }}>More</span>
                </div>
              </div>
            </div>

            {/* Outcomes + Rules — side by side */}
            <div className="an-row2">
              <div className="an-panel">
                <div className="an-panel-head">
                  <strong>Run outcomes</strong>
                  <span className="dim" style={{ fontSize: 12 }}>
                    {analytics.total_analyzed} analyzed
                  </span>
                </div>
                <OutcomeBars counts={analytics.outcome_counts} total={total} />
              </div>

              <div className="an-panel">
                <div className="an-panel-head">
                  <strong>Top cited rules</strong>
                  <span className="dim" style={{ fontSize: 12 }}>
                    Last {analytics.total_analyzed} runs
                  </span>
                </div>
                <RulesChart rules={analytics.top_rules} />
              </div>
            </div>

            {/* Brain flow diagram */}
            <div className="an-panel">
              <div className="an-panel-head">
                <strong>Brain relationships</strong>
                <Link to="/map" className="dim" style={{ fontSize: 12, textDecoration: "none" }}>
                  Map view →
                </Link>
              </div>
              <FlowDiagram slug={slug!} brainName={brain?.name ?? slug!} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
