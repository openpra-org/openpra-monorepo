import {
  type EsqActionRecord,
  type EsqBarrierRecord,
  type EsqBranchState,
  type EsqCcfRecord,
  type EsqCriterionLoad,
  type EsqCriterionRecord,
  type EsqDependencyRecord,
  type EsqImpactRecord,
  type EsqJointFloorRecord,
  type EsqRecoveryRecord,
  type EsqQualificationRecord,
  type EsqEventRecord,
  type EsqFamilyChoice,
  type EsqFamilyRecord,
  type EsqFunctionLink,
  type EsqFunctionRecord,
  type EsqFunctionTarget,
  type EsqHumanRecord,
  type EsqInitiatorChoice,
  type EsqInitiatorRecord,
  type EsqLinkCode,
  type EsqModel,
  type EsqModelChange,
  type EsqModelDecisions,
  type EsqModelElement,
  type EsqModelSource,
  type EsqModelTable,
  type EsqParameterRecord,
  type EsqSequenceChoice,
  type EsqSequenceRecord,
  type EsqStateRecord,
  type EsqTopRecord,
  type EsqTopReference,
  type EsqTreeRecord,
  type EsqValueBinding,
  type EsqValueHolder,
  type EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { type EventSequenceAnalysis, type EventTree, type FunctionalEvent } from "interfaces-mef-types/es/event-sequence-analysis";
import { carriesUncertainExpression, type CommonCauseFailureGroup, type SystemBasicEvent, type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { systemFaultTreeBasicEventIds } from "interfaces-mef-types/sy/system-models";
import { holdsEstimate, isComponentModel, type DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { DistributionType } from "interfaces-mef-types/core/events";
import {
  canonicalJson,
  expressionReferences,
  mapModelArguments,
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
} from "interfaces-mef-types/core/uncertainty";
import { type WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { cellExpressionOfRecord, cellOf } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { hasUncertainty, parameterUnit } from "interfaces-mef-types/esq/esq-measure-inputs";
import { sequenceFamilyOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import { type QuantificationTimeUnit } from "interfaces-mef-types/modeling";
import { type Workbook } from "interfaces-shared-types";
import {
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
  treesInScope,
  type EsqGroupFrequency,
  type EsqGroupState,
  type EsqResolvedLink,
} from "interfaces-mef-types/esq/esq-run-inputs";
import { scMissionTimeEntries, scMissionTimeTable } from "../sc-workbooks/scMissionTimeLinks";
import { type ScMissionTimeSource } from "../sy-workbooks/syLinks";
import { parametersFor, peekExpression, requestExpression } from "../newly-developed-methods/shared/useUncertainty";
import { legacyExpression } from "interfaces-mef-types/core/legacy-uncertainty-adapter";
import { type EsqUpstream } from "./esqLinks";
import { ESQ_MODEL_ELEMENTS, MODEL_ELEMENT_LABELS, exampleLinkLabel } from "./esqViewData";

const HOURS_PER_UNIT: Record<QuantificationTimeUnit, number> = {
  SECOND: 1 / 3600,
  MINUTE: 1 / 60,
  HOUR: 1,
  DAY: 24,
  YEAR: 8760,
};

const RELEASE_END_STATE = "RADIONUCLIDE_RELEASE";

const EXAMPLE_SC_PREFIX = "example-sc-";

const RUNNING_MODES = new Set(["FAILURE_TO_RUN"]);

type EsqModelWindowKind = "esqSequence" | "esqTree" | "esqFamily" | "esqFunction" | "esqInitiator" | "esqValue";

type EsqFindingSeverity = "error" | "warning" | "note";

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
  component: boolean;
  expression?: UncertainExpression;
  problem?: string;
  value?: number;
  valueType?: "MEAN" | "POINT_ESTIMATE";
  parameter?: EsqParameterRecord;
  human?: EsqHumanRecord;
  missionTime?: UncertainExpression;
  functionIds: string[];
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

function blank(text: string | null | undefined): boolean {
  return typeof text !== "string" || text.trim().length === 0;
}

function textOf(text: string | null | undefined): string | undefined {
  return typeof text === "string" && text.trim().length > 0 ? text.trim() : undefined;
}

function finite(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function texts(items: readonly (string | null | undefined)[] | null | undefined): string[] {
  return (items ?? []).flatMap((item) => {
    const text = textOf(item);
    return text === undefined ? [] : [text];
  });
}

function unique(items: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const item of texts(items)) {
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function listText(items: readonly string[], shown = 3): string {
  if (items.length <= shown) return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `${items.slice(0, shown).join(", ")} and ${items.length - shown} more`;
}

function transferEntryInitiators(es: EventSequenceAnalysis): string[] {
  const trees = es.eventTrees ?? [];
  const targets = new Set(trees.flatMap((tree) => texts(Object.values(tree.transfers ?? {}).map((transfer) => transfer?.targetEventTreeId))));
  const started = texts(trees.filter((tree) => !targets.has(tree.uuid)).map((tree) => tree.initiatingEventId));
  const scope = texts(es.scopeDefinition?.initiatingEventIds);
  return texts(trees.filter((tree) => targets.has(tree.uuid)).map((tree) => tree.initiatingEventId))
    .filter((id) => !started.some((other) => sameItem(other, id)) && !scope.some((other) => sameItem(other, id)));
}

function functionKeyOf(event: FunctionalEvent, fallback: string): string {
  return textOf(event.label) ?? textOf(event.name) ?? fallback;
}

function orderedFunctions(tree: EventTree): { key: string; id: string; event: FunctionalEvent }[] {
  const out: { key: string; id: string; event: FunctionalEvent }[] = [];
  const entries = Object.entries(tree.functionalEvents).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
  for (const [id, event] of entries) {
    const key = functionKeyOf(event, id);
    if (!out.some((entry) => entry.key === key)) out.push({ key, id, event });
  }
  return out;
}

function treeRecords(es: EventSequenceAnalysis): EsqTreeRecord[] {
  const trees = es.eventTrees ?? [];
  const targets = new Set(trees.flatMap((tree) => texts(Object.values(tree.transfers ?? {}).map((transfer) => transfer?.targetEventTreeId))));
  const entries = transferEntryInitiators(es);
  return trees.map((tree) => {
    const initiatorId = textOf(tree.initiatingEventId) ?? "";
    const record: EsqTreeRecord = {
      id: tree.uuid,
      code: textOf(tree.label) ?? tree.uuid,
      name: textOf(tree.name) ?? tree.uuid,
      initiatorId,
      functionIds: orderedFunctions(tree).map((entry) => entry.key),
      transferEntry: targets.has(tree.uuid) && entries.some((id) => sameItem(id, initiatorId)),
    };
    const stateId = textOf(tree.plantOperatingStateId);
    if (stateId !== undefined) record.stateId = stateId;
    return record;
  });
}

function translatedPath(states: Record<string, string | null> | null | undefined, keyOf: ReadonlyMap<string, string>): Record<string, EsqBranchState> {
  const path: Record<string, EsqBranchState> = {};
  for (const [id, state] of Object.entries(states ?? {})) {
    if (state !== "SUCCESS" && state !== "FAILURE" && state !== "BYPASSED") continue;
    path[keyOf.get(id) ?? id] = state;
  }
  return path;
}

function sequenceRecords(es: EventSequenceAnalysis): EsqSequenceRecord[] {
  const byId = new Map(es.eventSequences.map((sequence) => [sequence.uuid, sequence]));
  const memberFamily = new Map<string, string>();
  for (const family of es.eventSequenceFamilies) {
    for (const id of texts(family.memberSequenceIds)) {
      if (!memberFamily.has(id)) memberFamily.set(id, family.uuid);
    }
  }
  const out: EsqSequenceRecord[] = [];
  const used = new Set<string>();
  for (const tree of es.eventTrees ?? []) {
    const keyOf = new Map(Object.entries(tree.functionalEvents).map(([id, event]) => [id, functionKeyOf(event, id)]));
    for (const [treeSequenceId, sequence] of Object.entries(tree.sequences)) {
      const id = textOf(sequence.eventSequenceId) ?? treeSequenceId;
      const source = byId.get(id) ?? byId.get(sequence.uuid);
      if (source !== undefined) used.add(source.uuid);
      used.add(id);
      const transfer = tree.transfers?.[treeSequenceId] ?? tree.transfers?.[sequence.uuid] ?? undefined;
      const record: EsqSequenceRecord = {
        id,
        code: textOf(sequence.label) ?? textOf(sequence.name) ?? treeSequenceId,
        treeId: tree.uuid,
        path: { ...translatedPath(source?.functionalEventStates, keyOf), ...translatedPath(sequence.functionalEventStates, keyOf) },
      };
      const endState = textOf(sequence.endState) ?? (transfer === undefined ? textOf(source?.endState) : undefined);
      if (endState !== undefined) record.endState = endState;
      const familyId = textOf(source?.sequenceFamilyId) ?? memberFamily.get(id);
      if (familyId !== undefined) record.familyId = familyId;
      const releaseCategoryId = textOf(source?.releaseCategoryId);
      if (releaseCategoryId !== undefined) record.releaseCategoryId = releaseCategoryId;
      const sources = texts(source?.affectedReactorSourceCombinations);
      if (sources.length > 0) record.sourceIds = sources;
      const target = textOf(transfer?.targetEventTreeId);
      if (target !== undefined) {
        record.transferTreeId = target;
        record.transferCarries = texts(transfer?.preservedDependencies);
      }
      out.push(record);
    }
  }
  for (const sequence of es.eventSequences) {
    if (used.has(sequence.uuid)) continue;
    const record: EsqSequenceRecord = {
      id: sequence.uuid,
      code: sequence.uuid,
      treeId: textOf(sequence.eventTreeId) ?? "",
      path: translatedPath(sequence.functionalEventStates, new Map()),
    };
    const endState = textOf(sequence.endState);
    if (endState !== undefined) record.endState = endState;
    const familyId = textOf(sequence.sequenceFamilyId) ?? memberFamily.get(sequence.uuid);
    if (familyId !== undefined) record.familyId = familyId;
    const releaseCategoryId = textOf(sequence.releaseCategoryId);
    if (releaseCategoryId !== undefined) record.releaseCategoryId = releaseCategoryId;
    out.push(record);
  }
  return out;
}

function familyRecords(es: EventSequenceAnalysis, sequences: readonly EsqSequenceRecord[]): EsqFamilyRecord[] {
  const records: EsqFamilyRecord[] = es.eventSequenceFamilies.map((family) => {
    const record: EsqFamilyRecord = { id: family.uuid, name: textOf(family.name) ?? "", releaseCategoryIds: texts(family.releaseCategoryIds) };
    const endState = textOf(family.endState);
    if (endState !== undefined) record.endState = endState;
    return record;
  });
  for (const sequence of sequences) {
    const familyId = sequence.familyId;
    if (familyId !== undefined && !records.some((record) => record.id === familyId)) records.push({ id: familyId, name: "", releaseCategoryIds: [] });
  }
  return records;
}

function functionRecords(es: EventSequenceAnalysis): EsqFunctionRecord[] {
  const out = new Map<string, EsqFunctionRecord>();
  for (const tree of es.eventTrees ?? []) {
    for (const { key, event } of orderedFunctions(tree)) {
      const record = out.get(key) ?? { id: key, name: textOf(event.name) ?? key, treeIds: [], esLinks: [] };
      if (!record.treeIds.includes(tree.uuid)) record.treeIds.push(tree.uuid);
      const top = event.faultTreeTopEvent;
      const modelId = textOf(top?.modelId);
      const gateId = textOf(top?.entityId);
      if (modelId !== undefined && gateId !== undefined && !record.esLinks.some((link) => link.treeId === tree.uuid)) {
        record.esLinks.push({ treeId: tree.uuid, top: { workbookId: textOf(top?.workbookId) ?? "", modelId, gateId } });
      }
      out.set(key, record);
    }
  }
  return [...out.values()];
}

function topRecords(sy: SystemsAnalysis): EsqTopRecord[] {
  const definitions = new Map(sy.systemDefinitions.map((definition) => [definition.uuid, definition]));
  return sy.systemLogicModels.flatMap((model) => {
    const gateId = textOf(model.topGate?.gateId);
    if (gateId === undefined) return [];
    const record: EsqTopRecord = {
      modelId: model.uuid,
      gateId,
      code: textOf(model.code) ?? model.uuid,
      name: textOf(model.name) ?? "",
      eventIds: systemFaultTreeBasicEventIds(model),
      transferModelIds: unique(model.leafNodes.flatMap((leaf) => (leaf.kind === "TRANSFER_REFERENCE" ? [leaf.target?.modelId] : []))),
      gates: model.gates.map((gate) => ({ id: gate.id, code: textOf(gate.code) ?? gate.id, name: textOf(gate.name) ?? "" })),
      houseEvents: model.leafNodes.flatMap((leaf) => (leaf.kind === "HOUSE_EVENT" ? [{ id: leaf.id, code: textOf(leaf.code) ?? leaf.id, name: textOf(leaf.name) ?? "", state: leaf.state === true }] : [])),
    };
    const systemId = textOf(model.systemReference);
    if (systemId !== undefined) record.systemId = systemId;
    const definition = systemId === undefined ? undefined : definitions.get(systemId);
    if (definition !== undefined) record.systemName = textOf(definition.abbreviation) ?? textOf(definition.name) ?? systemId;
    return [record];
  });
}

function initiatorRecords(ie: InitiatingEventsAnalysis): EsqInitiatorRecord[] {
  return ie.initiatingEventGroups.map((group) => {
    const record: EsqInitiatorRecord = { id: group.uuid, name: textOf(group.name) ?? group.uuid, stateIds: texts(group.applicableStates) };
    const frequency = group.frequency ?? undefined;
    if (frequency !== undefined) record.frequency = structuredClone(frequency);
    const holderId = textOf(group.controlledDataSource?.entityId);
    record.heldBy = holderId === undefined ? "TYPED" : "DA";
    if (holderId !== undefined) record.holderId = holderId;
    return record;
  });
}

function stateRecords(pos: PlantOperatingStatesAnalysis): EsqStateRecord[] {
  return pos.plantOperatingStates.map((state) => {
    const record: EsqStateRecord = { id: state.uuid, name: textOf(state.name) ?? state.uuid };
    const hours = finite(state.meanDurationHours);
    if (hours !== undefined && hours >= 0) record.hours = hours;
    return record;
  });
}

function eventHolder(event: SystemBasicEvent, parameterIds: ReadonlySet<string>, hfeIds: ReadonlySet<string>): Pick<EsqEventRecord, "heldBy" | "holderId"> {
  const source = event.controlledDataSource ?? undefined;
  const sourceId = textOf(source?.entityId);
  if (source?.referenceType === "WORKBOOK_PARAMETER" && sourceId !== undefined) return { heldBy: "DA", holderId: sourceId };
  if (source?.referenceType === "HUMAN_FAILURE_EVENT" && sourceId !== undefined) return { heldBy: "HRA", holderId: sourceId };
  const legacy = textOf(event.dataAnalysisBasicEventRef);
  if (legacy !== undefined && parameterIds.has(legacy)) return { heldBy: "DA", holderId: legacy };
  if (legacy !== undefined && hfeIds.has(legacy)) return { heldBy: "HRA", holderId: legacy };
  const hfe = textOf(event.attributes?.find((attribute) => attribute.name === "hfeReference")?.value);
  if (hfe !== undefined && hfeIds.has(hfe)) return { heldBy: "HRA", holderId: hfe };
  return { heldBy: "TYPED" };
}

function componentHolder(expression: UncertainExpression | undefined, parameterIds: ReadonlySet<string>): Pick<EsqEventRecord, "heldBy" | "holderId"> {
  const ids = unique((expression === undefined ? [] : expressionReferences(expression)).map((reference) => reference.entityId)).filter((id) => parameterIds.has(id));
  const [only, ...others] = ids;
  return only !== undefined && others.length === 0 ? { heldBy: "DA", holderId: only } : { heldBy: "TYPED" };
}

function eventRecords(sy: SystemsAnalysis, parameterIds: ReadonlySet<string>, hfeIds: ReadonlySet<string>): EsqEventRecord[] {
  const systemOf = new Map<string, string>();
  for (const model of sy.systemLogicModels) {
    const systemId = textOf(model.systemReference);
    if (systemId === undefined) continue;
    for (const id of systemFaultTreeBasicEventIds(model)) {
      if (!systemOf.has(id)) systemOf.set(id, systemId);
    }
  }
  const definitions = new Map(sy.systemDefinitions.map((definition) => [definition.uuid, definition]));
  return sy.systemBasicEvents.map((event) => {
    const mode = typeof event.failureMode === "string" ? textOf(event.failureMode) : undefined;
    const component = carriesUncertainExpression(mode);
    const expression = component ? event.expression ?? undefined : undefined;
    const holder = component ? componentHolder(expression, parameterIds) : eventHolder(event, parameterIds, hfeIds);
    const record: EsqEventRecord = { id: event.uuid, code: textOf(event.code) ?? event.uuid, name: textOf(event.name) ?? "", ...holder };
    const systemId = systemOf.get(event.uuid);
    const definition = systemId === undefined ? undefined : definitions.get(systemId);
    if (systemId !== undefined) record.systemId = systemId;
    if (definition !== undefined) record.systemName = textOf(definition.abbreviation) ?? textOf(definition.name) ?? systemId;
    if (mode !== undefined) record.failureMode = mode;
    if (component) {
      if (expression !== undefined) record.expression = structuredClone(expression);
      return record;
    }
    const basis = event.quantificationBasis ?? undefined;
    if (basis?.kind === "FAILURE_RATE") {
      const rate = finite(basis.failureRate?.value);
      const rateUnit = HOURS_PER_UNIT[basis.failureRate?.unit];
      const mission = finite(basis.missionTime?.value);
      const missionUnit = HOURS_PER_UNIT[basis.missionTime?.unit];
      if (rate !== undefined && rateUnit !== undefined) {
        record.value = rate / rateUnit;
        record.valueUnit = "PER_HOUR";
      }
      if (mission !== undefined && missionUnit !== undefined) record.missionTime = legacyExpression("HOURS", mission * missionUnit);
    } else {
      const probability = finite(event.probability);
      if (probability !== undefined) {
        record.value = probability;
        record.valueUnit = "PROBABILITY";
      }
      const mission = definition?.missionTime ?? undefined;
      if (mission !== undefined) record.missionTime = structuredClone(mission);
    }
    return record;
  });
}

function ccfRecords(sy: SystemsAnalysis): EsqCcfRecord[] {
  return sy.commonCauseFailureGroups.map((group: CommonCauseFailureGroup) => {
    const record: EsqCcfRecord = {
      id: group.uuid,
      name: textOf(group.name) ?? group.uuid,
      systemIds: texts(group.affectedSystems),
      memberIds: texts((group.members?.basicEvents ?? []).map((member) => member?.id)),
    };
    const factors = group.factors ?? undefined;
    if (factors !== undefined) record.factors = structuredClone(factors);
    const total = group.total ?? undefined;
    if (total !== undefined) record.total = structuredClone(total);
    const reference = textOf(group.dataAnalysisCCFParameterRef);
    if (reference !== undefined) record.estimateRef = reference;
    return record;
  });
}

function parameterRecords(da: DataAnalysis): EsqParameterRecord[] {
  return da.parameters.map((parameter) => {
    const record: EsqParameterRecord = {
      id: parameter.uuid,
      name: textOf(parameter.name) ?? parameter.uuid,
      parameterType: textOf(parameter.parameterType) ?? "OTHER",
    };
    const model = parameter.quantificationModel ?? undefined;
    if (model !== undefined) record.quantificationModel = model;
    const evidence = textOf(parameter.evidenceKind);
    if (evidence !== undefined) record.evidenceKind = evidence;
    if (holdsEstimate(model)) {
      const estimate = parameter.estimate ?? undefined;
      if (estimate !== undefined) record.estimate = structuredClone(estimate);
      return record;
    }
    record.valueType = parameter.valueType === "MEAN" ? "MEAN" : "POINT_ESTIMATE";
    const value = finite(parameter.value);
    if (value !== undefined) record.value = value;
    const mission = parameter.missionTime ?? undefined;
    if (mission !== undefined) record.missionTime = structuredClone(mission);
    const distribution = parameter.uncertainty?.distribution ?? undefined;
    if (distribution !== undefined) record.distribution = structuredClone(distribution);
    return record;
  });
}

function humanRecords(hr: HumanReliabilityAnalysis): EsqHumanRecord[] {
  const recoveryQuantifications = new Set(texts((hr.recoveryActions ?? []).map((recovery) => recovery?.hepQuantificationId)));
  return hr.humanFailureEvents.map((event) => {
    const quantification = hr.hepQuantifications.find((candidate) => candidate.hfeId === event.uuid && !recoveryQuantifications.has(candidate.uuid));
    const record: EsqHumanRecord = {
      id: event.uuid,
      name: textOf(event.name) ?? event.uuid,
      riskSignificant: quantification?.isRiskSignificant === true,
      distributionGiven: quantification?.uncertaintyCharacterization?.probabilisticRepresentationProvided === true,
    };
    if (event.hfeTiming === "PRE_INITIATOR" || event.hfeTiming === "AT_INITIATOR" || event.hfeTiming === "POST_INITIATOR") record.timing = event.hfeTiming;
    if (quantification === undefined) return record;
    const mean = finite(quantification.meanHep);
    const point = finite(quantification.pointEstimateHep);
    if (mean !== undefined) {
      record.value = mean;
      record.valueType = "MEAN";
    } else if (point !== undefined) {
      record.value = point;
      record.valueType = "POINT_ESTIMATE";
    }
    if (quantification.assessmentType === "CONSERVATIVE_ESTIMATE" || quantification.assessmentType === "DETAILED_ASSESSMENT") record.assessmentType = quantification.assessmentType;
    return record;
  });
}

function addText(list: string[], text: string | undefined): void {
  if (text !== undefined && !list.includes(text)) list.push(text);
}

function barrierRecords(pos: PlantOperatingStatesAnalysis): EsqBarrierRecord[] {
  const out = new Map<string, EsqBarrierRecord>();
  const recordFor = (name: string): EsqBarrierRecord => {
    const record = out.get(name) ?? { id: name, name, sourceNames: [], states: [], breachCriteria: [], monitoring: [] };
    out.set(name, record);
    return record;
  };
  for (const state of pos.plantOperatingStates) {
    for (const barrier of state.radionuclideTransportBarriers ?? []) {
      const name = textOf(barrier.name);
      if (name === undefined) continue;
      const record = recordFor(name);
      if (!record.states.some((entry) => entry.stateId === state.uuid)) record.states.push({ stateId: state.uuid, status: textOf(barrier.status) ?? "INTACT" });
      for (const criterion of texts(barrier.breachCriteria)) addText(record.breachCriteria, criterion);
      for (const parameter of texts(barrier.monitoringParameters)) addText(record.monitoring, parameter);
    }
    for (const source of state.radioactiveMaterialSources ?? []) {
      const sourceName = textOf(source.name);
      for (const name of texts(source.barriers)) addText(recordFor(name).sourceNames, sourceName);
    }
  }
  return [...out.values()];
}

function criterionRecords(sc: SuccessCriteriaDevelopment): EsqCriterionRecord[] {
  return (sc.radionuclideBarrierCriteria ?? []).map((criterion) => {
    const record: EsqCriterionRecord = {
      id: criterion.uuid,
      barrierRef: textOf(criterion.barrierId) ?? criterion.uuid,
      parameters: (criterion.protectionParameters ?? []).map((entry) => ({ parameter: textOf(entry?.parameter) ?? "", criterion: textOf(entry?.criterion) ?? "", basis: textOf(entry?.basis) ?? "" })),
      loads: (criterion.challengeLoads ?? []).map((entry) => {
        const load: EsqCriterionLoad = { description: textOf(entry?.loadDescription) ?? "", attributes: texts(entry?.physicalAttributes) };
        const sequenceId = textOf(entry?.eventSequenceReference);
        if (sequenceId !== undefined) load.sequenceId = sequenceId;
        return load;
      }),
      capacityParameters: texts(criterion.capacityParameters),
      method: criterion.effectivenessEvaluationMethod === "REALISTIC" ? "REALISTIC" : "CONSERVATIVE",
      references: texts(criterion.engineeringAnalysisReferences),
    };
    const uncertainty = textOf(criterion.uncertaintyAssessment);
    if (uncertainty !== undefined) record.uncertainty = uncertainty;
    return record;
  });
}

function impactRecords(ie: InitiatingEventsAnalysis): EsqImpactRecord[] {
  const groupOf = new Map<string, string>();
  for (const group of ie.initiatingEventGroups) {
    for (const id of texts(group.memberInitiatorIds)) groupOf.set(id, group.uuid);
  }
  return (ie.initiators ?? []).flatMap((initiator) => (initiator.barrierImpacts ?? []).flatMap((impact): EsqImpactRecord[] => {
    const barrierRef = textOf(impact?.barrierId);
    if (barrierRef === undefined) return [];
    const record: EsqImpactRecord = { initiatorId: initiator.uuid, initiatorName: textOf(initiator.name) ?? initiator.uuid, barrierRef, state: textOf(impact?.state) ?? "INTACT" };
    const groupId = textOf(initiator.groupId) ?? groupOf.get(initiator.uuid);
    if (groupId !== undefined) record.groupId = groupId;
    const timing = textOf(impact?.timing);
    if (timing !== undefined) record.timing = timing;
    const mechanism = textOf(impact?.mechanism);
    if (mechanism !== undefined) record.mechanism = mechanism;
    return [record];
  }));
}

function qualificationRecords(sy: SystemsAnalysis): EsqQualificationRecord[] {
  const environment = (sy.environmentalDesignBasisConsiderations ?? []).map((entry): EsqQualificationRecord => ({
    id: entry.uuid,
    kind: "ENVIRONMENT",
    systemId: textOf(entry.systemReference) ?? "",
    components: texts(entry.components),
    condition: textOf(entry.environmentalConditions) ?? "",
    groupIds: texts(entry.initiatingEventIds),
    eventIds: texts(entry.basicEventIds),
    beyondQualification: entry.beyondQualification === true,
  }));
  const capacity = (sy.overCapacityConsiderations ?? []).map((entry): EsqQualificationRecord => {
    const record: EsqQualificationRecord = {
      id: entry.uuid,
      kind: "CAPACITY",
      systemId: textOf(entry.system) ?? "",
      components: [],
      condition: texts(entry.potentialExceedanceScenarios).join(" "),
      groupIds: [],
      eventIds: [],
      beyondQualification: false,
      treatment: entry.treatment === "REALISTIC_JUSTIFIED" ? "REALISTIC_JUSTIFIED" : "CONSERVATIVE",
    };
    const justification = textOf(entry.justificationForCapability);
    if (justification !== undefined) record.justification = justification;
    return record;
  });
  return [...environment, ...capacity];
}

function recoveryRecords(hr: HumanReliabilityAnalysis): EsqRecoveryRecord[] {
  return (hr.recoveryActions ?? []).flatMap((recovery): EsqRecoveryRecord[] => {
    const id = textOf(recovery?.uuid);
    const hfeId = textOf(recovery?.hfeId);
    if (id === undefined || hfeId === undefined) return [];
    const quantification = hr.hepQuantifications.find((candidate) => candidate.uuid === recovery.hepQuantificationId);
    const feasibility = recovery.feasibility;
    const record: EsqRecoveryRecord = {
      id,
      name: textOf(recovery.name) ?? id,
      hfeId,
      level: recovery.appliedAtLevel === "CUTSET" || recovery.appliedAtLevel === "SCENARIO" ? recovery.appliedAtLevel : "SEQUENCE",
      sequenceIds: texts(recovery.appliedToSequenceIds),
      feasibility: {
        procedure: feasibility?.procedureOrGuidanceAvailable === true,
        training: feasibility?.trainingIncluded === true,
        cues: feasibility?.cuesAvailable === true,
        crew: feasibility?.manpowerAvailable === true,
        time: feasibility?.timeAvailable === true,
        access: feasibility?.accessibilityConfirmed === true,
        equipment: feasibility?.equipmentAvailable === true,
      },
    };
    const restored = textOf(recovery.restoredFunction);
    if (restored !== undefined) record.restoredFunction = restored;
    const hep = finite(quantification?.meanHep) ?? finite(quantification?.pointEstimateHep);
    if (hep !== undefined) record.hep = hep;
    const dependencyId = textOf(recovery.dependencyAssessmentId);
    if (dependencyId !== undefined) record.dependencyId = dependencyId;
    const note = textOf(recovery.preOperationalFeasibilityJustification);
    if (note !== undefined) record.feasibilityNote = note;
    return [record];
  });
}

function dependencyRecords(hr: HumanReliabilityAnalysis): EsqDependencyRecord[] {
  return (hr.dependencyAssessments ?? []).flatMap((assessment): EsqDependencyRecord[] => {
    const id = textOf(assessment?.uuid);
    const jointHep = finite(assessment?.jointHep);
    if (id === undefined || jointHep === undefined) return [];
    const level = assessment.dependenceLevel;
    const record: EsqDependencyRecord = {
      id,
      scope: assessment.scope === "PRE_INITIATOR_SET" ? "PRE_INITIATOR_SET" : "WITHIN_SEQUENCE",
      hfeIds: texts(assessment.hfeIds),
      level: level === "ZERO" || level === "LOW" || level === "MODERATE" || level === "HIGH" || level === "COMPLETE" ? level : "ZERO",
      jointHep,
      includesRecovery: assessment.includesRecoveryHfe === true,
    };
    const stateId = textOf(assessment.plantOperatingStateId);
    if (stateId !== undefined) record.stateId = stateId;
    const sequenceId = textOf(assessment.eventSequenceId);
    if (sequenceId !== undefined) record.sequenceId = sequenceId;
    const note = textOf(assessment.floorAppliedOrJustification);
    if (note !== undefined) record.floorNote = note;
    return [record];
  });
}

function jointFloorRecord(hr: HumanReliabilityAnalysis): EsqJointFloorRecord | undefined {
  const floor = hr.jointHepFloor ?? undefined;
  const value = finite(floor?.minimumJointProbability);
  if (floor === undefined || value === undefined) return undefined;
  return { id: textOf(floor.uuid) ?? "floor", value, justification: textOf(floor.justification) ?? "" };
}

function actionRecords(hr: HumanReliabilityAnalysis): EsqActionRecord[] {
  const recoveries = hr.recoveryActions ?? [];
  const recoveryQuantifications = new Set(texts(recoveries.map((recovery) => recovery?.hepQuantificationId)));
  return hr.humanFailureEvents.flatMap((event): EsqActionRecord[] => {
    const recovery = recoveries.find((candidate) => candidate.hfeId === event.uuid);
    if (event.hfeTiming !== "POST_INITIATOR" && recovery === undefined) return [];
    const quantification = hr.hepQuantifications.find((candidate) => candidate.hfeId === event.uuid && !recoveryQuantifications.has(candidate.uuid));
    const record: EsqActionRecord = {
      id: event.uuid,
      name: textOf(event.name) ?? event.uuid,
      timing: event.hfeTiming === "POST_INITIATOR" ? "POST_INITIATOR" : "AT_INITIATOR",
      riskSignificant: quantification?.isRiskSignificant === true,
    };
    const hep = finite(quantification?.meanHep) ?? finite(quantification?.pointEstimateHep);
    if (hep !== undefined) record.hep = hep;
    if (quantification?.assessmentType === "CONSERVATIVE_ESTIMATE" || quantification?.assessmentType === "DETAILED_ASSESSMENT") record.assessmentType = quantification.assessmentType;
    const cue = textOf(event.responseDetail?.cueDescription);
    if (cue !== undefined) record.cue = cue;
    const cueMinutes = finite(quantification?.cueArrivalTimeMinutes);
    if (cueMinutes !== undefined) record.cueMinutes = cueMinutes;
    const available = finite(quantification?.timeAvailableMinutes);
    if (available !== undefined) record.availableMinutes = available;
    const required = finite(quantification?.timeRequiredMinutes);
    if (required !== undefined) record.requiredMinutes = required;
    if (recovery !== undefined) {
      record.recoveryId = recovery.uuid;
      record.recoveryName = textOf(recovery.name) ?? recovery.uuid;
      const feasibility = recovery.feasibility;
      record.feasibility = {
        procedure: feasibility?.procedureOrGuidanceAvailable === true,
        training: feasibility?.trainingIncluded === true,
        cues: feasibility?.cuesAvailable === true,
        crew: feasibility?.manpowerAvailable === true,
        time: feasibility?.timeAvailable === true,
        access: feasibility?.accessibilityConfirmed === true,
        equipment: feasibility?.equipmentAvailable === true,
      };
      const note = textOf(recovery.preOperationalFeasibilityJustification);
      if (note !== undefined) record.feasibilityNote = note;
    }
    return [record];
  });
}

function upstreamLoaded(upstream: EsqUpstream, element: EsqModelElement): boolean {
  switch (element) {
    case "ES": return upstream.es !== undefined;
    case "SY": return upstream.sy !== undefined;
    case "DA": return upstream.da !== undefined;
    case "HRA": return upstream.hr !== undefined;
    case "IE": return upstream.ie !== undefined;
    case "POS": return upstream.pos !== undefined;
    case "SC": return upstream.sc !== undefined;
  }
}

function linkOf(esq: EventSequenceQuantification, element: EsqLinkCode): string | undefined {
  const id = esq.linkedWorkbooks?.[element];
  return id === undefined || id.length === 0 ? undefined : id;
}

function modelLinked(esq: EventSequenceQuantification): EsqModelElement[] {
  return ESQ_MODEL_ELEMENTS.filter((element) => linkOf(esq, element) !== undefined);
}

function modelImportReady(esq: EventSequenceQuantification, upstream: EsqUpstream): boolean {
  const linked = modelLinked(esq);
  return linked.includes("ES") && linked.every((element) => upstreamLoaded(upstream, element));
}

function workbookNameOf(id: string, options: readonly Workbook[]): string {
  return options.find((workbook) => workbook.id === id)?.name ?? exampleLinkLabel(id) ?? id;
}

function modelSources(esq: EventSequenceQuantification, upstream: EsqUpstream): EsqModelSource[] {
  const out: EsqModelSource[] = [];
  for (const element of ESQ_MODEL_ELEMENTS) {
    const id = linkOf(esq, element);
    if (id === undefined || !upstreamLoaded(upstream, element)) continue;
    const option = upstream.options[element].find((workbook) => workbook.id === id);
    const source: EsqModelSource = { element, workbookId: id, workbookName: workbookNameOf(id, upstream.options[element]) };
    if (option !== undefined) source.updatedAt = option.updatedAt;
    out.push(source);
  }
  return out;
}

function importModel(esq: EventSequenceQuantification, upstream: EsqUpstream, now: string): EsqModel {
  const es = linkOf(esq, "ES") === undefined ? undefined : upstream.es;
  const sy = linkOf(esq, "SY") === undefined ? undefined : upstream.sy;
  const da = linkOf(esq, "DA") === undefined ? undefined : upstream.da;
  const hr = linkOf(esq, "HRA") === undefined ? undefined : upstream.hr;
  const ie = linkOf(esq, "IE") === undefined ? undefined : upstream.ie;
  const pos = linkOf(esq, "POS") === undefined ? undefined : upstream.pos;
  const sc = linkOf(esq, "SC") === undefined ? undefined : upstream.sc;
  const parameterIds = new Set((da?.parameters ?? []).map((parameter) => parameter.uuid));
  const hfeIds = new Set((hr?.humanFailureEvents ?? []).map((event) => event.uuid));
  const sequences = es === undefined ? [] : sequenceRecords(es);
  return {
    importedAt: now,
    sources: modelSources(esq, upstream),
    trees: es === undefined ? [] : treeRecords(es),
    sequences,
    families: es === undefined ? [] : familyRecords(es, sequences),
    functions: es === undefined ? [] : functionRecords(es),
    tops: sy === undefined ? [] : topRecords(sy),
    initiators: ie === undefined ? [] : initiatorRecords(ie),
    states: pos === undefined ? [] : stateRecords(pos),
    events: sy === undefined ? [] : eventRecords(sy, parameterIds, hfeIds),
    ccfGroups: sy === undefined ? [] : ccfRecords(sy),
    parameters: da === undefined ? [] : parameterRecords(da),
    humanEvents: hr === undefined ? [] : humanRecords(hr),
    barriers: pos === undefined ? [] : barrierRecords(pos),
    criteria: sc === undefined ? [] : criterionRecords(sc),
    impacts: ie === undefined ? [] : impactRecords(ie),
    qualifications: sy === undefined ? [] : qualificationRecords(sy),
    actions: hr === undefined ? [] : actionRecords(hr),
    recoveries: hr === undefined ? [] : recoveryRecords(hr),
    dependencies: hr === undefined ? [] : dependencyRecords(hr),
    ...(hr === undefined ? {} : floorField(hr)),
  };
}

function floorField(hr: HumanReliabilityAnalysis): { jointFloor?: EsqJointFloorRecord } {
  const floor = jointFloorRecord(hr);
  return floor === undefined ? {} : { jointFloor: floor };
}

function tableChanges<T extends object>(table: EsqModelTable, previous: readonly T[], next: readonly T[], idOf: (row: T) => string, labelOf: (row: T) => string, changes: EsqModelChange[]): void {
  const before = new Map(previous.map((row) => [idOf(row), row]));
  const nextIds = new Set(next.map(idOf));
  for (const row of next) {
    const old = before.get(idOf(row));
    if (old === undefined) changes.push({ table, id: idOf(row), change: "ADDED" });
    else if (canonicalJson(old) !== canonicalJson(row)) changes.push({ table, id: idOf(row), change: "CHANGED" });
  }
  for (const [id, old] of before) {
    if (!nextIds.has(id)) changes.push({ table, id, change: "REMOVED", label: labelOf(old) });
  }
}

function withTreeMissionTimes(previous: EsqModel | undefined, next: EsqModel): EsqModel {
  const kept = new Map((previous?.trees ?? []).flatMap((tree) => (tree.missionTime === undefined ? [] : [[tree.id, tree.missionTime] as const])));
  if (kept.size === 0) return next;
  return {
    ...next,
    trees: next.trees.map((tree) => {
      const missionTime = kept.get(tree.id);
      return missionTime === undefined ? tree : { ...tree, missionTime };
    }),
  };
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

function withModelImported(esq: EventSequenceQuantification, upstream: EsqUpstream, now: string): EventSequenceQuantification {
  const previous = esq.model;
  const next = withTreeMissionTimes(previous, importModel(esq, upstream, now));
  if (previous?.importedAt === undefined) return { ...esq, model: next };
  const changes: EsqModelChange[] = [];
  tableChanges("TREE", previous.trees, next.trees, (row) => row.id, (row) => row.code, changes);
  tableChanges("SEQUENCE", previous.sequences, next.sequences, (row) => row.id, (row) => row.code, changes);
  tableChanges("FAMILY", previous.families, next.families, (row) => row.id, (row) => row.id, changes);
  tableChanges("FUNCTION", previous.functions, next.functions, (row) => row.id, (row) => row.id, changes);
  tableChanges("TOP", previous.tops, next.tops, (row) => row.modelId, (row) => row.code, changes);
  tableChanges("INITIATOR", previous.initiators, next.initiators, (row) => row.id, (row) => row.id, changes);
  tableChanges("STATE", previous.states, next.states, (row) => row.id, (row) => row.id, changes);
  tableChanges("EVENT", previous.events, next.events, (row) => row.id, (row) => row.code, changes);
  tableChanges("CCF", previous.ccfGroups, next.ccfGroups, (row) => row.id, (row) => row.id, changes);
  tableChanges("PARAMETER", previous.parameters, next.parameters, (row) => row.id, (row) => row.id, changes);
  tableChanges("HUMAN", previous.humanEvents, next.humanEvents, (row) => row.id, (row) => row.id, changes);
  tableChanges("BARRIER", previous.barriers ?? [], next.barriers ?? [], (row) => row.id, (row) => row.name, changes);
  tableChanges("CRITERION", previous.criteria ?? [], next.criteria ?? [], (row) => row.id, (row) => row.id, changes);
  tableChanges("IMPACT", previous.impacts ?? [], next.impacts ?? [], (row) => `${row.initiatorId}:${row.barrierRef}`, (row) => `${row.initiatorName} ${row.barrierRef}`, changes);
  tableChanges("QUALIFICATION", previous.qualifications ?? [], next.qualifications ?? [], (row) => row.id, (row) => row.id, changes);
  tableChanges("ACTION", previous.actions ?? [], next.actions ?? [], (row) => row.id, (row) => row.name, changes);
  tableChanges("RECOVERY", previous.recoveries ?? [], next.recoveries ?? [], (row) => row.id, (row) => row.name, changes);
  tableChanges("DEPENDENCY", previous.dependencies ?? [], next.dependencies ?? [], (row) => row.id, (row) => row.id, changes);
  return { ...esq, model: { ...next, changes } };
}

function modelChangeOf(model: EsqModel, table: EsqModelTable, id: string): EsqModelChange["change"] | undefined {
  return model.changes?.find((change) => change.table === table && change.id === id)?.change;
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
  return `split:${target.cellId ?? ""}:${target.parameterId ?? ""}:${target.value ?? ""}:${target.errorFactor ?? ""}`;
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
    const fromEs = record.esLinks.some((entry) => using.some((tree) => tree.id === entry.treeId));
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

function missionTimeSourcesOf(esq: EventSequenceQuantification, upstream: Pick<EsqUpstream, "sc" | "scExamples">): ScMissionTimeSource[] {
  const workbookId = linkOf(esq, "SC");
  return [...(workbookId === undefined || upstream.sc === undefined ? [] : [{ workbookId, sc: upstream.sc }]), ...upstream.scExamples];
}

function scTableOf(sources: readonly ScMissionTimeSource[]): Map<string, UncertainParameter> {
  return new Map(sources.flatMap((source) => [...scMissionTimeTable(source.workbookId, source.sc)]));
}

function parameterTableOf(esq: EventSequenceQuantification, sources: readonly ScMissionTimeSource[] = []): Map<string, UncertainParameter> {
  const table = scTableOf(sources);
  for (const parameter of esq.model?.parameters ?? []) {
    const reference = daReferenceOf(esq, parameter.id);
    if (reference === undefined || parameter.estimate === undefined || !holdsEstimate(parameter.quantificationModel)) continue;
    table.set(parameterReferenceKey(reference), { reference, expression: parameter.estimate });
  }
  return table;
}

function parameterLabelOf(esq: EventSequenceQuantification, sources: readonly ScMissionTimeSource[] = []): (key: string) => string {
  const labels = new Map<string, string>(sources.flatMap((source) => scMissionTimeEntries(source.workbookId, source.sc).map((entry) => [parameterReferenceKey(entry.reference), entry.label] as const)));
  for (const parameter of esq.model?.parameters ?? []) {
    const reference = daReferenceOf(esq, parameter.id);
    if (reference !== undefined) labels.set(parameterReferenceKey(reference), parameter.id);
  }
  return (key) => labels.get(key) ?? key.slice(key.indexOf(":") + 1);
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
  if (parameter.estimate === undefined) return { problem: `DA gives ${parameter.name} no estimate. Give it one in DA and import again.` };
  const reference = daReferenceOf(esq, parameter.id);
  if (reference === undefined) return { problem: "Step 01 links no DA workbook. Link it and import again." };
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
    const heldBy = binding?.heldBy ?? event.heldBy;
    const holderId = binding?.holderId ?? event.holderId;
    const component = carriesUncertainExpression(event.failureMode);
    const view: EsqValueView = { kind: "EVENT", id: event.id, code: event.code, name: event.name, event, heldBy, component, functionIds };
    if (event.systemName !== undefined) view.systemName = event.systemName;
    if (binding !== undefined) view.binding = binding;
    if (holderId !== undefined) view.holderId = holderId;
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
      } else if (holdsEstimate(parameter.quantificationModel)) {
        view.problem = `${parameter.name} is a frequency. It cannot set ${event.code}.`;
      } else {
        if (parameter.value !== undefined) view.value = parameter.value;
        if (parameter.valueType !== undefined) view.valueType = parameter.valueType;
      }
    } else if (human !== undefined) {
      view.human = human;
      if (human.value !== undefined) view.value = human.value;
      if (human.valueType !== undefined) view.valueType = human.valueType;
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
    const view: EsqValueView = { kind: "CCF", id: group.id, code: group.id, name: group.name, ccf: group, heldBy: group.estimateRef === undefined ? "TYPED" : "DA", component: false, functionIds };
    if (group.estimateRef !== undefined) view.holderId = group.estimateRef;
    if (group.total !== undefined) view.expression = group.total;
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

function sourceFindings(esq: EventSequenceQuantification, model: EsqModel, options?: Record<EsqLinkCode, Workbook[]>): EsqModelFinding[] {
  const findings: EsqModelFinding[] = [];
  for (const source of model.sources) {
    const label = MODEL_ELEMENT_LABELS[source.element];
    const linkedId = linkOf(esq, source.element);
    if (linkedId !== source.workbookId) {
      findings.push({ severity: "warning", check: "Link changed", item: label, detail: linkedId === undefined ? `${label} is no longer linked. Its items stay until you import again.` : `Step 01 now links a different ${label} workbook. Import again to use it.` });
      continue;
    }
    const option = options?.[source.element].find((workbook) => workbook.id === source.workbookId);
    if (option !== undefined && source.updatedAt !== undefined && option.updatedAt > source.updatedAt) {
      findings.push({ severity: "warning", check: "Source changed", item: label, detail: `The ${label} workbook changed after the import. Import again to bring in the changes.` });
    }
  }
  for (const element of ESQ_MODEL_ELEMENTS) {
    const label = MODEL_ELEMENT_LABELS[element];
    if (linkOf(esq, element) !== undefined && !model.sources.some((source) => source.element === element)) {
      findings.push({ severity: "warning", check: "Not imported", item: label, detail: `${label} is linked, but nothing was imported from it. Import again.` });
    }
  }
  if (!model.sources.some((source) => source.element === "ES")) findings.push({ severity: "error", check: "No event trees", item: "ES", detail: "Link the ES workbook in Step 01 and import." });
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
    if (record.transferTreeId !== undefined) {
      const treeCode = model.trees.find((tree) => tree.id === record.transferTreeId)?.code;
      if (treeCode === undefined) findings.push({ severity: "error", check: "Transfer target missing", item: record.code, detail: `${record.code} transfers to a tree that ES does not have.` });
      else if ((record.transferCarries ?? []).length === 0) findings.push({ severity: "warning", check: "Nothing carried", item: record.code, detail: `ES does not say what ${record.code} carries into ${treeCode}. Record it in ES (ESQ-C3).` });
      if (record.familyId !== undefined && treeCode !== undefined) findings.push({ severity: "note", check: "Transfer in a family", item: record.code, detail: `ES puts ${record.code} in ${record.familyId}. ESQ counts it through the ${treeCode} sequences instead.` });
      continue;
    }
    if (view.choice !== undefined && blank(view.choice.reason)) findings.push({ severity: "error", check: "Changed without a reason", item: record.code, detail: "The family differs from ES. Give the reason.", target });
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
    if (cell === undefined) findings.push({ severity: "error", check: "Step 04 cell missing", item, detail: `${where} takes cell ${target.cellId}, which Step 04 no longer has.`, target: findingTarget });
    else if (cellExpressionOfRecord(cell) === undefined) findings.push({ severity: "error", check: "No Step 04 value", item, detail: `${where} takes cell ${cell.id}, which has no value of record yet. Run it or type a value in Step 04.`, target: findingTarget });
    return findings;
  }
  if (target.parameterId !== undefined) {
    if (!model.parameters.some((parameter) => parameter.id === target.parameterId)) findings.push({ severity: "error", check: "DA parameter missing", item, detail: `${where} takes ${target.parameterId}, which the imported DA workbook does not hold.`, target: findingTarget });
    return findings;
  }
  const value = finite(target.value);
  if (value === undefined) findings.push({ severity: "error", check: "No split fraction", item, detail: `Enter the split fraction for ${where}.`, target: findingTarget });
  else if (!(value > 0 && value <= 1)) findings.push({ severity: "error", check: "Split fraction out of range", item, detail: `${where} needs a probability above 0 and at most 1.`, target: findingTarget });
  if (blank(target.basis)) findings.push({ severity: "warning", check: "No basis", item, detail: `Give the basis of the split fraction for ${where}.`, target: findingTarget });
  if (cc === "CC-II" && finite(target.errorFactor) === undefined) findings.push({ severity: "warning", check: "No distribution", item, detail: `CC-II propagates a distribution. Give an error factor for ${where} (ESQ-A8).`, target: findingTarget });
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
  const untimed = model.trees.filter((tree) => asked.has(tree.id) && tree.missionTime === undefined).map((tree) => tree.code);
  if (untimed.length > 0) findings.push({ severity: "note", check: "No tree mission time", item: listText(untimed), detail: `Give ${untimed.length === 1 ? "this tree" : "these trees"} a mission time in the Trees tab, typed or linked to SC. The mission time check skips ${untimed.length === 1 ? "it" : "them"}.` });
  const unchecked = new Map<string, string>();
  for (const view of functions) {
    const id = view.record.id;
    const target = { kind: "esqFunction" as const, id };
    const shortTrees: { tree: string; events: string[]; hours: number; mission: number }[] = [];
    for (const { tree, link } of view.resolved) {
      if (tree.missionTime === undefined || link.target?.kind !== "FAULT_TREE") continue;
      const treePoint = missionPoint(tree.missionTime, table);
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
      findings.push({ severity: "error", check: "Not linked", item: id, detail: `${id} is not linked in ${plural(view.unlinked.length, "tree")} (${listText(view.unlinked.map((tree) => tree.code))}). Link it to a fault tree top or give it a split fraction.`, target });
    }
    for (const linkTarget of view.targets) {
      if (linkTarget.kind === "FAULT_TREE") {
        if (topOf(model, linkTarget.top) === undefined) findings.push({ severity: "error", check: "Top missing", item: id, detail: `${id} links to a fault tree that is not in the imported SY workbook.`, target });
      } else {
        findings.push(...splitFindings(esq, model, linkTarget, id, id, cc, target));
      }
    }
    if (view.edited && view.link?.target !== undefined && blank(view.link.reason)) findings.push({ severity: "error", check: "Changed without a reason", item: id, detail: "The link differs from ES. Give the reason.", target });
    (view.link?.rules ?? []).forEach((rule, index) => {
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
    if (view.source === "IE" && view.record === undefined) {
      findings.push({ severity: "error", check: "Not in IE", item: view.id, detail: model.sources.some((source) => source.element === "IE") ? `ES starts trees with ${view.id}, but IE does not list it. Type its frequency or take it from DA.` : `Link IE in Step 01 and import, or type the frequency of ${view.id}.`, target });
    } else if (view.source === "DA" && view.parameter === undefined) {
      findings.push({ severity: "error", check: "DA parameter missing", item: view.id, detail: view.choice?.parameterId === undefined ? "Pick the DA parameter." : `The imported DA workbook does not hold ${view.choice.parameterId}.`, target });
    } else if (view.source === "DA" && view.parameter?.estimate === undefined) {
      findings.push({ severity: "error", check: "No DA estimate", item: view.id, detail: `DA gives ${view.parameter?.name ?? view.choice?.parameterId ?? "the parameter"} no frequency estimate.`, target });
    } else if (view.source === "DA" && linkOf(esq, "DA") === undefined) {
      findings.push({ severity: "error", check: "DA workbook not linked", item: view.id, detail: "Link the DA workbook in Step 01 to take the frequency from it.", target });
    } else if (view.given === undefined) {
      findings.push({ severity: "error", check: "No frequency", item: view.id, detail: `${view.id} has no frequency. Take it from IE or DA, or type it.`, target });
    }
    if (view.given !== undefined) {
      for (const problem of referenceProblems(esq, model, view.given, view.id)) findings.push({ severity: "error", check: problem.check, item: view.id, detail: problem.detail, target });
    }
    if (view.source === "TYPED") {
      if (blank(view.choice?.basis)) findings.push({ severity: "warning", check: "No basis", item: view.id, detail: "Give the basis of the typed frequency.", target });
      if (cc === "CC-II" && view.given !== undefined && !hasUncertainty(inlinedExpression(view.given, table))) findings.push({ severity: "warning", check: "No distribution", item: view.id, detail: "CC-II propagates a distribution. Give the typed frequency a law (ESQ-A8).", target });
    }
    if (view.unit === "per-critical-year") findings.push({ severity: "warning", check: "Frequency unit", item: view.id, detail: "IE gives this frequency per critical year. ESQ works per plant-year.", target });
    if (view.unit === "per-demand") findings.push({ severity: "error", check: "Frequency unit", item: view.id, detail: "IE gives this value per demand. An initiator needs a frequency.", target });
    const applicable = view.states.filter((state) => state.applicable);
    if (applicable.length < 2) {
      if (applicable.length === 0) findings.push({ severity: "error", check: "No operating state", item: view.id, detail: `Neither IE nor ES places ${view.id} in an operating state.`, target });
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
      findings.push({ severity: "warning", check: "State without a tree", item: view.id, detail: `IE lists ${state.stateId} for ${view.id}, but ES has no tree for it.${share}`, target });
    }
    const stray = view.states.filter((state) => !state.applicable && state.treeIds.length > 0).map((state) => state.stateId);
    if (stray.length > 0 && view.record !== undefined) findings.push({ severity: "warning", check: "State not in IE", item: view.id, detail: `ES has a tree for ${view.id} in ${listText(stray)}, but IE does not list ${stray.length === 1 ? "that state" : "those states"}. ${stray.length === 1 ? "It gets" : "They get"} no frequency.`, target });
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
    if (readsMissionTime(esq, reference)) {
      const missionTime = missionTimes?.get(key);
      if (missionTimes !== undefined && missionTime === undefined) problems.push({ check: "SC mission time missing", detail: `${code} reads mission time ${reference.entityId}, which the linked SC workbook does not hold.` });
      if (missionTime !== undefined) pending.push(...expressionReferences(missionTime.expression));
      continue;
    }
    if (workbookId === undefined || reference.workbookId.trim() !== workbookId.trim()) {
      problems.push({ check: "Workbook not linked", detail: `${code} reads ${reference.entityId} from a workbook that Step 01 does not link as DA or SC.` });
      continue;
    }
    const parameter = model.parameters.find((entry) => entry.id === reference.entityId.trim());
    if (parameter === undefined) {
      problems.push({ check: "DA parameter missing", detail: `${code} reads DA parameter ${reference.entityId}, which the Step 02 import does not hold.` });
      continue;
    }
    if (!holdsEstimate(parameter.quantificationModel) || parameter.estimate === undefined) {
      problems.push({ check: "No DA estimate", detail: `${code} reads ${parameter.name}, which has no estimate in DA.` });
      continue;
    }
    pending.push(...expressionReferences(parameter.estimate));
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
    if (value.binding !== undefined && blank(value.binding.reason)) findings.push({ severity: "error", check: "Changed without a reason", item: value.code, detail: "The value source differs from SY. Give the reason.", target });
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
    if (value.heldBy === "TYPED") findings.push({ severity: "warning", check: "Not bound", item: value.code, detail: "SY types this value. Bind it to a DA parameter or an HR event.", target });
    if (cc !== "CC-II") continue;
    if (value.expression !== undefined) {
      if (!hasUncertainty(inlinedExpression(value.expression, table))) findings.push({ severity: "warning", check: "No distribution", item: value.code, detail: `${value.code} has no uncertainty to propagate at CC-II. Give it a law in ${value.heldBy === "DA" ? "DA" : "SY"} (ESQ-A8).`, target });
      continue;
    }
    if (value.valueType === "POINT_ESTIMATE") findings.push({ severity: "warning", check: "Point estimate at CC-II", item: value.code, detail: "CC-II quantifies with mean values (ESQ-A5, A8).", target });
    if (value.parameter !== undefined && (value.parameter.distribution === undefined || value.parameter.distribution.type === DistributionType.POINT_ESTIMATE)) findings.push({ severity: "warning", check: "No distribution", item: value.code, detail: `${value.parameter.id} has no distribution to propagate at CC-II (ESQ-A8).`, target });
    if (value.human?.assessmentType === "CONSERVATIVE_ESTIMATE" && value.human.riskSignificant) findings.push({ severity: "warning", check: "Screening value", item: value.code, detail: `${value.human.id} is risk-significant but keeps a conservative estimate. CC-II needs a detailed assessment (ESQ-A8).`, target });
  }
  return findings;
}

function missionTimeTableOf(esq: EventSequenceQuantification, upstream: Pick<EsqUpstream, "sc" | "scExamples">): Map<string, UncertainParameter> | undefined {
  return linkOf(esq, "SC") !== undefined && upstream.sc === undefined ? undefined : scTableOf(missionTimeSourcesOf(esq, upstream));
}

function modelViewOf(esq: EventSequenceQuantification, options?: Record<EsqLinkCode, Workbook[]>, missionTimes?: ReadonlyMap<string, UncertainParameter>): EsqModelView | undefined {
  const model = esq.model;
  if (model?.importedAt === undefined) return undefined;
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
    ...sourceFindings(esq, model, options),
    ...(model.sources.some((source) => source.element === "ES") && sequences.length === 0 ? [{ severity: "error" as const, check: "No sequence in scope", item: "Sequences", detail: "Step 01 leaves every event tree out of scope." }] : []),
    ...sequenceFindings(model, sequences, families),
    ...familyFindings(families),
    ...functionFindings(esq, model, functions),
    ...(missionTimes === undefined ? [] : missionFindings(model, functions, values, new Map([...table, ...missionTimes]))),
    ...initiatorFindings(esq, model, initiators, table),
    ...valueFindings(esq, model, values, table, missionTimes),
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
  modelImportReady,
  withModelImported,
  modelChangeOf,
  modelViewOf,
  modelComplete,
  resolveLink,
  topOf,
  targetKey,
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
  missionTimeSourcesOf,
  missionTimeTableOf,
  parameterLabelOf,
  parameterTableOf,
  referenceProblems,
  withTreeMissionTime,
  type EsqModelWindowKind,
  type EsqReferenceProblem,
  type EsqFindingSeverity,
  type EsqModelFinding,
  type EsqResolvedLink,
  type EsqSequenceView,
  type EsqFamilyView,
  type EsqFunctionView,
  type EsqInitiatorView,
  type EsqInitiatorStateView,
  type EsqValueView,
  type EsqModelView,
};
