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

const KIND_OPTIONS = [
  { value: "webhook", label: "From another app" },
  { value: "schedule", label: "On a schedule" },
  { value: "email",   label: "Via email" },
] as const;

type TriggerKind = "webhook" | "schedule" | "email";

const CRON_EXAMPLES = [
  { label: "Every hour",     expr: "0 * * * *" },
  { label: "Daily at 9 AM",  expr: "0 9 * * *" },
  { label: "Every 15 min",   expr: "*/15 * * * *" },
  { label: "Weekdays 8 AM",  expr: "0 8 * * 1-5" },
];

export default function TriggersModal({ slug, onClose }: Props) {
  const { data: triggers = [], isLoading } = useTriggers(slug);
  const createTrigger = useCreateTrigger(slug);
  const deleteTrigger = useDeleteTrigger(slug);
  const toggleTrigger = useToggleTrigger(slug);

  const [kind, setKind] = useState<TriggerKind>("webhook");
  const [name, setName] = useState("");
  const [cronExpr, setCronExpr] = useState("");
  const [error, setError] = useState("");
  const [newTrigger, setNewTrigger] = useState<TriggerOut | null>(null);

  function validateCron(expr: string): boolean {
    if (expr.trim().split(/\s+/).length !== 5) {
      setError("Pick one of the schedule options above, or enter a valid schedule (5 fields).");
      return false;
    }
    setError("");
    return true;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card triggers-modal" onClick={(e) => e.stopPropagation()}>
        <h2>When should this run?</h2>
        <div className="modal-sub">
          Set up what kicks this brain off — a message from another app, a regular schedule, or an incoming email.
        </div>

        {/* Existing triggers */}
        {isLoading ? (
          <p className="dim" style={{ fontSize: 13 }}>Loading…</p>
        ) : triggers.length > 0 && (
          <div className="modal-row">
            <span className="label">Active</span>
            <div className="trigger-list">
              {triggers.map((t: TriggerOut) => (
                <div key={t.id} className="trigger-row">
                  <div className="trigger-row-info">
                    <span className="trigger-row-name">{t.name}</span>
                    {t.cron_expression && (
                      <code className="trigger-row-meta">{t.cron_expression}</code>
                    )}
                    {t.inbound_email && (
                      <code className="trigger-row-meta">{t.inbound_email}</code>
                    )}
                    <span className="trigger-row-meta">last ran {relativeTime(t.last_fired_at)}</span>
                  </div>
                  <label className="trigger-toggle" title={t.is_active ? "Pause this" : "Resume this"}>
                    <input
                      type="checkbox"
                      checked={t.is_active}
                      onChange={(e) => toggleTrigger.mutate({ triggerId: t.id, is_active: e.target.checked })}
                    />
                    <span className="toggle-track" />
                  </label>
                  <button
                    className="btn btn-ghost btn-danger"
                    onClick={() => {
                      if (confirm(`Remove "${t.name}"?`)) deleteTrigger.mutate(t.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Post-creation card */}
        {newTrigger && (
          <div className="trigger-reveal">
            <span className="label">
              {newTrigger.kind === "webhook"  && "You're all set — save this info now"}
              {newTrigger.kind === "email"    && "Your email address is ready"}
              {newTrigger.kind === "schedule" && "Schedule saved"}
            </span>

            {newTrigger.kind === "webhook" && (
              <>
                <TriggerCopyRow label="URL to send data to" value={`${window.location.origin}${newTrigger.webhook_url}`} />
                {newTrigger.secret && (
                  <TriggerCopyRow label="Signing secret" value={newTrigger.secret} />
                )}
                <p className="trigger-warn">⚠ Copy the signing secret now — you won't be able to see it again.</p>
              </>
            )}

            {newTrigger.kind === "email" && newTrigger.inbound_email && (
              <>
                <TriggerCopyRow label="Send emails to this address" value={newTrigger.inbound_email} />
                <TriggerCopyRow label="Or forward them to this URL" value={`${window.location.origin}/api/inbound-email/${newTrigger.id}`} />
              </>
            )}

            {newTrigger.kind === "schedule" && newTrigger.cron_expression && (
              <p style={{ fontSize: 13, margin: "6px 0 0" }}>
                This will run on schedule: <code>{newTrigger.cron_expression}</code>
              </p>
            )}

            <div className="footer-row" style={{ marginTop: 12, paddingTop: 12 }}>
              <button className="btn btn-primary" onClick={() => setNewTrigger(null)}>Done</button>
            </div>
          </div>
        )}

        {/* Creation form */}
        {!newTrigger && (
          <form onSubmit={handleCreate}>
            <div className="modal-row">
              <span className="label">How should it be triggered?</span>
              <div className="trigger-kind-tabs">
                {KIND_OPTIONS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    className={"btn" + (kind === k.value ? " btn-primary" : "")}
                    onClick={() => { setKind(k.value); setError(""); }}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-row">
              <span className="label">Give it a name</span>
              <input
                className="input"
                placeholder={
                  kind === "webhook"  ? "e.g. New Stripe payment" :
                  kind === "schedule" ? "e.g. Morning briefing" :
                  "e.g. Customer support emails"
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {kind === "schedule" && (
              <div className="modal-row">
                <span className="label">How often?</span>
                <div className="hint" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {CRON_EXAMPLES.map((ex) => (
                    <button
                      key={ex.expr}
                      type="button"
                      className={"btn btn-sm" + (cronExpr === ex.expr ? " btn-primary" : "")}
                      onClick={() => { setCronExpr(ex.expr); setError(""); }}
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
                <input
                  className={"input" + (error ? " input-error" : "")}
                  placeholder="or type a custom schedule…"
                  value={cronExpr}
                  onChange={(e) => { setCronExpr(e.target.value); if (error) setError(""); }}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
                />
              </div>
            )}

            {kind === "email" && (
              <div className="modal-row">
                <p className="hint">
                  You'll get a unique email address. Forward messages there from your helpdesk or inbox, and each one will start a new run.
                </p>
              </div>
            )}

            {error && <div className="error-msg">{error}</div>}

            <div className="footer-row">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!name.trim() || (kind === "schedule" && !cronExpr.trim()) || createTrigger.isPending}
              >
                {createTrigger.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function TriggerCopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="modal-row">
      <span className="label">{label}</span>
      <div className="trigger-copy-row">
        <code className="trigger-copy-value">{value}</code>
        <button type="button" className="btn btn-sm" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
