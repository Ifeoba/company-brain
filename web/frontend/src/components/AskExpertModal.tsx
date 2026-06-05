import { useState } from "react";
import type { Collaborator } from "../types";
import { useAddCollaborator, useAskExpert } from "../api/hooks";
import { avatarColors } from "./Avatar";
import Icon from "./Icon";

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
  const selectedCollab = collaborators.find((c) => c.id === selectedCollabId);

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
      await askExpert.mutateAsync({
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
  const recipientFirstName = isNew
    ? (newName.split(" ")[0] || "expert")
    : (selectedCollab?.name.split(" ")[0] ?? "expert");

  return (
    <div className="modal-scrim">
      <div className="modal-card">
        <h2>Ask one question to an expert</h2>
        <div className="modal-sub">They'll get a friendly email with a link to answer — no login needed.</div>

        <div className="modal-row">
          <span className="label">Send to</span>
          <div className="collab-select-wrap">
            <div className="collab-select">
              {selectedCollab && (() => {
                const [a, b] = avatarColors(selectedCollab.color_seed);
                return (
                  <div className="avatar" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
                    {selectedCollab.initials}
                  </div>
                );
              })()}
              {isNew ? (
                <span style={{ flex: 1, color: "var(--dim)" }}>+ Invite someone new</span>
              ) : (
                <div style={{ flex: 1 }}>
                  <div style={{ color: "var(--text)" }}>{selectedCollab?.name}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--dim)" }}>{selectedCollab?.email}</div>
                </div>
              )}
              <Icon name="chevron_down" size={12} color="var(--dim)" />
            </div>
            <select
              value={selectedCollabId}
              onChange={(e) => setSelectedCollabId(e.target.value)}
            >
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
              ))}
              <option value="new">+ Invite someone new</option>
            </select>
          </div>
        </div>

        {isNew && (
          <div className="collab-inline-fields">
            <input
              className="input"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <input
              className="input"
              placeholder="Email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
        )}

        <div className="modal-row" style={{ marginTop: isNew ? 14 : 0 }}>
          <span className="label">Your question</span>
          <textarea
            className="textarea"
            style={{ minHeight: 70 }}
            value={editedQuestion}
            onChange={(e) => setEditedQuestion(e.target.value)}
          />
        </div>

        <div className="modal-row">
          <span className="label">Add context (optional)</span>
          <textarea
            className="textarea"
            style={{ minHeight: 60 }}
            placeholder="Hi — I'm building an AI tool for X, quick one for you…"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="footer-row">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={isPending}>
            <Icon name="paperplane" size={12} />
            {isPending ? "Sending…" : `Send to ${recipientFirstName}`}
          </button>
        </div>
      </div>
    </div>
  );
}
