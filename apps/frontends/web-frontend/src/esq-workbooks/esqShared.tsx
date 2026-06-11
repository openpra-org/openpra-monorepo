import { JSX, ReactNode } from "react";
import { ESQIcon } from "./esqIcons";

type BadgeKind = "ok" | "warn" | "block" | "progress" | "draft";

function Badge({ kind, children }: { kind?: BadgeKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`posbadge${kind !== undefined ? ` posbadge--${kind}` : ""}`}>
      {kind !== undefined && <span className="posbadge__dot" />}
      {children}
    </span>
  );
}

function EsqProvenanceChip({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="esprov">
      <ESQIcon.Link /> {children}
    </span>
  );
}

function valText(v: number | undefined | null): string {
  if (v === undefined || v === null) return "—";
  return v.toExponential(1).replace("e", "E");
}

function freqText(v: number | undefined | null): string {
  if (v === undefined || v === null) return "—";
  return `${v.toExponential(1).replace("e", "E")}/yr`;
}

function pctText(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}

export { Badge, EsqProvenanceChip, valText, freqText, pctText, type BadgeKind };
