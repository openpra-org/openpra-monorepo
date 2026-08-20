import {
  OTHER_HAZARDS_PRA_SR_CATALOG,
  type OtherHazardsPRA,
} from "interfaces-mef-types/other-hazards/other-hazards-pra";

export type OtherHazardsConformanceStatus = "ok" | "warn" | "blocked" | "na";
export interface OtherHazardsConformanceItem {
  id: string;
  section: string;
  text: string;
  status: OtherHazardsConformanceStatus;
  evidenceCount: number;
}

const SUBELEMENT_NAMES: Record<string, string> = {
  OHA: "OHA · Other Hazards analysis",
  OFR: "OFR · Other Hazards fragility",
  OPR: "OPR · Plant response",
};

export function otherHazardsConformanceItems(mef: OtherHazardsPRA): OtherHazardsConformanceItem[] {
  return mef.conformanceMatrix.map((item) => {
    const prefix = item.sr.split("-")[0] ?? "O";
    const status: OtherHazardsConformanceStatus =
      item.status === "MET" ? "ok"
      : item.status === "NOT_APPLICABLE" ? "na"
      : item.status === "NOT_MET" ? "blocked"
      : "warn";
    const description =
      OTHER_HAZARDS_PRA_SR_CATALOG[item.sr]?.description ?? "Requirement description unavailable.";
    return {
      id: item.sr,
      section: `${SUBELEMENT_NAMES[prefix] ?? prefix} · HLR ${item.hlr}`,
      text: `${item.sr} · ${description}`,
      status,
      evidenceCount: item.satisfiedByElementPaths.length,
    };
  });
}

export function groupOtherHazardsConformance(
  items: OtherHazardsConformanceItem[],
): Array<[string, OtherHazardsConformanceItem[]]> {
  const groups = new Map<string, OtherHazardsConformanceItem[]>();
  for (const item of items) groups.set(item.section, [...(groups.get(item.section) ?? []), item]);
  return [...groups.entries()];
}

export function otherHazardsConformanceScore(items: OtherHazardsConformanceItem[]): {
  met: number;
  applicable: number;
  warn: number;
  blocked: number;
  na: number;
  percent: number;
} {
  const met = items.filter((item) => item.status === "ok").length;
  const warn = items.filter((item) => item.status === "warn").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const na = items.filter((item) => item.status === "na").length;
  const applicable = items.length - na;
  return {
    met,
    applicable,
    warn,
    blocked,
    na,
    percent: applicable === 0 ? 100 : Math.round((met / applicable) * 100),
  };
}
