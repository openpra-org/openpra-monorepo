import { JSX, ReactNode } from "react";
import { DAIcon } from "./daIcons";
import { PARAM_TYPES } from "./daViewData";

type BadgeKind = "ok" | "warn" | "block" | "progress" | "draft";

function Badge({ kind, children }: { kind?: BadgeKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`posbadge${kind !== undefined ? ` posbadge--${kind}` : ""}`}>
      {kind !== undefined && <span className="posbadge__dot" />}
      {children}
    </span>
  );
}

function DaProvenanceChip({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="esprov">
      <DAIcon.Link /> {children}
    </span>
  );
}

function valText(v: number | undefined | null): string {
  if (v === undefined || v === null) return "—";
  return v.toExponential(1).replace("e", "E");
}

function unitText(parameterType: string): string {
  return PARAM_TYPES[parameterType]?.unit ?? "";
}

export { Badge, DaProvenanceChip, valText, unitText, type BadgeKind };
