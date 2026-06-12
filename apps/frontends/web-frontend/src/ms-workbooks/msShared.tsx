import { JSX, ReactNode } from "react";
import { MSIcon } from "./msIcons";

type BadgeKind = "ok" | "warn" | "block" | "progress" | "draft";

function Badge({ kind, children }: { kind?: BadgeKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`posbadge${kind !== undefined ? ` posbadge--${kind}` : ""}`}>
      {kind !== undefined && <span className="posbadge__dot" />}
      {children}
    </span>
  );
}

function MsProvenanceChip({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="esprov">
      <MSIcon.Link /> {children}
    </span>
  );
}

function valText(v: number | undefined | null): string {
  if (v === undefined || v === null) return "n/a";
  return v.toExponential(1).replace("e", "E");
}

function fracText(v: number | undefined | null): string {
  if (v === undefined || v === null) return "n/a";
  return v.toExponential(1).replace("e", "E");
}

function pctText(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}

export { Badge, MsProvenanceChip, valText, fracText, pctText, type BadgeKind };
