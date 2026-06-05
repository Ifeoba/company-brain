import { useState } from "react";
import { useVaultSecrets, useStoreSecret, useDeleteSecret } from "../api/hooks";
import type { VaultSecretSummary } from "../types";

interface Props {
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

export default function VaultModal({ onClose }: Props) {
  const { data: secrets = [], isLoading } = useVaultSecrets();
  const storeSecret = useStoreSecret();
  const deleteSecret = useDeleteSecret();

  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function handleStore(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved("");
    if (!name.trim() || !value.trim()) return;
    try {
      await storeSecret.mutateAsync({ name: name.trim(), value: value.trim() });
      setSaved(name.trim().toUpperCase());
      setName("");
      setValue("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <h2>Credentials</h2>
        <div className="modal-sub">
          Safely store API keys and tokens here. Your actions use them behind the scenes — the values are never shown again once saved.
        </div>

        {/* Existing secrets */}
        <div className="modal-row">
          <span className="label">Saved credentials</span>
          {isLoading ? (
            <p className="dim" style={{ fontSize: 13 }}>Loading…</p>
          ) : secrets.length === 0 ? (
            <p className="dim" style={{ fontSize: 13 }}>Nothing saved yet.</p>
          ) : (
            <div className="trigger-list">
              {secrets.map((s: VaultSecretSummary) => (
                <div key={s.name} className="trigger-row">
                  <div className="trigger-row-info">
                    <code className="trigger-row-name" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                      {s.name}
                    </code>
                    <span className="trigger-row-meta">saved {relativeTime(s.updated_at)}</span>
                  </div>
                  <button
                    className="btn btn-sm btn-ghost btn-danger"
                    onClick={() => {
                      if (confirm(`Remove "${s.name}"? Any actions using it will stop working.`)) {
                        deleteSecret.mutate(s.name);
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add / update */}
        <form onSubmit={handleStore}>
          <div className="modal-row">
            <span className="label">Name</span>
            <input
              className="input"
              placeholder="e.g. SLACK_BOT_TOKEN"
              value={name}
              onChange={(e) => { setName(e.target.value.toUpperCase()); setSaved(""); }}
              style={{ fontFamily: "var(--font-mono)" }}
              autoComplete="off"
            />
            <div className="hint" style={{ marginTop: 4, fontSize: 11.5 }}>
              Saving the same name again updates it.
            </div>
          </div>

          <div className="modal-row">
            <span className="label">Key or token</span>
            <input
              className="input"
              type="password"
              placeholder="Paste your key or token here"
              value={value}
              onChange={(e) => { setValue(e.target.value); setSaved(""); }}
              autoComplete="new-password"
            />
          </div>

          {saved && (
            <p style={{ fontSize: 12, color: "var(--accent)", marginBottom: 8 }}>
              ✓ {saved} saved.
            </p>
          )}
          {error && <div className="error-msg">{error}</div>}

          <div className="footer-row">
            <button type="button" className="btn" onClick={onClose}>Done</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || !value.trim() || storeSecret.isPending}
            >
              {storeSecret.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
