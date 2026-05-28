import { useEffect, useRef, useState } from "react";
import type { Collaborator, InterviewState, Step } from "../types";
import { useGenerate, useSaveAnswer, useUpdateProgress } from "../api/hooks";
import Icon from "./Icon";

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
  return (
    <span className="ba-save-state">
      <span className="dot" style={{ background: "var(--accent)" }} />
      {label}
    </span>
  );
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

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.max(130, el.scrollHeight)}px`;
    }
  }, [answer]);

  useEffect(() => {
    const saved = interview.answers[String(step.number)]?.[question?.key] ?? "";
    setAnswer(saved);
    setDraftError("");
  }, [question?.key, step.number, interview.answers]);

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
    <div>
      <div className="ba-step-head">
        <div className="left">
          <span className="micro">Step 0{step.number} — {step.name}</span>
          <h1>{question?.text ?? "—"}</h1>
        </div>
        <span className="micro">Question {localQIndex + 1} of {totalQ}</span>
      </div>

      {question && (
        <div className="ba-q">
          <textarea
            ref={textareaRef}
            className="textarea"
            style={{ minHeight: 130 }}
            placeholder="Type your answer here. Plain English is perfect — no formatting required."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </div>
      )}

      <div className="ba-actions">
        <button
          className="btn btn-primary"
          onClick={handleDraft}
          disabled={generate.isPending}
        >
          {generate.isPending ? (
            <>
              <svg className="spin" width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" strokeDasharray="20" strokeDashoffset="5" />
              </svg>
              Drafting…
            </>
          ) : (
            <>
              <Icon name="spark" size={13} /> Draft from answer
            </>
          )}
        </button>

        <button
          className="btn"
          onClick={() => onAskExpert(question?.text ?? "")}
        >
          <Icon name="paperplane" size={13} />
          Ask {primaryCollab?.name.split(" ")[0] ?? "someone"}
        </button>

        <div className="spacer" />
        <SavedIndicator lastSaved={lastSaved} />
      </div>

      {draftError && (
        <div className="ba-draft-error">{draftError}</div>
      )}

      <div className="ba-nav">
        <button
          className="btn btn-ghost"
          onClick={() => goTo(localQIndex - 1)}
          disabled={localQIndex === 0}
        >
          <Icon name="arrow_left" size={12} /> Previous question
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => goTo(localQIndex + 1)}
          disabled={localQIndex >= totalQ - 1}
        >
          Next question <Icon name="arrow_right" size={12} />
        </button>
      </div>
    </div>
  );
}
