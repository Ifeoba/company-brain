import { useState } from "react";
import {
  useActivateLLMCredential, useDeleteLLMCredential, useLLMCredentials,
  useMe, useSaveLLMCredential, useTestLLMCredential,
} from "../api/hooks";
import AppTopbar from "../components/Layout";
import Icon from "../components/Icon";

const PROVIDERS = [
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    key_hint: "sk-ant-…",
    key_url: "https://console.anthropic.com/",
  },
  {
    id: "openai",
    name: "ChatGPT (OpenAI)",
    key_hint: "sk-…",
    key_url: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    name: "Gemini (Google)",
    key_hint: "AIza…",
    key_url: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "groq",
    name: "Groq",
    key_hint: "gsk_…",
    key_url: "https://console.groq.com/keys",
  },
];

export default function Settings() {
  const { data: user } = useMe();
  const { data: credentials = [] } = useLLMCredentials();
  const saveKey = useSaveLLMCredential();
  const deleteKey = useDeleteLLMCredential();
  const testKey = useTestLLMCredential();
  const activateKey = useActivateLLMCredential();

  const activeProvider = user?.llm_provider || "anthropic";
  const [selectedProvider, setSelectedProvider] = useState("");
  const currentProvider = selectedProvider || activeProvider;

  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [error, setError] = useState("");

  const chosen = PROVIDERS.find((p) => p.id === currentProvider);

  function credFor(id: string) {
    return credentials.find((c) => c.provider === id);
  }

  function handleSelectProvider(id: string) {
    setSelectedProvider(id);
    setApiKey("");
    setError("");
    setSaved(false);
    setTestResult(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTestResult(null);
    try {
      await saveKey.mutateAsync({ provider: currentProvider, api_key: apiKey });
      setApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleTest() {
    setError("");
    setTestResult(null);
    try {
      const res = await testKey.mutateAsync({
        provider: currentProvider,
        api_key: apiKey || undefined,
      }) as { ok: boolean; content?: string; error?: string };
      if (res.ok) {
        setTestResult({ ok: true, msg: "Connection successful." });
      } else {
        setTestResult({ ok: false, msg: res.error || "Connection failed." });
      }
    } catch (err: unknown) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : "Test failed" });
    }
  }

  async function handleDelete(provider: string) {
    if (!confirm("Remove API key for this provider?")) return;
    await deleteKey.mutateAsync(provider);
  }

  async function handleActivate(provider: string) {
    await activateKey.mutateAsync(provider);
  }

  const cred = credFor(currentProvider);
  const isConnected = !!cred;
  const isActive = currentProvider === activeProvider && (isConnected || !!user?.has_api_key);

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
              Save an API key for each provider you want to use. The active provider is used for all AI features.
            </div>

            <div className="provider-grid">
              {PROVIDERS.map((p) => {
                const isSelected = p.id === currentProvider;
                const pCred = credFor(p.id);
                const pConnected = !!pCred;
                const pActive = p.id === activeProvider && (pConnected || (p.id === "anthropic" && !!user?.has_api_key));
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={"provider-card" + (isSelected ? " selected" : "")}
                    onClick={() => handleSelectProvider(p.id)}
                  >
                    <span className="provider-name">{p.name}</span>
                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {pConnected && <span className="provider-badge">connected</span>}
                      {pActive && <span className="provider-badge active-badge">active</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {isConnected && (
              <div className="status-line" style={{ marginBottom: 12 }}>
                <span className="ok">● connected</span>
                {!isActive && (
                  <>
                    {" · "}
                    <button
                      className="btn btn-sm"
                      onClick={() => handleActivate(currentProvider)}
                      disabled={activateKey.isPending}
                      style={{ display: "inline", padding: 0, border: "none", background: "none", fontSize: "inherit", color: "var(--accent)", cursor: "pointer" }}
                    >
                      {activateKey.isPending ? "Activating…" : "Set as active"}
                    </button>
                  </>
                )}
                {" · "}
                <button
                  className="btn btn-sm"
                  onClick={() => handleDelete(currentProvider)}
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
                    placeholder={
                      isConnected
                        ? `${chosen?.key_hint ?? "…"} (enter new key to replace)`
                        : chosen?.key_hint ?? "Paste API key…"
                    }
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={handleTest}
                    disabled={testKey.isPending || (!apiKey && !isConnected)}
                    title={!apiKey && !isConnected ? "Paste a key first" : "Test connection"}
                  >
                    {testKey.isPending ? "Testing…" : "Test"}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saveKey.isPending || !apiKey}
                  >
                    {saveKey.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
                {chosen && (
                  <div style={{ fontSize: 12, color: "var(--dim)" }}>
                    Get a key at{" "}
                    <a href={chosen.key_url} target="_blank" rel="noopener noreferrer">
                      {chosen.key_url.replace(/^https?:\/\//, "")} →
                    </a>
                  </div>
                )}
              </div>
            </form>

            {error && <div className="status-line" style={{ color: "var(--bad)", marginTop: 8 }}>{error}</div>}
            {saved && <div className="status-line" style={{ color: "var(--ok)", marginTop: 8 }}>Saved.</div>}
            {testResult && (
              <div className="status-line" style={{ color: testResult.ok ? "var(--ok)" : "var(--bad)", marginTop: 8 }}>
                {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3>Email notifications</h3>
            <div className="desc">
              When you send a question to an expert, it arrives by email. Add your Resend API key
              via the <a href="/insights">Credentials</a> page — store it as{" "}
              <code className="mono">RESEND_API_KEY</code>.
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
