import { JSX, useEffect, useState } from "react";
import { getWorkbookWorkflowStatus, type WorkbookRoleHolder, type WorkbookSignoffRole } from "./workbookReviewApi";
import "./css/workbookRoster.css";

interface WorkbookRosterProps {
  workbookId: string;
  refreshSignal: number;
}

const ROLE_GROUPS: { role: WorkbookSignoffRole; label: string }[] = [
  { role: "preparer", label: "Preparer" },
  { role: "co_preparer", label: "Co-preparers" },
  { role: "reviewer", label: "Reviewers" },
  { role: "approver", label: "Approver" },
];

function initialsOf(name: string): string {
  const cleaned = name.startsWith("Dr. ") ? name.slice(4) : name;
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function WorkbookRoster({ workbookId, refreshSignal }: WorkbookRosterProps): JSX.Element {
  const [holders, setHolders] = useState<WorkbookRoleHolder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWorkbookWorkflowStatus(workbookId)
      .then((s) => { if (!cancelled) setHolders(s.roleHolders); })
      .catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load roster"); });
    return () => { cancelled = true; };
  }, [workbookId, refreshSignal]);

  return (
    <div className="poscard">
      <div className="poscard__head">
        <h3 className="poscard__title">Workbook roster</h3>
        <span className="possubtle">Everyone assigned to this workbook</span>
      </div>
      {error !== null && <p className="posroster__error">{error}</p>}
      {holders === null && error === null && <p className="posroster__status">Loading roster…</p>}
      {holders !== null && (
        <div className="posroster">
          {ROLE_GROUPS.map((g) => {
            const people = holders.filter((h) => h.role === g.role);
            return (
              <div key={g.role} className="posroster__group">
                <div className="posroster__group-label">
                  {g.label}
                  {people.length > 0 && <span className="posroster__group-count">{people.length}</span>}
                </div>
                {people.length === 0 ? (
                  <p className="posroster__empty">Not assigned</p>
                ) : (
                  <div className="posroster__people">
                    {people.map((p) => (
                      <div key={`${p.role}-${p.username}`} className="posroster__person">
                        <span className={`posroster__avatar${p.role === "approver" ? " posroster__avatar--approver" : ""}`}>
                          {initialsOf(p.fullName)}
                        </span>
                        <div className="posroster__person-main">
                          <div className="posroster__person-name">{p.fullName}</div>
                          <div className="posroster__person-desig">
                            {p.designation !== null && p.designation.length > 0 ? p.designation : `@${p.username}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { WorkbookRoster };
