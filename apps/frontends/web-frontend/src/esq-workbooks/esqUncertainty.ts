import type {
  EsqModel,
  EsqSpread,
  EsqSolveRun,
  EsqUncertaintyRecord,
  EsqUncertaintyWork,
  EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import {
  ccfInputKey,
  eventInputKey,
  sampledInputsOf,
  uncertaintyInputsKey,
  type EsqSampledInput,
} from "interfaces-mef-types/esq/esq-measure-inputs";
import { resolvedRecoveries } from "interfaces-mef-types/esq/esq-post-inputs";
import { solveWorkOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { EsqUncertaintyRunResult, EventTreeSamplingMethod } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { modelViewOf, type EsqFindingSeverity } from "./esqModel";
import { sameLogic } from "./esqResults";
import type { EsqSolveWindowKind } from "./esqSolve";

type EsqUncertaintyWindowKind = "esqUncertInput";

interface EsqUncertaintyFinding {
  severity: EsqFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: EsqUncertaintyWindowKind | EsqSolveWindowKind; id: string };
}

interface EsqInputRow {
  input: EsqSampledInput;
  spread?: EsqSpread;
  significant: boolean;
  sampled: boolean;
}

interface EsqUncertaintyFamilyRow {
  familyId: string;
  name: string;
  release: boolean;
  stats?: EsqUncertaintyRecord["families"][number];
  independent?: EsqUncertaintyRecord["families"][number];
}

interface EsqUncertaintyView {
  model: EsqModel;
  work: EsqUncertaintyWork;
  inputs: EsqInputRow[];
  shared: EsqInputRow[];
  run?: EsqUncertaintyRecord;
  runStale: boolean;
  independent?: EsqUncertaintyRecord;
  independentStale: boolean;
  families: EsqUncertaintyFamilyRow[];
  solveRun?: EsqSolveRun;
  categoryTwo: boolean;
  findings: EsqUncertaintyFinding[];
}

const FINDING_RANK: Record<EsqFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const DEFAULT_TRIALS = 10_000;

const DEFAULT_SEED = 1;

const DEFAULT_METHOD: EventTreeSamplingMethod = "LATIN_HYPERCUBE";

const STANDARD_ERRORS = 3;

const METHOD_LABELS: Record<EventTreeSamplingMethod, string> = { MONTE_CARLO: "Monte Carlo", LATIN_HYPERCUBE: "Latin hypercube" };

const SOURCE_LABELS: Record<string, string> = {
  DA: "DA estimate",
  SY: "SY value",
  IE: "IE estimate",
  STEP_02: "Typed in Step 02",
  STEP_04: "Step 04 cell",
  STEP_06: "Typed in Step 06",
  TYPED: "Typed spread",
};

const INPUT_KIND_LABELS: Record<EsqSampledInput["kind"], string> = {
  PARAMETER: "DA parameter",
  HFE: "HFE",
  EVENT: "Typed event",
  RECOVERY: "Recovery",
  CCF_GROUP: "CCF group",
  INITIATOR: "Initiator",
  SPLIT: "Split fraction",
  CELL: "Barrier cell",
};

function uncertaintyWorkOf(esq: EventSequenceQuantification): EsqUncertaintyWork {
  return esq.uncertaintyWork ?? {};
}

function withUncertaintyWork(esq: EventSequenceQuantification, fn: (work: EsqUncertaintyWork) => EsqUncertaintyWork): EventSequenceQuantification {
  return { ...esq, uncertaintyWork: fn(uncertaintyWorkOf(esq)) };
}

function significantInputKeys(esq: EventSequenceQuantification): Set<string> {
  const keys = new Set<string>();
  const model = esq.model;
  const record = esq.review?.importance;
  if (model === undefined || record === undefined) return keys;
  const recoveries = new Map(resolvedRecoveries(esq).map((recovery) => [recovery.eventId, recovery.id]));
  const events = new Set(model.events.map((event) => event.id));
  for (const entry of record.significant) {
    const ref = entry.ref;
    if (entry.kind === "PARAMETER" || entry.kind === "HFE") {
      if (ref !== undefined) keys.add(`${entry.kind}:${ref}`);
      continue;
    }
    if (entry.kind === "CCF_GROUP") {
      if (ref !== undefined) keys.add(ccfInputKey(esq, model, ref));
      continue;
    }
    if (entry.kind !== "EVENT") continue;
    const eventId = entry.id.slice("EVENT:".length);
    const recoveryId = recoveries.get(eventId);
    if (recoveryId !== undefined) keys.add(`RECOVERY:${recoveryId}`);
    else if (events.has(eventId)) keys.add(eventInputKey(esq, model, eventId));
    else if (ref !== undefined && (ref.startsWith("CELL:") || ref.startsWith("PARAMETER:") || ref.startsWith("SPLIT:"))) keys.add(ref);
    else if (ref !== undefined && events.has(ref)) keys.add(eventInputKey(esq, model, ref));
  }
  return keys;
}

function inputRows(esq: EventSequenceQuantification): EsqInputRow[] {
  const significant = significantInputKeys(esq);
  const spreads = new Map((uncertaintyWorkOf(esq).spreads ?? []).map((spread) => [spread.key, spread]));
  return sampledInputsOf(esq).map((input) => {
    const row: EsqInputRow = { input, significant: significant.has(input.key), sampled: input.uncertain };
    const spread = input.contract ? undefined : spreads.get(input.key);
    if (spread !== undefined) row.spread = spread;
    return row;
  }).sort((a, b) => Number(b.significant) - Number(a.significant) || a.input.label.localeCompare(b.input.label));
}

function uncertaintyRecordOf(result: EsqUncertaintyRunResult): EsqUncertaintyRecord {
  const record: EsqUncertaintyRecord = {
    runId: result.runId,
    revision: result.owner.workbookRevision,
    at: result.completedAt,
    inputs: result.inputs,
    logic: { ...result.logic },
    trials: result.trials,
    seed: result.seed,
    method: result.method,
    correlation: result.correlation,
    families: result.families.map((family) => ({
      familyId: family.familyId,
      point: family.point,
      mean: family.mean,
      standardDeviation: family.standardDeviation,
      standardError: family.standardError,
      p05: family.p05,
      p50: family.p50,
      p95: family.p95,
    })),
  };
  if (result.total !== null) record.total = { ...result.total };
  return record;
}

function withUncertaintyRun(esq: EventSequenceQuantification, result: EsqUncertaintyRunResult): EventSequenceQuantification {
  const record = uncertaintyRecordOf(result);
  return withUncertaintyWork(esq, (work) => (result.correlation === "SHARED" ? { ...work, run: record } : { ...work, independent: record }));
}

function withSpread(esq: EventSequenceQuantification, key: string, spread: EsqSpread | undefined): EventSequenceQuantification {
  return withUncertaintyWork(esq, (work) => {
    const others = (work.spreads ?? []).filter((entry) => entry.key !== key);
    return { ...work, spreads: spread === undefined ? others : [...others, spread] };
  });
}

function uncertaintyRunProblem(result: EsqUncertaintyRunResult, esq: EventSequenceQuantification): string | undefined {
  const failed = result.trees.filter((tree) => tree.status === "FAILED").length;
  if (failed > 0) return `${failed} of ${result.trees.length} event trees failed. Fix them and run again.`;
  if (result.inputs !== uncertaintyInputsKey(esq)) return "The model, values or spreads changed during the run. Run again.";
  return undefined;
}

function standardErrors(stats: { mean: number; point: number; standardError: number }): number | undefined {
  if (!(stats.standardError > 0)) return undefined;
  return (stats.mean - stats.point) / stats.standardError;
}

function uncertaintyFindings(view: Omit<EsqUncertaintyView, "findings">): EsqUncertaintyFinding[] {
  const findings: EsqUncertaintyFinding[] = [];
  const run = view.run;
  if (run === undefined) {
    findings.push(view.categoryTwo
      ? { severity: "error", check: "No propagated mean", item: "Uncertainty", detail: "CC-II needs each family's mean with the state-of-knowledge correlation. Run the sampling with shared draws (ESQ-A5, ESQ-E2)." }
      : { severity: "warning", check: "Uncertainty not characterized", item: "Uncertainty", detail: "Run the sampling to give each family its mean and percentiles (ESQ-E2)." });
  } else {
    if (view.runStale) findings.push({ severity: "error", check: "Sampling older than its inputs", item: "Uncertainty", detail: "The model, values or spreads changed after the run. Run the sampling again." });
    if (view.solveRun !== undefined && !sameLogic(run.logic, view.solveRun.logic)) findings.push({ severity: "warning", check: "Sampled with other logic", item: "Uncertainty", detail: "The sampling used logic settings that differ from the run of record. Run it again." });
    for (const family of run.families) {
      const errors = standardErrors(family);
      if (errors === undefined || Math.abs(errors) <= STANDARD_ERRORS) continue;
      findings.push({ severity: "note", check: "Mean away from the point value", item: family.familyId, detail: `The sampled mean is ${Number(errors.toPrecision(3))} standard errors from the point value. Shared draws of skewed inputs raise the mean, so check that the difference comes from them (ESQ-E2).` });
    }
  }
  if (view.independent !== undefined && view.independentStale) findings.push({ severity: "warning", check: "Comparison older than its inputs", item: "Correlation", detail: "Run the comparison without shared draws again." });
  const fixed: string[] = [];
  for (const row of view.inputs) {
    if (row.sampled) continue;
    const target = { kind: "esqUncertInput" as const, id: row.input.key };
    if (row.significant) {
      findings.push(view.categoryTwo
        ? { severity: "error", check: "Risk-significant input without a distribution", item: row.input.label, detail: `${row.input.missing ?? "No distribution."} At CC-II every risk-significant input is propagated (ESQ-E2).`, target }
        : { severity: "warning", check: "Risk-significant input without a distribution", item: row.input.label, detail: row.input.missing ?? "No distribution.", target });
      continue;
    }
    fixed.push(row.input.label);
  }
  if (fixed.length > 0) {
    const shown = fixed.slice(0, 3).join(", ");
    findings.push({ severity: "warning", check: "Inputs at their point values", item: `${fixed.length} inputs`, detail: `${shown}${fixed.length > 3 ? ` and ${fixed.length - 3} more` : ""} have no distribution and stay fixed in every trial. Give component values a law in DA or SY. Type an error factor in the Inputs tab for the others.` });
  }
  for (const row of view.inputs) {
    if (row.spread !== undefined && row.spread.source.trim().length === 0) findings.push({ severity: "error", check: "Typed spread without a source", item: row.input.label, detail: "Name the document or judgment the error factor comes from.", target: { kind: "esqUncertInput", id: row.input.key } });
  }
  return findings.sort((a, b) => FINDING_RANK[a.severity] - FINDING_RANK[b.severity]);
}

function uncertaintyViewOf(esq: EventSequenceQuantification): EsqUncertaintyView | undefined {
  const modelView = modelViewOf(esq);
  if (modelView === undefined) return undefined;
  const work = uncertaintyWorkOf(esq);
  const inputs = inputRows(esq);
  const key = uncertaintyInputsKey(esq);
  const run = work.run;
  const independent = work.independent;
  const families = modelView.families.map((family): EsqUncertaintyFamilyRow => {
    const row: EsqUncertaintyFamilyRow = { familyId: family.id, name: family.name, release: family.release };
    const stats = run?.families.find((entry) => entry.familyId === family.id);
    const other = independent?.families.find((entry) => entry.familyId === family.id);
    if (stats !== undefined) row.stats = stats;
    if (other !== undefined) row.independent = other;
    return row;
  }).filter((row) => row.stats !== undefined || row.independent !== undefined);
  const solveRun = solveWorkOf(esq).run;
  const base: Omit<EsqUncertaintyView, "findings"> = {
    model: modelView.model,
    work,
    inputs,
    shared: inputs.filter((row) => row.input.users.length > 1 && row.sampled),
    runStale: run !== undefined && run.inputs !== key,
    independentStale: independent !== undefined && independent.inputs !== key,
    families,
    categoryTwo: esq.capabilityCategory !== "CC-I",
  };
  const withRun = run === undefined ? base : { ...base, run };
  const withIndependent = independent === undefined ? withRun : { ...withRun, independent };
  const full = solveRun === undefined ? withIndependent : { ...withIndependent, solveRun };
  return { ...full, findings: uncertaintyFindings(full) };
}

function uncertaintyComplete(esq: EventSequenceQuantification): boolean {
  const view = uncertaintyViewOf(esq);
  return view !== undefined && view.run !== undefined && !view.findings.some((finding) => finding.severity === "error");
}

export {
  DEFAULT_METHOD,
  DEFAULT_SEED,
  DEFAULT_TRIALS,
  INPUT_KIND_LABELS,
  METHOD_LABELS,
  SOURCE_LABELS,
  STANDARD_ERRORS,
  significantInputKeys,
  standardErrors,
  uncertaintyComplete,
  uncertaintyRecordOf,
  uncertaintyRunProblem,
  uncertaintyViewOf,
  uncertaintyWorkOf,
  withSpread,
  withUncertaintyRun,
  type EsqInputRow,
  type EsqUncertaintyFamilyRow,
  type EsqUncertaintyFinding,
  type EsqUncertaintyView,
  type EsqUncertaintyWindowKind,
};
