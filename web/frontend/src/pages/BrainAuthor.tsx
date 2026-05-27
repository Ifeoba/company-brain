import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useBrain, useCollaborators, useExpertQuestions, useExport,
  useInterview, useReadiness,
} from "../api/hooks";
import AskExpertModal from "../components/AskExpertModal";
import FilePreview from "../components/FilePreview";
import QuestionPane from "../components/QuestionPane";
import StepSidebar from "../components/StepSidebar";
import ValidationDrawer from "../components/ValidationDrawer";

export default function BrainAuthor() {
  const { slug } = useParams<{ slug: string }>();
  const { data: brain } = useBrain(slug!);
  const { data: interview } = useInterview(slug!);
  const { data: readiness } = useReadiness(slug!);
  const { data: collaborators = [] } = useCollaborators(slug!);
  const { data: expertQuestions = [] } = useExpertQuestions(slug!);
  const exportBrain = useExport(slug!);

  const [activeStep, setActiveStep] = useState(1);
  const [draftContent, setDraftContent] = useState<Record<string, string>>({});
  const [askExpertModal, setAskExpertModal] = useState<{ questionText: string; questionKey: string } | null>(null);
  const [toast, setToast] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  if (!brain || !interview) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  const step = interview.steps.find((s) => s.number === activeStep) ?? interview.steps[0];
  const primaryFile = [...step.files, ...step.json_files][0];
  const answeredQuestions = expertQuestions.filter(
    (q) => q.step_number === activeStep && q.status === "answered"
  );

  function handleDraftReady(filename: string, content: string) {
    setDraftContent((prev) => ({ ...prev, [filename]: content }));
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden bg-white dark:bg-[#0f0f0f]">
      {/* Sidebar */}
      <StepSidebar
        slug={slug!}
        brainName={brain.slug}
        interview={interview}
        readiness={readiness}
        activeStep={activeStep}
        onStepClick={setActiveStep}
      />

      {/* Main pane */}
      <div className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-[#0f0f0f]/95 backdrop-blur-sm">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{brain.name}</h1>
          <div className="flex items-center gap-3">
            {answeredQuestions.length > 0 && (
              <button
                onClick={() => setShowAnswers(!showAnswers)}
                className="text-xs text-[#7cf29c] font-medium"
              >
                {answeredQuestions.length} expert answer{answeredQuestions.length > 1 ? "s" : ""}
              </button>
            )}
            <button
              onClick={() => setShowValidation(true)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Readiness check
            </button>
            <button
              onClick={() => exportBrain.mutate()}
              disabled={exportBrain.isPending}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50"
            >
              {exportBrain.isPending ? "Exporting…" : "Export ↓"}
            </button>
          </div>
        </div>

        <div className="px-6 py-6 max-w-3xl">
          {/* Expert answers panel */}
          {showAnswers && answeredQuestions.length > 0 && (
            <div className="mb-6 border border-[#7cf29c]/30 rounded-lg p-4 bg-[#7cf29c]/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Expert answers for this step
                </h3>
                <button onClick={() => setShowAnswers(false)} className="text-gray-400 text-sm">×</button>
              </div>
              {answeredQuestions.map((q) => (
                <div key={q.id} className="mb-3 last:mb-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    From {q.collaborator_name} · {q.question_text}
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded p-3">
                    {q.answer_text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Interview questions */}
          <QuestionPane
            slug={slug!}
            step={step}
            interview={interview}
            collaborators={collaborators}
            onDraftReady={handleDraftReady}
            onAskExpert={(questionText) => {
              const currentQ = step.questions[interview.current_question_index] ?? step.questions[0];
              setAskExpertModal({ questionText, questionKey: currentQ?.key ?? "" });
            }}
          />

          {/* File preview */}
          {primaryFile && (
            <div className="mt-6">
              <FilePreview
                slug={slug!}
                filename={primaryFile}
                draftContent={draftContent[primaryFile]}
              />
              {step.files.length + step.json_files.length > 1 &&
                [...step.files, ...step.json_files].slice(1).map((f) => (
                  <div key={f} className="mt-3">
                    <FilePreview slug={slug!} filename={f} draftContent={draftContent[f]} />
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-4 py-2.5 rounded shadow-lg">
          {toast}
        </div>
      )}

      {/* Ask Expert Modal */}
      {askExpertModal && (
        <AskExpertModal
          slug={slug!}
          step={activeStep}
          questionKey={askExpertModal.questionKey}
          questionText={askExpertModal.questionText}
          collaborators={collaborators}
          onClose={() => setAskExpertModal(null)}
          onSent={(name) => showToast(`Sent to ${name}.`)}
        />
      )}

      {/* Validation drawer */}
      {showValidation && readiness && (
        <ValidationDrawer readiness={readiness} onClose={() => setShowValidation(false)} />
      )}
    </div>
  );
}
