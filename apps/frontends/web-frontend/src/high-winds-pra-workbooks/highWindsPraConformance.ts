import { HIGH_WINDS_PRA_SR_CATALOG, type HighWindsPRA } from "interfaces-mef-types/high-winds/high-winds-pra";

export type HighWindsConformanceStatus = "ok" | "warn" | "blocked" | "na";
export interface HighWindsConformanceItem { id: string; section: string; text: string; status: HighWindsConformanceStatus; evidenceCount: number }
const SUBELEMENT_NAMES: Record<string, string> = { WHA: "WHA · Wind hazard", WFR: "WFR · Wind fragility", WPR: "WPR · Plant response" };

export function highWindsConformanceItems(mef: HighWindsPRA): HighWindsConformanceItem[] {
  return mef.conformanceMatrix.map((item) => {
    const prefix = item.sr.split("-")[0] ?? "W";
    const status: HighWindsConformanceStatus = item.status === "MET" ? "ok" : item.status === "NOT_APPLICABLE" ? "na" : item.status === "NOT_MET" ? "blocked" : "warn";
    const description = HIGH_WINDS_PRA_SR_CATALOG[item.sr]?.description ?? "Requirement description unavailable.";
    return { id: item.sr, section: `${SUBELEMENT_NAMES[prefix] ?? prefix} · HLR ${item.hlr}`, text: `${item.sr} · ${description}`, status, evidenceCount: item.satisfiedByElementPaths.length };
  });
}

export function groupHighWindsConformance(items: HighWindsConformanceItem[]): Array<[string, HighWindsConformanceItem[]]> {
  const groups = new Map<string, HighWindsConformanceItem[]>();
  for (const item of items) groups.set(item.section, [...(groups.get(item.section) ?? []), item]);
  return [...groups.entries()];
}

export function highWindsConformanceScore(items: HighWindsConformanceItem[]): { met: number; applicable: number; warn: number; blocked: number; na: number; percent: number } {
  const met = items.filter((item) => item.status === "ok").length;
  const warn = items.filter((item) => item.status === "warn").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const na = items.filter((item) => item.status === "na").length;
  const applicable = items.length - na;
  return { met, applicable, warn, blocked, na, percent: applicable === 0 ? 100 : Math.round((met / applicable) * 100) };
}
