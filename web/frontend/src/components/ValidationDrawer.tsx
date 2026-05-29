import Icon from "./Icon";
import type { ReadinessOut } from "../types";

interface Props {
  readiness: ReadinessOut;
  onClose: () => void;
}

export default function ValidationDrawer({ readiness, onClose }: Props) {
  return (
    <div className="vd-scrim">
      <div className="vd-backdrop" onClick={onClose} />
      <aside className="vd-panel">
        <div className="vd-header">
          <h2>Readiness check</h2>
          <button className="vd-close" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="vd-score">
          <span className="big">{readiness.score}</span>
          <span className="small">/ 100</span>
        </div>

        <div>
          {readiness.files.map((f) => {
            const done = f.exists && f.placeholder_count === 0;
            return (
              <div key={f.filename} className="vd-file">
                <span className={`vd-file-icon${done ? "" : " empty"}`}>
                  {done ? "✓" : "○"}
                </span>
                <div>
                  <span className={`vd-file-name${f.exists ? "" : " empty"}`}>
                    {f.filename}
                  </span>
                  {f.placeholder_count > 0 && (
                    <span className="vd-file-warn">
                      {f.placeholder_count} placeholder{f.placeholder_count > 1 ? "s" : ""}
                    </span>
                  )}
                  {f.note && <div className="vd-file-note">{f.note}</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="vd-hint">
          <p>Use <strong>AI Review</strong> in the toolbar for a deeper look at content quality and gaps.</p>
        </div>
      </aside>
    </div>
  );
}
