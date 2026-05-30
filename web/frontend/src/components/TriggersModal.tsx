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

const KIND_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "webhook", label: "Webhook", desc: "POST from an external system" },
  { value: "schedule", label: "Schedule", desc: "Run on a cron schedule" },
  { value: "email", label: "Email", desc: "Fire when an email arrives" },
];

const CRON_EXAMPLES = [
  { label: "Every hour", expr: "0 * * * *" },
  { label: "Daily 9 AM UTC", expr: "0 9 * * *" },
  { label: "Every 15 min", expr: "*/15 * * * *" },
  { label: "Weekdays 8 AM UTC", expr: "0 8 * * 1-5" },
];

export default function TriggersModal({ slug, onClose }: Props) {
  const { data: triggers = [], isLoading } = useTriggers(slug);
  const createTrigger = useCreateTrigger(slug);
  const deleteTrigger = useDeleteTrigger(slug);
  const toggleTrigger = useToggleTrigger(slug);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"webhook" | "schedule" | "email">("webhook");
  const [cronExpr, setCronExpr] = useState("");
  const [cronError, setCronError] = useState("");
  const [newTrigger, setNewTrigger] = useState<TriggerOut | null>(null);

  function validateCron(expr: string): boolean {
    // Simple client-side format check: 5 space-separated fields
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) {
      setCronError("Expected 5 fields: minute hour day month weekday");
      return false;
    }
    setCronError("");
    return true;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (kind === "schedule" && !validateCron(cronExpr)) return;
    try {
      const t = await createTrigger.mutateAsync({
        kind,
        name: name.trim(),
        cron_expression: kind === "schedule" ? cronExpr.trim() : undefined,
      });
      setNewTrigger(t);
      setName("");
      setCronExpr("");
    } catch {}
  }

  const canSubmit = name.trim() && (kind !== "schedule" || cronExpr.trim()) && !createTrigger.isPending;

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
            <p className="dim" style={{ fontSize: 13, marginBottom: 16 }}>
              No triggers yet. Add one below to start receiving cases automatically.
            </p>
          ) : (
            <div className="trigger-list">
              {triggers.map((t: TriggerOut) => (
                <div key={t.id} className="trigger-row">
                  <KindBadge kind={t.kind} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{t.name}</div>
                    {t.kind === "schedule" && t.cron_expression && (
                      <code style={{ fontSize: 11, color: "var(--dim)" }}>{t.cron_expression}</code>
                    )}
                    {t.kind === "email" && t.inbound_email && (
                      <code style={{ fontSize: 11, color: "var(--dim)" }}>{t.inbound_email}</code>
                    )}
                  </div>
                  <span className="dim" style={{ fontSize: 11, flexShrink: 0 }}>
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

          {/* Kind tabs */}
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--dimmer)" }}>
            ADD TRIGGER
          </div>
          <div className="trigger-kind-tabs">
            {KIND_OPTIONS.map((k) => (
              <button
                key={k.value}
                type="button"
                className={"trigger-kind-tab" + (kind === k.value ? " active" : "")}
                onClick={() => { setKind(k.value as typeof kind); setCronError(""); }}
              >
                {k.label}
              </button>
            ))}
          </div>

          {/* Creation form */}
          <form onSubmit={handleCreate} style={{ marginBottom: 16 }}>
            <input
              className="ba-input"
              placeholder={
                kind === "webhook" ? "Name, e.g. Stripe events" :
                kind === "schedule" ? "Name, e.g. Daily review" :
                "Name, e.g. Support inbox"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
            />

            {kind === "schedule" && (
              <div style={{ marginBottom: 8 }}>
                <input
                  className={"ba-input" + (cronError ? " input-error" : "")}
                  placeholder="Cron expression, e.g. 0 9 * * *"
                  value={cronExpr}
                  onChange={(e) => { setCronExpr(e.target.value); if (cronError) validateCron(e.target.value); }}
                  style={{ width: "100%", fontSize: 13, fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                />
                {cronError ? (
                  <p style={{ fontSize: 11, color: "var(--bad)", margin: "4px 0 0" }}>{cronError}</p>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    {CRON_EXAMPLES.map((ex) => (
                      <button
                        key={ex.expr}
                        type="button"
                        className="btn btn-sm"
                        style={{ fontSize: 11 }}
                        onClick={() => setCronExpr(ex.expr)}
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {kind === "email" && (
              <p style={{ fontSize: 12, color: "var(--dim)", margin: "0 0 8px" }}>
                An inbound email address will be generated. Forward emails there (via Resend or Postmark routing) to trigger runs.
              </p>
            )}

            <button
              className="btn btn-sm btn-primary"
              type="submit"
              disabled={!canSubmit}
              style={{ width: "100%" }}
            >
              {createTrigger.isPending ? "Creating…" : "Create " + kind + " trigger"}
            </button>
          </form>

          {/* Post-creation info card */}
          {newTrigger && (
            <div className="trigger-secret-card">
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                {newTrigger.kind === "webhook" && "Webhook created — save these now"}
                {newTrigger.kind === "email" && "Email trigger created"}
                {newTrigger.kind === "schedule" && "Schedule trigger created"}
              </div>

              {newTrigger.kind === "webhook" && (
                <>
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
                </>
              )}

              {newTrigger.kind === "email" && newTrigger.inbound_email && (
                <>
                  <CopyField
                    label="Inbound email address"
                    value={newTrigger.inbound_email}
                  />
                  <p style={{ fontSize: 12, color: "var(--dim)", margin: "8px 0 0" }}>
                    Configure Resend or Postmark inbound routing to POST emails to{" "}
                    <code style={{ fontSize: 11 }}>{window.location.origin}/api/inbound-email/{newTrigger.id}</code>
                  </p>
                </>
              )}

              {newTrigger.kind === "schedule" && newTrigger.cron_expression && (
                <p style={{ fontSize: 13, color: "var(--text-2)" }}>
                  Will fire on schedule: <code style={{ fontSize: 12 }}>{newTrigger.cron_expression}</code>
                </p>
              )}

              <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setNewTrigger(null)}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
