import type { InterviewState, ReadinessOut } from "../types";
import ReadinessGauge from "./ReadinessGauge";
import CollaboratorAvatars from "./CollaboratorAvatars";
import Icon from "./Icon";

interface Props {
  slug: string;
  brainName: string;
  interview: InterviewState;
  readiness: ReadinessOut | undefined;
  activeStep: number;
  onStepClick: (step: number) => void;
}

function stepStatus(stepNum: number, interview: InterviewState): "done" | "current" | "not-touched" {
  const stepData = interview.steps.find((s) => s.number === stepNum);
  if (!stepData) return "not-touched";
  const answers = interview.answers[String(stepNum)];
  if (answers && Object.keys(answers).length >= stepData.questions.length) return "done";
  if (stepNum === interview.current_step) return "current";
  return "not-touched";
}

export default function StepSidebar({ slug, brainName, interview, readiness, activeStep, onStepClick }: Props) {
  const doneCount = interview.steps.filter((s) => stepStatus(s.number, interview) === "done").length;

  return (
    <aside className="ba-side">
      <div className="top">
        <span className="micro">Authoring</span>
        <span className="brain-slug">{brainName}</span>
      </div>

      <ReadinessGauge
        score={readiness?.score ?? 0}
        fileCount={doneCount}
        totalFiles={interview.steps.length}
      />

      <div className="section-label">Steps</div>
      <div className="ba-steps">
        {interview.steps.map((s) => {
          const status = s.number === activeStep
            ? "current"
            : stepStatus(s.number, interview);
          return (
            <button
              key={s.number}
              className={`ba-step ${status}`}
              onClick={() => onStepClick(s.number)}
            >
              <div className="ba-step-mark">
                {status === "done" && <Icon name="check" size={10} />}
                {status === "current" && <Icon name="chevron_right" size={10} />}
              </div>
              <div className="ba-step-label">
                <span className="n">0{s.number}</span>
                <span>{s.name}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="ba-collab">
        <div className="section-label">Collaborators</div>
        <CollaboratorAvatars slug={slug} />
      </div>
    </aside>
  );
}
