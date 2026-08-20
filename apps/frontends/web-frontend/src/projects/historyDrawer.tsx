import { JSX, useEffect, useState } from "react";
import { type AuditLogEntry } from "interfaces-shared-types";
import { ClockIcon, CloseIcon } from "../welcome/icons";
import { formatRelative } from "../welcome/formatRelative";
import { getProjectAudit } from "./auditApi";

function initialsOf(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function HistoryDrawer({
  projectId,
  onClose,
  onError,
}: {
  projectId: string;
  onClose: () => void;
  onError: (message: string) => void;
}): JSX.Element {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    getProjectAudit(projectId)
      .then((res) => { if (!cancelled) setEntries(res.entries); })
      .catch((err: unknown) => {
        if (cancelled) return;
        onError((err as { message?: string }).message ?? "Could not load history");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, onError]);

  return (
    <div className="hist__backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="hist" role="dialog" aria-modal="true" aria-label="Project history">
        <header className="hist__head">
          <div>
            <div className="hist__eyebrow"><ClockIcon /> History</div>
            <h2 className="hist__title">Project timeline</h2>
            <p className="hist__sub">Every change to this project, newest first.</p>
          </div>
          <button type="button" className="hist__close" onClick={onClose} aria-label="Close history"><CloseIcon /></button>
        </header>
        <div className="hist__body">
          {loading ? (
            <p className="hist__status">Loading history…</p>
          ) : entries.length === 0 ? (
            <p className="hist__status">No activity recorded yet.</p>
          ) : (
            <ul className="actfeed">
              {entries.map((entry) => (
                <li key={entry.id} className="actfeed__row">
                  <span className="actfeed__avatar" aria-hidden="true">{initialsOf(entry.actorUsername)}</span>
                  <div className="actfeed__body">
                    <div className="actfeed__line">
                      <span className="actfeed__who">{entry.actorUsername}</span> {entry.summary}
                    </div>
                    <div className="actfeed__when">{formatRelative(entry.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

export { HistoryDrawer };
