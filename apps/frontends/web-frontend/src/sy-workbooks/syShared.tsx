import { JSX, ReactNode } from "react";
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

export { Badge, DialogHead, NotRecorded, ReviewLines, ReviewTitle, SYProvenanceChip, type BadgeKind };
