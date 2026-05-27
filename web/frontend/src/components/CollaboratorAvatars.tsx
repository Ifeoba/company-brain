import { useState } from "react";
import { useAddCollaborator, useCollaborators } from "../api/hooks";

const COLORS = [
  "#7cf29c", "#f2c47c", "#7cb8f2", "#f27c9a",
  "#c47cf2", "#f2e57c", "#7cf2e5", "#f29c7c",
];

interface Props {
  slug: string;
}

export default function CollaboratorAvatars({ slug }: Props) {
  const { data: collabs = [] } = useCollaborators(slug);
  const addCollab = useAddCollaborator(slug);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    try {
      await addCollab.mutateAsync({ name: name.trim(), email: email.trim() });
      setName("");
      setEmail("");
      setShowForm(false);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error adding collaborator");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1 flex-wrap">
        {collabs.map((c) => (
          <div
            key={c.id}
            title={`${c.name} (${c.email})`}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-default"
            style={{ background: COLORS[c.color_seed % COLORS.length], color: "#111" }}
          >
            {c.initials}
          </div>
        ))}
        <button
          onClick={() => setShowForm(true)}
          title="Add collaborator"
          className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors text-sm"
        >
          +
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-6 w-80 shadow-xl">
            <h3 className="font-semibold text-sm mb-4 text-gray-900 dark:text-gray-100">Add collaborator</h3>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <input
                className="border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <input
                className="border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-2 justify-end mt-1">
                <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addCollab.isPending}
                  className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-4 py-1.5 rounded font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {addCollab.isPending ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
