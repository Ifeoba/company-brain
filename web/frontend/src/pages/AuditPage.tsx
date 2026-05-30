import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuditPage } from "../api/hooks";
import AppTopbar from "../components/Layout";

const PAGE_SIZE = 50;

function buildCsvUrl(action: string, resourceType: string, fromDate: string, toDate: string) {
  const qs = new URLSearchParams();
  if (action) qs.set("action", action);
  if (resourceType) qs.set("resource_type", resourceType);
  if (fromDate) qs.set("from_date", fromDate);
  if (toDate) qs.set("to_date", toDate);
  const query = qs.toString();
  return `/api/workspace/audit/export.csv${query ? "?" + query : ""}`;
}

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [offset, setOffset] = useState(0);

  // Applied filters (only update when user clicks Apply)
  const [applied, setApplied] = useState({
    action: "",
    resourceType: "",
    fromDate: "",
    toDate: "",
  });

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    setApplied({ action, resourceType, fromDate, toDate });
  }

  function handleClear() {
    setAction("");
    setResourceType("");
    setFromDate("");
    setToDate("");
    setOffset(0);
    setApplied({ action: "", resourceType: "", fromDate: "", toDate: "" });
  }

  const { data, isLoading } = useAuditPage({
    action: applied.action || undefined,
    resource_type: applied.resourceType || undefined,
    from_date: applied.fromDate || undefined,
    to_date: applied.toDate || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const total = data?.total ?? 0;
  const entries = data?.entries ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="audit-page">
      <AppTopbar />
      <div className="audit-main">
        <div className="inner">
          <div className="audit-head">
            <div>
              <h1>Audit log</h1>
              <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>
                Immutable record of all workspace activity
              </div>
            </div>
            <a
              href={buildCsvUrl(applied.action, applied.resourceType, applied.fromDate, applied.toDate)}
              className="btn btn-ghost btn-lg"
              download="audit-log.csv"
            >
              Export CSV
            </a>
          </div>

          <form className="audit-filters" onSubmit={handleApply}>
            <input
              className="input"
              placeholder="Action (e.g. run_created)"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
            <input
              className="input"
              placeholder="Resource type (e.g. brain)"
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
            />
            <input
              className="input"
              placeholder="From (YYYY-MM-DD)"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <input
              className="input"
              placeholder="To (YYYY-MM-DD)"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Apply</button>
            <button type="button" className="btn btn-ghost" onClick={handleClear}>Clear</button>
          </form>

          <div className="audit-meta dim" style={{ fontSize: 12.5, marginBottom: 8 }}>
            {isLoading ? "Loading…" : `${total.toLocaleString()} event${total !== 1 ? "s" : ""}`}
            {total > 0 && ` · page ${currentPage} of ${totalPages}`}
          </div>

          <div className="audit-table">
            <div className="audit-row audit-head-row">
              <span>Time</span>
              <span>Action</span>
              <span>Resource</span>
              <span>Resource ID</span>
              <span>Actor</span>
            </div>
            {isLoading ? (
              <div className="audit-empty dim">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="audit-empty dim">No events match the current filters.</div>
            ) : (
              entries.map((e) => (
                <div key={e.id} className="audit-row">
                  <span className="dim" style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
                    {e.occurred_at
                      ? new Date(e.occurred_at).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </span>
                  <span className="audit-action">{e.action}</span>
                  <span className="dim">{e.resource_type || "—"}</span>
                  <span className="dim audit-truncate">{e.resource_id || "—"}</span>
                  <span className="dim audit-truncate">{e.actor_id || "—"}</span>
                </div>
              ))
            )}
          </div>

          {total > PAGE_SIZE && (
            <div className="audit-pagination">
              <button
                className="btn btn-sm btn-ghost"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                ← Prev
              </button>
              <span className="dim" style={{ fontSize: 12.5 }}>
                {currentPage} / {totalPages}
              </span>
              <button
                className="btn btn-sm btn-ghost"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next →
              </button>
            </div>
          )}

          <div className="audit-notice dim">
            Audit log entries are write-once and cannot be modified or deleted.
          </div>
        </div>
      </div>
    </div>
  );
}
