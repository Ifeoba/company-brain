import { useState } from "react";
import type { Collaborator } from "../types";
import { useAddCollaborator, useAskExpert } from "../api/hooks";

interface Props {
  slug: string;
  step: number;
  questionKey: string;
  questionText: string;
  collaborators: Collaborator[];
  onClose: () => void;
  onSent: (name: string) => void;
}

export default function AskExpertModal({ slug, step, questionKey, questionText, collaborators, onClose, onSent }: Props) {
  const [selectedCollabId, setSelectedCollabId] = useState(collaborators[0]?.id ?? "new");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [editedQuestion, setEditedQuestion] = useState(questionText);
  const [context, setContext] = useState("");
  const [error, setError] = useState("");

  const addCollab = useAddCollaborator(slug);
  const askExpert = useAskExpert(slug);

  const isNew = selectedCollabId === "new";

  async function handleSend() {
    setError("");
    let collabId = selectedCollabId;

    if (isNew) {
      if (!newName.trim() || !newEmail.trim()) {
        setError("Name and email are required");
        return;
      }
      try {
        const c = await addCollab.mutateAsync({ name: newName.trim(), email: newEmail.trim() });
        collabId = c.id;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to add collaborator");
        return;
      }
    }

    try {
      const q = await askExpert.mutateAsync({
        collaborator_id: collabId,
        step,
        question_key: questionKey,
        question_text: editedQuestion,
        context_text: context,
      });
      const name = collaborators.find((c) => c.id === collabId)?.name.split(" ")[0] ?? newName.split(" ")[0] ?? "them";
      onSent(name);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send");
    }
  }

  const isPending = addCollab.isPending || askExpert.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-6 w-[480px] shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-sm mb-4 text-gray-900 dark:text-gray-100">Ask a question to</h2>

        {/* Collaborator selector */}
        <select
          className="w-full border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 mb-3 focus:outline-none"
          value={selectedCollabId}
          onChange={(e) => setSelectedCollabId(e.target.value)}
        >
          {collaborators.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
          ))}
          <option value="new">+ Invite someone new</option>
        </select>

        {/* New collaborator fields */}
        {isNew && (
          <div className="flex gap-2 mb-3">
            <input
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 focus:outline-none"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <input
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 focus:outline-none"
              placeholder="Email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
        )}

        {/* Question */}
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Your question</label>
        <textarea
          className="w-full border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 resize-none focus:outline-none mb-3"
          rows={3}
          value={editedQuestion}
          onChange={(e) => setEditedQuestion(e.target.value)}
        />

        {/* Context */}
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Add context (optional)</label>
        <textarea
          className="w-full border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 resize-none focus:outline-none mb-4"
          rows={2}
          placeholder="Hi — I'm building an AI tool for X, quick one for you…"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />

        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isPending}
            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-5 py-2 rounded font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
