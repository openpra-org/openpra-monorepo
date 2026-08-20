import { JSX, ReactNode } from "react";
import { ESIcon } from "./esIcons";

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

function ESProvenanceChip({ kind, children }: { kind?: ProvenanceKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`esprov${kind !== undefined ? ` esprov--${kind}` : ""}`}>
      {children}
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

export { Badge, ESProvenanceChip, fmtImportance, type BadgeKind, type ProvenanceKind, type ImportanceFmt };
