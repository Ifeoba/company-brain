import { useEffect, useState } from "react";
import { useFile, useUpdateFile } from "../api/hooks";
import Icon from "./Icon";

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
    <div className="ba-preview">
      <div className="header">
        <span className="fname">Preview — {filename}</span>
        <div className="ctrls">
          {saved && <span className="micro text-accent">Saved</span>}
          {editMode ? (
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditMode(false)}>
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSave}
                disabled={updateFile.isPending}
              >
                {updateFile.isPending ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={() => setEditMode(true)}>
              <Icon name="copy" size={11} /> Copy
            </button>
          )}
        </div>
      </div>

      {editMode ? (
        <div className="edit-body">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="body">
          {displayContent ? (
            displayContent
          ) : (
            <span className="empty-hint">
              No content yet. Answer the questions and click "Draft from answer".
            </span>
          )}
        </div>
      )}

      <div className="footer">
        <button className="edit-link" onClick={() => setEditMode(true)}>
          <Icon name="edit" size={11} /> Edit directly
        </button>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--dim)" }}>
          {fileData?.updated_at
            ? `updated ${new Date(fileData.updated_at).toLocaleTimeString()}`
            : "not yet generated"}
        </span>
      </div>
    </div>
  );
}
