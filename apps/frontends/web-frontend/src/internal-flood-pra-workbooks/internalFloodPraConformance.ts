import { INTERNAL_FLOOD_PRA_SR_CATALOG, type InternalFloodPRA } from "interfaces-mef-types/internal-flood/internal-flood-pra";

export type InternalFloodConformanceStatus = "ok" | "warn" | "blocked" | "na";
export interface InternalFloodConformanceItem { id: string; section: string; text: string; status: InternalFloodConformanceStatus; evidenceCount: number }

const SUBELEMENT_NAMES: Record<string, string> = {
  FLPP: "FLPP · Plant partitioning", FLSO: "FLSO · Flood sources", FLSN: "FLSN · Scenarios and screening",
  FLEV: "FLEV · Initiating-event frequency", FLPR: "FLPR · Plant response", FLHR: "FLHR · Human reliability",
  FLESQ: "FLESQ · Event-sequence quantification",
};

export function internalFloodConformanceItems(mef: InternalFloodPRA): InternalFloodConformanceItem[] {
  return mef.conformanceMatrix.map((item) => {
    const prefix = item.sr.split("-")[0];
    const status: InternalFloodConformanceStatus = item.status === "MET" ? "ok" : item.status === "NOT_APPLICABLE" ? "na" : item.status === "NOT_MET" ? "blocked" : "warn";
    const description = INTERNAL_FLOOD_PRA_SR_CATALOG[item.sr]?.description ?? "Requirement description unavailable.";
    return { id: item.sr, section: `${SUBELEMENT_NAMES[prefix] ?? prefix} · HLR ${item.hlr}`, text: `${item.sr} · ${description}`, status, evidenceCount: item.satisfiedByElementPaths.length };
  });
}

export function groupInternalFloodConformance(items: InternalFloodConformanceItem[]): Array<[string, InternalFloodConformanceItem[]]> {
  const groups = new Map<string, InternalFloodConformanceItem[]>();
  for (const item of items) groups.set(item.section, [...(groups.get(item.section) ?? []), item]);
  return [...groups.entries()];
}

export function internalFloodConformanceScore(items: InternalFloodConformanceItem[]): { met: number; applicable: number; warn: number; blocked: number; na: number; percent: number } {
  const met = items.filter((item) => item.status === "ok").length;
  const warn = items.filter((item) => item.status === "warn").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const na = items.filter((item) => item.status === "na").length;
  const applicable = items.length - na;
  return { met, applicable, warn, blocked, na, percent: applicable === 0 ? 100 : Math.round((met / applicable) * 100) };
}
