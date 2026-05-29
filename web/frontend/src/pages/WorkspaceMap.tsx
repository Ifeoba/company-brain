import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import { useConfirmSuggestion, useDiscoverRelationships, useWorkspaceMap } from "../api/hooks";
import AppTopbar from "../components/Layout";
import Icon from "../components/Icon";
import type { RelationshipSuggestion } from "../types";

const LAYOUT = {
  name: "cose",
  animate: true,
  animationDuration: 500,
  fit: true,
  padding: 60,
  nodeRepulsion: 8000,
  idealEdgeLength: 180,
  edgeElasticity: 0.45,
  gravity: 0.3,
  numIter: 1000,
  randomize: false,
};

const STYLESHEET = [
  {
    selector: "node",
    style: {
      "background-color": "#ffffff",
      "border-width": 2,
      "border-color": "#e8e6e0",
      "label": "data(label)",
      "font-family": "Inter, -apple-system, sans-serif",
      "font-size": "12px",
      "font-weight": "500",
      "color": "#1a1a1a",
      "text-valign": "center",
      "text-halign": "center",
      "width": 150,
      "height": 62,
      "shape": "roundrectangle",
      "text-wrap": "wrap",
      "text-max-width": "130px",
      "cursor": "pointer",
    },
  },
  {
    selector: "node[status = 'ready']",
    style: {
      "border-color": "#2d8a4e",
      "border-width": 2.5,
    },
  },
  {
    selector: "node:hover",
    style: {
      "background-color": "#f7f6f2",
      "border-color": "#2d8a4e",
      "border-width": 2.5,
    },
  },
  {
    selector: "node:selected",
    style: {
      "background-color": "#f0faf1",
      "border-color": "#2d8a4e",
      "border-width": 3,
    },
  },
  {
    selector: "edge",
    style: {
      "width": 1.5,
      "line-color": "#c0bfba",
      "target-arrow-color": "#c0bfba",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "label": "data(rel_type)",
      "font-size": "10px",
      "font-family": "IBM Plex Mono, monospace",
      "color": "#9a9a96",
      "text-rotation": "autorotate",
      "text-margin-y": -8,
      "text-background-color": "#fafaf8",
      "text-background-opacity": 0.85,
      "text-background-padding": "2px",
    },
  },
  {
    selector: "edge[rel_type = 'depends-on']",
    style: { "line-color": "#c93030", "target-arrow-color": "#c93030", "color": "#c93030" },
  },
  {
    selector: "edge[rel_type = 'uses']",
    style: { "line-color": "#2563d9", "target-arrow-color": "#2563d9", "color": "#2563d9" },
  },
  {
    selector: "edge[rel_type = 'feeds-into']",
    style: { "line-color": "#7c47d6", "target-arrow-color": "#7c47d6", "color": "#7c47d6" },
  },
];

export default function WorkspaceMap() {
  const { data: nodes = [], isLoading } = useWorkspaceMap();
  const discover = useDiscoverRelationships();
  const confirmSuggestion = useConfirmSuggestion();
  const [suggestions, setSuggestions] = useState<RelationshipSuggestion[]>([]);
  const navigate = useNavigate();

  async function handleDiscover() {
    const found = await discover.mutateAsync();
    setSuggestions(found.length ? found : []);
    if (!found.length) alert("No new relationships found — add more content to your brains first.");
  }

  function dismissSuggestion(idx: number) {
    setSuggestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleConfirm(s: RelationshipSuggestion, idx: number) {
    await confirmSuggestion.mutateAsync({
      from_slug: s.from_slug,
      to_slug: s.to_slug,
      rel_type: s.rel_type,
    });
    dismissSuggestion(idx);
  }

  const elements = [
    ...nodes.map((n) => ({
      data: {
        id: n.slug,
        label: `${n.name}\n${n.readiness_score}/100`,
        status: n.status,
      },
    })),
    ...nodes.flatMap((n) =>
      n.relationships.map((r) => ({
        data: {
          id: r.id,
          source: r.from_slug,
          target: r.to_slug,
          rel_type: r.rel_type,
        },
      }))
    ),
  ];

  return (
    <div className="bl-shell">
      <AppTopbar />

      {!isLoading && nodes.length >= 2 && (
        <div className="wm-toolbar">
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleDiscover}
            disabled={discover.isPending}
          >
            <Icon name="spark" size={12} />
            {discover.isPending ? "Scanning…" : "Discover connections"}
          </button>
          <span className="dim" style={{ fontSize: 12 }}>
            Claude reads your brain content and suggests how they relate.
          </span>
          <div className="spacer" />
          <div className="wm-legend">
            {[
              { label: "depends-on", color: "#c93030" },
              { label: "uses", color: "#2563d9" },
              { label: "feeds-into", color: "#7c47d6" },
              { label: "related-to", color: "#9a9a96" },
            ].map(({ label, color }) => (
              <span key={label} className="wm-legend-item">
                <span style={{ width: 18, height: 2, background: color, display: "inline-block", verticalAlign: "middle", borderRadius: 1 }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="wm-suggestions">
          <div className="wm-suggestions-head">
            <span>
              {suggestions.length} suggested connection{suggestions.length > 1 ? "s" : ""}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setSuggestions([])}>
              Clear all
            </button>
          </div>
          {suggestions.map((s, i) => (
            <div key={i} className="wm-suggestion-item">
              <div className="wm-suggestion-names">
                <b>{s.from_name}</b>
                <span className="wm-suggestion-rel">{s.rel_type}</span>
                <b>{s.to_name}</b>
              </div>
              <div className="wm-suggestion-reason">{s.reason}</div>
              <div className="wm-suggestion-actions">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleConfirm(s, i)}
                  disabled={confirmSuggestion.isPending}
                >
                  Add connection
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => dismissSuggestion(i)}>
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="wm-cyto-container">
        {isLoading ? null : nodes.length === 0 ? (
          <div className="wm-empty">
            <p>No brains yet.</p>
            <Link to="/" className="btn btn-primary">← Back to brains</Link>
          </div>
        ) : (
          <CytoscapeComponent
            key={elements.length}
            elements={elements}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stylesheet={STYLESHEET as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            layout={LAYOUT as any}
            style={{ width: "100%", height: "100%" }}
            cy={(cy: cytoscape.Core) => {
              cy.on("tap", "node", (evt: cytoscape.EventObject) => {
                navigate(`/brains/${evt.target.id()}`);
              });
              cy.on("mouseover", "node", () => {
                (cy.container() as HTMLElement).style.cursor = "pointer";
              });
              cy.on("mouseout", "node", () => {
                (cy.container() as HTMLElement).style.cursor = "default";
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
