import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBrains, useCreateBrain } from "../api/hooks";
import Layout from "../components/Layout";
import type { BrainSummary } from "../types";

function StatusBadge({ status }: { status: BrainSummary["status"] }) {
  const map = {
    "in-formation": "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    ready: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    stale: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };
  const labels = { "in-formation": "In formation", ready: "Ready", stale: "Stale" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

function MiniGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#7cf29c" : score >= 50 ? "#f2c47c" : "#e5e5e5";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-gray-500">{score}</span>
    </div>
  );
}

function NewBrainModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const createBrain = useCreateBrain();
  const navigate = useNavigate();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    try {
      const brain = await createBrain.mutateAsync({ name: name.trim() });
      navigate(`/brains/${brain.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create brain");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-6 w-96 shadow-xl">
        <h2 className="font-semibold text-sm mb-4 text-gray-900 dark:text-gray-100">New brain</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
            <input
              autoFocus
              className="w-full border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400"
              placeholder="e.g. Billing Support"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {name && (
              <p className="text-xs text-gray-400 mt-1">
                Slug: <span className="font-mono">{name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}</span>
              </p>
            )}
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2 justify-end mt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createBrain.isPending || !name.trim()}
              className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-5 py-2 rounded font-medium hover:opacity-90 disabled:opacity-50"
            >
              {createBrain.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BrainsList() {
  const { data: brains = [], isLoading } = useBrains();
  const [showNew, setShowNew] = useState(false);
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your brains</h1>
          <button
            onClick={() => setShowNew(true)}
            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-4 py-2 rounded font-medium hover:opacity-90"
          >
            New brain
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : brains.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-sm mb-4">No brains yet.</p>
            <button
              onClick={() => setShowNew(true)}
              className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-5 py-2.5 rounded font-medium hover:opacity-90"
            >
              Create your first brain
            </button>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1a1a1a]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Readiness</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Updated</th>
                </tr>
              </thead>
              <tbody>
                {brains.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/brains/${b.slug}`)}
                    className="border-b last:border-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{b.name}</div>
                      <div className="text-xs font-mono text-gray-400">{b.slug}</div>
                    </td>
                    <td className="px-4 py-3"><MiniGauge score={b.readiness_score} /></td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(b.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showNew && <NewBrainModal onClose={() => setShowNew(false)} />}
    </Layout>
  );
}
