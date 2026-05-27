import type { InterviewState, ReadinessOut } from "../types";
import ReadinessGauge from "./ReadinessGauge";
import CollaboratorAvatars from "./CollaboratorAvatars";

const STEP_LABELS = ["Service", "Knowledge", "Judgment", "Skills", "Guardrails", "Proof"];

interface Props {
  slug: string;
  brainName: string;
  interview: InterviewState;
  readiness: ReadinessOut | undefined;
  activeStep: number;
  onStepClick: (step: number) => void;
}

function stepStatus(stepNum: number, interview: InterviewState): "complete" | "active" | "idle" {
  const stepFiles = interview.steps.find((s) => s.number === stepNum);
  if (!stepFiles) return "idle";
  const answers = interview.answers[String(stepNum)];
  if (answers && Object.keys(answers).length >= stepFiles.questions.length) return "complete";
  if (stepNum === interview.current_step) return "active";
  return "idle";
}

export default function StepSidebar({ slug, brainName, interview, readiness, activeStep, onStepClick }: Props) {
  return (
    <aside className="w-[220px] shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full overflow-y-auto scrollbar-thin">
      {/* Brain name */}
      <div className="px-4 pt-5 pb-2">
        <span className="smallcaps font-mono text-gray-500 dark:text-gray-400 tracking-widest block truncate">
          {brainName.toUpperCase()}
        </span>
      </div>

      {/* Readiness gauge */}
      <ReadinessGauge score={readiness?.score ?? 0} />

      {/* Steps */}
      <div className="px-3 mt-1">
        <p className="smallcaps text-gray-400 dark:text-gray-600 px-1 mb-1">Steps</p>
        {interview.steps.map((step) => {
          const status = stepStatus(step.number, interview);
          const isActive = step.number === activeStep;
          return (
            <button
              key={step.number}
              onClick={() => onStepClick(step.number)}
              className={[
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
                isActive
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
              ].join(" ")}
            >
              <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                {status === "complete" ? (
                  <span className="text-[#7cf29c] text-sm">✓</span>
                ) : isActive ? (
                  <span className="text-blue-500 text-sm">›</span>
                ) : (
                  <span className="w-3 h-3 border border-gray-300 dark:border-gray-600 rounded-sm" />
                )}
              </span>
              <span className={status === "idle" && !isActive ? "text-gray-400 dark:text-gray-600" : ""}>
                {step.number}. {STEP_LABELS[step.number - 1]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Collaborators */}
      <div className="px-3 pb-4">
        <p className="smallcaps text-gray-400 dark:text-gray-600 px-1 mb-2">Collaborators</p>
        <CollaboratorAvatars slug={slug} />
      </div>
    </aside>
  );
}
