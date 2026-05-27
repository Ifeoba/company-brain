interface Props {
  score: number;
}

export default function ReadinessGauge({ score }: Props) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? "#7cf29c" : pct >= 50 ? "#f2c47c" : "#e5e5e5";

  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-3xl font-bold font-mono text-gray-900 dark:text-gray-100">{pct}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">/ 100 ready</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
