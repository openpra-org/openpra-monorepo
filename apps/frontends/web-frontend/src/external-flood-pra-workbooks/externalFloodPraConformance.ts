import { EXTERNAL_FLOOD_PRA_SR_CATALOG, type ExternalFloodPRA } from "interfaces-mef-types/external-flood/external-flood-pra";

export type ExternalFloodConformanceStatus = "ok" | "warn" | "blocked" | "na";
export interface ExternalFloodConformanceItem { id: string; section: string; text: string; status: ExternalFloodConformanceStatus; evidenceCount: number }
const SUBELEMENT_NAMES: Record<string, string> = { XFHA: "XFHA · External flood hazard", XFFR: "XFFR · External flood fragility", XFPR: "XFPR · Plant response" };

export function externalFloodConformanceItems(mef: ExternalFloodPRA): ExternalFloodConformanceItem[] {
  return mef.conformanceMatrix.map((item) => {
    const prefix = item.sr.split("-")[0] ?? "XF";
    const status: ExternalFloodConformanceStatus = item.status === "MET" ? "ok" : item.status === "NOT_APPLICABLE" ? "na" : item.status === "NOT_MET" ? "blocked" : "warn";
    const description = EXTERNAL_FLOOD_PRA_SR_CATALOG[item.sr]?.description ?? "Requirement description unavailable.";
    return { id: item.sr, section: `${SUBELEMENT_NAMES[prefix] ?? prefix} · HLR ${item.hlr}`, text: `${item.sr} · ${description}`, status, evidenceCount: item.satisfiedByElementPaths.length };
  });
}

export function groupExternalFloodConformance(items: ExternalFloodConformanceItem[]): Array<[string, ExternalFloodConformanceItem[]]> {
  const groups = new Map<string, ExternalFloodConformanceItem[]>();
  for (const item of items) groups.set(item.section, [...(groups.get(item.section) ?? []), item]);
  return [...groups.entries()];
}

export function externalFloodConformanceScore(items: ExternalFloodConformanceItem[]): { met: number; applicable: number; warn: number; blocked: number; na: number; percent: number } {
  const met = items.filter((item) => item.status === "ok").length;
  const warn = items.filter((item) => item.status === "warn").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const na = items.filter((item) => item.status === "na").length;
  const applicable = items.length - na;
  return { met, applicable, warn, blocked, na, percent: applicable === 0 ? 100 : Math.round((met / applicable) * 100) };
}
