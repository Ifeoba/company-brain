import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAddRelationship, useBrain, useBrainRelationships, useBrainUpdates,
  useCollaborators, useDismissUpdate, useExpertQuestions, useExport,
  useGetUpdateLink, useInterview, useIntegrateUpdate, useMe, useReadiness,
  useRemoveRelationship, useSemanticReview, useSuggestions, useSyncEvals, useUnsyncedCount,
} from "../api/hooks";
import TriggersModal from "../components/TriggersModal";
import ToolsModal from "../components/ToolsModal";
import VaultModal from "../components/VaultModal";
import SuggestionsPanel from "../components/SuggestionsPanel";
import { useBrains } from "../api/hooks";
import AskExpertModal from "../components/AskExpertModal";
import Avatar from "../components/Avatar";
import FilePreview from "../components/FilePreview";
import Icon from "../components/Icon";
import QuestionPane from "../components/QuestionPane";
import SemanticReviewDrawer from "../components/SemanticReviewDrawer";
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
  const { data: relationships = [] } = useBrainRelationships(slug!);
  const { data: allBrains = [] } = useBrains();
  const { data: user } = useMe();
  const exportBrain = useExport(slug!);
  const getUpdateLink = useGetUpdateLink(slug!);
  const integrateUpdate = useIntegrateUpdate(slug!);
  const dismissUpdate = useDismissUpdate(slug!);
  const addRelationship = useAddRelationship(slug!);
  const removeRelationship = useRemoveRelationship(slug!);

  const semanticReview = useSemanticReview(slug!);
  const syncEvals = useSyncEvals(slug!);
  const { data: unsyncedData } = useUnsyncedCount(slug!);
  const unsyncedCount = unsyncedData?.count ?? 0;

  const [activeStep, setActiveStep] = useState(1);
  const [draftContent, setDraftContent] = useState<Record<string, string>>({});
  const [askExpertModal, setAskExpertModal] = useState<{ questionText: string; questionKey: string } | null>(null);
  const [toast, setToast] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [showSemanticReview, setShowSemanticReview] = useState(false);
  const [semanticReviewError, setSemanticReviewError] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [newRelTarget, setNewRelTarget] = useState("");
  const [newRelType, setNewRelType] = useState("depends-on");
  const [showTriggers, setShowTriggers] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: suggestions = [] } = useSuggestions(slug!);
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending").length;

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
          {unsyncedCount > 0 && (
            <button
              className="btn btn-sm btn-ghost text-accent"
              onClick={() => syncEvals.mutate(undefined, { onSuccess: (d) => showToast(`${d.synced_count} eval${d.synced_count !== 1 ? "s" : ""} synced to brain.`) })}
              disabled={syncEvals.isPending}
            >
              {syncEvals.isPending ? "Syncing…" : `Sync ${unsyncedCount} eval${unsyncedCount !== 1 ? "s" : ""}`}
            </button>
          )}
          {pendingSuggestions > 0 && (
            <button className="btn btn-sm btn-ghost text-accent" onClick={() => setShowSuggestions(true)}>
              {pendingSuggestions} suggestion{pendingSuggestions !== 1 ? "s" : ""}
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setShowTriggers(true)}>
            Triggers
          </button>
          <button className="btn btn-sm" onClick={() => setShowTools(true)}>
            Actions
          </button>
          <button className="btn btn-sm" onClick={() => setShowVault(true)}>
            Credentials
          </button>
          <Link to={`/brains/${slug}/run`} className="btn btn-sm btn-primary">
            <Icon name="spark" size={11} /> Run
          </Link>
          <button className="btn btn-sm" onClick={() => setShowValidation(true)}>
            How complete?
          </button>
          <button
            className="btn btn-sm"
            onClick={() => exportBrain.mutate(false)}
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
            {/* Connected brains panel */}
            {showConnections && (
              <div className="ba-expert-panel">
                <div className="ba-expert-panel-head">
                  <span>Linked topics</span>
                  <button onClick={() => setShowConnections(false)}>×</button>
                </div>
                {relationships.length === 0 && (
                  <div style={{ padding: "14px 16px", color: "var(--dim)", fontSize: 13 }}>
                    No links yet. Link this brain to others to show how they relate on the map.
                  </div>
                )}
                {relationships.map((rel) => (
                  <div key={rel.id} className="ba-expert-item">
                    <div className="ba-expert-item-meta">
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{rel.rel_type}</span>
                      {" → "}
                      <b>{rel.to_name}</b>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <Link to={`/brains/${rel.to_slug}`} className="btn btn-sm btn-ghost">
                        Open
                      </Link>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => removeRelationship.mutate(rel.id)}
                        disabled={removeRelationship.isPending}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--hairline)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    className="input"
                    style={{ fontSize: 12, padding: "4px 8px", flex: 1, minWidth: 120 }}
                    value={newRelTarget}
                    onChange={(e) => setNewRelTarget(e.target.value)}
                  >
                    <option value="">Select brain…</option>
                    {allBrains.filter((b) => b.slug !== slug).map((b) => (
                      <option key={b.slug} value={b.slug}>{b.name}</option>
                    ))}
                  </select>
                  <select
                    className="input"
                    style={{ fontSize: 12, padding: "4px 8px" }}
                    value={newRelType}
                    onChange={(e) => setNewRelType(e.target.value)}
                  >
                    <option value="depends-on">Depends on</option>
                    <option value="uses">Uses</option>
                    <option value="related-to">Related to</option>
                    <option value="feeds-into">Feeds into</option>
                  </select>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      if (!newRelTarget) return;
                      addRelationship.mutate(
                        { to_slug: newRelTarget, rel_type: newRelType },
                        { onSuccess: () => setNewRelTarget("") },
                      );
                    }}
                    disabled={!newRelTarget || addRelationship.isPending}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Knowledge updates panel */}
            {showUpdates && (
              <div className="ba-expert-panel">
                <div className="ba-expert-panel-head">
                  <span>Contributions</span>
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
                    Nothing waiting. Share the link above so anyone can add their knowledge anytime.
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
                        {integrateUpdate.isPending ? "Adding to brain…" : "Add to brain"}
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

      {showSemanticReview && (
        <SemanticReviewDrawer
          slug={slug!}
          onClose={() => setShowSemanticReview(false)}
          onRun={() => {
            setSemanticReviewError("");
            semanticReview.mutate(undefined, {
              onError: (err: unknown) =>
                setSemanticReviewError(err instanceof Error ? err.message : "Review failed. Try again."),
            });
          }}
          isPending={semanticReview.isPending}
          result={semanticReview.data ?? null}
          error={semanticReviewError}
        />
      )}

      {showTriggers && (
        <TriggersModal slug={slug!} onClose={() => setShowTriggers(false)} />
      )}

      {showTools && (
        <ToolsModal
          slug={slug!}
          onClose={() => setShowTools(false)}
          onOpenVault={() => setShowVault(true)}
        />
      )}

      {showVault && (
        <VaultModal onClose={() => setShowVault(false)} />
      )}
      {showSuggestions && (
        <SuggestionsPanel slug={slug!} onClose={() => setShowSuggestions(false)} />
      )}
    </div>
  );
}
