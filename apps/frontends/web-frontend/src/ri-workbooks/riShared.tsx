import { JSX, ReactNode } from "react";
import { RIIcon } from "./riIcons";

type BadgeKind = "ok" | "warn" | "block" | "progress" | "draft";

function Badge({ kind, children }: { kind?: BadgeKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`posbadge${kind !== undefined ? ` posbadge--${kind}` : ""}`}>
      {kind !== undefined && <span className="posbadge__dot" />}
      {children}
    </span>
  );
}

function RiProvenanceChip({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="riprov">
      <RIIcon.Link /> {children}
    </span>
  );
}

function valText(v: number | undefined | null): string {
  if (v === undefined || v === null) return "n/a";
  return v.toExponential(1).replace("e", "E");
}

export { Badge, RiProvenanceChip, valText, type BadgeKind };
