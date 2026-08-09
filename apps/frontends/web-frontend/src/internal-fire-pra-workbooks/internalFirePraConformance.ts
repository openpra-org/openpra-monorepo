import { INTERNAL_FIRE_PRA_SR_CATALOG, type InternalFirePRA } from "interfaces-mef-types/internal-fire/internal-fire-pra";

export type InternalFireConformanceStatus = "ok" | "warn" | "blocked" | "na";
export interface InternalFireConformanceItem { id: string; section: string; text: string; status: InternalFireConformanceStatus; evidenceCount: number }

const SUBELEMENT_NAMES: Record<string, string> = {
  FPP: "FPP · Plant partitioning", FES: "FES · Equipment selection", FCS: "FCS · Cables and raceways",
  FQLS: "FQLS · Qualitative screening", FPRM: "FPRM · Plant response", FSS: "FSS · Fire scenarios",
  FIGN: "FIGN · Ignition frequency", FCF: "FCF · Circuit failure", FHR: "FHR · Human reliability",
  FESQ: "FESQ · Event-sequence quantification",
};

export function internalFireConformanceItems(mef: InternalFirePRA): InternalFireConformanceItem[] {
  return mef.conformanceMatrix.map((item) => {
    const prefix = item.sr.split("-")[0];
    const status: InternalFireConformanceStatus = item.status === "MET" ? "ok" : item.status === "NOT_APPLICABLE" ? "na" : item.status === "NOT_MET" ? "blocked" : "warn";
    const description = INTERNAL_FIRE_PRA_SR_CATALOG[item.sr]?.description ?? "Requirement description unavailable.";
    return { id: item.sr, section: `${SUBELEMENT_NAMES[prefix] ?? prefix} · HLR ${item.hlr}`, text: `${item.sr} · ${description}`, status, evidenceCount: item.satisfiedByElementPaths.length };
  });
}

export function groupInternalFireConformance(items: InternalFireConformanceItem[]): Array<[string, InternalFireConformanceItem[]]> {
  const groups = new Map<string, InternalFireConformanceItem[]>();
  for (const item of items) groups.set(item.section, [...(groups.get(item.section) ?? []), item]);
  return [...groups.entries()];
}

export function internalFireConformanceScore(items: InternalFireConformanceItem[]): { met: number; applicable: number; warn: number; blocked: number; na: number; percent: number } {
  const met = items.filter((item) => item.status === "ok").length;
  const warn = items.filter((item) => item.status === "warn").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const na = items.filter((item) => item.status === "na").length;
  const applicable = items.length - na;
  return { met, applicable, warn, blocked, na, percent: applicable === 0 ? 100 : Math.round((met / applicable) * 100) };
}
