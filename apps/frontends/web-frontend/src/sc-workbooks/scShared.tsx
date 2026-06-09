import { JSX, ReactNode } from "react";
import { SCIcon } from "./scIcons";

type BadgeKind = "ok" | "warn" | "block" | "progress" | "draft";

function Badge({ kind, children }: { kind?: BadgeKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`posbadge${kind !== undefined ? ` posbadge--${kind}` : ""}`}>
      {kind !== undefined && <span className="posbadge__dot" />}
      {children}
    </span>
  );
}

type ProvenanceKind = "sc" | "es";

function SCProvenanceChip({ kind, children }: { kind?: ProvenanceKind; children: ReactNode }): JSX.Element {
  const Icon = kind === "es" ? SCIcon.Network : SCIcon.Gauge;
  return (
    <span className={`scprov${kind !== undefined ? ` scprov--${kind}` : ""}`}>
      <Icon /> {children}
    </span>
  );
}

interface ImportanceFmt {
  label: string;
  kind?: BadgeKind;
}

function fmtImportance(v: string | undefined): ImportanceFmt {
  if (v === "HIGH") return { label: "High", kind: "block" };
  if (v === "MEDIUM") return { label: "Medium", kind: "warn" };
  if (v === "LOW") return { label: "Low" };
  return { label: "—" };
}

export { Badge, SCProvenanceChip, fmtImportance, type BadgeKind, type ProvenanceKind, type ImportanceFmt };
