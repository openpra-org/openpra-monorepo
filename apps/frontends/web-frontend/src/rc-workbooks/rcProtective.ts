import type { ProtectiveActionAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { siteReceptorIssues } from "interfaces-shared-types/rc-workbooks/site-receptors";
import { effectiveResponseTiming, responseIssues } from "interfaces-shared-types/rc-workbooks/protective-response";

type Delay = NonNullable<ProtectiveActionAnalysis["evacuationDelayComponents"]>[number];
type Parameter = NonNullable<ProtectiveActionAnalysis["protectionParameters"]>[number];

export function protectionParameterQuantity(parameter: Parameter): { value: string; unit: string } {
  if (parameter.numericValue !== undefined) return { value: String(parameter.numericValue), unit: parameter.unit || "—" };
  const legacy = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?:\s+(m³\/s|\(dimensionless\)))?\s*$/.exec(parameter.value);
  if (legacy) return { value: legacy[1], unit: parameter.unit || (legacy[2] === "(dimensionless)" ? "dimensionless" : legacy[2] || "—") };
  return { value: parameter.value || "—", unit: parameter.unit || "—" };
}

export function evacuationDelayMinutes(delay: Delay): number | undefined {
  if (delay.minutes !== undefined) return delay.minutes;
  const legacy = /^\s*\+?(\d+(?:\.\d+)?)\s*min\b/i.exec(delay.estimate);
  return legacy ? Number(legacy[1]) : undefined;
}

export function totalEvacuationDelay(delays: Delay[]): number | undefined {
  if (delays.length === 0) return undefined;
  const minutes = delays.map(evacuationDelayMinutes);
  return minutes.some((value) => value === undefined) ? undefined : minutes.reduce<number>((sum, value) => sum + value!, 0);
}

export function responseSummary(pa: ProtectiveActionAnalysis, population?: number) {
  const cohorts = pa.cohortModeling.cohorts ?? [];
  const share = cohorts.length && cohorts.every(cohort => cohort.populationPercent !== undefined) ? cohorts.reduce((sum, cohort) => sum + cohort.populationPercent!, 0) : undefined;
  const complyingPercent = share === undefined || Math.abs(share - 100) > 1e-6 || cohorts.some(cohort => cohort.compliancePercent === undefined)
    ? undefined : cohorts.reduce((sum, cohort) => sum + cohort.populationPercent! * cohort.compliancePercent! / 100, 0);
  const shelter = pa.protectiveActionsIncluded.some(action => action.action === "SHELTERING" && action.included);
  const evacuation = pa.protectiveActionsIncluded.some(action => action.action === "EVACUATION" && action.included);
  const timing = effectiveResponseTiming(pa);
  const shelterStart = shelter ? timing?.shelterStartMinutes : undefined;
  const departure = evacuation ? timing?.evacuationStartMinutes : undefined;
  const speed = evacuation ? timing?.evacuationSpeedMetresPerSecond : undefined;
  const declaration = timing.referenceAfterAccidentMinutes;
  return { complyingPercent, complyingPeople: population === undefined || complyingPercent === undefined ? undefined : Math.round(population * complyingPercent / 100),
    declaration, shelterAfterAccident: declaration === undefined || shelterStart === undefined ? undefined : declaration + shelterStart,
    departureAfterAccident: declaration === undefined || departure === undefined ? undefined : declaration + departure,
    shelterStart, departure, speed, shelterDuration: shelterStart === undefined || departure === undefined || departure < shelterStart ? undefined : departure - shelterStart };
}

export function protectiveStepComplete(pa: ProtectiveActionAnalysis): boolean {
  if (siteReceptorIssues(pa.siteAndReceptors?.settings ?? {}, pa.siteAndReceptors?.geometry).length) return false;
  return responseIssues({ ...pa, responseTiming: effectiveResponseTiming(pa) }, pa.siteAndReceptors).length === 0;
}
