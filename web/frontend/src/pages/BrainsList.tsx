import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBrains, useCreateBrain } from "../api/hooks";
import AppTopbar from "../components/Layout";
import Icon from "../components/Icon";
import type { BrainSummary } from "../types";

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
      setError(err instanceof Error ? err.message : "Failed to create brain");
    }
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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
            {name && (
              <div className="hint mono" style={{ marginTop: 6, fontSize: 11, color: "var(--dim)" }}>
                slug: {slug}
              </div>
            )}
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

function statusInfo(status: BrainSummary["status"]): { cls: string; label: string } {
  if (status === "ready") return { cls: "ok", label: "Ready" };
  if (status === "stale") return { cls: "warn", label: "Stale" };
  return { cls: "info", label: "In formation" };
}

export default function BrainsList() {
  const { data: brains = [], isLoading } = useBrains();
  const [showNew, setShowNew] = useState(false);
  const navigate = useNavigate();

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
            <Link to="/map" className="btn btn-ghost btn-lg">
              Map view
            </Link>
            <button className="btn btn-primary btn-lg" onClick={() => setShowNew(true)}>
              <Icon name="plus" size={12} /> New brain
            </button>
          </div>

          {!isLoading && brains.length === 0 ? (
            <div className="bl-empty">
              <p>No brains yet.</p>
              <button className="btn btn-primary btn-lg" onClick={() => setShowNew(true)}>
                <Icon name="plus" size={12} /> Create your first brain
              </button>
            </div>
          ) : (
            <div className="bl-table">
              <div className="bl-row head">
                <span>Brain</span>
                <span>Readiness</span>
                <span>Status</span>
                <span>Updated</span>
                <span />
              </div>
              {brains.map((b) => {
                const { cls, label } = statusInfo(b.status);
                const fillColor = b.readiness_score >= 80
                  ? "var(--accent)"
                  : b.readiness_score >= 50
                  ? "var(--warn)"
                  : "var(--bad)";
                return (
                  <div
                    key={b.id}
                    className="bl-row"
                    onClick={() => navigate(`/brains/${b.slug}`)}
                  >
                    <div>
                      <div className="bl-brain-name">{b.name}</div>
                      <div className="bl-brain-slug">{b.slug}</div>
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
                    <span className="dim" style={{ fontSize: 12.5 }}>
                      {new Date(b.updated_at).toLocaleDateString()}
                    </span>
                    <Icon name="chevron_right" size={14} color="var(--dimmer)" />
                  </div>
                );
              })}
            </div>
          )}

          <div className="bl-footer">
            Each brain is a folder of 9 files.{" "}
            <a style={{ color: "var(--text-2)" }}>What's a brain? →</a>
          </div>
        </div>
      </div>

      {showNew && <NewBrainModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
