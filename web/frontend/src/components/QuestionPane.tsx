import { useEffect, useRef, useState } from "react";
import type { Collaborator, InterviewState, Step } from "../types";
import { useGenerate, useSaveAnswer, useUpdateProgress } from "../api/hooks";

interface Props {
  slug: string;
  step: Step;
  interview: InterviewState;
  collaborators: Collaborator[];
  onDraftReady: (filename: string, content: string) => void;
  onAskExpert: (questionText: string) => void;
}

function SavedIndicator({ lastSaved }: { lastSaved: Date | null }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!lastSaved) return;
    const update = () => {
      const secs = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      if (secs < 5) setLabel("Saved");
      else if (secs < 60) setLabel(`Saved ${secs}s ago`);
      else setLabel(`Saved ${Math.floor(secs / 60)}m ago`);
    };
    update();
    const t = setInterval(update, 5000);
    return () => clearInterval(t);
  }, [lastSaved]);

  if (!lastSaved) return null;
  return <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>;
}

export default function QuestionPane({ slug, step, interview, collaborators, onDraftReady, onAskExpert }: Props) {
  const totalQ = step.questions.length;
  const qIndex = interview.current_step === step.number ? interview.current_question_index : 0;
  const [localQIndex, setLocalQIndex] = useState(qIndex);
  const question = step.questions[localQIndex] ?? step.questions[0];

  const savedAnswers = interview.answers[String(step.number)] ?? {};
  const [answer, setAnswer] = useState(savedAnswers[question?.key] ?? "");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draftError, setDraftError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const saveAnswer = useSaveAnswer(slug);
  const updateProgress = useUpdateProgress(slug);
  const generate = useGenerate(slug);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.max(90, el.scrollHeight)}px`;
    }
  }, [answer]);

  // Load saved answer when question changes
  useEffect(() => {
    const saved = interview.answers[String(step.number)]?.[question?.key] ?? "";
    setAnswer(saved);
    setDraftError("");
  }, [question?.key, step.number, interview.answers]);

  // Debounced autosave
  useEffect(() => {
    if (!question) return;
    const t = setTimeout(async () => {
      if (answer !== (interview.answers[String(step.number)]?.[question.key] ?? "")) {
        await saveAnswer.mutateAsync({ step: step.number, question_key: question.key, answer_text: answer });
        setLastSaved(new Date());
      }
    }, 800);
    return () => clearTimeout(t);
  }, [answer]);

  function goTo(idx: number) {
    const clamped = Math.max(0, Math.min(totalQ - 1, idx));
    setLocalQIndex(clamped);
    updateProgress.mutate({ current_step: step.number, current_question_index: clamped });
  }

  async function handleDraft() {
    setDraftError("");
    const allFiles = [...step.files, ...step.json_files];
    for (const filename of allFiles) {
      try {
        const result = await generate.mutateAsync({ step: step.number, filename });
        onDraftReady(filename, result.content);
      } catch (err: unknown) {
        setDraftError(err instanceof Error ? err.message : "Generation failed");
        return;
      }
    }
  }

  const primaryCollab = collaborators[0];

  return (
    <div className="flex flex-col gap-5">
      {/* Step header */}
      <div className="flex items-center justify-between">
        <span className="smallcaps text-gray-400 dark:text-gray-500">
          Step {step.number} — {step.name}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Question {localQIndex + 1} of {totalQ}
        </span>
      </div>

      {/* Question */}
      {question && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line leading-relaxed mb-3">
            {question.text}
          </p>
          <textarea
            ref={textareaRef}
            className="w-full border border-gray-200 dark:border-gray-700 rounded px-3 py-2.5 text-sm bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors"
            style={{ minHeight: 90 }}
            placeholder="Type your answer here…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleDraft}
          disabled={generate.isPending}
          className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-4 py-2 rounded font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {generate.isPending ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Drafting…
            </>
          ) : (
            "Draft from answer"
          )}
        </button>

        <button
          onClick={() => onAskExpert(question?.text ?? "")}
          className="text-sm px-4 py-2 rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Ask {primaryCollab?.name.split(" ")[0] ?? "someone"}
        </button>

        <div className="flex-1" />
        <SavedIndicator lastSaved={lastSaved} />
      </div>

      {draftError && (
        <p className="text-red-500 text-xs bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded">
          {draftError}
        </p>
      )}

      {/* Question navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => goTo(localQIndex - 1)}
          disabled={localQIndex === 0}
          className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
        >
          ← Previous question
        </button>
        <button
          onClick={() => goTo(localQIndex + 1)}
          disabled={localQIndex >= totalQ - 1}
          className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
        >
          Next question →
        </button>
      </div>
    </div>
  );
}
