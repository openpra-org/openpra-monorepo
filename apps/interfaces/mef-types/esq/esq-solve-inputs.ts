import type {
  EsqSequenceRecord,
  EsqSolveWork,
  EventSequenceQuantification,
} from "./event-sequence-quantification";
import { canonicalJson } from "../core/uncertainty";
import { cellExpressionOfRecord } from "./esq-barrier-inputs";
import { esqStableId, hash32 } from "./esq-run-inputs";

function esqModelRunId(): string {
  return esqStableId("model-run");
}

function sequenceFamilyOf(esq: EventSequenceQuantification, record: EsqSequenceRecord): string | undefined {
  if (record.transferTreeId !== undefined) return undefined;
  const choice = esq.modelDecisions?.sequenceChoices?.find((entry) => entry.sequenceId === record.id);
  return choice?.familyId ?? record.familyId;
}

function solveInputsKey(esq: EventSequenceQuantification, options: { combinations: boolean } = { combinations: true }): string {
  const model = esq.model;
  const post = esq.postWork ?? {};
  const decisions = esq.modelDecisions ?? {};
  const logic = esq.logic ?? {};
  const plan = esq.quantificationPlan ?? {};
  const payload = {
    model: model === undefined ? null : {
      trees: model.trees,
      sequences: model.sequences,
      functions: model.functions,
      tops: model.tops,
      initiators: model.initiators,
      states: model.states,
      events: model.events,
      ccfGroups: model.ccfGroups,
      parameters: model.parameters,
      humanEvents: model.humanEvents,
      recoveries: model.recoveries,
      dependencies: model.dependencies,
      jointFloor: model.jointFloor?.value,
    },
    links: (decisions.functionLinks ?? []).map((link) => ({
      functionId: link.functionId,
      target: link.target,
      rules: (link.rules ?? []).map((rule) => ({ id: rule.id, groupIds: rule.groupIds, stateIds: rule.stateIds, target: rule.target })),
    })),
    initiators: (decisions.initiatorChoices ?? []).map((choice) => ({
      groupId: choice.groupId,
      source: choice.source,
      parameterId: choice.parameterId,
      expression: choice.expression,
      shares: choice.shares,
    })),
    sequences: (decisions.sequenceChoices ?? []).map((choice) => ({ sequenceId: choice.sequenceId, familyId: choice.familyId })),
    values: (decisions.valueBindings ?? []).map((binding) => ({ eventId: binding.eventId, heldBy: binding.heldBy, holderId: binding.holderId })),
    flags: (logic.flags ?? []).map((flag) => ({ id: flag.id, target: flag.target, state: flag.state, groupIds: flag.groupIds, stateIds: flag.stateIds })),
    loopBreaks: (logic.loopBreaks ?? []).map((entry) => ({ fromModelId: entry.fromModelId, toModelId: entry.toModelId, state: entry.state })),
    exclusions: (logic.exclusions ?? []).map((exclusion) => ({ id: exclusion.id, eventIds: exclusion.eventIds })),
    cells: (esq.barrierWork?.cells ?? []).map((cell) => ({ id: cell.id, value: cellExpressionOfRecord(cell) ?? null })),
    scope: (esq.modelIntegration.scopeExclusions ?? []).map((exclusion) => ({ aspect: exclusion.aspect, item: exclusion.item })),
    recoveries: post.recoveries?.map((rule) => ({
      id: rule.id,
      manual: rule.manual !== undefined,
      eventIds: rule.eventIds,
      groupIds: rule.groupIds,
      stateIds: rule.stateIds,
      credited: rule.credited,
      feasibility: rule.feasibility,
      typed: rule.typed?.value,
      ofRecord: rule.ofRecord,
    })),
    combinations: options.combinations ? post.combinations?.map((combination) => ({
      id: combination.id,
      eventIds: combination.eventIds,
      dependencyId: combination.dependencyId,
      level: combination.level,
      typed: combination.typed?.joint,
      ofRecord: combination.ofRecord,
      waived: combination.floorWaiver !== undefined && combination.floorWaiver.trim().length > 0,
      groupIds: combination.groupIds,
      stateIds: combination.stateIds,
    })) : undefined,
    floor: options.combinations ? post.floor?.value : undefined,
    plan: {
      frequencyBasis: plan.frequencyBasis?.value,
      stateWeighting: plan.stateWeighting?.value,
      modulesPerPlant: plan.modulesPerPlant?.value,
      moduleCounting: plan.moduleCounting?.value,
    },
  };
  const text = canonicalJson(payload);
  return [0x9747b28c, 0x2f1e3d4c].map((seed) => hash32(text, seed).toString(16).padStart(8, "0")).join("");
}

function solveWorkOf(esq: EventSequenceQuantification): EsqSolveWork {
  return esq.solve ?? { families: [] };
}

export { esqModelRunId, sequenceFamilyOf, solveInputsKey, solveWorkOf };
