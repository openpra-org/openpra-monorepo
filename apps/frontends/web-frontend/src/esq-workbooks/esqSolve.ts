import {
  ESQ_PLAN_DEFAULTS,
  type EsqCutOffBasis,
  type EsqCutSetQuantifier,
  type EsqFamilyRunValue,
  type EsqFamilySolve,
  type EsqFamilyValueSource,
  type EsqModel,
  type EsqSolveCalculation,
  type EsqSolveRun,
  type EsqSolveSweepPoint,
  type EsqSolveWork,
  type EventSequenceFamilyQuantification,
  type EventSequenceQuantification,
  type SequenceFrequencyEstimate,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { solveInputsKey, solveWorkOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { EsqModelRunResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { modelViewOf, type EsqFamilyView, type EsqFindingSeverity } from "./esqModel";

type EsqSolveWindowKind = "esqSolveFamily" | "esqSolveRun";

interface EsqSolveFinding {
  severity: EsqFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: EsqSolveWindowKind; id: string };
}

interface EsqConvergence {
  changes: (number | undefined)[];
  convergedAt?: number;
}

interface EsqSolveStateView {
  stateId: string;
  name: string;
  annualFrequency: number;
  sweep: EsqSolveSweepPoint[];
  convergence: EsqConvergence;
}

interface EsqSolveFamilyView {
  id: string;
  name: string;
  family: EsqFamilyView;
  solve?: EsqFamilySolve;
  needsValue: boolean;
  value?: number;
  source?: EsqFamilyValueSource;
  convergence?: EsqConvergence;
  states: EsqSolveStateView[];
  esFrequency?: number;
}

interface EsqSolveView {
  model: EsqModel;
  work: EsqSolveWork;
  run?: EsqSolveRun;
  stale: boolean;
  stepPercent: number;
  families: EsqSolveFamilyView[];
  findings: EsqSolveFinding[];
}

interface EsqRunConvergence {
  id: string;
  sweep: EsqSolveSweepPoint[];
  convergence: EsqConvergence;
  states: EsqSolveStateView[];
}

const RARE_EVENT_LIMIT = 0.1;

const DEPTH_DECADES = 5;

const FINDING_RANK: Record<EsqFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const CALCULATION_LABELS: Record<EsqSolveCalculation, string> = { EXACT: "Exact", CUT_SETS: "Cut sets" };

const QUANTIFIER_LABELS: Record<EsqCutSetQuantifier, string> = { MCUB: "Upper bound", EXACT: "Exact", RARE_EVENT: "Rare event" };

const BASIS_LABELS: Record<EsqCutOffBasis, string> = { FREQUENCY: "Frequency per year", PROBABILITY: "Probability" };

const SOURCE_LABELS: Record<EsqFamilyValueSource, string> = { RUN: "PRAXIS run", TYPED: "Typed", IMPORTED: "Imported from ES" };

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function frequencyValue(value: number | { value: number } | undefined): number | undefined {
  if (value === undefined) return undefined;
  const number = typeof value === "number" ? value : value.value;
  return Number.isFinite(number) ? number : undefined;
}

function cutOffsFrom(highest: number, lowest: number): number[] {
  const out: number[] = [];
  for (let exponent = highest; exponent >= lowest; exponent -= 1) out.push(Number(`1e${exponent}`));
  return out;
}

function convergenceOf(sweep: readonly EsqSolveSweepPoint[], stepPercent: number): EsqConvergence {
  const changes = sweep.map((point, index) => {
    if (index === 0) return undefined;
    const previous = sweep[index - 1]?.annualFrequency ?? 0;
    if (previous === 0) return point.annualFrequency === 0 ? 0 : Number.POSITIVE_INFINITY;
    return (100 * (point.annualFrequency - previous)) / previous;
  });
  const out: EsqConvergence = { changes };
  for (let index = 2; index < sweep.length; index += 1) {
    const current = changes[index];
    const before = changes[index - 1];
    if (current === undefined || before === undefined) continue;
    const size = Math.abs(current);
    if (size < stepPercent && (size === 0 || size < Math.abs(before))) {
      const point = sweep[index];
      if (point !== undefined) out.convergedAt = point.cutOff;
      break;
    }
  }
  return out;
}

function stateViewOf(state: { stateId: string; annualFrequency: number; sweep: EsqSolveSweepPoint[] }, stateName: ReadonlyMap<string, string>, stepPercent: number): EsqSolveStateView {
  return {
    stateId: state.stateId,
    name: stateName.get(state.stateId) ?? state.stateId,
    annualFrequency: state.annualFrequency,
    sweep: state.sweep,
    convergence: convergenceOf(state.sweep, stepPercent),
  };
}

function lastChange(convergence: EsqConvergence | undefined): number | undefined {
  const changes = convergence?.changes ?? [];
  return changes[changes.length - 1];
}

function familyValueOf(entry: EsqFamilySolve | undefined): number | undefined {
  if (entry === undefined) return undefined;
  if (entry.ofRecord === "RUN") return entry.run?.annualFrequency;
  if (entry.ofRecord === "TYPED") return entry.typed?.annualFrequency;
  if (entry.ofRecord === "IMPORTED") return entry.imported?.annualFrequency;
  return undefined;
}

function effectiveCutOff(run: EsqSolveRun): number | undefined {
  const lowest = run.cutOffs?.[run.cutOffs.length - 1];
  if (lowest === undefined) return undefined;
  return run.basis === "PROBABILITY" ? lowest * (run.peakInitiatorFrequency ?? 1) : lowest;
}

function pctText(value: number | undefined): string {
  if (value === undefined) return "—";
  if (!Number.isFinite(value)) return "new";
  const size = Math.abs(value);
  if (size === 0) return "0%";
  return `${size < 0.01 ? value.toExponential(1).replace("e", "E") : value.toFixed(2)}%`;
}

function solveFindings(view: Omit<EsqSolveView, "findings">): EsqSolveFinding[] {
  const findings: EsqSolveFinding[] = [];
  const run = view.run;
  if (run !== undefined && view.stale) {
    findings.push({ severity: "error", check: "Result older than its inputs", item: "Run of record", detail: "The model, logic or values changed after the run of record. Run the model again and use the new run.", target: { kind: "esqSolveRun", id: "run" } });
  }
  if (run?.quantifier === "RARE_EVENT" && (run.peakProbability ?? 0) > RARE_EVENT_LIMIT && blank(view.work.rareEventReason)) {
    findings.push({ severity: "error", check: "Rare event above 0.1 without a reason", item: "Run of record", detail: `A sequence reaches ${(run.peakProbability ?? 0).toPrecision(3)} given its initiator. Record why the rare event sum is acceptable (ESQ-N-5), or use the upper bound or exact.`, target: { kind: "esqSolveRun", id: "run" } });
  }
  for (const family of view.families) {
    const target = { kind: "esqSolveFamily" as const, id: family.id };
    if (family.needsValue && family.value === undefined) {
      findings.push({ severity: "error", check: "No value of record", item: family.id, detail: "Use a run, type a value with its source, or import one.", target });
    }
    const solve = family.solve;
    if (solve?.ofRecord === "TYPED" && blank(solve.typed?.source)) {
      findings.push({ severity: "error", check: "Typed value without a source", item: family.id, detail: "Name the document or calculation the typed frequency comes from.", target });
    }
    if ((solve?.ofRecord === "TYPED" || solve?.ofRecord === "IMPORTED") && solve.run !== undefined && blank(solve.reason)) {
      findings.push({ severity: "warning", check: "Run value set aside", item: family.id, detail: "The value of record is not the PRAXIS run. Record why.", target });
    }
    if (family.source !== "RUN" || run?.calculation !== "CUT_SETS") continue;
    if (family.value === 0) {
      findings.push({ severity: "warning", check: "Below the lowest cutoff", item: family.id, detail: "No cut set of this family reaches the lowest cutoff. Lower the cutoff to quantify it.", target });
      continue;
    }
    if (family.convergence !== undefined && family.convergence.convergedAt === undefined) {
      findings.push({ severity: "error", check: "Not converged at its cutoff", item: family.id, detail: `The last one-decade step changes the family by ${pctText(lastChange(family.convergence))}. Lower the cutoff and run again (ESQ-B3).`, target });
    }
    for (const state of family.states) {
      if (state.annualFrequency > 0 && state.convergence.convergedAt === undefined) {
        findings.push({ severity: "warning", check: "Operating state not converged", item: `${family.id} · ${state.stateId}`, detail: `The last step changes this state's share by ${pctText(lastChange(state.convergence))}.`, target });
      }
    }
  }
  if (run?.calculation === "CUT_SETS") {
    const cutOff = effectiveCutOff(run);
    const smallest = view.families.reduce<number | undefined>((least, family) => (family.source === "RUN" && family.value !== undefined && family.value > 0 && (least === undefined || family.value < least) ? family.value : least), undefined);
    if (cutOff !== undefined && smallest !== undefined && cutOff * 10 ** DEPTH_DECADES > smallest) {
      findings.push({ severity: "warning", check: "Cutoff too close to a family", item: "Run of record", detail: `The lowest cutoff of ${cutOff.toExponential(1)} per year is less than five decades below the smallest family, ${smallest.toExponential(2)} per year.`, target: { kind: "esqSolveRun", id: "run" } });
    }
  }
  if (run !== undefined && !view.families.some((family) => family.solve?.typed !== undefined || family.solve?.imported !== undefined)) {
    findings.push({ severity: "note", check: "No independent comparison", item: "Verification", detail: "No family has a typed or imported value beside its PRAXIS value (ESQ-B1)." });
  }
  return [...findings].sort((a, b) => FINDING_RANK[a.severity] - FINDING_RANK[b.severity]);
}

function solveViewOf(esq: EventSequenceQuantification, es?: EventSequenceAnalysis): EsqSolveView | undefined {
  const modelView = modelViewOf(esq);
  if (modelView === undefined) return undefined;
  const work = solveWorkOf(esq);
  const stepPercent = esq.quantificationPlan?.convergenceStepPercent?.value ?? ESQ_PLAN_DEFAULTS.convergenceStepPercent;
  const stateName = new Map(modelView.model.states.map((state) => [state.id, state.name]));
  const cutSetRun = work.run?.calculation === "CUT_SETS";
  const families = modelView.families.map((family): EsqSolveFamilyView => {
    const solve = work.families.find((entry) => entry.familyId === family.id);
    const runValue = solve?.run;
    const view: EsqSolveFamilyView = {
      id: family.id,
      name: family.name,
      family,
      needsValue: family.manual || family.members.length > 0,
      states: (runValue?.states ?? []).map((state) => stateViewOf(state, stateName, stepPercent)),
    };
    if (solve !== undefined) view.solve = solve;
    const value = familyValueOf(solve);
    if (value !== undefined && solve?.ofRecord !== undefined) {
      view.value = value;
      view.source = solve.ofRecord;
    }
    if (cutSetRun && runValue !== undefined && runValue.sweep.length > 0) view.convergence = convergenceOf(runValue.sweep, stepPercent);
    const esFrequency = frequencyValue(es?.eventSequenceFamilies.find((candidate) => candidate.uuid === family.id)?.meanFrequency);
    if (esFrequency !== undefined) view.esFrequency = esFrequency;
    return view;
  });
  const base: Omit<EsqSolveView, "findings"> = {
    model: modelView.model,
    work,
    stale: work.run !== undefined && work.run.inputs !== solveInputsKey(esq),
    stepPercent,
    families,
  };
  const withRun = work.run === undefined ? base : { ...base, run: work.run };
  return { ...withRun, findings: solveFindings(withRun) };
}

function runConvergenceOf(summary: EsqModelRunResult, view: EsqSolveView): EsqRunConvergence[] {
  if (summary.calculation !== "CUT_SETS") return [];
  const stateName = new Map(view.model.states.map((state) => [state.id, state.name]));
  return summary.families
    .filter((family) => family.sweep.length > 0)
    .map((family) => ({
      id: family.familyId,
      sweep: family.sweep,
      convergence: convergenceOf(family.sweep, view.stepPercent),
      states: family.states.map((state) => stateViewOf(state, stateName, view.stepPercent)),
    }));
}

function solveComplete(esq: EventSequenceQuantification): boolean {
  const view = solveViewOf(esq);
  return view !== undefined && view.families.some((family) => family.value !== undefined) && !view.findings.some((finding) => finding.severity === "error");
}

function familyQuantificationsOf(esq: EventSequenceQuantification): EventSequenceFamilyQuantification[] {
  const work = solveWorkOf(esq);
  const refOf = (quantification: EventSequenceFamilyQuantification): string => quantification.eventSequenceFamilyReference?.entityId ?? quantification.eventSequenceFamilyRef;
  const names = new Map((modelViewOf(esq)?.families ?? []).map((family) => [family.id, family.name]));
  const valued = work.families.flatMap((entry) => {
    const value = familyValueOf(entry);
    return value === undefined ? [] : [{ entry, value }];
  });
  const ids = new Set(valued.map(({ entry }) => entry.familyId));
  const kept = esq.familyQuantifications.filter((quantification) => !ids.has(refOf(quantification)));
  const derived = valued.map(({ entry, value }): EventSequenceFamilyQuantification => {
    const prior = esq.familyQuantifications.find((quantification) => refOf(quantification) === entry.familyId);
    const record: EventSequenceFamilyQuantification = {
      uuid: `EFQ-${entry.familyId}`,
      name: names.get(entry.familyId) ?? prior?.name ?? entry.familyId,
      eventSequenceFamilyRef: entry.familyId,
      dependenciesConsideredInGrouping: prior?.dependenciesConsideredInGrouping ?? true,
      quantificationBasis: "POINT_ESTIMATE",
      meanFrequency: value,
      implementsSrs: [{ sr: "ESQ-A4", hlr: "A" }, { sr: "ESQ-A5", hlr: "A" }],
    };
    if (prior?.eventSequenceFamilyReference !== undefined) record.eventSequenceFamilyReference = prior.eventSequenceFamilyReference;
    if (prior?.crossSourceGroupingJustification !== undefined) record.crossSourceGroupingJustification = prior.crossSourceGroupingJustification;
    if (prior?.crossPosGroupingJustification !== undefined) record.crossPosGroupingJustification = prior.crossPosGroupingJustification;
    if (prior?.representativeSequenceSelectionBasis !== undefined) record.representativeSequenceSelectionBasis = prior.representativeSequenceSelectionBasis;
    return record;
  });
  return [...kept, ...derived];
}

function withSolveWork(esq: EventSequenceQuantification, fn: (work: EsqSolveWork) => EsqSolveWork): EventSequenceQuantification {
  const next = { ...esq, solve: fn(solveWorkOf(esq)) };
  return { ...next, familyQuantifications: familyQuantificationsOf(next) };
}

function withFamilySolve(esq: EventSequenceQuantification, familyId: string, next: EsqFamilySolve | undefined): EventSequenceQuantification {
  return withSolveWork(esq, (work) => ({
    ...work,
    families: [...work.families.filter((entry) => entry.familyId !== familyId), ...(next === undefined ? [] : [next])],
  }));
}

function withRareEventReason(esq: EventSequenceQuantification, reason: string): EventSequenceQuantification {
  return withSolveWork(esq, (work) => {
    const { rareEventReason: _old, ...rest } = work;
    return reason.trim().length === 0 ? rest : { ...rest, rareEventReason: reason };
  });
}

function runOfRecord(summary: EsqModelRunResult): EsqSolveRun {
  const peakInitiator = summary.trees.reduce((most, tree) => Math.max(most, tree.initiatorFrequency ?? 0), 0);
  const run: EsqSolveRun = {
    runId: summary.runId,
    revision: summary.owner.workbookRevision,
    at: summary.completedAt,
    inputs: summary.inputs,
    calculation: summary.calculation,
    logic: { ...summary.logic },
  };
  const settings = summary.cutSets;
  if (settings !== null) {
    run.basis = settings.basis;
    run.quantifier = settings.quantifier;
    run.cutOffs = [...settings.cutOffs];
    if (settings.limitOrder !== undefined) run.limitOrder = settings.limitOrder;
  }
  if (summary.peakProbability !== null) run.peakProbability = summary.peakProbability;
  if (peakInitiator > 0) run.peakInitiatorFrequency = peakInitiator;
  return run;
}

function sequenceEstimatesOf(summary: EsqModelRunResult): SequenceFrequencyEstimate[] {
  const totals = new Map<string, number>();
  for (const sequence of summary.sequences) {
    const id = sequence.sequenceIds[sequence.sequenceIds.length - 1];
    if (id === undefined) continue;
    totals.set(id, (totals.get(id) ?? 0) + sequence.annualFrequency);
  }
  return [...totals.entries()].map(([id, total]) => ({
    uuid: `SFE-${id}`,
    eventSequenceRef: id,
    meanFrequency: total,
    implementsSrs: [{ sr: "ESQ-A4", hlr: "A" }],
  }));
}

function withRunOfRecord(esq: EventSequenceQuantification, summary: EsqModelRunResult): EventSequenceQuantification {
  const next = withSolveWork(esq, (work) => {
    const byId = new Map(summary.families.map((family) => [family.familyId, family]));
    const families = work.families.map((entry): EsqFamilySolve => {
      const family = byId.get(entry.familyId);
      const { run: _run, ofRecord, ...rest } = entry;
      if (family === undefined) return ofRecord === undefined || ofRecord === "RUN" ? rest : { ...rest, ofRecord };
      return { ...rest, ofRecord: "RUN", run: runValueOf(family) };
    });
    const known = new Set(work.families.map((entry) => entry.familyId));
    const added = summary.families
      .filter((family) => !known.has(family.familyId))
      .map((family): EsqFamilySolve => ({ familyId: family.familyId, ofRecord: "RUN", run: runValueOf(family) }));
    return { ...work, run: runOfRecord(summary), families: [...families, ...added] };
  });
  return { ...next, sequenceFrequencyEstimates: sequenceEstimatesOf(summary) };
}

function runValueOf(family: EsqModelRunResult["families"][number]): EsqFamilyRunValue {
  const value: EsqFamilyRunValue = {
    annualFrequency: family.annualFrequency,
    sequenceCount: family.sequenceCount,
    sweep: family.sweep.map((point) => ({ ...point })),
    states: family.states.map((state) => ({ stateId: state.stateId, annualFrequency: state.annualFrequency, sweep: state.sweep.map((point) => ({ ...point })) })),
  };
  if (family.cutSetCount !== null) value.cutSetCount = family.cutSetCount;
  return value;
}

function summaryProblem(summary: EsqModelRunResult, esq: EventSequenceQuantification): string | undefined {
  const failed = summary.trees.filter((tree) => tree.status === "FAILED").length;
  if (failed > 0) return `${failed} of ${summary.trees.length} event trees failed in this run. Fix them and run again before using it.`;
  if (summary.inputs !== solveInputsKey(esq)) return "The model, logic or values changed after this run. Run again before using it.";
  return undefined;
}

export {
  BASIS_LABELS,
  CALCULATION_LABELS,
  QUANTIFIER_LABELS,
  RARE_EVENT_LIMIT,
  SOURCE_LABELS,
  convergenceOf,
  cutOffsFrom,
  familyValueOf,
  lastChange,
  pctText,
  runConvergenceOf,
  solveComplete,
  solveViewOf,
  summaryProblem,
  withFamilySolve,
  withRareEventReason,
  withRunOfRecord,
  type EsqConvergence,
  type EsqRunConvergence,
  type EsqSolveFamilyView,
  type EsqSolveFinding,
  type EsqSolveStateView,
  type EsqSolveView,
  type EsqSolveWindowKind,
};
