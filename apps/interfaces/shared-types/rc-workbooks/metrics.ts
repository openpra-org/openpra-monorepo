import type { RcConsequenceMetric, RcMetricQuantity, RcMetricReceptor, RcMetricWindow, RcMetricWindowStart } from "interfaces-mef-types/rc/metrics";
import type { RcEvaluationSubElement, RcScope } from "interfaces-mef-types/rc/radiological-consequence-analysis";

const HOUR = 3600;
const DAY = 86400;
const YEAR = 31557600;
const MILE_KM = 1.609344;

export const rcMetricQuantityLabels: Record<RcMetricQuantity, string> = {
  INDIVIDUAL_DOSE: "Individual dose (TEDE)",
  INDIVIDUAL_EARLY_FATALITY_RISK: "Individual early fatality risk",
  INDIVIDUAL_LATENT_CANCER_FATALITY_RISK: "Individual latent cancer fatality risk",
  POPULATION_DOSE: "Population dose",
  LAND_CONTAMINATION_AREA: "Contaminated land area",
  ECONOMIC_COST: "Economic cost",
  CUSTOM: "Custom measure",
};

export const rcMetricReceptorLabels: Record<RcMetricReceptor["kind"], string> = {
  EAB_MAXIMUM: "Highest value on the EAB",
  DISTANCE_PROFILE: "Highest value at each distance",
  AVERAGE_BEYOND_EAB: "Average individual within a distance of the EAB",
  WITHIN_RADIUS: "Everyone within a radius of the release",
  OTHER: "Other receptors",
};

export const rcMetricWindowStartLabels: Record<RcMetricWindowStart, string> = {
  RELEASE_ONSET: "Release onset",
  PLUME_ARRIVAL: "Plume arrival at the receptor",
};

export const rcMetricWindowUnits = [
  { id: "hours", label: "hours", seconds: HOUR },
  { id: "days", label: "days", seconds: DAY },
  { id: "years", label: "years", seconds: YEAR },
] as const;

export type RcMetricWindowUnit = (typeof rcMetricWindowUnits)[number]["id"];

const fixedUnits: Record<Exclude<RcMetricQuantity, "CUSTOM">, string> = {
  INDIVIDUAL_DOSE: "Sv",
  INDIVIDUAL_EARLY_FATALITY_RISK: "per event",
  INDIVIDUAL_LATENT_CANCER_FATALITY_RISK: "per event",
  POPULATION_DOSE: "person-Sv",
  LAND_CONTAMINATION_AREA: "km²",
  ECONOMIC_COST: "USD",
};

export function rcMetricUnit(metric: Pick<RcConsequenceMetric, "quantity" | "customUnit">): string {
  return metric.quantity === "CUSTOM" ? metric.customUnit?.trim() ?? "" : fixedUnits[metric.quantity];
}

function trim(value: number): string {
  return String(Number(value.toPrecision(6)));
}

function distance(km: number): string {
  const value = km / MILE_KM;
  return `${Number(km.toPrecision(4))} km${Math.abs(value - Math.round(value)) < 1e-6 ? ` (${Math.round(value)} mi)` : ""}`;
}

export function rcMetricReceptorText(receptor: RcMetricReceptor): string {
  switch (receptor.kind) {
    case "EAB_MAXIMUM": return rcMetricReceptorLabels.EAB_MAXIMUM;
    case "DISTANCE_PROFILE": return rcMetricReceptorLabels.DISTANCE_PROFILE;
    case "AVERAGE_BEYOND_EAB": return receptor.distanceKm === undefined ? "Average individual within a distance of the EAB, distance not set"
      : `Average individual within ${distance(receptor.distanceKm)} of the EAB`;
    case "WITHIN_RADIUS": return receptor.radiusKm === undefined ? "Everyone within a radius of the release, radius not set"
      : `Everyone within ${distance(receptor.radiusKm)} of the release`;
    case "OTHER": return receptor.description.trim() || "Other receptors, not described";
  }
}

export function rcMetricWindowUnit(seconds: number | undefined): RcMetricWindowUnit {
  if (seconds === undefined) return "days";
  if (seconds % YEAR === 0) return "years";
  if (seconds >= 5 * DAY && seconds % DAY === 0) return "days";
  if (seconds % HOUR === 0) return "hours";
  return seconds >= DAY ? "days" : "hours";
}

export function rcMetricWindowValue(seconds: number, unit: RcMetricWindowUnit): number {
  const size = rcMetricWindowUnits.find((item) => item.id === unit)?.seconds ?? DAY;
  return Number((seconds / size).toPrecision(8));
}

export function rcMetricDurationText(seconds: number): string {
  const unit = rcMetricWindowUnit(seconds);
  const value = rcMetricWindowValue(seconds, unit);
  return `${trim(value)} ${value === 1 ? unit.slice(0, -1) : unit}`;
}

export function rcMetricWindowText(window: RcMetricWindow | undefined): string {
  if (window === undefined) return "Not set";
  return `${rcMetricDurationText(window.seconds)} from ${rcMetricWindowStartLabels[window.start].toLowerCase()}`;
}

function remText(sievert: number): string {
  const rem = sievert * 100;
  return rem < 1 ? `${trim(rem * 1000)} mrem` : `${trim(rem)} rem`;
}

export function rcMetricThresholdText(metric: Pick<RcConsequenceMetric, "quantity" | "customUnit">, value: number): string {
  const unit = rcMetricUnit(metric);
  return metric.quantity === "INDIVIDUAL_DOSE" ? `${trim(value)} Sv (${remText(value)})` : `${trim(value)}${unit ? ` ${unit}` : ""}`;
}

export function rcOrdinal(value: number): string {
  const whole = Math.round(value);
  if (whole !== value) return `${trim(value)}th`;
  const tens = whole % 100, ones = whole % 10;
  if (tens >= 11 && tens <= 13) return `${whole}th`;
  return `${whole}${ones === 1 ? "st" : ones === 2 ? "nd" : ones === 3 ? "rd" : "th"}`;
}

export function rcMetricStatisticsText(metric: RcConsequenceMetric): string {
  const parts: string[] = [];
  if (metric.statistics.mean) parts.push("Mean");
  if (metric.statistics.percentiles.length) parts.push(`${metric.statistics.percentiles.map(rcOrdinal).join(", ")} ${metric.statistics.percentiles.length === 1 ? "percentile" : "percentiles"}`);
  if (metric.statistics.exceedanceThresholds.length) parts.push(`Chance of exceeding ${metric.statistics.exceedanceThresholds.map((value) => rcMetricThresholdText(metric, value)).join(", ")}`);
  return parts.join(" · ") || "None selected";
}

export function rcMetricMatchesMeasure(metricName: string, measureName: string): boolean {
  const a = metricName.trim().toLowerCase(), b = measureName.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  return [["latent", "cancer"], ["early", "fatal"], ["boundary", "dose"], ["population", "dose"]].some((tokens) => tokens.every((token) => a.includes(token) && b.includes(token)));
}

export type RcMetricEngineSupport = { status: "YES" | "NO" | "UNKNOWN"; reason: string };

export function rcMetricOpenRcSupport(metric: RcConsequenceMetric): RcMetricEngineSupport {
  if (metric.quantity === "CUSTOM") return { status: "UNKNOWN", reason: "Custom measures are not assessed against OpenRC." };
  if (metric.quantity === "INDIVIDUAL_EARLY_FATALITY_RISK" || metric.quantity === "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK")
    return { status: "NO", reason: "OpenRC has no health-effect model yet." };
  if (metric.quantity === "ECONOMIC_COST" || metric.quantity === "LAND_CONTAMINATION_AREA")
    return { status: "NO", reason: "OpenRC has no economic or land-contamination model yet." };
  if (metric.quantity === "POPULATION_DOSE") return { status: "NO", reason: "OpenRC reports dose at receptors, not population dose." };
  if (metric.protectiveActionsCredited) return { status: "NO", reason: "OpenRC has no protective-action model yet." };
  if (metric.receptor.kind === "EAB_MAXIMUM" || metric.receptor.kind === "DISTANCE_PROFILE")
    return { status: "YES", reason: "OpenRC returns TEDE per weather trial at each receptor." };
  return { status: "NO", reason: "OpenRC reports dose at receptors, not population averages." };
}

export function rcMetricIssues(metric: RcConsequenceMetric): string[] {
  const issues: string[] = [];
  if (!metric.name.trim()) issues.push("Name the metric.");
  if (metric.quantity === "CUSTOM" && !metric.customUnit?.trim()) issues.push("Give the unit of the custom measure.");
  if (metric.receptor.kind === "AVERAGE_BEYOND_EAB" && metric.receptor.distanceKm === undefined) issues.push("Set the distance beyond the EAB.");
  if (metric.receptor.kind === "WITHIN_RADIUS" && metric.receptor.radiusKm === undefined) issues.push("Set the radius from the release.");
  if (metric.receptor.kind === "OTHER" && !metric.receptor.description.trim()) issues.push("Describe the receptors.");
  if (metric.quantity !== "CUSTOM" && metric.window === undefined) issues.push("Set the exposure window.");
  if (!metric.statistics.mean && !metric.statistics.percentiles.length && !metric.statistics.exceedanceThresholds.length) issues.push("Choose at least one statistic.");
  if (!metric.criterion.trim()) issues.push("State the criterion or use.");
  if (!metric.basis.trim()) issues.push("Cite the basis.");
  return issues;
}

export const RC_METRIC_DEFAULT_EXCLUSION = "No selected metric needs it.";

export function rcMetricAspects(metric: RcConsequenceMetric): RcEvaluationSubElement[] {
  if (metric.quantity === "CUSTOM") return [];
  const aspects: RcEvaluationSubElement[] = ["RCPA", "RCME", "RCAD", "RCDO", "RCQ"];
  if (metric.quantity === "INDIVIDUAL_EARLY_FATALITY_RISK" || metric.quantity === "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK") aspects.push("RCHE");
  if (metric.quantity === "ECONOMIC_COST") aspects.push("RCEC");
  return aspects;
}

function metricsKnown(metrics: readonly RcConsequenceMetric[]): boolean {
  return metrics.length > 0 && metrics.every((metric) => metric.quantity !== "CUSTOM");
}

export interface RcAspectDecision {
  included: boolean | undefined;
  required: boolean;
  neededBy: RcConsequenceMetric[];
  exclusionReason?: string;
  defaulted: boolean;
}

export function rcAspectDecision(scope: Pick<RcScope, "metrics" | "evaluationDecisions">, aspect: RcEvaluationSubElement): RcAspectDecision {
  const metrics = scope.metrics ?? [];
  const neededBy = metrics.filter((metric) => rcMetricAspects(metric).includes(aspect));
  if (neededBy.length) return { included: true, required: true, neededBy, defaulted: false };
  const stored = scope.evaluationDecisions?.find((decision) => decision.subElement === aspect);
  if (stored) return { included: stored.included, required: false, neededBy, exclusionReason: stored.included ? undefined : stored.exclusionReason, defaulted: false };
  if (metricsKnown(metrics)) return { included: false, required: false, neededBy, exclusionReason: RC_METRIC_DEFAULT_EXCLUSION, defaulted: true };
  return { included: undefined, required: false, neededBy, defaulted: false };
}

export function rcMetricsCreditingProtectiveActions(metrics: readonly RcConsequenceMetric[] | undefined): RcConsequenceMetric[] {
  return (metrics ?? []).filter((metric) => metric.quantity !== "CUSTOM" && metric.protectiveActionsCredited);
}

export function rcProtectiveActionsNeeded(metrics: readonly RcConsequenceMetric[] | undefined): boolean {
  return !metricsKnown(metrics ?? []) || rcMetricsCreditingProtectiveActions(metrics).length > 0;
}

export function nextRcMetricId(metrics: readonly RcConsequenceMetric[]): string {
  const used = metrics.map((metric) => metric.id.startsWith("RCM-") ? Number(metric.id.slice(4)) : 0).filter(Number.isFinite);
  return `RCM-${String(Math.max(0, ...used) + 1).padStart(2, "0")}`;
}

export function rcMetricNumberList(text: string, accept: (value: number) => boolean): number[] {
  const values = text.split(",").map((part) => part.trim()).filter(Boolean).map(Number).filter((value) => Number.isFinite(value) && accept(value));
  return [...new Set(values)].sort((a, b) => a - b);
}

export const blankRcMetric: Omit<RcConsequenceMetric, "id"> = {
  name: "",
  quantity: "CUSTOM",
  customUnit: "",
  receptor: { kind: "OTHER", description: "" },
  protectiveActionsCredited: false,
  statistics: { mean: true, percentiles: [], exceedanceThresholds: [] },
  criterion: "",
  basis: "",
};

export const rcMetricPresets: { key: string; label: string; metric: Omit<RcConsequenceMetric, "id"> }[] = [
  {
    key: "lmp-fc",
    label: "30-day dose at the EAB (NEI 18-04 F-C Target)",
    metric: {
      name: "30-day dose at the EAB",
      quantity: "INDIVIDUAL_DOSE",
      receptor: { kind: "EAB_MAXIMUM" },
      window: { seconds: 30 * DAY, start: "RELEASE_ONSET" },
      protectiveActionsCredited: false,
      statistics: { mean: true, percentiles: [5, 50, 95], exceedanceThresholds: [0.001] },
      criterion: "Plotted with its frequency against the NEI 18-04 F-C Target, using the mean and the 5th to 95th percentile range. The LBE is risk significant when its 95th percentile dose exceeds 2.5 mrem and lies within 1% of the target. The chance of exceeding 100 mrem feeds the cumulative target of 1 per plant-year.",
      basis: "NEI 18-04 Rev. 1, Section 3.2.1 and Figure 3-1 (dose at the EAB for the 30 days after release onset), Section 3.2.2 (mean dose against the target), Section 3.3.5 (5th and 95th percentiles, cumulative targets, 2.5 mrem floor). Endorsed by RG 1.233.",
    },
  },
  {
    key: "epz",
    label: "96-hour dose by distance (RG 1.242 EPZ size)",
    metric: {
      name: "96-hour dose by distance",
      quantity: "INDIVIDUAL_DOSE",
      receptor: { kind: "DISTANCE_PROFILE" },
      window: { seconds: 96 * HOUR, start: "RELEASE_ONSET" },
      protectiveActionsCredited: false,
      statistics: { mean: true, percentiles: [50, 95], exceedanceThresholds: [0.01] },
      criterion: "The plume exposure pathway EPZ covers the area where this dose can exceed 10 mSv (1 rem). Outside the EPZ, design-basis accidents and most release sequences must stay below 1 rem. Etter (2026) takes the first distance where the 95th percentile falls below 1 rem.",
      basis: "10 CFR 50.160 and 10 CFR 50.33(g)(2). RG 1.242 Rev. 0, Appendix A: A-2(e) (96 hours from release onset, no protective-action credit), A-3.5 (peak centerline dose by distance), A-3.6 and A-3.7 (dose-distance curves and the chance of exceeding 1 rem).",
    },
  },
  {
    key: "qho-early",
    label: "Early fatality risk within 1 mile of the EAB (QHO)",
    metric: {
      name: "Early fatality risk within 1 mile of the EAB",
      quantity: "INDIVIDUAL_EARLY_FATALITY_RISK",
      receptor: { kind: "AVERAGE_BEYOND_EAB", distanceKm: MILE_KM },
      window: { seconds: 30 * DAY, start: "PLUME_ARRIVAL" },
      protectiveActionsCredited: true,
      statistics: { mean: true, percentiles: [5, 50, 95], exceedanceThresholds: [] },
      criterion: "RI multiplies this conditional risk by each LBE frequency and sums the products. The mean sum must stay below 5E-7 per plant-year (NRC safety goal QHO for early fatality).",
      basis: "NEI 18-04 Rev. 1, Section 3.3.5. RG 1.253 Rev. 0, Section C.5 (mean estimates, and the time period, dose pathways and protective actions may differ from the LBE dose). Etter (2026), Tables 2 and 5 (early fatality risk within 1 mile, 30-day early phase counted from plume arrival, response cohorts credited).",
    },
  },
  {
    key: "qho-latent",
    label: "Latent cancer fatality risk within 10 miles of the EAB (QHO)",
    metric: {
      name: "Latent cancer fatality risk within 10 miles of the EAB",
      quantity: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
      receptor: { kind: "AVERAGE_BEYOND_EAB", distanceKm: 10 * MILE_KM },
      window: { seconds: 30 * DAY, start: "PLUME_ARRIVAL" },
      protectiveActionsCredited: true,
      statistics: { mean: true, percentiles: [5, 50, 95], exceedanceThresholds: [] },
      criterion: "RI multiplies this conditional risk by each LBE frequency and sums the products. The mean sum must stay below 2E-6 per plant-year (NRC safety goal QHO for latent cancer).",
      basis: "NEI 18-04 Rev. 1, Section 3.3.5. RG 1.253 Rev. 0, Section C.5. Etter (2026), Tables 2 and 5 (latent cancer risk within 10 miles, 30-day early phase counted from plume arrival). SOARCA (NUREG-1935, Section 5.5) adds a 50-year long-term phase after a 1-week emergency phase.",
    },
  },
];
