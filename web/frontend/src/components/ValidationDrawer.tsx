import type { ReadinessOut } from "../types";

interface Props {
  readiness: ReadinessOut;
  onClose: () => void;
}

export default function ValidationDrawer({ readiness, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="relative w-80 bg-white dark:bg-[#1a1a1a] border-l border-gray-200 dark:border-gray-700 h-full overflow-y-auto p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Readiness check</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-4xl font-bold font-mono text-gray-900 dark:text-gray-100">{readiness.score}</span>
          <span className="text-sm text-gray-400">/ 100</span>
        </div>

        <div className="flex flex-col gap-2">
          {readiness.files.map((f) => (
            <div key={f.filename} className="flex items-start gap-2 text-xs">
              <span className={f.exists && f.placeholder_count === 0 ? "text-[#7cf29c] mt-0.5" : "text-gray-300 dark:text-gray-600 mt-0.5"}>
                {f.exists && f.placeholder_count === 0 ? "✓" : "○"}
              </span>
              <div className="flex-1">
                <span className={`font-mono ${f.exists ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-600"}`}>
                  {f.filename}
                </span>
                {f.placeholder_count > 0 && (
                  <span className="ml-2 text-amber-500">{f.placeholder_count} placeholder{f.placeholder_count > 1 ? "s" : ""}</span>
                )}
                {f.note && <p className="text-gray-400 mt-0.5">{f.note}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 leading-relaxed">
            For a full semantic review, load the{" "}
            <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">company-brain-validator</code>{" "}
            skill in Claude and run it against this brain.
          </p>
        </div>
      </aside>
    </div>
  );
}
