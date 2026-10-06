import type { EsqSequenceRecord, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqSequenceRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import { sequenceFamilyOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import type {
  EsqModelRunCutSet,
  EsqModelRunFamily,
  EsqModelRunRequest,
  EsqModelRunResult,
  EsqModelRunSequence,
  EsqModelRunSweepPoint,
  WorkbookModelSnapshotIdentity,
} from "interfaces-shared-types/newly-developed-methods";
import type { EsqTreeRunOutcome } from "../newly-developed-methods/shared/workbook-analysis-runs.service";

interface EsqModelRunSummaryInput {
  esq: EventSequenceQuantification;
  request: EsqModelRunRequest;
  batchId: string;
  owner: WorkbookModelSnapshotIdentity;
  completedAt: string;
  inputs: string;
  outcomes: EsqTreeRunOutcome[];
  eventCodes: Record<string, string>;
}

interface FamilyTotals {
  annualFrequency: number;
  sequenceCount: number;
  cutSetCount: number;
  sweep: EsqModelRunSweepPoint[];
  states: Map<string, { annualFrequency: number; sweep: EsqModelRunSweepPoint[] }>;
  cutSets: EsqModelRunCutSet[];
}

function emptySweep(cutOffs: readonly number[]): EsqModelRunSweepPoint[] {
  return cutOffs.map((cutOff) => ({ cutOff, count: 0, annualFrequency: 0 }));
}

function addSweep(target: EsqModelRunSweepPoint[], points: readonly { count: number; annualFrequency: number }[]): void {
  points.forEach((point, index) => {
    const slot = target[index];
    if (slot === undefined) return;
    slot.count += point.count;
    slot.annualFrequency += point.annualFrequency;
  });
}

function summarizeEsqModelRun(input: EsqModelRunSummaryInput): EsqModelRunResult {
  const model = input.esq.model;
  const cutOffs = input.request.cutSets?.cutOffs ?? [];
  const keep = input.request.cutSets?.keep ?? 0;
  const byRunId = new Map<string, EsqSequenceRecord>((model?.sequences ?? []).map((record) => [esqSequenceRunId(record.treeId, record.id), record]));
  const stateOf = new Map((model?.trees ?? []).map((tree) => [tree.id, tree.stateId]));
  const families = new Map<string, FamilyTotals>();
  const familyOf = (familyId: string): FamilyTotals => {
    const existing = families.get(familyId);
    if (existing !== undefined) return existing;
    const created: FamilyTotals = { annualFrequency: 0, sequenceCount: 0, cutSetCount: 0, sweep: emptySweep(cutOffs), states: new Map(), cutSets: [] };
    families.set(familyId, created);
    return created;
  };
  const stateTotals = (totals: FamilyTotals, stateId: string): { annualFrequency: number; sweep: EsqModelRunSweepPoint[] } => {
    const existing = totals.states.get(stateId);
    if (existing !== undefined) return existing;
    const created = { annualFrequency: 0, sweep: emptySweep(cutOffs) };
    totals.states.set(stateId, created);
    return created;
  };
  const sequences: EsqModelRunSequence[] = [];
  const endStates = new Map<string, number>();
  let peak: number | null = null;
  const cutSetRun = input.request.calculation === "CUT_SETS";

  for (const outcome of input.outcomes) {
    const result = outcome.result;
    if (outcome.status !== "SUCCEEDED" || result === null) continue;
    const stateId = stateOf.get(outcome.treeId);
    for (const entry of result.sequences) {
      const chain = entry.sequenceChain === undefined ? [entry.sequenceId] : entry.sequenceChain.map((link) => link.entityId);
      const records = chain.flatMap((id) => {
        const record = byRunId.get(id);
        return record === undefined ? [] : [record];
      });
      const final = records[records.length - 1];
      const familyId = final === undefined ? undefined : sequenceFamilyOf(input.esq, final);
      sequences.push({
        treeId: outcome.treeId,
        sequenceIds: records.length === 0 ? [entry.sequenceId] : records.map((record) => record.id),
        familyId: familyId ?? null,
        endState: final?.endState ?? null,
        conditionalProbability: entry.conditionalProbability,
        annualFrequency: entry.annualFrequency,
        cutSetCount: entry.cutSets?.count ?? null,
      });
      if (final?.endState !== undefined) endStates.set(final.endState, (endStates.get(final.endState) ?? 0) + entry.annualFrequency);
      const first = entry.cutSets?.items[0];
      if (cutSetRun && first !== undefined && first.order > 0) peak = Math.max(peak ?? 0, entry.conditionalProbability);
      if (familyId === undefined) continue;
      const totals = familyOf(familyId);
      totals.sequenceCount += 1;
      if (!cutSetRun) {
        totals.annualFrequency += entry.annualFrequency;
        if (stateId !== undefined) stateTotals(totals, stateId).annualFrequency += entry.annualFrequency;
      }
    }
    if (!cutSetRun) continue;
    for (const family of result.families ?? []) {
      const totals = familyOf(family.familyId);
      const last = family.sweep[family.sweep.length - 1];
      const value = last?.annualFrequency ?? 0;
      totals.annualFrequency += value;
      totals.cutSetCount += family.count;
      addSweep(totals.sweep, family.sweep);
      if (stateId !== undefined) {
        const state = stateTotals(totals, stateId);
        state.annualFrequency += value;
        addSweep(state.sweep, family.sweep);
      }
      for (const item of family.items) totals.cutSets.push({ treeId: outcome.treeId, basicEventIds: item.basicEventIds, annualFrequency: item.annualFrequency });
    }
  }

  const order = [...(model?.families ?? []).map((family) => family.id), ...[...families.keys()].sort()];
  const familyRows: EsqModelRunFamily[] = [...new Set(order)].flatMap((familyId) => {
    const totals = families.get(familyId);
    if (totals === undefined) return [];
    return [{
      familyId,
      annualFrequency: totals.annualFrequency,
      sequenceCount: totals.sequenceCount,
      cutSetCount: cutSetRun ? totals.cutSetCount : null,
      sweep: cutSetRun ? totals.sweep : [],
      states: [...totals.states.entries()].map(([stateId, state]) => ({ stateId, annualFrequency: state.annualFrequency, sweep: cutSetRun ? state.sweep : [] })),
      cutSets: [...totals.cutSets].sort((a, b) => b.annualFrequency - a.annualFrequency).slice(0, keep),
    }];
  });

  return {
    schemaVersion: "1.0.0",
    kind: "ESQ_MODEL_RUN",
    runId: input.batchId,
    owner: input.owner,
    completedAt: input.completedAt,
    inputs: input.inputs,
    calculation: input.request.calculation,
    logic: { ...input.request.logic },
    cutSets: input.request.cutSets === undefined ? null : { ...input.request.cutSets, cutOffs: [...input.request.cutSets.cutOffs] },
    trees: input.outcomes.map((outcome) => ({
      treeId: outcome.treeId,
      runId: outcome.runId,
      status: outcome.status,
      initiatorFrequency: outcome.initiatorFrequency,
      failure: outcome.failure,
    })),
    sequences,
    families: familyRows,
    endStates: [...endStates.entries()].map(([endState, annualFrequency]) => ({ endState, annualFrequency })),
    eventCodes: input.eventCodes,
    peakProbability: cutSetRun ? peak : null,
  };
}

export { summarizeEsqModelRun, type EsqModelRunSummaryInput };
