import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EventSequenceAnalysis, EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import type { CommonCauseFailureGroup, SystemsAnalysis, SystemLogicModel } from "interfaces-mef-types/sy/systems-analysis";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import type { PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { DistributionType, EndState, FrequencyUnit } from "interfaces-mef-types/core/events";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { EMPTY_UPSTREAM, type EsqUpstream } from "../esqLinks";
import { liveEsqOf, withModelImported } from "../esqModel";
import { blankEsq } from "./esqFixtures";

function tree(id: string, initiator: string, state: string, events: { id: string; label: string; name: string; top?: string }[], sequences: { id: string; states: Record<string, "SUCCESS" | "FAILURE">; end?: EndState }[], transfers: Record<string, { targetEventTreeId: string; preservedDependencies?: string[] }> = {}): EventTree {
  return {
    uuid: id,
    name: `${id} tree`,
    initiatingEventId: initiator,
    plantOperatingStateId: state,
    missionTime: 72,
    missionTimeUnits: "h",
    functionalEvents: Object.fromEntries(events.map((event, order) => [event.id, {
      uuid: event.id,
      name: event.name,
      label: event.label,
      order,
      ...(event.top === undefined ? {} : { faultTreeTopEvent: { referenceType: "FAULT_TREE_TOP_EVENT" as const, workbookId: "sy-1", modelId: `M-${event.top}`, entityId: `G-${event.top}` } }),
    }])),
    sequences: Object.fromEntries(sequences.map((sequence) => [sequence.id, {
      uuid: sequence.id,
      name: sequence.id,
      eventSequenceId: sequence.id,
      functionalEventStates: sequence.states,
      ...(sequence.end === undefined ? {} : { endState: sequence.end }),
    }])),
    branches: {},
    initialState: { branchId: "" },
    transfers,
    implementsSrs: [],
  } as EventTree;
}

const ES = {
  scopeDefinition: { plantOperatingStateIds: ["POS-01", "POS-02"], initiatingEventIds: ["IEG-01"] },
  eventTrees: [
    tree("ET-A", "IEG-01", "POS-01", [{ id: "RT", label: "RT", name: "Reactor trip" }, { id: "FE-COOL", label: "COOL", name: "Cooling", top: "COOL" }], [
      { id: "A-1", states: { RT: "SUCCESS", "FE-COOL": "SUCCESS" }, end: EndState.SUCCESSFUL_MITIGATION },
      { id: "A-2", states: { RT: "SUCCESS", "FE-COOL": "FAILURE" }, end: EndState.RADIONUCLIDE_RELEASE },
      { id: "A-3", states: { RT: "FAILURE" } },
    ], { "A-3": { targetEventTreeId: "ET-T", preservedDependencies: ["Trip failed"] } }),
    tree("ET-B", "IEG-01", "POS-02", [{ id: "FE-COOL", label: "COOL", name: "Cooling" }], [
      { id: "B-1", states: { "FE-COOL": "SUCCESS" }, end: EndState.SUCCESSFUL_MITIGATION },
      { id: "B-2", states: { "FE-COOL": "FAILURE" }, end: EndState.RADIONUCLIDE_RELEASE },
    ]),
    tree("ET-T", "ATWS-ENTRY", "POS-01", [{ id: "FE-COOL", label: "COOL", name: "Cooling", top: "COOL" }], [
      { id: "T-1", states: { "FE-COOL": "SUCCESS" }, end: EndState.SUCCESSFUL_MITIGATION },
      { id: "T-2", states: { "FE-COOL": "FAILURE" }, end: EndState.RADIONUCLIDE_RELEASE },
    ]),
  ],
  eventSequences: [
    { uuid: "A-1", name: "A-1", initiatingEventId: "IEG-01", plantOperatingStateId: "POS-01", eventTreeId: "ET-A", endState: EndState.SUCCESSFUL_MITIGATION, sequenceFamilyId: "F-OK" },
    { uuid: "A-2", name: "A-2", initiatingEventId: "IEG-01", plantOperatingStateId: "POS-01", eventTreeId: "ET-A", endState: EndState.RADIONUCLIDE_RELEASE, sequenceFamilyId: "F-REL", releaseCategoryId: "RC-1" },
    { uuid: "A-3", name: "A-3", initiatingEventId: "IEG-01", plantOperatingStateId: "POS-01", eventTreeId: "ET-A", endState: EndState.RADIONUCLIDE_RELEASE, sequenceFamilyId: "F-REL" },
    { uuid: "B-1", name: "B-1", initiatingEventId: "IEG-01", plantOperatingStateId: "POS-02", eventTreeId: "ET-B", endState: EndState.SUCCESSFUL_MITIGATION, sequenceFamilyId: "F-OK" },
    { uuid: "B-2", name: "B-2", initiatingEventId: "IEG-01", plantOperatingStateId: "POS-02", eventTreeId: "ET-B", endState: EndState.RADIONUCLIDE_RELEASE, sequenceFamilyId: "F-REL", releaseCategoryId: "RC-1" },
    { uuid: "T-1", name: "T-1", initiatingEventId: "ATWS-ENTRY", plantOperatingStateId: "POS-01", eventTreeId: "ET-T", endState: EndState.SUCCESSFUL_MITIGATION, sequenceFamilyId: "F-OK" },
    { uuid: "T-2", name: "T-2", initiatingEventId: "ATWS-ENTRY", plantOperatingStateId: "POS-01", eventTreeId: "ET-T", endState: EndState.RADIONUCLIDE_RELEASE, sequenceFamilyId: "F-REL", releaseCategoryId: "RC-1" },
  ],
  eventSequenceFamilies: [
    { uuid: "F-OK", name: "Safe", groupingCriteriaId: "G", representativeInitiatingEventId: "IEG-01", representativePlantOperatingStateId: "POS-01", representativePlantResponse: "", memberSequenceIds: ["A-1", "B-1", "T-1"], endState: EndState.SUCCESSFUL_MITIGATION },
    { uuid: "F-REL", name: "Release", groupingCriteriaId: "G", representativeInitiatingEventId: "IEG-01", representativePlantOperatingStateId: "POS-01", representativePlantResponse: "", memberSequenceIds: ["A-2", "A-3", "B-2", "T-2"], endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryIds: ["RC-1"] },
  ],
} as EventSequenceAnalysis;

function model(id: string, system: string, events: string[], transfers: string[] = []): SystemLogicModel {
  return {
    uuid: `M-${id}`,
    code: `${id}-TOP`,
    name: `${id} fails`,
    systemReference: system,
    description: "",
    modelRepresentation: "",
    topGate: { gateId: `G-${id}` },
    gates: [],
    leafNodes: [
      ...events.map((event) => ({ id: `L-${event}`, kind: "BASIC_EVENT_REFERENCE" as const, basicEventId: event })),
      ...transfers.map((target) => ({ id: `X-${target}`, kind: "TRANSFER_REFERENCE" as const, code: target, name: target, description: "", target: { modelId: `M-${target}`, entityId: `G-${target}` } })),
    ],
    gateInputs: [],
    nodePositions: [],
    layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    implementsSrs: [],
  } as SystemLogicModel;
}

const NO_GROUPS: CommonCauseFailureGroup[] = [];

const PUMP_ESTIMATE: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "TRUNCATED", law: { family: "LOGNORMAL", mean: 2e-3, errorFactor: 5, level: 0.95 }, lower: null, upper: 1 } } };

const FAN_RATE_ESTIMATE: UncertainExpression = { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "LOGNORMAL", mean: 2e-5, errorFactor: 3, level: 0.95 } } };

function daParameter(id: string): UncertainExpression {
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: id } };
}

function fanMission(rate: UncertainExpression): UncertainExpression {
  return { node: "MODEL", model: { form: "MISSION", rate, missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } } } };
}

const FAN_TYPED: UncertainExpression = fanMission({ node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 2e-5 } } });

const DIVISION_TYPED: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 1e-4 } } };

const SY = {
  systemDefinitions: [
    { uuid: "SYS-COOL", name: "Cooling system", abbreviation: "COOL", modeledComponentsAndFailures: {} },
    { uuid: "SYS-SUP", name: "Support system", abbreviation: "SUP", missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } }, modeledComponentsAndFailures: {} },
    { uuid: "SYS-RPS", name: "Protection system", abbreviation: "RPS", modeledComponentsAndFailures: {} },
  ],
  systemLogicModels: [model("COOL", "SYS-COOL", ["E-1"], ["SUP"]), model("SUP", "SYS-SUP", ["E-2", "E-3"]), model("RPS", "SYS-RPS", ["E-4"])],
  systemBasicEvents: [
    { uuid: "E-1", code: "COOL-PMP-FS", name: "Pump fails to start", failureMode: "FAILURE_TO_START", expression: daParameter("P-1") },
    { uuid: "E-2", code: "SUP-HFE", name: "Operator fails to align", probability: 1e-3, failureMode: "HUMAN_ERROR", dataAnalysisBasicEventRef: "HFE-1" },
    { uuid: "E-3", code: "SUP-FAN-FR", name: "Fan fails to run", failureMode: "FAILURE_TO_RUN", expression: FAN_TYPED },
    { uuid: "E-4", code: "RPS-DIV-FS", name: "Division fails to trip", failureMode: "FAILURE_TO_START", expression: DIVISION_TYPED },
  ],
  commonCauseFailureGroups: NO_GROUPS,
} as SystemsAnalysis;

const DA = {
  parameters: [
    { uuid: "P-1", name: "Pump fails to start", parameterType: "PROBABILITY", quantificationModel: "DEMAND_PROBABILITY", estimate: PUMP_ESTIMATE, evidenceKind: "GENERIC_NUCLEAR" },
    { uuid: "P-IE", name: "Loss of cooling", parameterType: "FREQUENCY", quantificationModel: "FREQUENCY", estimate: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 3 } } } },
    { uuid: "P-PT", name: "Division fails to trip", parameterType: "PROBABILITY", quantificationModel: "DEMAND_PROBABILITY", estimate: DIVISION_TYPED },
    { uuid: "P-FR", name: "Fan fails to run", parameterType: "FAILURE_RATE", quantificationModel: "RUNNING_RATE", estimate: FAN_RATE_ESTIMATE },
    { uuid: "P-SF", name: "Shutdown cooling demand", parameterType: "PROBABILITY", value: 0.01, valueType: "MEAN", uncertainty: { distribution: { type: DistributionType.LOGNORMAL, median: 8e-3, errorFactor: 3 } } },
  ],
} as DataAnalysis;

const HR = {
  humanFailureEvents: [{ uuid: "HFE-1", name: "Operator fails to align", applicablePlantOperatingStates: ["POS-01"] }],
  hepQuantifications: [{ uuid: "Q-1", hfeId: "HFE-1", methodology: "THERP", assessmentType: "DETAILED_ASSESSMENT", isRiskSignificant: false, hep: { node: "VALUE" as const, value: { unit: "PROBABILITY" as const, law: { family: "POINT" as const, value: 1e-3 } } } }],
} as HumanReliabilityAnalysis;

const IE = {
  initiatingEventGroups: [{
    uuid: "IEG-01",
    name: "Loss of cooling",
    applicableStates: ["POS-01", "POS-02"],
    frequency: { expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 2.943, errorFactor: 2.3, level: 0.95 } } }, basis: FrequencyUnit.PER_PLANT_YEAR },
  }],
} as InitiatingEventsAnalysis;

const POS = {
  plantOperatingStates: [
    { uuid: "POS-01", name: "Full power", meanDurationHours: 7300 },
    { uuid: "POS-02", name: "Shutdown", meanDurationHours: 594 },
  ],
} as PlantOperatingStatesAnalysis;

function modelUpstream(): EsqUpstream {
  return { ...EMPTY_UPSTREAM, es: structuredClone(ES), sy: structuredClone(SY), da: structuredClone(DA), hr: structuredClone(HR), ie: structuredClone(IE), pos: structuredClone(POS) };
}

function linkedEsq(): EventSequenceQuantification {
  return { ...blankEsq(), linkedWorkbooks: { ES: "es-1", SY: "sy-1", DA: "da-1", HRA: "hr-1", IE: "ie-1", POS: "pos-1" } };
}

function liveImport(esq: EventSequenceQuantification, upstream: EsqUpstream, now: string): EventSequenceQuantification {
  return liveEsqOf(withModelImported(esq, upstream, now), upstream.da);
}

export { PUMP_ESTIMATE, daParameter, fanMission, linkedEsq, liveImport, modelUpstream };
