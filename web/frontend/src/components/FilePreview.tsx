import { useEffect, useState } from "react";
import { useFile, useUpdateFile } from "../api/hooks";

interface Props {
  slug: string;
  filename: string;
  draftContent?: string;
}

export default function FilePreview({ slug, filename, draftContent }: Props) {
  const { data: fileData } = useFile(slug, filename);
  const updateFile = useUpdateFile(slug);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saved, setSaved] = useState(false);

  const displayContent = draftContent ?? fileData?.content ?? "";

  useEffect(() => {
    if (editMode) setEditContent(fileData?.content ?? "");
  }, [editMode, fileData?.content]);

  async function handleSave() {
    await updateFile.mutateAsync({ filename, content: editContent });
    setEditMode(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!filename) return null;

  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-700">
        <span className="smallcaps text-gray-400 dark:text-gray-500 tracking-widest">
          Preview — {filename.toUpperCase()}
        </span>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-[#7cf29c]">Saved</span>}
          {editMode ? (
            <>
              <button onClick={() => setEditMode(false)} className="text-xs text-gray-400 hover:text-gray-600">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateFile.isPending}
                className="text-xs text-gray-900 dark:text-gray-100 font-medium hover:opacity-80 disabled:opacity-50"
              >
                {updateFile.isPending ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Edit directly
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {editMode ? (
        <textarea
          className="w-full font-mono text-xs leading-relaxed p-4 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 resize-none focus:outline-none min-h-[320px]"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <pre className="font-mono text-xs leading-relaxed p-4 bg-gray-50 dark:bg-[#111] text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap min-h-[120px] max-h-[480px] overflow-y-auto scrollbar-thin">
          {displayContent || <span className="text-gray-300 dark:text-gray-600 italic">No content yet. Answer the questions and click "Draft from answer".</span>}
        </pre>
      )}
    </div>
  );
}
