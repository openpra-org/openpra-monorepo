import {
  type InitiatingEventsAnalysis,
  type InitiatorDefinition,
  type InitiatingEventGroup,
  type HazardAnalysis,
  type InitiatingEventFrequencyQuantification,
  type InitiatingEventScreeningRecord,
  InitiatingEventCategory,
  BarrierImpactState,
} from "interfaces-mef-types/ie/initiating-event-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { FrequencyUnit, type FrequencyWithDistribution } from "interfaces-mef-types/core/events";
import { ImportanceLevel, ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import { type SRReference } from "interfaces-mef-types/core/pra-common";

const POS_STATES = ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"];

function sr(code: string, hlr: SRReference["hlr"]): SRReference {
  return { sr: code, hlr };
}

function freq(value: number): FrequencyWithDistribution {
  return { value, units: FrequencyUnit.PER_PLANT_YEAR };
}

interface InitiatorSeed {
  id: string;
  name: string;
  category: InitiatingEventCategory;
  subcategory: string;
  states: string[];
  method: string;
  trip: string;
  safety: string[];
  barrier: BarrierImpactState;
  frequency: number;
  screening: ScreeningStatus;
  importance: ImportanceLevel;
  groupId?: string;
  basis: string;
}

const INITIATOR_SEEDS: InitiatorSeed[] = [
  { id: "IE-01", name: "Loss of offsite power (LOOP)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Loss of AC power", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-07"], method: "GENLIST", trip: "Bus undervoltage", safety: ["Heat removal"], barrier: BarrierImpactState.INTACT, frequency: 3.1e-2, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, groupId: "IEG-TRANS", basis: "Generic LWR/SFR operating experience filtered for plant applicability." },
  { id: "IE-02", name: "Turbine / sCO2 power-conversion trip", category: InitiatingEventCategory.TRANSIENT, subcategory: "Loss of power conversion", states: ["POS-01", "POS-02"], method: "HBFT", trip: "Turbine trip signal", safety: ["Heat removal"], barrier: BarrierImpactState.INTACT, frequency: 1.2e0, screening: ScreeningStatus.MERGED, importance: ImportanceLevel.MEDIUM, groupId: "IEG-TRANS", basis: "Heat-balance fault tree on the power-conversion train." },
  { id: "IE-04", name: "Loss of primary sodium flow", category: InitiatingEventCategory.TRANSIENT, subcategory: "Primary pump trip (ULOF precursor)", states: ["POS-01", "POS-02"], method: "MLD", trip: "Low primary flow", safety: ["Heat removal", "Reactivity control"], barrier: BarrierImpactState.INTACT, frequency: 4.5e-2, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, groupId: "IEG-LOFA", basis: "Master logic diagram, flow-to-power branch." },
  { id: "IE-05", name: "Loss of heat sink (IHX / intermediate loop)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Loss of normal heat removal", states: ["POS-01", "POS-02", "POS-03", "POS-08"], method: "HBFT", trip: "Intermediate-loop low flow", safety: ["Heat removal"], barrier: BarrierImpactState.INTACT, frequency: 2.7e-2, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, groupId: "IEG-LOHS", basis: "Design-based estimate for intermediate-loop faults." },
  { id: "IE-08", name: "Small primary sodium boundary leak", category: InitiatingEventCategory.RCB_BREACH, subcategory: "Small breach", states: ["POS-01", "POS-03", "POS-04", "POS-07"], method: "MLD", trip: "Sodium leak / level", safety: ["Coolant inventory", "Radionuclide retention"], barrier: BarrierImpactState.BREACHED, frequency: 1.4e-3, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, groupId: "IEG-RCB", basis: "Generic boundary-leak data, sodium-systems adjusted." },
  { id: "IE-09", name: "Large primary boundary breach (RPV)", category: InitiatingEventCategory.RCB_BREACH, subcategory: "Excessive breach", states: ["POS-01"], method: "MLD", trip: "Rapid level loss", safety: ["Coolant inventory", "Radionuclide retention"], barrier: BarrierImpactState.BREACHED, frequency: 1.0e-6, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, groupId: "IEG-RCB", basis: "Cannot be screened: breaches a radionuclide transport barrier (IE-C9 precondition)." },
  { id: "IE-11", name: "Cover-gas system breach (bypass)", category: InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, subcategory: "Radionuclide bypass", states: ["POS-01", "POS-06", "POS-09"], method: "FMEA", trip: "Cover-gas pressure / activity", safety: ["Radionuclide retention"], barrier: BarrierImpactState.BYPASSED, frequency: 2.2e-4, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "Interfacing-system path bypasses containment, retained regardless of frequency." },
  { id: "IE-13", name: "Loss of DC bus / instrument power", category: InitiatingEventCategory.SPECIAL, subcategory: "Support-system failure", states: ["POS-01", "POS-03", "POS-04"], method: "FMEA", trip: "Bus undervoltage", safety: ["Heat removal", "Reactivity control"], barrier: BarrierImpactState.INTACT, frequency: 1.6e-2, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, groupId: "IEG-TRANS", basis: "Support-system FMEA to train level." },
  { id: "IE-15", name: "Internal fire (primary sodium cell)", category: InitiatingEventCategory.INTERNAL_HAZARD, subcategory: "Sodium fire", states: ["POS-01", "POS-08"], method: "MLD", trip: "Fire / smoke detection", safety: ["Heat removal", "Radionuclide retention"], barrier: BarrierImpactState.DEGRADED, frequency: 5.0e-3, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "Frequency developed in the Internal Fire PRA and imported here." },
  { id: "IE-17", name: "Seismic event (design-basis ground motion)", category: InitiatingEventCategory.EXTERNAL_HAZARD, subcategory: "Seismic", states: ["POS-01"], method: "OEREV", trip: "Seismic trip", safety: ["Heat removal", "Reactivity control", "Coolant inventory"], barrier: BarrierImpactState.DEGRADED, frequency: 1.0e-4, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "Hazard frequency from the Seismic PRA, combined with sodium fire." },
  { id: "IE-18", name: "Erroneous RCS drain-down (shutdown)", category: InitiatingEventCategory.HUMAN_FAILURE, subcategory: "At-initiator human failure", states: ["POS-04", "POS-05"], method: "FMEA", trip: "Level deviation", safety: ["Coolant inventory", "Heat removal"], barrier: BarrierImpactState.INTACT, frequency: 4.0e-3, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "Split-fraction operator contribution per IE-C13, HRA input pending." },
];

function buildInitiator(seed: InitiatorSeed): InitiatorDefinition {
  return {
    uuid: seed.id,
    name: seed.name,
    eventType: "INITIATING",
    frequency: freq(seed.frequency),
    category: seed.category,
    subcategory: seed.subcategory,
    applicableStates: seed.states,
    groupId: seed.groupId,
    identificationMethodIds: [seed.method],
    identificationBasis: [seed.basis],
    tripParameters: [{ parameter: seed.trip, setpoint: 0, uncertainty: 0, basis: seed.basis }],
    mitigatingSystems: seed.safety.map((fn) => ({ systemId: `SYS-${fn.replace(/\s+/g, "-").toUpperCase()}`, function: fn, successCriteriaIds: [], dependencies: [] })),
    barrierImpacts: [{ barrierId: "RCB", state: seed.barrier, timing: "At initiation", mechanism: seed.subcategory }],
    challengedSafetyFunctions: seed.safety,
    screeningStatus: seed.screening,
    importanceLevel: seed.importance,
    implementsSrs: [sr("IE-A5", "A")],
  };
}

const INITIATORS: InitiatorDefinition[] = INITIATOR_SEEDS.map(buildInitiator);

const GROUPS: InitiatingEventGroup[] = [
  { uuid: "IEG-TRANS", name: "General transient group", description: "Transients that keep the RCB intact.", memberInitiatorIds: ["IE-01", "IE-02", "IE-13"], groupingBasis: "All keep the RCB intact and demand the same heat-removal and reactivity-control functions. LOOP bounds the group.", boundingInitiatorId: "IE-01", similarMitigationRequirements: ["Heat removal", "Reactivity control"], groupingDoesNotMaskRiskSignificantSequences: true, comparableImpactAcrossMembers: true, challengedSafetyFunctions: ["Heat removal", "Reactivity control"], applicableStates: ["POS-01", "POS-02", "POS-03"], meanFrequency: freq(2.6e0), riskImportance: ImportanceLevel.HIGH, implementsSrs: [sr("IE-B4", "B")] },
  { uuid: "IEG-LOHS", name: "Loss of heat sink group", description: "Loss of the normal heat-removal path.", memberInitiatorIds: ["IE-05"], groupingBasis: "Events that remove the normal heat-removal path and rely on DRACS as the backup.", boundingInitiatorId: "IE-05", similarMitigationRequirements: ["Heat removal"], groupingDoesNotMaskRiskSignificantSequences: true, comparableImpactAcrossMembers: true, challengedSafetyFunctions: ["Heat removal"], applicableStates: ["POS-01", "POS-02", "POS-03", "POS-08"], meanFrequency: freq(4.7e-2), riskImportance: ImportanceLevel.HIGH, implementsSrs: [sr("IE-B4", "B")] },
  { uuid: "IEG-LOFA", name: "Loss-of-flow / reactivity group", description: "Challenges to the flow-to-power balance.", memberInitiatorIds: ["IE-04"], groupingBasis: "Loss of primary flow bounds the group for cladding thermal margin.", boundingInitiatorId: "IE-04", similarMitigationRequirements: ["Heat removal", "Reactivity control"], groupingDoesNotMaskRiskSignificantSequences: false, comparableImpactAcrossMembers: true, challengedSafetyFunctions: ["Heat removal", "Reactivity control"], applicableStates: ["POS-01", "POS-02"], meanFrequency: freq(5.4e-2), riskImportance: ImportanceLevel.HIGH, implementsSrs: [sr("IE-B4", "B")] },
  { uuid: "IEG-RCB", name: "RCB breach group (by size)", description: "Reactor coolant boundary breaches grouped by size.", memberInitiatorIds: ["IE-08", "IE-09"], groupingBasis: "Breaches grouped by size and location. The large breach bounds inventory-loss timing.", boundingInitiatorId: "IE-09", similarMitigationRequirements: ["Coolant inventory", "Radionuclide retention"], groupingDoesNotMaskRiskSignificantSequences: true, comparableImpactAcrossMembers: false, challengedSafetyFunctions: ["Coolant inventory", "Radionuclide retention"], applicableStates: ["POS-01", "POS-03", "POS-04", "POS-07"], meanFrequency: freq(2.3e-3), riskImportance: ImportanceLevel.MEDIUM, implementsSrs: [sr("IE-B4", "B")] },
];

const HAZARDS: HazardAnalysis[] = [
  { uuid: "HZ-FIRE", name: "Internal fire", description: "Sodium-cell fire.", hazardType: "INTERNAL", subcategory: "Sodium fire", severityLevels: ["Design-basis"], affectedAreas: ["Primary sodium cell", "Cable spreading room"], radionuclideBarrierIds: ["RCB"], inducingMechanisms: ["Sodium leak ignition"], inducedInitiatorIds: ["IE-15"], potentialCombinations: ["CMB-1"], analysisMethods: ["MLD"], screeningStatus: ScreeningStatus.RETAINED, screeningBasis: "Sodium-fire frequency developed in element F and handed to IE.", implementsSrs: [sr("IE-A5", "A")] },
  { uuid: "HZ-SEIS", name: "Seismic", description: "Design-basis ground motion.", hazardType: "EXTERNAL", subcategory: "Seismic", severityLevels: ["Design-basis"], affectedAreas: ["Whole plant"], radionuclideBarrierIds: ["RCB"], inducingMechanisms: ["Ground motion"], inducedInitiatorIds: ["IE-17"], potentialCombinations: ["CMB-1"], analysisMethods: ["OEREV"], screeningStatus: ScreeningStatus.RETAINED, screeningBasis: "Design-basis ground-motion fragilities from element S drive initiator IE-17.", implementsSrs: [sr("IE-A6", "A")] },
];

const SCREENING: InitiatingEventScreeningRecord[] = [
  { initiatorOrGroupId: "IE-02", retained: false, criterion: "SCR-1", barrierIntegrityPreconditionMet: true, justification: "Same plant impact as the bounding general transient (IE-01) which has a higher frequency. Subsumed into IEG-TRANS.", implementsSrs: [sr("IE-C9", "C")] },
  { initiatorOrGroupId: "IE-09", retained: true, barrierIntegrityPreconditionMet: false, justification: "Cannot be screened. The event breaches a radionuclide transport barrier, so the IE-C9(a) precondition fails regardless of its frequency. Retained for full analysis.", implementsSrs: [sr("IE-C9", "C")] },
];

const QUANTIFICATIONS: InitiatingEventFrequencyQuantification[] = [
  { initiatorOrGroupId: "IEG-TRANS", meanFrequency: freq(2.6e0), basis: "GENERIC_DATA", plantCalendarYearBasis: true, posTimeFractionApplied: true, dataSourceJustification: "Generic transient frequencies, plant-calendar-year basis.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8", "C")] },
  { initiatorOrGroupId: "IEG-LOHS", meanFrequency: freq(4.7e-2), basis: "DESIGN_BASED", plantCalendarYearBasis: true, posTimeFractionApplied: true, dataSourceJustification: "Design-based estimate for intermediate-loop faults.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8", "C")] },
  { initiatorOrGroupId: "IEG-LOFA", meanFrequency: freq(5.4e-2), basis: "DESIGN_BASED", plantCalendarYearBasis: true, posTimeFractionApplied: true, dataSourceJustification: "Pump coastdown credit from prototype-scale data.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8", "C")] },
  { initiatorOrGroupId: "IEG-RCB", meanFrequency: freq(2.3e-3), basis: "SIMILAR_PLANT_DATA", plantCalendarYearBasis: true, posTimeFractionApplied: true, dataSourceJustification: "Similar-plant boundary-breach data.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8", "C")] },
  { initiatorOrGroupId: "IE-11", meanFrequency: freq(2.2e-4), basis: "DESIGN_BASED", plantCalendarYearBasis: true, posTimeFractionApplied: true, dataSourceJustification: "Cover-gas boundary design analysis.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8", "C")] },
  { initiatorOrGroupId: "IE-15", meanFrequency: freq(5.0e-3), basis: "FAULT_TREE", plantCalendarYearBasis: true, posTimeFractionApplied: true, dataSourceJustification: "Internal Fire PRA fault tree.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8", "C")] },
  { initiatorOrGroupId: "IE-17", meanFrequency: freq(1.0e-4), basis: "DESIGN_BASED", plantCalendarYearBasis: true, posTimeFractionApplied: false, dataSourceJustification: "Seismic hazard curve already integrates over time.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8", "C")] },
  { initiatorOrGroupId: "IE-18", meanFrequency: freq(4.0e-3), basis: "DESIGN_BASED", plantCalendarYearBasis: true, posTimeFractionApplied: true, dataSourceJustification: "Operator drain-down split fraction per IE-C13.", recoveryActionsIncluded: true, implementsSrs: [sr("IE-C8", "C")] },
];

const NOW = "2026-04-22T12:00:00.000Z";

export const IE_ANALYSIS: InitiatingEventsAnalysis = {
  uuid: "ie-generic-1",
  name: "IE Workbook Example",
  type: TechnicalElementTypes.INITIATING_EVENT_ANALYSIS,
  version: "3",
  created: "2026-04-16T12:00:00.000Z",
  modified: NOW,
  owner: "apatel",
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: "2026-04-16T12:00:00.000Z", actor: "apatel" }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "3", lastUpdated: NOW, schemaVersion: "0.0.1" },
    analysisDate: NOW,
    analysts: ["apatel"],
    reviewers: [],
    scope: "Initiating Event Analysis for Generic-1, a 300 MWt sodium-cooled fast reactor (pre-operational).",
    limitations: [],
    lastModifiedDate: NOW,
    lastModifiedBy: "apatel",
    plantIdentity: {
      name: "Generic-1",
      vendor: "Generic Atomics",
      reactorType: "Sodium-cooled fast reactor (SFR)",
      thermalPower: "300 MWt",
      primaryCoolant: "Sodium",
    },
  },
  conformanceMatrix: [],
  internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Internal events at-power and low-power/shutdown for Generic-1.",
  includesNonInternalHazardGroups: true,
  applicablePlantOperatingStates: POS_STATES,
  initiators: INITIATORS,
  initiatingEventGroups: GROUPS,
  completenessSearch: {
    functionalCategoriesCovered: [
      InitiatingEventCategory.TRANSIENT,
      InitiatingEventCategory.RCB_BREACH,
      InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH,
      InitiatingEventCategory.SPECIAL,
      InitiatingEventCategory.INTERNAL_HAZARD,
      InitiatingEventCategory.EXTERNAL_HAZARD,
      InitiatingEventCategory.HUMAN_FAILURE,
    ],
    perSystemSearchPerformed: true,
    perSupportSystemSearchPerformed: true,
    multiReactorEventsAddressed: false,
    radioactiveSourceMechanismsAddressed: true,
    implementsSrs: [sr("IE-A9", "A"), sr("IE-A15", "A")],
  },
  hazardAnalyses: HAZARDS,
  quantifications: QUANTIFICATIONS,
  screeningRecords: SCREENING,
  documentation: {
    processDescription: "Initiating events identified by a structured, systematic process across the seven IE-A5 categories.",
    inputSources: "POS workbook (operating states and sources), generic SFR data, NUREG/CR-5750, EPRI shutdown catalog.",
    appliedMethods: "Master logic diagram, FMEA, heat-balance fault trees, operating-experience review, generic catalog.",
    resultsSummary: "Eleven initiators identified across all seven challenge categories, grouped into four bounding cases.",
    functionalCategoriesConsidered: "All seven IE-A5 functional categories considered.",
    plantUniqueInitiatorsSearch: "Sodium-systems and cover-gas faults searched via HAZOPS overlay.",
    stateSpecificInitiatorsSearch: "Each initiator tested in every applicable operating state.",
    rcbFailureSearch: "RCB breach search by size and location.",
    completenessAssessment: "Per-system and support-system sweeps complete; HTGR online-refuelling OE review open.",
    groupingProcessAndBasis: "Events grouped under bounding cases where mitigation requirements are similar.",
    screeningProcessAndBasis: "Barrier-integrity precondition enforced before any SCR test (IE-C9).",
    frequencyDerivation: "Frequencies on a plant-calendar-year basis, POS time-fraction applied (IE-C8).",
    quantificationApproach: "Mean and uncertainty for risk-significant initiators; hazard curves for seismic.",
    dataSourceJustification: "Generic and design-based data for the pre-operational stage (IE-C2).",
    modelUncertaintySources: "Pump coastdown credit and operator split fractions identified as uncertainty sources.",
    asBuiltLimitations: "Pre-operational; several assumptions close at commissioning.",
    praTaskInterfaces: "Feeds Event Sequence Analysis (ES) and Event Sequence Quantification (ESQ).",
    implementsSrs: [sr("IE-D1", "D")],
  },
};
