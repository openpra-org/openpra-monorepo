import type {
  EsqEventTreeRunLogic,
  EsqPostCombinationFinding,
  EsqPostDeletionFinding,
  EsqPostRunRequest,
  EsqPostRunResult,
  WorkbookModelSnapshotIdentity,
} from "interfaces-shared-types/newly-developed-methods";
import type { EsqTreeRunOutcome } from "../newly-developed-methods/shared/workbook-analysis-runs.service";
import { initiatorFrequencyOf } from "./esq-model-run-summary";

interface EsqPostTreeInfo {
  humanEventIds: readonly string[];
  nominal: Readonly<Record<string, number>>;
}

interface EsqPostRunSummaryInput {
  request: EsqPostRunRequest;
  logic: EsqEventTreeRunLogic;
  batchId: string;
  owner: WorkbookModelSnapshotIdentity;
  completedAt: string;
  inputs: string;
  outcomes: EsqTreeRunOutcome[];
  trees: ReadonlyMap<string, EsqPostTreeInfo>;
  exclusionIds: readonly string[];
  eventCodes: Record<string, string>;
}

interface Totals {
  treeIds: Set<string>;
  cutSetCount: number;
  nominalFrequency: number;
}

function summarizeEsqPostRun(input: EsqPostRunSummaryInput): EsqPostRunResult {
  const raised = input.request.raisedHep ?? 1;
  const combinations = new Map<string, Totals & { eventIds: string[] }>();
  const deletions = new Map<string, Totals>();
  for (const outcome of input.outcomes) {
    if (outcome.status !== "SUCCEEDED" || outcome.result === null) continue;
    const info = input.trees.get(outcome.treeId);
    const humans = new Set(info?.humanEventIds ?? []);
    for (const sequence of outcome.result.sequences) {
      for (const focus of sequence.cutSets?.focus ?? []) {
        for (const item of focus.items) {
          if (input.request.purpose === "COMBINATIONS") {
            const members = item.basicEventIds.filter((id) => humans.has(id)).sort();
            if (members.length < 2) continue;
            const nominal = members.reduce((value, id) => value * ((info?.nominal[id] ?? raised) / raised), item.annualFrequency);
            const key = members.join("|");
            const entry = combinations.get(key) ?? { eventIds: members, treeIds: new Set<string>(), cutSetCount: 0, nominalFrequency: 0 };
            entry.treeIds.add(outcome.treeId);
            entry.cutSetCount += 1;
            entry.nominalFrequency += nominal;
            combinations.set(key, entry);
          } else {
            const entry = deletions.get(focus.key) ?? { treeIds: new Set<string>(), cutSetCount: 0, nominalFrequency: 0 };
            entry.treeIds.add(outcome.treeId);
            entry.cutSetCount += 1;
            entry.nominalFrequency += item.annualFrequency;
            deletions.set(focus.key, entry);
          }
        }
      }
    }
  }
  const combinationRows: EsqPostCombinationFinding[] = [...combinations.values()]
    .sort((a, b) => b.nominalFrequency - a.nominalFrequency)
    .map((entry) => ({ eventIds: entry.eventIds, treeIds: [...entry.treeIds], cutSetCount: entry.cutSetCount, nominalFrequency: entry.nominalFrequency }));
  const deletionRows: EsqPostDeletionFinding[] = input.exclusionIds.flatMap((exclusionId) => {
    const entry = deletions.get(exclusionId);
    return entry === undefined ? [] : [{ exclusionId, treeIds: [...entry.treeIds], cutSetCount: entry.cutSetCount, nominalFrequency: entry.nominalFrequency }];
  });
  return {
    schemaVersion: "1.0.0",
    kind: "ESQ_POST_RUN",
    runId: input.batchId,
    owner: input.owner,
    completedAt: input.completedAt,
    inputs: input.inputs,
    purpose: input.request.purpose,
    cutOff: input.request.cutOff,
    raisedHep: input.request.raisedHep ?? null,
    logic: { ...input.logic },
    trees: input.outcomes.map((outcome) => ({
      treeId: outcome.treeId,
      runId: outcome.runId,
      status: outcome.status,
      initiatorFrequency: initiatorFrequencyOf(outcome),
      failure: outcome.failure,
    })),
    combinations: combinationRows,
    deletions: deletionRows,
    eventCodes: input.eventCodes,
  };
}

export { summarizeEsqPostRun, type EsqPostRunSummaryInput, type EsqPostTreeInfo };
