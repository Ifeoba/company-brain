import { useState } from "react";
import { useParams } from "react-router-dom";
import { usePublicQuestion, useSubmitAnswer } from "../api/hooks";

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
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  if (isError || !question) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <p className="text-gray-500 text-sm">This link has expired or doesn't exist.</p>
        </div>
      </div>
    );
  }

  const alreadyDone = (question.already_answered && !editMode) || submitted;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Simple header */}
      <div className="flex items-center px-6 py-4 border-b border-gray-100">
        <div className="w-6 h-6 bg-[#7cf29c] rounded mr-2" />
        <span className="text-sm text-gray-400">Company Brain</span>
      </div>

      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          {/* Greeting — serif-ish, friendly */}
          <p className="text-xl font-semibold text-gray-900 mb-1" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            Hi {question.recipient_name},
          </p>
          <p className="text-gray-500 mb-6 leading-relaxed" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            <strong className="text-gray-800">{question.asker_name}</strong> is building an AI brain for{" "}
            <strong className="text-gray-800">{question.brain_name}</strong> and wants your help with one question — because you're the person who knows this best.
          </p>

          {/* Context block */}
          {question.context_text && (
            <blockquote className="border-l-4 border-gray-200 pl-4 text-gray-500 text-sm mb-6 italic leading-relaxed">
              {question.context_text}
            </blockquote>
          )}

          {/* The question */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">The question</p>
            <p className="text-gray-900 text-base leading-relaxed">{question.question_text}</p>
          </div>

          {/* Response area */}
          {alreadyDone && !editMode ? (
            <div className="text-center py-8">
              {submitted ? (
                <>
                  <div className="text-3xl mb-3">✓</div>
                  <p className="text-gray-700 font-medium mb-1">Your answer has been sent.</p>
                  <p className="text-gray-400 text-sm">You can close this tab.</p>
                </>
              ) : (
                <>
                  <p className="text-gray-700 font-medium mb-2">You've already answered this.</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left text-sm text-gray-700 mb-4">
                    {question.existing_answer}
                  </div>
                  <button
                    onClick={() => { setEditMode(true); setAnswer(question.existing_answer ?? ""); }}
                    className="text-sm text-gray-500 underline"
                  >
                    Edit my answer
                  </button>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <textarea
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-900 text-sm leading-relaxed resize-none focus:outline-none focus:border-gray-400 transition-colors"
                style={{ minHeight: 160 }}
                placeholder="Type your answer here…"
                value={answer || (editMode ? question.existing_answer ?? "" : "")}
                onChange={(e) => setAnswer(e.target.value)}
                autoFocus
              />

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <div className="flex gap-3 items-center">
                <button
                  type="submit"
                  disabled={submitAnswer.isPending || !(answer || (editMode && question.existing_answer))}
                  className="bg-gray-900 text-white text-sm font-medium px-6 py-2.5 rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {submitAnswer.isPending ? "Sending…" : editMode ? "Update answer" : "Send answer"}
                </button>
                {editMode && (
                  <button type="button" onClick={() => setEditMode(false)} className="text-sm text-gray-400">
                    Cancel
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-400">
                No login required. Your answer goes back to {question.asker_name} and helps encode how the work actually happens.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
