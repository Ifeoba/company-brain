import { useState } from "react";
import { useDeleteApiKey, useMe, useSetApiKey } from "../api/hooks";
import AppTopbar from "../components/Layout";
import Icon from "../components/Icon";

export default function Settings() {
  const { data: user } = useMe();
  const setKey = useSetApiKey();
  const deleteKey = useDeleteApiKey();

  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await setKey.mutateAsync(apiKey);
      setApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete() {
    if (!confirm("Remove your Anthropic API key?")) return;
    await deleteKey.mutateAsync();
  }

  return (
    <div className="settings-shell">
      <AppTopbar />
      <div className="settings-main">
        <div className="inner">
          <div className="settings-head">
            <h1>Settings</h1>
            {user && (
              <span className="ws-label">workspace · {user.github_username}</span>
            )}
          </div>

          <div className="settings-section">
            <h3>
              <Icon name="key" size={14} />
              Anthropic API key
            </h3>
            <div className="desc">
              Required to run the interview. Your key is encrypted at rest and used only to draft
              files from your answers.{" "}
              <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
                How to get one →
              </a>
            </div>

            {user?.has_anthropic_key && (
              <div className="status-line" style={{ marginBottom: 12 }}>
                <span className="ok">● connected</span>
                {" · "}
                <button
                  className="btn btn-sm btn-danger"
                  onClick={handleDelete}
                  disabled={deleteKey.isPending}
                  style={{ display: "inline", padding: 0, border: "none", background: "none", fontSize: "inherit" }}
                >
                  {deleteKey.isPending ? "Removing…" : "Remove key"}
                </button>
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="field-row">
                <input
                  type="password"
                  className="input key-input"
                  placeholder={user?.has_anthropic_key ? "sk-ant-… (enter new key to replace)" : "sk-ant-…"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={setKey.isPending || !apiKey}
                >
                  {setKey.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>

            {error && <div className="status-line" style={{ color: "var(--bad)", marginTop: 8 }}>{error}</div>}
            {saved && <div className="status-line" style={{ color: "var(--ok)", marginTop: 8 }}>Saved.</div>}
          </div>

          <div className="settings-section">
            <h3>Email sender</h3>
            <div className="desc">
              Expert questions are sent from this address. Configured at the workspace level via{" "}
              <code className="mono">RESEND_API_KEY</code> and{" "}
              <code className="mono">RESEND_FROM_EMAIL</code> environment variables.
            </div>
          </div>

          <div className="settings-footer">
            <a href="/api/auth/logout" className="btn">
              <Icon name="logout" size={12} /> Sign out
            </a>
            {user && (
              <span className="user-label">
                Signed in as <b>{user.github_username}</b>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
