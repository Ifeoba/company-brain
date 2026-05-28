import { useState } from "react";
import { useParams } from "react-router-dom";
import { usePublicQuestion, useSubmitAnswer } from "../api/hooks";
import Icon from "../components/Icon";

export default function ExpertAnswer() {
  const { token } = useParams<{ token: string }>();
  const { data: question, isLoading, isError } = usePublicQuestion(token!);
  const submitAnswer = useSubmitAnswer(token!);

  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    setError("");
    try {
      await submitAnswer.mutateAsync(answer.trim());
      setSubmitted(true);
      setEditMode(false);
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

  if (isError || !question) {
    return (
      <div className="expert-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p className="dim">This link has expired or doesn't exist.</p>
        </div>
      </div>
    );
  }

  const alreadyDone = (question.already_answered && !editMode) || submitted;

  return (
    <div className="expert-shell">
      <div className="expert-topbar">
        <span className="wordmark">
          <span className="brand-mark" />
          Company Brain
        </span>
      </div>

      <div className="expert-card">
        {submitted ? (
          <div className="thanks-state">
            <div className="thanks-icon">
              <Icon name="check" size={26} />
            </div>
            <div className="thanks-h">Thank you, {question.recipient_name}.</div>
            <div className="thanks-sub">
              Your answer has been sent to {question.asker_name}.<br />
              You can close this tab — or if you remembered something else,{" "}
              <a onClick={() => { setSubmitted(false); setEditMode(true); }}>
                edit your answer
              </a>.
            </div>
          </div>
        ) : alreadyDone ? (
          <>
            <div className="hi">Hi {question.recipient_name} — welcome back.</div>
            <p className="intro">
              You answered this question previously. Want to revise it, or add anything?
            </p>

            <div className="q-label">The question</div>
            <div className="q-text">{question.question_text}</div>

            <div className="micro" style={{ marginBottom: 8 }}>Your previous answer</div>
            <div className="prev-answer">{question.existing_answer}</div>

            <textarea
              className="answer-area"
              placeholder="Revise or add to your answer…"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />

            {error && <div style={{ color: "var(--bad)", fontSize: 12, marginTop: 8 }}>{error}</div>}

            <div className="submit-row">
              <span className="hint">Replaces your previous answer.</span>
              <button className="btn" onClick={() => setEditMode(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSubmit as unknown as React.MouseEventHandler}
                disabled={submitAnswer.isPending || !answer.trim()}
              >
                <Icon name="paperplane" size={13} />
                {submitAnswer.isPending ? "Updating…" : "Update answer"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="hi">Hi {question.recipient_name},</div>
            <p className="intro">
              <b>{question.asker_name}</b> is building an AI brain for{" "}
              <b>{question.brain_name}</b> and wants your help with one question — you're the
              person who knows this best.
            </p>

            {question.context_text && (
              <blockquote className="context-quote">{question.context_text}</blockquote>
            )}

            <div className="q-label">The question</div>
            <div className="q-text">{question.question_text}</div>

            <textarea
              className="answer-area"
              placeholder="Type your answer here. Plain English is perfect — no formatting required."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoFocus
            />

            {error && <div style={{ color: "var(--bad)", fontSize: 12, marginTop: 8 }}>{error}</div>}

            <div className="submit-row">
              <span className="hint">No login needed. Your answer goes straight back to {question.asker_name}.</span>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSubmit as unknown as React.MouseEventHandler}
                disabled={submitAnswer.isPending || !answer.trim()}
              >
                <Icon name="paperplane" size={13} />
                {submitAnswer.isPending ? "Sending…" : "Send answer"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="expert-footer">
        This question was sent to you by{" "}
        <b style={{ color: "var(--text-2)" }}>{question.asker_name}</b> via Company Brain.
      </div>
    </div>
  );
}
