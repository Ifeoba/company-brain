import { useState } from "react";
import { useParams } from "react-router-dom";
import { usePublicBrainUpdate, useSubmitBrainUpdate } from "../api/hooks";
import Icon from "../components/Icon";

export default function UpdatePage() {
  const { token } = useParams<{ token: string }>();
  const { data: brain, isLoading, isError } = usePublicBrainUpdate(token!);
  const submit = useSubmitBrainUpdate(token!);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setError("");
    try {
      await submit.mutateAsync({
        contributor_name: name.trim(),
        contributor_email: email.trim(),
        topic: topic.trim(),
        content: content.trim(),
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    }
  }

  if (isLoading) {
    return (
      <div className="expert-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="dim">Loading…</span>
      </div>
    );
  }

  if (isError || !brain) {
    return (
      <div className="expert-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p className="dim">This link doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="expert-shell">
      <div className="expert-topbar">
        <span className="wordmark">
          <img src="/logo.png" className="brand-mark" alt="" />
          Company Brain
        </span>
      </div>

      <div className="expert-card">
        {submitted ? (
          <div className="thanks-state">
            <div className="thanks-icon">
              <Icon name="check" size={26} />
            </div>
            <div className="thanks-h">Thanks, {name}.</div>
            <div className="thanks-sub">
              Your update has been sent to <b>{brain.asker_name}</b>.<br />
              They'll review it and incorporate what's useful.
            </div>
          </div>
        ) : (
          <>
            <div className="hi">Share what you know.</div>
            <p className="intro">
              <b>{brain.asker_name}</b> is building an AI brain for{" "}
              <b>{brain.brain_name}</b>. Use this link anytime to push new
              knowledge — no account needed.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="q-label">Your name</div>
              <input
                className="answer-area"
                style={{ resize: "none", height: "auto", padding: "10px 14px" }}
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />

              <div className="q-label" style={{ marginTop: 16 }}>Your email <span className="dim">(optional)</span></div>
              <input
                className="answer-area"
                style={{ resize: "none", height: "auto", padding: "10px 14px" }}
                type="email"
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div className="q-label" style={{ marginTop: 16 }}>Topic / area <span className="dim">(optional)</span></div>
              <input
                className="answer-area"
                style={{ resize: "none", height: "auto", padding: "10px 14px" }}
                type="text"
                placeholder="e.g. escalation policy, SLA thresholds…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />

              <div className="q-label" style={{ marginTop: 16 }}>What do you want to add or correct?</div>
              <textarea
                className="answer-area"
                placeholder="Share anything: a correction, a nuance they missed, a recent change, a process you know better than anyone…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                required
              />

              {error && (
                <div style={{ color: "var(--bad)", fontSize: 12, marginTop: 8 }}>{error}</div>
              )}

              <div className="submit-row">
                <span className="hint">Goes directly to {brain.asker_name} for review.</span>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={submit.isPending || !name.trim() || !content.trim()}
                >
                  <Icon name="paperplane" size={13} />
                  {submit.isPending ? "Sending…" : "Send update"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <div className="expert-footer">
        This is a standing update link for <b style={{ color: "var(--text-2)" }}>{brain.brain_name}</b> via Company Brain.
      </div>
    </div>
  );
}
