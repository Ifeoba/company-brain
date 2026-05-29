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
      await setKey.mutateAsync({ provider: "anthropic", api_key: apiKey });
      setApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete() {
    if (!confirm("Remove your API key?")) return;
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
              AI assistant
            </h3>
            <div className="desc">
              Add your Anthropic API key to enable AI-powered drafting and suggestions. Your key is stored securely and never shared.
            </div>

            {user?.has_api_key && (
              <div className="status-line" style={{ marginBottom: 12 }}>
                <span className="ok">● connected</span>
                {" · "}
                <button
                  className="btn btn-sm"
                  onClick={handleDelete}
                  disabled={deleteKey.isPending}
                  style={{ display: "inline", padding: 0, border: "none", background: "none", fontSize: "inherit", color: "var(--bad)", cursor: "pointer" }}
                >
                  {deleteKey.isPending ? "Removing…" : "Remove key"}
                </button>
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="field-row">
                  <input
                    type="password"
                    className="input key-input"
                    placeholder={user?.has_api_key ? "sk-ant-… (enter new key to replace)" : "sk-ant-…"}
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
                <div style={{ fontSize: 12, color: "var(--dim)" }}>
                  Get a key at{" "}
                  <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
                    console.anthropic.com →
                  </a>
                </div>
              </div>
            </form>

            {error && <div className="status-line" style={{ color: "var(--bad)", marginTop: 8 }}>{error}</div>}
            {saved && <div className="status-line" style={{ color: "var(--ok)", marginTop: 8 }}>Saved.</div>}
          </div>

          <div className="settings-section">
            <h3>Email notifications</h3>
            <div className="desc">
              When you send a question to an expert, it arrives by email from your configured sender address.
              Ask your workspace admin to set this up, or add a <code className="mono">RESEND_API_KEY</code> to your environment.
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
