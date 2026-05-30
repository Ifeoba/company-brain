import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBrains, useCreateBrain, useDeleteBrain, useEscalations, useWorkspaceDashboard } from "../api/hooks";
import AppTopbar from "../components/Layout";
import Icon from "../components/Icon";
import MiniSparkline from "../components/MiniSparkline";
import EscalationsModal from "../components/EscalationsModal";
import AuditLogModal from "../components/AuditLogModal";
import type { BrainDashItem, BrainSummary } from "../types";

function NewBrainModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const createBrain = useCreateBrain();
  const navigate = useNavigate();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    try {
      const brain = await createBrain.mutateAsync({ name: name.trim() });
      navigate(`/brains/${brain.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="modal-scrim">
      <div className="modal-card sm">
        <h2>New brain</h2>
        <div className="modal-sub">Give it a name — you can change it later.</div>
        <form onSubmit={handleCreate}>
          <div className="modal-row">
            <span className="label">Name</span>
            <input
              autoFocus
              className="input"
              placeholder="e.g. Billing Support"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="footer-row">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={createBrain.isPending || !name.trim()}
            >
              {createBrain.isPending ? "Creating…" : "Create brain"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteBrainModal({ brain, onClose }: { brain: BrainSummary; onClose: () => void }) {
  const [input, setInput] = useState("");
  const deleteBrain = useDeleteBrain();

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (input !== brain.name) return;
    await deleteBrain.mutateAsync(brain.slug);
    onClose();
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Delete "{brain.name}"?</h2>
        <div className="modal-sub">
          This will permanently delete the brain and all its content. There's no undo.
        </div>
        <form onSubmit={handleDelete}>
          <div className="modal-row">
            <span className="label">Type the brain name to confirm</span>
            <input
              autoFocus
              className="input"
              placeholder={brain.name}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <div className="footer-row">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={input !== brain.name || deleteBrain.isPending}
            >
              {deleteBrain.isPending ? "Deleting…" : "Delete brain"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function statusInfo(status: BrainSummary["status"]): { cls: string; label: string } {
  if (status === "ready") return { cls: "ok", label: "Ready" };
  if (status === "stale") return { cls: "warn", label: "Needs update" };
  return { cls: "info", label: "Building" };
}

export default function BrainsList() {
  const { data: brains = [], isLoading } = useBrains();
  const { data: escalations = [] } = useEscalations();
  const { data: dash } = useWorkspaceDashboard();
  const [showNew, setShowNew] = useState(false);
  const [deletingBrain, setDeletingBrain] = useState<BrainSummary | null>(null);
  const [showEscalations, setShowEscalations] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const navigate = useNavigate();

  const pendingEscalations = escalations.filter((e) => e.status === "pending").length;

  // Build a slug → dash item lookup for sparklines + today stats
  const dashBySlug: Record<string, BrainDashItem> = {};
  if (dash) {
    for (const item of dash.brains) {
      dashBySlug[item.slug] = item;
    }
  }

  return (
    <div className="bl-shell">
      <AppTopbar />
      <div className="bl-main">
        <div className="inner">
          <div className="bl-head">
            <div>
              <h1>Your brains</h1>
              <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>
                {isLoading ? "Loading…" : `${brains.length} brain${brains.length !== 1 ? "s" : ""}`}
              </div>
            </div>
            <button className="btn btn-ghost btn-lg" onClick={() => setShowAuditLog(true)}>
              Activity log
            </button>
            <Link to="/map" className="btn btn-ghost btn-lg">
              Map view
            </Link>
            <button className="btn btn-primary btn-lg" onClick={() => setShowNew(true)}>
              <Icon name="plus" size={12} /> New brain
            </button>
          </div>

          {/* Hero stats */}
          {dash && (
            <div className="dash-hero">
              <div className="dash-tile">
                <div className="dash-tile-val">{dash.total_runs_today}</div>
                <div className="dash-tile-label dim">Runs today</div>
              </div>
              <div className="dash-tile">
                <div className="dash-tile-val"
                  style={{ color: dash.pending_escalations > 0 ? "var(--warn)" : undefined }}>
                  {dash.pending_escalations}
                </div>
                <div className="dash-tile-label dim">Pending escalations</div>
              </div>
              <div className="dash-tile">
                <div className="dash-tile-val">
                  ${dash.total_cost_usd_today > 0 ? dash.total_cost_usd_today.toFixed(4) : "0.00"}
                </div>
                <div className="dash-tile-label dim">Cost today</div>
              </div>
              <div className="dash-tile">
                <div className="dash-tile-val">{dash.total_brains}</div>
                <div className="dash-tile-label dim">Brains</div>
              </div>
            </div>
          )}

          {pendingEscalations > 0 && (
            <div className="escalation-banner" onClick={() => setShowEscalations(true)}>
              <span>
                <strong>{pendingEscalations}</strong> action{pendingEscalations !== 1 ? "s" : ""} waiting for your review
              </span>
              <button className="btn btn-sm">Review now</button>
            </div>
          )}

          {!isLoading && brains.length === 0 ? (
            <div className="bl-empty">
              <p>You haven't created a brain yet.</p>
              <p style={{ fontSize: 13, color: "var(--dim)", margin: "-8px 0 16px" }}>
                A brain captures what a person or team knows — through a short interview.
              </p>
              <button className="btn btn-primary btn-lg" onClick={() => setShowNew(true)}>
                <Icon name="plus" size={12} /> Create your first brain
              </button>
            </div>
          ) : (
            <div className="bl-table">
              <div className="bl-row head">
                <span>Brain</span>
                <span>Completeness</span>
                <span>Status</span>
                <span>Last 7 days</span>
                <span>Last updated</span>
                <span />
              </div>
              {brains.map((b) => {
                const { cls, label } = statusInfo(b.status);
                const fillColor = b.readiness_score >= 80
                  ? "var(--accent)"
                  : b.readiness_score >= 50
                  ? "var(--warn)"
                  : "var(--bad)";
                const dashItem = dashBySlug[b.slug];
                const hasFailed = (dashItem?.failed_today ?? 0) > 0;
                const hasPendingEsc = (dashItem?.pending_escalations ?? 0) > 0;
                return (
                  <div
                    key={b.id}
                    className="bl-row"
                    onClick={() => navigate(`/brains/${b.slug}`)}
                  >
                    <div>
                      <div className="bl-brain-name">{b.name}</div>
                      <div className="bl-brain-meta">
                        {dashItem && dashItem.runs_today > 0 && (
                          <span className="dim" style={{ fontSize: 11 }}>
                            {dashItem.runs_today} run{dashItem.runs_today !== 1 ? "s" : ""} today
                          </span>
                        )}
                        {hasFailed && (
                          <span style={{ fontSize: 11, color: "var(--bad)" }}>
                            {dashItem.failed_today} failed
                          </span>
                        )}
                        {hasPendingEsc && (
                          <span style={{ fontSize: 11, color: "var(--warn)" }}>
                            {dashItem.pending_escalations} escalation{dashItem.pending_escalations !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bl-readiness">
                      <span>{b.readiness_score}</span>
                      <span className="dim">/100</span>
                      <div className="mini-bar">
                        <div
                          className="mini-bar-fill"
                          style={{ width: `${b.readiness_score}%`, background: fillColor }}
                        />
                      </div>
                    </div>
                    <div>
                      <span className={`pill ${cls}`}>
                        <span className="dot" style={{ background: "currentColor" }} />
                        {label}
                      </span>
                    </div>
                    <div className="bl-sparkline">
                      {dashItem ? (
                        <MiniSparkline data={dashItem.sparkline} width={56} height={20} />
                      ) : (
                        <svg width={56} height={20} />
                      )}
                    </div>
                    <span className="dim" style={{ fontSize: 12.5 }}>
                      {new Date(b.updated_at).toLocaleDateString()}
                    </span>
                    <div className="bl-row-actions" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/brains/${b.slug}/activity`}
                        className="btn btn-sm btn-ghost"
                        title="Activity"
                      >
                        Activity
                      </Link>
                      <Link
                        to={`/brains/${b.slug}/analytics`}
                        className="btn btn-sm btn-ghost"
                        title="Analytics"
                      >
                        Analytics
                      </Link>
                      <button
                        className="btn btn-sm btn-ghost bl-delete-btn"
                        title="Delete brain"
                        onClick={() => setDeletingBrain(b)}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bl-footer">
            Each brain captures someone's knowledge through a structured interview.{" "}
          </div>
        </div>
      </div>

      {showNew && <NewBrainModal onClose={() => setShowNew(false)} />}
      {deletingBrain && (
        <DeleteBrainModal brain={deletingBrain} onClose={() => setDeletingBrain(null)} />
      )}
      {showEscalations && <EscalationsModal onClose={() => setShowEscalations(false)} />}
      {showAuditLog && <AuditLogModal onClose={() => setShowAuditLog(false)} />}
    </div>
  );
}
