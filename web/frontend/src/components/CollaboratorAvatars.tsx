import { useState } from "react";
import { useAddCollaborator, useCollaborators } from "../api/hooks";
import { avatarColors } from "./Avatar";

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
    <>
      <div className="ba-collab-row">
        {collabs.map((c) => {
          const [a, b] = avatarColors(c.color_seed);
          return (
            <div
              key={c.id}
              className="avatar"
              title={`${c.name} (${c.email})`}
              style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
            >
              {c.initials}
            </div>
          );
        })}
        <button
          className="ba-collab-add"
          onClick={() => setShowForm(true)}
          title="Add collaborator"
        >
          +
        </button>
      </div>

      {showForm && (
        <div className="modal-scrim">
          <div className="modal-card sm">
            <h2>Add collaborator</h2>
            <div className="modal-sub">They'll receive expert questions by email — no login needed.</div>
            <form onSubmit={handleAdd}>
              <div className="modal-row">
                <span className="label">Name</span>
                <input
                  className="input"
                  placeholder="Olamide Adeyemi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-row">
                <span className="label">Email</span>
                <input
                  className="input"
                  placeholder="olamide@company.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <div className="error-msg">{error}</div>}
              <div className="footer-row">
                <button type="button" className="btn" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addCollab.isPending}>
                  {addCollab.isPending ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
