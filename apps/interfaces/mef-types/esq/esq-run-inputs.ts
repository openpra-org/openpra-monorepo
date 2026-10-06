import {
  ESQ_PLAN_DEFAULTS,
  type EsqFlag,
  type EsqFunctionLink,
  type EsqFunctionRecord,
  type EsqFunctionRule,
  type EsqFunctionTarget,
  type EsqInitiatorChoice,
  type EsqInitiatorRecord,
  type EsqInitiatorSource,
  type EsqLoopBreak,
  type EsqModel,
  type EsqParameterRecord,
  type EsqScopeAspect,
  type EsqStateWeighting,
  type EsqTreeRecord,
  type EventSequenceQuantification,
} from "./event-sequence-quantification";

type EsqLinkOrigin = "RULE" | "ESQ" | "ES" | "NONE";

interface EsqResolvedLink {
  target?: EsqFunctionTarget;
  origin: EsqLinkOrigin;
  ruleId?: string;
}

interface EsqGroupState {
  stateId: string;
  name: string;
  hours?: number;
  share?: number;
  frequency?: number;
  applicable: boolean;
  treeIds: string[];
}

interface EsqGroupFrequency {
  id: string;
  name: string;
  record?: EsqInitiatorRecord;
  choice?: EsqInitiatorChoice;
  source: EsqInitiatorSource;
  parameter?: EsqParameterRecord;
  rawMean?: number;
  unit?: string;
  factor: number;
  mean?: number;
  medianFrequency?: number;
  errorFactor?: number;
  states: EsqGroupState[];
  hours?: number;
}

interface EsqTransferLoop {
  key: string;
  modelIds: string[];
  edges: { fromModelId: string; toModelId: string }[];
}

function sameItem(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function hash32(text: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    let k = text.charCodeAt(i);
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  h ^= text.length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function esqStableId(seed: string): string {
  const hex = [0x9747b28c, 0x2f1e3d4c, 0x5a6b7c8d, 0x1c2d3e4f].map((value) => hash32(seed, value).toString(16).padStart(8, "0")).join("");
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function uniqueTexts(items: readonly string[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (item.length > 0 && !out.includes(item)) out.push(item);
  }
  return out;
}

function finiteNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function esqTreeRunId(treeId: string): string {
  return esqStableId(`tree:${treeId}`);
}

function esqFunctionRunId(functionId: string): string {
  return esqStableId(`function:${functionId}`);
}

function esqSequenceRunId(treeId: string, sequenceId: string): string {
  return esqStableId(`sequence:${treeId}:${sequenceId}`);
}

function esqEndStateRunId(endState: string): string {
  return esqStableId(`end-state:${endState}`);
}

function excludedBy(esq: EventSequenceQuantification, aspect: EsqScopeAspect, keys: readonly string[]): boolean {
  return (esq.modelIntegration.scopeExclusions ?? []).some((exclusion) => exclusion.aspect === aspect && keys.some((key) => key.length > 0 && sameItem(exclusion.item, key)));
}

function treesInScope(esq: EventSequenceQuantification, model: EsqModel): EsqTreeRecord[] {
  const initiatorName = new Map(model.initiators.map((initiator) => [initiator.id, initiator.name]));
  const stateName = new Map(model.states.map((state) => [state.id, state.name]));
  const transfersFrom = new Map<string, string[]>();
  for (const sequence of model.sequences) {
    if (sequence.transferTreeId === undefined) continue;
    transfersFrom.set(sequence.treeId, [...(transfersFrom.get(sequence.treeId) ?? []), sequence.transferTreeId]);
  }
  const inScope = new Set<string>();
  for (const tree of model.trees) {
    if (tree.transferEntry) continue;
    if (excludedBy(esq, "INITIATOR_GROUP", [tree.initiatorId, initiatorName.get(tree.initiatorId) ?? ""])) continue;
    if (tree.stateId !== undefined && excludedBy(esq, "OPERATING_STATE", [tree.stateId, stateName.get(tree.stateId) ?? ""])) continue;
    inScope.add(tree.id);
  }
  const queue = [...inScope];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined) break;
    for (const target of transfersFrom.get(id) ?? []) {
      if (inScope.has(target) || !model.trees.some((tree) => tree.id === target)) continue;
      inScope.add(target);
      queue.push(target);
    }
  }
  return model.trees.filter((tree) => inScope.has(tree.id));
}

function transferTreeIds(model: EsqModel, rootId: string): string[] {
  const ids: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || ids.includes(id)) continue;
    if (!model.trees.some((tree) => tree.id === id)) continue;
    ids.push(id);
    for (const sequence of model.sequences) {
      if (sequence.treeId === id && sequence.transferTreeId !== undefined && !ids.includes(sequence.transferTreeId)) queue.push(sequence.transferTreeId);
    }
  }
  return ids;
}

function functionLinkOf(esq: EventSequenceQuantification, functionId: string): EsqFunctionLink | undefined {
  return esq.modelDecisions?.functionLinks?.find((link) => link.functionId === functionId);
}

function initiatorChoiceOf(esq: EventSequenceQuantification, groupId: string): EsqInitiatorChoice | undefined {
  return esq.modelDecisions?.initiatorChoices?.find((choice) => sameItem(choice.groupId, groupId));
}

function ruleMatches(rule: EsqFunctionRule, tree: EsqTreeRecord): boolean {
  const stateId = tree.stateId;
  const groupMatch = rule.groupIds.length === 0 || rule.groupIds.some((id) => sameItem(id, tree.initiatorId));
  const stateMatch = rule.stateIds.length === 0 || (stateId !== undefined && rule.stateIds.some((id) => sameItem(id, stateId)));
  return groupMatch && stateMatch;
}

function resolveLink(record: EsqFunctionRecord, link: EsqFunctionLink | undefined, tree: EsqTreeRecord): EsqResolvedLink {
  const rule = (link?.rules ?? []).find((candidate) => ruleMatches(candidate, tree));
  if (rule !== undefined) return { target: rule.target, origin: "RULE", ruleId: rule.id };
  if (link?.target !== undefined) return { target: link.target, origin: "ESQ" };
  const es = record.esLinks.find((entry) => entry.treeId === tree.id);
  if (es !== undefined) return { target: { kind: "FAULT_TREE", top: es.top }, origin: "ES" };
  return { origin: "NONE" };
}

function stateWeightingOf(esq: EventSequenceQuantification): EsqStateWeighting {
  return esq.quantificationPlan?.stateWeighting?.value ?? ESQ_PLAN_DEFAULTS.stateWeighting;
}

function moduleFactorFor(esq: EventSequenceQuantification, unit: string | undefined): number {
  const plan = esq.quantificationPlan;
  const modules = plan?.modulesPerPlant?.value ?? 1;
  if (!(modules > 1)) return 1;
  const basis = plan?.frequencyBasis?.value ?? ESQ_PLAN_DEFAULTS.frequencyBasis;
  const counting = plan?.moduleCounting?.value ?? ESQ_PLAN_DEFAULTS.moduleCounting;
  const perReactor = unit === "per-reactor-year";
  const perPlant = unit === undefined || unit === "per-plant-year" || unit === "per-calendar-year";
  if (basis === "PER_PLANT_YEAR" && perReactor) return counting === "EACH_MODULE" ? modules : 1;
  if (basis === "PER_REACTOR_YEAR" && perPlant) return 1 / modules;
  return 1;
}

function groupIdsOf(trees: readonly EsqTreeRecord[]): string[] {
  const groups: string[] = [];
  for (const tree of trees) {
    if (!tree.transferEntry && !groups.some((id) => sameItem(id, tree.initiatorId))) groups.push(tree.initiatorId);
  }
  return groups;
}

function groupFrequency(esq: EventSequenceQuantification, model: EsqModel, groupId: string, trees: readonly EsqTreeRecord[]): EsqGroupFrequency {
  const weighting = stateWeightingOf(esq);
  const stateById = new Map(model.states.map((state) => [state.id, state]));
  const record = model.initiators.find((initiator) => sameItem(initiator.id, groupId));
  const choice = initiatorChoiceOf(esq, groupId);
  const source: EsqInitiatorSource = choice?.source ?? "IE";
  const groupTrees = trees.filter((tree) => !tree.transferEntry && sameItem(tree.initiatorId, groupId));
  const allTrees = model.trees.filter((tree) => !tree.transferEntry && sameItem(tree.initiatorId, groupId));
  const view: EsqGroupFrequency = { id: groupId, name: record?.name ?? groupId, source, factor: 1, states: [] };
  if (record !== undefined) view.record = record;
  if (choice !== undefined) view.choice = choice;
  if (source === "IE") {
    if (record?.meanFrequency !== undefined) view.rawMean = record.meanFrequency;
    if (record?.frequencyUnit !== undefined) view.unit = record.frequencyUnit;
    if (record?.medianFrequency !== undefined) view.medianFrequency = record.medianFrequency;
    if (record?.errorFactor !== undefined) view.errorFactor = record.errorFactor;
  } else if (source === "DA") {
    const parameter = model.parameters.find((candidate) => candidate.id === choice?.parameterId);
    if (parameter !== undefined) view.parameter = parameter;
    if (parameter?.value !== undefined) view.rawMean = parameter.value;
    view.unit = "per-plant-year";
  } else {
    const mean = finiteNumber(choice?.mean);
    if (mean !== undefined) view.rawMean = mean;
    const errorFactor = finiteNumber(choice?.errorFactor);
    if (errorFactor !== undefined) view.errorFactor = errorFactor;
  }
  view.factor = source === "TYPED" ? 1 : moduleFactorFor(esq, view.unit);
  if (view.rawMean !== undefined) view.mean = view.rawMean * view.factor;
  const treeStates = allTrees.flatMap((tree) => (tree.stateId === undefined ? [] : [tree.stateId]));
  const applicable = record !== undefined && record.stateIds.length > 0 ? record.stateIds : uniqueTexts(treeStates);
  const stateIds = uniqueTexts([...applicable, ...treeStates]);
  const hoursTotal = applicable.reduce((sum, stateId) => sum + (stateById.get(stateId)?.hours ?? 0), 0);
  if (weighting === "POS_HOURS" && hoursTotal > 0) view.hours = hoursTotal;
  view.states = stateIds.map((stateId) => {
    const state = stateById.get(stateId);
    const isApplicable = applicable.includes(stateId);
    const entry: EsqGroupState = {
      stateId,
      name: state?.name ?? stateId,
      applicable: isApplicable,
      treeIds: groupTrees.filter((tree) => tree.stateId === stateId).map((tree) => tree.id),
    };
    if (state?.hours !== undefined) entry.hours = state.hours;
    let share: number | undefined;
    if (isApplicable && applicable.length === 1) share = 1;
    else if (isApplicable && weighting === "POS_HOURS" && state?.hours !== undefined && hoursTotal > 0) share = state.hours / hoursTotal;
    if (isApplicable && weighting === "TYPED_SHARES" && applicable.length > 1) {
      const typed = choice?.shares?.find((candidate) => candidate.stateId === stateId)?.percent;
      if (typed !== undefined && Number.isFinite(typed)) share = typed / 100;
    }
    if (share !== undefined) {
      entry.share = share;
      if (view.mean !== undefined) entry.frequency = view.mean * share;
    }
    return entry;
  });
  return view;
}

function treeFrequency(esq: EventSequenceQuantification, model: EsqModel, tree: EsqTreeRecord): number | undefined {
  if (tree.transferEntry) return undefined;
  const group = groupFrequency(esq, model, tree.initiatorId, model.trees);
  if (tree.stateId === undefined) {
    const only = group.states.length === 1 ? group.states[0] : undefined;
    return only?.frequency;
  }
  return group.states.find((state) => state.stateId === tree.stateId)?.frequency;
}

function reachedModels(model: EsqModel, start: string): string[] {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined) break;
    const top = model.tops.find((record) => record.modelId === id);
    for (const next of top?.transferModelIds ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen];
}

function flagApplies(flag: EsqFlag, tree: EsqTreeRecord): boolean {
  const stateId = tree.stateId;
  const groupMatch = flag.groupIds.length === 0 || flag.groupIds.some((id) => sameItem(id, tree.initiatorId));
  const stateMatch = flag.stateIds.length === 0 || (stateId !== undefined && flag.stateIds.some((id) => sameItem(id, stateId)));
  return groupMatch && stateMatch;
}

function flagsForTree(esq: EventSequenceQuantification, tree: EsqTreeRecord): EsqFlag[] {
  return (esq.logic?.flags ?? []).filter((flag) => flag.target !== undefined && flagApplies(flag, tree));
}

function flagTargetKey(flag: EsqFlag): string | undefined {
  const target = flag.target;
  if (target === undefined) return undefined;
  return target.kind === "EVENT" ? `EVENT:${target.id}` : `${target.kind}:${target.modelId ?? ""}:${target.id}`;
}

function transferEdges(model: EsqModel, cut: readonly EsqLoopBreak[] = []): { fromModelId: string; toModelId: string }[] {
  return model.tops.flatMap((top) => top.transferModelIds
    .filter((toModelId) => !cut.some((entry) => entry.fromModelId === top.modelId && entry.toModelId === toModelId))
    .map((toModelId) => ({ fromModelId: top.modelId, toModelId })));
}

function transferLoops(model: EsqModel, cut: readonly EsqLoopBreak[] = []): EsqTransferLoop[] {
  const edges = transferEdges(model, cut);
  const nodes = uniqueTexts([...model.tops.map((top) => top.modelId), ...edges.map((edge) => edge.toModelId)]);
  const next = new Map(nodes.map((node) => [node, edges.filter((edge) => edge.fromModelId === node).map((edge) => edge.toModelId)]));
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let counter = 0;
  for (const root of nodes) {
    if (index.has(root)) continue;
    const work: { node: string; child: number }[] = [{ node: root, child: 0 }];
    index.set(root, counter);
    low.set(root, counter);
    counter += 1;
    stack.push(root);
    onStack.add(root);
    while (work.length > 0) {
      const frame = work[work.length - 1];
      if (frame === undefined) break;
      const children = next.get(frame.node) ?? [];
      if (frame.child < children.length) {
        const child = children[frame.child];
        frame.child += 1;
        if (child === undefined) continue;
        if (!index.has(child)) {
          index.set(child, counter);
          low.set(child, counter);
          counter += 1;
          stack.push(child);
          onStack.add(child);
          work.push({ node: child, child: 0 });
        } else if (onStack.has(child)) {
          low.set(frame.node, Math.min(low.get(frame.node) ?? 0, index.get(child) ?? 0));
        }
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent !== undefined) low.set(parent.node, Math.min(low.get(parent.node) ?? 0, low.get(frame.node) ?? 0));
      if (low.get(frame.node) === index.get(frame.node)) {
        const component: string[] = [];
        let member = stack.pop();
        while (member !== undefined) {
          onStack.delete(member);
          component.push(member);
          if (member === frame.node) break;
          member = stack.pop();
        }
        components.push(component);
      }
    }
  }
  return components
    .filter((component) => component.length > 1 || edges.some((edge) => edge.fromModelId === component[0] && edge.toModelId === component[0]))
    .map((component) => {
      const modelIds = [...component].sort();
      return {
        key: modelIds.join("|"),
        modelIds,
        edges: edges.filter((edge) => component.includes(edge.fromModelId) && component.includes(edge.toModelId)),
      };
    });
}

export {
  sameItem,
  hash32,
  esqStableId,
  esqTreeRunId,
  esqFunctionRunId,
  esqSequenceRunId,
  esqEndStateRunId,
  excludedBy,
  treesInScope,
  transferTreeIds,
  functionLinkOf,
  initiatorChoiceOf,
  ruleMatches,
  resolveLink,
  stateWeightingOf,
  moduleFactorFor,
  groupIdsOf,
  groupFrequency,
  treeFrequency,
  reachedModels,
  flagApplies,
  flagsForTree,
  flagTargetKey,
  transferEdges,
  transferLoops,
};
export type { EsqLinkOrigin, EsqResolvedLink, EsqGroupState, EsqGroupFrequency, EsqTransferLoop };
