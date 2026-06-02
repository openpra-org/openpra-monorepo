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
import { type SRConformance, type SRReference } from "interfaces-mef-types/core/pra-common";
import { type PreOperationalAssumption } from "interfaces-mef-types/core/documentation";

function cm(srCode: string, hlr: SRConformance["hlr"], status: SRConformance["status"], stages: SRConformance["applicableToStage"], evidence: string): SRConformance {
  return { sr: srCode, hlr, capabilityCategory: "CC-II", applicableToStage: stages, status, satisfiedByElementPaths: [], evidence };
}
const PRE: SRConformance["applicableToStage"] = ["PRE_OPERATIONAL"];
const BOTH: SRConformance["applicableToStage"] = ["OPERATIONAL", "PRE_OPERATIONAL"];

const POS_STATES = ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"];

function sr(code: string, hlr: SRReference["hlr"]): SRReference {
  return { sr: code, hlr };
}

function freq(value: number): FrequencyWithDistribution {
  return { value, units: FrequencyUnit.PER_PLANT_YEAR };
}

function preOpAssumption(id: string, description: string): PreOperationalAssumption {
  return {
    uuid: `${id}-PA-1`,
    assumptionId: `PA-${id}`,
    description,
    status: "OPEN",
    limitations: [],
    influenceOnDefinition: "Frequency estimate relies on pre-operational design-based data",
    riskImpact: ImportanceLevel.MEDIUM,
    closureBasis: "Confirm with commissioning test data and initial plant-specific operating experience",
    plannedClosureActions: ["Confirm at commissioning"],
    affectedElementIds: [id],
  };
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
  preop?: string;
}

const INITIATOR_SEEDS: InitiatorSeed[] = [
  // ─── Transients ──────────────────────────────────────────────────────────
  { id: "IE-01", name: "Loss of offsite power (LOOP)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Loss of AC power", states: ["POS-01","POS-02","POS-03","POS-04","POS-07"], method: "GENLIST", trip: "Bus undervoltage", safety: ["Heat removal"], barrier: BarrierImpactState.INTACT, frequency: 3.1e-2, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, groupId: "IEG-TRANS", basis: "GENERIC_DATA" },
  { id: "IE-02", name: "Turbine / sCO2 power-conversion trip", category: InitiatingEventCategory.TRANSIENT, subcategory: "Loss of power conversion", states: ["POS-01","POS-02"], method: "HBFT", trip: "Turbine trip signal", safety: ["Heat removal"], barrier: BarrierImpactState.INTACT, frequency: 1.2e0, screening: ScreeningStatus.MERGED, importance: ImportanceLevel.MEDIUM, groupId: "IEG-TRANS", basis: "GENERIC_DATA" },
  { id: "IE-03", name: "Spurious reactor trip (scram)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Spurious protection actuation", states: ["POS-01","POS-02"], method: "FMEA", trip: "Spurious RPS trip", safety: ["Reactivity control"], barrier: BarrierImpactState.INTACT, frequency: 8.0e-1, screening: ScreeningStatus.MERGED, importance: ImportanceLevel.LOW, groupId: "IEG-TRANS", basis: "GENERIC_DATA" },
  { id: "IE-04", name: "Loss of primary sodium flow", category: InitiatingEventCategory.TRANSIENT, subcategory: "Primary pump trip (ULOF precursor)", states: ["POS-01","POS-02"], method: "MLD", trip: "Low primary flow", safety: ["Heat removal","Reactivity control"], barrier: BarrierImpactState.INTACT, frequency: 4.5e-2, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, groupId: "IEG-LOFA", basis: "DESIGN_BASED", preop: "Pump coastdown credit from prototype-scale data, with closure planned at commissioning." },
  { id: "IE-05", name: "Loss of heat sink (IHX / intermediate loop)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Loss of normal heat removal", states: ["POS-01","POS-02","POS-03","POS-08"], method: "HBFT", trip: "Intermediate-loop low flow", safety: ["Heat removal"], barrier: BarrierImpactState.INTACT, frequency: 2.7e-2, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, groupId: "IEG-LOHS", basis: "DESIGN_BASED" },
  { id: "IE-06", name: "Reactivity insertion (rod withdrawal)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Transient overpower (TOP)", states: ["POS-01","POS-02","POS-03"], method: "MLD", trip: "High power / high flux", safety: ["Reactivity control"], barrier: BarrierImpactState.INTACT, frequency: 9.0e-3, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, groupId: "IEG-LOFA", basis: "DESIGN_BASED" },
  { id: "IE-07", name: "Loss of feed to power-conversion loop", category: InitiatingEventCategory.TRANSIENT, subcategory: "Secondary inventory loss", states: ["POS-01"], method: "FMEA", trip: "Low PCS inventory", safety: ["Heat removal"], barrier: BarrierImpactState.INTACT, frequency: 3.5e-1, screening: ScreeningStatus.MERGED, importance: ImportanceLevel.LOW, groupId: "IEG-TRANS", basis: "GENERIC_DATA" },

  // ─── RCB breaches ────────────────────────────────────────────────────────
  { id: "IE-08", name: "Small primary sodium boundary leak", category: InitiatingEventCategory.RCB_BREACH, subcategory: "Small breach", states: ["POS-01","POS-03","POS-04","POS-07"], method: "MLD", trip: "Sodium leak / level", safety: ["Coolant inventory","Radionuclide retention"], barrier: BarrierImpactState.BREACHED, frequency: 1.4e-3, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, groupId: "IEG-RCB", basis: "GENERIC_DATA" },
  { id: "IE-09", name: "Large primary boundary breach (RPV)", category: InitiatingEventCategory.RCB_BREACH, subcategory: "Excessive breach", states: ["POS-01"], method: "MLD", trip: "Rapid level loss", safety: ["Coolant inventory","Radionuclide retention"], barrier: BarrierImpactState.BREACHED, frequency: 1.0e-6, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, groupId: "IEG-RCB", basis: "DESIGN_BASED" },
  { id: "IE-10", name: "IHX tube leak (Na-to-Na / Na-to-CO2)", category: InitiatingEventCategory.RCB_BREACH, subcategory: "Heat-exchanger failure", states: ["POS-01","POS-02"], method: "HBFT", trip: "Cover-gas activity / delta-P", safety: ["Coolant inventory","Radionuclide retention"], barrier: BarrierImpactState.DEGRADED, frequency: 6.0e-4, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, groupId: "IEG-RCB", basis: "SIMILAR_PLANT_DATA" },

  // ─── Interfacing-systems breaches ────────────────────────────────────────
  { id: "IE-11", name: "Cover-gas system breach (bypass)", category: InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, subcategory: "Radionuclide bypass", states: ["POS-01","POS-06","POS-09"], method: "FMEA", trip: "Cover-gas pressure / activity", safety: ["Radionuclide retention"], barrier: BarrierImpactState.BYPASSED, frequency: 2.2e-4, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "DESIGN_BASED" },
  { id: "IE-12", name: "Sodium-CO2 interaction via PCS boundary", category: InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, subcategory: "Interfacing reaction", states: ["POS-01","POS-02"], method: "HBFT", trip: "PCS pressure / Na detection", safety: ["Coolant inventory","Radionuclide retention"], barrier: BarrierImpactState.DEGRADED, frequency: 3.0e-4, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, groupId: "IEG-RCB", basis: "DESIGN_BASED" },

  // ─── Special initiators ──────────────────────────────────────────────────
  { id: "IE-13", name: "Loss of DC bus / instrument power", category: InitiatingEventCategory.SPECIAL, subcategory: "Support-system failure", states: ["POS-01","POS-03","POS-04"], method: "FMEA", trip: "Bus undervoltage", safety: ["Heat removal","Reactivity control"], barrier: BarrierImpactState.INTACT, frequency: 1.6e-2, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, groupId: "IEG-TRANS", basis: "GENERIC_DATA" },
  { id: "IE-14", name: "Loss of component cooling / service water", category: InitiatingEventCategory.SPECIAL, subcategory: "Support-system failure", states: ["POS-01","POS-03"], method: "FMEA", trip: "Cooling-water low flow", safety: ["Heat removal"], barrier: BarrierImpactState.INTACT, frequency: 2.0e-2, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, groupId: "IEG-LOHS", basis: "GENERIC_DATA" },

  // ─── Hazard-induced ──────────────────────────────────────────────────────
  { id: "IE-15", name: "Internal fire (primary sodium cell)", category: InitiatingEventCategory.INTERNAL_HAZARD, subcategory: "Sodium fire", states: ["POS-01","POS-08"], method: "MLD", trip: "Fire / smoke detection", safety: ["Heat removal","Radionuclide retention"], barrier: BarrierImpactState.DEGRADED, frequency: 5.0e-3, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "DESIGN_BASED" },
  { id: "IE-16", name: "Internal flood (cooling-water line break)", category: InitiatingEventCategory.INTERNAL_HAZARD, subcategory: "Internal flood", states: ["POS-01"], method: "OEREV", trip: "Area level / sump", safety: ["Heat removal"], barrier: BarrierImpactState.INTACT, frequency: 8.0e-4, screening: ScreeningStatus.SCREENED_OUT, importance: ImportanceLevel.LOW, basis: "SIMILAR_PLANT_DATA" },
  { id: "IE-17", name: "Seismic event (design-basis ground motion)", category: InitiatingEventCategory.EXTERNAL_HAZARD, subcategory: "Seismic", states: ["POS-01"], method: "OEREV", trip: "Seismic trip", safety: ["Heat removal","Reactivity control","Coolant inventory"], barrier: BarrierImpactState.DEGRADED, frequency: 1.0e-4, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "DESIGN_BASED" },

  // ─── Human-failure-induced ───────────────────────────────────────────────
  { id: "IE-18", name: "Erroneous RCS drain-down (shutdown)", category: InitiatingEventCategory.HUMAN_FAILURE, subcategory: "At-initiator human failure", states: ["POS-04","POS-05"], method: "FMEA", trip: "Level deviation", safety: ["Coolant inventory","Heat removal"], barrier: BarrierImpactState.INTACT, frequency: 4.0e-3, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "DESIGN_BASED", preop: "Split-fraction operator contribution per IE-C13, with HRA input pending." },
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
    preOperationalAssumptions: seed.preop ? [preOpAssumption(seed.id, seed.preop)] : undefined,
    implementsSrs: [sr("IE-A5", "A")],
  };
}

const INITIATORS: InitiatorDefinition[] = INITIATOR_SEEDS.map(buildInitiator);

const GROUPS: InitiatingEventGroup[] = [
  {
    uuid: "IEG-TRANS", name: "General transient group",
    description: "Transients that keep the RCB intact and demand the same heat-removal and reactivity-control functions.",
    memberInitiatorIds: ["IE-01","IE-02","IE-03","IE-07","IE-13"],
    groupingBasis: "All keep the RCB intact and demand the same heat-removal and reactivity-control functions. LOOP bounds the group (loss of AC).",
    boundingInitiatorId: "IE-01",
    similarMitigationRequirements: ["Heat removal","Reactivity control"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Heat removal","Reactivity control"],
    applicableStates: ["POS-01","POS-02","POS-03","POS-04","POS-07"],
    meanFrequency: freq(2.6e0), riskImportance: ImportanceLevel.HIGH,
    implementsSrs: [sr("IE-B4","B")],
  },
  {
    uuid: "IEG-LOHS", name: "Loss of heat sink group",
    description: "Events that remove the normal heat-removal path and rely on DRACS as the backup.",
    memberInitiatorIds: ["IE-05","IE-14"],
    groupingBasis: "Both remove the normal heat-removal path and rely on DRACS as the backup. IHX loss bounds for timing to DRACS actuation.",
    boundingInitiatorId: "IE-05",
    similarMitigationRequirements: ["Heat removal"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Heat removal"],
    applicableStates: ["POS-01","POS-02","POS-03","POS-08"],
    meanFrequency: freq(4.7e-2), riskImportance: ImportanceLevel.HIGH,
    implementsSrs: [sr("IE-B4","B")],
  },
  {
    uuid: "IEG-LOFA", name: "Loss-of-flow / reactivity group",
    description: "Challenges to the flow-to-power balance. Loss of primary flow bounds for cladding thermal margin.",
    memberInitiatorIds: ["IE-04","IE-06"],
    groupingBasis: "Both challenge the flow-to-power balance. Loss of primary flow bounds the group for cladding thermal margin.",
    boundingInitiatorId: "IE-04",
    similarMitigationRequirements: ["Heat removal","Reactivity control"],
    groupingDoesNotMaskRiskSignificantSequences: false,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Heat removal","Reactivity control"],
    applicableStates: ["POS-01","POS-02","POS-03"],
    meanFrequency: freq(5.4e-2), riskImportance: ImportanceLevel.HIGH,
    implementsSrs: [sr("IE-B4","B")],
  },
  {
    uuid: "IEG-RCB", name: "RCB breach group (by size)",
    description: "Reactor coolant boundary breaches grouped by size and location.",
    memberInitiatorIds: ["IE-08","IE-09","IE-10","IE-12"],
    groupingBasis: "Breaches grouped by size and location. The large breach bounds inventory-loss timing, with sub-groups kept for ES success criteria.",
    boundingInitiatorId: "IE-09",
    similarMitigationRequirements: ["Coolant inventory","Radionuclide retention"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: false,
    challengedSafetyFunctions: ["Coolant inventory","Radionuclide retention"],
    applicableStates: ["POS-01","POS-02","POS-03","POS-04","POS-07"],
    meanFrequency: freq(2.3e-3), riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4","B")],
  },
];

const COMBO_TEXT = "Seismically-induced sodium fire\nA seismic event ruptures a sodium line and ignites a cell fire. Retained as a distinct sequence for ES.";

const HAZARDS: HazardAnalysis[] = [
  {
    uuid: "HZ-FIRE", name: "Internal fire",
    description: "Sodium-cell fire initiated by a sodium leak or ignition event.",
    hazardType: "INTERNAL", subcategory: "Sodium fire",
    severityLevels: ["Design-basis"], affectedAreas: ["Primary sodium cell","Cable spreading room"],
    radionuclideBarrierIds: ["RCB"], inducingMechanisms: ["Sodium leak ignition"],
    inducedInitiatorIds: ["IE-15"],
    potentialCombinations: [],
    analysisMethods: ["MLD"],
    screeningStatus: ScreeningStatus.RETAINED,
    screeningBasis: "Sodium-fire frequency developed in element F and handed to IE.",
    implementsSrs: [sr("IE-A5","A")],
  },
  {
    uuid: "HZ-FLOOD", name: "Internal flood",
    description: "Cooling-water line break or spray with flooding of plant areas.",
    hazardType: "INTERNAL", subcategory: "Internal flood",
    severityLevels: ["Design-basis"], affectedAreas: ["Component-cooling room"],
    radionuclideBarrierIds: [], inducingMechanisms: ["Cooling-water line break"],
    inducedInitiatorIds: ["IE-16"],
    potentialCombinations: [],
    analysisMethods: ["OEREV"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "Induced initiator IE-16 screened out via SCR-3; slow-developing with administrative detection and correction.",
    implementsSrs: [sr("IE-A5","A")],
  },
  {
    uuid: "HZ-SEIS", name: "Seismic",
    description: "Design-basis ground motion driving structural and equipment failures.",
    hazardType: "EXTERNAL", subcategory: "Seismic",
    severityLevels: ["Design-basis"], affectedAreas: ["Whole plant"],
    radionuclideBarrierIds: ["RCB"], inducingMechanisms: ["Ground motion"],
    inducedInitiatorIds: ["IE-17"],
    potentialCombinations: [COMBO_TEXT],
    analysisMethods: ["OEREV"],
    screeningStatus: ScreeningStatus.RETAINED,
    screeningBasis: "Design-basis ground-motion fragilities from element S drive initiator IE-17.",
    implementsSrs: [sr("IE-A6","A")],
  },
];

const SCREENING: InitiatingEventScreeningRecord[] = [
  {
    initiatorOrGroupId: "IE-16", retained: false, criterion: "SCR-3",
    barrierIntegrityPreconditionMet: true,
    justification: "Slow-developing, with area-level alarms. The leak is isolated administratively well before any forced shutdown. Detection and correction are demonstrated by calculation, so no complicated shutdown occurs.",
    implementsSrs: [sr("IE-C9","C")],
  },
  {
    initiatorOrGroupId: "IE-07", retained: false, criterion: "SCR-1",
    barrierIntegrityPreconditionMet: true,
    justification: "Same plant impact as the bounding general transient (IE-01) which has a much higher frequency. Subsumed into IEG-TRANS.",
    implementsSrs: [sr("IE-C9","C")],
  },
  {
    initiatorOrGroupId: "IE-03", retained: false, criterion: "SCR-1",
    barrierIntegrityPreconditionMet: true,
    justification: "Bounded by, and far less limiting than, the general transient group. Merged for mitigation analysis, with frequency retained in the group total.",
    implementsSrs: [sr("IE-C9","C")],
  },
  {
    initiatorOrGroupId: "IE-09", retained: true, criterion: undefined,
    barrierIntegrityPreconditionMet: false,
    justification: "Cannot be screened. The event breaches a radionuclide transport barrier, so the IE-C9(a) precondition fails regardless of its frequency of 1E-06 per plant-yr. Retained for full analysis.",
    implementsSrs: [sr("IE-C9","C")],
  },
];

const QUANTIFICATIONS: InitiatingEventFrequencyQuantification[] = [
  { initiatorOrGroupId: "IEG-TRANS", meanFrequency: freq(2.6e0),  basis: "GENERIC_DATA",       plantCalendarYearBasis: true, posTimeFractionApplied: true,  dataSourceJustification: "Generic transient frequencies from NUREG/CR-5750, plant-calendar-year basis.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8","C")] },
  { initiatorOrGroupId: "IEG-LOHS",  meanFrequency: freq(4.7e-2), basis: "DESIGN_BASED",        plantCalendarYearBasis: true, posTimeFractionApplied: true,  dataSourceJustification: "Design-based estimate for intermediate-loop faults.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8","C")] },
  { initiatorOrGroupId: "IEG-LOFA",  meanFrequency: freq(5.4e-2), basis: "DESIGN_BASED",        plantCalendarYearBasis: true, posTimeFractionApplied: true,  dataSourceJustification: "Pump coastdown credit from prototype-scale data.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8","C")] },
  { initiatorOrGroupId: "IEG-RCB",   meanFrequency: freq(2.3e-3), basis: "SIMILAR_PLANT_DATA",  plantCalendarYearBasis: true, posTimeFractionApplied: true,  dataSourceJustification: "Similar-plant boundary-breach data, adjusted for sodium systems.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8","C")] },
  { initiatorOrGroupId: "IE-09",     meanFrequency: freq(1.0e-6), basis: "DESIGN_BASED",        plantCalendarYearBasis: true, posTimeFractionApplied: true,  dataSourceJustification: "Design-basis estimate; cannot be screened due to barrier breach.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8","C")] },
  { initiatorOrGroupId: "IE-11",     meanFrequency: freq(2.2e-4), basis: "DESIGN_BASED",        plantCalendarYearBasis: true, posTimeFractionApplied: true,  dataSourceJustification: "Cover-gas boundary design analysis.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8","C")] },
  { initiatorOrGroupId: "IE-15",     meanFrequency: freq(5.0e-3), basis: "FAULT_TREE",          plantCalendarYearBasis: true, posTimeFractionApplied: true,  dataSourceJustification: "Internal Fire PRA fault tree (element F).", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8","C")] },
  { initiatorOrGroupId: "IE-17",     meanFrequency: freq(1.0e-4), basis: "DESIGN_BASED",        plantCalendarYearBasis: true, posTimeFractionApplied: false, dataSourceJustification: "Seismic hazard curve already integrates over time; POS weighting not applicable.", recoveryActionsIncluded: false, implementsSrs: [sr("IE-C8","C")] },
  { initiatorOrGroupId: "IE-18",     meanFrequency: freq(4.0e-3), basis: "DESIGN_BASED",        plantCalendarYearBasis: true, posTimeFractionApplied: true,  dataSourceJustification: "Operator drain-down split fraction per IE-C13.", recoveryActionsIncluded: true, implementsSrs: [sr("IE-C8","C")] },
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
    reviewers: [
      { id: "scrchen",  name: "Dr. Sarah Chen",      role: "INTERNAL_REVIEWER",  title: "Senior PRA Engineer",        organization: "Nuclear Safety Associates", qualification: "ANS Certified PRA Reviewer" },
      { id: "mtorres",  name: "Michael Torres",       role: "INTERNAL_REVIEWER",  title: "Reactor Physics Specialist",  organization: "Nuclear Safety Associates" },
      { id: "jwilson",  name: "Prof. James Wilson",   role: "INTERNAL_APPROVER",  title: "Chief Nuclear Engineer",      organization: "Generic Atomics",           qualification: "ASME PRA Standard Expert" },
    ],
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
  conformanceMatrix: [
    cm("IE-A1",  "A", "MET",            BOTH, "5 systematic methods registered across 7 challenge categories."),
    cm("IE-A2",  "A", "MET",            BOTH, "Escape mechanisms identified for in-core fuel, cover-gas argon, and spent fuel."),
    cm("IE-A4",  "A", "MET",            PRE,  "Generic SFR and non-nuclear sodium-loop operating experience reviewed."),
    cm("IE-A5",  "A", "MET",            BOTH, "All 7 categories covered: transient, RCB breach, interfacing, special, internal hazard, external hazard, human failure."),
    cm("IE-A6",  "A", "MET",            BOTH, "Seismic x fire combination identified and retained as a distinct sequence."),
    cm("IE-A8",  "A", "PARTIAL",        BOTH, "Generic SFR OE review complete; HTGR online-refuelling experience review still open."),
    cm("IE-A9",  "A", "MET",            BOTH, "FMEA completed for 14 main systems and 6 support systems."),
    cm("IE-A10", "A", "MET",            BOTH, "Initiators tied to mobilisation paths for all three radioactive sources."),
    cm("IE-A11", "A", "MET",            PRE,  "Comparable SFR and sodium-loop plant experience reviewed."),
    cm("IE-A12", "A", "MET",            BOTH, "Beyond-design-basis events assessed; no additional initiators identified."),
    cm("IE-A14", "A", "MET",            PRE,  "Pre-operational similar-plant evidence documented in analysis report."),
    cm("IE-A15", "A", "MET",            BOTH, "DC power, instrument air, component cooling, service water, HVAC, cover-gas conditioning swept."),
    cm("IE-A16", "A", "NOT_APPLICABLE", BOTH, "Generic-1 is a single-reactor site; multi-unit initiating events not applicable."),
    cm("IE-A17", "A", "MET",            BOTH, "Completeness justified via cross-check of MLD, FMEA, HBFT, OE review, and generic catalog."),
    cm("IE-A18", "A", "MET",            PRE,  "Pre-operational completeness basis documented with closure plan."),
    cm("IE-B1",  "B", "MET",            BOTH, "Grouping basis documented for all four initiating-event groups."),
    cm("IE-B2",  "B", "MET",            BOTH, "Bounding initiator identified and justified for each group."),
    cm("IE-B3",  "B", "MET",            PRE,  "Pre-operational grouping conservatism justified by bounding-case selection."),
    cm("IE-B4",  "B", "PARTIAL",        BOTH, "3 of 4 groups fully bounded; IEG-LOFA anti-masking check still open."),
    cm("IE-B5",  "B", "NOT_APPLICABLE", BOTH, "Single-reactor site; multi-unit grouping not applicable."),
    cm("IE-B6",  "B", "MET",            PRE,  "Grouping conservatism for pre-operational stage documented."),
    cm("IE-C2",  "C", "MET",            PRE,  "Frequencies derived from NUREG/CR-5750, design-based estimates, and similar-plant data."),
    cm("IE-C5",  "C", "PARTIAL",        PRE,  "Uncertainty characterised for 8 of 9 quantifications; IEG-LOFA lognormal EF pending."),
    cm("IE-C7",  "C", "MET",            PRE,  "Pre-operational frequency basis justified for each record."),
    cm("IE-C8",  "C", "MET",            BOTH, "POS time-fraction weighting applied to 8 of 9 records; seismic uses hazard curve."),
    cm("IE-C9",  "C", "MET",            BOTH, "Barrier-integrity gate applied before SCR test for all screening decisions."),
    cm("IE-C10", "C", "MET",            BOTH, "Each screened-out event has a documented SCR justification."),
    cm("IE-D1",  "D", "MET",            BOTH, "IE analysis process documented in workbook report."),
    cm("IE-D2",  "D", "PARTIAL",        BOTH, "Major assumptions documented; model uncertainty section still in draft."),
    cm("IE-D3",  "D", "PARTIAL",        PRE,  "Pre-operational documentation in progress; not yet at final quality level."),
  ],
  internalReviewComments: {
    openCount: 4,
    resolvedCount: 2,
    comments: [
      {
        uuid: "ie-rc-001",
        authorRole: "INTERNAL_REVIEWER",
        authorId: "scrchen",
        createdAt: "2026-04-19T09:14:00.000Z",
        associatedSr: "IE-B4",
        text: "IEG-LOFA anti-masking check is unresolved. IE-06 (transient overpower / TOP, 9.0E-03/yr) is within one order of magnitude of the bounding case IE-04 (ULOF, 4.5E-02/yr). CC-II requires that no risk-significant sequence is masked by the grouping. A rod-withdrawal TOP may produce a distinct cladding-damage sequence with different success criteria from ULOF. Please provide a quantitative anti-masking justification or split IE-06 into its own group.",
        severity: "MAJOR",
        resolved: false,
      },
      {
        uuid: "ie-rc-002",
        authorRole: "INTERNAL_REVIEWER",
        authorId: "scrchen",
        createdAt: "2026-04-19T09:31:00.000Z",
        associatedSr: "IE-C2",
        text: "The LOOP frequency (IE-01, 3.1E-02/yr) cites generic LWR data from NUREG/CR-5750. Please confirm the data has been filtered for sodium-cooled fast reactor applicability and document any frequency adjustment made for the SFR-specific grid connection configuration.",
        severity: "MINOR",
        resolved: true,
        resolution: "Confirmed. The NUREG/CR-5750 LOOP rate was screened for SFR applicability per the GENLIST method. No frequency adjustment was required because the plant uses a standard grid interface; see Section 4.3 of Calculation IE-FREQ-01.",
        resolvedAt: "2026-04-20T14:05:00.000Z",
        resolvedBy: "scrchen",
      },
      {
        uuid: "ie-rc-003",
        authorRole: "INTERNAL_REVIEWER",
        authorId: "mtorres",
        createdAt: "2026-04-20T10:45:00.000Z",
        associatedSr: "IE-C5",
        text: "The pre-operational assumption for IE-04 (primary sodium pump coastdown credit) states closure is planned at commissioning but does not specify which commissioning test or acceptance criterion provides the closure evidence. Per IE-A18, the closure plan must be traceable to a defined commissioning activity.",
        severity: "MINOR",
        resolved: false,
      },
      {
        uuid: "ie-rc-004",
        authorRole: "INTERNAL_REVIEWER",
        authorId: "mtorres",
        createdAt: "2026-04-20T11:12:00.000Z",
        associatedSr: "IE-A8",
        text: "The OE review for HTGR online-refuelling experience is flagged as open with no target completion date. The completeness search documentation should record the planned closure date so the gap does not remain open indefinitely.",
        severity: "OBSERVATION",
        resolved: true,
        resolution: "Target closure date added: Q3 2027, following review of HTGR online-refuelling data from IAEA TECDOC-1733. Entry updated in the completeness search record.",
        resolvedAt: "2026-04-21T08:20:00.000Z",
        resolvedBy: "mtorres",
      },
      {
        uuid: "ie-rc-005",
        authorRole: "INTERNAL_APPROVER",
        authorId: "jwilson",
        createdAt: "2026-04-22T08:00:00.000Z",
        associatedSr: "IE-B4",
        text: "Review Comment ie-rc-001 (IEG-LOFA anti-masking) must be resolved before this workbook advances to internal approval. IE-B4 is a hard requirement under CC-II. If the transient overpower (IE-06) drives a distinct high-consequence sequence — for example, fuel damage before reactor trip — that sequence must appear explicitly in the Event Sequence Analysis. Either provide a bounding-case argument with quantitative support, or separate IE-06 into its own initiating-event group.",
        severity: "MAJOR",
        resolved: false,
      },
      {
        uuid: "ie-rc-006",
        authorRole: "INTERNAL_APPROVER",
        authorId: "jwilson",
        createdAt: "2026-04-22T08:18:00.000Z",
        associatedSr: "IE-C5",
        text: "IE-18 (erroneous RCS drain-down) uses a human-error split fraction that is described as pending HRA input. Please confirm whether the split fraction currently in the frequency estimate comes from a pre-approved HRA methodology. If the methodology is not yet finalized, this must be recorded as a pre-operational assumption with a formal closure plan per IE-C5 and IE-A18.",
        severity: "OBSERVATION",
        resolved: false,
      },
    ],
  },
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
    implementsSrs: [sr("IE-A9","A"), sr("IE-A15","A")],
  },
  hazardAnalyses: HAZARDS,
  quantifications: QUANTIFICATIONS,
  screeningRecords: SCREENING,
  documentation: {
    processDescription: "Initiating events identified by a structured, systematic process across the seven IE-A5 categories.",
    inputSources: "POS workbook (operating states and sources), generic SFR data, NUREG/CR-5750, EPRI shutdown catalog.",
    appliedMethods: "Master logic diagram, FMEA, heat-balance fault trees, operating-experience review, generic catalog.",
    resultsSummary: "18 initiators identified across all seven challenge categories, grouped into four bounding cases.",
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
    implementsSrs: [sr("IE-D1","D")],
  },
};
