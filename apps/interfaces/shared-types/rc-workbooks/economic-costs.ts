import type { RcEconomicCostCode } from "interfaces-mef-types/rc/economic-inputs";
import type { EconomicFactorsAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";

export interface RcEconomicCostSpec { label: string; group: string; unit: string; min: number; max: number; perLevel?: boolean; monetary?: boolean }

/** Units and bounds from the MACCS 5.2 CHRONC input tables. Values are analyst supplied. */
export const rcEconomicCostSpecs: Record<RcEconomicCostCode, RcEconomicCostSpec> = {
  EVACST: { label: "Emergency evacuation", group: "Compensation", unit: "$/person-day", min: 0, max: 1000, monetary: true },
  RELCST: { label: "Immediate relocation", group: "Compensation", unit: "$/person-day", min: 0, max: 1000, monetary: true },
  POPCST: { label: "Long-term relocation, one time", group: "Compensation", unit: "$/person", min: 1e-6, max: 1e6, monetary: true },
  LTMCST: { label: "Long-term relocation, daily", group: "Compensation", unit: "$/person-day", min: 0, max: 1000, monetary: true },
  DLBCST: { label: "Decontamination labor", group: "Decontamination", unit: "$/person-year", min: 1, max: 1e6, monetary: true },
  TIMDEC: { label: "Completion time", group: "Decontamination", unit: "s", min: 1e-6, max: 9.46e8, perLevel: true },
  DSRFCT: { label: "Dose reduction factor", group: "Decontamination", unit: "unitless", min: 1.01, max: 100, perLevel: true },
  TFWKF: { label: "Farm worker time fraction", group: "Decontamination", unit: "unitless", min: 0, max: 1, perLevel: true },
  TFWKNF: { label: "Non-farm worker time fraction", group: "Decontamination", unit: "unitless", min: 0, max: 1, perLevel: true },
  CDFRM: { label: "Farmland decontamination", group: "Decontamination", unit: "$/ha", min: 1, max: 1e6, perLevel: true, monetary: true },
  FRFDL: { label: "Farm labor cost fraction", group: "Decontamination", unit: "unitless", min: 0, max: 1, perLevel: true },
  CDNFRM: { label: "Non-farmland decontamination", group: "Decontamination", unit: "$/person", min: 1, max: 1e6, perLevel: true, monetary: true },
  FRNFDL: { label: "Non-farm labor cost fraction", group: "Decontamination", unit: "unitless", min: 0, max: 1, perLevel: true },
  DPRATE: { label: "Property depreciation rate", group: "Interdiction", unit: "yr⁻¹", min: 0, max: 1 },
  DSRATE: { label: "Expected rate of return", group: "Interdiction", unit: "yr⁻¹", min: 0, max: 1 },
  WCDMCST: { label: "Non-farmland waste", group: "Condemnation", unit: "$/ha", min: 0, max: 1e9, monetary: true },
  WFCDCST: { label: "Farmland waste", group: "Condemnation", unit: "$/ha", min: 0, max: 1e9, monetary: true },
};

export function rcEconomicCostIssues(rows: EconomicFactorsAnalysis["costParameterEstimates"], levels?: number): string[] {
  const issues: string[] = [], keys = new Set<string>();
  for (const row of rows) {
    if (!row.costCode) continue;
    const spec = rcEconomicCostSpecs[row.costCode], key = `${row.costCode}:${spec.perLevel ? row.level ?? "" : ""}`;
    if (keys.has(key)) issues.push(`${row.costCode}: duplicate parameter${spec.perLevel ? ` at level ${row.level ?? "?"}` : ""}.`);
    keys.add(key);
    if (spec.perLevel && (row.level === undefined || !Number.isInteger(row.level) || row.level < 1 || row.level > 3)) issues.push(`${row.costCode}: choose level 1–3.`);
    if (spec.perLevel && levels !== undefined && row.level !== undefined && row.level > levels) issues.push(`${row.costCode}: level exceeds the selected decontamination levels.`);
    if (!spec.perLevel && row.level !== undefined) issues.push(`${row.costCode}: level is not used.`);
    if (row.value !== undefined && (!Number.isFinite(row.value) || row.value < spec.min || row.value > spec.max)) issues.push(`${row.costCode}: value must be ${spec.min} to ${spec.max} ${spec.unit}.`);
    if (row.value !== undefined && spec.monetary && row.currencyYear === undefined) issues.push(`${row.costCode}: supply the currency year.`);
    if (row.value !== undefined && !row.source.trim()) issues.push(`${row.costCode}: supply a source.`);
  }
  for (const code of ["TIMDEC", "DSRFCT", "CDFRM", "CDNFRM"] as const) {
    const valued = rows.filter(row => row.costCode === code && row.level !== undefined && row.value !== undefined).sort((a, b) => a.level! - b.level!);
    for (let i = 1; i < valued.length; i++) if (valued[i].value! <= valued[i - 1].value!) issues.push(`${code}: values must increase with decontamination level.`);
  }
  return issues;
}

export function rcEconomicCostCoverage(economics: EconomicFactorsAnalysis): { supplied: number; required: number; complete: boolean } {
  const levels = economics.decontaminationLevels;
  if (levels === undefined) return { supplied: economics.costParameterEstimates.filter(row => row.costCode && row.value !== undefined).length, required: 0, complete: false };
  const keys = Object.keys(rcEconomicCostSpecs) as RcEconomicCostCode[];
  const required = keys.reduce((total, code) => total + (rcEconomicCostSpecs[code].perLevel ? levels : 1), 0);
  const supplied = keys.reduce((total, code) => total + (rcEconomicCostSpecs[code].perLevel ? Array.from({ length: levels }, (_, index) => index + 1) : [undefined])
    .filter(level => economics.costParameterEstimates.some(row => row.costCode === code && row.level === level && row.value !== undefined)).length, 0);
  return { supplied, required, complete: supplied === required && rcEconomicCostIssues(economics.costParameterEstimates, levels).length === 0 };
}
