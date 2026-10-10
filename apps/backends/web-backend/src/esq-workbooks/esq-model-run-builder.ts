import type {
  EsqExclusion,
  EsqFlag,
  EsqLoopBreak,
  EsqModel,
  EsqSplitFractionTarget,
  EsqTreeRecord,
  EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { cellExpressionOfRecord, cellOf } from "interfaces-mef-types/esq/esq-barrier-inputs";
import {
  activeRecoveries,
  esqIndependentEventId,
  esqJointEventId,
  eventProbabilityOf,
  hfeEventIds,
  resolvedCombinations,
  scopeApplies,
  solveJointEvents,
  type EsqResolvedRecovery,
} from "interfaces-mef-types/esq/esq-post-inputs";
import {
  esqEndStateRunId,
  esqFunctionRunId,
  esqSequenceRunId,
  esqStableId,
  esqTreeRunId,
  flagTargetKey,
  flagsForTree,
  functionLinkOf,
  resolveLink,
  transferEdges,
  transferLoops,
  transferTreeIds,
  treeFrequency,
  treesInScope,
} from "interfaces-mef-types/esq/esq-run-inputs";
import { carriesUncertainExpression, type SystemBasicEvent, type SystemLogicModel, type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { systemFaultTreeBasicEventIds } from "interfaces-mef-types/sy/system-models";
import { parameterLaw, parameterUnit, splitInputKey } from "interfaces-mef-types/esq/esq-measure-inputs";
import { holdsEstimate, isComponentModel } from "interfaces-mef-types/da/data-analysis";
import {
  canonicalJson,
  ccfFactorExpressions,
  ccfFactorVector,
  ccfModelTakesTotal,
  expressionReferences,
  mapModelArguments,
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
  type UncertainVectorParameter,
} from "interfaces-mef-types/core/uncertainty";
import type { FaultTreeGate, FaultTreeGateInput, FaultTreeHouseEvent, FaultTreeLeafNode } from "interfaces-mef-types/modeling/fault-tree";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import type { EsqEventTreeRunLogic } from "interfaces-shared-types/newly-developed-methods";
import {
  adaptSyCcfGroup,
  adaptSyFaultTreeSnapshot,
  WorkbookPraxisAdapterError,
  type AdaptedFaultTreeSnapshot,
  resolveUncertaintyTables,
  type CatalogueCcfGroup,
  type PraxisModelSnapshot,
  type UncertaintyTables,
} from "../newly-developed-methods/shared/praxis-snapshot-adapters";

class EsqRunBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EsqRunBuildError";
  }
}

interface EsqRunBuildInput {
  esq: EventSequenceQuantification;
  treeId: string;
  sy: SystemsAnalysis;
  syWorkbookId: string;
  syRevision: number;
  missionTimes: ReadonlyMap<string, UncertainParameter>;
  esqWorkbookId: string;
  esqRevision: number;
  logic: EsqEventTreeRunLogic;
  points: ReadonlyMap<string, number>;
  raisedHep?: number;
  failedEventIds?: readonly string[];
}

type EsqRunEventRole = "BASIC" | "RECOVERY" | "JOINT" | "INDEPENDENT_PART" | "SPLIT";

interface EsqRunEventValue {
  id: string;
  role: EsqRunEventRole;
  baseEventId?: string;
  ratio?: number;
  recoveryId?: string;
  combinationId?: string;
  splitKey?: string;
  baseExpression?: UncertainExpression;
}

interface EsqRunBuild {
  rootModelId: string;
  frequency: UncertainExpression;
  initiatorTables: UncertaintyTables;
  eventTreeSnapshots: PraxisModelSnapshot[];
  faultTrees: AdaptedFaultTreeSnapshot[];
  eventTreeModelIds: string[];
  splitFractionModelIds: string[];
  syModelIds: string[];
  humanEventIds: string[];
  nominal: Record<string, number>;
  values: EsqRunEventValue[];
  ccfGroups: CatalogueCcfGroup[];
  sharedParameters: UncertainParameter[];
  eventCodes: Record<string, string>;
}

interface EsqDependencyEncoding {
  sy: SystemsAnalysis;
  joints: { id: string; combinationId: string; firstEventId: string; value: number; firstProbability: number }[];
  independents: { id: string; eventId: string; value: number; probability: number }[];
}

interface EventValue {
  expression?: UncertainExpression;
  probability?: number;
  parameters: UncertainParameter[];
}

interface FunctionTopLink {
  functionalEventId: string;
  faultTreeTopGate: { modelId: string; entityId: string };
}

const PROBABILITY_TYPES = new Set(["PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY"]);

const LAYOUT = { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" };

function houseLeaf(id: string, code: string, name: string, state: boolean): FaultTreeHouseEvent {
  return { id, kind: "HOUSE_EVENT", code, name, description: "", state };
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((item) => b.has(item));
}

function withModels(sy: SystemsAnalysis, edit: (model: SystemLogicModel) => SystemLogicModel): SystemsAnalysis {
  return { ...sy, systemLogicModels: sy.systemLogicModels.map(edit) };
}

function assertSnapshotMatches(sy: SystemsAnalysis, model: EsqModel, modelIds: readonly string[]): void {
  for (const modelId of modelIds) {
    const live = sy.systemLogicModels.find((candidate) => candidate.uuid === modelId);
    const top = model.tops.find((candidate) => candidate.modelId === modelId);
    if (live === undefined || top === undefined) {
      throw new EsqRunBuildError(`The SY fault tree ${top?.code ?? live?.code ?? modelId} changed after the Step 02 import. Re-import the model in Step 02.`);
    }
    const transfers = live.leafNodes.flatMap((leaf) => (leaf.kind === "TRANSFER_REFERENCE" ? [leaf.target.modelId] : []));
    const houses = live.leafNodes.flatMap((leaf) => (leaf.kind === "HOUSE_EVENT" ? [leaf.id] : []));
    const same = live.topGate?.gateId === top.gateId
      && sameSet(systemFaultTreeBasicEventIds(live), top.eventIds)
      && sameSet(transfers, top.transferModelIds)
      && (top.gates === undefined || sameSet(live.gates.map((gate) => gate.id), top.gates.map((gate) => gate.id)))
      && (top.houseEvents === undefined || sameSet(houses, top.houseEvents.map((house) => house.id)));
    if (!same) throw new EsqRunBuildError(`The SY fault tree ${top.code} changed after the Step 02 import. Re-import the model in Step 02.`);
  }
}

function reachableModels(model: EsqModel, starts: readonly string[], cut: readonly EsqLoopBreak[]): Set<string> {
  const edges = transferEdges(model, cut);
  const seen = new Set<string>(starts);
  const queue = [...starts];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined) break;
    for (const edge of edges) {
      if (edge.fromModelId === id && !seen.has(edge.toModelId)) {
        seen.add(edge.toModelId);
        queue.push(edge.toModelId);
      }
    }
  }
  return seen;
}

function applyFlag(sy: SystemsAnalysis, flag: EsqFlag): SystemsAnalysis {
  const target = flag.target;
  if (target === undefined) return sy;
  if (target.kind === "EVENT") {
    const event = sy.systemBasicEvents.find((candidate) => candidate.uuid === target.id);
    if (event === undefined) throw new EsqRunBuildError(`Flag ${flag.name} sets an SY event that the linked SY workbook does not have.`);
    return withModels(sy, (model) => ({
      ...model,
      leafNodes: model.leafNodes.map((leaf): FaultTreeLeafNode => (leaf.kind === "BASIC_EVENT_REFERENCE" && leaf.basicEventId === target.id ? houseLeaf(leaf.id, event.code, event.name, flag.state) : leaf)),
    }));
  }
  const owner = sy.systemLogicModels.find((model) => model.uuid === target.modelId);
  if (owner === undefined) throw new EsqRunBuildError(`Flag ${flag.name} points at an SY fault tree that the linked SY workbook does not have.`);
  if (target.kind === "HOUSE") {
    if (!owner.leafNodes.some((leaf) => leaf.kind === "HOUSE_EVENT" && leaf.id === target.id)) {
      throw new EsqRunBuildError(`Flag ${flag.name} sets a house event that ${owner.code} does not have.`);
    }
    return withModels(sy, (model) => (model.uuid !== owner.uuid ? model : {
      ...model,
      leafNodes: model.leafNodes.map((leaf): FaultTreeLeafNode => (leaf.kind === "HOUSE_EVENT" && leaf.id === target.id ? { ...leaf, state: flag.state } : leaf)),
    }));
  }
  const gate = owner.gates.find((candidate) => candidate.id === target.id);
  if (gate === undefined) throw new EsqRunBuildError(`Flag ${flag.name} sets a gate that ${owner.code} does not have.`);
  const seed = `flag:${flag.id}:${owner.uuid}:${gate.id}`;
  const leafId = esqStableId(`${seed}:leaf`);
  const replacement: FaultTreeGate = { id: gate.id, kind: "GATE", gateType: "OR", code: gate.code, name: gate.name, description: gate.description };
  const input: FaultTreeGateInput = { id: esqStableId(`${seed}:input`), gateId: gate.id, childId: leafId, order: 0 };
  return withModels(sy, (model) => (model.uuid !== owner.uuid ? model : {
    ...model,
    gates: model.gates.map((candidate) => (candidate.id === gate.id ? replacement : candidate)),
    gateInputs: [...model.gateInputs.filter((entry) => entry.gateId !== gate.id), input],
    leafNodes: [...model.leafNodes, houseLeaf(leafId, `${gate.code}-FLAG`, `${gate.name} set by ${flag.name}`, flag.state)],
  }));
}

function applyLoopBreak(sy: SystemsAnalysis, entry: EsqLoopBreak, state: boolean): SystemsAnalysis {
  return withModels(sy, (model) => (model.uuid !== entry.fromModelId ? model : {
    ...model,
    leafNodes: model.leafNodes.map((leaf): FaultTreeLeafNode => (leaf.kind === "TRANSFER_REFERENCE" && leaf.target.modelId === entry.toModelId ? houseLeaf(leaf.id, leaf.code, leaf.name, state) : leaf)),
  }));
}

function applyExclusion(sy: SystemsAnalysis, exclusion: EsqExclusion, codeOf: (eventId: string) => string): SystemsAnalysis {
  const known = new Set(sy.systemBasicEvents.map((event) => event.uuid));
  const missing = exclusion.eventIds.find((id) => !known.has(id));
  if (missing !== undefined) throw new EsqRunBuildError(`Exclusion ${exclusion.id} names ${codeOf(missing)}, which the linked SY workbook does not have.`);
  let next = sy;
  exclusion.eventIds.forEach((targetId, index) => {
    if (index === 0) return;
    const earlier = exclusion.eventIds.slice(0, index);
    next = withModels(next, (model) => {
      const hits = model.leafNodes.filter((leaf) => leaf.kind === "BASIC_EVENT_REFERENCE" && leaf.basicEventId === targetId);
      if (hits.length === 0) return model;
      const hitIds = new Set(hits.map((leaf) => leaf.id));
      const gates: FaultTreeGate[] = [...model.gates];
      const leafNodes: FaultTreeLeafNode[] = model.leafNodes.filter((leaf) => !hitIds.has(leaf.id));
      const gateInputs: FaultTreeGateInput[] = [...model.gateInputs];
      for (const hit of hits) {
        const seed = `exclusion:${exclusion.id}:${model.uuid}:${hit.id}`;
        const ownId = esqStableId(`${seed}:own`);
        gates.push({ id: hit.id, kind: "GATE", gateType: "AND", code: `${codeOf(targetId)}-EX`, name: `${codeOf(targetId)} under exclusion ${exclusion.id}`, description: "" });
        leafNodes.push({ id: ownId, kind: "BASIC_EVENT_REFERENCE", basicEventId: targetId });
        gateInputs.push({ id: esqStableId(`${seed}:own-input`), gateId: hit.id, childId: ownId, order: 0 });
        earlier.forEach((otherId, position) => {
          const notId = esqStableId(`${seed}:not:${otherId}`);
          const otherLeafId = esqStableId(`${seed}:leaf:${otherId}`);
          gates.push({ id: notId, kind: "GATE", gateType: "NOT", code: `NOT-${codeOf(otherId)}`, name: `Not ${codeOf(otherId)}`, description: "" });
          leafNodes.push({ id: otherLeafId, kind: "BASIC_EVENT_REFERENCE", basicEventId: otherId });
          gateInputs.push({ id: esqStableId(`${seed}:not-input:${otherId}`), gateId: hit.id, childId: notId, order: position + 1 });
          gateInputs.push({ id: esqStableId(`${seed}:leaf-input:${otherId}`), gateId: notId, childId: otherLeafId, order: 0 });
        });
      }
      return { ...model, gates, leafNodes, gateInputs };
    });
  });
  return next;
}

function pointExpression(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function syntheticEvent(id: string, code: string, name: string, expression: UncertainExpression): SystemBasicEvent {
  return { uuid: id, code, name, eventType: "BASIC", expression, implementsSrs: [] };
}

function withEvents(sy: SystemsAnalysis, events: readonly SystemBasicEvent[]): SystemsAnalysis {
  const known = new Set(sy.systemBasicEvents.map((event) => event.uuid));
  return { ...sy, systemBasicEvents: [...sy.systemBasicEvents, ...events.filter((event) => !known.has(event.uuid))] };
}

function replaceLeaves(sy: SystemsAnalysis, eventIds: ReadonlySet<string>, build: (model: SystemLogicModel, leaf: FaultTreeLeafNode & { kind: "BASIC_EVENT_REFERENCE" }, gates: FaultTreeGate[], leafNodes: FaultTreeLeafNode[], gateInputs: FaultTreeGateInput[]) => void): SystemsAnalysis {
  return withModels(sy, (model) => {
    const hits = model.leafNodes.flatMap((leaf) => (leaf.kind === "BASIC_EVENT_REFERENCE" && eventIds.has(leaf.basicEventId) ? [leaf] : []));
    if (hits.length === 0) return model;
    const hitIds = new Set(hits.map((leaf) => leaf.id));
    const gates: FaultTreeGate[] = [...model.gates];
    const leafNodes: FaultTreeLeafNode[] = model.leafNodes.filter((leaf) => !hitIds.has(leaf.id));
    const gateInputs: FaultTreeGateInput[] = [...model.gateInputs];
    for (const hit of hits) build(model, hit, gates, leafNodes, gateInputs);
    return { ...model, gates, leafNodes, gateInputs };
  });
}

function applyRecovery(sy: SystemsAnalysis, recovery: EsqResolvedRecovery, expression: UncertainExpression, codeOf: (eventId: string) => string): SystemsAnalysis {
  const nonRecovery = syntheticEvent(recovery.eventId, `NR-${recovery.id}`, `${recovery.name} fails`, expression);
  const replaced = replaceLeaves(sy, new Set(recovery.eventIds), (model, hit, gates, leafNodes, gateInputs) => {
    const seed = `recovery:${recovery.id}:${model.uuid}:${hit.id}`;
    const ownId = esqStableId(`${seed}:own`);
    const nonRecoveryId = esqStableId(`${seed}:non-recovery`);
    gates.push({ id: hit.id, kind: "GATE", gateType: "AND", code: `${codeOf(hit.basicEventId)}-REC`, name: `${codeOf(hit.basicEventId)} not recovered by ${recovery.id}`, description: "" });
    leafNodes.push({ id: ownId, kind: "BASIC_EVENT_REFERENCE", basicEventId: hit.basicEventId });
    leafNodes.push({ id: nonRecoveryId, kind: "BASIC_EVENT_REFERENCE", basicEventId: recovery.eventId });
    gateInputs.push({ id: esqStableId(`${seed}:own-input`), gateId: hit.id, childId: ownId, order: 0 });
    gateInputs.push({ id: esqStableId(`${seed}:non-recovery-input`), gateId: hit.id, childId: nonRecoveryId, order: 1 });
  });
  return withEvents(replaced, [nonRecovery]);
}

function applyDependencies(
  sy: SystemsAnalysis,
  esq: EventSequenceQuantification,
  tree: EsqTreeRecord,
  reached: ReadonlySet<string>,
  codeOf: (eventId: string) => string,
  points: ReadonlyMap<string, number>,
): EsqDependencyEncoding {
  const active = resolvedCombinations(esq, points).filter((view) => view.joint !== undefined && scopeApplies(view.combination.groupIds, view.combination.stateIds, tree) && view.combination.eventIds.every((id) => reached.has(id)));
  const broken = active.find((view) => view.problem !== undefined);
  if (broken !== undefined) throw new EsqRunBuildError(`${broken.combination.id}: ${broken.problem ?? ""} Fix it in Step 06.`);
  const encoded = active.filter((view) => view.joint !== undefined && (view.independent === undefined || view.joint > view.independent * (1 + 1e-12)));
  if (encoded.length === 0) return { sy, joints: [], independents: [] };
  const ccfMembers = new Set((sy.commonCauseFailureGroups ?? []).flatMap((group) => (group.members?.basicEvents ?? []).map((member) => member.id)));
  const probabilities = new Map<string, number>();
  for (const view of encoded) {
    for (const member of view.members) {
      if (ccfMembers.has(member.eventId)) throw new EsqRunBuildError(`${member.code} is in a common cause group, so ${view.combination.id} cannot be written as joint events.`);
      if (member.probability !== undefined) probabilities.set(member.eventId, member.probability);
    }
  }
  const solution = solveJointEvents(probabilities, encoded.map((view) => ({ id: view.combination.id, eventIds: view.combination.eventIds, joint: view.joint ?? 0 })));
  if (solution.problem !== undefined) throw new EsqRunBuildError(`${solution.problem} Fix it in Step 06.`);
  const events: SystemBasicEvent[] = [];
  for (const view of encoded) events.push(syntheticEvent(esqJointEventId(view.combination.id), `JHEP-${view.combination.id}`, `${view.combination.id} joint failure`, pointExpression(solution.joints.get(view.combination.id) ?? 0)));
  for (const [eventId, independent] of solution.independents) events.push(syntheticEvent(esqIndependentEventId(eventId), `${codeOf(eventId)}-IND`, `${codeOf(eventId)} alone`, pointExpression(independent)));
  const replaced = replaceLeaves(sy, new Set(probabilities.keys()), (model, hit, gates, leafNodes, gateInputs) => {
    const seed = `dependency:${model.uuid}:${hit.id}`;
    const sharing = encoded.filter((view) => view.combination.eventIds.includes(hit.basicEventId));
    gates.push({ id: hit.id, kind: "GATE", gateType: "OR", code: `${codeOf(hit.basicEventId)}-DEP`, name: `${codeOf(hit.basicEventId)} with its dependent combinations`, description: "" });
    const ownId = esqStableId(`${seed}:independent`);
    leafNodes.push({ id: ownId, kind: "BASIC_EVENT_REFERENCE", basicEventId: esqIndependentEventId(hit.basicEventId) });
    gateInputs.push({ id: esqStableId(`${seed}:independent-input`), gateId: hit.id, childId: ownId, order: 0 });
    sharing.forEach((view, index) => {
      const leafId = esqStableId(`${seed}:joint:${view.combination.id}`);
      leafNodes.push({ id: leafId, kind: "BASIC_EVENT_REFERENCE", basicEventId: esqJointEventId(view.combination.id) });
      gateInputs.push({ id: esqStableId(`${seed}:joint-input:${view.combination.id}`), gateId: hit.id, childId: leafId, order: index + 1 });
    });
  });
  const joints = encoded.flatMap((view) => {
    const first = view.combination.eventIds[0];
    const firstProbability = first === undefined ? undefined : probabilities.get(first);
    if (first === undefined || firstProbability === undefined) return [];
    return [{ id: esqJointEventId(view.combination.id), combinationId: view.combination.id, firstEventId: first, value: solution.joints.get(view.combination.id) ?? 0, firstProbability }];
  });
  const independents = [...solution.independents].flatMap(([eventId, value]) => {
    const probability = probabilities.get(eventId);
    return probability === undefined ? [] : [{ id: esqIndependentEventId(eventId), eventId, value, probability }];
  });
  return { sy: withEvents(replaced, events), joints, independents };
}

function reachedEventIds(sy: SystemsAnalysis, modelIds: readonly string[]): Set<string> {
  const models = new Map(sy.systemLogicModels.map((model) => [model.uuid, model]));
  const events = new Set<string>();
  const seen = new Set<string>();
  const stack: { modelId: string; nodeId: string }[] = modelIds.flatMap((modelId) => {
    const gateId = models.get(modelId)?.topGate?.gateId;
    return gateId === undefined ? [] : [{ modelId, nodeId: gateId }];
  });
  while (stack.length > 0) {
    const item = stack.pop();
    if (item === undefined) break;
    const key = `${item.modelId}:${item.nodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const model = models.get(item.modelId);
    if (model === undefined) continue;
    const leaf = model.leafNodes.find((candidate) => candidate.id === item.nodeId);
    if (leaf?.kind === "BASIC_EVENT_REFERENCE") events.add(leaf.basicEventId);
    else if (leaf?.kind === "TRANSFER_REFERENCE") stack.push({ modelId: leaf.target.modelId, nodeId: leaf.target.entityId });
    else if (leaf === undefined) {
      for (const input of model.gateInputs) {
        if (input.gateId === item.nodeId) stack.push({ modelId: item.modelId, nodeId: input.childId });
      }
    }
  }
  return events;
}

function substituted(expression: UncertainExpression, from: string, to: UncertainExpression): UncertainExpression {
  switch (expression.node) {
    case "VALUE":
      return expression;
    case "PARAMETER":
      return parameterReferenceKey(expression.reference) === from ? to : expression;
    case "OPERATION":
      return { ...expression, operands: expression.operands.map((operand) => substituted(operand, from, to)) };
    case "MODEL":
      return { node: "MODEL", model: mapModelArguments(expression.model, (argument) => substituted(argument, from, to)) };
  }
}

interface EsqRunTables {
  esq: EventSequenceQuantification;
  model: EsqModel;
  missionTimes: ReadonlyMap<string, UncertainParameter>;
  esqWorkbookId: string;
  own: Map<string, UncertainParameter>;
}

function ownReference(tables: EsqRunTables, key: string, expression: UncertainExpression): UncertainExpression {
  const reference: WorkbookParameterReference = { referenceType: "WORKBOOK_PARAMETER", workbookId: tables.esqWorkbookId, entityId: key };
  tables.own.set(parameterReferenceKey(reference), { reference, expression });
  return { node: "PARAMETER", reference };
}

function daReference(tables: EsqRunTables, parameterId: string, code: string): UncertainExpression {
  const workbookId = tables.esq.linkedWorkbooks?.DA;
  if (workbookId === undefined) throw new EsqRunBuildError(`${code} takes its value from DA, but Step 01 links no DA workbook.`);
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId: parameterId } };
}

function readsMissionTime(tables: EsqRunTables, reference: WorkbookParameterReference): boolean {
  return tables.missionTimes.has(parameterReferenceKey(reference)) || reference.workbookId.trim() === tables.esq.linkedWorkbooks?.SC?.trim();
}

function referencedParameters(tables: EsqRunTables, expression: UncertainExpression, code: string): UncertainParameter[] {
  const { esq, model, missionTimes } = tables;
  const workbookId = esq.linkedWorkbooks?.DA;
  const found = new Map<string, UncertainParameter>();
  const pending = expressionReferences(expression);
  while (pending.length > 0) {
    const reference = pending.pop();
    if (reference === undefined) break;
    const key = parameterReferenceKey(reference);
    if (found.has(key)) continue;
    const missionTime = missionTimes.get(key) ?? tables.own.get(key);
    if (missionTime !== undefined) {
      found.set(key, missionTime);
      pending.push(...expressionReferences(missionTime.expression));
      continue;
    }
    if (reference.workbookId.trim() === esq.linkedWorkbooks?.SC?.trim()) throw new EsqRunBuildError(`${code} reads mission time ${reference.entityId}, which the linked SC workbook does not hold.`);
    if (workbookId === undefined || reference.workbookId.trim() !== workbookId.trim()) throw new EsqRunBuildError(`${code} reads ${reference.entityId} from a workbook that Step 01 does not link as DA or SC.`);
    const factor = (model.ccfFactors ?? []).find((entry) => parameterReferenceKey(entry.reference) === key);
    if (factor !== undefined) {
      found.set(key, factor);
      pending.push(...expressionReferences(factor.expression));
      continue;
    }
    const parameter = model.parameters.find((entry) => entry.id === reference.entityId.trim());
    if (parameter === undefined) throw new EsqRunBuildError(`${code} reads DA parameter ${reference.entityId}, which the linked DA workbook does not hold. Import the model again in Step 02.`);
    const law = parameterLaw(parameter);
    if (law === undefined) throw new EsqRunBuildError(`${code} reads ${parameter.name}, which has no value in DA.`);
    found.set(key, { reference, expression: law });
    pending.push(...expressionReferences(law));
  }
  return [...found.values()];
}

function eventValue(tables: EsqRunTables, eventId: string, code: string): EventValue | undefined {
  const { esq, model } = tables;
  const record = model.events.find((event) => event.id === eventId);
  const binding = esq.modelDecisions?.valueBindings?.find((entry) => entry.eventId === eventId);
  const heldBy = binding?.heldBy ?? record?.heldBy;
  const holderId = binding?.holderId ?? record?.holderId;
  const component = carriesUncertainExpression(record?.failureMode);
  const resolved = (expression: UncertainExpression): EventValue => ({ expression, parameters: referencedParameters(tables, expression, code) });
  if (heldBy === "DA") {
    const parameter = model.parameters.find((entry) => entry.id === holderId);
    if (parameter === undefined) throw new EsqRunBuildError(`${code} takes its value from DA parameter ${holderId ?? ""}, which the linked DA workbook does not hold. Import the model again in Step 02.`);
    const own = daReference(tables, parameter.id, code);
    if (isComponentModel(parameter.quantificationModel)) {
      if (!component) throw new EsqRunBuildError(`${parameter.name} is a component estimate. It cannot set ${code}.`);
      if (parameter.estimate === undefined) throw new EsqRunBuildError(`${code} takes its value from ${parameter.name}, which has no estimate in DA.`);
      const reference = own.node === "PARAMETER" ? own.reference : undefined;
      const imported = record?.expression;
      const references = imported === undefined ? [] : expressionReferences(imported).filter((entry) => !readsMissionTime(tables, entry));
      if (imported !== undefined && reference !== undefined && references.some((entry) => parameterReferenceKey(entry) === parameterReferenceKey(reference))) return resolved(imported);
      if (parameterUnit(parameter) === "PROBABILITY") return resolved(own);
      const [only, ...others] = references;
      if (imported === undefined || only === undefined || others.length > 0) {
        throw new EsqRunBuildError(`${parameter.name} is a rate. Bind it only to an event whose SY value is a mission or standby model of one rate.`);
      }
      return resolved(substituted(imported, parameterReferenceKey(only), own));
    }
    if (parameterUnit(parameter) !== "PROBABILITY") throw new EsqRunBuildError(`${parameter.name} is a ${parameter.parameterType.toLowerCase()} parameter. It cannot set ${code}.`);
    if (!holdsEstimate(parameter.quantificationModel) && !PROBABILITY_TYPES.has(parameter.parameterType)) throw new EsqRunBuildError(`${parameter.name} is a ${parameter.parameterType.toLowerCase()} parameter. It cannot set ${code}.`);
    if (parameterLaw(parameter) === undefined) throw new EsqRunBuildError(`${code} takes its value from ${parameter.name}, which has no value in DA.`);
    return resolved(own);
  }
  if (heldBy === "HRA") {
    const human = model.humanEvents.find((entry) => entry.id === holderId);
    if (human === undefined) throw new EsqRunBuildError(`${code} takes its value from HR event ${holderId ?? ""}, which the Step 02 import does not hold.`);
    if (human.hep === undefined) throw new EsqRunBuildError(`${code} takes its value from ${human.name}, which has no HEP in HR.`);
    return resolved(ownReference(tables, `HFE:${human.id}`, human.hep));
  }
  if (component) return record?.expression === undefined ? undefined : resolved(record.expression);
  if (record?.value === undefined) return undefined;
  if (record.valueUnit === "PER_HOUR") throw new EsqRunBuildError(`${code} holds a rate, but only a component event can hold a rate model. Give it a probability.`);
  return { probability: record.value, parameters: [] };
}

function withValue(event: SystemBasicEvent, resolved: EventValue | undefined, code: string): SystemBasicEvent {
  const next: SystemBasicEvent = { ...event };
  delete next.controlledDataSource;
  delete next.dataAnalysisBasicEventRef;
  delete next.quantificationBasis;
  if (resolved === undefined) return next;
  if (resolved.expression !== undefined) {
    delete next.probability;
    next.expression = resolved.expression;
    return next;
  }
  if (!(resolved.probability !== undefined && resolved.probability >= 0 && resolved.probability <= 1)) throw new EsqRunBuildError(`${code} needs a probability between 0 and 1.`);
  next.probability = resolved.probability;
  return next;
}

function splitValue(tables: EsqRunTables, target: EsqSplitFractionTarget, label: string): EventValue & { expression: UncertainExpression } {
  const { esq, model } = tables;
  if (target.cellId !== undefined) {
    const cell = cellOf(esq, target.cellId);
    if (cell === undefined) throw new EsqRunBuildError(`The split fraction of ${label} takes cell ${target.cellId}, which Step 04 no longer has.`);
    const expression = cellExpressionOfRecord(cell);
    if (expression === undefined) {
      throw new EsqRunBuildError(`The split fraction of ${label} takes cell ${cell.id}, which has no value of record. Run it or type a value in Step 04.`);
    }
    return { expression, parameters: referencedParameters(tables, expression, `Cell ${cell.id}`) };
  }
  if (target.parameterId !== undefined) {
    const parameter = model.parameters.find((entry) => entry.id === target.parameterId);
    if (parameter === undefined || parameterUnit(parameter) !== "PROBABILITY" || parameterLaw(parameter) === undefined) {
      throw new EsqRunBuildError(`The split fraction of ${label} takes ${parameter?.name ?? target.parameterId}, which holds no probability.`);
    }
    const expression = daReference(tables, parameter.id, `The split fraction of ${label}`);
    return { expression, parameters: referencedParameters(tables, expression, `The split fraction of ${label}`) };
  }
  if (target.expression === undefined) throw new EsqRunBuildError(`The split fraction of ${label} needs a value. Type it or link it in Step 02.`);
  return { expression: target.expression, parameters: referencedParameters(tables, target.expression, `The split fraction of ${label}`) };
}

function adaptFaultTree(sy: SystemsAnalysis, syWorkbookId: string, syRevision: number, modelId: string, parameters: ReadonlyMap<string, UncertainParameter>): AdaptedFaultTreeSnapshot {
  try {
    return adaptSyFaultTreeSnapshot({ workbookId: syWorkbookId, workbookRevision: syRevision, mef: sy }, modelId, { parameters });
  } catch (error) {
    if (!(error instanceof WorkbookPraxisAdapterError)) throw error;
    if (error.code === "SY_FAULT_TREE_TRANSFER_CYCLE" || error.code === "SY_FAULT_TREE_GRAPH_CYCLE") {
      const code = sy.systemLogicModels.find((model) => model.uuid === modelId)?.code ?? modelId;
      throw new EsqRunBuildError(`${code} reaches itself through its logic. Break the loop in the Loops tab of Step 03.`);
    }
    throw new EsqRunBuildError(error.message);
  }
}

function runCcfVectors(model: EsqModel, groups: readonly CatalogueCcfGroup[], labels: ReadonlyMap<string, string>): UncertainVectorParameter[] {
  const vectors = new Map((model.vectors ?? []).map((vector) => [parameterReferenceKey(vector.reference), vector]));
  const references = groups.flatMap((group) => {
    const vector = ccfFactorVector(group.factors);
    if (vector?.node !== "PARAMETER") return [];
    if (!vectors.has(parameterReferenceKey(vector.reference))) {
      throw new EsqRunBuildError(`The common cause group ${labels.get(group.id) ?? group.id} takes its factors from ${vector.reference.entityId}, which the Step 02 import does not hold. Import the model again.`);
    }
    return [vector.reference];
  });
  return resolveUncertaintyTables({ parameterReferences: [], vectorReferences: references }, { vectors }).uncertaintyVectors;
}

function runCcfGroups(tables: EsqRunTables, sy: SystemsAnalysis, reached: ReadonlySet<string>): { groups: CatalogueCcfGroup[]; parameters: UncertainParameter[]; vectors: UncertainVectorParameter[] } {
  const { model } = tables;
  const expressions = new Map(sy.systemBasicEvents.flatMap((event) => (event.expression === undefined ? [] : [[event.uuid, event.expression] as const])));
  const parameters: UncertainParameter[] = [];
  const labels = new Map<string, string>();
  const groups = (sy.commonCauseFailureGroups ?? [])
    .filter((group) => (group.members?.basicEvents ?? []).some((member) => reached.has(member.id)))
    .flatMap((group) => adaptSyCcfGroup(group))
    .map((group): CatalogueCcfGroup => {
      const record = model.ccfGroups.find((entry) => entry.id === group.id);
      const label = record?.name ?? group.id;
      labels.set(group.id, label);
      const factors = record === undefined ? group.factors : record.factors;
      if (factors === undefined) throw new EsqRunBuildError(`The common cause group ${label} has no factors in the Step 02 import. Complete it in SY and import again.`);
      if (!ccfModelTakesTotal(factors)) {
        for (const expression of ccfFactorExpressions(factors)) parameters.push(...referencedParameters(tables, expression, `The common cause group ${label}`));
        return { id: group.id, members: group.members, factors };
      }
      const members = group.members.map((id) => expressions.get(id));
      const [first] = members;
      const shared = first !== undefined && members.every((expression) => expression !== undefined && canonicalJson(expression) === canonicalJson(first));
      const total = shared ? first : record === undefined ? group.total : record.total;
      if (total === undefined) throw new EsqRunBuildError(`The common cause group ${label} has no total in the Step 02 import. Complete it in SY and import again.`);
      for (const expression of [total, ...ccfFactorExpressions(factors)]) parameters.push(...referencedParameters(tables, expression, `The common cause group ${label}`));
      return { id: group.id, members: group.members, factors, total };
    });
  return { groups, parameters, vectors: runCcfVectors(model, groups, labels) };
}

function buildEsqEventTreeRun(input: EsqRunBuildInput): EsqRunBuild {
  const { esq } = input;
  const model = esq.model;
  if (model?.importedAt === undefined) throw new EsqRunBuildError("Import the model in Step 02 before running.");
  const tables: EsqRunTables = { esq, model, missionTimes: input.missionTimes, esqWorkbookId: input.esqWorkbookId, own: new Map() };
  const root = model.trees.find((tree) => tree.id === input.treeId);
  if (root === undefined) throw new EsqRunBuildError(`Event tree ${input.treeId} is not in the imported model.`);
  if (root.transferEntry) throw new EsqRunBuildError(`${root.code} is entered by transfer. Run the tree that transfers into it.`);
  if (!treesInScope(esq, model).some((tree) => tree.id === root.id)) throw new EsqRunBuildError(`Step 01 leaves ${root.code} out of scope.`);
  const frequency = treeFrequency(esq, model, root);
  if (frequency === undefined) throw new EsqRunBuildError(`${root.code} has no initiator frequency. Complete the Initiators tab of Step 02.`);
  const initiatorParameters = referencedParameters(tables, frequency, `The initiator frequency of ${root.code}`);

  const trees = transferTreeIds(model, root.id).flatMap((id) => model.trees.filter((tree) => tree.id === id));
  const syModelIds: string[] = [];
  const splitModels = new Map<string, AdaptedFaultTreeSnapshot>();
  const splitValues = new Map<string, EsqRunEventValue>();
  const splitCodes = new Map<string, string>();

  const linkFor = (tree: EsqTreeRecord, functionId: string): FunctionTopLink | undefined => {
    const asked = model.sequences.some((sequence) => sequence.treeId === tree.id && (sequence.path[functionId] === "SUCCESS" || sequence.path[functionId] === "FAILURE"));
    if (!asked) return undefined;
    const record = model.functions.find((entry) => entry.id === functionId);
    const label = `${record?.name ?? functionId} in ${tree.code}`;
    const target = record === undefined ? undefined : resolveLink(record, functionLinkOf(esq, functionId), tree).target;
    if (target === undefined) throw new EsqRunBuildError(`${label} is not linked. Link it in Step 02.`);
    if (target.kind === "FAULT_TREE") {
      const syModel = input.sy.systemLogicModels.find((entry) => entry.uuid === target.top.modelId);
      const topGateId = syModel?.topGate?.gateId;
      if (syModel === undefined || topGateId === undefined) throw new EsqRunBuildError(`${label} links to a fault tree that the linked SY workbook does not have.`);
      if (topGateId !== target.top.gateId) throw new EsqRunBuildError(`${label} links to a gate below the top of ${syModel.code}. Link the top gate.`);
      if (!syModelIds.includes(syModel.uuid)) syModelIds.push(syModel.uuid);
      return { functionalEventId: esqFunctionRunId(functionId), faultTreeTopGate: { modelId: syModel.uuid, entityId: topGateId } };
    }
    const value = splitValue(tables, target, label);
    const seed = `split:${functionId}:${target.cellId ?? target.parameterId ?? ""}:${canonicalJson(value.expression)}`;
    const modelId = esqStableId(`${seed}:model`);
    const gateId = esqStableId(`${seed}:gate`);
    if (!splitModels.has(modelId)) {
      const leafId = esqStableId(`${seed}:leaf`);
      const eventId = esqStableId(`${seed}:event`);
      splitValues.set(eventId, { id: eventId, role: "SPLIT", splitKey: splitInputKey(functionId, target) });
      splitCodes.set(eventId, `SF-${functionId}`);
      const name = `${record?.name ?? functionId} split fraction`;
      splitModels.set(modelId, {
        modelSnapshot: {
          id: modelId,
          methodType: "FAULT_TREE",
          revision: input.esqRevision,
          topGate: { gateId },
          gates: [{ id: gateId, kind: "GATE", gateType: "OR", code: `SF-${functionId}`, name, description: "" }],
          leafNodes: [{ id: leafId, kind: "BASIC_EVENT_REFERENCE", basicEventId: eventId }],
          gateInputs: [{ id: esqStableId(`${seed}:input`), gateId, childId: leafId, order: 0 }],
          nodePositions: [],
          layout: LAYOUT,
        },
        basicEventCatalogue: {
          projectId: input.esqWorkbookId,
          basicEvents: [{ id: eventId, expression: value.expression }],
          commonCauseFailureGroups: [],
          uncertaintyParameters: value.parameters,
          uncertaintyVectors: [],
        },
        parameterReferences: value.parameters.map((parameter) => parameter.reference),
        vectorReferences: [],
        humanFailureReferences: [],
      });
    }
    return { functionalEventId: esqFunctionRunId(functionId), faultTreeTopGate: { modelId, entityId: gateId } };
  };

  const eventTreeSnapshots = trees.map((tree): PraxisModelSnapshot => {
    const endStates = new Set<string>();
    const sequences = model.sequences.filter((sequence) => sequence.treeId === tree.id).map((sequence) => {
      const path = tree.functionIds.map((functionId) => ({ functionalEventId: esqFunctionRunId(functionId), outcome: sequence.path[functionId] ?? "BYPASSED" }));
      if (sequence.transferTreeId !== undefined) {
        return { id: esqSequenceRunId(tree.id, sequence.id), path, result: { kind: "TRANSFER", target: { modelId: esqTreeRunId(sequence.transferTreeId) } } };
      }
      if (sequence.endState === undefined) throw new EsqRunBuildError(`${sequence.code} in ${tree.code} has no end state.`);
      const endStateId = esqEndStateRunId(sequence.endState);
      endStates.add(endStateId);
      return { id: esqSequenceRunId(tree.id, sequence.id), path, result: { kind: "END_STATE", endStateId } };
    });
    const links = tree.functionIds.flatMap((functionId) => {
      const link = linkFor(tree, functionId);
      return link === undefined ? [] : [link];
    });
    return {
      id: esqTreeRunId(tree.id),
      methodType: "EVENT_TREE",
      revision: input.esqRevision,
      initiatingEvent: { target: { modelId: input.esqWorkbookId, entityId: esqStableId(`initiator:${tree.initiatorId}`) } },
      initiatingEventFrequency: { expression: frequency },
      functionalEvents: tree.functionIds.map((functionId, order) => ({
        id: esqFunctionRunId(functionId),
        name: model.functions.find((entry) => entry.id === functionId)?.name ?? functionId,
        order,
      })),
      functionalEventFaultTreeLinks: links,
      endStates: [...endStates].map((id) => ({ id })),
      sequences,
      hclConfiguration: null,
    };
  });

  const loopBreaks = esq.logic?.loopBreaks ?? [];
  const reachedModels = reachableModels(model, syModelIds, loopBreaks);
  assertSnapshotMatches(input.sy, model, [...reachedModels]);
  const open = transferLoops(model, loopBreaks).find((loop) => loop.modelIds.some((modelId) => reachedModels.has(modelId)));
  if (open !== undefined) {
    const codes = open.modelIds.map((modelId) => model.tops.find((top) => top.modelId === modelId)?.code ?? modelId);
    throw new EsqRunBuildError(`The fault trees ${codes.join(", ")} form a loop. Break it in the Loops tab of Step 03.`);
  }

  const eventCode = new Map(input.sy.systemBasicEvents.map((event) => [event.uuid, event.code]));
  const codeOf = (eventId: string): string => model.events.find((event) => event.id === eventId)?.code ?? eventCode.get(eventId) ?? eventId;
  let sy = input.sy;
  if (input.logic.flags) {
    const chosen = new Map<string, EsqFlag>();
    for (const flag of flagsForTree(esq, root)) {
      const key = flagTargetKey(flag);
      if (key === undefined) continue;
      const other = chosen.get(key);
      if (other !== undefined && other.state !== flag.state) throw new EsqRunBuildError(`Flags ${other.name} and ${flag.name} set the same target TRUE and FALSE for ${root.code}.`);
      chosen.set(key, flag);
    }
    for (const flag of chosen.values()) sy = applyFlag(sy, flag);
  }
  for (const eventId of input.failedEventIds ?? []) {
    sy = applyFlag(sy, { id: `case:${eventId}`, name: `The case on ${codeOf(eventId)}`, target: { kind: "EVENT", id: eventId }, state: true, groupIds: [], stateIds: [], basis: "" });
  }
  for (const entry of loopBreaks) {
    const state = input.logic.loopBreaks === "TRUE" ? true : input.logic.loopBreaks === "FALSE" ? false : entry.state;
    sy = applyLoopBreak(sy, entry, state);
  }
  if (input.logic.exclusions) {
    for (const exclusion of esq.logic?.exclusions ?? []) sy = applyExclusion(sy, exclusion, codeOf);
  }
  const raised = input.raisedHep;
  const parameters = new Map<string, UncertainParameter>();
  const collected = (value: EventValue | undefined): EventValue | undefined => {
    for (const parameter of value?.parameters ?? []) parameters.set(parameterReferenceKey(parameter.reference), parameter);
    return value;
  };
  const recoveries = input.logic.recovery ?? true ? activeRecoveries(esq, root) : [];
  const recoveryExpressions = new Map<string, UncertainExpression>();
  for (const recovery of recoveries) {
    const law = recovery.expression;
    if (law === undefined) continue;
    const expression = raised === undefined ? ownReference(tables, `RECOVERY:${recovery.id}`, law) : pointExpression(raised);
    collected({ expression, parameters: referencedParameters(tables, expression, `The non-recovery NR-${recovery.id}`) });
    recoveryExpressions.set(recovery.eventId, expression);
    sy = applyRecovery(sy, recovery, expression, codeOf);
  }
  const humans = new Set([...hfeEventIds(esq, model), ...recoveries.map((recovery) => recovery.eventId)]);
  const beforeDependencies = reachedEventIds(sy, syModelIds);
  const humanEventIds = [...beforeDependencies].filter((id) => humans.has(id)).sort();
  const recoveryIdOf = new Map(recoveries.map((recovery) => [recovery.eventId, recovery.id]));
  const nominal: Record<string, number> = {};
  for (const id of humanEventIds) {
    const recoveryId = recoveryIdOf.get(id);
    const value = recoveryId === undefined ? eventProbabilityOf(esq, model, id, input.points) : input.points.get(`RECOVERY:${recoveryId}`);
    if (value !== undefined) nominal[id] = value;
  }
  let encoding: EsqDependencyEncoding = { sy, joints: [], independents: [] };
  if (raised === undefined && (input.logic.dependency ?? true)) {
    encoding = applyDependencies(sy, esq, root, beforeDependencies, codeOf, input.points);
    sy = encoding.sy;
  }
  const baseExpressionOf = (eventId: string): UncertainExpression | undefined => {
    const recovery = recoveryExpressions.get(eventId);
    if (recovery !== undefined) return recovery;
    const base = collected(eventValue(tables, eventId, codeOf(eventId)));
    if (base?.expression !== undefined) return base.expression;
    return base?.probability === undefined ? undefined : pointExpression(base.probability);
  };

  const reached = reachedEventIds(sy, syModelIds);
  const valued: SystemsAnalysis = {
    ...sy,
    systemBasicEvents: sy.systemBasicEvents.map((event) => {
      if (!reached.has(event.uuid)) return event;
      if (event.expression !== undefined && event.failureMode === undefined && !model.events.some((record) => record.id === event.uuid)) return event;
      const resolved = collected(eventValue(tables, event.uuid, codeOf(event.uuid)));
      const next = withValue(event, resolved, codeOf(event.uuid));
      if (raised === undefined || !humans.has(event.uuid)) return next;
      return next.expression === undefined ? { ...next, probability: raised } : { ...next, expression: pointExpression(raised) };
    }),
  };

  const ccf = runCcfGroups(tables, valued, reached);
  const ccfGroups = ccf.groups;
  for (const parameter of ccf.parameters) parameters.set(parameterReferenceKey(parameter.reference), parameter);
  const recoveryOf = new Map(recoveries.map((recovery) => [recovery.eventId, recovery.id]));
  const jointOf = new Map(encoding.joints.map((joint) => [joint.id, joint]));
  const independentOf = new Map(encoding.independents.map((entry) => [entry.id, entry]));
  const values: EsqRunEventValue[] = valued.systemBasicEvents.flatMap((event): EsqRunEventValue[] => {
    if (!reached.has(event.uuid)) return [];
    const entry: EsqRunEventValue = { id: event.uuid, role: "BASIC" };
    const recoveryId = recoveryOf.get(event.uuid);
    const joint = jointOf.get(event.uuid);
    const independent = independentOf.get(event.uuid);
    if (recoveryId !== undefined) {
      entry.role = "RECOVERY";
      entry.recoveryId = recoveryId;
    } else if (joint !== undefined) {
      entry.role = "JOINT";
      entry.combinationId = joint.combinationId;
      entry.baseEventId = joint.firstEventId;
      entry.ratio = joint.firstProbability > 0 ? joint.value / joint.firstProbability : 0;
      const base = baseExpressionOf(joint.firstEventId);
      if (base !== undefined) entry.baseExpression = base;
    } else if (independent !== undefined) {
      entry.role = "INDEPENDENT_PART";
      entry.baseEventId = independent.eventId;
      entry.ratio = independent.probability > 0 ? independent.value / independent.probability : 0;
      const base = baseExpressionOf(independent.eventId);
      if (base !== undefined) entry.baseExpression = base;
    }
    return [entry];
  });
  const adaptable: SystemsAnalysis = { ...valued, commonCauseFailureGroups: [] };
  const syFaultTrees = syModelIds.map((modelId) => {
    const adapted = adaptFaultTree(adaptable, input.syWorkbookId, input.syRevision, modelId, parameters);
    const known = new Set(adapted.basicEventCatalogue.uncertaintyParameters.map((parameter) => parameterReferenceKey(parameter.reference)));
    const groupParameters = ccf.parameters.filter((parameter) => !known.has(parameterReferenceKey(parameter.reference)));
    return {
      ...adapted,
      vectorReferences: ccf.vectors.map((vector) => vector.reference),
      basicEventCatalogue: {
        ...adapted.basicEventCatalogue,
        commonCauseFailureGroups: ccfGroups,
        uncertaintyParameters: [...adapted.basicEventCatalogue.uncertaintyParameters, ...groupParameters],
        uncertaintyVectors: ccf.vectors,
      },
    };
  });

  return {
    rootModelId: esqTreeRunId(root.id),
    frequency,
    initiatorTables: { uncertaintyParameters: initiatorParameters, uncertaintyVectors: [] },
    eventTreeSnapshots,
    faultTrees: [...syFaultTrees, ...splitModels.values()],
    eventTreeModelIds: trees.map((tree) => esqTreeRunId(tree.id)),
    splitFractionModelIds: [...splitModels.keys()],
    syModelIds,
    humanEventIds,
    nominal,
    values: [...values, ...splitValues.values()],
    ccfGroups,
    sharedParameters: [...parameters.values(), ...ccf.parameters],
    eventCodes: Object.fromEntries([
      ...valued.systemBasicEvents.filter((event) => reached.has(event.uuid)).map((event) => [event.uuid, event.code] as const),
      ...splitCodes,
    ]),
  };
}

export { buildEsqEventTreeRun, EsqRunBuildError, type EsqRunBuild, type EsqRunBuildInput, type EsqRunEventRole, type EsqRunEventValue };
