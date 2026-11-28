import type {
  EsqActionRecord,
  EsqBarrierRecord,
  EsqBranchState,
  EsqCcfRecord,
  EsqCriterionLoad,
  EsqCriterionRecord,
  EsqDependencyRecord,
  EsqEventRecord,
  EsqFamilyRecord,
  EsqFunctionRecord,
  EsqHumanRecord,
  EsqImpactRecord,
  EsqInitiatorRecord,
  EsqJointFloorRecord,
  EsqLinkCode,
  EsqModel,
  EsqModelElement,
  EsqModelSource,
  EsqPhenomenonRecord,
  EsqQualificationRecord,
  EsqRecoveryRecord,
  EsqRepairRecord,
  EsqSequenceRecord,
  EsqStateRecord,
  EsqTopRecord,
  EsqTreeMissionTime,
  EsqTreeRecord,
  EsqTypedInitiator,
  EventSequenceQuantification,
} from "./event-sequence-quantification";
import { isEventTreeBranchState, type EventSequence, type EventSequenceAnalysis, type EventSequenceFamily, type EventTree, type FunctionalEvent } from "../es/event-sequence-analysis";
import { carriesUncertainExpression, type CommonCauseFailureGroup, type SystemBasicEvent, type SystemsAnalysis } from "../sy/systems-analysis";
import { systemFaultTreeBasicEventIds } from "../sy/system-models";
import type { DataAnalysis } from "../da/data-analysis";
import type { HumanReliabilityAnalysis } from "../hr/human-reliability-analysis";
import type { InitiatingEventGroup, InitiatingEventsAnalysis } from "../ie/initiating-event-analysis";
import type { PlantOperatingStatesAnalysis } from "../pos/plant-operating-state-analysis";
import type { SuccessCriteriaDevelopment } from "../sc/success-criteria-development";
import { expressionReferences, type UncertainExpression } from "../core/uncertainty";
import { legacyExpression } from "../core/legacy-uncertainty-adapter";
import type { QuantificationTimeUnit } from "../modeling/quantitative-semantics";
import { esqParameterLinks, sameItem } from "./esq-run-inputs";

interface EsqModelSources {
  es?: EventSequenceAnalysis;
  sy?: SystemsAnalysis;
  da?: DataAnalysis;
  hr?: HumanReliabilityAnalysis;
  ie?: InitiatingEventsAnalysis;
  pos?: PlantOperatingStatesAnalysis;
  sc?: SuccessCriteriaDevelopment;
}

const ESQ_MODEL_SOURCE_ELEMENTS: readonly EsqModelElement[] = ["ES", "SY", "DA", "HRA", "IE", "POS", "SC"];

const HOURS_PER_UNIT: Record<QuantificationTimeUnit, number> = {
  SECOND: 1 / 3600,
  MINUTE: 1 / 60,
  HOUR: 1,
  DAY: 24,
  YEAR: 8760,
};

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

interface EsqTreeSource {
  trees: readonly EventTree[];
  sequences: readonly EventSequence[];
  families: readonly EventSequenceFamily[];
  scopeInitiators: readonly string[];
}

function esTreeSource(es: EventSequenceAnalysis): EsqTreeSource {
  return { trees: es.eventTrees ?? [], sequences: es.eventSequences, families: es.eventSequenceFamilies, scopeInitiators: texts(es.scopeDefinition?.initiatingEventIds) };
}

function typedTreesOf(esq: EventSequenceQuantification): EventTree[] {
  return esq.modelDecisions?.typedTrees ?? [];
}

function typedTreeSource(esq: EventSequenceQuantification): EsqTreeSource {
  return { trees: typedTreesOf(esq), sequences: [], families: [], scopeInitiators: texts(esq.modelIntegration.scopeCoverage.initiatingEventGroups) };
}

function entryInitiators(source: EsqTreeSource): string[] {
  const trees = source.trees;
  const targets = new Set(trees.flatMap((tree) => texts(Object.values(tree.transfers ?? {}).map((transfer) => transfer?.targetEventTreeId))));
  const started = texts(trees.filter((tree) => !targets.has(tree.uuid)).map((tree) => tree.initiatingEventId));
  return texts(trees.filter((tree) => targets.has(tree.uuid)).map((tree) => tree.initiatingEventId))
    .filter((id) => !started.some((other) => sameItem(other, id)) && !source.scopeInitiators.some((other) => sameItem(other, id)));
}

function transferEntryInitiators(es: EventSequenceAnalysis): string[] {
  return entryInitiators(esTreeSource(es));
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

function treeRecords(source: EsqTreeSource): EsqTreeRecord[] {
  const trees = source.trees;
  const targets = new Set(trees.flatMap((tree) => texts(Object.values(tree.transfers ?? {}).map((transfer) => transfer?.targetEventTreeId))));
  const entries = entryInitiators(source);
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

function multiBranchKeys(states: Record<string, string | null> | null | undefined, keyOf: ReadonlyMap<string, string>): string[] {
  return Object.entries(states ?? {}).flatMap(([id, state]) => (state !== null && isEventTreeBranchState(state) ? [keyOf.get(id) ?? id] : []));
}

function translatedPath(states: Record<string, string | null> | null | undefined, keyOf: ReadonlyMap<string, string>): Record<string, EsqBranchState> {
  const path: Record<string, EsqBranchState> = {};
  for (const [id, state] of Object.entries(states ?? {})) {
    if (state !== "SUCCESS" && state !== "FAILURE" && state !== "BYPASSED") continue;
    path[keyOf.get(id) ?? id] = state;
  }
  return path;
}

function sequenceRecords(source: EsqTreeSource): EsqSequenceRecord[] {
  const byId = new Map(source.sequences.map((sequence) => [sequence.uuid, sequence]));
  const memberFamily = new Map<string, string>();
  for (const family of source.families) {
    for (const id of texts(family.memberSequenceIds)) {
      if (!memberFamily.has(id)) memberFamily.set(id, family.uuid);
    }
  }
  const out: EsqSequenceRecord[] = [];
  const used = new Set<string>();
  for (const tree of source.trees) {
    const keyOf = new Map(Object.entries(tree.functionalEvents).map(([id, event]) => [id, functionKeyOf(event, id)]));
    for (const [treeSequenceId, sequence] of Object.entries(tree.sequences)) {
      const linkedId = textOf(sequence.eventSequenceId);
      const id = linkedId !== undefined && !used.has(linkedId) ? linkedId : treeSequenceId;
      const known = byId.get(linkedId ?? id) ?? byId.get(sequence.uuid);
      if (known !== undefined) used.add(known.uuid);
      used.add(id);
      const transfer = tree.transfers?.[treeSequenceId] ?? tree.transfers?.[sequence.uuid] ?? undefined;
      const record: EsqSequenceRecord = {
        id,
        code: textOf(sequence.label) ?? textOf(sequence.name) ?? treeSequenceId,
        treeId: tree.uuid,
        path: { ...translatedPath(known?.functionalEventStates, keyOf), ...translatedPath(sequence.functionalEventStates, keyOf) },
      };
      const multiBranch = [...new Set([...multiBranchKeys(known?.functionalEventStates, keyOf), ...multiBranchKeys(sequence.functionalEventStates, keyOf)])];
      if (multiBranch.length > 0) record.multiBranchFunctions = multiBranch;
      const endState = textOf(sequence.endState) ?? (transfer === undefined ? textOf(known?.endState) : undefined);
      if (endState !== undefined) record.endState = endState;
      const familyId = textOf(known?.sequenceFamilyId) ?? memberFamily.get(id);
      if (familyId !== undefined) record.familyId = familyId;
      const releaseCategoryId = textOf(known?.releaseCategoryId);
      if (releaseCategoryId !== undefined) record.releaseCategoryId = releaseCategoryId;
      const sources = texts(known?.affectedReactorSourceCombinations);
      if (sources.length > 0) record.sourceIds = sources;
      const target = textOf(transfer?.targetEventTreeId);
      if (target !== undefined) {
        record.transferTreeId = target;
        record.transferCarries = texts(transfer?.preservedDependencies);
      }
      out.push(record);
    }
  }
  for (const sequence of source.sequences) {
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

function familyRecords(source: EsqTreeSource, sequences: readonly EsqSequenceRecord[]): EsqFamilyRecord[] {
  const records: EsqFamilyRecord[] = source.families.map((family) => {
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

function functionRecords(source: EsqTreeSource): EsqFunctionRecord[] {
  const out = new Map<string, EsqFunctionRecord>();
  for (const tree of source.trees) {
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

function ieGroupRecord(group: InitiatingEventGroup): EsqInitiatorRecord {
  const record: EsqInitiatorRecord = { id: group.uuid, name: textOf(group.name) ?? group.uuid, stateIds: texts(group.applicableStates) };
  const description = textOf(group.description);
  if (description !== undefined) record.description = description;
  const frequency = group.frequency ?? undefined;
  if (frequency !== undefined) record.frequency = structuredClone(frequency);
  const holderId = textOf(group.controlledDataSource?.entityId);
  record.heldBy = holderId === undefined ? "TYPED" : "DA";
  if (holderId !== undefined) record.holderId = holderId;
  return record;
}

function initiatorRecords(ie: InitiatingEventsAnalysis): EsqInitiatorRecord[] {
  return ie.initiatingEventGroups.map(ieGroupRecord);
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
    if (quantification.hep !== undefined) record.hep = structuredClone(quantification.hep);
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

function phenomenonRecords(es: EventSequenceAnalysis): EsqPhenomenonRecord[] {
  return (es.dependencyModels?.phenomenologicalDependencies ?? []).map((condition) => {
    const record: EsqPhenomenonRecord = {
      id: condition.uuid,
      name: textOf(condition.name) ?? condition.uuid,
      phenomenon: textOf(condition.phenomenon) ?? "",
      description: textOf(condition.description) ?? "",
      affectedSystems: texts(condition.affectedSystems),
      conditions: texts(condition.environmentalConditions),
      references: texts(condition.deterministicAnalysisReferences),
    };
    const onset = textOf(condition.onsetTiming);
    if (onset !== undefined) record.onset = onset;
    return record;
  });
}

function repairRecords(es: EventSequenceAnalysis): EsqRepairRecord[] {
  return (es.repairCreditRecords ?? []).flatMap((entry): EsqRepairRecord[] => {
    const id = textOf(entry?.uuid);
    const sequenceId = textOf(entry?.eventSequenceId);
    if (id === undefined || sequenceId === undefined) return [];
    const record: EsqRepairRecord = { id, sequenceId, credited: entry.repairCredited === true, justification: textOf(entry.justification) ?? "" };
    const equipment = textOf(entry.equipment);
    if (equipment !== undefined) record.equipment = equipment;
    const minutes = finite(entry.timeMinutes);
    if (minutes !== undefined) record.timeMinutes = minutes;
    const access = textOf(entry.access);
    if (access !== undefined) record.access = access;
    const conservative = textOf(entry.conservativeRepairBasis);
    if (conservative !== undefined) record.conservativeBasis = conservative;
    return [record];
  });
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
    const hep = quantification?.hep;
    if (hep !== undefined) record.hep = structuredClone(hep);
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
  const recoveryQuantifications = new Set(texts((hr.recoveryActions ?? []).map((recovery) => recovery?.hepQuantificationId)));
  return hr.humanFailureEvents.flatMap((event): EsqActionRecord[] => {
    if (event.hfeTiming !== "POST_INITIATOR") return [];
    const quantification = hr.hepQuantifications.find((candidate) => candidate.hfeId === event.uuid && !recoveryQuantifications.has(candidate.uuid));
    const record: EsqActionRecord = {
      id: event.uuid,
      name: textOf(event.name) ?? event.uuid,
      timing: "POST_INITIATOR",
      riskSignificant: quantification?.isRiskSignificant === true,
    };
    const hep = quantification?.hep;
    if (hep !== undefined) record.hep = structuredClone(hep);
    if (quantification?.assessmentType === "CONSERVATIVE_ESTIMATE" || quantification?.assessmentType === "DETAILED_ASSESSMENT") record.assessmentType = quantification.assessmentType;
    const cue = textOf(event.responseDetail?.cueDescription);
    if (cue !== undefined) record.cue = cue;
    const cueMinutes = finite(quantification?.cueArrivalTimeMinutes);
    if (cueMinutes !== undefined) record.cueMinutes = cueMinutes;
    const available = finite(quantification?.timeAvailableMinutes);
    if (available !== undefined) record.availableMinutes = available;
    const required = finite(quantification?.timeRequiredMinutes);
    if (required !== undefined) record.requiredMinutes = required;
    return [record];
  });
}

function unitHours(unit: string | undefined): number {
  const text = (unit ?? "").trim().toLowerCase();
  if (text.startsWith("min")) return 1 / 60;
  if (text === "s" || text.startsWith("sec")) return 1 / 3600;
  if (text.startsWith("d")) return 24;
  if (text.startsWith("w")) return 168;
  if (text.startsWith("y")) return 8760;
  return 1;
}

function esMissionHours(es: EventSequenceAnalysis, tree: EventTree): number | undefined {
  const linked = new Set(texts(Object.values(tree.sequences).map((sequence) => sequence.eventSequenceId)));
  const minutes = es.eventSequences
    .filter((sequence) => textOf(sequence.eventTreeId) === tree.uuid || linked.has(sequence.uuid))
    .flatMap((sequence) => (sequence.timing ?? []).flatMap((entry) => (entry.category === "MISSION_TIME" && Number.isFinite(entry.timeAfterInitiator) && entry.timeAfterInitiator > 0 ? [entry.timeAfterInitiator] : [])));
  if (minutes.length > 0) return Math.max(...minutes) / 60;
  const value = finite(tree.missionTime);
  return value === undefined || !(value > 0) ? undefined : value * unitHours(tree.missionTimeUnits);
}

function esTreeRecords(es: EventSequenceAnalysis): EsqTreeRecord[] {
  const byId = new Map((es.eventTrees ?? []).map((tree) => [tree.uuid, tree]));
  return treeRecords(esTreeSource(es)).map((record) => {
    const tree = byId.get(record.id);
    const hours = tree === undefined ? undefined : esMissionHours(es, tree);
    return hours === undefined ? record : { ...record, esMissionTime: legacyExpression("HOURS", hours) };
  });
}

function floorField(hr: HumanReliabilityAnalysis): { jointFloor?: EsqJointFloorRecord } {
  const floor = jointFloorRecord(hr);
  return floor === undefined ? {} : { jointFloor: floor };
}

function typedInitiatorsOf(esq: EventSequenceQuantification): EsqTypedInitiator[] {
  return esq.modelDecisions?.typedInitiators ?? [];
}

function withMergedInitiators(model: EsqModel, esq: EventSequenceQuantification): EsqModel {
  const typed = typedInitiatorsOf(esq).map((entry): EsqInitiatorRecord => {
    const { synced: _synced, ieOwned: _ieOwned, ...record } = entry;
    return { ...record, typed: true };
  });
  const imported = model.initiators.filter((record) => record.typed !== true && !typed.some((entry) => sameItem(entry.id, record.id)));
  return { ...model, initiators: [...imported, ...typed] };
}

function esqLinkOf(esq: Pick<EventSequenceQuantification, "linkedWorkbooks">, element: EsqLinkCode): string | undefined {
  const id = esq.linkedWorkbooks?.[element];
  return id === undefined || id.length === 0 ? undefined : id;
}

function esqModelSourceLoaded(sources: EsqModelSources, element: EsqModelElement): boolean {
  switch (element) {
    case "ES": return sources.es !== undefined;
    case "SY": return sources.sy !== undefined;
    case "DA": return sources.da !== undefined;
    case "HRA": return sources.hr !== undefined;
    case "IE": return sources.ie !== undefined;
    case "POS": return sources.pos !== undefined;
    case "SC": return sources.sc !== undefined;
  }
}

function esqModelSourceList(esq: EventSequenceQuantification, sources: EsqModelSources, nameOf: (element: EsqModelElement, workbookId: string) => string): EsqModelSource[] {
  return ESQ_MODEL_SOURCE_ELEMENTS.flatMap((element): EsqModelSource[] => {
    const workbookId = esqLinkOf(esq, element);
    if (workbookId === undefined || !esqModelSourceLoaded(sources, element)) return [];
    return [{ element, workbookId, workbookName: nameOf(element, workbookId) }];
  });
}

function esqModelFrom(esq: EventSequenceQuantification, sources: EsqModelSources, nameOf: (element: EsqModelElement, workbookId: string) => string): EsqModel {
  const es = esqLinkOf(esq, "ES") === undefined ? undefined : sources.es;
  const sy = esqLinkOf(esq, "SY") === undefined ? undefined : sources.sy;
  const da = esqLinkOf(esq, "DA") === undefined ? undefined : sources.da;
  const hr = esqLinkOf(esq, "HRA") === undefined ? undefined : sources.hr;
  const ie = esqLinkOf(esq, "IE") === undefined ? undefined : sources.ie;
  const pos = esqLinkOf(esq, "POS") === undefined ? undefined : sources.pos;
  const sc = esqLinkOf(esq, "SC") === undefined ? undefined : sources.sc;
  const parameterIds = new Set((da?.parameters ?? []).map((parameter) => parameter.uuid));
  const hfeIds = new Set((hr?.humanFailureEvents ?? []).map((event) => event.uuid));
  const source = es === undefined ? undefined : esTreeSource(es);
  const sequences = source === undefined ? [] : sequenceRecords(source);
  return {
    sources: esqModelSourceList(esq, sources, nameOf),
    trees: es === undefined ? [] : esTreeRecords(es),
    sequences,
    families: source === undefined ? [] : familyRecords(source, sequences),
    functions: source === undefined ? [] : functionRecords(source),
    tops: sy === undefined ? [] : topRecords(sy),
    initiators: ie === undefined ? [] : initiatorRecords(ie),
    states: pos === undefined ? [] : stateRecords(pos),
    events: sy === undefined ? [] : eventRecords(sy, parameterIds, hfeIds),
    ccfGroups: sy === undefined ? [] : ccfRecords(sy),
    parameters: da === undefined ? [] : esqParameterLinks(da),
    humanEvents: hr === undefined ? [] : humanRecords(hr),
    barriers: pos === undefined ? [] : barrierRecords(pos),
    criteria: sc === undefined ? [] : criterionRecords(sc),
    impacts: ie === undefined ? [] : impactRecords(ie),
    phenomena: es === undefined ? [] : phenomenonRecords(es),
    qualifications: sy === undefined ? [] : qualificationRecords(sy),
    actions: hr === undefined ? [] : actionRecords(hr),
    recoveries: hr === undefined ? [] : recoveryRecords(hr),
    repairs: es === undefined ? [] : repairRecords(es),
    dependencies: hr === undefined ? [] : dependencyRecords(hr),
    ...(hr === undefined ? {} : floorField(hr)),
  };
}

function withTypedRecords(model: EsqModel, esq: EventSequenceQuantification): EsqModel {
  const typedTrees = typedTreesOf(esq);
  const stale = new Set(model.trees.filter((tree) => tree.typed === true).map((tree) => tree.id));
  for (const tree of typedTrees) stale.add(tree.uuid);
  const keptTrees = model.trees.filter((tree) => !stale.has(tree.id));
  const keptSequences = model.sequences.filter((sequence) => !stale.has(sequence.treeId));
  const functions = model.functions.flatMap((record): EsqFunctionRecord[] => {
    const treeIds = record.treeIds.filter((id) => !stale.has(id));
    return treeIds.length === 0 ? [] : [{ ...record, treeIds, esLinks: record.esLinks.filter((link) => !stale.has(link.treeId)) }];
  });
  const source = typedTreeSource(esq);
  const trees = treeRecords(source).map((tree): EsqTreeRecord => ({ ...tree, typed: true }));
  for (const record of functionRecords(source)) {
    const index = functions.findIndex((entry) => entry.id === record.id);
    const known = functions[index];
    if (known === undefined) functions.push(record);
    else functions[index] = { ...known, treeIds: [...known.treeIds, ...record.treeIds], esLinks: [...known.esLinks, ...record.esLinks] };
  }
  return withMergedInitiators({ ...model, trees: [...keptTrees, ...trees], sequences: [...keptSequences, ...sequenceRecords(source)], functions }, esq);
}

function esqTreeMissionTimesOf(esq: EventSequenceQuantification): EsqTreeMissionTime[] {
  const own = esq.modelDecisions?.treeMissionTimes ?? [];
  const copied = (esq.model?.trees ?? []).flatMap((tree): EsqTreeMissionTime[] => (tree.missionTime === undefined || own.some((entry) => entry.treeId === tree.id) ? [] : [{ treeId: tree.id, missionTime: tree.missionTime }]));
  return [...own, ...copied];
}

function withTreeMissionTimes(model: EsqModel, missionTimes: readonly EsqTreeMissionTime[]): EsqModel {
  if (missionTimes.length === 0) return model;
  return {
    ...model,
    trees: model.trees.map((tree) => {
      const missionTime = missionTimes.find((entry) => entry.treeId === tree.id)?.missionTime;
      return missionTime === undefined ? tree : { ...tree, missionTime };
    }),
  };
}

function esqModelHasSources(esq: EventSequenceQuantification): boolean {
  return ESQ_MODEL_SOURCE_ELEMENTS.some((element) => esqLinkOf(esq, element) !== undefined) || typedTreesOf(esq).length > 0 || typedInitiatorsOf(esq).length > 0;
}

function esqLiveModel(esq: EventSequenceQuantification, sources: EsqModelSources, nameOf: (element: EsqModelElement, workbookId: string) => string): EsqModel | undefined {
  if (!esqModelHasSources(esq)) return undefined;
  return withTreeMissionTimes(withTypedRecords(esqModelFrom(esq, sources, nameOf), esq), esqTreeMissionTimesOf(esq));
}

export {
  ESQ_MODEL_SOURCE_ELEMENTS,
  blank,
  esqLinkOf,
  esqLiveModel,
  esqModelFrom,
  esqModelHasSources,
  esqModelSourceLoaded,
  esqTreeMissionTimesOf,
  finite,
  ieGroupRecord,
  textOf,
  texts,
  topRecords,
  transferEntryInitiators,
  typedInitiatorsOf,
  typedTreesOf,
  unique,
  withMergedInitiators,
  withTreeMissionTimes,
  withTypedRecords,
  type EsqModelSources,
};
