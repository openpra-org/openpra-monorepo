import { createHash } from "crypto";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { RcCaseSnapshot, RcCategoryResult, RcResultStatistics } from "interfaces-mef-types/rc/case-records";
import type { RcConsequenceMetric } from "interfaces-mef-types/rc/metrics";
import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
import { caseChecks, caseFiles, caseReceptorCount, caseSnapshotMetrics, caseVersions, currentRcCase } from "interfaces-shared-types/rc-workbooks/case-records";
import { rcResultStatisticsText, withRcFamilyConsequences } from "interfaces-shared-types/rc-workbooks/family-consequences";
import { rcMetricUnit } from "interfaces-shared-types/rc-workbooks/metrics";

const Z95 = 1.6448536269514722;

export function exampleUuid(key: string): string {
  const hex = createHash("sha256").update(key).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

function normalQuantile(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const tail = (q: number) => (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)));
  if (p > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - p)));
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

const significant = (value: number) => Number(value.toPrecision(4));

export function exampleStatistics(metric: RcConsequenceMetric, median: number, distribution?: ParameterDistribution): RcResultStatistics {
  const sigma = distribution?.type === DistributionType.LOGNORMAL && distribution.errorFactor > 1 ? Math.log(distribution.errorFactor) / Z95 : 0;
  const center = distribution?.type === DistributionType.LOGNORMAL ? distribution.median : median;
  const quantile = (percentile: number) => sigma ? center * Math.exp(normalQuantile(percentile / 100) * sigma) : center;
  const exceed = (threshold: number) => center <= 0 ? 0 : sigma ? 1 - normalCdf((Math.log(threshold) - Math.log(center)) / sigma) : center > threshold ? 1 : 0;
  return {
    ...(metric.statistics.mean ? { mean: significant(center * Math.exp(sigma * sigma / 2)) } : {}),
    percentiles: metric.statistics.percentiles.map((percentile) => ({ percentile, value: significant(quantile(percentile)) })),
    exceedances: metric.statistics.exceedanceThresholds.map((threshold) => ({ threshold, probability: significant(exceed(threshold)) })),
  };
}

export function exampleResultsText(title: string, categoryId: string, snapshotLabel: string, metrics: RcConsequenceMetric[], results: RcCategoryResult[]): string {
  return [
    `${title}, ${categoryId}: illustrative category results`,
    "These values illustrate the workbook. No consequence code produced them.",
    `Input snapshot: ${snapshotLabel}`,
    "",
    ...results.map((result) => {
      const metric = metrics.find((entry) => entry.id === result.metricId);
      return `${result.metricId} ${metric?.name.trim() || result.metricId}: ${rcResultStatisticsText(result.statistics, result.unit)}`;
    }),
    "",
  ].join("\n");
}

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const size = (text: string) => Buffer.byteLength(text, "utf8");

export function withExampleCaseRecords(rc: RadiologicalConsequenceAnalysis, es: EventSequenceAnalysis, title: string, date: string): RadiologicalConsequenceAnalysis {
  const metrics = rc.scope.metrics ?? [], owner = rc.owner ?? "example";
  const legacy = rc.consequenceQuantification.eventSequenceConsequences;
  const snapshots: RcCaseSnapshot[] = [], results: RcCategoryResult[] = [];
  rc.releaseCategoryToConsequence.releaseCategoryInputs.forEach((category, index) => {
    const categoryId = category.releaseCategory, label = `Case ${String(index + 1).padStart(2, "0")}`;
    const data = currentRcCase(rc, categoryId), checks = caseChecks(data);
    const inputs = JSON.stringify({ inputs: data, checks, files: caseFiles(data) }, null, 2);
    const snapshot: RcCaseSnapshot = {
      id: exampleUuid(`${rc.uuid}:${categoryId}:snapshot`), label, categoryId,
      file: { documentId: exampleUuid(`${rc.uuid}:${categoryId}:snapshot-file`), filename: `${label.replace(" ", "-")}-inputs.json`, sha256: sha(inputs), size: size(inputs), uploadedAt: date },
      inputHash: sha(JSON.stringify(data)), createdBy: owner, reviewItems: checks.reduce((total, check) => total + check.items.length, 0),
      inventoryCount: data.source?.values.inventory.length ?? 0, receptorCount: caseReceptorCount(data), trialCount: data.weather?.trialSet?.trialCount ?? 0,
      metrics: caseSnapshotMetrics(data), versions: caseVersions(data),
    };
    snapshots.push(snapshot);
    const bounding = category.boundingMember?.sequenceId;
    const family = es.eventSequenceFamilies.find((entry) => bounding !== undefined && entry.memberSequenceIds.includes(bounding) && (category.eventSequenceFamilyReferences ?? []).some((reference) => reference.entityId === entry.uuid));
    const values = legacy.find((entry) => entry.eventSequenceFamily === family?.uuid)?.consequenceResults ?? [];
    const rows = metrics.flatMap((metric): RcCategoryResult[] => {
      const value = values.find((entry) => entry.metric === metric.name);
      if (!value) return [];
      return [{
        id: exampleUuid(`${rc.uuid}:${categoryId}:${metric.id}:result`), snapshotId: snapshot.id, categoryId, metricId: metric.id, unit: rcMetricUnit(metric),
        statistics: exampleStatistics(metric, value.meanValue, value.uncertaintyDistribution),
        version: "Illustrative values, no code run", reference: `${title} example, ${categoryId}`, confirmed: true,
        file: { documentId: exampleUuid(`${rc.uuid}:${categoryId}:results-file`), filename: `${title.replace(" ", "-")}-${categoryId}-illustrative-results.txt`, sha256: "", size: 1, uploadedAt: date },
        recordedBy: owner, valueSource: "transcribed",
      }];
    });
    const text = exampleResultsText(title, categoryId, label, metrics, rows);
    results.push(...rows.map((row) => ({ ...row, file: { ...row.file, sha256: sha(text), size: size(text) } })));
  });
  const kept = legacy.map((entry) => ({
    uuid: entry.uuid,
    eventSequenceFamily: entry.eventSequenceFamily,
    eventSequenceFamilyReference: rc.releaseCategoryToConsequence.releaseCategoryInputs.flatMap((category) => category.eventSequenceFamilyReferences ?? []).find((reference) => reference.entityId === entry.eventSequenceFamily),
    consequenceResults: [],
    ...(entry.riskSignificance === undefined ? {} : { riskSignificance: entry.riskSignificance }),
    origin: "CATEGORY_RESULT" as const,
  }));
  return withRcFamilyConsequences({
    ...rc,
    consequenceQuantification: { ...rc.consequenceQuantification, caseRecords: { revision: 1, snapshots, results }, eventSequenceConsequences: kept },
  });
}
