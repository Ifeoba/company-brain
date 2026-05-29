import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useBrain, useBrainUpdates, useCollaborators, useDismissUpdate,
  useExpertQuestions, useExport, useGetUpdateLink, useInterview,
  useIntegrateUpdate, useMe, useReadiness,
} from "../api/hooks";
import AskExpertModal from "../components/AskExpertModal";
import Avatar from "../components/Avatar";
import FilePreview from "../components/FilePreview";
import Icon from "../components/Icon";
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
  const { data: brainUpdates = [] } = useBrainUpdates(slug!);
  const { data: user } = useMe();
  const exportBrain = useExport(slug!);
  const getUpdateLink = useGetUpdateLink(slug!);
  const integrateUpdate = useIntegrateUpdate(slug!);
  const dismissUpdate = useDismissUpdate(slug!);

  const [activeStep, setActiveStep] = useState(1);
  const [draftContent, setDraftContent] = useState<Record<string, string>>({});
  const [askExpertModal, setAskExpertModal] = useState<{ questionText: string; questionKey: string } | null>(null);
  const [toast, setToast] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);

  if (!brain || !interview) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <span className="dim">Loading…</span>
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
    <div className="ba-shell">
      <StepSidebar
        slug={slug!}
        brainName={brain.slug}
        interview={interview}
        readiness={readiness}
        activeStep={activeStep}
        onStepClick={setActiveStep}
      />

      <div className="ba-main">
        {/* Topbar */}
        <div className="ba-topbar">
          <span className="wordmark">
            <img src="/logo.png" className="brand-mark" alt="" />
            Company Brain
          </span>
          <span style={{ color: "var(--dimmer)" }}>/</span>
          <div className="crumb">
            <Link to="/">Brains</Link>
            <span className="sep">›</span>
            <span>{brain.name}</span>
          </div>
          <div className="spacer" />
          {answeredQuestions.length > 0 && (
            <button className="btn btn-sm btn-ghost text-accent" onClick={() => setShowAnswers(!showAnswers)}>
              {answeredQuestions.length} expert answer{answeredQuestions.length > 1 ? "s" : ""}
            </button>
          )}
          {brainUpdates.filter((u) => u.status === "pending").length > 0 && (
            <button className="btn btn-sm btn-ghost text-accent" onClick={() => setShowUpdates(!showUpdates)}>
              {brainUpdates.filter((u) => u.status === "pending").length} update{brainUpdates.filter((u) => u.status === "pending").length > 1 ? "s" : ""}
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setShowValidation(true)}>
            Readiness check
          </button>
          <button
            className="btn btn-sm"
            onClick={() => exportBrain.mutate()}
            disabled={exportBrain.isPending}
          >
            <Icon name="download" size={11} />
            {exportBrain.isPending ? "Exporting…" : "Export"}
          </button>
          {user && <Avatar name={user.github_username} />}
        </div>

        {/* Content */}
        <div className="ba-content">
          <div className="ba-section">
            {/* Knowledge updates panel */}
            {showUpdates && (
              <div className="ba-expert-panel">
                <div className="ba-expert-panel-head">
                  <span>Knowledge updates</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={async () => {
                        const link = await getUpdateLink.mutateAsync();
                        const url = `${window.location.origin}/update/${link.token}`;
                        navigator.clipboard.writeText(url);
                        showToast("Update link copied.");
                      }}
                      disabled={getUpdateLink.isPending}
                    >
                      <Icon name="copy" size={12} />
                      Copy share link
                    </button>
                    <button onClick={() => setShowUpdates(false)}>×</button>
                  </div>
                </div>
                {brainUpdates.filter((u) => u.status === "pending").length === 0 && (
                  <div style={{ padding: "16px", color: "var(--dim)", fontSize: 13 }}>
                    No pending updates. Share the link above to let experts push knowledge anytime.
                  </div>
                )}
                {brainUpdates.filter((u) => u.status === "pending").map((u) => (
                  <div key={u.id} className="ba-expert-item">
                    <div className="ba-expert-item-meta">
                      From {u.contributor_name}
                      {u.topic ? ` · ${u.topic}` : ""}
                      {u.contributor_email ? ` · ${u.contributor_email}` : ""}
                    </div>
                    <div className="ba-expert-item-text">{u.content}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => integrateUpdate.mutate(u.id)}
                        disabled={integrateUpdate.isPending}
                      >
                        {integrateUpdate.isPending ? "Integrating…" : "Integrate with Claude"}
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => dismissUpdate.mutate(u.id)}
                        disabled={dismissUpdate.isPending}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Expert answers panel */}
            {showAnswers && answeredQuestions.length > 0 && (
              <div className="ba-expert-panel">
                <div className="ba-expert-panel-head">
                  <span>Expert answers for this step</span>
                  <button onClick={() => setShowAnswers(false)}>×</button>
                </div>
                {answeredQuestions.map((q) => (
                  <div key={q.id} className="ba-expert-item">
                    <div className="ba-expert-item-meta">
                      From {q.collaborator_name} · {q.question_text}
                    </div>
                    <div className="ba-expert-item-text">{q.answer_text}</div>
                  </div>
                ))}
              </div>
            )}

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

            {primaryFile && (
              <>
                <FilePreview
                  slug={slug!}
                  filename={primaryFile}
                  draftContent={draftContent[primaryFile]}
                />
                {[...step.files, ...step.json_files].slice(1).map((f) => (
                  <FilePreview key={f} slug={slug!} filename={f} draftContent={draftContent[f]} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {toast && <div className="ba-toast">{toast}</div>}

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

      {showValidation && readiness && (
        <ValidationDrawer readiness={readiness} onClose={() => setShowValidation(false)} />
      )}
    </div>
  );
}
