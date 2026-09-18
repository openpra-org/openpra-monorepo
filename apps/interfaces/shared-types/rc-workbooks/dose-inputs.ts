import type { RcDoseInputs, RcDosePathway, RcDoseRecord } from "interfaces-mef-types/rc/dose-inputs";
import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
export const dosePathways: RcDosePathway[] = ["inhalation", "cloudshine", "groundshine"];
export const dosePathwayNames = { inhalation: "Inhalation", cloudshine: "Cloudshine", groundshine: "Groundshine" };
export const doseNativeNames = { inhalation: "FGR13INH.HDB", cloudshine: "F12TIII1.EXT", groundshine: "F12TIII3.EXT" };
export function doseCoverage(inputs: RcDoseInputs | undefined, source: RcSourceTermValues | undefined, kind: RcDosePathway) {
  const available = new Set(inputs?.libraries.find(l => l.kind === kind)?.nuclides.map(n => n.toLowerCase()) ?? []), names = [...new Set(source?.inventory.map(n => n.name) ?? [])];
  return { found: names.filter(n => available.has(n.toLowerCase())), missing: names.filter(n => !available.has(n.toLowerCase())), total: names.length };
}
export function inhalationRecordLabel(record: RcDoseRecord): string {
  const p = record.inhalation;
  if (!p) return record.name;
  const age = ({ 100: "Infant", 365: "1 year", 1825: "5 years", 3650: "10 years", 5475: "15 years", 7300: "Adult (20 years)", 9125: "Adult (25 years)" } as Record<number, string>)[p.ageDays] ?? `${p.ageDays} days`;
  return `${age} · ${p.absorption} · ${p.amadMicrometres} µm · ${p.components === 2 ? "L + H" : p.let} · entry ${record.index + 1}`;
}
