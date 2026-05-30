import { useState } from "react";
import {
  useBrainTools, useBuiltinTools, useWorkspaceTools,
  useCreateWorkspaceTool, useDeleteWorkspaceTool,
  useAttachTool, useDetachTool,
} from "../api/hooks";
import type { BuiltinTool, ToolOut } from "../types";

interface Props {
  slug: string;
  onClose: () => void;
  onOpenVault: () => void;
}

const RISK_LABEL: Record<string, string> = {
  safe:     "Runs automatically",
  confirm:  "Asks you first",
  escalate: "Flags for review",
};

const RISK_COLOR: Record<string, string> = {
  safe:     "var(--accent)",
  confirm:  "#f59e0b",
  escalate: "var(--bad)",
};

function RiskBadge({ risk }: { risk: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
      color: RISK_COLOR[risk] ?? "var(--dim)",
      background: "var(--panel-2)", border: "1px solid var(--border)",
      borderRadius: 3, padding: "1px 5px",
    }}>
      {RISK_LABEL[risk] ?? risk}
    </span>
  );
}

export default function ToolsModal({ slug, onClose, onOpenVault }: Props) {
  const { data: brainTools = [], isLoading: loadingBrain } = useBrainTools(slug);
  const { data: wsTools = [] } = useWorkspaceTools();
  const { data: builtins = [] } = useBuiltinTools();

  const createTool = useCreateWorkspaceTool();
  const deleteTool = useDeleteWorkspaceTool();
  const attachTool = useAttachTool(slug);
  const detachTool = useDetachTool(slug);

  const [tab, setTab] = useState<"brain" | "library" | "create">("brain");
  const [selectedBuiltin, setSelectedBuiltin] = useState<BuiltinTool | null>(null);
  const [customDesc, setCustomDesc] = useState("");
  const [customConfig, setCustomConfig] = useState("");
  const [configError, setConfigError] = useState("");
  const [error, setError] = useState("");

  const attachedIds = new Set(brainTools.map((t) => t.id));

  async function handleCreateAndAttach(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBuiltin) return;
    setError("");
    setConfigError("");

    let config: Record<string, unknown> = { ...selectedBuiltin.config_template };
    if (customConfig.trim()) {
      try {
        config = JSON.parse(customConfig);
      } catch {
        setConfigError("Check the settings — something doesn't look right.");
        return;
      }
    }

    try {
      const tool = await createTool.mutateAsync({
        name: selectedBuiltin.name,
        description: customDesc.trim() || selectedBuiltin.description,
        category: selectedBuiltin.category,
        risk: selectedBuiltin.risk,
        config,
      });
      await attachTool.mutateAsync(tool.id);
      setTab("brain");
      setSelectedBuiltin(null);
      setCustomDesc("");
      setCustomConfig("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card tools-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Actions</h2>
        <div className="modal-sub">
          Give this brain the ability to act — send a Slack message, fire off an email, or call an external service.{" "}
          <button
            type="button"
            className="btn-link"
            onClick={() => { onClose(); onOpenVault(); }}
          >
            Manage saved credentials →
          </button>
        </div>

        {/* Tab bar */}
        <div className="trigger-kind-tabs" style={{ marginBottom: 16 }}>
          {([
            ["brain",   "Enabled"],
            ["library", "Available"],
            ["create",  "Set up new"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={"btn" + (tab === key ? " btn-primary" : "")}
              onClick={() => { setTab(key); setError(""); }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Enabled tab */}
        {tab === "brain" && (
          <>
            {loadingBrain ? (
              <p className="dim" style={{ fontSize: 13 }}>Loading…</p>
            ) : brainTools.length === 0 ? (
              <p className="dim" style={{ fontSize: 13 }}>
                Nothing enabled yet. Pick from what's available or set up something new.
              </p>
            ) : (
              <div className="trigger-list">
                {brainTools.map((t: ToolOut) => (
                  <div key={t.id} className="trigger-row">
                    <div className="trigger-row-info">
                      <span className="trigger-row-name">{t.description || t.name}</span>
                    </div>
                    <RiskBadge risk={t.risk} />
                    <button
                      className="btn btn-sm btn-ghost btn-danger"
                      onClick={() => {
                        if (confirm(`Disable "${t.description || t.name}"?`)) detachTool.mutate(t.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Available tab */}
        {tab === "library" && (
          <>
            {wsTools.length === 0 ? (
              <p className="dim" style={{ fontSize: 13 }}>
                Nothing set up yet. Go to "Set up new" to add your first action.
              </p>
            ) : (
              <div className="trigger-list">
                {wsTools.map((t: ToolOut) => {
                  const enabled = attachedIds.has(t.id);
                  return (
                    <div key={t.id} className="trigger-row">
                      <div className="trigger-row-info">
                        <span className="trigger-row-name">{t.description || t.name}</span>
                      </div>
                      <RiskBadge risk={t.risk} />
                      {enabled ? (
                        <span className="trigger-kind-pill" style={{ color: "var(--accent)" }}>on</span>
                      ) : (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => attachTool.mutate(t.id)}
                          disabled={attachTool.isPending}
                        >
                          Enable
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-ghost btn-danger"
                        onClick={() => {
                          if (confirm(`Remove "${t.description || t.name}"?`)) deleteTool.mutate(t.id);
                        }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Set up new tab */}
        {tab === "create" && (
          <form onSubmit={handleCreateAndAttach}>
            <div className="modal-row">
              <span className="label">What do you want it to do?</span>
              <div className="trigger-list">
                {builtins.map((b: BuiltinTool) => (
                  <div
                    key={b.name}
                    className={"trigger-row" + (selectedBuiltin?.name === b.name ? " tool-selected" : "")}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setSelectedBuiltin(b);
                      setCustomConfig(JSON.stringify(b.config_template, null, 2));
                      setCustomDesc("");
                    }}
                  >
                    <div className="trigger-row-info">
                      <span className="trigger-row-name">{b.description}</span>
                    </div>
                    <RiskBadge risk={b.risk} />
                  </div>
                ))}
              </div>
            </div>

            {selectedBuiltin && (
              <>
                <div className="modal-row">
                  <span className="label">Short note (optional)</span>
                  <input
                    className="input"
                    placeholder="e.g. Alerts the on-call team in #incidents"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                  />
                </div>

                <div className="modal-row">
                  <span className="label">Settings</span>
                  <textarea
                    className={"textarea" + (configError ? " input-error" : "")}
                    value={customConfig}
                    onChange={(e) => { setCustomConfig(e.target.value); setConfigError(""); }}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 12, minHeight: 100 }}
                  />
                  {configError && <div className="error-msg">{configError}</div>}
                  <div className="hint" style={{ marginTop: 4, fontSize: 11.5 }}>
                    The credential name should match what you've saved under{" "}
                    <button type="button" className="btn-link" onClick={() => { onClose(); onOpenVault(); }}>
                      Credentials
                    </button>.
                  </div>
                </div>
              </>
            )}

            {error && <div className="error-msg">{error}</div>}

            <div className="footer-row">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!selectedBuiltin || createTool.isPending || attachTool.isPending}
              >
                {createTool.isPending || attachTool.isPending ? "Enabling…" : "Enable"}
              </button>
            </div>
          </form>
        )}

        {tab !== "create" && (
          <div className="footer-row">
            <button type="button" className="btn" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
