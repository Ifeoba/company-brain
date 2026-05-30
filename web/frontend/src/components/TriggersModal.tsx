import { useState } from "react";
import { useCreateTrigger, useDeleteTrigger, useTriggers, useToggleTrigger } from "../api/hooks";
import type { TriggerOut } from "../types";

interface Props {
  slug: string;
  onClose: () => void;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="dim" style={{ fontSize: 11, marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <code style={{ fontSize: 12, background: "var(--surface-2)", padding: "3px 8px", borderRadius: 4, flex: 1, overflowX: "auto", whiteSpace: "nowrap" }}>
          {value}
        </code>
        <button className="btn btn-sm" onClick={copy} style={{ flexShrink: 0 }}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const colors: Record<string, string> = {
    webhook: "var(--accent)",
    schedule: "#8b5cf6",
    email: "#0ea5e9",
    database: "#f59e0b",
    manual: "var(--dimmer)",
  };
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
      color: colors[kind] ?? "var(--dimmer)", padding: "2px 6px",
      background: "var(--surface-2)", borderRadius: 3,
    }}>
      {kind}
    </span>
  );
}

export default function TriggersModal({ slug, onClose }: Props) {
  const { data: triggers = [], isLoading } = useTriggers(slug);
  const createTrigger = useCreateTrigger(slug);
  const deleteTrigger = useDeleteTrigger(slug);
  const toggleTrigger = useToggleTrigger(slug);

  const [name, setName] = useState("");
  const [newTrigger, setNewTrigger] = useState<TriggerOut | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const t = await createTrigger.mutateAsync({ kind: "webhook", name: name.trim() });
      setNewTrigger(t);
      setName("");
    } catch {}
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box triggers-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <strong>Triggers</strong>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Existing triggers */}
          {isLoading ? (
            <p className="dim" style={{ fontSize: 13 }}>Loading…</p>
          ) : triggers.length === 0 ? (
            <p className="dim" style={{ fontSize: 13, marginBottom: 16 }}>No triggers yet. Add a webhook to start receiving cases from external systems.</p>
          ) : (
            <div className="trigger-list">
              {triggers.map((t: TriggerOut) => (
                <div key={t.id} className="trigger-row">
                  <KindBadge kind={t.kind} />
                  <span style={{ fontSize: 13, flex: 1 }}>{t.name}</span>
                  <span className="dim" style={{ fontSize: 11 }}>
                    fired {relativeTime(t.last_fired_at)}
                  </span>
                  <label className="trigger-toggle" title={t.is_active ? "Disable" : "Enable"}>
                    <input
                      type="checkbox"
                      checked={t.is_active}
                      onChange={(e) => toggleTrigger.mutate({ triggerId: t.id, is_active: e.target.checked })}
                    />
                    <span className="toggle-track" />
                  </label>
                  <button
                    className="btn btn-sm btn-ghost text-danger"
                    onClick={() => {
                      if (confirm(`Delete trigger "${t.name}"?`)) deleteTrigger.mutate(t.id);
                    }}
                    style={{ padding: "2px 6px" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <hr className="trigger-divider" />

          {/* Creation form */}
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--dimmer)" }}>
            ADD WEBHOOK TRIGGER
          </div>
          <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              className="ba-input"
              placeholder="Name, e.g. Stripe events"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              className="btn btn-sm btn-primary"
              type="submit"
              disabled={createTrigger.isPending || !name.trim()}
            >
              {createTrigger.isPending ? "Creating…" : "Create"}
            </button>
          </form>

          {/* Secret card — shown once after creation */}
          {newTrigger && newTrigger.kind === "webhook" && (
            <div className="trigger-secret-card">
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                Webhook created — save these now
              </div>
              <CopyField
                label="Webhook URL (POST here)"
                value={`${window.location.origin}${newTrigger.webhook_url}`}
              />
              {newTrigger.secret && (
                <CopyField
                  label="Signing secret (X-Signature: sha256=<hmac>)"
                  value={newTrigger.secret}
                />
              )}
              <div className="trigger-secret-warn">
                ⚠ The secret is shown once. If you lose it, delete this trigger and create a new one.
              </div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setNewTrigger(null)}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
