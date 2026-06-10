import { JSX, ReactNode } from "react";
import { HRIcon } from "./hrIcons";

type BadgeKind = "ok" | "warn" | "block" | "progress" | "draft";

function Badge({ kind, children }: { kind?: BadgeKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`posbadge${kind !== undefined ? ` posbadge--${kind}` : ""}`}>
      {kind !== undefined && <span className="posbadge__dot" />}
      {children}
    </span>
  );
}

function HRProvenanceChip({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="hrprov">
      <HRIcon.Link /> {children}
    </span>
  );
}

function hepText(v: number | undefined | null): string {
  if (v === undefined || v === null) return "—";
  return v.toExponential(1).replace("e", "E");
}

export { Badge, HRProvenanceChip, hepText, type BadgeKind };
