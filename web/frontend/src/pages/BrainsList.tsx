import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBrains, useCreateBrain, useDeleteBrain } from "../api/hooks";
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
  const [showNew, setShowNew] = useState(false);
  const [deletingBrain, setDeletingBrain] = useState<BrainSummary | null>(null);
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
                return (
                  <div
                    key={b.id}
                    className="bl-row"
                    onClick={() => navigate(`/brains/${b.slug}`)}
                  >
                    <div>
                      <div className="bl-brain-name">{b.name}</div>
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
                    <button
                      className="btn btn-sm btn-ghost bl-delete-btn"
                      title="Delete brain"
                      onClick={(e) => { e.stopPropagation(); setDeletingBrain(b); }}
                    >
                      <Icon name="trash" size={13} />
                    </button>
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
    </div>
  );
}
