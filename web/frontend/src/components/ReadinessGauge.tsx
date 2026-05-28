interface Props {
  score: number;
  fileCount?: number;
  totalFiles?: number;
}

export default function ReadinessGauge({ score, fileCount, totalFiles }: Props) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="gauge">
      <div className="gauge-num">
        <span className="big">{pct}</span>
        <span className="small">/ 100 ready</span>
      </div>
      <div className="gauge-bar">
        <div className="gauge-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {fileCount !== undefined && totalFiles !== undefined && (
        <div className="gauge-label">{fileCount} of {totalFiles} files complete</div>
      )}
    </div>
  );
}
