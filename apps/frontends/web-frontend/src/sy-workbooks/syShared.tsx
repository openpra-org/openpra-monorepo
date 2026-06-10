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

export { Badge, SYProvenanceChip, type BadgeKind };
