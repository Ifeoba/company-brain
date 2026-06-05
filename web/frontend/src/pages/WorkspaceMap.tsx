import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReactFlow, {
  Background, Controls, EdgeLabelRenderer, Handle, MarkerType,
  Position, useEdgesState, useNodesState, useReactFlow,
} from "reactflow";
import type { Connection, Edge, EdgeMouseHandler, EdgeProps, NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import { useConfirmSuggestion, useDiscoverRelationships, useRemoveRelationship, useWorkspaceMap } from "../api/hooks";
import AppTopbar from "../components/Layout";
import Icon from "../components/Icon";
import type { RelationshipSuggestion } from "../types";

const REL_COLORS: Record<string, string> = {
  "depends-on": "#c93030",
  "uses": "#2563d9",
  "related-to": "#757572",
  "feeds-into": "#7c47d6",
};

function edgeStyle(relType: string) {
  const color = REL_COLORS[relType] ?? "#c0bfba";
  return {
    style: { stroke: color, strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color },
    label: relType,
  };
}

function AdjustableEdge({ id, sourceX, sourceY, targetX, targetY, style, markerEnd, label, data, selected }: EdgeProps) {
  const { screenToFlowPosition, setEdges } = useReactFlow();
  const [hovered, setHovered] = useState(false);

  const bx: number = data?.bendX ?? (sourceX + targetX) / 2;
  const by: number = data?.bendY ?? (sourceY + targetY) / 2;
  // Control point so the quadratic bezier actually passes through (bx, by) at t=0.5
  const cx = 2 * bx - 0.5 * sourceX - 0.5 * targetX;
  const cy = 2 * by - 0.5 * sourceY - 0.5 * targetY;
  const edgePath = `M${sourceX},${sourceY} Q${cx},${cy} ${targetX},${targetY}`;
  const strokeColor = (style as React.CSSProperties | undefined)?.stroke ?? "#c0bfba";
  const showHandle = selected || hovered;

  const onBendMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const move = (me: MouseEvent) => {
      const pos = screenToFlowPosition({ x: me.clientX, y: me.clientY });
      setEdges((eds) => eds.map((ed) =>
        ed.id === id ? { ...ed, data: { ...ed.data, bendX: pos.x, bendY: pos.y } } : ed
      ));
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  return (
    <>
      <path
        d={edgePath}
        className="react-flow__edge-path"
        style={style}
        markerEnd={markerEnd as string}
        fill="none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {/* wider invisible hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${bx}px, ${by - 16}px)`,
            pointerEvents: "none",
            fontSize: 10,
            fontFamily: "IBM Plex Mono, monospace",
            color: strokeColor,
            background: "rgba(250,250,248,0.9)",
            padding: "1px 5px",
            borderRadius: 3,
          }}
        >
          {label as React.ReactNode}
        </div>
        {showHandle && (
          <div
            className="nodrag nopan wm-edge-bend"
            style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${bx}px, ${by}px)` }}
            onMouseDown={onBendMouseDown}
          />
        )}
      </EdgeLabelRenderer>
    </>
  );
}

function BrainNode({ data }: NodeProps) {
  const scoreColor =
    data.score >= 80 ? "#2d8a4e" : data.score >= 50 ? "#b27800" : "#c93030";
  return (
    <div className="wm-rnode">
      <Handle type="target" position={Position.Left} id="l" className="wm-handle" />
      <Handle type="target" position={Position.Top} id="t" className="wm-handle" />
      <Handle type="source" position={Position.Right} id="r" className="wm-handle" />
      <Handle type="source" position={Position.Bottom} id="b" className="wm-handle" />
      <div className="wm-rnode-name">{data.name}</div>
      <div className="wm-rnode-score" style={{ color: scoreColor }}>
        {data.score}<span style={{ color: "#9a9a96", fontWeight: 400 }}>/100</span>
      </div>
    </div>
  );
}

const nodeTypes = { brainNode: BrainNode };
const edgeTypes = { adjustable: AdjustableEdge };

function loadPositions(): Record<string, { x: number; y: number }> {
  try { return JSON.parse(localStorage.getItem("wm-positions") ?? "{}"); }
  catch { return {}; }
}
function savePositions(p: Record<string, { x: number; y: number }>) {
  localStorage.setItem("wm-positions", JSON.stringify(p));
}

function circLayout(count: number) {
  const cx = 480, cy = 320;
  if (count === 0) return [];
  if (count === 1) return [{ x: cx, y: cy }];
  const r = Math.min(260, 100 + count * 28);
  return Array.from({ length: count }, (_, i) => {
    const a = (2 * Math.PI * i / count) - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

export default function WorkspaceMap() {
  const { data: mapData = [], isLoading } = useWorkspaceMap();
  const discover = useDiscoverRelationships();
  const confirmMut = useConfirmSuggestion();

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  const [suggestions, setSuggestions] = useState<RelationshipSuggestion[]>([]);
  const [pending, setPending] = useState<{ source: string; target: string } | null>(null);
  const [connType, setConnType] = useState("depends-on");
  const [connError, setConnError] = useState("");
  const [selectedEdge, setSelectedEdge] = useState<{ id: string; source: string; target: string; relType: string } | null>(null);
  const [editType, setEditType] = useState("depends-on");
  const [editError, setEditError] = useState("");
  const removeMut = useRemoveRelationship(selectedEdge?.source ?? "");

  useEffect(() => {
    const saved = loadPositions();
    const circ = circLayout(mapData.length);
    setRfNodes((prev) => {
      const prevPos = Object.fromEntries(prev.map((n) => [n.id, n.position]));
      return mapData.map((n, i) => ({
        id: n.slug,
        type: "brainNode",
        position: prevPos[n.slug] ?? saved[n.slug] ?? circ[i] ?? { x: 0, y: 0 },
        data: { name: n.name, score: n.readiness_score, status: n.status },
      }));
    });
    setRfEdges((prev) => {
      // Preserve any bend points the user has dragged
      const bendMap = Object.fromEntries(prev.map((e) => [e.id, { bendX: e.data?.bendX, bendY: e.data?.bendY }]));
      return mapData.flatMap((n) =>
        n.relationships.map((r) => ({
          id: r.id,
          source: r.from_slug,
          target: r.to_slug,
          type: "adjustable",
          data: { relType: r.rel_type, ...bendMap[r.id] },
          ...edgeStyle(r.rel_type),
        }))
      );
    });
  }, [mapData]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
    const saved = loadPositions();
    saved[node.id] = node.position;
    savePositions(saved);
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    if (conn.source && conn.target && conn.source !== conn.target) {
      setPending({ source: conn.source, target: conn.target });
      setConnError("");
    }
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_: React.MouseEvent, edge: Edge) => {
    const relType = edge.data?.relType ?? "related-to";
    setSelectedEdge({ id: edge.id, source: edge.source, target: edge.target, relType });
    setEditType(relType);
    setEditError("");
  }, []);

  async function handleDiscover() {
    const found = await discover.mutateAsync();
    setSuggestions(found);
    if (!found.length) alert("No connections found yet. Try adding more content to your brains first, then scan again.");
  }

  async function handleConfirmSuggestion(s: RelationshipSuggestion, idx: number) {
    await confirmMut.mutateAsync({ from_slug: s.from_slug, to_slug: s.to_slug, rel_type: s.rel_type });
    setSuggestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleConfirmConn() {
    if (!pending) return;
    setConnError("");
    try {
      await confirmMut.mutateAsync({ from_slug: pending.source, to_slug: pending.target, rel_type: connType });
      setPending(null);
    } catch (e: unknown) {
      setConnError(e instanceof Error ? e.message : "Failed to add connection");
    }
  }

  async function handleEditSave() {
    if (!selectedEdge) return;
    setEditError("");
    try {
      await removeMut.mutateAsync(selectedEdge.id);
      await confirmMut.mutateAsync({ from_slug: selectedEdge.source, to_slug: selectedEdge.target, rel_type: editType });
      setSelectedEdge(null);
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update connection");
    }
  }

  async function handleEditDelete() {
    if (!selectedEdge) return;
    setEditError("");
    try {
      await removeMut.mutateAsync(selectedEdge.id);
      setSelectedEdge(null);
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to delete connection");
    }
  }

  const fromName = mapData.find((n) => n.slug === pending?.source)?.name ?? "";
  const toName = mapData.find((n) => n.slug === pending?.target)?.name ?? "";
  const editFromName = mapData.find((n) => n.slug === selectedEdge?.source)?.name ?? selectedEdge?.source ?? "";
  const editToName = mapData.find((n) => n.slug === selectedEdge?.target)?.name ?? selectedEdge?.target ?? "";

  return (
    <div className="bl-shell">
      <AppTopbar />

      {!isLoading && mapData.length >= 2 && (
        <div className="wm-toolbar">
          <button className="btn btn-sm btn-ghost" onClick={handleDiscover} disabled={discover.isPending}>
            <Icon name="spark" size={12} />
            {discover.isPending ? "Scanning…" : "Discover connections"}
          </button>
          <span className="dim" style={{ fontSize: 12 }}>
            Hover a topic to see connection handles · drag to link two topics · click a line to edit or delete it.
          </span>
          <div className="spacer" />
          <div className="wm-legend">
            {Object.entries(REL_COLORS).map(([label, color]) => (
              <span key={label} className="wm-legend-item">
                <span style={{ width: 16, height: 2, background: color, display: "inline-block", verticalAlign: "middle", borderRadius: 1 }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="wm-suggestions">
          <div className="wm-suggestions-head">
            <span>{suggestions.length} suggested connection{suggestions.length > 1 ? "s" : ""}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setSuggestions([])}>Clear all</button>
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
                <button className="btn btn-sm btn-primary" onClick={() => handleConfirmSuggestion(s, i)} disabled={confirmMut.isPending}>
                  Add connection
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setSuggestions((p) => p.filter((_, j) => j !== i))}>
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="wm-rf-container">
        {isLoading ? null : mapData.length === 0 ? (
          <div className="wm-empty">
            <p>No brains yet.</p>
            <Link to="/" className="btn btn-primary">← Back to brains</Link>
          </div>
        ) : (
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            connectionRadius={28}
            deleteKeyCode={null}
          >
            <Background gap={24} size={1} color="#e8e6e0" />
            <Controls showInteractive={false} style={{ bottom: 16, right: 16, left: "unset", top: "unset" }} />
          </ReactFlow>
        )}
      </div>

      {selectedEdge && (
        <div className="wm-conn-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedEdge(null)}>
          <div className="wm-conn-popup">
            <div className="wm-conn-title">Edit this connection</div>
            <div className="wm-conn-names">
              <b>{editFromName}</b>
              <span style={{ color: "var(--dimmer)", margin: "0 8px" }}>→</span>
              <b>{editToName}</b>
            </div>
            <div className="wm-conn-options">
              {Object.entries(REL_COLORS).map(([type, color]) => (
                <button
                  key={type}
                  className={`wm-conn-option${editType === type ? " selected" : ""}`}
                  style={editType === type ? { borderColor: color, color } : {}}
                  onClick={() => setEditType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
            {editError && <div style={{ color: "var(--bad)", fontSize: 12, marginBottom: 8 }}>{editError}</div>}
            <div className="wm-conn-actions">
              <button className="btn btn-ghost btn-danger" onClick={handleEditDelete} disabled={removeMut.isPending || confirmMut.isPending}>
                Delete
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={() => setSelectedEdge(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={removeMut.isPending || confirmMut.isPending || editType === selectedEdge.relType}>
                {removeMut.isPending || confirmMut.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <div className="wm-conn-overlay" onClick={(e) => e.target === e.currentTarget && setPending(null)}>
          <div className="wm-conn-popup">
            <div className="wm-conn-title">How are these topics related?</div>
            <div className="wm-conn-names">
              <b>{fromName}</b>
              <span style={{ color: "var(--dimmer)", margin: "0 8px" }}>→</span>
              <b>{toName}</b>
            </div>
            <div className="wm-conn-options">
              {Object.entries(REL_COLORS).map(([type, color]) => (
                <button
                  key={type}
                  className={`wm-conn-option${connType === type ? " selected" : ""}`}
                  style={connType === type ? { borderColor: color, color } : {}}
                  onClick={() => setConnType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
            {connError && <div style={{ color: "var(--bad)", fontSize: 12, marginBottom: 8 }}>{connError}</div>}
            <div className="wm-conn-actions">
              <button className="btn btn-ghost" onClick={() => setPending(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmConn} disabled={confirmMut.isPending}>
                {confirmMut.isPending ? "Adding…" : "Add connection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
