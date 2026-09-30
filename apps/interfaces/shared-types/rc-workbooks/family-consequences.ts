import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcCaseRecords, RcCategoryResult, RcResultStatistics } from "interfaces-mef-types/rc/case-records";
import type { RcConsequenceMetric } from "interfaces-mef-types/rc/metrics";
import type { EventSequenceFamilyWorkbookReference } from "interfaces-mef-types/modeling/references";
import { rcOrdinal } from "./metrics";

export type RcFamilyConsequence = RadiologicalConsequenceAnalysis["consequenceQuantification"]["eventSequenceConsequences"][number];
type ConsequenceResult = RcFamilyConsequence["consequenceResults"][number];

export function rcLatestCategoryResult(records: RcCaseRecords | undefined, categoryId: string, metricId: string): RcCategoryResult | undefined {
  return records?.results.filter((result) => result.categoryId === categoryId && result.metricId === metricId).at(-1);
}

export function sameFamilyReference(a: EventSequenceFamilyWorkbookReference | undefined, b: EventSequenceFamilyWorkbookReference): boolean {
  return a !== undefined && a.workbookId === b.workbookId && a.entityId === b.entityId;
}

export function rcConsequenceMatchesFamily(entry: RcFamilyConsequence, reference: EventSequenceFamilyWorkbookReference): boolean {
  return entry.eventSequenceFamilyReference === undefined ? entry.eventSequenceFamily === reference.entityId : sameFamilyReference(entry.eventSequenceFamilyReference, reference);
}

export function rcResultNumber(value: number): string {
  const rounded = Number(value.toPrecision(4));
  return rounded !== 0 && (Math.abs(rounded) >= 1e6 || Math.abs(rounded) < 1e-3) ? rounded.toExponential() : String(rounded);
}

export function rcResultStatisticsText(statistics: RcResultStatistics, unit: string): string {
  const withUnit = (value: number) => `${rcResultNumber(value)}${unit ? ` ${unit}` : ""}`;
  return [
    ...(statistics.mean === undefined ? [] : [`Mean ${withUnit(statistics.mean)}`]),
    ...[...statistics.percentiles].sort((a, b) => a.percentile - b.percentile).map((row) => `${rcOrdinal(row.percentile)} percentile ${withUnit(row.value)}`),
    ...[...statistics.exceedances].sort((a, b) => a.threshold - b.threshold).map((row) => `Chance of exceeding ${withUnit(row.threshold)}: ${rcResultNumber(row.probability)}`),
  ].join(" · ");
}

export function rcCategoryConsequenceResults(rc: RadiologicalConsequenceAnalysis, categoryId: string): ConsequenceResult[] {
  const records = rc.consequenceQuantification.caseRecords;
  return (rc.scope.metrics ?? []).flatMap((metric: RcConsequenceMetric) => {
    const result = rcLatestCategoryResult(records, categoryId, metric.id);
    if (result?.statistics.mean === undefined) return [];
    return [{
      metric: metric.name.trim() || metric.id,
      meanValue: result.statistics.mean,
      ...(result.unit ? { unit: result.unit } : {}),
      uncertaintyDescription: rcResultStatisticsText(result.statistics, result.unit),
    }];
  });
}

export function rcFamilyConsequences(rc: RadiologicalConsequenceAnalysis): RcFamilyConsequence[] {
  const current = rc.consequenceQuantification.eventSequenceConsequences;
  const kept = current.filter((entry) => entry.origin !== "CATEGORY_RESULT");
  const used = new Set(kept.flatMap((entry) => entry.uuid === undefined ? [] : [entry.uuid]));
  const derived: RcFamilyConsequence[] = [];
  for (const category of rc.releaseCategoryToConsequence.releaseCategoryInputs) {
    const results = rcCategoryConsequenceResults(rc, category.releaseCategory);
    if (!results.length) continue;
    for (const reference of category.eventSequenceFamilyReferences ?? []) {
      if (kept.some((entry) => rcConsequenceMatchesFamily(entry, reference))) continue;
      if (derived.some((entry) => sameFamilyReference(entry.eventSequenceFamilyReference, reference))) continue;
      const previous = current.find((entry) => entry.origin === "CATEGORY_RESULT" && sameFamilyReference(entry.eventSequenceFamilyReference, reference));
      const base = previous?.uuid ?? `RCQ-${reference.entityId}`;
      let uuid = base;
      for (let suffix = 2; used.has(uuid); suffix++) uuid = `${base}-${suffix}`;
      used.add(uuid);
      derived.push({
        uuid,
        eventSequenceFamily: reference.entityId,
        eventSequenceFamilyReference: reference,
        releaseCategoryReference: category.releaseCategory,
        ...(category.sourceTermDefinitionRef?.trim() ? { sourceTermReference: category.sourceTermDefinitionRef.trim() } : {}),
        consequenceResults: results,
        ...(previous?.riskSignificance === undefined ? {} : { riskSignificance: previous.riskSignificance }),
        origin: "CATEGORY_RESULT",
      });
    }
  }
  return [...derived, ...kept];
}

function canonical(entry: RcFamilyConsequence): RcFamilyConsequence {
  const reference = entry.eventSequenceFamilyReference;
  return {
    uuid: entry.uuid,
    eventSequenceFamily: entry.eventSequenceFamily,
    eventSequenceFamilyReference: reference && { referenceType: reference.referenceType, workbookId: reference.workbookId, entityId: reference.entityId },
    releaseCategoryReference: entry.releaseCategoryReference,
    sourceTermReference: entry.sourceTermReference,
    consequenceResults: entry.consequenceResults.map((result) => ({ metric: result.metric, meanValue: result.meanValue, unit: result.unit, uncertaintyDistribution: result.uncertaintyDistribution, uncertaintyDescription: result.uncertaintyDescription })),
    riskSignificance: entry.riskSignificance,
    origin: entry.origin,
    overrideReason: entry.overrideReason,
  };
}

export function withRcFamilyConsequences(rc: RadiologicalConsequenceAnalysis): RadiologicalConsequenceAnalysis {
  const next = rcFamilyConsequences(rc);
  if (JSON.stringify(next.map(canonical)) === JSON.stringify(rc.consequenceQuantification.eventSequenceConsequences.map(canonical))) return rc;
  return { ...rc, consequenceQuantification: { ...rc.consequenceQuantification, eventSequenceConsequences: next } };
}
