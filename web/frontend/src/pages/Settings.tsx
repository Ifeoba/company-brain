import { useState } from "react";
import { useDeleteApiKey, useMe, useSetApiKey } from "../api/hooks";
import Layout from "../components/Layout";

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
    <Layout>
      <div className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-8">Settings</h1>

        {/* Anthropic API key */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Anthropic API key</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Required to use "Draft from answer". Your key is encrypted at rest and never logged.{" "}
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Get a key →
            </a>
          </p>

          {user?.has_anthropic_key && (
            <div className="flex items-center gap-3 mb-4 text-xs text-gray-600 dark:text-gray-400">
              <span className="text-[#7cf29c]">✓</span>
              <span>API key is set</span>
              <button
                onClick={handleDelete}
                disabled={deleteKey.isPending}
                className="text-red-400 hover:text-red-600 ml-2 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          )}

          <form onSubmit={handleSave} className="flex gap-2">
            <input
              type="password"
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 font-mono"
              placeholder={user?.has_anthropic_key ? "sk-ant-... (enter new key to replace)" : "sk-ant-..."}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button
              type="submit"
              disabled={setKey.isPending || !apiKey}
              className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-4 py-2 rounded font-medium hover:opacity-90 disabled:opacity-50"
            >
              {setKey.isPending ? "Saving…" : "Save"}
            </button>
          </form>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          {saved && <p className="text-[#7cf29c] text-xs mt-2">Saved.</p>}
        </section>

        {/* Email */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Email (Resend)</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Email is configured at the workspace level via <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">RESEND_API_KEY</code> and{" "}
            <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">RESEND_FROM_EMAIL</code> environment variables. See the README for setup instructions.
          </p>
        </section>

        {/* Sign out */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <a href="/api/auth/logout" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            Sign out
          </a>
        </div>
      </div>
    </Layout>
  );
}
