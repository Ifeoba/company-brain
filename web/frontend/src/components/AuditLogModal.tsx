import { useAuditLog } from "../api/hooks";
import type { AuditLogEntry } from "../types";

interface Props {
  onClose: () => void;
}

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  "secret.read": { label: "Secret read", cls: "info" },
  "secret.write": { label: "Secret saved", cls: "ok" },
  "secret.delete": { label: "Secret deleted", cls: "bad" },
  "escalation.approved": { label: "Escalation approved", cls: "ok" },
  "escalation.denied": { label: "Escalation denied", cls: "bad" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AuditLogModal({ onClose }: Props) {
  const { data: entries = [], isLoading } = useAuditLog();

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card audit-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Activity log</h2>
        <div className="modal-sub">
          A record of credential access and action approvals in your workspace.
        </div>

        {isLoading && <p className="dim" style={{ fontSize: 13 }}>Loading…</p>}

        {!isLoading && entries.length === 0 && (
          <p className="dim" style={{ fontSize: 13, padding: "20px 0" }}>
            No activity recorded yet.
          </p>
        )}

        <div className="audit-list">
          {entries.map((e: AuditLogEntry) => {
            const meta = ACTION_LABELS[e.action] ?? { label: e.action, cls: "info" };
            const secretName = e.details?.secret_name as string | undefined;
            const runId = e.details?.run_id as string | undefined;
            return (
              <div key={e.id} className="audit-row">
                <span className={`pill ${meta.cls}`} style={{ fontSize: 10, flexShrink: 0 }}>
                  {meta.label}
                </span>
                <div className="audit-detail">
                  {secretName && <code style={{ fontSize: 11.5 }}>{secretName}</code>}
                  {runId && !secretName && <span className="dim" style={{ fontSize: 11.5 }}>run {runId.slice(0, 8)}</span>}
                </div>
                <span className="dim" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                  {e.occurred_at ? relativeTime(e.occurred_at) : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="footer-row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
