import { JSX, ReactNode } from "react";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { SYIcon } from "./syIcons";

type BadgeKind = "ok" | "warn" | "block" | "progress" | "draft";

function Badge({ kind, children }: { kind?: BadgeKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`posbadge${kind !== undefined ? ` posbadge--${kind}` : ""}`}>
      {kind !== undefined && <span className="posbadge__dot" />}
      {children}
    </span>
  );
}

function SYProvenanceChip({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="syprov">
      <SYIcon.Link /> {children}
    </span>
  );
}

function NotRecorded(): JSX.Element {
  return <span className="sy-review-none">Not recorded</span>;
}

interface ReviewIssue {
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
}

function IssueLines({ issues }: { issues: readonly ReviewIssue[] }): JSX.Element {
  return (
    <>
      {issues.map((issue) => (
        <span key={`${issue.code}:${issue.message}`} className={issue.severity === "ERROR" ? "sy-error" : "sy-warn"}>{issue.message}</span>
      ))}
    </>
  );
}

function ReviewLines({ items }: { items: readonly string[] }): JSX.Element {
  if (items.length === 0) return <NotRecorded />;
  if (items.length === 1) return <span>{items[0]}</span>;
  return <ul className="sy-review-bullets">{items.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}</ul>;
}

function ReviewTitle({ title, sr, children }: { title: string; sr?: string; children?: ReactNode }): JSX.Element {
  return (
    <div className="sy-review-title">
      <h3>{title}</h3>
      <div className="sy-review-actions">
        {sr !== undefined && <SYProvenanceChip>{sr}</SYProvenanceChip>}
        {children}
      </div>
    </div>
  );
}

const SYSTEMS_IN_SCOPE_ID = "sy-systems-in-scope";

function SystemsInScopeLink({ onOpen }: { onOpen?: () => void }): JSX.Element {
  if (onOpen === undefined) return <>Systems in scope</>;
  return (
    <a className="sy-inline-link" href={`?step=scope#${SYSTEMS_IN_SCOPE_ID}`} onClick={(event) => { event.preventDefault(); onOpen(); }}>
      Systems in scope
    </a>
  );
}

function NoSystemsCard({ title, purpose, onOpenSystems }: { title: string; purpose: string; onOpenSystems?: () => void }): JSX.Element {
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="SY" title={title} level={3} />
      </div>
      <div className="sy-review">
        <p className="sy-review-empty">No systems are in scope yet. Add them in the <SystemsInScopeLink onOpen={onOpenSystems} /> section of Step 01, then {purpose}</p>
      </div>
    </div>
  );
}

function DialogHead({ cap, title, onClose }: { cap: string; title: string; onClose: () => void }): JSX.Element {
  return (
    <div className="modal__head">
      <div>
        <div className="posdrawer__cap">{cap}</div>
        <h2 className="modal__title">{title}</h2>
      </div>
      <button type="button" className="modal__close" onClick={onClose} aria-label="Close"><SYIcon.Close /></button>
    </div>
  );
}

export { Badge, DialogHead, IssueLines, NoSystemsCard, NotRecorded, ReviewLines, ReviewTitle, SYProvenanceChip, SYSTEMS_IN_SCOPE_ID, SystemsInScopeLink, type BadgeKind, type ReviewIssue };
