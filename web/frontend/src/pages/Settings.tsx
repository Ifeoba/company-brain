import { useState } from "react";
import { useDeleteApiKey, useMe, useProviders, useSetApiKey } from "../api/hooks";
import AppTopbar from "../components/Layout";
import Icon from "../components/Icon";

export default function Settings() {
  const { data: user } = useMe();
  const { data: providers = [] } = useProviders();
  const setKey = useSetApiKey();
  const deleteKey = useDeleteApiKey();

  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const activeProviderId = provider || user?.llm_provider || "anthropic";
  const activeProvider = providers.find((p) => p.id === activeProviderId);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await setKey.mutateAsync({ provider: activeProviderId, api_key: apiKey });
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
              AI provider
            </h3>
            <div className="desc">
              Choose which AI model powers your interviews and insights. Your key is
              encrypted at rest and never leaves your server.
            </div>

            {user?.has_api_key && (
              <div className="status-line" style={{ marginBottom: 12 }}>
                <span className="ok">● connected</span>
                {" · "}
                <span style={{ color: "var(--dim)" }}>
                  using {providers.find((p) => p.id === user.llm_provider)?.name ?? user.llm_provider}
                </span>
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
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`wm-conn-option${activeProviderId === p.id ? " selected" : ""}`}
                      style={activeProviderId === p.id ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
                      onClick={() => setProvider(p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                <div className="field-row">
                  <input
                    type="password"
                    className="input key-input"
                    placeholder={
                      user?.has_api_key && user.llm_provider === activeProviderId
                        ? `${activeProvider?.key_hint ?? "…"} (enter new key to replace)`
                        : activeProvider?.key_hint ?? "Paste your API key…"
                    }
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

                {activeProvider && (
                  <div style={{ fontSize: 12, color: "var(--dim)" }}>
                    Get a key at{" "}
                    <a href={activeProvider.key_url} target="_blank" rel="noopener noreferrer">
                      {activeProvider.key_url.replace(/^https?:\/\//, "").split("/")[0]} →
                    </a>
                  </div>
                )}
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
