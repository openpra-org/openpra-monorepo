import { createBlankIe } from "../../ie-workbooks/blank-ie";
import { createBlankSy } from "../../sy-workbooks/blank-sy";
import { createBlankEs } from "../../es-workbooks/blank-es";
import { createBlankEsq } from "../../esq-workbooks/blank-esq";
import { createBlankDa } from "../../da-workbooks/blank-da";
import { createBlankHr } from "../../hr-workbooks/blank-hr";
import { createBlankRc } from "../../rc-workbooks/blank-rc";
import { createBlankRi } from "../../ri-workbooks/blank-ri";
import type {
  InitiatingEventFrequencyQuantification,
  InitiatingEventGroup,
  InitiatorDefinition,
} from "interfaces-mef-types/ie/initiating-event-analysis";
import { InitiatingEventCategory, BarrierImpactState } from "interfaces-mef-types/ie/initiating-event-analysis";
import type {
  SystemBasicEvent,
  SystemDefinition,
  SystemLogicModel,
} from "interfaces-mef-types/sy/systems-analysis";
import type {
  EventSequence,
  EventSequenceAnalysis,
  EventSequenceFamily,
  EventTree,
  FunctionalEvent,
  SystemStatus,
} from "interfaces-mef-types/es/event-sequence-analysis";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { DependencyType } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EsqBayesianNetwork, EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type {
  BayesianNetworkChanceNode,
  BayesianNetworkConditionalProbabilityTable,
  FaultTreeGate,
  FaultTreeGateInput,
  FaultTreeLeafNode,
  FaultTreeNodePosition,
} from "interfaces-mef-types/modeling";
import { DistributionType, EndState, FrequencyUnit } from "interfaces-mef-types/core/events";
import { ImportanceLevel, ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";

const NOW = "2026-08-24T12:00:00.000Z";
const OWNER = "hcl-case-study";
const LOOP_FREQUENCY = 0.837;

const HCL_CASE_IE_UUID = "ie-hcl-case-study";
const HCL_CASE_SY_UUID = "sy-hcl-case-study";
const HCL_CASE_DA_UUID = "da-hcl-case-study";
const HCL_CASE_HR_UUID = "hr-hcl-case-study";
const HCL_CASE_ES_UUID = "es-hcl-case-study";
const HCL_CASE_ESQ_UUID = "esq-hcl-case-study";
const HCL_CASE_RC_UUID = "rc-hcl-case-study";
const HCL_CASE_RI_UUID = "ri-hcl-case-study";
const HCL_CASE_ID = "hcl";
const HCL_CASE_LABEL = "HCL dissertation case study";

const PLACEHOLDER_SY_WORKBOOK_ID = "example-sy-hcl-case-study";
const PLACEHOLDER_DA_WORKBOOK_ID = "example-da-hcl-case-study";
const PLACEHOLDER_HR_WORKBOOK_ID = "example-hr-hcl-case-study";
const PLACEHOLDER_ESQ_WORKBOOK_ID = "example-esq-hcl-case-study";
const PLACEHOLDER_ES_WORKBOOK_ID = "example-es-hcl-case-study";
const PLACEHOLDER_RC_WORKBOOK_ID = "example-rc-hcl-case-study";
const PLACEHOLDER_RI_WORKBOOK_ID = "example-ri-hcl-case-study";

function id(group: number, index: number): string {
  return `${(0xd15c0000 + group).toString(16).padStart(8, "0")}-cafe-4a10-8b00-${index.toString(16).padStart(12, "0")}`;
}

const HCL_HFE_IDS = {
  feedBleed: id(5, 1),
  cooldown: id(5, 2),
} as const;

const MODEL_KEYS = [
  "EPS",
  "ACP_4160_A",
  "ACP_4160_B",
  "RPS",
  "AFW",
  "AFW_SG_A",
  "AFW_SG_B",
  "PORV_B",
  "RCP_SEAL_LOCA",
  "HPI",
  "FEED_BLEED",
  "OPR_02H",
  "DGR_08H",
  "COOLDOWN",
  "RHR",
  "HPR",
  "FLEX_DETAIL",
  "FLEX_SG_PUMP",
  "FLEX_MAKEUP",
  "AFW_MANUAL",
  "OPR_24H",
  "DGR_72H",
] as const;

type ModelKey = typeof MODEL_KEYS[number];

const MODEL_META: Record<ModelKey, { code: string; name: string }> = {
  EPS: { code: "EPS-FT", name: "Emergency AC power system" },
  ACP_4160_A: { code: "ACP-4160-A-FT", name: "Failure of 4160 V AC Bus A" },
  ACP_4160_B: { code: "ACP-4160-B-FT", name: "Failure of 4160 V AC Bus B" },
  RPS: { code: "RPS-FT", name: "Reactor trip / reactor protection system" },
  AFW: { code: "AFW-FT", name: "Auxiliary feedwater system" },
  AFW_SG_A: { code: "AFW-SG-A", name: "No flow from AFW to steam generator A" },
  AFW_SG_B: { code: "AFW-SG-B", name: "No flow from AFW to steam generator B" },
  PORV_B: { code: "PORV-B-FT", name: "PORV-B path unavailable" },
  RCP_SEAL_LOCA: { code: "RCPSLOCA-FT", name: "RCP seal LOCA / seal cooling unavailable" },
  HPI: { code: "HPI-FT", name: "High-pressure injection unavailable" },
  FEED_BLEED: { code: "FNB-FT", name: "Feed-and-bleed operation fails" },
  OPR_02H: { code: "OPR-02H-FT", name: "Offsite power not recovered within 2 hours" },
  DGR_08H: { code: "DGR-08H-FT", name: "Diesel generator not recovered within 8 hours" },
  COOLDOWN: { code: "SBC-FT", name: "Primary and secondary cooldown fails" },
  RHR: { code: "RHR-FT", name: "Residual heat removal unavailable" },
  HPR: { code: "HPR-FT", name: "High-pressure recirculation unavailable" },
  FLEX_DETAIL: { code: "FLEX-600", name: "FLEX details are not operable and connected" },
  FLEX_SG_PUMP: { code: "FLEX-SGP", name: "FLEX steam-generator pump unavailable" },
  FLEX_MAKEUP: { code: "FLEX-MUP", name: "Boron injection and SG makeup unavailable" },
  AFW_MANUAL: { code: "AFW-MAN-TOP", name: "Long-term manual AFW control fails" },
  OPR_24H: { code: "OPR-24H", name: "AC power not recovered within 24 hours" },
  DGR_72H: { code: "DGR-72H", name: "AC power not recovered within 72 hours" },
};

const MODEL_IDS = Object.fromEntries(MODEL_KEYS.map((key, index) => [key, id(10, index + 1)])) as Record<ModelKey, string>;
const TOP_GATE_IDS = Object.fromEntries(MODEL_KEYS.map((key, index) => [key, id(11, index + 1)])) as Record<ModelKey, string>;

const BASIC_EVENT_KEYS = [
  "EPS_A_DEP",
  "EPS_B_DEP",
  "RPS_DEP",
  "AFW_DEP",
  "PORV_DEP",
  "SEAL_DEP",
  "HPI_DEP",
  "FLEX_POWER_DEP",
  "FLEX_WATER_DEP",
  "RECOVERY_DEP",
  "EPS_A_RANDOM",
  "EPS_B_RANDOM",
  "RPS_RANDOM",
  "AFW_RANDOM",
  "AFW_CCF",
  "PORV_RANDOM",
  "SEAL_RANDOM",
  "HPI_RANDOM",
  "FEED_BLEED_RANDOM",
  "COOLDOWN_RANDOM",
  "RHR_RANDOM",
  "HPR_RANDOM",
  "FLEX_POWER_RANDOM",
  "FLEX_WATER_RANDOM",
  "RECOVERY_RANDOM",
] as const;

type BasicEventKey = typeof BASIC_EVENT_KEYS[number];

const BASIC_EVENT_IDS = Object.fromEntries(BASIC_EVENT_KEYS.map((key, index) => [key, id(20, index + 1)])) as Record<BasicEventKey, string>;

const BASIC_EVENT_META: Record<BasicEventKey, { code: string; name: string; probability: number }> = {
  EPS_A_DEP: { code: "ACP-4160-A-DEP", name: "Bus A failure under the shared hazard and support context", probability: 1.5e-3 },
  EPS_B_DEP: { code: "ACP-4160-B-DEP", name: "Bus B failure under the shared hazard and support context", probability: 1.5e-3 },
  RPS_DEP: { code: "RPS-DEP", name: "Reactor protection failure under the shared hazard context", probability: 2e-5 },
  AFW_DEP: { code: "AFW-DEP", name: "Auxiliary feedwater failure under the shared hazard context", probability: 8e-4 },
  PORV_DEP: { code: "PORV-B-DEP", name: "PORV-B failure under the shared hazard context", probability: 5e-4 },
  SEAL_DEP: { code: "RCP-SEAL-DEP", name: "RCP seal cooling failure under the shared hazard context", probability: 7e-4 },
  HPI_DEP: { code: "HPI-DEP", name: "High-pressure injection failure under the shared hazard context", probability: 9e-4 },
  FLEX_POWER_DEP: { code: "FLEX-PWR-DEP", name: "FLEX electrical support failure under the shared hazard context", probability: 1.1e-3 },
  FLEX_WATER_DEP: { code: "FLEX-WATER-DEP", name: "FLEX water and makeup support failure under the shared hazard context", probability: 1.2e-3 },
  RECOVERY_DEP: { code: "RECOVERY-DEP", name: "Grid and diesel recovery failure under the shared hazard context", probability: 2e-3 },
  EPS_A_RANDOM: { code: "ACP-4160-A-RND", name: "Independent random failure of 4160 V AC Bus A", probability: 2e-4 },
  EPS_B_RANDOM: { code: "ACP-4160-B-RND", name: "Independent random failure of 4160 V AC Bus B", probability: 2e-4 },
  RPS_RANDOM: { code: "RPS-RND", name: "Independent reactor trip hardware failure", probability: 5e-6 },
  AFW_RANDOM: { code: "AFW-RND", name: "Independent auxiliary feedwater train failure", probability: 2e-4 },
  AFW_CCF: { code: "MFW-CKV-CF-CC", name: "Common-cause failure of feedwater discharge check valves", probability: 1.214e-7 },
  PORV_RANDOM: { code: "PORV-B-RND", name: "Independent PORV-B path failure", probability: 1e-4 },
  SEAL_RANDOM: { code: "RCP-SEAL-RND", name: "Independent RCP seal cooling failure", probability: 2e-4 },
  HPI_RANDOM: { code: "HPI-RND", name: "Independent high-pressure injection failure", probability: 2e-4 },
  FEED_BLEED_RANDOM: { code: "FNB-HFE", name: "Operator fails to initiate feed-and-bleed", probability: 3e-4 },
  COOLDOWN_RANDOM: { code: "SBC-HFE", name: "Operator fails to establish primary and secondary cooldown", probability: 1e-4 },
  RHR_RANDOM: { code: "RHR-RND", name: "Independent residual heat removal failure", probability: 2e-4 },
  HPR_RANDOM: { code: "HPR-RND", name: "Independent high-pressure recirculation failure", probability: 2e-4 },
  FLEX_POWER_RANDOM: { code: "FLEX-PWR-RND", name: "Independent FLEX electrical support failure", probability: 2e-4 },
  FLEX_WATER_RANDOM: { code: "FLEX-WATER-RND", name: "Independent FLEX water support failure", probability: 2e-4 },
  RECOVERY_RANDOM: { code: "RECOVERY-RND", name: "Independent failure of grid or diesel recovery", probability: 4e-4 },
};

const HUMAN_BASIC_EVENT_META: Partial<Record<BasicEventKey, {
  hfeId: string;
  quantificationId: string;
}>> = {
  FEED_BLEED_RANDOM: {
    hfeId: HCL_HFE_IDS.feedBleed,
    quantificationId: `HEPQ-${HCL_HFE_IDS.feedBleed}`,
  },
  COOLDOWN_RANDOM: {
    hfeId: HCL_HFE_IDS.cooldown,
    quantificationId: `HEPQ-${HCL_HFE_IDS.cooldown}`,
  },
};

const systemBasicEvents: SystemBasicEvent[] = BASIC_EVENT_KEYS.map((key) => {
  const human = HUMAN_BASIC_EVENT_META[key];
  return {
    uuid: BASIC_EVENT_IDS[key],
    code: BASIC_EVENT_META[key].code,
    name: BASIC_EVENT_META[key].name,
    eventType: "BASIC",
    failureMode: human === undefined ? "OTHER" : "HUMAN_ERROR",
    probability: BASIC_EVENT_META[key].probability,
    controlledDataSource: human === undefined
      ? {
          referenceType: "WORKBOOK_PARAMETER",
          workbookId: PLACEHOLDER_DA_WORKBOOK_ID,
          entityId: BASIC_EVENT_IDS[key],
        }
      : {
          referenceType: "HUMAN_FAILURE_EVENT",
          workbookId: PLACEHOLDER_HR_WORKBOOK_ID,
          entityId: human.hfeId,
          quantificationId: human.quantificationId,
        },
    ...(human === undefined
      ? {}
      : { attributes: [{ name: "hfeReference", value: human.hfeId }] }),
    repairModeled: false,
    implementsSrs: [],
  };
});

const MODEL_EVENTS: Record<ModelKey, BasicEventKey[]> = {
  EPS: [],
  ACP_4160_A: ["EPS_A_DEP", "EPS_A_RANDOM"],
  ACP_4160_B: ["EPS_B_DEP", "EPS_B_RANDOM"],
  RPS: ["RPS_DEP", "RPS_RANDOM"],
  AFW: ["AFW_CCF"],
  AFW_SG_A: ["AFW_DEP", "AFW_RANDOM"],
  AFW_SG_B: ["AFW_DEP", "AFW_RANDOM"],
  PORV_B: ["PORV_DEP", "PORV_RANDOM"],
  RCP_SEAL_LOCA: ["SEAL_DEP", "SEAL_RANDOM"],
  HPI: ["HPI_DEP", "HPI_RANDOM"],
  FEED_BLEED: ["HPI_DEP", "FEED_BLEED_RANDOM"],
  OPR_02H: ["RECOVERY_DEP", "RECOVERY_RANDOM"],
  DGR_08H: ["RECOVERY_DEP", "RECOVERY_RANDOM"],
  COOLDOWN: ["HPI_DEP", "COOLDOWN_RANDOM"],
  RHR: ["FLEX_WATER_DEP", "RHR_RANDOM"],
  HPR: ["HPI_DEP", "HPR_RANDOM"],
  FLEX_DETAIL: ["FLEX_POWER_DEP", "FLEX_POWER_RANDOM"],
  FLEX_SG_PUMP: ["FLEX_WATER_DEP", "FLEX_WATER_RANDOM"],
  FLEX_MAKEUP: ["FLEX_WATER_DEP", "FLEX_WATER_RANDOM"],
  AFW_MANUAL: ["AFW_DEP", "AFW_RANDOM"],
  OPR_24H: ["RECOVERY_DEP", "RECOVERY_RANDOM"],
  DGR_72H: ["RECOVERY_DEP", "RECOVERY_RANDOM"],
};

function gateIdentity(key: ModelKey, gateId = TOP_GATE_IDS[key], suffix = "TOP"): FaultTreeGate {
  return {
    id: gateId,
    kind: "GATE",
    gateType: "OR",
    code: suffix === "TOP" ? MODEL_META[key].code : `${MODEL_META[key].code}-${suffix}`,
    name: suffix === "TOP" ? MODEL_META[key].name : suffix,
    description: suffix === "TOP" ? MODEL_META[key].name : suffix,
  };
}

function directFaultTree(key: ModelKey, index: number): SystemLogicModel {
  const gate = gateIdentity(key);
  const leaves: FaultTreeLeafNode[] = MODEL_EVENTS[key].map((eventKey, eventIndex) => ({
    id: id(40 + index, eventIndex + 1),
    kind: "BASIC_EVENT_REFERENCE",
    basicEventId: BASIC_EVENT_IDS[eventKey],
  }));
  const gateInputs: FaultTreeGateInput[] = leaves.map((leaf, order) => ({
    id: id(70 + index, order + 1),
    gateId: gate.id,
    childId: leaf.id,
    order,
  }));
  const nodePositions: FaultTreeNodePosition[] = [
    { nodeId: gate.id, position: { x: 360, y: 40 } },
    ...leaves.map((leaf, order) => ({ nodeId: leaf.id, position: { x: 250 + order * 220, y: 230 } })),
  ];
  return {
    uuid: MODEL_IDS[key],
    code: MODEL_META[key].code,
    name: MODEL_META[key].name,
    systemReference: `SYS-${MODEL_META[key].code}`,
    description: MODEL_META[key].name,
    modelRepresentation: "FAULT_TREE",
    topGate: { gateId: gate.id },
    gates: [gate],
    leafNodes: leaves,
    gateInputs,
    nodePositions,
    layout: { viewport: { x: 0, y: 0, zoom: 0.9 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    implementsSrs: [],
  };
}

function transferLeaf(sourceKey: ModelKey, targetKey: ModelKey, index: number): FaultTreeLeafNode {
  return {
    id: id(120 + MODEL_KEYS.indexOf(sourceKey), index),
    kind: "TRANSFER_REFERENCE",
    code: `XFER-${MODEL_META[targetKey].code}`,
    name: MODEL_META[targetKey].name,
    description: `Transfer to ${MODEL_META[targetKey].code}`,
    target: { modelId: MODEL_IDS[targetKey], entityId: TOP_GATE_IDS[targetKey] },
  };
}

function epsFaultTree(): SystemLogicModel {
  const key: ModelKey = "EPS";
  const top: FaultTreeGate = { ...gateIdentity(key), gateType: "AND" };
  const leaves = [transferLeaf(key, "ACP_4160_A", 1), transferLeaf(key, "ACP_4160_B", 2)];
  return {
    uuid: MODEL_IDS[key], code: MODEL_META[key].code, name: MODEL_META[key].name,
    systemReference: `SYS-${MODEL_META[key].code}`, description: MODEL_META[key].name,
    modelRepresentation: "FAULT_TREE", topGate: { gateId: top.id }, gates: [top], leafNodes: leaves,
    gateInputs: leaves.map((leaf, order) => ({ id: id(150, order + 1), gateId: top.id, childId: leaf.id, order })),
    nodePositions: [
      { nodeId: top.id, position: { x: 360, y: 40 } },
      { nodeId: leaves[0]!.id, position: { x: 240, y: 230 } },
      { nodeId: leaves[1]!.id, position: { x: 480, y: 230 } },
    ],
    layout: { viewport: { x: 0, y: 0, zoom: 0.9 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    implementsSrs: [],
  };
}

function afwFaultTree(): SystemLogicModel {
  const key: ModelKey = "AFW";
  const top = gateIdentity(key);
  const bothPathsId = id(151, 1);
  const bothPaths: FaultTreeGate = {
    id: bothPathsId, kind: "GATE", gateType: "AND", code: "AFW-FT5", name: "Both steam-generator delivery paths fail", description: "Both AFW delivery paths fail",
  };
  const ccfLeaf: FaultTreeLeafNode = { id: id(151, 2), kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_IDS.AFW_CCF };
  const transferA = transferLeaf(key, "AFW_SG_A", 3);
  const transferB = transferLeaf(key, "AFW_SG_B", 4);
  return {
    uuid: MODEL_IDS[key], code: MODEL_META[key].code, name: MODEL_META[key].name,
    systemReference: `SYS-${MODEL_META[key].code}`, description: MODEL_META[key].name,
    modelRepresentation: "FAULT_TREE", topGate: { gateId: top.id }, gates: [top, bothPaths], leafNodes: [ccfLeaf, transferA, transferB],
    gateInputs: [
      { id: id(152, 1), gateId: top.id, childId: ccfLeaf.id, order: 0 },
      { id: id(152, 2), gateId: top.id, childId: bothPaths.id, order: 1 },
      { id: id(152, 3), gateId: bothPaths.id, childId: transferA.id, order: 0 },
      { id: id(152, 4), gateId: bothPaths.id, childId: transferB.id, order: 1 },
    ],
    nodePositions: [
      { nodeId: top.id, position: { x: 360, y: 30 } },
      { nodeId: ccfLeaf.id, position: { x: 180, y: 220 } },
      { nodeId: bothPaths.id, position: { x: 500, y: 190 } },
      { nodeId: transferA.id, position: { x: 400, y: 370 } },
      { nodeId: transferB.id, position: { x: 600, y: 370 } },
    ],
    layout: { viewport: { x: 0, y: 0, zoom: 0.85 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    implementsSrs: [],
  };
}

const systemLogicModels: SystemLogicModel[] = MODEL_KEYS.map((key, index) => {
  if (key === "EPS") return epsFaultTree();
  if (key === "AFW") return afwFaultTree();
  return directFaultTree(key, index + 1);
});

const systemDefinitions: SystemDefinition[] = MODEL_KEYS.map((key) => ({
  uuid: `SYS-${MODEL_META[key].code}`,
  name: MODEL_META[key].name,
  description: `Case-study system function represented by ${MODEL_META[key].code}.`,
  abbreviation: MODEL_META[key].code.replace(/-FT$/, ""),
  boundaries: ["The modeled top-event boundary shown in the dissertation case study."],
  successCriteriaIds: [`SC-${MODEL_META[key].code}`],
  successCriterion: `The ${MODEL_META[key].name.toLowerCase()} top event does not occur.`,
  applicablePlantOperatingStates: ["POS-FULL-POWER"],
  modeledComponentsAndFailures: Object.fromEntries(MODEL_EVENTS[key].map((eventKey) => [
    BASIC_EVENT_IDS[eventKey],
    { failureModes: [BASIC_EVENT_META[eventKey].name], justificationForInclusion: "Used by the HCL case-study logic." },
  ])),
  informationBasis: "as-built-as-operated",
  implementsSrs: [],
}));

const ieBase = createBlankIe("HCL dissertation case study — IE", OWNER);

const loopInitiator: InitiatorDefinition = {
  uuid: "IE-LOOP-HCL",
  name: "Loss of offsite power (LOOP)",
  eventType: "INITIATING",
  frequency: LOOP_FREQUENCY,
  category: InitiatingEventCategory.TRANSIENT,
  subcategory: "Loss of offsite power",
  applicableStates: ["POS-FULL-POWER"],
  groupId: "IEG-LOOP-HCL",
  identificationMethodIds: ["DISSERTATION-CASE-STUDY"],
  identificationBasis: ["Connected LOOP → SBO → FLEX case described in Chapter 9 of the dissertation."],
  tripParameters: [{ parameter: "Loss of offsite voltage", setpoint: 0, uncertainty: 0, basis: "Case-study initiating condition" }],
  mitigatingSystems: [],
  barrierImpacts: [{ barrierId: "RCB", state: BarrierImpactState.INTACT, timing: "At initiation", mechanism: "Electrical power loss" }],
  challengedSafetyFunctions: ["Reactor trip", "Emergency AC power", "Decay heat removal"],
  screeningStatus: ScreeningStatus.RETAINED,
  importanceLevel: ImportanceLevel.HIGH,
  implementsSrs: [],
};

const loopGroup: InitiatingEventGroup = {
  uuid: "IEG-LOOP-HCL",
  name: "Loss of offsite power",
  description: "Initiates the connected LOOP, SBO, and FLEX event-tree progression.",
  memberInitiatorIds: [loopInitiator.uuid],
  groupingBasis: "Single case-study initiating event retained without aggregation.",
  boundingInitiatorId: loopInitiator.uuid,
  similarMitigationRequirements: ["Reactor trip", "Emergency AC power", "Auxiliary feedwater", "Long-term FLEX coping"],
  groupingDoesNotMaskRiskSignificantSequences: true,
  comparableImpactAcrossMembers: true,
  challengedSafetyFunctions: ["Reactivity control", "Core heat removal", "Electrical support"],
  applicableStates: ["POS-FULL-POWER"],
  meanFrequency: {
    value: LOOP_FREQUENCY,
    units: FrequencyUnit.PER_PLANT_YEAR,
    distribution: { type: DistributionType.POINT_ESTIMATE, parameters: [LOOP_FREQUENCY] },
    source: "Chapter 9 baseline case calibration: 2.82E-6/yr divided by 3.37E-6 conditional core-damage probability.",
  },
  riskImportance: ImportanceLevel.HIGH,
  implementsSrs: [],
};

const loopQuantification: InitiatingEventFrequencyQuantification = {
  initiatorOrGroupId: loopGroup.uuid,
  meanFrequency: loopGroup.meanFrequency!,
  basis: "DESIGN_BASED",
  plantCalendarYearBasis: true,
  posTimeFractionApplied: true,
  dataSourceJustification: "The temporary demonstration uses 0.837/yr so the dissertation baseline conditional probability of 3.37E-6 corresponds to the reported 2.82E-6/yr baseline-cell contribution.",
  recoveryActionsIncluded: false,
  recoveryActionJustifications: ["All recovery is represented downstream in the event trees."],
  uncertaintyCharacterization: { riskSignificant: true, method: "Point value for deterministic reproduction of the published case-study baseline.", probabilisticRepresentationProvided: true },
  implementsSrs: [],
};

const IE_ANALYSIS_HCL = {
  ...ieBase,
  uuid: HCL_CASE_IE_UUID,
  name: "HCL dissertation case study — Initiating Events",
  created: NOW,
  modified: NOW,
  metadata: {
    ...ieBase.metadata,
    versionInfo: { ...ieBase.metadata.versionInfo, lastUpdated: NOW },
    analysisDate: NOW,
    analysts: [OWNER],
    scope: "Temporary HCL verification example for the connected LOOP → SBO → FLEX dissertation case study.",
    limitations: ["The published dissertation contains all event trees but only selected fault trees and BN fragments; this seed is an editor-ready reproducibility scaffold."],
    lastModifiedDate: NOW,
    lastModifiedBy: OWNER,
  },
  praScope: "One full-power LOOP initiating event feeding the connected HCL case-study sequence.",
  applicablePlantOperatingStates: ["POS-FULL-POWER"],
  initiators: [loopInitiator],
  initiatingEventGroups: [loopGroup],
  quantifications: [loopQuantification],
  screeningRecords: [{ initiatorOrGroupId: loopInitiator.uuid, retained: true, barrierIntegrityPreconditionMet: true, justification: "LOOP is the retained initiator for the published connected sequence.", implementsSrs: [] }],
  plantRepresentationAccuracy: {
    ...ieBase.plantRepresentationAccuracy,
    scope: "OPERATING",
    accuracy: ImportanceLevel.MEDIUM,
    basis: "Chapter 9 case-study description and published baseline targets.",
    detailConsistentWithPlant: true,
    sufficientForRiskSignificantContributors: true,
    sufficiencyJustification: "Sufficient for exercising the HCL implementation and comparing the published reference targets.",
    highConfidenceAreas: ["Initiating-event identity", "Published baseline target"],
    lowerConfidenceAreas: ["Unpublished source-model details"],
  },
  modelUncertainty: { ...ieBase.modelUncertainty, uuid: id(1, 1), name: "HCL case-study IE model uncertainty" },
  documentation: {
    ...ieBase.documentation,
    processDescription: "Defines the LOOP entry condition used by the connected LOOP, SBO, and FLEX event trees.",
    inputSources: "Dissertation source, Chapter 9.",
    resultsSummary: "Reference baseline: conditional core-damage probability 3.37E-6 and baseline-cell contribution 2.82E-6/yr.",
    frequencyDerivation: "0.837/yr is the ratio of the published annual baseline-cell contribution to the published conditional probability.",
    quantificationApproach: "Point-frequency input; mitigation and dependence are quantified downstream.",
    praTaskInterfaces: "Supplies the LOOP initiating frequency to Event Sequence Analysis and Event Sequence Quantification.",
  },
};

const syBase = createBlankSy("HCL dissertation case study — SY", OWNER);

const SY_ANALYSIS_HCL = {
  ...syBase,
  uuid: HCL_CASE_SY_UUID,
  name: "HCL dissertation case study — Fault Trees",
  created: NOW,
  modified: NOW,
  metadata: {
    ...syBase.metadata,
    versionInfo: { ...syBase.metadata.versionInfo, lastUpdated: NOW },
    analysisDate: NOW,
    analysts: [OWNER],
    scope: "Fault-tree top events supporting the connected LOOP → SBO → FLEX demonstration.",
    limitations: ["The dissertation reports 22 linked top events but illustrates only selected full trees; compact executable trees preserve the published top-event structure and shared HCL interfaces."],
    lastModifiedDate: NOW,
    lastModifiedBy: OWNER,
  },
  praScope: "Twenty-two top-event fault trees used by the dissertation HCL demonstration.",
  dependencyBayesianNetworks: [] as EsqBayesianNetwork[],
  systemDefinitions,
  systemToSafetyFunctionMappings: systemDefinitions.map((system) => ({ uuid: `MAP-${system.uuid}`, systemReference: system.uuid, safetyFunctions: [system.name], eventSequences: [], implementsSrs: [] })),
  systemLogicModels,
  systemBasicEvents,
  humanFailureEventIntegrations: [
    {
      uuid: "SY-HFE-HCL-FNB",
      hfeReference: HCL_HFE_IDS.feedBleed,
      hfeSource: {
        referenceType: "HUMAN_FAILURE_EVENT",
        workbookId: PLACEHOLDER_HR_WORKBOOK_ID,
        entityId: HCL_HFE_IDS.feedBleed,
        quantificationId: `HEPQ-${HCL_HFE_IDS.feedBleed}`,
      },
      system: `SYS-${MODEL_META.FEED_BLEED.code}`,
      taskDescription: "Initiate feed-and-bleed cooling after high-pressure injection is challenged.",
      hfeType: "POST_INITIATOR",
      isTestMaintenance: false,
      implementsSrs: [],
    },
    {
      uuid: "SY-HFE-HCL-SBC",
      hfeReference: HCL_HFE_IDS.cooldown,
      hfeSource: {
        referenceType: "HUMAN_FAILURE_EVENT",
        workbookId: PLACEHOLDER_HR_WORKBOOK_ID,
        entityId: HCL_HFE_IDS.cooldown,
        quantificationId: `HEPQ-${HCL_HFE_IDS.cooldown}`,
      },
      system: `SYS-${MODEL_META.COOLDOWN.code}`,
      taskDescription: "Establish primary and secondary cooldown for long-term heat removal.",
      hfeType: "POST_INITIATOR",
      isTestMaintenance: false,
      implementsSrs: [],
    },
  ],
  plantRepresentationAccuracy: {
    ...syBase.plantRepresentationAccuracy,
    scope: "OPERATING",
    accuracy: ImportanceLevel.MEDIUM,
    basis: "Selected fault-tree figures and top-event inventory in dissertation Chapter 9 and Appendix A.",
    detailConsistentWithPlant: true,
    sufficientForRiskSignificantContributors: true,
    sufficiencyJustification: "The compact trees exercise transfers, shared basic events, exact FT quantification, and HCL substitution.",
    highConfidenceAreas: ["Top-event identities", "Selected published logic structures", "HCL mapping points"],
    lowerConfidenceAreas: ["Unpublished gates and component probabilities"],
  },
  dependencySearchMethodology: {
    ...syBase.dependencySearchMethodology,
    uuid: id(2, 1),
    name: "HCL dependency interface search",
    description: "Shared hazard, fire, and recovery dependencies are represented by BN-bound basic events.",
    reference: "Dissertation Chapters 6 and 9",
    systemsAnalyzed: systemDefinitions.map((system) => system.uuid),
  },
  modelUncertainty: { ...syBase.modelUncertainty, uuid: id(2, 2), name: "HCL case-study fault-tree model uncertainty" },
  documentation: {
    ...syBase.documentation,
    processDescription: "Builds the 22 event-tree top events as executable fault trees with selected transfer structures for EPS and AFW.",
    systemFunctionsAndBoundaries: "Boundaries follow the top-event labels shown in the LOOP, SBO, and FLEX event trees.",
    modeledComponentsAndFailureModes: "Each tree contains an HCL-mapped dependency event and an independent residual event; selected published trees retain their transfer decomposition.",
    dependencySearchAndTables: "The BN carries seismic, flood, fire, and shared plant-condition dependencies into mapped basic events.",
    modularizationAndLogicLoops: "EPS transfers to the two 4160 V bus trees; AFW transfers to the two steam-generator delivery paths.",
    evaluationResultsSummary: "Each tree can be run independently or as part of the HCL event-tree calculation.",
    informationSources: "Dissertation source, Figures 9.13–9.17 and Appendix A.",
    praTaskInterfaces: "Top events are linked from the ES functional events and bound to BN states in ESQ.",
  },
};

const daBase = createBlankDa("HCL dissertation case study — DA", OWNER);

const DA_ANALYSIS_HCL: DataAnalysis = {
  ...daBase,
  uuid: HCL_CASE_DA_UUID,
  name: "HCL dissertation case study — Data Analysis",
  created: NOW,
  modified: NOW,
  metadata: {
    ...daBase.metadata,
    versionInfo: { ...daBase.metadata.versionInfo, lastUpdated: NOW },
    analysisDate: NOW,
    analysts: [OWNER],
    scope: "Point-estimate probability inputs for the non-human fault-tree basic events in the connected HCL case study.",
    limitations: ["Values reconstructed from the executable dissertation-source example remain provisional until the original source-model package is available."],
    lastModifiedDate: NOW,
    lastModifiedBy: OWNER,
  },
  praScope: "Authoritative probability parameters consumed by the dissertation-source SY fault trees.",
  parameters: systemBasicEvents.filter((event) => event.failureMode !== "HUMAN_ERROR").map((event) => ({
    uuid: event.uuid,
    name: `${event.code} probability`,
    description: event.name,
    parameterType: "PROBABILITY",
    value: event.probability ?? 0,
    valueType: "POINT_ESTIMATE",
    estimationApproach: "GENERIC",
    basicEventRef: event.uuid,
    modelSelectionBasis: "Reconstructed point estimate used by the executable dissertation-source HCL example.",
      dataSources: [{
        source: "Dissertation-source case-study reconstruction",
        sourceType: "EXPERT_JUDGMENT",
      applicabilityAssessment: "Preserves the current executable example input pending recovery of the original model package.",
    }],
    implementsSrs: [],
  })),
  modelUncertainty: {
    ...daBase.modelUncertainty,
    uuid: id(3, 1),
    name: "HCL case-study data-analysis model uncertainty",
  },
  documentation: {
    ...daBase.documentation,
    processDescription: "Maintains one revisioned probability parameter for every non-human basic event used by the case-study fault trees.",
    basicEventProbabilityModels: "Point estimates reproduce the current executable fault-tree inputs; HCL bindings replace the mapped dependency events during hybrid quantification.",
    genericParameterSources: "Dissertation-source case-study reconstruction.",
    parameterEstimatesWithUncertainty: "Point estimates are retained without an invented uncertainty distribution because the complete source data package is not public.",
    modelUncertaintySources: "Unpublished source-model details and the reconstruction of compact fault trees.",
    asBuiltLimitations: "This temporary example demonstrates the DA-to-SY connection and is not an as-built plant data analysis.",
    praTaskInterfaces: "Controls the non-human SY basic-event probabilities used by native FT, ET, and HCL runs; HRA controls the two human-error probabilities.",
  },
};

const hrBase = createBlankHr("HCL dissertation case study — HRA", OWNER);

const HR_ANALYSIS_HCL: HumanReliabilityAnalysis = {
  ...hrBase,
  uuid: HCL_CASE_HR_UUID,
  name: "HCL dissertation case study — Human Reliability",
  created: NOW,
  modified: NOW,
  metadata: {
    ...hrBase.metadata,
    versionInfo: { ...hrBase.metadata.versionInfo, lastUpdated: NOW },
    analysisDate: NOW,
    analysts: [OWNER],
    scope: "Human-error probabilities used by the feed-and-bleed and cooldown fault-tree top events.",
    limitations: ["The temporary reproduction preserves explicit HRA ownership while the original detailed HRA source package remains unavailable."],
    lastModifiedDate: NOW,
    lastModifiedBy: OWNER,
  },
  praScope: "Two post-initiator human-failure events used by the connected LOOP–SBO–FLEX demonstration.",
  dependencyBayesianNetworks: [] as EsqBayesianNetwork[],
  humanFailureEvents: [
    {
      uuid: HCL_HFE_IDS.feedBleed,
      name: "Fail to initiate feed-and-bleed",
      hfeTiming: "POST_INITIATOR",
      description: "The operator does not initiate feed-and-bleed cooling after the required cue.",
      impactLevel: "SYSTEM",
      affectedSystems: [`SYS-${MODEL_META.FEED_BLEED.code}`],
      applicablePlantOperatingStates: ["POS-FULL-POWER"],
      applicableInitiatingEvents: ["IEG-LOOP-HCL"],
      responseDetail: {
        requiredResponse: "Initiate feed-and-bleed cooling.",
        responseType: "INITIATE",
        successCriteriaIds: [`SC-${MODEL_META.FEED_BLEED.code}`],
        procedureReferences: ["CASE-STUDY-FNB"],
        cueDescription: "High-pressure injection and steam-generator heat removal are unavailable.",
      },
      implementsSrs: [],
    },
    {
      uuid: HCL_HFE_IDS.cooldown,
      name: "Fail to establish cooldown",
      hfeTiming: "POST_INITIATOR",
      description: "The operator does not establish primary and secondary cooldown for long-term heat removal.",
      impactLevel: "SYSTEM",
      affectedSystems: [`SYS-${MODEL_META.COOLDOWN.code}`],
      applicablePlantOperatingStates: ["POS-FULL-POWER"],
      applicableInitiatingEvents: ["IEG-LOOP-HCL"],
      responseDetail: {
        requiredResponse: "Establish primary and secondary cooldown.",
        responseType: "CONTROL",
        successCriteriaIds: [`SC-${MODEL_META.COOLDOWN.code}`],
        procedureReferences: ["CASE-STUDY-SBC"],
        cueDescription: "Long-term core heat removal is required following LOOP progression.",
      },
      implementsSrs: [],
    },
  ],
  hepQuantifications: [
    {
      uuid: `HEPQ-${HCL_HFE_IDS.feedBleed}`,
      hfeId: HCL_HFE_IDS.feedBleed,
      methodology: "Dissertation-source point estimate",
      assessmentType: "DETAILED_ASSESSMENT",
      isRiskSignificant: true,
      pointEstimateHep: BASIC_EVENT_META.FEED_BLEED_RANDOM.probability,
      implementsSrs: [],
    },
    {
      uuid: `HEPQ-${HCL_HFE_IDS.cooldown}`,
      hfeId: HCL_HFE_IDS.cooldown,
      methodology: "Dissertation-source point estimate",
      assessmentType: "DETAILED_ASSESSMENT",
      isRiskSignificant: true,
      pointEstimateHep: BASIC_EVENT_META.COOLDOWN_RANDOM.probability,
      implementsSrs: [],
    },
  ],
  documentation: {
    ...hrBase.documentation,
    processDescription: "Defines and quantifies the two human-error basic events retained in the executable case-study fault trees.",
    hfeDefinitions: "Feed-and-bleed initiation and primary/secondary cooldown are explicit post-initiator operator responses.",
    hepMethodologies: "Point estimates preserve the reconstructed dissertation-source probabilities without inventing additional uncertainty.",
    praTaskInterfaces: "Supplies typed HFE and HEP references to Systems Analysis; native FT, ET, and HCL runs resolve these values from this revisioned workbook.",
  },
};

const ET_IDS = {
  LOOP: id(200, 1),
  SBO: id(200, 2),
  FLEX: id(200, 3),
} as const;

type TreeKey = keyof typeof ET_IDS;

const FE_DEFINITIONS: Record<TreeKey, Array<{ key: string; label: string; name: string; model: ModelKey }>> = {
  LOOP: [
    { key: "RPS", label: "RPS", name: "Reactor trip / reactor protection", model: "RPS" },
    { key: "EPS", label: "EPS", name: "Emergency AC power", model: "EPS" },
    { key: "AFW", label: "AFW", name: "Auxiliary feedwater", model: "AFW" },
    { key: "PORV", label: "PORV-B", name: "PORV-B path available", model: "PORV_B" },
    { key: "SEAL", label: "RCP SEAL", name: "RCP seal cooling / seal LOCA control", model: "RCP_SEAL_LOCA" },
    { key: "HPI", label: "HPI", name: "High-pressure injection", model: "HPI" },
    { key: "FNB", label: "F&B", name: "Feed-and-bleed operation", model: "FEED_BLEED" },
    { key: "OPR2", label: "OPR 2H", name: "Offsite power recovery within 2 hours", model: "OPR_02H" },
    { key: "COOL", label: "COOLDOWN", name: "Primary and secondary cooldown", model: "COOLDOWN" },
    { key: "RHR", label: "RHR", name: "Residual heat removal", model: "RHR" },
    { key: "HPR", label: "HPR", name: "High-pressure recirculation", model: "HPR" },
  ],
  SBO: [
    { key: "AFW", label: "AFW", name: "Auxiliary feedwater system", model: "AFW" },
    { key: "PORV", label: "PORV-B", name: "PORV-B path availability", model: "PORV_B" },
    { key: "SEAL", label: "RCP SEAL", name: "RCP seal LOCA / seal cooling status", model: "RCP_SEAL_LOCA" },
    { key: "OPR2", label: "OPR 2H", name: "Offsite power recovery within 2 hours", model: "OPR_02H" },
    { key: "DGR8", label: "DGR 8H", name: "Diesel generator recovery within 8 hours", model: "DGR_08H" },
  ],
  FLEX: [
    { key: "ELAP", label: "ELAP", name: "ELAP is declared when needed", model: "FLEX_DETAIL" },
    { key: "DETAIL", label: "FLEX 600", name: "FLEX details operable and connected", model: "FLEX_DETAIL" },
    { key: "SGP", label: "FLEX SGP", name: "FLEX steam-generator pump available", model: "FLEX_SG_PUMP" },
    { key: "AFWMAN", label: "AFW MAN", name: "Long-term manual AFW control", model: "AFW_MANUAL" },
    { key: "MAKEUP", label: "FLEX MUP", name: "Boron injection and SG makeup", model: "FLEX_MAKEUP" },
    { key: "OPR24", label: "OPR 24H", name: "AC power recovered within 24 hours", model: "OPR_24H" },
    { key: "DGR72", label: "DGR 72H", name: "AC power recovered within 72 hours", model: "DGR_72H" },
  ],
};

const FE_IDS: Record<TreeKey, Record<string, string>> = {
  LOOP: Object.fromEntries(FE_DEFINITIONS.LOOP.map((event, index) => [event.key, id(210, index + 1)])),
  SBO: Object.fromEntries(FE_DEFINITIONS.SBO.map((event, index) => [event.key, id(211, index + 1)])),
  FLEX: Object.fromEntries(FE_DEFINITIONS.FLEX.map((event, index) => [event.key, id(212, index + 1)])),
};

interface TreePathSpec {
  states: string;
  endState?: EndState;
  transfer?: { targetTree: TreeKey; targetSequenceIndex: number };
}

const PATH_SPECS: Record<TreeKey, TreePathSpec[]> = {
  LOOP: [
    { states: "SSSSSBBBBBB", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSSSFBBSBBB", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SSSSFBBFBBS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSSSFBBFBBF", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SSSFBSBSSSB", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSSFBSBSSFS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSSFBSBSSFF", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SSSFBSBSFBS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSSFBSBSFBF", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SSSFBSBFBBS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSSFBSBFBBF", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SSSFBFBBBBB", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SSFBBBSSBBS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSFBBBSSBBF", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SSFBBBSFBBS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSFBBBSFBBF", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SSFBBBFBBBB", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SFBBBBBBBBB", transfer: { targetTree: "SBO", targetSequenceIndex: 6 } },
    { states: "FSBBBBBBBBB", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "FFBBBBBBBBB", endState: EndState.RADIONUCLIDE_RELEASE },
  ],
  SBO: [
    { states: "SSSSB", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSSFS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSSFF", transfer: { targetTree: "FLEX", targetSequenceIndex: 3 } },
    { states: "SSFSB", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSFFS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSFFF", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SFBSB", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SFBFS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SFBFF", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "FBBSB", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "FBBFS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "FBBFF", transfer: { targetTree: "FLEX", targetSequenceIndex: 12 } },
  ],
  FLEX: [
    { states: "SSSBSBS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSSBSBF", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SSSBFBS", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSSBFBF", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SSFSBSB", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SSFSBFB", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SSFFBBB", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SFBSBSB", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "SFBSBFB", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "SFBFBBB", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "FBBSBSB", endState: EndState.SUCCESSFUL_MITIGATION },
    { states: "FBBSBFB", endState: EndState.RADIONUCLIDE_RELEASE },
    { states: "FBBFBBB", endState: EndState.RADIONUCLIDE_RELEASE },
  ],
};

const SEQUENCE_IDS: Record<TreeKey, string[]> = {
  LOOP: PATH_SPECS.LOOP.map((_, index) => id(220, index + 1)),
  SBO: PATH_SPECS.SBO.map((_, index) => id(221, index + 1)),
  FLEX: PATH_SPECS.FLEX.map((_, index) => id(222, index + 1)),
};

function pathState(character: string): SystemStatus {
  if (character === "S") return "SUCCESS";
  if (character === "F") return "FAILURE";
  return "BYPASSED";
}

function createEventTree(treeKey: TreeKey): EventTree {
  const definitions = FE_DEFINITIONS[treeKey];
  const functionalEvents: Record<string, FunctionalEvent> = Object.fromEntries(definitions.map((event, order) => {
    const eventId = FE_IDS[treeKey][event.key]!;
    return [eventId, {
      uuid: eventId,
      name: event.name,
      label: event.label,
      order,
      description: `${event.name}; failure is represented by ${MODEL_META[event.model].code}.`,
      faultTreeTopEvent: {
        referenceType: "FAULT_TREE_TOP_EVENT" as const,
        workbookId: PLACEHOLDER_SY_WORKBOOK_ID,
        modelId: MODEL_IDS[event.model],
        entityId: TOP_GATE_IDS[event.model],
      },
    }];
  }));
  const candidates = PATH_SPECS[treeKey].map((spec, index) => ({
    spec,
    sequenceId: SEQUENCE_IDS[treeKey][index]!,
    states: Object.fromEntries(definitions.map((event, eventIndex) => [FE_IDS[treeKey][event.key]!, pathState(spec.states[eventIndex] ?? "B")])),
  }));
  const sequences = Object.fromEntries(candidates.map(({ spec, sequenceId, states }, index) => [sequenceId, {
    uuid: sequenceId,
    name: `${treeKey}_${spec.transfer === undefined ? (spec.endState === EndState.SUCCESSFUL_MITIGATION ? "OK" : "CD") : spec.transfer.targetTree}_ET${String(index + 1).padStart(2, "0")}`,
    label: `${treeKey}-${String(index + 1).padStart(2, "0")}`,
    ...(spec.endState === undefined ? {} : { endState: spec.endState }),
    eventSequenceId: `${treeKey}-SEQ-${String(index + 1).padStart(2, "0")}`,
    functionalEventStates: states,
  }]));
  const branches: EventTree["branches"] = {};
  let branchCounter = 0;
  const buildBranch = (depth: number, subset: typeof candidates): { target: string; targetType: "BRANCH" | "SEQUENCE" } => {
    if (depth >= definitions.length) return { target: subset[0]!.sequenceId, targetType: "SEQUENCE" };
    branchCounter += 1;
    const branchId = id(treeKey === "LOOP" ? 230 : treeKey === "SBO" ? 231 : 232, branchCounter);
    const functionalEventId = FE_IDS[treeKey][definitions[depth]!.key]!;
    const paths = (["SUCCESS", "FAILURE", "BYPASSED"] as const).flatMap((state) => {
      const matching = subset.filter((candidate) => candidate.states[functionalEventId] === state);
      return matching.length === 0 ? [] : [{ state, ...buildBranch(depth + 1, matching) }];
    });
    branches[branchId] = { uuid: branchId, name: definitions[depth]!.name, functionalEventId, paths };
    return { target: branchId, targetType: "BRANCH" };
  };
  const root = buildBranch(0, candidates);
  const transfers = Object.fromEntries(candidates.flatMap(({ spec, sequenceId }) => {
    if (spec.transfer === undefined) return [];
    return [[sequenceId, {
      targetEventTreeId: ET_IDS[spec.transfer.targetTree],
      targetSequenceId: SEQUENCE_IDS[spec.transfer.targetTree][spec.transfer.targetSequenceIndex - 1],
      transferConditions: [`Continue the connected progression in the ${spec.transfer.targetTree} tree.`],
      preservedDependencies: ["Seismic level", "Flood level", "Fire state", "Shared plant condition"],
    }]];
  }));
  return {
    uuid: ET_IDS[treeKey],
    name: `${treeKey} connected case-study event tree`,
    label: treeKey,
    description: `${treeKey} portion of the connected LOOP → SBO → FLEX dissertation sequence.`,
    initiatingEventId: treeKey === "LOOP" ? "IEG-LOOP-HCL" : `${treeKey}-TRANSFER-ENTRY`,
    initiatingEventFrequency: { value: treeKey === "LOOP" ? LOOP_FREQUENCY : 1 },
    plantOperatingStateId: "POS-FULL-POWER",
    functionalEvents,
    sequences,
    endStateIds: {
      SUCCESSFUL_MITIGATION: id(treeKey === "LOOP" ? 240 : treeKey === "SBO" ? 241 : 242, 1),
      RADIONUCLIDE_RELEASE: id(treeKey === "LOOP" ? 240 : treeKey === "SBO" ? 241 : 242, 2),
    },
    branches,
    initialState: { branchId: root.target },
    ...(Object.keys(transfers).length === 0 ? {} : { transfers }),
    canvas: {
      metadata: { viewport: { x: 0, y: 0, zoom: 0.78 }, mode: "AUTOMATIC", direction: "LEFT_TO_RIGHT" },
      nodePositions: [],
    },
    implementsSrs: [],
  };
}

const eventTrees = (["LOOP", "SBO", "FLEX"] as const).map(createEventTree);

const eventSequences: EventSequence[] = eventTrees.flatMap((tree) => Object.values(tree.sequences).map((sequence) => {
  const isLoca = tree.label === "LOOP" && sequence.label === "LOOP-02";
  const isAtws = tree.label === "LOOP" && sequence.label === "LOOP-19";
  const isSuccessful = sequence.endState === EndState.SUCCESSFUL_MITIGATION;
  return {
    uuid: sequence.eventSequenceId!,
    name: sequence.name,
    initiatingEventId: tree.initiatingEventId,
    plantOperatingStateId: "POS-FULL-POWER",
    eventTreeId: tree.uuid,
    eventTreeSequenceId: sequence.uuid,
    functionalEventStates: sequence.functionalEventStates,
    progression: tree.transfers?.[sequence.uuid] === undefined ? sequence.name : `Transfer from ${tree.label} to the connected downstream tree.`,
    endState: sequence.endState ?? EndState.RADIONUCLIDE_RELEASE,
    sequenceFamilyId: isLoca
      ? "ESF-HCL-LOCA"
      : isAtws
        ? "ESF-HCL-ATWS"
        : isSuccessful
          ? "ESF-HCL-OK"
          : "ESF-HCL-CD",
    releaseCategoryId: isLoca
      ? "RC-LOCA"
      : isAtws
        ? "RC-ATWS"
        : isSuccessful
          ? undefined
          : "RC-CORE-DAMAGE",
    implementsSrs: [],
  };
}));

const eventSequenceFamilies: EventSequenceFamily[] = [
  {
    uuid: "ESF-HCL-OK",
    name: "Successful stabilization",
    groupingCriteriaId: "GC-HCL-END-STATE",
    representativeInitiatingEventId: "IEG-LOOP-HCL",
    representativePlantOperatingStateId: "POS-FULL-POWER",
    representativePlantResponse: "The connected sequence stabilizes without core damage.",
    memberSequenceIds: eventSequences.filter((sequence) => sequence.endState === EndState.SUCCESSFUL_MITIGATION).map((sequence) => sequence.uuid),
    endState: EndState.SUCCESSFUL_MITIGATION,
    implementsSrs: [],
  },
  {
    uuid: "ESF-HCL-CD",
    name: "Core damage",
    groupingCriteriaId: "GC-HCL-END-STATE",
    representativeInitiatingEventId: "IEG-LOOP-HCL",
    representativePlantOperatingStateId: "POS-FULL-POWER",
    representativePlantResponse: "The connected LOOP, SBO, or FLEX progression reaches core damage.",
    releaseCategoryIds: ["RC-CORE-DAMAGE"],
    memberSequenceIds: eventSequences.filter((sequence) => sequence.sequenceFamilyId === "ESF-HCL-CD").map((sequence) => sequence.uuid),
    endState: EndState.RADIONUCLIDE_RELEASE,
    implementsSrs: [],
  },
  {
    uuid: "ESF-HCL-LOCA",
    name: "LOCA",
    groupingCriteriaId: "GC-HCL-END-STATE",
    representativeInitiatingEventId: "IEG-LOOP-HCL",
    representativePlantOperatingStateId: "POS-FULL-POWER",
    representativePlantResponse: "Loss-of-coolant-accident end state shown in the published LOOP tree.",
    releaseCategoryIds: ["RC-LOCA"],
    memberSequenceIds: eventSequences.filter((sequence) => sequence.sequenceFamilyId === "ESF-HCL-LOCA").map((sequence) => sequence.uuid),
    endState: EndState.RADIONUCLIDE_RELEASE,
    implementsSrs: [],
  },
  {
    uuid: "ESF-HCL-ATWS",
    name: "ATWS",
    groupingCriteriaId: "GC-HCL-END-STATE",
    representativeInitiatingEventId: "IEG-LOOP-HCL",
    representativePlantOperatingStateId: "POS-FULL-POWER",
    representativePlantResponse: "Anticipated-transient-without-scram end state shown in the published LOOP tree.",
    releaseCategoryIds: ["RC-ATWS"],
    memberSequenceIds: eventSequences.filter((sequence) => sequence.sequenceFamilyId === "ESF-HCL-ATWS").map((sequence) => sequence.uuid),
    endState: EndState.RADIONUCLIDE_RELEASE,
    implementsSrs: [],
  },
];

const esBase = createBlankEs("HCL dissertation case study — ES", OWNER);

const ES_ANALYSIS_HCL: EventSequenceAnalysis = {
  ...esBase,
  uuid: HCL_CASE_ES_UUID,
  name: "HCL dissertation case study — Event Trees",
  created: NOW,
  modified: NOW,
  metadata: {
    ...esBase.metadata,
    versionInfo: { ...esBase.metadata.versionInfo, lastUpdated: NOW },
    analysisDate: NOW,
    analysts: [OWNER],
    scope: "Connected LOOP → SBO → FLEX event-tree case used to demonstrate HCL quantification.",
    limitations: ["Transfer endpoints are preserved explicitly; published figures provide the event-tree topology while unpublished source inputs remain a reproducibility gap."],
    lastModifiedDate: NOW,
    lastModifiedBy: OWNER,
  },
  praScope: "Three connected event trees, 45 terminal or transfer sequences, and 22 linked fault-tree top events.",
  scopeDefinition: {
    plantOperatingStateIds: ["POS-FULL-POWER"],
    initiatingEventIds: ["IEG-LOOP-HCL"],
    radioactiveMaterialSources: ["REACTOR-CORE"],
    radionuclideBarriers: ["Fuel cladding", "Reactor coolant boundary", "Containment"],
  },
  keySafetyFunctions: [
    { id: "SF-REACTIVITY", name: "Reactivity control", description: "Trip the reactor following LOOP.", supportingSystems: ["RPS"], successCriteriaId: "SC-RPS" },
    { id: "SF-HEAT-REMOVAL", name: "Core heat removal", description: "Maintain feedwater, injection, cooldown, and FLEX coping.", supportingSystems: ["AFW", "HPI", "FLEX"], successCriteriaId: "SC-DHR" },
    { id: "SF-POWER", name: "Electrical support and recovery", description: "Supply emergency AC and restore grid or diesel power.", supportingSystems: ["EPS", "FLEX"], successCriteriaId: "SC-POWER" },
  ],
  eventSequences,
  groupingCriteria: [{ uuid: "GC-HCL-END-STATE", name: "Published end-state grouping", description: "Groups paths as successful stabilization or core damage.", characteristicsConsidered: ["End state", "Transfer destination"] }],
  eventSequenceFamilies,
  eventTrees,
  dependencyModels: { bayesianNetworks: [] as EsqBayesianNetwork[] },
  plantResponseAnalysisAccuracy: {
    ...esBase.plantResponseAnalysisAccuracy,
    scope: "OPERATING",
    accuracy: ImportanceLevel.HIGH,
    basis: "Event-tree topology transcribed from dissertation Figures 9.10–9.12.",
    detailConsistentWithPlant: true,
    sufficientForRiskSignificantContributors: true,
    sufficiencyJustification: "The three published trees, functional-event order, bypass states, transfers, and end states are represented explicitly.",
    highConfidenceAreas: ["Functional-event order", "Sequence counts", "Transfer structure", "End-state classification"],
    lowerConfidenceAreas: ["Unpublished branch labels and numerical source inputs"],
  },
  modelUncertainty: { ...esBase.modelUncertainty, uuid: id(3, 1), name: "HCL case-study event-tree model uncertainty" },
  documentation: {
    ...esBase.documentation,
    processDescription: "Transcribes the published LOOP, SBO, and FLEX event trees into editable branch graphs.",
    posInitiatorSequenceLinkage: "Full-power LOOP enters the LOOP tree; SBO and FLEX are reached by explicit transfer sequences.",
    keySafetyFunctionsIdentification: "Functional events preserve the top-event names and order shown in Figures 9.10–9.12.",
    sequenceDelineation: "20 LOOP, 12 SBO, and 13 FLEX sequences are represented, including bypassed functional events.",
    dependencyTreatment: "Every functional event links to a Systems Analysis fault-tree top event; mapped basic events are resolved through the ESQ Bayesian network.",
    endStateAndReleaseCategoryDefinitions: "OK denotes successful stabilization; CD denotes core damage.",
    intermediateEndStatesAndTransfers: "LOOP transfers into SBO; SBO can transfer into FLEX, while the BN/HCL evidence context is preserved.",
    praTaskInterfaces: "Receives the LOOP frequency from IE, fault trees from SY, and HCL quantification from ESQ.",
  },
};

const BN_IDS = {
  model: id(300, 1),
  seismic: id(300, 2),
  flood: id(300, 3),
  fire: id(300, 4),
  stress: id(300, 5),
  hclConfiguration: id(300, 6),
} as const;

const COMPONENT_NODE_KEYS = [
  "EPS_A_DEP",
  "EPS_B_DEP",
  "RPS_DEP",
  "AFW_DEP",
  "PORV_DEP",
  "SEAL_DEP",
  "HPI_DEP",
  "FLEX_POWER_DEP",
  "FLEX_WATER_DEP",
  "RECOVERY_DEP",
] as const;

type ComponentNodeKey = typeof COMPONENT_NODE_KEYS[number];

const COMPONENT_NODE_IDS = Object.fromEntries(COMPONENT_NODE_KEYS.map((key, index) => [key, id(301, index + 1)])) as Record<ComponentNodeKey, string>;
const COMPONENT_OK_STATE_IDS = Object.fromEntries(COMPONENT_NODE_KEYS.map((key, index) => [key, id(302, index * 2 + 1)])) as Record<ComponentNodeKey, string>;
const COMPONENT_FAILED_STATE_IDS = Object.fromEntries(COMPONENT_NODE_KEYS.map((key, index) => [key, id(302, index * 2 + 2)])) as Record<ComponentNodeKey, string>;

const SEISMIC_STATES = Array.from({ length: 7 }, (_, index) => ({
  id: id(310, index + 1),
  code: index === 0 ? "NO_SEISMIC" : `PGA${String(index)}`,
  name: index === 0 ? "No seismic hazard" : `Seismic bin PGA${String(index)}`,
}));
const FLOOD_STATES = Array.from({ length: 7 }, (_, index) => ({
  id: id(311, index + 1),
  code: index === 0 ? "NO_FLOOD" : `W${String(index)}`,
  name: index === 0 ? "No external flood" : `External-flood bin W${String(index)}`,
}));
const FIRE_STATES = [
  { id: id(312, 1), code: "FALSE", name: "No internal fire" },
  { id: id(312, 2), code: "TRUE", name: "Internal fire" },
] as const;
const STRESS_STATES = [
  { id: id(313, 1), code: "NORMAL", name: "Normal" },
  { id: id(313, 2), code: "DEGRADED", name: "Degraded" },
  { id: id(313, 3), code: "SEVERE", name: "Severe" },
] as const;

const hazardNodes: BayesianNetworkChanceNode[] = [
  { id: BN_IDS.seismic, kind: "CHANCE_NODE", code: "SEISMIC-LEVEL", name: "Seismic hazard level", description: "No-hazard state plus the six dissertation PGA bins.", states: SEISMIC_STATES as [typeof SEISMIC_STATES[number], typeof SEISMIC_STATES[number], ...typeof SEISMIC_STATES[number][]] },
  { id: BN_IDS.flood, kind: "CHANCE_NODE", code: "FLOOD-LEVEL", name: "External-flood hazard level", description: "No-hazard state plus the six dissertation water-level bins.", states: FLOOD_STATES as [typeof FLOOD_STATES[number], typeof FLOOD_STATES[number], ...typeof FLOOD_STATES[number][]] },
  { id: BN_IDS.fire, kind: "CHANCE_NODE", code: "FIRE", name: "Internal fire state", description: "Internal fire remains inside the BN as in the dissertation implementation.", states: [...FIRE_STATES] },
  { id: BN_IDS.stress, kind: "CHANCE_NODE", code: "PLANT-CONDITION", name: "Shared plant condition", description: "Latent multi-hazard plant condition coupling the mapped PRA interfaces.", states: [...STRESS_STATES] },
];

const componentNodes: BayesianNetworkChanceNode[] = COMPONENT_NODE_KEYS.map((key) => ({
  id: COMPONENT_NODE_IDS[key],
  kind: "CHANCE_NODE",
  code: BASIC_EVENT_META[key].code,
  name: BASIC_EVENT_META[key].name,
  description: "Mapped PRA interface node conditioned on shared multi-hazard plant state and internal fire.",
  states: [
    { id: COMPONENT_OK_STATE_IDS[key], code: "FALSE", name: "Available" },
    { id: COMPONENT_FAILED_STATE_IDS[key], code: "TRUE", name: "Failed" },
  ],
}));

function rootCpt(nodeId: string, states: readonly { id: string }[], probabilities: number[], group: number): BayesianNetworkConditionalProbabilityTable {
  return {
    nodeId,
    parents: [],
    rows: [{ id: id(group, 1), parentStates: [], values: states.map((state, index) => ({ stateId: state.id, probability: probabilities[index]! })) as [{ stateId: string; probability: number }, { stateId: string; probability: number }, ...Array<{ stateId: string; probability: number }> ] }],
  };
}

const stressRows = SEISMIC_STATES.flatMap((seismicState, seismicIndex) => FLOOD_STATES.map((floodState, floodIndex) => {
  const intensity = Math.max(seismicIndex, floodIndex) / 6;
  const interaction = seismicIndex > 0 && floodIndex > 0 ? 0.13 * intensity : 0;
  const severe = Math.min(0.995, 0.0001 + 0.72 * intensity ** 2 + interaction);
  const degraded = Math.min(1 - severe, 0.0009 + 0.22 * intensity);
  return {
    id: id(320 + seismicIndex, floodIndex + 1),
    parentStates: [
      { parentNodeId: BN_IDS.seismic, stateId: seismicState.id },
      { parentNodeId: BN_IDS.flood, stateId: floodState.id },
    ],
    values: [
      { stateId: STRESS_STATES[0].id, probability: 1 - degraded - severe },
      { stateId: STRESS_STATES[1].id, probability: degraded },
      { stateId: STRESS_STATES[2].id, probability: severe },
    ] as [{ stateId: string; probability: number }, { stateId: string; probability: number }, { stateId: string; probability: number }],
  };
}));

function componentCpt(key: ComponentNodeKey, nodeIndex: number): BayesianNetworkConditionalProbabilityTable {
  const base = BASIC_EVENT_META[key].probability;
  return {
    nodeId: COMPONENT_NODE_IDS[key],
    parents: [{ nodeId: BN_IDS.stress, order: 0 }, { nodeId: BN_IDS.fire, order: 1 }],
    rows: STRESS_STATES.flatMap((stressState, stressIndex) => FIRE_STATES.map((fireState, fireIndex) => {
      const multiplier = [1, 18, 240][stressIndex]! * (fireIndex === 0 ? 1 : 35);
      const failed = Math.min(0.999999, base * multiplier);
      return {
        id: id(340 + nodeIndex, stressIndex * 2 + fireIndex + 1),
        parentStates: [
          { parentNodeId: BN_IDS.stress, stateId: stressState.id },
          { parentNodeId: BN_IDS.fire, stateId: fireState.id },
        ],
        values: [
          { stateId: COMPONENT_OK_STATE_IDS[key], probability: 1 - failed },
          { stateId: COMPONENT_FAILED_STATE_IDS[key], probability: failed },
        ] as [{ stateId: string; probability: number }, { stateId: string; probability: number }],
      };
    })),
  };
}

const bayesianNetwork: EsqBayesianNetwork = {
  modelId: BN_IDS.model,
  code: "BN-HCL-LOOP-SBO-FLEX",
  name: "LOOP–SBO–FLEX multi-hazard dependency network",
  description: "Discrete BN for the temporary dissertation HCL reproduction example: 7×7 seismic/flood evidence cells, internal fire, shared plant condition, and mapped PRA interface failures.",
  nodes: [...hazardNodes, ...componentNodes],
  edges: [
    { id: id(360, 1), parentNodeId: BN_IDS.seismic, childNodeId: BN_IDS.stress },
    { id: id(360, 2), parentNodeId: BN_IDS.flood, childNodeId: BN_IDS.stress },
    ...COMPONENT_NODE_KEYS.flatMap((key, index) => [
      { id: id(361, index * 2 + 1), parentNodeId: BN_IDS.stress, childNodeId: COMPONENT_NODE_IDS[key] },
      { id: id(361, index * 2 + 2), parentNodeId: BN_IDS.fire, childNodeId: COMPONENT_NODE_IDS[key] },
    ]),
  ],
  conditionalProbabilityTables: [
    rootCpt(BN_IDS.seismic, SEISMIC_STATES, [0.995, 0.003, 0.0012, 0.0005, 0.0002, 0.00008, 0.00002], 370),
    rootCpt(BN_IDS.flood, FLOOD_STATES, [0.996, 0.0025, 0.0009, 0.00035, 0.00015, 0.00007, 0.00003], 371),
    rootCpt(BN_IDS.fire, FIRE_STATES, [0.998, 0.002], 372),
    { nodeId: BN_IDS.stress, parents: [{ nodeId: BN_IDS.seismic, order: 0 }, { nodeId: BN_IDS.flood, order: 1 }], rows: stressRows },
    ...COMPONENT_NODE_KEYS.map(componentCpt),
  ],
  nodePositions: [
    { nodeId: BN_IDS.seismic, position: { x: 40, y: 40 } },
    { nodeId: BN_IDS.flood, position: { x: 40, y: 210 } },
    { nodeId: BN_IDS.fire, position: { x: 310, y: 360 } },
    { nodeId: BN_IDS.stress, position: { x: 330, y: 110 } },
    ...COMPONENT_NODE_KEYS.map((key, index) => ({ nodeId: COMPONENT_NODE_IDS[key], position: { x: 650 + (index % 2) * 280, y: 20 + Math.floor(index / 2) * 145 } })),
  ],
  layout: { viewport: { x: 0, y: 0, zoom: 0.72 }, mode: "MANUAL", direction: "LEFT_TO_RIGHT" },
};

SY_ANALYSIS_HCL.dependencyBayesianNetworks.push(bayesianNetwork);
HR_ANALYSIS_HCL.dependencyBayesianNetworks?.push(bayesianNetwork);
ES_ANALYSIS_HCL.dependencyModels?.bayesianNetworks?.push(bayesianNetwork);

const hclConfiguration: EsqHclConfiguration = {
  modelId: BN_IDS.hclConfiguration,
  code: "HCL-LOOP-SBO-FLEX",
  name: "Connected LOOP–SBO–FLEX HCL configuration",
  description: "Binds shared dependency basic events across all 22 fault-tree top events to the multi-hazard BN.",
  bayesianNetwork: { workbookId: PLACEHOLDER_ESQ_WORKBOOK_ID, modelId: BN_IDS.model },
  faultTrees: MODEL_KEYS.map((key) => ({ workbookId: PLACEHOLDER_SY_WORKBOOK_ID, modelId: MODEL_IDS[key] })),
  bindings: COMPONENT_NODE_KEYS.map((key, index) => ({
    id: id(380, index + 1),
    faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: PLACEHOLDER_SY_WORKBOOK_ID, entityId: BASIC_EVENT_IDS[key] },
    bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: PLACEHOLDER_ESQ_WORKBOOK_ID, modelId: BN_IDS.model, entityId: COMPONENT_NODE_IDS[key] },
    trueStateIds: [COMPONENT_FAILED_STATE_IDS[key]],
  })),
  baseEvidence: {
    observations: [
      { nodeId: BN_IDS.seismic, stateId: SEISMIC_STATES[0]!.id },
      { nodeId: BN_IDS.flood, stateId: FLOOD_STATES[0]!.id },
      { nodeId: BN_IDS.fire, stateId: FIRE_STATES[0].id },
    ],
  },
  solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
};

const hclFamilyQuantifications: EventSequenceQuantification["familyQuantifications"] = [
  {
    uuid: "EFQ-HCL-CD",
    name: "Core-damage reference family",
    eventSequenceFamilyRef: "ESF-HCL-CD",
    eventSequenceFamilyReference: { referenceType: "EVENT_SEQUENCE_FAMILY", workbookId: PLACEHOLDER_ES_WORKBOOK_ID, entityId: "ESF-HCL-CD" },
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "Reconstructed reference family used to carry the published baseline-cell contribution through the connected workbooks.",
    quantificationBasis: "POINT_ESTIMATE",
    meanFrequency: 2.82e-6,
    implementsSrs: [],
  },
  {
    uuid: "EFQ-HCL-LOCA",
    name: "LOCA reference family",
    eventSequenceFamilyRef: "ESF-HCL-LOCA",
    eventSequenceFamilyReference: { referenceType: "EVENT_SEQUENCE_FAMILY", workbookId: PLACEHOLDER_ES_WORKBOOK_ID, entityId: "ESF-HCL-LOCA" },
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "Reconstructed non-baseline contribution retained for the temporary end-to-end risk-integration example.",
    quantificationBasis: "POINT_ESTIMATE",
    meanFrequency: 6.4e-4,
    implementsSrs: [],
  },
  {
    uuid: "EFQ-HCL-ATWS",
    name: "ATWS reference family",
    eventSequenceFamilyRef: "ESF-HCL-ATWS",
    eventSequenceFamilyReference: { referenceType: "EVENT_SEQUENCE_FAMILY", workbookId: PLACEHOLDER_ES_WORKBOOK_ID, entityId: "ESF-HCL-ATWS" },
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "Reconstructed non-baseline contribution retained for the temporary end-to-end risk-integration example.",
    quantificationBasis: "POINT_ESTIMATE",
    meanFrequency: 3.28e-4,
    implementsSrs: [],
  },
];

const esqBase = createBlankEsq("HCL dissertation case study — ESQ", OWNER);

const ESQ_ANALYSIS_HCL: EventSequenceQuantification = {
  ...esqBase,
  uuid: HCL_CASE_ESQ_UUID,
  name: "HCL dissertation case study — Quantification",
  created: NOW,
  modified: NOW,
  metadata: {
    ...esqBase.metadata,
    versionInfo: { ...esqBase.metadata.versionInfo, lastUpdated: NOW },
    analysisDate: NOW,
    analysts: [OWNER],
    scope: "Temporary exact-HCL verification of the dissertation LOOP → SBO → FLEX case.",
    limitations: ["The seed distinguishes published reference targets from reconstructed inputs; exact agreement requires the dissertation source XML, YAML, XDSL, and 52-event mapping package."],
    lastModifiedDate: NOW,
    lastModifiedBy: OWNER,
  },
  praScope: "Exact BN inference and HCL quantification over the linked case-study fault trees and event trees.",
  familyQuantifications: hclFamilyQuantifications,
  bayesianNetworks: [bayesianNetwork],
  hclConfigurations: [hclConfiguration],
  modelIntegration: {
    ...esqBase.modelIntegration,
    integrationMethod: "Full-context HCL with exact BN inference and BDD fault-tree logic.",
    softwareTools: ["PRAETOR", "PRAXIS", "TensorBayes", "Node addon"],
    integrationSteps: ["Select seismic, flood, and fire evidence", "Evaluate mapped BN states", "Substitute mapped basic events into FT BDDs", "Quantify event-tree success, failure, and bypass paths"],
    integrationVerification: "Compare baseline and 49 hazard-cell outputs with the published Chapter 9 targets.",
    scopeCoverage: {
      radionuclideSources: ["REACTOR-CORE"],
      initiatingEventGroups: ["IEG-LOOP-HCL"],
      hazardGroups: ["SEISMIC", "EXTERNAL_FLOOD", "INTERNAL_FIRE"],
      plantOperatingStates: ["POS-FULL-POWER"],
      plantEvolutions: ["LOOP", "SBO", "FLEX"],
    },
    systemDependenciesAccounted: true,
  },
  quantificationMethods: {
    ...esqBase.quantificationMethods,
    methodDiscriminationJustification: "HCL is required because mapped basic events are dependent through the BN and success branches require exact complements.",
    computerCodes: [
      {
        name: "PRAXIS",
        version: "workspace",
        verificationDocumentation: "Repository unit and integration tests",
        validationDocumentation: "Compared with the dissertation's published HCL targets.",
        benchmarkComparison: "Baseline-cell and 49-cell dissertation results are retained as regression targets.",
        methodSpecificLimitations: ["The public dissertation does not include every original model input."],
        methodSpecificFeatures: ["Fault-tree BDD and event-tree sequence quantification"],
        implementsSrs: [],
      },
      {
        name: "TensorBayes",
        version: "workspace",
        verificationDocumentation: "Repository unit and integration tests",
        validationDocumentation: "Exact finite-state BN cases are checked against analytic reference calculations.",
        benchmarkComparison: "The HCL evidence grid is compared with the dissertation's published risk matrix.",
        methodSpecificLimitations: ["The reconstructed CPTs remain provisional until the original case-study input files are recovered."],
        methodSpecificFeatures: ["Exact BN junction-tree inference"],
        implementsSrs: [],
      },
    ],
  },
  parameterConsistency: {
    ...esqBase.parameterConsistency,
    hrParameterConsistency: true,
    daParameterConsistency: true,
    sequenceConditionsConsidered: true,
    harshEnvironmentsConsidered: true,
    basis: "All mapped dependencies are evaluated in the same BN evidence context for each hazard cell.",
  },
  systemSuccessTreatment: {
    ...esqBase.systemSuccessTreatment,
    treatmentMethod: "Every success branch is the exact Boolean complement of its linked fault-tree failure formula.",
    systemsWithSuccessModeled: MODEL_KEYS.map((key) => MODEL_META[key].code),
    impactOnResults: "Preserves the negative-variable semantics used by the dissertation HCL calculation.",
    modelingExamples: ["AFW success and failure branches share one exact BN/BDD context rather than independent branch marginals."],
  },
  dependencyTreatment: {
    ...esqBase.dependencyTreatment,
    dependenciesByType: [
      { type: DependencyType.FUNCTIONAL, treatmentDescription: "BN-bound mapped basic events", modelingMethod: "Exact HCL substitution", examples: ["Shared plant condition couples EPS, AFW, HPI, FLEX, and recovery"] },
      { type: DependencyType.PHENOMENOLOGICAL, treatmentDescription: "Evidence-conditioned BN CPTs", modelingMethod: "Exact BN inference", examples: ["Seismic and flood interaction modifies shared plant condition"] },
      { type: DependencyType.COMMON_CAUSE, treatmentDescription: "Shared BN nodes and shared basic-event identities", modelingMethod: "Shared dependent node bindings", examples: ["AFW delivery paths share AFW-DEP"] },
    ],
    recoveryDependencyTreatment: "Grid and diesel recovery events share the RECOVERY-DEP BN node.",
  },
  uncertaintyPropagation: {
    ...esqBase.uncertaintyPropagation,
    uuid: id(4, 1),
    propagationMethod: "MONTE_CARLO",
    characterizationLevel: "CHARACTERIZED",
    stateOfKnowledgeCorrelation: {
      isConsidered: true,
      handlingMethod: "OTHER",
      handlingDescription: "Shared BN context",
    },
  },
  modelUncertainty: { ...esqBase.modelUncertainty, uuid: id(4, 2), name: "HCL dissertation reproduction model uncertainty" },
  documentation: {
    ...esqBase.documentation,
    processDescription: "Runs the exact HCL bridge from BN evidence through mapped FT basic events and connected event-tree paths.",
    inputsDescription: "IE LOOP frequency, 22 SY fault trees, three ES event trees, BN CPTs, HCL bindings, and hazard evidence.",
    appliedMethods: "Exact junction-tree BN inference, BDD fault-tree quantification, and exact success-complement event-tree formulas.",
    resultsSummary: "Published comparison targets: baseline conditional CD probability 3.37E-6; baseline-cell contribution 2.82E-6/yr; 49-cell total 9.71E-4/yr; upgraded-defense total 1.76E-4/yr.",
    quantificationProcessDescription: "Choose evidence, run BN inference if desired, then run the HCL configuration against a fault-tree top event or linked event tree.",
    uncertaintySensitivityResults: "The evidence grid exposes the six seismic and six flood bins plus no-hazard states; internal fire remains inside the BN.",
    codeVerificationProcess: "Use the published baseline and 49-cell matrix as external regression targets once the complete source model is available.",
    limitationsForApplications: "This temporary seed is an executable reproduction scaffold, not a substitute for the unpublished complete dissertation input package.",
    praTaskInterfaces: "Consumes IE, SY, and ES case-study examples and supplies exact HCL outputs for verification.",
  },
};

const hclConsequenceByFamily = [
  { familyId: "ESF-HCL-CD", resultId: "RCQ-HCL-CD", releaseCategory: "RC-CORE-DAMAGE", consequence: 1 },
  { familyId: "ESF-HCL-LOCA", resultId: "RCQ-HCL-LOCA", releaseCategory: "RC-LOCA", consequence: 0.25 },
  { familyId: "ESF-HCL-ATWS", resultId: "RCQ-HCL-ATWS", releaseCategory: "RC-ATWS", consequence: 0.4 },
] as const;

const rcBase = createBlankRc("HCL dissertation case study — RC", OWNER);
const RC_ANALYSIS_HCL: RadiologicalConsequenceAnalysis = {
  ...rcBase,
  uuid: HCL_CASE_RC_UUID,
  name: "HCL dissertation case study — Consequences",
  created: NOW,
  modified: NOW,
  metadata: {
    ...rcBase.metadata,
    versionInfo: { ...rcBase.metadata.versionInfo, lastUpdated: NOW },
    analysisDate: NOW,
    analysts: [OWNER],
    scope: "Temporary consequence records that make the connected HCL example quantifiable through Risk Integration.",
    limitations: ["The consequence index is an explicit verification measure, not a claim that the dissertation supplied a complete offsite-consequence model."],
    lastModifiedDate: NOW,
    lastModifiedBy: OWNER,
  },
  praScope: "Maps each release-bearing dissertation-source event-sequence family to a transparent reference consequence index.",
  scope: {
    ...rcBase.scope,
    consequenceMetrics: ["Reference consequence index"],
    metricSelectionApplicationBasis: "A dimensionless verification measure keeps the temporary example focused on the connected quantification workflow.",
  },
  releaseCategoryToConsequence: {
    ...rcBase.releaseCategoryToConsequence,
    releaseCategoryInputs: hclConsequenceByFamily.map((entry) => ({
      releaseCategory: entry.releaseCategory,
      eventSequenceFamilyReferences: [{
        referenceType: "EVENT_SEQUENCE_FAMILY",
        workbookId: PLACEHOLDER_ES_WORKBOOK_ID,
        entityId: entry.familyId,
      }],
      releaseCharacteristics: { numberOfPlumes: 1 },
    })),
    releaseCategoryAndSourceTermReviewed: true,
  },
  consequenceQuantification: {
    ...rcBase.consequenceQuantification,
    consequenceCodesUsed: [{ code: "Reference arithmetic", benchmarkBasis: "Closed-form multiplication in the connected regression." }],
    eventSequenceConsequences: hclConsequenceByFamily.map((entry) => ({
      uuid: entry.resultId,
      eventSequenceFamily: entry.familyId,
      eventSequenceFamilyReference: {
        referenceType: "EVENT_SEQUENCE_FAMILY",
        workbookId: PLACEHOLDER_ES_WORKBOOK_ID,
        entityId: entry.familyId,
      },
      releaseCategoryReference: entry.releaseCategory,
      consequenceResults: [{ metric: "Reference consequence index", meanValue: entry.consequence, unit: "index per event" }],
      riskSignificance: entry.familyId === "ESF-HCL-CD" ? ImportanceLevel.HIGH : ImportanceLevel.MEDIUM,
    })),
    outputReview: { performed: true, indicationsFound: [], acceptanceJustifications: ["The three records reconcile one-to-one with the release-bearing ES families."] },
    resultsConfirmation: { performed: true, description: "The connected regression independently repeats every frequency-consequence product." },
  },
  riskIntegrationFeedback: {
    analysisRef: "RI-RESULTS-HCL",
    integratedRiskResultReference: {
      referenceType: "INTEGRATED_RISK_RESULT",
      workbookId: PLACEHOLDER_RI_WORKBOOK_ID,
      entityId: "RI-RESULTS-HCL",
    },
    generalFeedback: "The consequence records are linked to the temporary integrated-risk result.",
  },
  documentation: {
    ...rcBase.documentation,
    processDescription: "Assign one transparent reference consequence to each release-bearing event-sequence family.",
    inputsDescription: "The ES family/end-state catalogue from the dissertation-source example.",
    appliedMethods: "Direct reference-index assignment for connection verification.",
    resultsSummary: "Three linked consequence records are available to RI.",
    rcqProcess: "The record identity, family identity, and consequence measure are preserved across the RC-to-RI handoff.",
    praTaskInterfaces: "Consumes ES families and supplies controlled consequence-result references to RI.",
  },
};

const riBase = createBlankRi("HCL dissertation case study — RI", OWNER);
const hclCompiledInputs: RiskIntegration["compiledRiskInputs"] = hclFamilyQuantifications.map((quantification) => {
  const consequence = hclConsequenceByFamily.find((entry) => entry.familyId === quantification.eventSequenceFamilyRef)!;
  return {
    uuid: `RII-${quantification.eventSequenceFamilyRef}`,
    eventSequenceFamilyRef: quantification.eventSequenceFamilyRef,
    eventSequenceFamilyReference: {
      referenceType: "EVENT_SEQUENCE_FAMILY",
      workbookId: PLACEHOLDER_ES_WORKBOOK_ID,
      entityId: quantification.eventSequenceFamilyRef,
    },
    releaseCategoryRef: consequence.releaseCategory,
    frequency: typeof quantification.meanFrequency === "number" ? quantification.meanFrequency : quantification.meanFrequency.value,
    frequencyUnit: "per plant-year",
    esqFamilyQuantificationRef: quantification.uuid,
    familyQuantificationReferences: [{
      referenceType: "EVENT_SEQUENCE_FAMILY_QUANTIFICATION",
      workbookId: PLACEHOLDER_ESQ_WORKBOOK_ID,
      entityId: quantification.uuid,
    }],
    consequences: [{ metric: "Reference consequence index", meanValue: consequence.consequence, unit: "index per event" }],
    rcqRecordRef: consequence.resultId,
    consequenceResultReference: {
      referenceType: "RADIOLOGICAL_CONSEQUENCE_RESULT",
      workbookId: PLACEHOLDER_RC_WORKBOOK_ID,
      entityId: consequence.resultId,
    },
    consistentWithEventSequenceAnalysis: true,
    implementsSrs: [],
  };
});
const hclIntegratedRisk = hclCompiledInputs.reduce(
  (sum, input) => sum + input.frequency * input.consequences[0]!.meanValue,
  0,
);

const RI_ANALYSIS_HCL: RiskIntegration = {
  ...riBase,
  uuid: HCL_CASE_RI_UUID,
  name: "HCL dissertation case study — Integrated Risk",
  created: NOW,
  modified: NOW,
  metadata: {
    ...riBase.metadata,
    versionInfo: { ...riBase.metadata.versionInfo, lastUpdated: NOW },
    analysisDate: NOW,
    analysts: [OWNER],
    scope: "Temporary end-to-end integration of the dissertation-source ESQ frequencies and RC reference consequences.",
    limitations: ["The reference consequence index verifies connectivity and arithmetic; it is not an offsite health-risk result."],
    lastModifiedDate: NOW,
    lastModifiedBy: OWNER,
  },
  praScope: "Demonstrates controlled ES, ESQ, RC, and RI result linkage and a reproducible sum of frequency-consequence products.",
  scopeDefinition: {
    consequenceMeasures: [{ name: "Reference consequence index", description: "Dimensionless temporary verification measure." }],
    plantOperatingStateRefs: ["POS-FULL-POWER"],
    hazardGroups: ["SEISMIC", "EXTERNAL_FLOOD", "INTERNAL_FIRE"],
    radioactiveMaterialSources: ["REACTOR-CORE"],
    eventSequenceFamilyRefs: hclCompiledInputs.map((input) => input.eventSequenceFamilyRef),
    releaseCategoryRefs: hclConsequenceByFamily.map((entry) => entry.releaseCategory),
  },
  compiledRiskInputs: hclCompiledInputs,
  integratedRiskResults: {
    ...riBase.integratedRiskResults,
    uuid: "RI-RESULTS-HCL",
    name: "Connected dissertation-source reference result",
    description: "Closed-form sum of each linked ESQ family frequency multiplied by its linked RC consequence index.",
    metrics: [{
      uuid: "METRIC-HCL-REFERENCE",
      name: "Integrated reference risk",
      metricType: "CUSTOM",
      consequenceMeasureRef: "Reference consequence index",
      value: hclIntegratedRisk,
      units: "index per plant-year",
      implementsSrs: [],
    }],
    calculationApproach: {
      sumOfProducts: true,
      frequencyConsequencePlots: true,
      justification: "Each family contributes its ESQ mean frequency multiplied by its RC reference consequence.",
    },
    aggregationApproach: {
      description: "Direct family-level sum without additional grouping.",
      perSourceHazardContributionsIdentified: true,
      justification: "The three family products are visible and independently reproducible.",
    },
  },
  integrationMethods: [{
    uuid: "RIM-HCL-SUM",
    name: "Linked sum of products",
    description: "Resolve controlled ESQ and RC records, multiply family by family, and sum.",
    scopeJustification: "Covers all three release-bearing families in the temporary example.",
    verificationStatus: { verified: true, verificationMethod: "Connected regression and closed-form calculation." },
    implementsSrs: [],
  }],
  documentation: {
    ...riBase.documentation,
    processDescription: "Resolve the linked family, frequency-result, and consequence-result references before integration.",
    inputsDescription: "Three ES families, three ESQ family quantifications, and three RC consequence records.",
    appliedMethods: "Family-level sum of frequency-consequence products.",
    resultsSummary: `Integrated reference risk ${hclIntegratedRisk.toExponential(5)} index per plant-year.`,
    traceabilityToUpstreamContributions: "Every compiled row carries typed ES, ESQ, and RC workbook references.",
    integratedContributorRollup: "The visible family products sum exactly to the integrated metric.",
    praTaskInterfaces: "Consumes controlled ESQ and RC results and provides the linked RI result back to RC.",
  },
};

export {
  HCL_CASE_ID,
  HCL_CASE_LABEL,
  HCL_CASE_IE_UUID,
  HCL_CASE_SY_UUID,
  HCL_CASE_DA_UUID,
  HCL_CASE_HR_UUID,
  HCL_CASE_ES_UUID,
  HCL_CASE_ESQ_UUID,
  HCL_CASE_RC_UUID,
  HCL_CASE_RI_UUID,
  MODEL_IDS as HCL_CASE_FAULT_TREE_MODEL_IDS,
  TOP_GATE_IDS as HCL_CASE_FAULT_TREE_TOP_GATE_IDS,
  BASIC_EVENT_IDS as HCL_CASE_BASIC_EVENT_IDS,
  ET_IDS as HCL_CASE_EVENT_TREE_IDS,
  BN_IDS as HCL_CASE_BAYESIAN_IDS,
  IE_ANALYSIS_HCL,
  SY_ANALYSIS_HCL,
  DA_ANALYSIS_HCL,
  HR_ANALYSIS_HCL,
  ES_ANALYSIS_HCL,
  ESQ_ANALYSIS_HCL,
  RC_ANALYSIS_HCL,
  RI_ANALYSIS_HCL,
};
