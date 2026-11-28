import {
  type EsqCcfRecord,
  type EsqEventRecord,
  type EsqFamilyChoice,
  type EsqFamilyRecord,
  type EsqFunctionLink,
  type EsqFunctionRecord,
  type EsqFunctionRule,
  type EsqFunctionTarget,
  type EsqHumanRecord,
  type EsqInitiatorChoice,
  type EsqInitiatorRecord,
  type EsqTypedInitiator,
  type EsqModel,
  type EsqModelDecisions,
  type EsqModelElement,
  type EsqNetworkNodeTarget,
  type EsqParameterRecord,
  type EsqSequenceChoice,
  type EsqSequenceRecord,
  type EsqSplitFractionTarget,
  type EsqTopRecord,
  type EsqTopReference,
  type EsqTreeRecord,
  type EsqValueBinding,
  type EsqValueHolder,
  type EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { type EventSequence, type EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import { carriesUncertainExpression } from "interfaces-mef-types/sy/systems-analysis";
import { isComponentModel, type DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import {
  canonicalJson,
  ccfModelTakesTotal,
  expressionReferences,
  mapModelArguments,
  parameterReferenceKey,
  vectorLength,
  type UncertainExpression,
  type UncertainParameter,
} from "interfaces-mef-types/core/uncertainty";
import { type WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import type { ParameterOption, VectorOption } from "../newly-developed-methods/shared/uncertainEditor";
import { cellExpressionOfRecord, cellOf } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { hasUncertainty, parameterLaw, parameterUnit } from "interfaces-mef-types/esq/esq-measure-inputs";
import { sequenceFamilyOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import { type BayesianNetworkNode } from "interfaces-mef-types/modeling";
import { type EsqBayesianNetwork } from "interfaces-mef-types/esq/workbook-models";
import { type Workbook } from "interfaces-shared-types";
import {
  daParameterExpression,
  excludedBy,
  functionLinkOf,
  groupFrequency,
  groupIdsOf,
  initiatorChoiceOf,
  reachedModels,
  resolveLink,
  ruleMatches,
  sameItem,
  stateWeightingOf,
  transferTreeIds,
  treesInScope,
  withLiveDa,
  esqItemCode,
  type EsqGroupFrequency,
  type EsqGroupState,
  type EsqResolvedLink,
} from "interfaces-mef-types/esq/esq-run-inputs";
import {
  blank,
  esqLinkOf as linkOf,
  esqLiveModel,
  ieGroupRecord,
  textOf,
  topRecords,
  transferEntryInitiators,
  typedInitiatorsOf,
  typedTreesOf,
  unique,
  withMergedInitiators,
  type EsqModelSources,
} from "interfaces-mef-types/esq/esq-model-import";
import { scMissionTimeEntries, scMissionTimeTable } from "../sc-workbooks/scMissionTimeLinks";
import { type ScMissionTimeSource } from "../sc-workbooks/scMissionTimeSources";
import { parametersFor, peekExpression, requestExpression } from "../newly-developed-methods/shared/useUncertainty";
import { ccfFactorIssues } from "../sy-workbooks/syCcf";
import { validateEventTree } from "../newly-developed-methods/event-tree";
import { type EsqUpstream } from "./esqLinks";
import { ESQ_MODEL_ELEMENTS, MODEL_ELEMENT_LABELS, exampleLinkLabel } from "./esqViewData";

const RELEASE_END_STATE = "RADIONUCLIDE_RELEASE";

const EXAMPLE_SC_PREFIX = "example-sc-";

const RUNNING_MODES = new Set(["FAILURE_TO_RUN"]);

const NEW_INITIATOR_NAME = "New initiating event";

type EsqModelWindowKind = "esqSequence" | "esqTree" | "esqFamily" | "esqFunction" | "esqInitiator" | "esqValue";

type EsqFindingSeverity = "error" | "warning" | "note";

type EsqInitiatorCodeLock = "IE" | "ES";

interface EsqModelFinding {
  severity: EsqFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: EsqModelWindowKind; id: string };
}

const FINDING_RANK: Record<EsqFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

interface EsqSequenceView {
  record: EsqSequenceRecord;
  tree?: EsqTreeRecord;
  familyId?: string;
  choice?: EsqSequenceChoice;
  failed: string[];
  succeeded: string[];
  bypassed: string[];
}

interface EsqFamilyView {
  id: string;
  name: string;
  record?: EsqFamilyRecord;
  choice?: EsqFamilyChoice;
  manual: boolean;
  endState?: string;
  releaseCategoryId?: string;
  members: EsqSequenceView[];
  stateIds: string[];
  initiatorIds: string[];
  sourceIds: string[];
  endStates: string[];
  memberReleaseCategories: string[];
  release: boolean;
  mixes: boolean;
}

interface EsqFunctionView {
  record: EsqFunctionRecord;
  link?: EsqFunctionLink;
  trees: EsqTreeRecord[];
  resolved: { tree: EsqTreeRecord; link: EsqResolvedLink }[];
  unlinked: EsqTreeRecord[];
  targets: EsqFunctionTarget[];
  fromEs: boolean;
  edited: boolean;
}

type EsqInitiatorStateView = EsqGroupState;

interface EsqInitiatorView extends EsqGroupFrequency {
  trees: EsqTreeRecord[];
}

interface EsqValueView {
  kind: "EVENT" | "CCF";
  id: string;
  code: string;
  name: string;
  systemName?: string;
  event?: EsqEventRecord;
  ccf?: EsqCcfRecord;
  binding?: EsqValueBinding;
  heldBy: EsqValueHolder;
  holderId?: string;
  typedHere: boolean;
  component: boolean;
  expression?: UncertainExpression;
  problem?: string;
  value?: number;
  parameter?: EsqParameterRecord;
  human?: EsqHumanRecord;
  missionTime?: UncertainExpression;
  functionIds: string[];
}

interface EsqNetworkNodeView {
  network: EsqBayesianNetwork;
  node: BayesianNetworkNode;
}

interface EsqSplitView {
  key: string;
  functionId: string;
  functionName: string;
  ruleId?: string;
  scope: string;
  target: EsqSplitFractionTarget;
  expression?: UncertainExpression;
  trees: EsqTreeRecord[];
}

type EsqMissionPoint = { status: "pending" } | { status: "ready"; hours: number } | { status: "failed"; error: string };

interface EsqReferenceProblem {
  check: string;
  detail: string;
}

interface EsqModelView {
  model: EsqModel;
  trees: EsqTreeRecord[];
  sequences: EsqSequenceView[];
  outOfScope: number;
  families: EsqFamilyView[];
  functions: EsqFunctionView[];
  initiators: EsqInitiatorView[];
  values: EsqValueView[];
  findings: EsqModelFinding[];
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function listText(items: readonly string[], shown = 3): string {
  if (items.length <= shown) return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `${items.slice(0, shown).join(", ")} and ${items.length - shown} more`;
}

function modelLinked(esq: EventSequenceQuantification): EsqModelElement[] {
  return ESQ_MODEL_ELEMENTS.filter((element) => linkOf(esq, element) !== undefined);
}

function modelUnavailable(esq: EventSequenceQuantification, upstream: EsqUpstream): EsqModelElement[] {
  const failed = upstream.unavailable ?? [];
  return modelLinked(esq).filter((element) => failed.includes(element));
}

function effectiveMissionTime(tree: EsqTreeRecord): UncertainExpression | undefined {
  return tree.missionTime ?? tree.esMissionTime;
}

function workbookNameOf(id: string, options: readonly Workbook[]): string {
  return options.find((workbook) => workbook.id === id)?.name ?? exampleLinkLabel(id) ?? id;
}

function esqModelSourcesOf(upstream: EsqUpstream): EsqModelSources {
  return {
    ...(upstream.es === undefined ? {} : { es: upstream.es }),
    ...(upstream.sy === undefined ? {} : { sy: upstream.sy }),
    ...(upstream.da === undefined ? {} : { da: upstream.da }),
    ...(upstream.hr === undefined ? {} : { hr: upstream.hr }),
    ...(upstream.ie === undefined ? {} : { ie: upstream.ie }),
    ...(upstream.pos === undefined ? {} : { pos: upstream.pos }),
    ...(upstream.sc === undefined ? {} : { sc: upstream.sc }),
  };
}

function modelNameOf(upstream: EsqUpstream): (element: EsqModelElement, workbookId: string) => string {
  return (element, workbookId) => workbookNameOf(workbookId, upstream.options[element]);
}

function withTreeMissionTime(esq: EventSequenceQuantification, treeId: string, missionTime: UncertainExpression | undefined): EventSequenceQuantification {
  const model = esq.model;
  if (model === undefined) return esq;
  const trees = model.trees.map((tree) => {
    if (tree.id !== treeId) return tree;
    const next: EsqTreeRecord = { ...tree };
    if (missionTime === undefined) delete next.missionTime;
    else next.missionTime = missionTime;
    return next;
  });
  return { ...esq, model: { ...model, trees } };
}

function withTypedModel(esq: EventSequenceQuantification, upstream: EsqUpstream): EventSequenceQuantification {
  return withModelImported(esq, upstream);
}

function withTypedTrees(esq: EventSequenceQuantification, trees: EventTree[], upstream: EsqUpstream): EventSequenceQuantification {
  return withTypedModel({ ...esq, modelDecisions: { ...(esq.modelDecisions ?? {}), typedTrees: trees } }, upstream);
}

function withTypedInitiatorRecord(esq: EventSequenceQuantification, record: EsqInitiatorRecord): EventSequenceQuantification {
  const { typed: _typed, ...fields } = record;
  return withDecisions(esq, (decisions) => {
    const current = decisions.typedInitiators ?? [];
    const known = current.find((entry) => sameItem(entry.id, record.id));
    const ieOwned = known === undefined ? esq.model?.initiators.some((entry) => entry.typed !== true && sameItem(entry.id, record.id)) === true : known.ieOwned === true;
    const owned: EsqTypedInitiator = ieOwned ? { ...fields, ieOwned: true } : fields;
    const next: EsqTypedInitiator = known?.synced === undefined ? owned : { ...owned, synced: known.synced };
    const choices = (decisions.initiatorChoices ?? []).flatMap((choice): EsqInitiatorChoice[] => {
      if (!sameItem(choice.groupId, record.id) || choice.source === "IE") return [choice];
      return choice.shares === undefined || choice.shares.length === 0 ? [] : [{ groupId: choice.groupId, source: "IE", shares: choice.shares }];
    });
    return {
      ...decisions,
      initiatorChoices: choices,
      typedInitiators: known === undefined ? [...current, next] : current.map((entry) => (entry === known ? next : entry)),
    };
  });
}

function withTypedInitiator(esq: EventSequenceQuantification, record: EsqInitiatorRecord, upstream: EsqUpstream): EventSequenceQuantification {
  return withTypedModel(withTypedInitiatorRecord(esq, record), upstream);
}

function newTypedInitiator(id: string, stateId: string | undefined): EsqInitiatorRecord {
  return { id, name: NEW_INITIATOR_NAME, stateIds: stateId === undefined ? [] : [stateId] };
}

function initiatorCodesOf(esq: EventSequenceQuantification, ie?: InitiatingEventsAnalysis): string[] {
  return [
    ...(esq.model?.initiators ?? []).map((record) => record.id),
    ...typedInitiatorsOf(esq).map((record) => record.id),
    ...(esq.model?.trees ?? []).map((tree) => tree.initiatorId),
    ...typedTreesOf(esq).map((tree) => tree.initiatingEventId),
    ...esq.modelIntegration.scopeCoverage.initiatingEventGroups,
    ...(esq.modelIntegration.scopeExclusions ?? []).flatMap((exclusion) => (exclusion.aspect === "INITIATOR_GROUP" ? [exclusion.item] : [])),
    ...(ie?.initiatingEventGroups ?? []).map((group) => group.uuid),
  ];
}

function initiatorCodeTaken(esq: EventSequenceQuantification, code: string, current: string, ie?: InitiatingEventsAnalysis): boolean {
  return initiatorCodesOf(esq, ie).some((id) => sameItem(id, code) && !sameItem(id, current));
}

function initiatorCodeLock(esq: EventSequenceQuantification, id: string): EsqInitiatorCodeLock | undefined {
  const typed = typedInitiatorsOf(esq).find((entry) => sameItem(entry.id, id));
  const imported = esq.model?.initiators.some((record) => record.typed !== true && sameItem(record.id, id)) === true;
  if (typed?.ieOwned === true || (typed === undefined && imported)) return "IE";
  if ((esq.model?.trees ?? []).some((tree) => tree.typed !== true && !tree.transferEntry && sameItem(tree.initiatorId, id))) return "ES";
  return undefined;
}

function renamedIds(ids: readonly string[], from: string, to: string): string[] {
  return ids.map((id) => (sameItem(id, from) ? to : id));
}

function withInitiatorCode(esq: EventSequenceQuantification, from: string, to: string, upstream: EsqUpstream): EventSequenceQuantification {
  const code = to.trim();
  if (code.length === 0 || code === from) return esq;
  const ieWorkbookId = linkOf(esq, "IE");
  const owned = typedInitiatorsOf(esq).some((entry) => sameItem(entry.id, from)) ? esq : withTypedInitiatorRecord(esq, initiatorRecordOf(esq, from));
  const decisions = owned.modelDecisions ?? {};
  const typedInitiators = typedInitiatorsOf(owned).map((entry): EsqTypedInitiator => {
    if (!sameItem(entry.id, from)) return entry;
    const synced = entry.synced === undefined || entry.synced.workbookId !== ieWorkbookId ? entry.synced : { ...entry.synced, groupId: entry.synced.groupId ?? entry.id };
    const renamed: EsqTypedInitiator = { ...entry, id: code, name: sameItem(entry.name, from) ? code : entry.name };
    return synced === undefined ? renamed : { ...renamed, synced };
  });
  const integration = owned.modelIntegration;
  const exclusions = integration.scopeExclusions;
  const logic = owned.logic;
  const post = owned.postWork;
  const review = owned.review;
  const model = owned.model;
  const next: EventSequenceQuantification = {
    ...owned,
    modelDecisions: {
      ...decisions,
      typedInitiators,
      ...(decisions.typedTrees === undefined ? {} : { typedTrees: decisions.typedTrees.map((tree) => (sameItem(tree.initiatingEventId, from) ? { ...tree, initiatingEventId: code } : tree)) }),
      ...(decisions.initiatorChoices === undefined ? {} : { initiatorChoices: decisions.initiatorChoices.map((choice) => (sameItem(choice.groupId, from) ? { ...choice, groupId: code } : choice)) }),
      ...(decisions.functionLinks === undefined ? {} : { functionLinks: decisions.functionLinks.map((link) => (link.rules === undefined ? link : { ...link, rules: link.rules.map((rule) => ({ ...rule, groupIds: renamedIds(rule.groupIds, from, code) })) })) }),
    },
    modelIntegration: {
      ...integration,
      scopeCoverage: { ...integration.scopeCoverage, initiatingEventGroups: renamedIds(integration.scopeCoverage.initiatingEventGroups, from, code) },
      ...(exclusions === undefined ? {} : { scopeExclusions: exclusions.map((exclusion) => (exclusion.aspect === "INITIATOR_GROUP" && sameItem(exclusion.item, from) ? { ...exclusion, item: code } : exclusion)) }),
    },
    ...(logic?.flags === undefined ? {} : { logic: { ...logic, flags: logic.flags.map((flag) => ({ ...flag, groupIds: renamedIds(flag.groupIds, from, code) })) } }),
    ...(post === undefined ? {} : {
      postWork: {
        ...post,
        ...(post.recoveries === undefined ? {} : { recoveries: post.recoveries.map((rule) => ({ ...rule, groupIds: renamedIds(rule.groupIds, from, code) })) }),
        ...(post.combinations === undefined ? {} : { combinations: post.combinations.map((combination) => ({ ...combination, groupIds: renamedIds(combination.groupIds, from, code) })) }),
      },
    }),
    ...(review?.screened === undefined ? {} : { review: { ...review, screened: review.screened.map((bound) => (sameItem(bound.groupId, from) ? { ...bound, groupId: code } : bound)) } }),
    ...(model === undefined ? {} : { model: { ...model, initiators: model.initiators.filter((record) => record.typed === true || !sameItem(record.id, from)) } }),
  };
  return withTypedModel(next, upstream);
}

function nextTypedInitiatorCode(esq: EventSequenceQuantification, ie?: InitiatingEventsAnalysis): string {
  const taken = new Set(initiatorCodesOf(esq, ie).map((id) => id.trim().toLowerCase()));
  let n = 1;
  while (taken.has(`ieg-esq-${String(n).padStart(2, "0")}`)) n += 1;
  return `IEG-ESQ-${String(n).padStart(2, "0")}`;
}

function initiatorRecordOf(esq: EventSequenceQuantification, id: string): EsqInitiatorRecord {
  const record = esq.model?.initiators.find((candidate) => sameItem(candidate.id, id));
  const base: EsqInitiatorRecord = record === undefined ? { id, name: id, stateIds: [] } : { ...record };
  const choice = initiatorChoiceOf(esq, id);
  if (choice?.source === "TYPED" && choice.expression !== undefined) {
    const { holderId: _holderId, ...rest } = base;
    return { ...rest, frequency: { expression: choice.expression, basis: choice.unit ?? FrequencyUnit.PER_REACTOR_YEAR }, heldBy: "TYPED" };
  }
  if (choice?.source === "DA" && choice.parameterId !== undefined) {
    const expression = daParameterExpression(esq, choice.parameterId);
    if (expression !== undefined) return { ...base, frequency: { expression, basis: FrequencyUnit.PER_PLANT_YEAR }, heldBy: "DA", holderId: choice.parameterId };
  }
  return base;
}

function withTypedTreeRemoved(esq: EventSequenceQuantification, treeId: string, upstream: EsqUpstream): EventSequenceQuantification {
  const sequenceIds = new Set((esq.model?.sequences ?? []).filter((sequence) => sequence.treeId === treeId).map((sequence) => sequence.id));
  const decisions = esq.modelDecisions ?? {};
  const functionLinks = (decisions.functionLinks ?? []).flatMap((link): EsqFunctionLink[] => {
    const rules = (link.rules ?? []).filter((rule) => !(rule.treeIds ?? []).includes(treeId));
    const next: EsqFunctionLink = { ...link, rules };
    return next.target !== undefined || rules.length > 0 || !blank(next.reason) ? [next] : [];
  });
  const cleaned: EventSequenceQuantification = {
    ...esq,
    modelDecisions: { ...decisions, functionLinks, sequenceChoices: (decisions.sequenceChoices ?? []).filter((choice) => !sequenceIds.has(choice.sequenceId)) },
  };
  return withTypedTrees(cleaned, typedTreesOf(esq).filter((tree) => tree.uuid !== treeId), upstream);
}

function withModelImported(esq: EventSequenceQuantification, upstream: EsqUpstream): EventSequenceQuantification {
  const model = esqLiveModel(esq, esqModelSourcesOf(upstream), modelNameOf(upstream));
  const { model: _held, ...rest } = esq;
  return model === undefined ? rest : { ...rest, model };
}

function decisionsOf(esq: EventSequenceQuantification): EsqModelDecisions {
  return esq.modelDecisions ?? {};
}

function familyChoiceOf(esq: EventSequenceQuantification, familyId: string): EsqFamilyChoice | undefined {
  return decisionsOf(esq).familyChoices?.find((choice) => choice.familyId === familyId);
}

function sequenceChoiceOf(esq: EventSequenceQuantification, sequenceId: string): EsqSequenceChoice | undefined {
  return decisionsOf(esq).sequenceChoices?.find((choice) => choice.sequenceId === sequenceId);
}

function valueBindingOf(esq: EventSequenceQuantification, eventId: string): EsqValueBinding | undefined {
  return decisionsOf(esq).valueBindings?.find((binding) => binding.eventId === eventId);
}

function topOf(model: EsqModel, top: EsqTopReference): EsqTopRecord | undefined {
  return model.tops.find((record) => record.modelId === top.modelId && record.gateId === top.gateId)
    ?? model.tops.find((record) => record.modelId === top.modelId);
}

function targetKey(target: EsqFunctionTarget): string {
  if (target.kind === "FAULT_TREE") return `tree:${target.top.modelId}:${target.top.gateId}`;
  if (target.kind === "NETWORK_NODE") return `node:${target.node.workbookId}:${target.node.modelId}:${target.node.nodeId}:${[...target.trueStateIds].sort().join(",")}`;
  return `split:${target.cellId ?? ""}:${target.parameterId ?? ""}:${target.expression === undefined ? "" : canonicalJson(target.expression)}`;
}

function targetNodeOf(esq: EventSequenceQuantification, target: EsqNetworkNodeTarget): EsqNetworkNodeView | undefined {
  const network = esq.bayesianNetworks.find((candidate) => candidate.modelId === target.node.modelId);
  const node = network?.nodes.find((candidate) => candidate.id === target.node.nodeId);
  return network === undefined || node === undefined ? undefined : { network, node };
}

function failingStatesReady(node: BayesianNetworkNode, stateIds: readonly string[]): boolean {
  const failing = node.states.filter((state) => stateIds.includes(state.id));
  return failing.length > 0 && failing.length < node.states.length && stateIds.every((stateId) => node.states.some((state) => state.id === stateId));
}

function sequenceViews(esq: EventSequenceQuantification, model: EsqModel, trees: readonly EsqTreeRecord[]): EsqSequenceView[] {
  const treeById = new Map(trees.map((tree) => [tree.id, tree]));
  return model.sequences.flatMap((record) => {
    const tree = treeById.get(record.treeId);
    if (tree === undefined) return [];
    const choice = sequenceChoiceOf(esq, record.id);
    const order = tree.functionIds;
    const keys = [...order, ...Object.keys(record.path).filter((key) => !order.includes(key))];
    const view: EsqSequenceView = {
      record,
      tree,
      failed: keys.filter((key) => record.path[key] === "FAILURE"),
      succeeded: keys.filter((key) => record.path[key] === "SUCCESS"),
      bypassed: keys.filter((key) => record.path[key] === "BYPASSED" || record.path[key] === undefined),
    };
    if (choice !== undefined) view.choice = choice;
    const familyId = sequenceFamilyOf(esq, record);
    if (familyId !== undefined) view.familyId = familyId;
    return [view];
  });
}

function familyViews(esq: EventSequenceQuantification, model: EsqModel, sequences: readonly EsqSequenceView[]): EsqFamilyView[] {
  const manual = (decisionsOf(esq).familyChoices ?? []).filter((choice) => choice.manual !== undefined);
  const entries: { id: string; record?: EsqFamilyRecord; choice?: EsqFamilyChoice }[] = [
    ...model.families.map((record) => ({ id: record.id, record, choice: familyChoiceOf(esq, record.id) })),
    ...manual.filter((choice) => !model.families.some((record) => record.id === choice.familyId)).map((choice) => ({ id: choice.familyId, choice })),
  ];
  return entries.map(({ id, record, choice }) => {
    const members = sequences.filter((sequence) => sequence.familyId === id);
    const stateIds = unique(members.flatMap((member) => (member.tree?.stateId === undefined ? [] : [member.tree.stateId])));
    const initiatorIds = unique(members.flatMap((member) => (member.tree === undefined ? [] : [member.tree.initiatorId])));
    const sourceIds = unique(members.flatMap((member) => member.record.sourceIds ?? []));
    const endStates = unique(members.flatMap((member) => (member.record.endState === undefined ? [] : [member.record.endState])));
    const memberReleaseCategories = unique(members.flatMap((member) => (member.record.releaseCategoryId === undefined ? [] : [member.record.releaseCategoryId])));
    const esCategories = record?.releaseCategoryIds ?? [];
    const releaseCategoryId = textOf(choice?.releaseCategoryId)
      ?? (esCategories.length === 1 ? esCategories[0] : undefined)
      ?? (esCategories.length === 0 && memberReleaseCategories.length === 1 ? memberReleaseCategories[0] : undefined);
    const endState = choice?.manual !== undefined ? textOf(choice.endState) : record?.endState ?? (endStates.length === 1 ? endStates[0] : undefined);
    const view: EsqFamilyView = {
      id,
      name: textOf(choice?.manual !== undefined ? choice.name : record?.name) ?? "",
      manual: choice?.manual !== undefined,
      members,
      stateIds,
      initiatorIds,
      sourceIds,
      endStates,
      memberReleaseCategories,
      release: endState === RELEASE_END_STATE || esCategories.length > 0 || memberReleaseCategories.length > 0 || releaseCategoryId !== undefined,
      mixes: stateIds.length > 1 || sourceIds.length > 1,
    };
    if (record !== undefined) view.record = record;
    if (choice !== undefined) view.choice = choice;
    if (endState !== undefined) view.endState = endState;
    if (releaseCategoryId !== undefined) view.releaseCategoryId = releaseCategoryId;
    return view;
  });
}

function functionViews(esq: EventSequenceQuantification, model: EsqModel, trees: readonly EsqTreeRecord[]): EsqFunctionView[] {
  return model.functions.flatMap((record) => {
    const using = trees.filter((tree) => record.treeIds.includes(tree.id));
    if (using.length === 0) return [];
    const link = functionLinkOf(esq, record.id);
    const resolved = using.map((tree) => ({ tree, link: resolveLink(record, link, tree) }));
    const targets: EsqFunctionTarget[] = [];
    for (const entry of resolved) {
      const target = entry.link.target;
      if (target !== undefined && !targets.some((seen) => targetKey(seen) === targetKey(target))) targets.push(target);
    }
    const esTrees = record.esLinks.map((entry) => entry.treeId);
    const fromEs = using.some((tree) => tree.typed !== true && esTrees.includes(tree.id));
    const view: EsqFunctionView = {
      record,
      trees: using,
      resolved,
      unlinked: resolved.filter((entry) => entry.link.target === undefined).map((entry) => entry.tree),
      targets,
      fromEs,
      edited: fromEs && (link?.target !== undefined || (link?.rules ?? []).length > 0),
    };
    if (link !== undefined) view.link = link;
    return [view];
  });
}

function initiatorViews(esq: EventSequenceQuantification, model: EsqModel, trees: readonly EsqTreeRecord[]): EsqInitiatorView[] {
  return groupIdsOf(trees).map((id) => ({
    ...groupFrequency(esq, model, id, trees),
    trees: trees.filter((tree) => !tree.transferEntry && sameItem(tree.initiatorId, id)),
  }));
}

function eventFunctionsOf(model: EsqModel, functions: readonly EsqFunctionView[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const reachedByTop = new Map<string, string[]>();
  for (const view of functions) {
    for (const target of view.targets) {
      if (target.kind !== "FAULT_TREE") continue;
      const models = reachedByTop.get(target.top.modelId) ?? reachedModels(model, target.top.modelId);
      reachedByTop.set(target.top.modelId, models);
      for (const modelId of models) {
        for (const eventId of model.tops.find((record) => record.modelId === modelId)?.eventIds ?? []) {
          const list = out.get(eventId) ?? [];
          if (!list.includes(view.record.id)) list.push(view.record.id);
          out.set(eventId, list);
        }
      }
    }
  }
  return out;
}

function daReferenceOf(esq: EventSequenceQuantification, parameterId: string): WorkbookParameterReference | undefined {
  const workbookId = linkOf(esq, "DA");
  return workbookId === undefined ? undefined : { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId: parameterId };
}

function liveEsqOf(esq: EventSequenceQuantification, da: DataAnalysis | undefined): EventSequenceQuantification {
  const model = esq.model;
  const workbookId = linkOf(esq, "DA");
  return model === undefined || workbookId === undefined || da === undefined ? esq : { ...esq, model: withLiveDa(model, da, workbookId) };
}

function missionTimeSourcesOf(esq: EventSequenceQuantification, upstream: Pick<EsqUpstream, "sc" | "scReferenced">): ScMissionTimeSource[] {
  const workbookId = linkOf(esq, "SC");
  return [...(workbookId === undefined || upstream.sc === undefined ? [] : [{ workbookId, sc: upstream.sc }]), ...upstream.scReferenced];
}

function scTableOf(sources: readonly ScMissionTimeSource[]): Map<string, UncertainParameter> {
  return new Map(sources.flatMap((source) => [...scMissionTimeTable(source.workbookId, source.sc)]));
}

function parameterTableOf(esq: EventSequenceQuantification, sources: readonly ScMissionTimeSource[] = []): Map<string, UncertainParameter> {
  const table = scTableOf(sources);
  for (const parameter of esq.model?.parameters ?? []) {
    const reference = daReferenceOf(esq, parameter.id);
    const expression = parameterLaw(parameter);
    if (reference === undefined || expression === undefined) continue;
    table.set(parameterReferenceKey(reference), { reference, expression });
  }
  for (const factor of esq.model?.ccfFactors ?? []) table.set(parameterReferenceKey(factor.reference), factor);
  return table;
}

function idParts(entityId: string, prefix: string, count: number): string[] | undefined {
  const parts = entityId.split("/");
  return parts.length === count && parts[0] === prefix && parts.every((part) => part.length > 0) ? parts : undefined;
}

function ccfVectorOptionsOf(esq: EventSequenceQuantification): VectorOption[] {
  return (esq.model?.vectors ?? []).map((vector) => {
    const length = vectorLength(vector.vector);
    const template = idParts(vector.reference.entityId, "ccfv", 5)?.[2];
    return { reference: vector.reference, label: `DA · ${template ?? vector.reference.entityId}, ${length} members`, length };
  });
}

function daParameterOptionsOf(esq: EventSequenceQuantification): ParameterOption[] {
  return (esq.model?.parameters ?? []).flatMap((parameter): ParameterOption[] => {
    const reference = daReferenceOf(esq, parameter.id);
    return reference === undefined || parameterLaw(parameter) === undefined ? [] : [{ reference, label: `DA · ${parameter.id} · ${parameter.name}`, unit: parameterUnit(parameter) }];
  });
}

function ccfFactorOptionsOf(esq: EventSequenceQuantification): ParameterOption[] {
  return (esq.model?.ccfFactors ?? []).map((factor) => ({
    reference: factor.reference,
    label: `DA · ${idParts(factor.reference.entityId, "ccff", 3)?.[2] ?? factor.reference.entityId}`,
    unit: factor.expression.node === "VALUE" ? factor.expression.value.unit : "FACTOR",
  }));
}

function parameterLabelOf(esq: EventSequenceQuantification, sources: readonly ScMissionTimeSource[] = []): (key: string) => string {
  const labels = new Map<string, string>(sources.flatMap((source) => scMissionTimeEntries(source.workbookId, source.sc).map((entry) => [parameterReferenceKey(entry.reference), entry.label] as const)));
  for (const option of [...ccfVectorOptionsOf(esq), ...ccfFactorOptionsOf(esq)]) labels.set(parameterReferenceKey(option.reference), option.label);
  for (const parameter of esq.model?.parameters ?? []) {
    const reference = daReferenceOf(esq, parameter.id);
    if (reference !== undefined) labels.set(parameterReferenceKey(reference), esqItemCode(parameter.id, parameter.name, "Unnamed parameter"));
  }
  return (key) => labels.get(key) ?? esqItemCode(key.slice(key.indexOf(":") + 1), undefined, "Unresolved parameter");
}

function substituted(expression: UncertainExpression, from: string, to: UncertainExpression): UncertainExpression {
  switch (expression.node) {
    case "VALUE": return expression;
    case "PARAMETER": return parameterReferenceKey(expression.reference) === from ? to : expression;
    case "OPERATION": return { ...expression, operands: expression.operands.map((operand) => substituted(operand, from, to)) };
    case "MODEL": return { node: "MODEL", model: mapModelArguments(expression.model, (argument) => substituted(argument, from, to)) };
  }
}

function inlinedExpression(expression: UncertainExpression, table: ReadonlyMap<string, UncertainParameter>, seen: ReadonlySet<string> = new Set()): UncertainExpression {
  switch (expression.node) {
    case "VALUE": return expression;
    case "PARAMETER": {
      const key = parameterReferenceKey(expression.reference);
      const parameter = table.get(key);
      return parameter === undefined || seen.has(key) ? expression : inlinedExpression(parameter.expression, table, new Set([...seen, key]));
    }
    case "OPERATION": return { ...expression, operands: expression.operands.map((operand) => inlinedExpression(operand, table, seen)) };
    case "MODEL": return { node: "MODEL", model: mapModelArguments(expression.model, (argument) => inlinedExpression(argument, table, seen)) };
  }
}

function missionTimeOf(expression: UncertainExpression | undefined): UncertainExpression | undefined {
  return expression?.node === "MODEL" && expression.model.form === "MISSION" ? expression.model.missionTime : undefined;
}

function readsMissionTime(esq: EventSequenceQuantification, reference: WorkbookParameterReference): boolean {
  const workbookId = linkOf(esq, "SC");
  return reference.workbookId.startsWith(EXAMPLE_SC_PREFIX) || (workbookId !== undefined && reference.workbookId.trim() === workbookId.trim());
}

function boundExpression(esq: EventSequenceQuantification, event: EsqEventRecord, parameter: EsqParameterRecord): Pick<EsqValueView, "expression" | "problem"> {
  if (parameter.estimate === undefined) return { problem: `DA gives ${parameter.name} no estimate. Give it one in DA.` };
  const reference = daReferenceOf(esq, parameter.id);
  if (reference === undefined) return { problem: "Step 01 links no DA workbook. Link it in Step 01." };
  const own: UncertainExpression = { node: "PARAMETER", reference };
  const key = parameterReferenceKey(reference);
  const imported = event.expression;
  const references = imported === undefined ? [] : expressionReferences(imported).filter((entry) => !readsMissionTime(esq, entry));
  if (imported !== undefined && references.some((entry) => parameterReferenceKey(entry) === key)) return { expression: imported };
  if (parameterUnit(parameter) === "PROBABILITY") return { expression: own };
  const [only, ...others] = references;
  if (imported === undefined || only === undefined || others.length > 0) return { problem: `${parameter.name} is a rate. Bind it only to an event whose SY value is a mission or standby model of one rate.` };
  return { expression: substituted(imported, parameterReferenceKey(only), own) };
}

function valueViews(esq: EventSequenceQuantification, model: EsqModel, functions: readonly EsqFunctionView[], table: ReadonlyMap<string, UncertainParameter>): EsqValueView[] {
  const reached = eventFunctionsOf(model, functions);
  const events = model.events.flatMap((event): EsqValueView[] => {
    const functionIds = reached.get(event.id);
    if (functionIds === undefined) return [];
    const binding = valueBindingOf(esq, event.id);
    const typedHere = binding?.heldBy === "TYPED";
    const heldBy = binding?.heldBy ?? event.heldBy;
    const holderId = typedHere ? undefined : binding?.holderId ?? event.holderId;
    const component = carriesUncertainExpression(event.failureMode);
    const view: EsqValueView = { kind: "EVENT", id: event.id, code: event.code, name: event.name, event, heldBy, typedHere, component, functionIds };
    if (event.systemName !== undefined) view.systemName = event.systemName;
    if (binding !== undefined) view.binding = binding;
    if (holderId !== undefined) view.holderId = holderId;
    if (typedHere && binding?.expression !== undefined) view.expression = binding.expression;
    const parameter = heldBy === "DA" ? model.parameters.find((candidate) => candidate.id === holderId) : undefined;
    const human = heldBy === "HRA" ? model.humanEvents.find((candidate) => candidate.id === holderId) : undefined;
    if (parameter !== undefined) {
      view.parameter = parameter;
      if (isComponentModel(parameter.quantificationModel) && !component) {
        view.problem = `${parameter.name} is a component estimate. It cannot set ${event.code}.`;
      } else if (isComponentModel(parameter.quantificationModel)) {
        const bound = boundExpression(esq, event, parameter);
        if (bound.expression !== undefined) view.expression = bound.expression;
        if (bound.problem !== undefined) view.problem = bound.problem;
      } else if (parameterUnit(parameter) !== "PROBABILITY") {
        view.problem = `${parameter.name} is a ${parameter.parameterType === "FREQUENCY" ? "frequency" : "rate"}. It cannot set ${event.code}.`;
      } else {
        const reference = daReferenceOf(esq, parameter.id);
        if (reference === undefined) view.problem = "Step 01 links no DA workbook. Link it in Step 01.";
        else if (parameterLaw(parameter) === undefined) view.problem = `DA gives ${parameter.name} no value. Give it one in DA.`;
        else view.expression = { node: "PARAMETER", reference };
      }
    } else if (human !== undefined) {
      view.human = human;
      if (human.hep !== undefined) view.expression = human.hep;
    }
    const open = view.value === undefined && view.expression === undefined && view.problem === undefined && binding === undefined;
    if (open && component && event.expression !== undefined) view.expression = event.expression;
    if (open && !component && event.value !== undefined) view.value = event.value;
    const running = event.valueUnit === "PER_HOUR" || (event.failureMode !== undefined && RUNNING_MODES.has(event.failureMode)) || parameter?.quantificationModel === "MISSION_PROBABILITY";
    const mission = view.expression === undefined ? (running ? parameter?.missionTime ?? event.missionTime : undefined) : missionTimeOf(inlinedExpression(view.expression, table));
    if (mission !== undefined) view.missionTime = mission;
    return [view];
  });
  const groups = model.ccfGroups.flatMap((group): EsqValueView[] => {
    const functionIds = unique(group.memberIds.flatMap((member) => reached.get(member) ?? []));
    if (functionIds.length === 0) return [];
    const view: EsqValueView = { kind: "CCF", id: group.id, code: group.id, name: group.name, ccf: group, heldBy: group.estimateRef === undefined ? "TYPED" : "DA", typedHere: false, component: false, functionIds };
    if (group.estimateRef !== undefined) view.holderId = group.estimateRef;
    if (group.total !== undefined && (group.factors === undefined || ccfModelTakesTotal(group.factors))) view.expression = group.total;
    const systems = unique(group.systemIds);
    if (systems.length > 0) view.systemName = model.tops.find((top) => top.systemId === systems[0])?.systemName ?? systems[0];
    return [view];
  });
  return [...events, ...groups];
}

function sortFindings(findings: readonly EsqModelFinding[]): EsqModelFinding[] {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => FINDING_RANK[a.finding.severity] - FINDING_RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
}

function sourceFindings(model: EsqModel, unavailable: readonly EsqModelElement[]): EsqModelFinding[] {
  const findings: EsqModelFinding[] = unavailable.map((element): EsqModelFinding => ({
    severity: "warning",
    check: "Linked workbook unavailable",
    item: MODEL_ELEMENT_LABELS[element],
    detail: `The linked ${MODEL_ELEMENT_LABELS[element]} workbook could not be read, so its items are missing here. Fix the link in Step 01.`,
  }));
  if (model.trees.length === 0) findings.push({ severity: "error", check: "No event tree", item: "Trees", detail: "Link ES in Step 01, or draw an event tree in the Trees tab." });
  return findings;
}

function sequenceFindings(model: EsqModel, sequences: readonly EsqSequenceView[], families: readonly EsqFamilyView[]): EsqModelFinding[] {
  const findings: EsqModelFinding[] = [];
  const familyIds = new Set(families.map((family) => family.id));
  const treeIds = new Set(model.trees.map((tree) => tree.id));
  const orphans = model.sequences.filter((sequence) => !treeIds.has(sequence.treeId)).map((sequence) => sequence.code);
  if (orphans.length > 0) findings.push({ severity: "warning", check: "No event tree", item: listText(orphans), detail: `ES lists ${plural(orphans.length, "sequence")} without an event tree. ${orphans.length === 1 ? "It" : "They"} cannot be quantified.` });
  for (const view of sequences) {
    const record = view.record;
    const target = { kind: "esqSequence" as const, id: record.id };
    const multiBranch = record.multiBranchFunctions ?? [];
    if (multiBranch.length > 0) findings.push({ severity: "error", check: "More than two branches", item: record.code, detail: `${record.code} passes ${listText(multiBranch)} with more than two branches. ESQ cannot quantify numbered branches yet.`, target });
    if (record.transferTreeId !== undefined) {
      const treeCode = model.trees.find((tree) => tree.id === record.transferTreeId)?.code;
      if (treeCode === undefined) findings.push({ severity: "error", check: "Transfer target missing", item: record.code, detail: `${record.code} transfers to a tree that ES does not have.` });
      else if ((record.transferCarries ?? []).length === 0) findings.push({ severity: "warning", check: "Nothing carried", item: record.code, detail: `ES does not say what ${record.code} carries into ${treeCode}. Record it in ES (ESQ-C3).` });
      if (record.familyId !== undefined && treeCode !== undefined) findings.push({ severity: "note", check: "Transfer in a family", item: record.code, detail: `ES puts ${record.code} in ${record.familyId}. ESQ counts it through the ${treeCode} sequences instead.` });
      continue;
    }
    if (view.choice !== undefined && view.tree?.typed !== true && blank(view.choice.reason)) findings.push({ severity: "error", check: "Changed without a reason", item: record.code, detail: "The family differs from ES. Give the reason.", target });
    if (view.familyId === undefined) findings.push({ severity: "error", check: "No family", item: record.code, detail: `${record.code} is in no family. Assign one.`, target });
    else if (!familyIds.has(view.familyId)) findings.push({ severity: "error", check: "Unknown family", item: record.code, detail: `${view.familyId} is not among the families.`, target });
  }
  return findings;
}

function familyFindings(families: readonly EsqFamilyView[]): EsqModelFinding[] {
  const findings: EsqModelFinding[] = [];
  for (const family of families) {
    const target = { kind: "esqFamily" as const, id: family.id };
    const esCategories = family.record?.releaseCategoryIds ?? [];
    if (family.manual) {
      if (blank(family.name)) findings.push({ severity: "warning", check: "No name", item: family.id, detail: "Name the family.", target });
      if (blank(family.choice?.manual?.source)) findings.push({ severity: "warning", check: "Source not given", item: family.id, detail: "Say where this family comes from.", target });
    } else if (blank(family.record?.name)) {
      findings.push({ severity: "warning", check: "Family not in ES", item: family.id, detail: `Sequences use ${family.id}, but ES does not define it.`, target });
    }
    if (family.members.length === 0) {
      findings.push({ severity: "warning", check: "Empty family", item: family.id, detail: "No sequence in scope belongs to this family.", target });
      continue;
    }
    if (esCategories.length > 1 && blank(family.choice?.releaseCategoryId)) {
      findings.push({ severity: "error", check: "Several release categories", item: family.id, detail: `ES gives ${listText(esCategories)}. Choose one.`, target });
    } else if (family.release && family.releaseCategoryId === undefined) {
      findings.push({ severity: "error", check: "No release category", item: family.id, detail: "A release family needs one release category.", target });
    }
    const others = family.releaseCategoryId === undefined ? [] : family.members.filter((member) => member.record.releaseCategoryId !== undefined && member.record.releaseCategoryId !== family.releaseCategoryId).map((member) => member.record.code);
    if (others.length > 0) findings.push({ severity: "warning", check: "Member release category", item: family.id, detail: `${listText(others)} ${others.length === 1 ? "is" : "are"} in another release category than ${family.releaseCategoryId ?? ""}.`, target });
    if (family.endStates.length > 1) findings.push({ severity: "warning", check: "Mixed end states", item: family.id, detail: "Members end in different end states. ESQ-A1 groups like end states.", target });
    if (family.mixes && blank(family.choice?.groupingReason)) {
      const parts = [family.stateIds.length > 1 ? plural(family.stateIds.length, "operating state") : "", family.sourceIds.length > 1 ? plural(family.sourceIds.length, "source") : ""].filter((part) => part.length > 0);
      findings.push({ severity: "error", check: "Mixed without a reason", item: family.id, detail: `Members span ${parts.join(" and ")}. Give the reason they form one family (ESQ-A1).`, target });
    }
  }
  return findings;
}

function splitFindings(esq: EventSequenceQuantification, model: EsqModel, target: EsqFunctionTarget, item: string, where: string, cc: string | undefined, findingTarget: EsqModelFinding["target"]): EsqModelFinding[] {
  if (target.kind !== "SPLIT_FRACTION") return [];
  const findings: EsqModelFinding[] = [];
  if (target.cellId !== undefined) {
    const cell = cellOf(esq, target.cellId);
    if (cell === undefined) findings.push({ severity: "error", check: "Step 03 cell missing", item, detail: `${where} takes cell ${target.cellId}, which Step 03 no longer has.`, target: findingTarget });
    else if (cellExpressionOfRecord(cell) === undefined) findings.push({ severity: "error", check: "No Step 03 value", item, detail: `${where} takes cell ${cell.id}, which has no value of record yet. Run it or type a value in Step 03.`, target: findingTarget });
    return findings;
  }
  if (target.parameterId !== undefined) {
    if (!model.parameters.some((parameter) => parameter.id === target.parameterId)) findings.push({ severity: "error", check: "DA parameter missing", item, detail: `${where} takes ${target.parameterId}, which the imported DA workbook does not hold.`, target: findingTarget });
    return findings;
  }
  if (target.expression === undefined) findings.push({ severity: "error", check: "No split fraction", item, detail: `Enter the split fraction for ${where}.`, target: findingTarget });
  if (blank(target.basis)) findings.push({ severity: "warning", check: "No basis", item, detail: `Give the basis of the split fraction for ${where}.`, target: findingTarget });
  if (cc === "CC-II" && target.expression !== undefined && !hasUncertainty(target.expression)) findings.push({ severity: "warning", check: "No distribution", item, detail: `CC-II propagates a distribution. Give the split fraction for ${where} a law (ESQ-A8).`, target: findingTarget });
  return findings;
}

function missionPoint(expression: UncertainExpression, table: ReadonlyMap<string, UncertainParameter>): EsqMissionPoint {
  const query = { expression, unit: "HOURS" as const, probabilities: [], parameters: parametersFor([expression], table) };
  const state = peekExpression(query);
  if (state.status === "pending") {
    requestExpression(query);
    return { status: "pending" };
  }
  return state.status === "failed" ? state : { status: "ready", hours: state.value.point };
}

function hoursText(hours: number): string {
  return String(Number(hours.toPrecision(4)));
}

function missionFindings(model: EsqModel, functions: readonly EsqFunctionView[], values: readonly EsqValueView[], table: ReadonlyMap<string, UncertainParameter>): EsqModelFinding[] {
  const findings: EsqModelFinding[] = [];
  const runningByModel = new Map<string, EsqValueView[]>();
  for (const value of values) {
    if (value.kind !== "EVENT" || value.missionTime === undefined) continue;
    for (const top of model.tops) {
      if (!top.eventIds.includes(value.id)) continue;
      runningByModel.set(top.modelId, [...(runningByModel.get(top.modelId) ?? []), value]);
    }
  }
  const asked = new Set(functions.flatMap((view) => view.resolved.map(({ tree }) => tree.id)));
  const untimed = model.trees.filter((tree) => asked.has(tree.id) && effectiveMissionTime(tree) === undefined).map((tree) => tree.code);
  if (untimed.length > 0) findings.push({ severity: "note", check: "No tree mission time", item: listText(untimed), detail: `Import ${untimed.length === 1 ? "its" : "their"} mission time from ES or type it in the Initiators tab. The mission time check skips ${untimed.length === 1 ? "this tree" : "these trees"}.` });
  const unchecked = new Map<string, string>();
  for (const view of functions) {
    const id = view.record.id;
    const target = { kind: "esqFunction" as const, id };
    const shortTrees: { tree: string; events: string[]; hours: number; mission: number }[] = [];
    for (const { tree, link } of view.resolved) {
      const treeMission = effectiveMissionTime(tree);
      if (treeMission === undefined || link.target?.kind !== "FAULT_TREE") continue;
      const treePoint = missionPoint(treeMission, table);
      if (treePoint.status === "failed") unchecked.set(tree.code, treePoint.error);
      if (treePoint.status !== "ready") continue;
      const running = reachedModels(model, link.target.top.modelId).flatMap((modelId) => runningByModel.get(modelId) ?? []);
      const short: { code: string; hours: number }[] = [];
      for (const value of running) {
        if (value.missionTime === undefined) continue;
        const point = missionPoint(value.missionTime, table);
        if (point.status === "failed") unchecked.set(value.code, point.error);
        if (point.status === "ready" && point.hours < treePoint.hours) short.push({ code: value.code, hours: point.hours });
      }
      if (short.length > 0) shortTrees.push({ tree: tree.code, events: unique(short.map((entry) => entry.code)), hours: Math.min(...short.map((entry) => entry.hours)), mission: treePoint.hours });
    }
    if (shortTrees.length > 0) {
      const events = unique(shortTrees.flatMap((entry) => entry.events));
      const hours = Math.min(...shortTrees.map((entry) => entry.hours));
      const mission = Math.max(...shortTrees.map((entry) => entry.mission));
      findings.push({ severity: "warning", check: "Mission time", item: id, detail: `${plural(shortTrees.length, "tree")} that ask ${id} last up to ${hoursText(mission)} h (${listText(shortTrees.map((entry) => entry.tree))}), but ${listText(events)} ${events.length === 1 ? "is" : "are"} quantified for ${hoursText(hours)} h.`, target });
    }
  }
  for (const [item, error] of unchecked) findings.push({ severity: "warning", check: "Mission time not checked", item, detail: `PRAXIS gave no mission time for ${item}: ${error}` });
  return findings;
}

function functionFindings(esq: EventSequenceQuantification, model: EsqModel, functions: readonly EsqFunctionView[]): EsqModelFinding[] {
  const findings: EsqModelFinding[] = [];
  const cc = esq.capabilityCategory;
  for (const view of functions) {
    const id = view.record.id;
    const target = { kind: "esqFunction" as const, id };
    if (view.unlinked.length > 0) {
      findings.push({ severity: "error", check: "Not linked", item: id, detail: `${id} is not linked in ${plural(view.unlinked.length, "tree")} (${listText(view.unlinked.map((tree) => tree.code))}). Link it to a fault tree top or a network node, or give it a split fraction.`, target });
    }
    for (const linkTarget of view.targets) {
      if (linkTarget.kind === "FAULT_TREE") {
        if (topOf(model, linkTarget.top) === undefined) findings.push({ severity: "error", check: "Top missing", item: id, detail: `${id} links to a fault tree that is not in the imported SY workbook.`, target });
      } else if (linkTarget.kind === "NETWORK_NODE") {
        const found = targetNodeOf(esq, linkTarget);
        if (found === undefined) findings.push({ severity: "error", check: "Node missing", item: id, detail: `${id} links to a network node that is not in this workbook's dependency networks.`, target });
        else if (!failingStatesReady(found.node, linkTarget.trueStateIds)) findings.push({ severity: "error", check: "Failing states", item: id, detail: `${id} needs at least one failing state of ${found.node.code} and not all of them.`, target });
      } else {
        findings.push(...splitFindings(esq, model, linkTarget, id, id, cc, target));
      }
    }
    if (view.edited && view.link?.target !== undefined && blank(view.link.reason)) findings.push({ severity: "error", check: "Changed without a reason", item: id, detail: "The link differs from ES. Give the reason.", target });
    (view.link?.rules ?? []).forEach((rule, index) => {
      const ruleTrees = rule.treeIds ?? [];
      if (ruleTrees.length > 0) {
        const label = `${id} in ${listText(ruleTrees.map((treeId) => model.trees.find((tree) => tree.id === treeId)?.code ?? treeId))}`;
        const overridesEs = view.trees.some((tree) => tree.typed !== true && ruleMatches(rule, tree) && view.record.esLinks.some((link) => link.treeId === tree.id));
        if (overridesEs && blank(rule.reason)) findings.push({ severity: "error", check: "Changed without a reason", item: label, detail: "The link differs from ES. Give the reason.", target });
        if (!view.trees.some((tree) => ruleMatches(rule, tree))) findings.push({ severity: "note", check: "Link not used", item: label, detail: "The tree of this link is out of scope or gone. The link is kept but not used.", target });
        return;
      }
      const label = `${id} rule ${index + 1}`;
      if (blank(rule.reason)) findings.push({ severity: "error", check: "Rule without a reason", item: label, detail: "Give the reason this rule applies.", target });
      if (rule.groupIds.length === 0 && rule.stateIds.length === 0) findings.push({ severity: "warning", check: "Rule matches every tree", item: label, detail: "Pick initiator groups or operating states, or set the default link instead.", target });
      else if (!view.trees.some((tree) => ruleMatches(rule, tree))) findings.push({ severity: "warning", check: "Rule matches no tree", item: label, detail: "No tree in scope has these initiator groups and operating states.", target });
    });
  }
  const orphanLinks = (decisionsOf(esq).functionLinks ?? []).filter((link) => !model.functions.some((record) => record.id === link.functionId));
  for (const link of orphanLinks) findings.push({ severity: "note", check: "Link not used", item: link.functionId, detail: `ES no longer has ${link.functionId}. Its link is kept but not used.` });
  return findings;
}

function initiatorFindings(esq: EventSequenceQuantification, model: EsqModel, initiators: readonly EsqInitiatorView[], table: ReadonlyMap<string, UncertainParameter>): EsqModelFinding[] {
  const findings: EsqModelFinding[] = [];
  const weighting = stateWeightingOf(esq);
  const posImported = model.sources.some((source) => source.element === "POS");
  const cc = esq.capabilityCategory;
  for (const view of initiators) {
    const target = { kind: "esqInitiator" as const, id: view.id };
    const typedHere = view.source === "IE" && view.record?.typed === true;
    if (view.source === "IE" && view.record === undefined) {
      const ieImported = model.sources.some((source) => source.element === "IE");
      findings.push({ severity: "error", check: ieImported ? "Not in IE" : "Not defined", item: view.id, detail: `${ieImported ? `IE does not list ${view.id}.` : `${view.id} is not defined.`} Open a tree that starts with it and fill in its initiating event.`, target });
    } else if (view.source === "DA" && view.parameter === undefined) {
      findings.push({ severity: "error", check: "DA parameter missing", item: view.id, detail: view.choice?.parameterId === undefined ? "Pick the DA parameter." : `The imported DA workbook does not hold ${view.choice.parameterId}.`, target });
    } else if (view.source === "DA" && view.parameter?.estimate === undefined) {
      findings.push({ severity: "error", check: "No DA estimate", item: view.id, detail: `DA gives ${view.parameter?.name ?? view.choice?.parameterId ?? "the parameter"} no frequency estimate.`, target });
    } else if (view.source === "DA" && linkOf(esq, "DA") === undefined) {
      findings.push({ severity: "error", check: "DA workbook not linked", item: view.id, detail: "Link the DA workbook in Step 01 to take the frequency from it.", target });
    } else if (view.given === undefined) {
      findings.push({ severity: "error", check: "No frequency", item: view.id, detail: `${view.id} has no frequency. Open a tree that starts with it and give its initiating event a frequency.`, target });
    }
    if (view.given !== undefined) {
      for (const problem of referenceProblems(esq, model, view.given, view.id)) findings.push({ severity: "error", check: problem.check, item: view.id, detail: problem.detail, target });
    }
    if (view.source === "TYPED") {
      if (blank(view.choice?.basis)) findings.push({ severity: "warning", check: "No basis", item: view.id, detail: "Give the basis of the typed frequency.", target });
      if (cc === "CC-II" && view.given !== undefined && !hasUncertainty(inlinedExpression(view.given, table))) findings.push({ severity: "warning", check: "No distribution", item: view.id, detail: "CC-II propagates a distribution. Give the typed frequency a law (ESQ-A8).", target });
    }
    if (typedHere && view.record?.heldBy !== "DA" && cc === "CC-II" && view.given !== undefined && !hasUncertainty(inlinedExpression(view.given, table))) {
      findings.push({ severity: "warning", check: "No distribution", item: view.id, detail: "CC-II propagates a distribution. Give the typed frequency a law in its tree (ESQ-A8).", target });
    }
    if (view.unit === "per-critical-year" && view.given !== undefined && view.expression === undefined) findings.push({ severity: "error", check: "Frequency unit", item: view.id, detail: `${view.source === "IE" && !typedHere ? "IE gives this frequency" : "This frequency is"} per critical year. POS gives no hours for its operating states, so ESQ cannot turn it into per reactor-year.`, target });
    if (view.unit === "per-demand") findings.push({ severity: "error", check: "Frequency unit", item: view.id, detail: "IE gives this value per demand. An initiator needs a frequency.", target });
    const applicable = view.states.filter((state) => state.applicable);
    if (applicable.length < 2) {
      if (applicable.length === 0) findings.push({ severity: "warning", check: "No operating state", item: view.id, detail: typedHere ? `${view.id} has no operating state, so its whole frequency applies to its trees.` : `Neither IE nor ES places ${view.id} in an operating state, so its whole frequency applies to its trees.`, target });
    } else if (weighting === "POS_HOURS") {
      const missing = applicable.filter((state) => state.hours === undefined).map((state) => state.stateId);
      if (missing.length > 0) findings.push({ severity: "error", check: "No hours", item: view.id, detail: posImported ? `POS gives no hours for ${listText(missing)}.` : "Link POS in Step 01 and import, or type the share of each state.", target });
    } else {
      const missing = applicable.filter((state) => state.share === undefined).map((state) => state.stateId);
      if (missing.length > 0) findings.push({ severity: "error", check: "No share", item: view.id, detail: `Type the share for ${listText(missing)}.`, target });
      else {
        const total = applicable.reduce((sum, state) => sum + (state.share ?? 0), 0);
        if (Math.abs(total - 1) > 1e-6) findings.push({ severity: "error", check: "Shares do not add up", item: view.id, detail: `The shares add up to ${Number((total * 100).toPrecision(4))}%, not 100%.`, target });
      }
    }
    const stateName = new Map(model.states.map((state) => [state.id, state.name]));
    const unmodeled = applicable.filter((state) => model.trees.every((tree) => tree.transferEntry || !sameItem(tree.initiatorId, view.id) || tree.stateId !== state.stateId) && !excludedBy(esq, "OPERATING_STATE", [state.stateId, stateName.get(state.stateId) ?? ""]));
    for (const state of unmodeled) {
      const share = state.share === undefined ? "" : ` Its ${Number((state.share * 100).toPrecision(3))}% of the frequency is not modeled.`;
      findings.push({ severity: "warning", check: "State without a tree", item: view.id, detail: typedHere ? `${view.id} applies to ${state.stateId}, but no tree starts with it there.${share}` : `IE lists ${state.stateId} for ${view.id}, but ES has no tree for it.${share}`, target });
    }
    const stray = view.states.filter((state) => !state.applicable && state.treeIds.length > 0).map((state) => state.stateId);
    if (stray.length > 0 && view.record !== undefined) {
      const detail = typedHere
        ? `A tree for ${view.id} is in ${listText(stray)}, but its initiating event does not list ${stray.length === 1 ? "that state" : "those states"}. ${stray.length === 1 ? "It gets" : "They get"} no frequency.`
        : `ES has a tree for ${view.id} in ${listText(stray)}, but IE does not list ${stray.length === 1 ? "that state" : "those states"}. ${stray.length === 1 ? "It gets" : "They get"} no frequency.`;
      findings.push({ severity: "warning", check: typedHere ? "State not listed" : "State not in IE", item: view.id, detail, target });
    }
  }
  return findings;
}

function referenceProblems(esq: EventSequenceQuantification, model: EsqModel, expression: UncertainExpression, code: string, missionTimes?: ReadonlyMap<string, UncertainParameter>): EsqReferenceProblem[] {
  const workbookId = linkOf(esq, "DA");
  const problems: EsqReferenceProblem[] = [];
  const seen = new Set<string>();
  const pending = expressionReferences(expression);
  while (pending.length > 0) {
    const reference = pending.pop();
    if (reference === undefined) break;
    const key = parameterReferenceKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    const missionTime = missionTimes?.get(key);
    if (missionTime !== undefined) {
      pending.push(...expressionReferences(missionTime.expression));
      continue;
    }
    if (readsMissionTime(esq, reference)) {
      if (missionTimes !== undefined) problems.push({ check: "SC mission time missing", detail: `${code} reads mission time ${reference.entityId}, which the linked SC workbook does not hold.` });
      continue;
    }
    if (workbookId === undefined || reference.workbookId.trim() !== workbookId.trim()) continue;
    const factor = (model.ccfFactors ?? []).find((entry) => parameterReferenceKey(entry.reference) === key);
    if (factor !== undefined) {
      pending.push(...expressionReferences(factor.expression));
      continue;
    }
    const parameter = model.parameters.find((entry) => entry.id === reference.entityId.trim());
    if (parameter === undefined) {
      problems.push({ check: "DA parameter missing", detail: `${code} reads DA parameter ${reference.entityId}, which the linked DA workbook does not hold.` });
      continue;
    }
    const law = parameterLaw(parameter);
    if (law === undefined) {
      problems.push({ check: "No DA estimate", detail: `${code} reads ${parameter.name}, which has no value in DA.` });
      continue;
    }
    pending.push(...expressionReferences(law));
  }
  return problems;
}

function valueFindings(esq: EventSequenceQuantification, model: EsqModel, values: readonly EsqValueView[], table: ReadonlyMap<string, UncertainParameter>, missionTimes: ReadonlyMap<string, UncertainParameter> | undefined): EsqModelFinding[] {
  const findings: EsqModelFinding[] = [];
  const daImported = model.sources.some((source) => source.element === "DA");
  const hrImported = model.sources.some((source) => source.element === "HRA");
  const cc = esq.capabilityCategory;
  const daUnlinked = values.filter((value) => value.kind === "EVENT" && value.heldBy === "DA" && !daImported).length;
  const hrUnlinked = values.filter((value) => value.kind === "EVENT" && value.heldBy === "HRA" && !hrImported).length;
  if (daUnlinked > 0) findings.push({ severity: "warning", check: "DA not linked", item: "DA", detail: `${plural(daUnlinked, "event")} take their value from DA, but no DA workbook is imported. ESQ uses the values SY holds.` });
  if (hrUnlinked > 0) findings.push({ severity: "warning", check: "HR not linked", item: "HR", detail: `${plural(hrUnlinked, "event")} take their value from HR, but no HR workbook is imported. ESQ uses the values SY holds.` });
  for (const value of values) {
    if (value.kind !== "EVENT") continue;
    const target = { kind: "esqValue" as const, id: value.id };
    if (value.typedHere && blank(value.binding?.reason)) findings.push({ severity: "warning", check: "No basis", item: value.code, detail: "Give the basis of the typed value.", target });
    else if (value.binding !== undefined && !value.typedHere && blank(value.binding.reason)) findings.push({ severity: "error", check: "Changed without a reason", item: value.code, detail: "The value source differs from SY. Give the reason.", target });
    if (value.heldBy === "DA" && daImported && value.parameter === undefined) findings.push({ severity: "error", check: "DA parameter missing", item: value.code, detail: `${value.code} takes its value from ${value.holderId ?? "DA"}, which the imported DA workbook does not hold.`, target });
    if (value.heldBy === "HRA" && hrImported && value.human === undefined) findings.push({ severity: "error", check: "HR event missing", item: value.code, detail: `${value.code} takes its value from ${value.holderId ?? "HR"}, which the imported HR workbook does not hold.`, target });
    if (value.problem !== undefined) {
      findings.push({ severity: "error", check: "Value cannot be used", item: value.code, detail: value.problem, target });
      continue;
    }
    if (value.value === undefined && value.expression === undefined) {
      findings.push({ severity: "error", check: "No value", item: value.code, detail: `${value.code} has no value.`, target });
      continue;
    }
    const holderMissing = value.heldBy === "DA" && value.parameter === undefined;
    if (value.expression !== undefined && !holderMissing) {
      for (const problem of referenceProblems(esq, model, value.expression, value.code, missionTimes)) findings.push({ severity: "error", check: problem.check, item: value.code, detail: problem.detail, target });
    }
    if (value.heldBy === "TYPED" && !value.typedHere) findings.push({ severity: "warning", check: "Not bound", item: value.code, detail: "SY types this value. Take it from DA or HR, or type it here so DA stores it.", target });
    if (cc !== "CC-II") continue;
    if (value.human?.assessmentType === "CONSERVATIVE_ESTIMATE" && value.human.riskSignificant) findings.push({ severity: "warning", check: "Screening value", item: value.code, detail: `${value.human.id} is risk-significant but keeps a conservative estimate. CC-II needs a detailed assessment (ESQ-A8).`, target });
    if (value.expression !== undefined && !hasUncertainty(inlinedExpression(value.expression, table))) findings.push({ severity: "warning", check: "No distribution", item: value.code, detail: `${value.code} has no uncertainty to propagate at CC-II. ${value.typedHere ? "Give the typed value a law" : `Give it a law in ${value.heldBy === "DA" ? "DA" : value.heldBy === "HRA" ? "HR" : "SY"}`} (ESQ-A8).`, target });
  }
  return findings;
}

function ccfFindings(model: EsqModel, values: readonly EsqValueView[]): EsqModelFinding[] {
  const lengths = new Map((model.vectors ?? []).map((vector) => [parameterReferenceKey(vector.reference), vectorLength(vector.vector)]));
  return values.flatMap((value): EsqModelFinding[] => {
    const ccf = value.ccf;
    if (value.kind !== "CCF" || ccf === undefined) return [];
    const target = { kind: "esqValue" as const, id: value.id };
    if (ccf.factors === undefined) return [{ severity: "error", check: "No factors", item: value.code, detail: `${value.name} has no common cause factors. Complete it in SY.`, target }];
    return ccfFactorIssues(ccf.factors, new Set(ccf.memberIds).size, lengths).map((issue): EsqModelFinding => ({
      severity: issue.severity === "ERROR" ? "error" : "warning",
      check: "Common cause factors",
      item: value.code,
      detail: issue.message,
      target,
    }));
  });
}

function typedTreeFindings(esq: EventSequenceQuantification, model: EsqModel): EsqModelFinding[] {
  const typed = typedTreesOf(esq);
  const all: (EventTree | string)[] = [...typed, ...model.trees.filter((tree) => tree.typed !== true).map((tree) => tree.id)];
  return typed.flatMap((tree) => validateEventTree(tree, all)
    .filter((finding) => !finding.code.startsWith("ET_FREQUENCY") && finding.code !== "ET_FT_LINK_REQUIRED")
    .map((finding): EsqModelFinding => ({ severity: finding.severity === "ERROR" ? "error" : "warning", check: "Event tree", item: textOf(tree.label) ?? tree.name, detail: finding.message, target: { kind: "esqTree", id: tree.uuid } })));
}

function missionTimeTableOf(esq: EventSequenceQuantification, upstream: Pick<EsqUpstream, "sc" | "scReferenced">): Map<string, UncertainParameter> | undefined {
  return linkOf(esq, "SC") !== undefined && upstream.sc === undefined ? undefined : scTableOf(missionTimeSourcesOf(esq, upstream));
}

function modelViewOf(esq: EventSequenceQuantification, unavailable: readonly EsqModelElement[] = [], missionTimes?: ReadonlyMap<string, UncertainParameter>): EsqModelView | undefined {
  const model = esq.model;
  if (model === undefined) return undefined;
  const trees = treesInScope(esq, model);
  const sequences = sequenceViews(esq, model, trees);
  const families = familyViews(esq, model, sequences);
  const functions = functionViews(esq, model, trees);
  const initiators = initiatorViews(esq, model, trees);
  const table = parameterTableOf(esq);
  const values = valueViews(esq, model, functions, table);
  const treeIds = new Set(model.trees.map((tree) => tree.id));
  const outOfScope = model.sequences.filter((sequence) => treeIds.has(sequence.treeId)).length - sequences.length;
  const findings = [
    ...sourceFindings(model, unavailable),
    ...(model.trees.length > 0 && sequences.length === 0 ? [{ severity: "error" as const, check: "No sequence in scope", item: "Sequences", detail: "Step 01 leaves every event tree out of scope." }] : []),
    ...(outOfScope > 0 ? [{ severity: "note" as const, check: "Out of scope", item: "Sequences", detail: `Step 01 leaves ${plural(outOfScope, "sequence")} out of scope.` }] : []),
    ...typedTreeFindings(esq, model),
    ...sequenceFindings(model, sequences, families),
    ...familyFindings(families),
    ...functionFindings(esq, model, functions),
    ...(missionTimes === undefined ? [] : missionFindings(model, functions, values, new Map([...table, ...missionTimes]))),
    ...initiatorFindings(esq, model, initiators, table),
    ...valueFindings(esq, model, values, table, missionTimes),
    ...ccfFindings(model, values),
  ];
  return { model, trees, sequences, outOfScope, families, functions, initiators, values, findings: sortFindings(findings) };
}

function modelComplete(esq: EventSequenceQuantification): boolean {
  const view = modelViewOf(esq);
  return view !== undefined && view.sequences.length > 0 && !view.findings.some((finding) => finding.severity === "error");
}

function withDecisions(esq: EventSequenceQuantification, fn: (decisions: EsqModelDecisions) => EsqModelDecisions): EventSequenceQuantification {
  return { ...esq, modelDecisions: fn(esq.modelDecisions ?? {}) };
}

function withFunctionLink(esq: EventSequenceQuantification, functionId: string, next: EsqFunctionLink | undefined): EventSequenceQuantification {
  const kept = next !== undefined && (next.target !== undefined || (next.rules ?? []).length > 0 || !blank(next.reason)) ? [next] : [];
  return withDecisions(esq, (decisions) => ({
    ...decisions,
    functionLinks: [...(decisions.functionLinks ?? []).filter((link) => link.functionId !== functionId), ...kept],
  }));
}

function treeRuleOf(link: EsqFunctionLink | undefined, treeId: string): EsqFunctionRule | undefined {
  return (link?.rules ?? []).find((rule) => (rule.treeIds ?? []).length === 1 && rule.treeIds?.[0] === treeId);
}

function linkWith(link: EsqFunctionLink, target: EsqFunctionTarget | undefined, rules: EsqFunctionRule[]): EsqFunctionLink {
  const next: EsqFunctionLink = { functionId: link.functionId, rules };
  if (target !== undefined) next.target = target;
  if (link.reason !== undefined) next.reason = link.reason;
  return next;
}

function withDefaultLink(esq: EventSequenceQuantification, functionId: string, target: EsqFunctionTarget | undefined): EventSequenceQuantification {
  const link = functionLinkOf(esq, functionId) ?? { functionId };
  return withFunctionLink(esq, functionId, linkWith(link, target, link.rules ?? []));
}

function withDefaultLinkReason(esq: EventSequenceQuantification, functionId: string, reason: string): EventSequenceQuantification {
  const link = functionLinkOf(esq, functionId) ?? { functionId };
  return withFunctionLink(esq, functionId, { ...link, reason });
}

function withTreeLink(esq: EventSequenceQuantification, functionId: string, treeId: string, target: EsqFunctionTarget | undefined): EventSequenceQuantification {
  const link = functionLinkOf(esq, functionId) ?? { functionId };
  const known = treeRuleOf(link, treeId);
  const others = (link.rules ?? []).filter((rule) => rule !== known);
  const rules = target === undefined ? others : [{ id: known?.id ?? `tree:${treeId}`, treeIds: [treeId], groupIds: [], stateIds: [], target, reason: known?.reason ?? "" }, ...others];
  return withFunctionLink(esq, functionId, linkWith(link, link.target, rules));
}

function withRuleChanged(esq: EventSequenceQuantification, functionId: string, ruleId: string, next: EsqFunctionRule | undefined): EventSequenceQuantification {
  const link = functionLinkOf(esq, functionId);
  if (link === undefined) return esq;
  const rules = (link.rules ?? []).flatMap((rule) => (rule.id !== ruleId ? [rule] : next === undefined ? [] : [next]));
  return withFunctionLink(esq, functionId, linkWith(link, link.target, rules));
}

function withSplitTarget(esq: EventSequenceQuantification, functionId: string, ruleId: string | undefined, target: EsqSplitFractionTarget): EventSequenceQuantification {
  const link = functionLinkOf(esq, functionId);
  if (link === undefined) return esq;
  if (ruleId === undefined) return withFunctionLink(esq, functionId, linkWith(link, target, link.rules ?? []));
  const rule = (link.rules ?? []).find((candidate) => candidate.id === ruleId);
  return rule === undefined ? esq : withRuleChanged(esq, functionId, ruleId, { ...rule, target });
}

function ruleScopeText(model: EsqModel, rule: EsqFunctionRule): string {
  const treeIds = rule.treeIds ?? [];
  if (treeIds.length > 0) return listText(treeIds.map((treeId) => model.trees.find((tree) => tree.id === treeId)?.code ?? treeId));
  const scope = [rule.groupIds.join(", "), rule.stateIds.join(", ")].filter((part) => part.length > 0).join(" in ");
  return scope.length === 0 ? "Every tree" : scope;
}

function splitExpressionOf(esq: EventSequenceQuantification, target: EsqSplitFractionTarget): UncertainExpression | undefined {
  if (target.cellId !== undefined) {
    const cell = cellOf(esq, target.cellId);
    return cell === undefined ? undefined : cellExpressionOfRecord(cell);
  }
  if (target.parameterId !== undefined) {
    const reference = daReferenceOf(esq, target.parameterId);
    return reference === undefined ? undefined : { node: "PARAMETER", reference };
  }
  return target.expression;
}

function splitViewsOf(esq: EventSequenceQuantification, view: EsqModelView): EsqSplitView[] {
  return view.functions.flatMap((entry) => {
    const id = entry.record.id;
    const out: EsqSplitView[] = [];
    const add = (key: string, scope: string, target: EsqSplitFractionTarget, trees: EsqTreeRecord[], ruleId?: string): void => {
      const split: EsqSplitView = { key, functionId: id, functionName: entry.record.name, scope, target, trees };
      const expression = splitExpressionOf(esq, target);
      if (expression !== undefined) split.expression = expression;
      if (ruleId !== undefined) split.ruleId = ruleId;
      out.push(split);
    };
    const target = entry.link?.target;
    if (target?.kind === "SPLIT_FRACTION") add(`${id}|`, "Every tree", target, entry.resolved.filter((resolved) => resolved.link.origin === "ESQ").map((resolved) => resolved.tree));
    for (const rule of entry.link?.rules ?? []) {
      if (rule.target.kind !== "SPLIT_FRACTION") continue;
      add(`${id}|${rule.id}`, ruleScopeText(view.model, rule), rule.target, entry.resolved.filter((resolved) => resolved.link.ruleId === rule.id).map((resolved) => resolved.tree), rule.id);
    }
    return out;
  });
}

function reachedTreesOf(model: EsqModel, trees: readonly EsqTreeRecord[]): EsqTreeRecord[] {
  const ids: string[] = [];
  for (const tree of trees) {
    for (const id of transferTreeIds(model, tree.id)) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids.flatMap((id) => model.trees.filter((tree) => tree.id === id));
}

function nextTypedTreeCode(esq: EventSequenceQuantification): string {
  const taken = new Set([...(esq.model?.trees ?? []).map((tree) => tree.code.toLowerCase()), ...typedTreesOf(esq).map((tree) => (tree.label ?? "").toLowerCase())]);
  let n = 1;
  while (taken.has(`et-esq-${String(n).padStart(2, "0")}`)) n += 1;
  return `ET-ESQ-${String(n).padStart(2, "0")}`;
}

function withInitiatorChoice(esq: EventSequenceQuantification, groupId: string, next: EsqInitiatorChoice | undefined): EventSequenceQuantification {
  return withDecisions(esq, (decisions) => ({
    ...decisions,
    initiatorChoices: [...(decisions.initiatorChoices ?? []).filter((choice) => !sameItem(choice.groupId, groupId)), ...(next === undefined ? [] : [next])],
  }));
}

function withFamilyChoice(esq: EventSequenceQuantification, familyId: string, next: EsqFamilyChoice | undefined): EventSequenceQuantification {
  const kept = next !== undefined && (next.manual !== undefined || !blank(next.releaseCategoryId) || !blank(next.groupingReason)) ? [next] : [];
  return withDecisions(esq, (decisions) => ({
    ...decisions,
    familyChoices: [...(decisions.familyChoices ?? []).filter((choice) => choice.familyId !== familyId), ...kept],
  }));
}

function withSequenceChoice(esq: EventSequenceQuantification, sequenceId: string, next: EsqSequenceChoice | undefined): EventSequenceQuantification {
  return withDecisions(esq, (decisions) => ({
    ...decisions,
    sequenceChoices: [...(decisions.sequenceChoices ?? []).filter((choice) => choice.sequenceId !== sequenceId), ...(next === undefined ? [] : [next])],
  }));
}

function withValueBinding(esq: EventSequenceQuantification, eventId: string, next: EsqValueBinding | undefined): EventSequenceQuantification {
  return withDecisions(esq, (decisions) => ({
    ...decisions,
    valueBindings: [...(decisions.valueBindings ?? []).filter((binding) => binding.eventId !== eventId), ...(next === undefined ? [] : [next])],
  }));
}

function nextFamilyId(esq: EventSequenceQuantification): string {
  const taken = new Set([...(esq.model?.families ?? []).map((family) => family.id.toLowerCase()), ...(decisionsOf(esq).familyChoices ?? []).map((choice) => choice.familyId.toLowerCase())]);
  let n = 1;
  while (taken.has(`esf-esq-${String(n).padStart(2, "0")}`)) n += 1;
  return `ESF-ESQ-${String(n).padStart(2, "0")}`;
}

function withHandFamily(esq: EventSequenceQuantification, id: string): EventSequenceQuantification {
  return withDecisions(esq, (decisions) => ({
    ...decisions,
    familyChoices: [...(decisions.familyChoices ?? []), { familyId: id, name: "", manual: { source: "" } }],
  }));
}

function withFamilyRenamed(esq: EventSequenceQuantification, from: string, to: string): EventSequenceQuantification {
  return withDecisions(esq, (decisions) => ({
    ...decisions,
    familyChoices: (decisions.familyChoices ?? []).map((choice) => (choice.familyId === from ? { ...choice, familyId: to } : choice)),
    sequenceChoices: (decisions.sequenceChoices ?? []).map((choice) => (choice.familyId === from ? { ...choice, familyId: to } : choice)),
  }));
}

function withFamilyRemoved(esq: EventSequenceQuantification, id: string): EventSequenceQuantification {
  return withDecisions(esq, (decisions) => ({
    ...decisions,
    familyChoices: (decisions.familyChoices ?? []).filter((choice) => choice.familyId !== id),
    sequenceChoices: (decisions.sequenceChoices ?? []).filter((choice) => choice.familyId !== id),
  }));
}

function familyIdTaken(esq: EventSequenceQuantification, id: string, except: string): boolean {
  const ids = [...(esq.model?.families ?? []).map((family) => family.id), ...(decisionsOf(esq).familyChoices ?? []).map((choice) => choice.familyId)];
  return ids.some((candidate) => candidate !== except && sameItem(candidate, id));
}

export {
  RELEASE_END_STATE,
  sameItem,
  transferEntryInitiators,
  modelLinked,
  withModelImported,
  modelUnavailable,
  esqModelSourcesOf,
  modelNameOf,
  modelViewOf,
  modelComplete,
  resolveLink,
  topOf,
  targetKey,
  targetNodeOf,
  failingStatesReady,
  ruleMatches,
  stateWeightingOf,
  functionLinkOf,
  initiatorChoiceOf,
  familyChoiceOf,
  sequenceChoiceOf,
  valueBindingOf,
  withFunctionLink,
  withInitiatorChoice,
  withFamilyChoice,
  withSequenceChoice,
  withValueBinding,
  nextFamilyId,
  withHandFamily,
  withFamilyRenamed,
  withFamilyRemoved,
  familyIdTaken,
  liveEsqOf,
  missionTimeSourcesOf,
  missionTimeTableOf,
  ccfFactorOptionsOf,
  daParameterOptionsOf,
  ccfVectorOptionsOf,
  parameterLabelOf,
  parameterTableOf,
  referenceProblems,
  withTreeMissionTime,
  typedTreesOf,
  withTypedTrees,
  withTypedTreeRemoved,
  ieGroupRecord,
  topRecords,
  typedInitiatorsOf,
  withMergedInitiators,
  withTypedInitiatorRecord,
  withTypedInitiator,
  newTypedInitiator,
  nextTypedInitiatorCode,
  initiatorCodeTaken,
  initiatorCodeLock,
  withInitiatorCode,
  initiatorRecordOf,
  linkOf,
  effectiveMissionTime,
  treeRuleOf,
  withDefaultLink,
  withDefaultLinkReason,
  withTreeLink,
  withRuleChanged,
  withSplitTarget,
  ruleScopeText,
  splitViewsOf,
  reachedTreesOf,
  nextTypedTreeCode,
  type EsqSplitView,
  type EsqModelWindowKind,
  type EsqReferenceProblem,
  type EsqFindingSeverity,
  type EsqModelFinding,
  type EsqResolvedLink,
  type EsqSequenceView,
  type EsqFamilyView,
  type EsqFunctionView,
  type EsqInitiatorCodeLock,
  type EsqInitiatorView,
  type EsqInitiatorStateView,
  type EsqValueView,
  type EsqModelView,
};
