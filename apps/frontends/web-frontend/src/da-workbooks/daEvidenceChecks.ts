import type { DaFailureRecord, DaRecordSet } from "interfaces-mef-types/da/data-analysis";
import { evidenceFailures, type CountEvidence, type CountLikelihood, type DiscreteOutcome, type EvidenceTerm, type Law } from "interfaces-mef-types/core/uncertainty";
import { operationAnswer } from "./daLaws";
import type { DaNeedFinding } from "./daSelectors";

interface DaCheckSink {
  findings: DaNeedFinding[];
  pending: boolean;
}

interface DaCounted {
  failures: number;
  outcomes?: DiscreteOutcome[];
}

type DaFindingTarget = DaNeedFinding["target"];

function decimalYear(text: string | undefined): number | undefined {
  if (text === undefined || text.trim().length === 0) return undefined;
  const parts = text.trim().split("-").map((part) => Number(part));
  const year = parts[0];
  if (year === undefined || !Number.isFinite(year)) return undefined;
  const month = parts[1];
  const day = parts[2];
  if (month === undefined || !Number.isFinite(month)) return year + 0.5;
  if (day === undefined || !Number.isFinite(day)) return year + (month - 0.5) / 12;
  return year + (month - 1) / 12 + (day - 0.5) / 365.25;
}

function countedRecords(set: DaRecordSet | undefined, parameterId: string): DaFailureRecord[] {
  return (set?.records ?? []).filter((record) => record.judgment === "FAILURE" && record.parameterId === parameterId);
}

function validOutcomes(outcomes: readonly DiscreteOutcome[] | undefined): outcomes is DiscreteOutcome[] {
  return outcomes !== undefined && outcomes.length > 0 && outcomes.every((outcome) => Number.isFinite(outcome.value) && outcome.value >= 0 && Number.isFinite(outcome.weight) && outcome.weight > 0);
}

function outcomesMean(outcomes: readonly DiscreteOutcome[]): number {
  return evidenceFailures({ likelihood: "UNCERTAIN_COUNT", count: "POISSON", outcomes: [...outcomes], exposure: 1 });
}

function combined(left: readonly DiscreteOutcome[], right: readonly DiscreteOutcome[]): DiscreteOutcome[] {
  const total = right.reduce((sum, outcome) => sum + outcome.weight, 0);
  const merged = new Map<number, number>();
  for (const first of left) {
    for (const second of right) {
      const value = first.value + second.value;
      merged.set(value, (merged.get(value) ?? 0) + (first.weight * second.weight) / total);
    }
  }
  return [...merged.entries()].sort(([a], [b]) => a - b).map(([value, weight]) => ({ value, weight }));
}

function recordCount(records: readonly DaFailureRecord[]): DaCounted {
  const uncertain = records.filter((record) => validOutcomes(record.countOutcomes));
  const certain = records.length - uncertain.length;
  if (uncertain.length === 0) return { failures: certain };
  let outcomes: DiscreteOutcome[] = [{ value: certain, weight: 1 }];
  for (const record of uncertain) outcomes = combined(outcomes, record.countOutcomes ?? []);
  return { failures: outcomesMean(outcomes), outcomes };
}

function typedCount(outcomes: readonly DiscreteOutcome[] | undefined): DaCounted | undefined {
  return validOutcomes(outcomes) ? { failures: outcomesMean(outcomes), outcomes: [...outcomes] } : undefined;
}

function highestCount(counted: DaCounted): number {
  return counted.outcomes === undefined ? counted.failures : Math.max(...counted.outcomes.map((outcome) => outcome.value));
}

function countTerm(likelihood: CountLikelihood, counted: DaCounted, exposure: number): EvidenceTerm {
  if (counted.outcomes === undefined) return { likelihood, failures: counted.failures, exposure };
  return { likelihood: "UNCERTAIN_COUNT", count: likelihood, outcomes: counted.outcomes.map((outcome) => ({ ...outcome })), exposure };
}

function countEvidence(terms: readonly EvidenceTerm[]): CountEvidence[] | undefined {
  const counts: CountEvidence[] = [];
  for (const term of terms) {
    if (term.likelihood !== "BINOMIAL" && term.likelihood !== "POISSON") return undefined;
    counts.push(term);
  }
  const first = counts[0];
  if (first === undefined || counts.some((term) => term.likelihood !== first.likelihood)) return undefined;
  return counts;
}

function pooledTerm(terms: readonly EvidenceTerm[]): CountEvidence | undefined {
  const counts = countEvidence(terms);
  const first = counts?.[0];
  if (counts === undefined || first === undefined) return undefined;
  return { likelihood: first.likelihood, failures: counts.reduce((total, term) => total + term.failures, 0), exposure: counts.reduce((total, term) => total + term.exposure, 0) };
}

function termsFailures(terms: readonly EvidenceTerm[]): number {
  return terms.reduce((total, term) => total + evidenceFailures(term), 0);
}

function sciShort(value: number): string {
  return Number(value.toPrecision(2)).toExponential().replace("e+", "E").replace("e", "E");
}

function conflictCheck(sink: DaCheckSink, prior: Law, terms: readonly EvidenceTerm[], item: string, target: DaFindingTarget, explained: boolean, operating: boolean): void {
  const pooled = pooledTerm(terms);
  if (pooled === undefined) return;
  const answer = operationAnswer({ kind: "PRIOR_PREDICTIVE", law: prior, term: pooled });
  if (answer.status === "pending") {
    sink.pending = true;
    return;
  }
  if (answer.status !== "ready" || !("expected" in answer.value)) return;
  const predictive = answer.value;
  const p = pooled.failures >= predictive.expected ? predictive.atLeast : predictive.atMost;
  if (p < 0.05) sink.findings.push({ severity: explained ? "note" : "warning", check: "Prior and evidence conflict", item, detail: `${pooled.failures} ${pooled.failures === 1 ? "failure" : "failures"} against ${Number(predictive.expected.toPrecision(3))} expected under the prior, P = ${sciShort(p)}. Investigate before updating (${operating ? "DA-D4" : "DA-D5"}).`, target });
}

function homogeneityCheck(sink: DaCheckSink, terms: readonly EvidenceTerm[], item: string, target: DaFindingTarget): void {
  const counts = countEvidence(terms);
  if (counts === undefined || counts.length < 2 || !counts.some((term) => term.failures > 0)) return;
  const answer = operationAnswer({ kind: "HOMOGENEITY", terms: counts });
  if (answer.status === "pending") {
    sink.pending = true;
    return;
  }
  if (answer.status === "ready" && "smallExpected" in answer.value && answer.value.probability < 0.05) sink.findings.push({ severity: "warning", check: "Sets differ", item, detail: `The evidence sets do not pool (chi-square P = ${sciShort(answer.value.probability)}${answer.value.smallExpected ? ", small counts" : ""}). Use population variability or empirical Bayes, or split the parameter (DA-B2).`, target });
}

function recordTrendCheck(sink: DaCheckSink, set: DaRecordSet | undefined, parameterId: string, label: string, yearsFrom: string | undefined, yearsTo: string | undefined, item: string, target: DaFindingTarget): void {
  const times = countedRecords(set, parameterId).flatMap((record) => {
    const at = decimalYear(record.date);
    return at === undefined ? [] : [at];
  });
  const start = decimalYear(yearsFrom);
  const end = decimalYear(yearsTo);
  if (start === undefined || end === undefined || times.length < 3) return;
  const answer = operationAnswer({ kind: "LAPLACE_TREND", times, start: Math.floor(start), end: Math.floor(end) + 1 });
  if (answer.status === "pending") {
    sink.pending = true;
    return;
  }
  if (answer.status === "ready" && "statistic" in answer.value && !("degreesOfFreedom" in answer.value) && answer.value.probability < 0.05) sink.findings.push({ severity: "warning", check: "Trend", item, detail: `The counted failures in ${label} ${answer.value.statistic > 0 ? "rise" : "fall"} over time (Laplace test P = ${sciShort(answer.value.probability)}). A constant rate may not hold. Use a trend estimate or explain it (DA-B2).`, target });
}

export {
  combined,
  conflictCheck,
  countEvidence,
  countTerm,
  countedRecords,
  decimalYear,
  highestCount,
  homogeneityCheck,
  pooledTerm,
  recordCount,
  recordTrendCheck,
  sciShort,
  termsFailures,
  typedCount,
  validOutcomes,
  type DaCheckSink,
  type DaCounted,
};
