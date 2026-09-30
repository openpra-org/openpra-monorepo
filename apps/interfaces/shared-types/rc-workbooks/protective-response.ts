import type { ProtectiveActionAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcSiteReceptors } from "interfaces-mef-types/rc/site-receptors";
import { earlyResponseIssues } from "./early-response";

const order = ["GENERAL_EMERGENCY_DECLARATION", "SITE_NOTIFIES_OFFICIALS", "OFFICIALS_NOTIFY_PUBLIC",
  "PUBLIC_RECEIVES_INSTRUCTIONS", "SECURE_PERSONAL_PROPERTY", "LOAD_VEHICLES"] as const;

/** Keeps existing six-link estimates usable without assigning an unsupported shelter start. */
export function effectiveResponseTiming(pa: ProtectiveActionAnalysis): NonNullable<ProtectiveActionAnalysis["responseTiming"]> {
  const delays = pa.evacuationDelayComponents ?? [];
  const minutes = order.map(component => {
    const item = delays.find(entry => entry.component === component);
    if (!item) return undefined;
    if (item.minutes !== undefined) return item.minutes;
    const match = /^\s*\+?(\d+(?:\.\d+)?)\s*min\b/i.exec(item.estimate);
    return match ? Number(match[1]) : undefined;
  });
  const derivedDeparture = minutes.length === order.length && minutes.every(value => value !== undefined) && minutes[0] === 0
    ? minutes.reduce<number>((sum, value) => sum + value!, 0) : undefined;
  return {
    evacuationStartMinutes: derivedDeparture,
    evacuationSpeedMetresPerSecond: pa.evacuationSpeed?.speedMetresPerSecond,
    ...pa.responseTiming,
    referenceEvent: pa.responseTiming?.referenceEvent || "Emergency declaration",
    referenceAfterAccidentMinutes: pa.responseTiming?.referenceAfterAccidentMinutes ?? pa.responseTiming?.declarationAfterAccidentMinutes,
  };
}

export function responseIssues(response: Pick<ProtectiveActionAnalysis, "protectiveActionsIncluded" | "cohortModeling" | "responseTiming" | "earlyResponseModel"> | undefined, site?: RcSiteReceptors): string[] {
  if (!response) return [];
  if (response.earlyResponseModel) return earlyResponseIssues(response.earlyResponseModel, site);
  const issues: string[] = [];
  const actions = (response.protectiveActionsIncluded ?? []).filter(action => action.action === "SHELTERING" || action.action === "EVACUATION");
  if (new Set(actions.map(action => action.action)).size !== actions.length) issues.push("Keep one record for each early action in Step 02.");
  if (actions.some(action => !action.applicabilityJustification?.trim())) issues.push("Enter a basis for each early-action decision in Step 02.");
  const included = actions.filter(action => action.included);
  if (!included.length) return issues;
  const groups = response.cohortModeling?.cohorts ?? [];
  if (response.responseTiming?.cohortName && !groups.some(group => group.name === response.responseTiming!.cohortName)) issues.push("Choose an existing response group for the timeline in Step 02.");
  const validShare = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0 && value <= 100;
  const validTime = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0;
  if (!groups.length || groups.some(group => !group.name.trim() || !validShare(group.populationPercent) || !validShare(group.compliancePercent)) ||
    Math.abs(groups.reduce((total, group) => total + (group.populationPercent ?? 0), 0) - 100) > 1e-6)
    issues.push("Name the population groups and make their shares total 100% in Step 02.");
  const timing = response.responseTiming;
  if (!validTime(timing?.referenceAfterAccidentMinutes ?? timing?.declarationAfterAccidentMinutes)) issues.push("Enter when the response reference event occurred after accident start in Step 02.");
  if (included.some(action => action.action === "SHELTERING") && !validTime(timing?.shelterStartMinutes))
    issues.push("Enter the shelter start time in Step 02.");
  if (included.some(action => action.action === "EVACUATION") &&
    (!validTime(timing?.evacuationStartMinutes) || !(timing?.evacuationSpeedMetresPerSecond && Number.isFinite(timing.evacuationSpeedMetresPerSecond) && timing.evacuationSpeedMetresPerSecond > 0)))
    issues.push("Enter the evacuation start time and speed in Step 02.");
  if (timing?.shelterStartMinutes !== undefined && timing.evacuationStartMinutes !== undefined &&
    timing.evacuationStartMinutes < timing.shelterStartMinutes)
    issues.push("Evacuation cannot begin before sheltering in Step 02.");
  return issues;
}
