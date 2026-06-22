import {
  type InitiatingEventsAnalysis,
  type SourceEscapeMechanism,
  type IeSearchMethod,
  type InitiatorDefinition,
  type InitiatingEventFrequencyQuantification,
  type InitiatingEventScreeningRecord,
  type InitiatingEventGroup,
  type HazardAnalysis,
  InitiatingEventCategory,
  BarrierImpactState,
} from "interfaces-mef-types/ie/initiating-event-analysis";
import { type MasterLogicDiagram } from "interfaces-mef-types/cross-cutting/methods/master-logic-diagram";
import { type HeatBalanceFaultTree } from "interfaces-mef-types/cross-cutting/methods/heat-balance-fault-tree";
import { type FailureModesEffectAnalysis } from "interfaces-mef-types/cross-cutting/methods/fmea";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { type SRConformance, type SRReference } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import { FrequencyUnit, DistributionType } from "interfaces-mef-types/core/events";

function sr(code: string, hlr: SRReference["hlr"]): SRReference {
  return { sr: code, hlr };
}

const BOTH: SRConformance["applicableToStage"] = ["OPERATIONAL", "PRE_OPERATIONAL"];
const PRE: SRConformance["applicableToStage"] = ["PRE_OPERATIONAL"];

function cm(srCode: string, hlr: SRConformance["hlr"], status: SRConformance["status"], stages: SRConformance["applicableToStage"], evidence: string): SRConformance {
  return { sr: srCode, hlr, capabilityCategory: "CC-II", applicableToStage: stages, status, satisfiedByElementPaths: [], evidence };
}

const REVIEWERS = [
  { id: "rev-1", name: "Dr. Nadia Hartwell", role: "INTERNAL_REVIEWER" as const, organization: "Generic Nuclear LLC", title: "Lead Technical Reviewer" },
  { id: "rev-2", name: "Marc Béland", role: "INTERNAL_REVIEWER" as const, organization: "Generic Nuclear LLC", title: "Independent Reviewer · Systems" },
  { id: "rev-3", name: "Priya Subramanian", role: "INTERNAL_REVIEWER" as const, organization: "Generic Nuclear LLC", title: "Independent Reviewer · HRA" },
  { id: "approver-1", name: "Dr. Ji-won Chen", role: "INTERNAL_APPROVER" as const, organization: "Generic Nuclear LLC", title: "Director, Risk Engineering", qualification: "NQA-1 §2 Lead Reviewer (certified 2022, renewal 2025)" },
];

const sourceMechanisms: SourceEscapeMechanism[] = [
  {
    sourceId: "IN_CORE_TRISO_FUEL",
    mechanisms: [
      "TRISO coating failure on core overheating during a loss of forced cooling",
      "Breach of the helium primary boundary",
      "Depressurization with liftoff of circulating activity",
    ],
    hazardGroupsConsidered: ["Transient (loss of forced cooling)", "RCB breach"],
    implementsSrs: [sr("IE-A2", "A")],
  },
  {
    sourceId: "PRIMARY_CIRCUIT_PLATEOUT",
    mechanisms: ["Depressurization with plateout liftoff", "Breach of the primary boundary"],
    hazardGroupsConsidered: ["RCB breach", "Depressurization transient"],
    implementsSrs: [sr("IE-A2", "A")],
  },
  {
    sourceId: "SPENT_FUEL_BLOCKS",
    mechanisms: ["Fuel-handling path failure during refuelling", "Spent-fuel storage breach"],
    hazardGroupsConsidered: ["Refuelling-mode initiators", "RCB breach"],
    implementsSrs: [sr("IE-A2", "A")],
  },
  {
    sourceId: "PRIMARY_HELIUM_ACTIVITY",
    mechanisms: ["Depressurization through a primary boundary breach", "Open vent path during maintenance"],
    hazardGroupsConsidered: ["RCB breach", "Maintenance-mode initiators"],
    implementsSrs: [sr("IE-A2", "A")],
  },
];

const C = InitiatingEventCategory;

const searchMethods: IeSearchMethod[] = [
  {
    id: "MLD",
    role: "DEDUCTIVE",
    name: "Master logic diagram",
    description: "Top-down deductive search. A logic tree from a top event, a challenge to a safety function or a radionuclide release, decomposed through functional failures down to the initiating events at the leaves.",
    scope: "Heat-removal, reactivity-control, and radionuclide-retention branches expanded to component level across all retained operating states.",
    coverageCategories: [C.TRANSIENT, C.RCB_BREACH, C.INTERFACING_SYSTEMS_RCB_BREACH, C.SPECIAL, C.HUMAN_FAILURE],
    legitimacyBasis: "Established master-logic-diagram method for systematic initiating-event identification, adapted for HTGRs that have limited operating experience.",
    supportingDocuments: ["Papazoglou and Aneziris, Master Logic Diagram method (J. Hazardous Materials, 2003)", "Master logic diagram approach for HTGR initiating events", "ASME/ANS RA-S-1.4 IE-A1"],
    implementsSrs: [sr("IE-A1", "A"), sr("IE-A5", "A")],
  },
  {
    id: "HBFT",
    role: "DEDUCTIVE",
    name: "Heat-balance fault trees",
    description: "Top-down deductive search on the plant energy balance. A fault representation of the heat-generation to heat-removal balance that finds the initiators which upset it.",
    scope: "The power-conversion and heat-removal trains modelled as frequency-producing top events for the at-power states.",
    coverageCategories: [C.TRANSIENT, C.RCB_BREACH],
    legitimacyBasis: "Heat-balance fault-tree method from the HTGR full-power initiating-event methodology, complementing the master logic diagram for thermal initiators.",
    supportingDocuments: ["Identifying and quantifying a complete set of full-power HTGR initiating events (Reliab. Eng. Syst. Saf., 2023)", "ASME/ANS RA-S-1.4 IE-A1"],
    implementsSrs: [sr("IE-A1", "A"), sr("IE-A5", "A")],
  },
  {
    id: "FMEA",
    role: "INDUCTIVE",
    name: "Failure modes and effects analysis",
    description: "Bottom-up inductive search. Each component's failure modes and their plant effects are enumerated to find which failures act as initiators.",
    scope: "Each main and support system carried to the subsystem or train level.",
    coverageCategories: [C.TRANSIENT, C.SPECIAL],
    legitimacyBasis: "Failure modes and effects analysis per IEC 60812, carried to the subsystem level as CC-II requires under IE-A9, and endorsed for early-design search by NEI 18-04 and RG 1.233.",
    supportingDocuments: ["IEC 60812 (FMEA)", "NEI 18-04 / RG 1.233", "ASME/ANS RA-S-1.4 IE-A9, IE-A15"],
    implementsSrs: [sr("IE-A9", "A"), sr("IE-A15", "A"), sr("IE-A10", "A")],
  },
  {
    id: "HAZOP",
    role: "INDUCTIVE",
    name: "Hazard and operability study",
    description: "Guideword-based deviation analysis, overlaid on coupled systems where component-level FMEA is not sufficient, to find deviations that initiate a plant upset.",
    scope: "Coupled and chemically interacting systems such as the helium coolant chemistry and the coolant boundary.",
    coverageCategories: [C.TRANSIENT, C.SPECIAL, C.INTERFACING_SYSTEMS_RCB_BREACH],
    legitimacyBasis: "Hazard and operability study per IEC 61882, used as a process-hazard-analysis technique alongside the FMEA.",
    supportingDocuments: ["IEC 61882 (HAZOP)", "NEI 18-04 / RG 1.233"],
    implementsSrs: [sr("IE-A9", "A"), sr("IE-A10", "A")],
  },
  {
    id: "PHA",
    role: "INDUCTIVE",
    name: "Process hazard analysis",
    description: "The early-design process-hazard-analysis framework that frames and reconciles the FMEA and HAZOP sweeps.",
    scope: "Early-design systematic hazard evaluation across the plant, realized through the FMEA and the HAZOP.",
    coverageCategories: [C.TRANSIENT, C.SPECIAL, C.RCB_BREACH],
    legitimacyBasis: "Process hazard analysis as the early-design search framework endorsed by NEI 18-04 and RG 1.233.",
    supportingDocuments: ["NEI 18-04 / RG 1.233", "ASME/ANS RA-S-1.4 IE-A1"],
    implementsSrs: [sr("IE-A1", "A")],
  },
  {
    id: "OEREV",
    role: "EXPERIENCE",
    name: "Operating-experience review",
    description: "Review of operating experience and generic analyses of similar plants and comparable systems, used as a completeness cross-check on the deductive and inductive searches.",
    scope: "Similar gas-cooled and comparable-system operating experience, generic analyses, and precursor events.",
    coverageCategories: [C.TRANSIENT, C.RCB_BREACH, C.INTERFACING_SYSTEMS_RCB_BREACH, C.SPECIAL, C.HUMAN_FAILURE],
    legitimacyBasis: "Operating-experience and generic-analysis review required by IE-A8, IE-A11, and IE-A14, used as a completeness cross-check given the limited HTGR operating history.",
    supportingDocuments: ["ASME/ANS RA-S-1.4 IE-A8, IE-A11, IE-A14"],
    implementsSrs: [sr("IE-A8", "A"), sr("IE-A11", "A"), sr("IE-A14", "A")],
  },
  {
    id: "GENLIST",
    role: "CATALOGUE",
    name: "Generic initiator catalogue",
    description: "A generic initiating-event catalogue filtered for plant-specific applicability, used to seed the search with established initiators.",
    scope: "NUREG/CR-5750 and comparable catalogues, filtered for HTGR applicability.",
    coverageCategories: [C.TRANSIENT, C.RCB_BREACH, C.SPECIAL],
    legitimacyBasis: "Generic initiating-event list from NUREG/CR-5750 and comparable catalogues, filtered for plant-specific applicability as a seed for the systematic search.",
    supportingDocuments: ["NUREG/CR-5750", "EPRI initiating-event catalogues"],
    implementsSrs: [sr("IE-A8", "A")],
  },
];

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
  screening: ScreeningStatus;
  importance: ImportanceLevel;
  basis: string;
}

function buildInitiator(x: InitiatorSeed): InitiatorDefinition {
  return {
    uuid: x.id,
    name: x.name,
    eventType: "INITIATING",
    frequency: 0,
    category: x.category,
    subcategory: x.subcategory,
    applicableStates: x.states,
    identificationMethodIds: [x.method],
    identificationBasis: [x.basis],
    tripParameters: x.trip.length > 0 ? [{ parameter: x.trip, setpoint: 0, uncertainty: 0, basis: x.method }] : [],
    mitigatingSystems: [],
    barrierImpacts: [{ barrierId: "RCB", state: x.barrier, timing: "At initiation", mechanism: x.subcategory }],
    challengedSafetyFunctions: x.safety,
    screeningStatus: x.screening,
    importanceLevel: x.importance,
    implementsSrs: [sr("IE-A5", "A")],
  };
}

const INITIATOR_SEEDS: InitiatorSeed[] = [
  { id: "IE-01", name: "Main helium circulator trip (pressurized loss of forced cooling)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Loss of forced cooling", states: ["POS-01", "POS-02", "POS-03", "POS-07"], method: "HBFT", trip: "Low primary helium mass flow / circulator speed (loss of forced flow)", safety: ["Control heat removal", "Maintain core and reactor vessel geometry"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "The ORNL Overview of Modular HTGR Safety Characterization lists long-term pressurized LOFC (P-LOFC) as one of the standard postulated accident sequences, with flow coastdown and scram at t=0, the primary system remaining pressurized, and the passive RCCS removing decay heat; it notes the chimney effect raises temperatures near the top and that maximum vessel temperature is the usual concern. The NGNP PRA white paper Figure 3-7 plots peak core temperatures for pressurized forced and loss-of-forced cooling transients (PLOFC at 6000 kPa). This is a deductive heat-balance fault-tree challenge to the heat-removal safety function with the boundary intact." },
  { id: "IE-02", name: "Loss of primary heat sink (loss of steam generator heat removal)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Loss of heat sink", states: ["POS-01", "POS-02", "POS-03"], method: "HBFT", trip: "High core outlet / primary helium temperature (loss of secondary heat removal)", safety: ["Control heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "The ORNL Overview of Modular HTGR Safety Characterization explicitly enumerates 'loss of primary heat sink' as one of the postulated accident sequences common to the modular HTGR projects (Sect. 7 accident list). It is a deductive heat-balance challenge to the heat-removal function with the helium pressure boundary intact, distinct from circulator trip because the forced-flow path may still be available while the ultimate sink is lost." },
  { id: "IE-03", name: "Loss of feedwater to the steam generator", category: InitiatingEventCategory.TRANSIENT, subcategory: "Loss of heat sink", states: ["POS-01", "POS-02", "POS-03"], method: "FMEA", trip: "Low steam generator / feedwater flow or level; high primary helium temperature", safety: ["Control heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "For a direct steam-cycle HTGR the loss of feedwater is the dominant cause of loss of the steam-generator heat sink. The ORNL accident list captures it under 'loss of primary heat sink', and its frequency is seeded by the generic NUREG/CR-5750 loss-of-feedwater initiating-event category for U.S. power reactors. Found by FMEA of the feedwater/steam-generator support train per the MLD step that performs failure-modes-and-effects analyses on unscreened SSCs." },
  { id: "IE-04", name: "Loss of Shutdown Cooling System (active backup forced cooling)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Loss of forced cooling", states: ["POS-04", "POS-05", "POS-07"], method: "FMEA", trip: "Loss of SCS forced flow / low SCS circulator speed", safety: ["Control heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "MHTGR/NGNP safety analyses treat the main Heat Transport System (HTS) and the Shutdown Cooling System (SCS) as the active forced-cooling paths whose failure leaves decay-heat removal to the passive RCCS; the design-basis P-LOFC/D-LOFC heatup cases assume both HTS and SCS unavailable. Loss of SCS as an initiator in shutdown/forced-cooldown states is identified by FMEA of the SCS train within the MLD systematic search across all operating and shutdown modes." },
  { id: "IE-05", name: "Turbine trip / loss of power conversion system", category: InitiatingEventCategory.TRANSIENT, subcategory: "Power-conversion transient", states: ["POS-01", "POS-02"], method: "HAZOP", trip: "Turbine trip / generator load rejection; high primary helium temperature", safety: ["Control heat removal", "Control heat generation (reactivity)"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "The ORNL Overview of Modular HTGR Safety Characterization lists 'turbine trip/station blackout' as one of the standard postulated accident sequences (Sect. 7), and notes that station blackout consequences are bounded by P-LOFC predictions and that loss of electrical power typically results in a scram. Identified by HAZOP of the power-conversion process line." },
  { id: "IE-06", name: "Loss of offsite power", category: InitiatingEventCategory.TRANSIENT, subcategory: "Power-conversion transient", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06"], method: "OEREV", trip: "Loss of grid voltage / undervoltage on plant buses", safety: ["Control heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "The ORNL Overview of Modular HTGR Safety Characterization states that station blackout accident consequences are covered by P-LOFC predictions and that loss of electrical power typically results in a scram (Sect. 7.1). Loss of offsite power is a dominant generic initiator carried over from operating-experience review and seeded by the NUREG/CR-5750 LOOP category; it applies in every state because grid loss is independent of plant mode." },
  { id: "IE-07", name: "General reactor trip / spurious scram", category: InitiatingEventCategory.TRANSIENT, subcategory: "Power-conversion transient", states: ["POS-01", "POS-02", "POS-03"], method: "GENLIST", trip: "Any reactor protection system trip signal (general/transient trip)", safety: ["Control heat generation (reactivity)", "Control heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "A general/transient reactor trip is the standard catch-all initiating-event group in the NUREG/CR-5750 generic catalogue used to seed power-reactor PRAs, and the NGNP PRA white paper directs that operating-experience and prior-PRA insights and 'relevant events from other GCR and LWR PRAs' be compiled to ensure the initiating-event list is exhaustive (MLD Step 6). Retained as a completeness item for at-power states." },
  { id: "IE-08", name: "Control rod / rod bank withdrawal (transient overpower)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Reactivity insertion", states: ["POS-01", "POS-02", "POS-03"], method: "FMEA", trip: "High neutron flux / high power / short period (rod withdrawal block and trip)", safety: ["Control heat generation (reactivity)"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "The ORNL Overview of Modular HTGR Safety Characterization Sect. 7.5.1 lists 'control rod or rod bank withdrawal' as a typical reactivity-event initiator, and notes the large negative temperature-reactivity feedback makes these events inconsequential. HTR-10 performed a control-rod-withdrawal reactivity-insertion ATWS demonstration test confirming the inherent limiting behavior. Identified by FMEA of the reactivity-control system." },
  { id: "IE-09", name: "Control rod drop / inadvertent control rod action", category: InitiatingEventCategory.TRANSIENT, subcategory: "Reactivity insertion", states: ["POS-01", "POS-02", "POS-03"], method: "FMEA", trip: "High flux / flux tilt / negative period; rod position deviation", safety: ["Control heat generation (reactivity)"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "The ORNL Overview of Modular HTGR Safety Characterization Sect. 7.5.1 lists 'control rod drop' and 'inadvertent control rod action due to power measurement error or operator error' as separate typical reactivity-event initiators. Identified by FMEA of the reactivity-control and instrumentation system." },
  { id: "IE-10", name: "Xenon-oscillation-induced reactivity transient", category: InitiatingEventCategory.TRANSIENT, subcategory: "Reactivity insertion", states: ["POS-01", "POS-02"], method: "PHA", trip: "Flux tilt / axial-radial power imbalance (out-of-tolerance power distribution)", safety: ["Control heat generation (reactivity)"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "The ORNL Overview of Modular HTGR Safety Characterization Sect. 7.5.1 lists 'xenon oscillation' as a typical reactivity-event initiator. Retained for at-power states by process-hazard analysis of core reactivity behavior; bounded by the large negative temperature feedback noted in the same section." },
  { id: "IE-11", name: "Reactivity insertion from sudden change in primary heat-removal rate (core overcooling)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Reactivity insertion", states: ["POS-01", "POS-02", "POS-03"], method: "HAZOP", trip: "Rapid primary temperature change / high flux from positive feedback (overcooling)", safety: ["Control heat generation (reactivity)", "Control heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "The ORNL Overview of Modular HTGR Safety Characterization Sect. 7.5.1 lists 'sudden increase or decrease of the primary heat removal rate' as a reactivity-event initiator, and its Fig. 1 (IAEA objective provision tree) cites core overcooling among the reactivity-control challenge mechanisms. Identified by HAZOP of the heat-transport process (deviation: more/less cooling)." },
  { id: "IE-12", name: "Fuel-loading / mispositioning reactivity error", category: InitiatingEventCategory.TRANSIENT, subcategory: "Reactivity insertion", states: ["POS-06"], method: "FMEA", trip: "High flux / shutdown-margin or reactivity-balance check at startup", safety: ["Control heat generation (reactivity)"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "The ORNL Overview of Modular HTGR Safety Characterization Sect. 7.5.1 lists 'fuel-loading errors (both for pebble-bed and prismatic cores)' as a reactivity-event initiator. For the prismatic Generic HTGR this is a refuelling-state (vessel open) initiator, identified by FMEA of the fuel-handling/refuelling operation." },
  { id: "IE-13", name: "Steam-generator-tube-rupture water/steam ingress (moisture-induced reactivity transient)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Reactivity insertion", states: ["POS-01", "POS-02", "POS-03"], method: "MLD", trip: "", safety: ["Control heat generation (reactivity)", "Control heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "The ORNL Modular HTGR Safety Basis (INL/EXT-11-22708) lists 'a break of heat transfer tubes in an SG or other water-cooled heat exchanger that could result in water or steam ingress into the core' directly among the reactivity-event initiators (Sect. 7.5.1), and treats water/steam ingress as its own postulated accident category (Sect. 7.4). Modular HTGR cores are undermoderated by design, so moisture ingress is a positive reactivity insertion that also reduces control/shutdown rod worth; the COL guide confirms water ingress arises from a steam generator tube leak in a direct steam-cycle plant. This is the single most HTGR-specific transient initiator and the prompt itself flags it as expected; it is absent from the listed TRANSIENT set. As a reactivity transient with the helium boundary intact (the SG tube break is internal to the primary circuit), barrier impact is INTACT. It applies whenever the SG is wetted and the core is critical or recently critical: full power, load follow, hot standby. Primary method MLD captures it as a reactivity branch off the heat-transport boundary." },
  { id: "IE-14", name: "Loss of main loop heat transport (main circulator and steam-generator loop unavailable, reactor at power)", category: InitiatingEventCategory.TRANSIENT, subcategory: "Loss of forced cooling", states: ["POS-01", "POS-02", "POS-03", "POS-07"], method: "MLD", trip: "", safety: ["Control heat removal", "Maintain core and reactor vessel geometry"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "The original MHTGR PRA and the ORNL/INL HTGR record treat 'loss of main loop' (loss of the Heat Transport System) as a distinct top initiating event separate from a clean circulator trip: the COL Application Content Guide (INL/EXT-12-26895, Sect. 6.1) states core heat removal is normally by the main loop cooling system, with the shutdown cooling system as the dedicated backup 'in the event that main loop cooling is unavailable.' A loss of the main loop (circulator plus steam-generator heat sink lost together, e.g. main-loop isolation or trip with the SG path lost) is the canonical pressurized-loss-of-forced-cooling initiator that demands SCS or passive RCCS. The listed set captures the circulator trip and the loss-of-heat-sink separately but not the combined main-loop loss the MHTGR PRA uses as its lead heat-removal initiator. It applies during forced-cooling power and standby states and post-trip when the main loop would otherwise run. Barrier impact INTACT (the primary boundary stays closed; this is a pressurized LOFC)." },
  { id: "IE-15", name: "Small primary helium leak (slow depressurization, forced cooling available)", category: InitiatingEventCategory.RCB_BREACH, subcategory: "Small primary coolant leak", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"], method: "MLD", trip: "Low primary helium pressure / primary coolant make-up or purification flow / reactor building humidity-activity monitors", safety: ["Retain radionuclides (helium pressure boundary)", "Control heat removal", "Control chemical attack (limit air ingress)"], barrier: BarrierImpactState.DEGRADED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "HTGR depressurization is a size spectrum: the more likely small and moderate leaks down to the less likely large leaks. For a slow leak the fission-product release tracks the helium released but can be mitigated by pump-down through the Helium Purification System if the leak rate is sufficiently slow (NGNP PRA white paper / ORNL HPB barrier discussion). Corresponds to the cooling-available end of the MHTGR primary-coolant-leak DBE family (DBE-10)." },
  { id: "IE-16", name: "Moderate primary boundary break (intermediate depressurization)", category: InitiatingEventCategory.RCB_BREACH, subcategory: "Moderate primary coolant leak", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"], method: "HBFT", trip: "Low primary helium pressure / high rate-of-depressurization / reactor building pressure", safety: ["Retain radionuclides (helium pressure boundary)", "Control heat removal", "Control chemical attack (limit air ingress)"], barrier: BarrierImpactState.BREACHED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "HTGR safety analyses span the break spectrum and treat small, medium (moderate), and large break-size depressurized loss-of-forced-cooling and air-ingress cases as separate scenarios; the medium break is the intermediate depressurization precursor between the slow leak and the rapid large break. Part of the MHTGR primary-coolant-leak DBE family." },
  { id: "IE-17", name: "Large primary boundary break / rapid depressurization (depressurized loss of forced cooling, D-LOFC)", category: InitiatingEventCategory.RCB_BREACH, subcategory: "Large primary coolant leak", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"], method: "MLD", trip: "Low primary helium pressure / high rate-of-depressurization / loss of circulator flow", safety: ["Retain radionuclides (helium pressure boundary)", "Remove core heat (passive RCCS / conduction)", "Control chemical attack (limit air ingress)", "Control heat generation (reactivity / SCRAM)"], barrier: BarrierImpactState.BREACHED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "The D-LOFC reference case assumes a rapid depressurization with flow coast-down and SCRAM and the passive RCCS operational; it is the defining accident for the reference-case peak fuel temperature (~1600 C). In the MHTGR DBE set this is DBE-11, primary coolant leak with loss of heat transport and shutdown cooling, commonly known today as D-LOFC. The MHTGR close-coupled vessel arrangement eliminates long large-diameter primary piping, so the large break is bounded by the connecting nozzle/cross-vessel rather than a guillotine of a loop." },
  { id: "IE-18", name: "Pressure-relief / safety valve fails open (inadvertent or stuck-open primary relief path)", category: InitiatingEventCategory.RCB_BREACH, subcategory: "Relief/safety valve fault", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"], method: "FMEA", trip: "Low primary helium pressure following relief actuation / relief-line flow or position indication / reactor building activity", safety: ["Retain radionuclides (helium pressure boundary)", "Control heat removal", "Control radionuclide release (confinement)"], barrier: BarrierImpactState.OPEN, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "If a P-LOFC results in a pressure-relief-valve opening with or without sticking, a fission-product transport path is generated. Repeated openings or a stuck-open valve maintain a safe pressure but continue to release fission products to the environment; relief actuation is the only FP escape path in some sequences, so primary pressure is the crucial parameter. SGTR water ingress can drive the primary pressure up enough to actuate the safety relief valves, with cyclic or (stuck-open) continuous release." },
  { id: "IE-19", name: "Steam generator tube rupture with water/steam ingress (HPB heat-exchanger boundary breach, wet depressurization)", category: InitiatingEventCategory.RCB_BREACH, subcategory: "Heat-exchanger tube rupture / water ingress depressurization", states: ["POS-01", "POS-02", "POS-03"], method: "HBFT", trip: "", safety: ["Retain radionuclides (helium pressure boundary)", "Control chemical attack (limit graphite/fuel oxidation by moisture)", "Control heat generation (reactivity / SCRAM)", "Control heat removal", "Control radionuclide release (confinement)"], barrier: BarrierImpactState.BREACHED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "Genuinely missing HTGR-specific RCB initiator. In a steam-cycle HTGR the in-line steam generator tube is part of the helium pressure boundary, with secondary water/steam at higher pressure than the primary helium. A tube rupture or leak admits water/steam into the primary circuit (a boundary breach), raising primary pressure until the safety relief valves lift, which then provides the depressurization and fission-product release path. It is distinct from the dry helium-leak spectrum already listed because the breach direction is inward (water in, not helium out) and it adds a positive-reactivity insertion (undermoderated core) plus graphite/fuel chemical-attack challenge. The NGNP PRA names it as a distinct functional category (HPB heat-exchanger failures: SG tube leak / SG tube rupture); the GA MHTGR PRA lists Steam generator leaks as one of its seven detailed initiators and the only wet-core release path; ORNL identifies the three water-ingress safety concerns (positive reactivity, graphite chemical attack, and primary breach via relief-valve opening). Applicable only where the SG is pressurized and coupled to the primary at power/hot states (POS-01/02/03); not applicable at SCS-cooled, cold, refuelling, post-trip, or SCS-out states where the steam generator is depressurized or isolated. Method: HBFT/HAZOP on the SG tube boundary plus OEREV. Highly safety-significant for steam-cycle HTGRs." },
  { id: "IE-20", name: "Small steam generator tube leak (moisture ingress, slow)", category: InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, subcategory: "Steam generator tube failure / water ingress", states: ["POS-01", "POS-02", "POS-03", "POS-04"], method: "OEREV", trip: "Primary coolant moisture / humidity monitor (and SG secondary inventory/level mismatch)", safety: ["Retain radionuclides (helium pressure boundary integrity)", "Control chemical attack on graphite/fuel (moisture limit)", "Control reactivity"], barrier: BarrierImpactState.BREACHED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "HTGR-specific interfacing breach. Confirmed by Fort St. Vrain operating experience, where SG tube failures (first significant June 1980 event forced a ~6-month dry-out outage) introduced water into the primary, detected by moisture monitors. ORNL notes in-line SG designs have much higher ingress probability because secondary water/steam pressure exceeds primary helium pressure. Steam-and-water dump system and the dedicated water-ingress train of the helium purification system are the design mitigations." },
  { id: "IE-21", name: "Steam generator tube rupture (moderate water ingress)", category: InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, subcategory: "Steam generator tube failure / water ingress", states: ["POS-01", "POS-02", "POS-03", "POS-04"], method: "HBFT", trip: "Primary coolant moisture monitor + primary pressure rise (high) + SG secondary level/flow mismatch", safety: ["Retain radionuclides (helium pressure boundary integrity)", "Control reactivity", "Control chemical attack on graphite/fuel", "Remove core heat"], barrier: BarrierImpactState.BREACHED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "Classic HTGR-specific interfacing breach. The MHTGR PSID analyzed steam leaks and tube breaks with SCRAM, turbine trip, isolation and dump-valve closures; higher-probability scenarios gave modest power/fuel-temperature rises within limits. ORNL: SG tube ruptures cause pressure increases and surges in the primary system. Fort St. Vrain June 1984 event admitted >300 gallons of water following a circulator trip, demonstrating rapid moderate ingress. Steam-and-water dump system exists specifically to terminate this event." },
  { id: "IE-22", name: "Large / multiple steam generator tube rupture with relief-valve lift (BDBE water ingress)", category: InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, subcategory: "Steam generator tube failure / water ingress", states: ["POS-01", "POS-02", "POS-03", "POS-04"], method: "HBFT", trip: "Primary pressure high (relief-valve setpoint) + moisture monitor + SG inventory loss", safety: ["Retain radionuclides (helium pressure boundary integrity)", "Control reactivity", "Control chemical attack on graphite/fuel", "Limit combustible gas generation"], barrier: BarrierImpactState.OPEN, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "ORNL: in postulated low-probability sequences the primary pressure could increase enough to actuate safety relief valves, releasing primary-system gases to the atmosphere; modular HTGR cores are undermoderated so moisture ingress causes positive reactivity insertion and graphite-water reactions generate CO/H2 with explosive-gas-mixture concern in RPV and reactor building. Beyond-design-basis water-ingress consequences were more significant in the PSID scenario set. This is the bounding interfacing-breach release path." },
  { id: "IE-23", name: "Helium circulator water-lubricated bearing/seal water ingress", category: InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, subcategory: "Circulator interface water ingress", states: ["POS-01", "POS-02", "POS-03", "POS-04"], method: "OEREV", trip: "Primary coolant moisture / humidity monitor; circulator seal differential pressure", safety: ["Retain radionuclides (helium pressure boundary integrity)", "Control chemical attack on graphite/fuel"], barrier: BarrierImpactState.BREACHED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "Documented Fort St. Vrain generic problem: water reached the helium coolant from the circulator water-lubricated bearing/seal system whenever the helium/water seal pressure balance was upset; this was the primary reason for poor plant availability. It is a genuine interfacing-system breach distinct from SG tube failure. Applicable only when forced helium circulation (and thus the circulator water system) is operating. Mapped to the Generic HTGR as a circulator-interface ingress source." },
  { id: "IE-24", name: "Helium purification system pressure-boundary leak/rupture (primary helium and radionuclide release outside the boundary)", category: InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, subcategory: "Helium purification / treatment system breach", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06"], method: "FMEA", trip: "HPS area radiation/activity monitor; primary pressure decrease; HPS loop pressure/flow anomaly", safety: ["Retain radionuclides (helium pressure boundary integrity)", "Maintain primary inventory/pressure"], barrier: BarrierImpactState.BYPASSED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "The HPS is a safety-relevant system whose lines penetrate the reactor pressure boundary and which holds concentrated radiological inventory; the GCFR/HTGR initiating-event literature review explicitly calls out that purification/treatment-system failure modes penetrating the pressure boundary need study and lists helium-treatment-system PIEs as a sparse but real category. A HPS breach bypasses the helium barrier and releases concentrated FPs, distinct from a bare primary line leak." },
  { id: "IE-25", name: "Helium inventory / pressure-control (makeup and relief) system breach outside the primary boundary", category: InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, subcategory: "Helium inventory/pressure-control system breach", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05"], method: "FMEA", trip: "Primary pressure decrease (slow); inventory-control line flow/pressure anomaly; relief-line activity/position monitor", safety: ["Maintain primary inventory/pressure", "Retain radionuclides (helium pressure boundary integrity)"], barrier: BarrierImpactState.BYPASSED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "The MHTGR PRA models the pressure-relief subsystem and helium inventory/transfer as part of the primary system; INL/NGNP notes a filtered pathway on the primary-coolant pressure-relief line that reduces release during water-ingress events, confirming the relief line is a real interfacing penetration. A failure of this inventory/relief interface gives an out-of-boundary helium release and slow depressurization that bypasses the barrier. Retained at LOW importance: small leak rate, filtered path, and overlap with the primary-coolant-leak family handled under RCB_BREACH." },
  { id: "IE-26", name: "Shutdown Cooling System heat-exchanger tube failure (helium-to-water HX leak, water ingress through the SCS primary/secondary boundary)", category: InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, subcategory: "Heat-exchanger tube failure / water ingress (non-steam-generator)", states: ["POS-04", "POS-05", "POS-06", "POS-08"], method: "FMEA", trip: "", safety: ["Retain radionuclides (helium pressure boundary integrity)", "Control reactivity (water adds positive reactivity / moderation in undermoderated core)", "Control chemical attack on graphite/fuel (moisture-driven hydrolysis and oxidation)", "Remove core heat (loss of the SCS backup forced-cooling path)"], barrier: BarrierImpactState.BREACHED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "The SCS heat exchanger is the second helium pressure-boundary heat-exchanger interface in the plant (after the steam generator) and is the canonical non-SG interfacing-system water-ingress path, yet the listed set omits it. The NGNP PRA white paper (INL/EXT-11-21270, Sec 3.6) lists the functional initiating-event category 'HPB heat exchanger failures' as {steam generator tube leak, steam generator tube rupture, SCS heat exchanger failure} - so the SG events alone do not bound it. The MHTGR PRA (DOE-HTGR-86-011) FMEA Table 5-5 enumerates 'SCS heat exchanger leak' as a distinct primary-boundary water-leak failure mode: a helium-to-water shell-and-tube unit inside the reactor vessel with subcooled pressurized water in the tubes whose function is to 'maintain its primary/secondary coolant pressure boundary integrity'; a tube failure breaches that boundary and admits water into the primary helium. Table 5-5 gives the consequence in the refueling state as 'water in coolant improves core moderation challenging the control of heat generation [reactivity]; mass increase raises primary pressure leading to opening of primary reliefs; moisture may cause hydrolysis of failed fuel and oxidation of core graphite threatening the control of chemical attack.' The ORNL overview (ORNL Pub49707, Sec 7.4.1) names the SCS secondary-side water as a lower-pressure water source that, while less likely than in-line SGs, can still cause water ingress in unlikely operational sequences. This is genuinely distinct from the SG-tube initiators because the SCS HX is the heat-exchanger interface that is in service precisely when the steam generator is not (forced cooldown and shutdown/refuelling states), so it governs water-ingress risk in those plant states." },
  { id: "IE-27", name: "Loss of normal (non-Class 1E) AC distribution", category: InitiatingEventCategory.SPECIAL, subcategory: "Loss of electric power", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"], method: "FMEA", trip: "Circulator-speed-to-feedwater-flow mismatch (PPIS); loss of bus undervoltage", safety: ["Control heat removal", "Control heat generation"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "DOE-HTGR-86-011 Table 4-3 (functional intersystem dependencies) identifies electrical power (non-1E AC, 1E DC, 1E UPS) as one of three support systems supporting the majority of front-line systems; Section 5.2.4 logically selects an event causing loss of the normal electrical supply for further analysis. NUREG/CR-5750 functional impact category C/C1 (Loss of Safety-Related / Vital ac Bus) seeds the generic rate." },
  { id: "IE-28", name: "Loss of offsite power (LOOP)", category: InitiatingEventCategory.SPECIAL, subcategory: "Loss of electric power", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08"], method: "MLD", trip: "Loss of grid voltage / circulator-speed-to-feedwater-flow mismatch (PPIS)", safety: ["Control heat removal", "Control heat generation"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "DOE-HTGR-86-011 selects 'Loss of offsite power and inadvertent turbine trip' as one of seven detailed initiators and as the representative support-system fault (Table 5-7, Sec. 6.1.4). NGNP PRA cites loss of offsite power as the example cause of a transient with main loop failed and SCS available. NUREG/CR-5750 category B gives 4.6E-2/ry." },
  { id: "IE-29", name: "Loss of Class 1E 125 V DC power", category: InitiatingEventCategory.SPECIAL, subcategory: "Loss of electric power", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-08"], method: "FMEA", trip: "DC bus undervoltage; PPIS channel fault / fail-safe trip", safety: ["Control heat generation", "Maintain control of radionuclides"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "DOE-HTGR-86-011 Sec. 4.23 describes the Class 1E DC subsystem and its safety loads (RSCE, isolation valves, UPS inverters); Table 4-3 lists 1E DC among the dominant support systems. HTR-PM PSA development reports a Loss of vital DC bus case. NUREG/CR-5750 category C3 (Loss of Vital dc Bus) seeds the rate at ~2.1E-3/ry." },
  { id: "IE-30", name: "Loss of Class 1E uninterruptible power supply (vital instrument power)", category: InitiatingEventCategory.SPECIAL, subcategory: "Loss of instrument power", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-08"], method: "FMEA", trip: "Vital 120 V AC bus undervoltage; PPIS fail-safe trip", safety: ["Control heat generation", "Maintain control of radionuclides"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "DOE-HTGR-86-011 Sec. 4.24 describes the Class 1E UPS feeding the four vital buses for safety and investment protection; Table 4-3 lists 1E UPS among the support systems and notes the PPIS fail-safe design. NUREG/CR-5750 category QC4 (Loss of ac Instrumentation and Control) provides a generic anchor." },
  { id: "IE-31", name: "Loss of reactor plant cooling water (component cooling water)", category: InitiatingEventCategory.SPECIAL, subcategory: "Loss of component cooling water", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"], method: "FMEA", trip: "Circulator-motor / HPS high temperature; cooling-water low flow", safety: ["Control heat removal", "Control chemical attack"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "DOE-HTGR-86-011 Sec. 4.15 lists the RPCWS heat loads (HPS, HTS circulator motors, moisture-monitor compressors, neutron control assemblies); Table 4-3 maps RPCW as a support system feeding HTS, HPS and others. NUREG/CR-5750 category E/QL4 (Loss of Safety-Related / Nonsafety-Related Cooling Water) seeds the rate (~9.6E-3/ry)." },
  { id: "IE-32", name: "Loss of service water / ultimate heat sink to forced-cooling systems", category: InitiatingEventCategory.SPECIAL, subcategory: "Loss of component cooling water", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"], method: "MLD", trip: "Service-water low flow; SCS/HTS heat-exchanger high temperature", safety: ["Control heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.MERGED, importance: ImportanceLevel.MEDIUM, basis: "DOE-HTGR-86-011 Sec. 5.2.4 names plant service water as one of three dominant support systems and states it is sufficient to consider loss of service water as an initiator within the loss-of-HTS event tree (Appendix C.2 Loss of Main Loop Cooling) rather than a separate tree. NUREG/CR-5750 categories E1/E2 (Total/Partial Loss of Service Water, ~2.9E-2/ry) seed the rate." },
  { id: "IE-33", name: "Loss of instrument and service air", category: InitiatingEventCategory.SPECIAL, subcategory: "Loss of instrument air", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"], method: "FMEA", trip: "Instrument-air header low pressure; feedwater/steam-flow control deviation", safety: ["Control heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "DOE-HTGR-86-011 Sec. 4.19 describes the instrument and service air subsystem providing compressed air for all instrumentation, controls and services; Table 4-3 lists instrument and service air as a support system feeding front-line controls. NUREG/CR-5750 category D/D1 (Loss of Instrument or Control Air) seeds the rate (~3.4E-3/ry, PWR)." },
  { id: "IE-34", name: "Loss of HVAC / essential ventilation to electrical and I&C spaces", category: InitiatingEventCategory.SPECIAL, subcategory: "Loss of HVAC", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"], method: "FMEA", trip: "Equipment-room high temperature; battery-room temperature", safety: ["Control heat generation", "Maintain control of radionuclides"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "NGNP PRA INL/EXT-11-21270 lists reactor building HVAC filtration as an active SSC supporting control of radionuclides and notes support systems (including man-machine interface and HVAC) are modeled though not tabulated; DOE-HTGR-86-011 Sec. 4.23 lists Class 1E battery-room fans as a DC load whose loss affects DC availability. Generic loss-of-HVAC treatment per standard PRA practice." },
  { id: "IE-35", name: "Loss of helium purification (loss of coolant chemistry control)", category: InitiatingEventCategory.SPECIAL, subcategory: "Loss of helium purification", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-08"], method: "HAZOP", trip: "Primary-coolant impurity / moisture concentration high", safety: ["Control chemical attack"], barrier: BarrierImpactState.DEGRADED, screening: ScreeningStatus.SCREENED_OUT, importance: ImportanceLevel.LOW, basis: "DOE-HTGR-86-011 Table 5-4 (Challenges to Control Chemical Attack) lists 'Helium not purified' from HPS control/mechanical/operator faults; failure effect is limited oxidation/hydrolysis with insignificant risk, event tree not required, the more serious cases covered under primary-coolant-leak (air ingress) and steam-generator-leak (water ingress) trees. The HTGR IE literature notes purification-system initiators receive less emphasis." },
  { id: "IE-36", name: "Helium purification line break (small primary depressurization via HPS connection)", category: InitiatingEventCategory.SPECIAL, subcategory: "Loss of helium purification", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-08"], method: "FMEA", trip: "Primary-coolant low pressure (moisture/pressure monitors)", safety: ["Maintain control of radionuclides", "Control heat removal", "Control chemical attack"], barrier: BarrierImpactState.BREACHED, screening: ScreeningStatus.MERGED, importance: ImportanceLevel.MEDIUM, basis: "DOE-HTGR-86-011 Table 5-5 (Challenges to Critical Structures, Primary Coolant Boundary Components) lists 'Helium purification leaks' with effect of primary-system depressurization, activity release, reduced forced cooling, and air ingress; dispositioned into the primary-coolant-leak event tree. (Crosses into RCB_BREACH; retained here as the source-side origin of the small leak.)" },
  { id: "IE-37", name: "Instrument line break (small primary depressurization via instrument penetration)", category: InitiatingEventCategory.SPECIAL, subcategory: "Instrument line break", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-08"], method: "FMEA", trip: "Primary-coolant low pressure", safety: ["Maintain control of radionuclides", "Control heat removal", "Control chemical attack"], barrier: BarrierImpactState.BREACHED, screening: ScreeningStatus.MERGED, importance: ImportanceLevel.MEDIUM, basis: "DOE-HTGR-86-011 Table 5-5 lists 'Instrument line leaks' among primary-coolant-boundary failure modes causing depressurization and activity release, dispositioned into the primary-coolant-leak event tree; HTGR IE literature confirms instrumentation-line small breaks as design-basis small-break depressurization events. (Crosses into RCB_BREACH; retained here as the instrument-source origin.)" },
  { id: "IE-38", name: "Fuel-handling / refuelling source-handling event (in-vessel and ex-vessel handling)", category: InitiatingEventCategory.SPECIAL, subcategory: "Refuelling and spent-fuel source handling", states: ["POS-06"], method: "FMEA", trip: "Fuel-handling machine fault interlock; element temperature/position", safety: ["Maintain control of radionuclides", "Control heat removal"], barrier: BarrierImpactState.BREACHED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "NGNP PRA INL/EXT-11-21270 scopes 'fuel elements in storage systems' and 'fuel handling and storage systems' as radionuclide sources with associated barriers requiring initiating events, including plant configurations in which the reactor is shut down/refuelling. DOE-HTGR-86-011 evaluates refuelling-condition failure modes for core/handling structures in the MLD (Table 5-5)." },
  { id: "IE-39", name: "Loss of cooling to spent / stored fuel and ex-core fuel storage source", category: InitiatingEventCategory.SPECIAL, subcategory: "Refuelling and spent-fuel source handling", states: ["POS-05", "POS-06", "POS-08"], method: "FMEA", trip: "Storage-cooling low flow / stored-fuel temperature", safety: ["Maintain control of radionuclides", "Control heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "NGNP PRA INL/EXT-11-21270 states the PRA should include accidents involving spent fuel stored on site (analogous to spent-fuel-pool accidents in LWRs) and lists fuel elements outside the core / fuel handling and storage systems as a radioactive-material source with its own barriers in the MLD. Bounded by TRISO retention and low stored-fuel decay heat." },
  { id: "IE-40", name: "Loss of helium inventory and pressure (makeup) control system", category: InitiatingEventCategory.SPECIAL, subcategory: "Loss of helium inventory control", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"], method: "FMEA", trip: "", safety: ["Control chemical attack", "Maintain control of radionuclides"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "The Generic HTGR helium services include a purification AND an inventory/pressure (makeup) control function; the prompt lists a 'helium purification and inventory-control system' as a key system. Loss of the inventory/makeup-control function is a distinct support-system initiator from the loss of purification (chemistry control) already on the list. It is a genuine HTGR support-system fault: inability to make up normal small leakage or maintain pressure-control setpoint degrades operating margin and forces a controlled shutdown, while an uncontrolled inventory transfer challenges primary pressure control. The coolant boundary stays intact (no break, hence INTACT), which distinguishes it from the HPS-line-break and instrument-line-break depressurizations already listed. Gas-reactor IE reviews catalogue inventory/pressure-control faults as support-system preliminary initiating events separate from purification." },
  { id: "IE-41", name: "Erroneous control rod (or rod group) withdrawal by operator", category: InitiatingEventCategory.HUMAN_FAILURE, subcategory: "Operator-induced reactivity insertion", states: ["POS-01", "POS-02", "POS-03"], method: "MLD", trip: "High neutron flux / high power rate-of-change (RPS), backed by high core-outlet helium temperature", safety: ["Control of heat generation (reactivity control)", "Control of heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "NGNP PRA white paper lists the functional IE category 'Energy conversion system transients with intact HPB and reactivity addition: Control rod or group withdrawal' and states the HRA explicitly treats operator errors of commission and operator actions in the initiation of events. ORNL safety characterization names 'inadvertent control rod action due to power measurement error or operator error' as a reactivity initiator. Applicable only in states where rods are at or near a withdrawn/controlling position and the core is critical or being made critical (full power, load follow, hot standby). NUREG/CR-5750 seeds a generic inadvertent-reactivity-addition rate. Strong negative temperature coefficient and RPS scram bound the transient with no TRISO damage." },
  { id: "IE-42", name: "Erroneous reserve-shutdown / rod mis-positioning during startup line-up", category: InitiatingEventCategory.HUMAN_FAILURE, subcategory: "Operator-induced reactivity insertion", states: ["POS-03", "POS-05"], method: "HAZOP", trip: "Startup-range high neutron flux / short reactor period (RPS)", safety: ["Control of heat generation (reactivity control)"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "ORNL safety characterization lists inadvertent control rod action from power-measurement or operator error among reactivity initiators; an out-of-sequence or mis-positioned rod line-up during approach-to-critical is the procedural-error subset, applicable in hot standby (approach to power) and cold shutdown (initial criticality from a closed primary). A HAZOP of the startup rod-withdrawal procedure (deviation: 'more reactivity / wrong order') is the method most likely to surface it. NGNP PRA confirms the PRA covers all shutdown/startup configurations via the master logic diagram and treats operator errors of commission. Bounded by negative temperature coefficient and RPS." },
  { id: "IE-43", name: "Erroneous primary depressurization / inadvertent vent or relief-valve opening during maintenance", category: InitiatingEventCategory.HUMAN_FAILURE, subcategory: "Operator-induced loss of primary boundary integrity", states: ["POS-04", "POS-05", "POS-08"], method: "HAZOP", trip: "Low primary helium pressure / high purification-line or cavity flow (RPS depressurization trip)", safety: ["Control of radionuclide release (helium pressure boundary)", "Control of heat removal"], barrier: BarrierImpactState.BREACHED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "NGNP PRA white paper defines the functional IE category 'Primary system HPB leaks and breaks: HPB failures resulting in slow depressurization,' covers maintenance configurations in the IE search, and describes operator closure/opening of the MPS maintenance valves and circuit isolation, so an inadvertent open is a human error of commission on that boundary. NUREG/CR-5750 provides a generic 'inadvertent opening of a relief/vent valve' seed rate. Applicable in forced cooldown on SCS, cold shutdown (primary still closed), and SCS-out maintenance, where valves are being manipulated. ORNL confirms a depressurized core still removes decay heat passively via the RCCS." },
  { id: "IE-44", name: "Mis-positioning of fuel-handling / refuelling line-up causing a fuel-handling event", category: InitiatingEventCategory.HUMAN_FAILURE, subcategory: "Operator error during refuelling configuration", states: ["POS-06"], method: "FMEA", trip: "Fuel-handling-machine interlock / position and load monitoring (handling-system protection)", safety: ["Control of radionuclide release (TRISO fuel coating)", "Maintain core and reactor vessel geometry", "Control of heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "NGNP PRA white paper states the IE search and master logic diagram cover all operating and shutdown modes including refueling and defueled configurations, and that sources of radioactive material in the fuel handling and storage systems are within PRA scope; operator errors of commission are explicitly treated. Applicable only in the refuelling state (vessel open). MHTGR refuelling equipment (fuel-handling machine, positioner, transfer cask) makes mis-positioning the credible human-error mode. Importance is low because TRISO coating limits source term and decay heat is low at refuelling, but it is a genuine human-induced initiator in this POS, surfaced by an FMEA of the fuel-handling line-up." },
  { id: "IE-45", name: "Operator-induced overcooling transient (erroneous secondary/heat-removal maneuver)", category: InitiatingEventCategory.HUMAN_FAILURE, subcategory: "Operator-induced reactivity/temperature transient", states: ["POS-01", "POS-02", "POS-03"], method: "HAZOP", trip: "High neutron flux / low core-inlet helium temperature (RPS), high SG/secondary deviation", safety: ["Control of heat generation (reactivity control)", "Control of heat removal"], barrier: BarrierImpactState.INTACT, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.LOW, basis: "NGNP PRA white paper lists 'overcooling transients' under the reactivity-addition IE category; ORNL safety characterization lists 'sudden increase or decrease of the primary heat removal rate' as a reactivity-event initiator. The human-error subset is an erroneous circulator-speed or secondary-side maneuver that overcools the primary, applicable only when the core is critical (full power, load follow, hot standby). A HAZOP of the power-conversion control line-up ('more flow / colder inlet') is the surfacing method. Bounded by the negative temperature coefficient and RPS with no fuel damage; low importance." },
  { id: "IE-46", name: "Operator inadvertent trip or isolation of the operating heat-transport / forced-cooling train (commission error causing loss of forced cooling)", category: InitiatingEventCategory.HUMAN_FAILURE, subcategory: "Operator-induced loss of forced decay-heat / core heat removal", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-07"], method: "FMEA", trip: "", safety: ["Control of heat removal", "Maintain core and reactor vessel geometry"], barrier: BarrierImpactState.DEGRADED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.HIGH, basis: "Loss of forced cooling (loss of main loop / LOFC) is the dominant HTGR internal challenge to the heat-removal safety function, and an operator commission error that actively trips the running main helium circulator, trips the operating SCS train, or closes an isolation during an evolution is a credible at-initiator human failure (distinct from the rejected latent line-up error, which is a pre-initiator basic event). The MHTGR PSID (HTGR-86-024) carries a 'loss of main loop cooling' initiating event/event tree, and ORNL/TM-2014/187 Sect. 7.1-7.2 treats pressurized and depressurized LOFC as the defining heat-removal challenge; an operator-initiated entry into LOFC is the human-failure counterpart of that IE. Helium boundary stays intact; the challenge is to forced heat removal, with passive RCCS as backstop, so barrier impact is DEGRADED (heat-removal path lost, no barrier opened)." },
  { id: "IE-47", name: "Operator-induced steam-generator / secondary-side mis-line-up causing primary moisture (water/steam) ingress", category: InitiatingEventCategory.HUMAN_FAILURE, subcategory: "Operator-induced water/steam ingress (HTGR-specific)", states: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05"], method: "HAZOP", trip: "", safety: ["Control of heat generation (reactivity control)", "Control of radionuclide release (TRISO fuel coating)"], barrier: BarrierImpactState.DEGRADED, screening: ScreeningStatus.RETAINED, importance: ImportanceLevel.MEDIUM, basis: "Moisture (water/steam) ingress from a steam-cycle HTGR steam generator is an HTGR-specific initiating event that inserts positive reactivity in the undermoderated core and oxidizes graphite/fuel. ORNL/TM-2014/187 Sect. 7.4-7.5.1 lists steam-generator tube failure / water ingress among reactivity initiators and explicitly notes that mitigation relies on moisture monitors actuating SG isolation valves and on operator actions; an operator commission error on the secondary/feedwater line-up (or failure to isolate during a startup/shutdown evolution that permits steam-side communication to the primary) is the human-failure path that opens this same ingress source. This is the operator-induced analogue of the equipment-driven SG-tube-rupture water-ingress IE and is credible in the states where SG/feedwater line-ups are manipulated. Barrier impact INTACT-to-DEGRADED (no boundary opened, but reactivity/graphite-oxidation challenge to the TRISO/core)." },
];

const INITIATORS: InitiatorDefinition[] = INITIATOR_SEEDS.map(buildInitiator);

const COMPLETENESS = {
  functionalCategoriesCovered: [InitiatingEventCategory.TRANSIENT, InitiatingEventCategory.RCB_BREACH, InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, InitiatingEventCategory.SPECIAL, InitiatingEventCategory.HUMAN_FAILURE],
  perSystemSearchPerformed: true,
  perSupportSystemSearchPerformed: true,
  multipleFailureInitiatorsIncluded: true,
  temporaryAlignmentsConsidered: true,
  multiReactorEventsAddressed: true,
  radioactiveSourceMechanismsAddressed: true,
  implementsSrs: [sr("IE-A9", "A"), sr("IE-A15", "A")],
};

const REVIEWS = [
  {
    reviewType: "INTERVIEW" as const,
    date: "2026-06-21",
    personnelRoles: ["HTGR reactor operations shift supervisor", "Helium systems / coolant-chemistry engineer (purification and inventory control)", "Steam-generator and feedwater system engineer", "Reactivity-control and reserve-shutdown systems engineer", "Refuelling and fuel-handling operations lead", "Plant electrical and I&C support-systems engineer", "PRA initiating-event analyst (facilitator)"],
    findings: "Structured interviews were held with operations and system-cognizant engineers to challenge the deductive MLD/HBFT and inductive FMEA initiator list against lived plant behavior, following the elicitation step used in the NGNP PRA white paper (INL/EXT-11-21270) and the full-power HTGR IE-identification method. Interviewees confirmed the pressurized vs depressurized loss-of-forced-cooling split (IE-01/IE-14 vs IE-17) as the dominant HTGR challenge and confirmed that air ingress is correctly placed as a downstream consequence of large depressurization rather than as a standalone internal initiator. The helium-systems engineer confirmed the purification and inventory-control faults (IE-24, IE-25, IE-35, IE-36, IE-40) and that loss of purification is an HTGR-specific chemical-attack initiator with no LWR analogue. The steam-generator engineer confirmed the graded moisture-ingress family (IE-13, IE-19, IE-20, IE-21, IE-22) and that water ingress simultaneously adds positive reactivity by steam moderation in the undermoderated graphite core and drives graphite/fuel oxidation and combustible-gas generation, so the multi-function safety-function tagging is correct. Operations confirmed the human-failure-at-initiator set (IE-41 through IE-47) reflects real at-the-controls error paths, in particular erroneous rod withdrawal (IE-41), inadvertent forced-cooling-train trip/isolation (IE-46), and the HTGR-specific operator-induced moisture-ingress mis-line-up (IE-47). The interviews surfaced no missing system-level initiator and confirmed the POS-specific configuration mapping, including the refuelling-only and SCS-out-of-service maintenance initiators. Interviewees endorsed the verified set as complete at the system and support-system level for internal events, with internal fire/flood and external hazards correctly excluded to the separate hazard PRAs.",
    overlookedInitiatorsIdentified: ["Confirmed no standalone internal air-ingress initiator is missing: air ingress is retained as a consequence of IE-17 (large break / D-LOFC) in event-sequence development, not as an initiator.", "Operator-induced moisture/steam ingress via secondary-side mis-line-up (IE-47) was confirmed by operations as a credible at-initiator human failure and is retained.", "Loss of cooling to ex-core / spent stored fuel source (IE-39) was confirmed as a real shutdown-state source initiator and is retained for POS-05/06/08."],
    implementsSrs: [sr("IE-A8", "A")],
  },
  {
    reviewType: "EVALUATION" as const,
    date: "2026-06-24",
    personnelRoles: ["Independent PRA lead reviewer (not the originating analyst)", "Senior HTGR safety-analysis reviewer", "Licensing-basis-event selection reviewer", "Configuration / plant-operating-state reviewer"],
    findings: "An independent documentation-based evaluation cross-walked the 47-initiator set against the external HTGR record and against the structural completeness requirements of ASME/ANS RA-S-1.4 (non-LWR PRA standard) initiating-event element. The set was checked against four reference sources: the NGNP PRA white paper (INL/EXT-11-21270), the MHTGR PRA (DOE-HTGR-86-011) and ORNL Overview of Modular HTGR Safety Characterization, the OECD/NEA MHTGR-350 benchmark design data, and the peer-reviewed full-power HTGR initiating-event identification method. Every challenge category required for internal events is populated: transients including loss of forced cooling and loss of heat sink and reactivity insertion (IE-01 to IE-14), reactor-coolant-boundary breach graded by break size with the relief-valve fault (IE-15 to IE-19), interfacing-systems boundary breaches including the SGTR water-ingress family and circulator-seal and SCS-HX and purification/inventory boundary breaches (IE-20 to IE-26), the support-system and source SPECIAL set (IE-27 to IE-40), and the at-initiator human-failure set (IE-41 to IE-47). The evaluation confirmed traceability: each initiator cites a source in the HTGR literature, each is mapped to challenged safety functions and to the radionuclide barriers (TRISO, helium pressure boundary, confinement), and each applicableStates field is consistent with the handed-over POS definitions. The break-size depressurization spectrum and the moisture-ingress magnitude grading were judged to give adequate resolution without padding. The exclusion of internal fire/flood and external hazards was verified as correct scope control. The reviewer found no category gap, no orphan support dependency, and no POS left without an applicable transient and depressurization initiator. Method-id assignment (MLD, HBFT, FMEA, HAZOP, PHA, OEREV, GENLIST) was checked for plausibility against each initiator's nature and found consistent (heat-balance-driven items to HBFT, component-fault items to FMEA, process-deviation items to HAZOP, experience-frequency items to OEREV/GENLIST, top-down boundary and human-failure items to MLD).",
    overlookedInitiatorsIdentified: ["Verified that the support-system sweep leaves no credited DC, instrument-power, cooling-water, instrument-air, HVAC, purification, or inventory dependency without a matching loss-of-support initiator (IE-27 to IE-40).", "Verified the human-failure-at-initiator category covers reactivity (IE-41, IE-42), depressurization (IE-43), refuelling mis-line-up (IE-44), overcooling (IE-45), forced-cooling-train trip (IE-46), and moisture ingress (IE-47), with no overlooked at-initiator human action class.", "Confirmed no duplicate or double-counted initiator across the TRANSIENT, RCB_BREACH, INTERFACING_SYSTEMS_RCB_BREACH, SPECIAL, and HUMAN_FAILURE categories despite related water-ingress and depressurization mechanisms appearing in more than one category by design (boundary-breach vs interfacing-system framing)."],
    implementsSrs: [sr("IE-A8", "A")],
  },
];

const MLD_MODEL: MasterLogicDiagram = {
  "uuid": "MLD-HTGR-1",
  "name": "Generic HTGR master logic diagram",
  "description": "Uncontrolled radionuclide release from the Generic HTGR: failure to preserve the three retention barriers (TRISO coating, helium pressure boundary, confinement) caused by an internal-events initiator that defeats one or more of the four modular-HTGR safety functions (control reactivity, remove core/decay heat, maintain the barriers, limit chemical attack).",
  "methodKind": "MASTER_LOGIC_DIAGRAM",
  "analyst": "Aakash Patel",
  "supportingDocuments": [
    "ORNL Overview of Modular HTGR Safety Characterization (Pub49707)",
    "NGNP PRA White Paper (INL/EXT-11-21270)"
  ],
  "radioactiveSourceIds": [
    "IN_CORE_TRISO_FUEL",
    "PRIMARY_CIRCUIT_PLATEOUT",
    "SPENT_FUEL_BLOCKS",
    "PRIMARY_HELIUM_ACTIVITY"
  ],
  "plantOperatingStateIds": [
    "POS-01",
    "POS-02",
    "POS-03",
    "POS-04",
    "POS-05",
    "POS-06",
    "POS-07",
    "POS-08"
  ],
  "radionuclideBarrierIds": [
    "TRISO coating",
    "Primary boundary",
    "Containment"
  ],
  "safetyFunctionIds": [
    "SF-RC",
    "SF-HR",
    "SF-RB",
    "SF-CA"
  ],
  "systemIds": [],
  "nodes": [
    {
      "id": "MLD-0",
      "description": "Uncontrolled radionuclide release: Challenge to radionuclide-transport control, decomposed top-down through the four modular-HTGR safety functions. A release requires defeat of the barriers, driven either directly (boundary breach) or indirectly (loss of reactivity control, loss of heat removal, or chemical attack drives fuel past coating-failure limits).",
      "derivedInitiatorIds": [],
      "challengedSafetyFunctionId": "SF-RB"
    },
    {
      "id": "MLD-RC",
      "description": "BRANCH A - Failure of SF-RC: control of reactivity / shut down the reactor. Reactivity-insertion and anticipated-transient initiators that, absent the negative temperature coefficient plus rods/RSCE, drive heat generation past barrier limits. Grounded in the MHTGR PRA control-rod-withdrawal and ATRS chapters and the ORNL 'control of reactivity' function.",
      "derivedInitiatorIds": [],
      "parentId": "MLD-0",
      "challengedSafetyFunctionId": "SF-RC"
    },
    {
      "id": "MLD-RC-1",
      "description": "Rod-driven reactivity insertion / transient overpower: inadvertent withdrawal, drop, or mis-action of control rods or rod banks, hardware-initiated. MHTGR PRA control-rod-withdrawal event chapter.",
      "derivedInitiatorIds": [
        "IE-08",
        "IE-09"
      ],
      "parentId": "MLD-RC",
      "challengedSafetyFunctionId": "SF-RC"
    },
    {
      "id": "MLD-RC-2",
      "description": "Spatial / xenon-induced and overcooling-coupled reactivity transients: power redistribution from xenon oscillation, and positive reactivity inserted by a sudden rise in primary heat-removal rate (core overcooling) acting through the negative temperature coefficient.",
      "derivedInitiatorIds": [
        "IE-10",
        "IE-11"
      ],
      "parentId": "MLD-RC",
      "challengedSafetyFunctionId": "SF-RC"
    },
    {
      "id": "MLD-RC-3",
      "description": "Anticipated transient requiring scram / spurious-trip reactivity-control challenge: general reactor trip or spurious scram where the reactivity-control demand is the initiating disturbance. Also exercises heat removal.",
      "derivedInitiatorIds": [
        "IE-07"
      ],
      "parentId": "MLD-RC",
      "challengedSafetyFunctionId": "SF-RC"
    },
    {
      "id": "MLD-RC-4",
      "description": "Refuelling-configuration reactivity error: fuel-loading or element mispositioning during vessel-open refuelling that inserts unplanned reactivity (POS-06).",
      "derivedInitiatorIds": [
        "IE-12"
      ],
      "parentId": "MLD-RC",
      "challengedSafetyFunctionId": "SF-RC"
    },
    {
      "id": "MLD-RC-5",
      "description": "Operator-induced reactivity insertion (at-initiator human failure): erroneous rod or rod-group withdrawal, reserve-shutdown / rod mis-positioning during startup line-up, and erroneous overcooling maneuvers that insert positive reactivity through the temperature coefficient.",
      "derivedInitiatorIds": [
        "IE-41",
        "IE-42",
        "IE-45"
      ],
      "parentId": "MLD-RC",
      "challengedSafetyFunctionId": "SF-RC"
    },
    {
      "id": "MLD-HR",
      "description": "BRANCH B - Failure of SF-HR: remove core and decay heat to an ultimate heat sink. Loss-of-forced-cooling and loss-of-heat-sink initiators in pressurized (P-LOFC) and depressurized forms, plus the support-system and power losses that defeat forced cooling. Grounded in the ORNL 'control of core heat removal' function and the MHTGR PRA loss-of-HTS and loss-of-offsite-power chapters.",
      "derivedInitiatorIds": [],
      "parentId": "MLD-0",
      "challengedSafetyFunctionId": "SF-HR"
    },
    {
      "id": "MLD-HR-1",
      "description": "Loss of forced cooling, primary path (pressurized): main helium circulator trip and loss of the main circulator-plus-steam-generator heat-transport loop with the reactor at power. P-LOFC; conduction/RCCS must take over. MHTGR PRA loss-of-HTS chapter.",
      "derivedInitiatorIds": [
        "IE-01",
        "IE-14"
      ],
      "parentId": "MLD-HR",
      "challengedSafetyFunctionId": "SF-HR"
    },
    {
      "id": "MLD-HR-2",
      "description": "Loss of the active backup forced-cooling path: loss of the Shutdown Cooling System during forced-cooldown, cold-shutdown, and post-trip states where SCS is the credited heat-removal train.",
      "derivedInitiatorIds": [
        "IE-04"
      ],
      "parentId": "MLD-HR",
      "challengedSafetyFunctionId": "SF-HR"
    },
    {
      "id": "MLD-HR-3",
      "description": "Loss of the primary heat sink (secondary side): loss of steam-generator heat removal and loss of feedwater, removing the normal sink while the circulator may still run.",
      "derivedInitiatorIds": [
        "IE-02",
        "IE-03"
      ],
      "parentId": "MLD-HR",
      "challengedSafetyFunctionId": "SF-HR"
    },
    {
      "id": "MLD-HR-4",
      "description": "Power-conversion transients that defeat heat removal: turbine trip / loss of the power-conversion system. Couples to reactivity through the overcooling/return path.",
      "derivedInitiatorIds": [
        "IE-05"
      ],
      "parentId": "MLD-HR",
      "challengedSafetyFunctionId": "SF-HR"
    },
    {
      "id": "MLD-HR-5",
      "description": "Loss of electrical power defeating forced cooling: loss of offsite power (TRANSIENT-family and SPECIAL-family entries) and loss of normal non-Class-1E AC distribution that strip motive power from circulators and pumps. LOOP appears under both its transient and support-system identifications.",
      "derivedInitiatorIds": [
        "IE-06",
        "IE-28",
        "IE-27"
      ],
      "parentId": "MLD-HR",
      "challengedSafetyFunctionId": "SF-HR"
    },
    {
      "id": "MLD-HR-6",
      "description": "Loss of cooling/heat-sink support systems: loss of reactor plant (component) cooling water, loss of service water / ultimate heat sink to forced-cooling systems, loss of instrument and service air, all of which disable or trip the forced-cooling trains.",
      "derivedInitiatorIds": [
        "IE-31",
        "IE-32",
        "IE-33"
      ],
      "parentId": "MLD-HR",
      "challengedSafetyFunctionId": "SF-HR"
    },
    {
      "id": "MLD-HR-7",
      "description": "Loss of vital electrical / I&C support that fails the heat-removal and protection actuation: loss of Class 1E 125 V DC power, loss of Class 1E vital instrument UPS, and loss of essential HVAC to electrical and I&C spaces.",
      "derivedInitiatorIds": [
        "IE-29",
        "IE-30",
        "IE-34"
      ],
      "parentId": "MLD-HR",
      "challengedSafetyFunctionId": "SF-HR"
    },
    {
      "id": "MLD-HR-8",
      "description": "Operator-induced loss of forced cooling (at-initiator human failure): commission error tripping or isolating the operating heat-transport / forced-cooling train.",
      "derivedInitiatorIds": [
        "IE-46"
      ],
      "parentId": "MLD-HR",
      "challengedSafetyFunctionId": "SF-HR"
    },
    {
      "id": "MLD-HR-9",
      "description": "Loss of heat removal from source-specific heat loads outside the at-power core: refuelling / source-handling heat-removal failure and loss of cooling to spent / stored ex-core fuel sources (shutdown and refuelling states).",
      "derivedInitiatorIds": [
        "IE-38",
        "IE-39"
      ],
      "parentId": "MLD-HR",
      "challengedSafetyFunctionId": "SF-HR"
    },
    {
      "id": "MLD-CA",
      "description": "BRANCH C - Failure of SF-CA: limit chemical attack from air and water/steam ingress. The dominant steam-cycle-HTGR chemical-attack source is moisture from steam-generator and other helium-to-water heat-exchanger boundaries; the ORNL Overview names three coupled concerns - positive reactivity in the undermoderated core, graphite/fuel oxidation, and primary-boundary breach via relief-valve lift. Air ingress follows a depressurized breach.",
      "derivedInitiatorIds": [],
      "parentId": "MLD-0",
      "challengedSafetyFunctionId": "SF-CA"
    },
    {
      "id": "MLD-CA-1",
      "description": "Moisture ingress from steam-generator-tube faults, graded by water mass: small slow tube leak, moderate tube rupture, and the reactivity-transient framing of SG-tube water/steam ingress. Inserts positive reactivity in the undermoderated core and oxidizes graphite/fuel. Confirmed by the HTGR water-ingress literature.",
      "derivedInitiatorIds": [
        "IE-13",
        "IE-20",
        "IE-21"
      ],
      "parentId": "MLD-CA",
      "challengedSafetyFunctionId": "SF-CA"
    },
    {
      "id": "MLD-CA-2",
      "description": "Moisture ingress from non-steam-generator helium-to-water boundaries: helium-circulator water-lubricated bearing/seal water ingress and Shutdown-Cooling-System helium-to-water heat-exchanger tube failure. Same chemical-attack and moderation concern via a different interface; SCS HX failure also removes the backup cooling path.",
      "derivedInitiatorIds": [
        "IE-23",
        "IE-26"
      ],
      "parentId": "MLD-CA",
      "challengedSafetyFunctionId": "SF-CA"
    },
    {
      "id": "MLD-CA-3",
      "description": "Loss of coolant-chemistry control: loss of helium purification (loss of impurity/moisture control) and loss of the helium inventory/pressure (makeup) control system, both of which degrade the plant's ability to limit oxidizing/corrosive impurities in the primary helium.",
      "derivedInitiatorIds": [
        "IE-35",
        "IE-40"
      ],
      "parentId": "MLD-CA",
      "challengedSafetyFunctionId": "SF-CA"
    },
    {
      "id": "MLD-CA-4",
      "description": "Operator-induced water/steam ingress (at-initiator human failure, HTGR-specific): erroneous steam-generator / secondary-side mis-line-up that admits primary moisture, inserting positive reactivity and challenging the TRISO coating through chemical attack.",
      "derivedInitiatorIds": [
        "IE-47"
      ],
      "parentId": "MLD-CA",
      "challengedSafetyFunctionId": "SF-CA"
    },
    {
      "id": "MLD-RB",
      "description": "BRANCH D - Direct challenge to SF-RB: maintain the radionuclide transport barriers. Reactor-coolant-boundary breaches and interfacing-system breaches that directly open the helium pressure boundary or a fuel-coating/confinement barrier, sized from very small leaks to large depressurization. Grounded in the NGNP PRA barrier-integrity framework (Table 3-2 sources and barriers) and the MHTGR PRA primary-leak-by-size categorization.",
      "derivedInitiatorIds": [],
      "parentId": "MLD-0",
      "challengedSafetyFunctionId": "SF-RB"
    },
    {
      "id": "MLD-RB-1",
      "description": "Primary helium pressure-boundary breach graded by break size: small leak (slow depressurization, forced cooling available), moderate / intermediate break, and large break / rapid depressurization (D-LOFC, which also challenges reactivity, passive heat removal, and admits air ingress). MHTGR PRA primary-leak-by-size families.",
      "derivedInitiatorIds": [
        "IE-15",
        "IE-16",
        "IE-17"
      ],
      "parentId": "MLD-RB",
      "challengedSafetyFunctionId": "SF-RB"
    },
    {
      "id": "MLD-RB-2",
      "description": "Boundary breach via a relief / safety valve path: inadvertent or stuck-open primary pressure-relief or safety valve providing an open release path from the helium boundary through the confinement.",
      "derivedInitiatorIds": [
        "IE-18"
      ],
      "parentId": "MLD-RB",
      "challengedSafetyFunctionId": "SF-RB"
    },
    {
      "id": "MLD-RB-3",
      "description": "Heat-exchanger-tube boundary breach with water ingress crossing the helium boundary (wet depressurization): steam-generator tube rupture treated as an HPB heat-exchanger boundary breach, and the large / multiple SG-tube rupture with relief-valve lift (BDBE water ingress) that also generates combustible gas. Simultaneous barrier breach plus chemical attack plus moisture reactivity.",
      "derivedInitiatorIds": [
        "IE-19",
        "IE-22"
      ],
      "parentId": "MLD-RB",
      "challengedSafetyFunctionId": "SF-RB"
    },
    {
      "id": "MLD-RB-4",
      "description": "Interfacing-system boundary breaches through auxiliary connections to the primary circuit: helium purification system pressure-boundary leak/rupture, helium inventory/pressure-control (makeup and relief) system breach, helium-purification line break, and instrument line break - each a small primary depressurization and radionuclide path outside the boundary through a penetration. NGNP/MHTGR interfacing-systems breach families.",
      "derivedInitiatorIds": [
        "IE-24",
        "IE-25",
        "IE-36",
        "IE-37"
      ],
      "parentId": "MLD-RB",
      "challengedSafetyFunctionId": "SF-RB"
    },
    {
      "id": "MLD-RB-5",
      "description": "Operator-induced boundary breach (at-initiator human failure): erroneous primary depressurization / inadvertent vent or relief-valve opening during forced-cooldown, cold-shutdown, or maintenance states.",
      "derivedInitiatorIds": [
        "IE-43"
      ],
      "parentId": "MLD-RB",
      "challengedSafetyFunctionId": "SF-RB"
    },
    {
      "id": "MLD-RB-6",
      "description": "Direct fuel-coating / source barrier challenge during handling: mis-positioning of the fuel-handling / refuelling line-up causing a fuel-handling event that breaches the TRISO coating and disturbs core geometry (POS-06). Couples to heat removal via MLD-HR-9 but the primary challenge here is the coating barrier.",
      "derivedInitiatorIds": [
        "IE-44"
      ],
      "parentId": "MLD-RB",
      "challengedSafetyFunctionId": "SF-RB"
    }
  ],
  "identifiedInitiatorIds": [
    "IE-01",
    "IE-02",
    "IE-03",
    "IE-04",
    "IE-05",
    "IE-06",
    "IE-07",
    "IE-08",
    "IE-09",
    "IE-10",
    "IE-11",
    "IE-12",
    "IE-13",
    "IE-14",
    "IE-15",
    "IE-16",
    "IE-17",
    "IE-18",
    "IE-19",
    "IE-20",
    "IE-21",
    "IE-22",
    "IE-23",
    "IE-24",
    "IE-25",
    "IE-26",
    "IE-27",
    "IE-28",
    "IE-29",
    "IE-30",
    "IE-31",
    "IE-32",
    "IE-33",
    "IE-34",
    "IE-35",
    "IE-36",
    "IE-37",
    "IE-38",
    "IE-39",
    "IE-40",
    "IE-41",
    "IE-42",
    "IE-43",
    "IE-44",
    "IE-45",
    "IE-46",
    "IE-47"
  ]
};

const HBFT_MODELS: HeatBalanceFaultTree[] = [
  {
    "uuid": "HBFT-1",
    "name": "HBFT-1: Loss of forced core heat removal at power (heat-removal sink failure)",
    "methodKind": "HEAT_BALANCE_FAULT_TREE",
    "analyst": "Aakash Patel",
    "supportingDocuments": [
      "Identifying and quantifying a complete set of full-power HTGR initiating events (Reliab. Eng. Syst. Saf., 2023)"
    ],
    "plantOperatingStateIds": [
      "POS-01",
      "POS-02",
      "POS-03",
      "POS-07"
    ],
    "systemIds": [],
    "interfaces": [
      {
        "id": "HBFT1-IF1",
        "name": "Primary helium forced-convection heat transport (core-to-coolant)",
        "parameters": [
          "Main circulator helium mass flow",
          "Core inlet helium temperature",
          "Core outlet helium temperature",
          "Core helium temperature rise (outlet minus inlet)",
          "Primary helium pressure",
          "Heat transported to steam generator",
          "normal range: Mass flow ~157.1 kg/s; inlet ~259 C, outlet ~687 C, dT ~428 C; primary pressure ~6.4 MPa; heat transport ~350 MWt at full power (heat balance closes: helium cp 5193 J/kg-K x 157.1 kg/s x 428 C ~ 349 MWt). Decay-heat hot-standby/post-trip duty ~6-7% of 350 MWt (~21-24 MWt) immediately after scram, decaying to ~1.5% (~5 MWt) at one hour."
        ],
        "normalRanges": []
      },
      {
        "id": "HBFT1-IF2",
        "name": "Heat-generation-to-removal balance (forced-cooling path)",
        "parameters": [
          "Core thermal power (fission plus decay)",
          "Forced-convection heat removal rate",
          "Net stored-energy rate in core graphite and fuel",
          "Peak fuel temperature",
          "normal range: At power generation ~= removal ~350 MWt with near-zero net storage; peak fuel temperature held well below the ~1600 C TRISO design limit by the large graphite heat capacity and low power density. Post-trip the only generation is decay heat (~21-24 MWt falling), removed by the active path until passive cooling takes over."
        ],
        "normalRanges": []
      }
    ],
    "imbalances": [
      {
        "id": "HBFT1-IM1",
        "description": "Forced-convection heat removal falls below core thermal power (pressurized loss of forced cooling, P-LOFC): the main circulator stops or helium flow collapses while the primary boundary stays intact, so generated heat exceeds removed heat and core stored energy rises. (threshold: Helium forced flow drops below the level needed to carry the instantaneous core power (effectively to near zero on a circulator trip), driving net positive stored-energy rate; transient is slow because of the large heat capacity but peak fuel temperature is approached over hours to days if no heat-removal path is restored.)",
        "threshold": 0,
        "consequences": [
          "Core and reactor-vessel heatup driven by stored plus decay heat",
          "Negative temperature coefficient reduces fission power so the core trends toward decay-heat-only generation",
          "Demand on passive conduction/radiation to the vessel and RCCS to remove decay heat",
          "Peak fuel temperature approaches the ~1600 C TRISO limit only if all backup and passive removal also fail (challenge to maintain core and vessel geometry)"
        ]
      },
      {
        "id": "HBFT1-IM2",
        "description": "Total loss of the main heat-transport loop: circulator running but the steam-generator heat sink is lost, or the whole main loop is unavailable, so the helium has no place to reject heat even if it still circulates. (threshold: Steam-generator heat duty falls toward zero (no feedwater or no steam path) while core power persists; primary helium temperature rises and the loop can no longer balance ~350 MWt (or the post-trip decay load), forcing a trip and transfer to backup/passive cooling.)",
        "threshold": 0,
        "consequences": [
          "Rising core outlet and vessel temperatures",
          "Reactor trip on high temperature or loss of heat sink",
          "Transfer of decay-heat removal to SCS and ultimately the passive RCCS / conduction cooldown path"
        ]
      }
    ],
    "causes": [
      {
        "id": "HBFT1-CA1",
        "description": "Main helium circulator trip (mechanical seizure, drive/motor fault, bearing or seal failure, control fault)"
      },
      {
        "id": "HBFT1-CA2",
        "description": "Loss of circulator motive power (loss of offsite power or loss of the AC/DC supply to the circulator)"
      },
      {
        "id": "HBFT1-CA3",
        "description": "Loss of primary heat sink: loss of steam-generator heat removal (steam-side isolation, condenser unavailable)"
      },
      {
        "id": "HBFT1-CA4",
        "description": "Loss of feedwater to the steam generator (feed pump trip, feed-line isolation, control failure)"
      },
      {
        "id": "HBFT1-CA5",
        "description": "Turbine trip / loss of power-conversion system removing the steam-side sink"
      },
      {
        "id": "HBFT1-CA6",
        "description": "Operator inadvertent trip or isolation of the operating heat-transport / forced-cooling train"
      },
      {
        "id": "HBFT1-CA7",
        "description": "Simultaneous unavailability of the main circulator and steam-generator loop (loss of main loop heat transport with reactor still at power)"
      }
    ],
    "identifiedInitiatorIds": [
      "IE-01",
      "IE-02",
      "IE-03",
      "IE-14"
    ]
  },
  {
    "uuid": "HBFT-2",
    "name": "HBFT-2: Core overpower / heat-generation excess (reactivity-driven heat-balance upset)",
    "methodKind": "HEAT_BALANCE_FAULT_TREE",
    "analyst": "Aakash Patel",
    "supportingDocuments": [
      "Identifying and quantifying a complete set of full-power HTGR initiating events (Reliab. Eng. Syst. Saf., 2023)"
    ],
    "plantOperatingStateIds": [
      "POS-01",
      "POS-02",
      "POS-03"
    ],
    "systemIds": [],
    "interfaces": [
      {
        "id": "HBFT2-IF1",
        "name": "Core reactivity-to-power balance",
        "parameters": [
          "Net core reactivity",
          "Core thermal power (fission)",
          "Fuel and moderator temperature (feedback)",
          "Control-rod / reserve-shutdown position",
          "Core helium temperature rise",
          "normal range: Critical at ~350 MWt with net reactivity ~0; strong negative fuel-temperature (Doppler) and moderator coefficients self-limit power excursions. Power matched to the ~350 MWt forced-cooling removal so the heat balance is steady at full power."
        ],
        "normalRanges": []
      },
      {
        "id": "HBFT2-IF2",
        "name": "Generation-side of the heat balance (power vs removal capacity)",
        "parameters": [
          "Core thermal power",
          "Installed forced-convection removal capacity",
          "Peak fuel temperature margin to ~1600 C",
          "Core outlet helium temperature margin",
          "normal range: Generation held at or below the ~350 MWt design removal capacity; core outlet ~687 C with substantial margin to the ~1600 C peak-fuel limit. An overpower is any sustained generation above the matched removal that erodes that margin."
        ],
        "normalRanges": []
      }
    ],
    "imbalances": [
      {
        "id": "HBFT2-IM1",
        "description": "Heat generation rises above the matched heat-removal rate from an unplanned positive reactivity insertion (transient overpower): rod or rod-bank withdrawal, inadvertent rod action, or a slower reactivity drift. (threshold: Positive reactivity insertion raises fission power above the ~350 MWt removal capacity; the rise is bounded by the negative temperature coefficient but fuel temperature climbs and outlet helium temperature exceeds the normal ~687 C band until trip or self-limitation.)",
        "threshold": 0,
        "consequences": [
          "Rising fuel and core-outlet temperatures, eroding margin to the ~1600 C limit",
          "Reactor trip on high power / high temperature / high flux rate",
          "Self-limitation by negative temperature feedback if scram is delayed",
          "Localized fuel-temperature peaking challenging TRISO integrity in a severe insertion"
        ]
      },
      {
        "id": "HBFT2-IM2",
        "description": "Overcooling-driven reactivity excursion: a sudden increase in primary heat-removal rate cools the core, and through the negative moderator/temperature coefficient adds positive reactivity, raising fission power (heat-removal change feeds back onto heat generation). (threshold: Step increase in helium cooling (overcooling) drops moderator temperature enough that feedback adds positive reactivity, pushing power above the matched level until a new balance or trip; magnitude bounded by the temperature-coefficient gain.)",
        "threshold": 0,
        "consequences": [
          "Power rise mismatched to the suddenly higher removal, then re-stabilization",
          "Possible reactor trip on high flux or flux rate",
          "Thermal cycling of fuel and structures"
        ]
      },
      {
        "id": "HBFT2-IM3",
        "description": "Xenon-oscillation-induced power/spatial transient: redistribution of xenon causes a slow spatial power and reactivity swing that locally unbalances generation against the fixed cooling distribution. (threshold: Spatial power peaking factor rises on the oscillation so local heat generation exceeds local removal even at nominal total power; bounded by operator/automatic control but can drive local outlet temperatures outside the normal band.)",
        "threshold": 0,
        "consequences": [
          "Local fuel-temperature peaking and reduced thermal margin",
          "Need for operator/automatic reactivity control to damp the oscillation",
          "Possible trip on high local flux or temperature if uncontrolled"
        ]
      }
    ],
    "causes": [
      {
        "id": "HBFT2-CA1",
        "description": "Control rod or rod-bank withdrawal (uncontrolled or erroneous) inserting positive reactivity"
      },
      {
        "id": "HBFT2-CA2",
        "description": "Control rod drop / inadvertent rod action redistributing reactivity"
      },
      {
        "id": "HBFT2-CA3",
        "description": "Xenon spatial oscillation following a power maneuver"
      },
      {
        "id": "HBFT2-CA4",
        "description": "Sudden increase in primary heat-removal rate (overcooling) feeding positive reactivity through the negative temperature coefficient"
      },
      {
        "id": "HBFT2-CA5",
        "description": "Operator erroneous rod withdrawal or operator-induced overcooling maneuver"
      }
    ],
    "identifiedInitiatorIds": [
      "IE-08",
      "IE-09",
      "IE-10",
      "IE-11",
      "IE-41",
      "IE-45"
    ]
  },
  {
    "uuid": "HBFT-3",
    "name": "HBFT-3: Water/steam ingress thermal-reactivity upset (steam-generator boundary breach into the helium loop)",
    "methodKind": "HEAT_BALANCE_FAULT_TREE",
    "analyst": "Aakash Patel",
    "supportingDocuments": [
      "Identifying and quantifying a complete set of full-power HTGR initiating events (Reliab. Eng. Syst. Saf., 2023)"
    ],
    "plantOperatingStateIds": [
      "POS-01",
      "POS-02",
      "POS-03"
    ],
    "systemIds": [],
    "interfaces": [
      {
        "id": "HBFT3-IF1",
        "name": "Steam-generator helium-to-water heat-exchange boundary",
        "parameters": [
          "Steam-generator tube integrity (helium-side to water/steam-side)",
          "Secondary-to-primary differential pressure (water/steam ~higher than 6.4 MPa helium)",
          "Moisture (water/steam) concentration in primary helium",
          "Primary helium pressure",
          "Core moderation / reactivity from ingressed moisture",
          "normal range: Tubes leaktight; secondary-side feedwater/steam pressure above the ~6.4 MPa primary so any tube failure drives water/steam into the helium; primary moisture essentially nil (held by helium purification); reactivity contribution of moisture ~0."
        ],
        "normalRanges": []
      },
      {
        "id": "HBFT3-IF2",
        "name": "Coupled heat-generation and chemical-attack balance under moisture ingress",
        "parameters": [
          "Positive reactivity from added moderation",
          "Core thermal power",
          "Graphite/fuel oxidation (steam-graphite reaction) rate",
          "Combustible gas (CO, H2) generation",
          "Primary pressure rise toward relief setpoint",
          "normal range: No moisture present, so no moisture-driven reactivity, no graphite oxidation, no CO/H2 generation, and primary pressure steady at ~6.4 MPa. Any ingress shifts both the reactivity (generation) and the chemical/pressure balance off normal."
        ],
        "normalRanges": []
      }
    ],
    "imbalances": [
      {
        "id": "HBFT3-IM1",
        "description": "Moisture ingress adds positive reactivity in the under-moderated core, raising fission power above the matched removal (moisture-induced reactivity transient), while steam-graphite oxidation removes the carbon barrier and generates heat and combustible gas. (threshold: Water/steam mass into the primary above the amount that the negative temperature feedback and purification can absorb; reactivity insertion raises power until feedback/trip limits it, and the steam-graphite reaction proceeds where graphite is hot, generating CO/H2 and adding chemical heat.)",
        "threshold": 0,
        "consequences": [
          "Power rise from added moderation, bounded by negative temperature feedback",
          "Graphite and fuel oxidation (chemical attack on the carbon barrier)",
          "CO and H2 generation raising primary pressure toward the relief setpoint",
          "Reactor trip and demand to isolate/dump the water source"
        ]
      },
      {
        "id": "HBFT3-IM2",
        "description": "Large or multiple steam-generator tube rupture lifts the primary relief valve (BDBE wet depressurization): rapid water/steam ingress overpressurizes the helium boundary and forces a relief discharge, combining a reactivity transient, chemical attack, and partial depressurization. (threshold: Ingress rate and resulting CO/H2 generation raise primary pressure above the safety/relief-valve setpoint (above ~6.4 MPa toward the relief lift pressure); relief lift vents helium plus reaction products and begins depressurizing the loop.)",
        "threshold": 0,
        "consequences": [
          "Relief-valve lift and helium/steam/combustible-gas discharge to confinement",
          "Combined reactivity, oxidation, and depressurization challenge",
          "Loss of primary inventory degrading forced-cooling effectiveness",
          "Demand for steam/water dump and reactor trip"
        ]
      }
    ],
    "causes": [
      {
        "id": "HBFT3-CA1",
        "description": "Single steam-generator tube leak or rupture (helium-to-water boundary failure)"
      },
      {
        "id": "HBFT3-CA2",
        "description": "Steam-generator-tube-rupture water/steam ingress producing the moisture-induced reactivity transient"
      },
      {
        "id": "HBFT3-CA3",
        "description": "Moderate steam-generator tube rupture (intermediate water ingress)"
      },
      {
        "id": "HBFT3-CA4",
        "description": "Large or multiple steam-generator tube rupture with relief-valve lift"
      },
      {
        "id": "HBFT3-CA5",
        "description": "Operator-induced secondary-side mis-line-up driving water/steam into the primary"
      }
    ],
    "identifiedInitiatorIds": [
      "IE-13",
      "IE-19",
      "IE-21",
      "IE-22",
      "IE-47"
    ]
  },
  {
    "uuid": "HBFT-4",
    "name": "HBFT-4: Depressurized degradation of forced cooling (intermediate primary boundary break, heat-removal effectiveness loss)",
    "methodKind": "HEAT_BALANCE_FAULT_TREE",
    "analyst": "Aakash Patel",
    "supportingDocuments": [
      "Identifying and quantifying a complete set of full-power HTGR initiating events (Reliab. Eng. Syst. Saf., 2023)"
    ],
    "plantOperatingStateIds": [
      "POS-01",
      "POS-02",
      "POS-03"
    ],
    "systemIds": [],
    "interfaces": [
      {
        "id": "HBFT4-IF1",
        "name": "Primary helium inventory and pressure for convective heat removal",
        "parameters": [
          "Primary helium pressure",
          "Helium inventory / density",
          "Forced-convection heat-transfer coefficient (density-dependent)",
          "Core outlet helium temperature",
          "Break / leak area on the helium boundary",
          "normal range: Primary pressure ~6.4 MPa with full helium inventory giving the design convective heat-transfer that carries ~350 MWt; no boundary break. Convective removal capability scales with helium density, so it degrades as pressure falls."
        ],
        "normalRanges": []
      },
      {
        "id": "HBFT4-IF2",
        "name": "Heat-balance margin during depressurization",
        "parameters": [
          "Core thermal power (decaying after trip)",
          "Degraded forced-convection removal at reduced pressure",
          "Passive conduction/radiation removal to vessel and RCCS",
          "Peak fuel temperature",
          "normal range: At full pressure removal far exceeds the post-trip decay load; as pressure drops the convective term weakens and a larger share must shift to passive conduction/radiation and the RCCS (RCCS peak removal ~1.5 MW, ~0.4% of full power, after ~120 h)."
        ],
        "normalRanges": []
      }
    ],
    "imbalances": [
      {
        "id": "HBFT4-IM1",
        "description": "Intermediate primary boundary break lowers helium pressure and density, degrading forced-convection heat removal so that even with the circulator running the convective removal falls below what is needed, shifting load onto the slower passive path (partial depressurized loss of forced cooling). (threshold: Helium pressure falls from ~6.4 MPa toward the break-equilibrium pressure over the depressurization time for a moderate break; convective heat-transfer degrades roughly with density so removal drops below the instantaneous core power and net core storage turns positive.)",
        "threshold": 0,
        "consequences": [
          "Reduced convective heat removal and rising core/vessel temperatures",
          "Reactor trip on low pressure / high temperature",
          "Increasing reliance on passive conduction, radiation, and the RCCS",
          "Air-ingress (chemical-attack) potential through the breach if depressurization completes",
          "Loss of helium inventory challenging the pressure boundary and radionuclide retention"
        ]
      }
    ],
    "causes": [
      {
        "id": "HBFT4-CA1",
        "description": "Moderate primary boundary break (intermediate-size helium leak) reducing pressure and convective heat removal"
      },
      {
        "id": "HBFT4-CA2",
        "description": "Loss of forced flow coincident with reduced inventory (degraded circulator effectiveness at low density)"
      }
    ],
    "identifiedInitiatorIds": [
      "IE-16"
    ]
  }
];

const FMEA_MODEL: FailureModesEffectAnalysis = {
  "uuid": "FMEA-HTGR-1",
  "name": "Generic HTGR initiating-event FMEA",
  "methodKind": "FMEA",
  "analyst": "Aakash Patel",
  "supportingDocuments": [
    "IEC 60812 (FMEA)",
    "ASME/ANS RA-S-1.4 IE-A9, IE-A15"
  ],
  "systems": [
    {
      "id": "SYS-HTS",
      "name": "Heat Transport System (main helium circulator and primary loop)",
      "function": "Drive forced helium circulation through the core and steam generator for normal core heat removal and power production. The main circulator (motor-driven, magnetic or water-cooled bearings) is the prime mover; its trip is the pressurized loss of forced cooling.",
      "boundaries": []
    },
    {
      "id": "SYS-SG",
      "name": "Steam generator and feedwater system",
      "function": "Transfer core heat from the primary helium to the secondary steam (Rankine) loop and act as the primary heat sink. The feedwater system supplies the steam generator; loss of feedwater or steam generator heat removal is a loss-of-heat-sink transient.",
      "boundaries": []
    },
    {
      "id": "SYS-PCS",
      "name": "Power conversion system (turbine-generator and condenser)",
      "function": "Convert steam energy to electric power and reject heat to the condenser. A turbine trip or main-condenser isolation removes the normal heat sink and challenges heat removal.",
      "boundaries": []
    },
    {
      "id": "SYS-SCS",
      "name": "Shutdown Cooling System (active backup forced cooling)",
      "function": "Provide backup forced decay-heat removal during cooldown, refuelling and maintenance using a motor-driven shutdown-cooling circulator and an in-vessel helium-to-water shutdown-cooling heat exchanger. Loss of SCS is a shutdown-mode loss of forced cooling; its heat-exchanger tube failure admits water to the primary.",
      "boundaries": []
    },
    {
      "id": "SYS-RCCS",
      "name": "Reactor Cavity Cooling System (passive)",
      "function": "Remove decay heat from the reactor vessel by natural circulation in panels around the vessel when forced cooling is lost. It is the ultimate passive heat sink during loss of forced cooling and the conduction/radiation cooldown path during depressurized loss of forced cooling.",
      "boundaries": []
    },
    {
      "id": "SYS-RCS",
      "name": "Reactivity control system (control rods and reserve shutdown control equipment)",
      "function": "Control core reactivity in normal operation and shut the reactor down on demand using control rods, with reserve shutdown control equipment as the diverse backup. Inadvertent rod motion or insertion error is a reactivity initiator; failure to scram aggravates other transients.",
      "boundaries": []
    },
    {
      "id": "SYS-HPS",
      "name": "Helium purification system",
      "function": "Maintain primary coolant chemistry by removing moisture, oxidants and chemical impurities through the copper-oxide bed, molecular-sieve adsorber and low-temperature adsorber. It is a connected primary-pressure-boundary loop, so its faults both lose chemistry control and offer a small depressurization and radionuclide-release path.",
      "boundaries": []
    },
    {
      "id": "SYS-HICS",
      "name": "Helium inventory and pressure-control system (makeup and relief)",
      "function": "Maintain primary helium pressure and quantity through the inventory-control, makeup and relief subsystems. A breach outside the primary boundary loses inventory/pressure control and provides a leak path for primary helium and radionuclides.",
      "boundaries": []
    },
    {
      "id": "SYS-ACP",
      "name": "Normal AC distribution and offsite power",
      "function": "Supply non-Class-1E AC to the circulators, feedwater, power-conversion auxiliaries and balance-of-plant. Loss of offsite power or normal AC trips the forced-cooling prime movers and is a plant-wide transient.",
      "boundaries": []
    },
    {
      "id": "SYS-DCP",
      "name": "Class 1E 125 V DC power",
      "function": "Supply control power to protection logic, switchgear control, vital inverters and emergency actuation. Loss of DC disables control and protection functions and degrades the ability to actuate safety systems.",
      "boundaries": []
    },
    {
      "id": "SYS-UPS",
      "name": "Class 1E uninterruptible / vital instrument power",
      "function": "Supply conditioned, uninterrupted AC to the reactor protection system, plant control and vital instrumentation. Loss of vital instrument power blinds and disables I&C, prompting a protective trip and degrading monitoring.",
      "boundaries": []
    },
    {
      "id": "SYS-IA",
      "name": "Instrument and service air",
      "function": "Supply compressed air to pneumatic valves and actuators. On loss of air, air-operated valves drift to their fail-safe positions; this can trip the plant and disturb feedwater, isolation and inventory-control line-ups.",
      "boundaries": []
    },
    {
      "id": "SYS-CCW",
      "name": "Reactor plant (component) cooling water",
      "function": "Remove heat from plant components including the circulator motors, bearings and coolers, the SCS, and electrical/I&C loads, and reject it through the service-water/ultimate heat sink. Loss of component cooling forces equipment trips and challenges heat removal.",
      "boundaries": []
    },
    {
      "id": "SYS-SW",
      "name": "Service water / ultimate heat sink",
      "function": "Provide the final heat sink for the component cooling water and the forced-cooling systems. Loss of the service-water/ultimate heat sink defeats the forced heat-removal chains.",
      "boundaries": []
    },
    {
      "id": "SYS-HVAC",
      "name": "Essential HVAC / ventilation",
      "function": "Maintain habitable and equipment-qualified temperatures in the electrical, switchgear and I&C rooms and the control room. Loss of essential ventilation overheats electronics, degrading and tripping control and protection equipment.",
      "boundaries": []
    },
    {
      "id": "SYS-FHS",
      "name": "Fuel-handling and spent-fuel storage system",
      "function": "Move prismatic fuel blocks in and out of the open vessel during refuelling and cool stored/spent fuel. Handling faults and loss of stored-fuel cooling are refuelling-mode source-handling initiators.",
      "boundaries": []
    }
  ],
  "componentIds": [
    "Main helium circulator drive motor / power supply",
    "Main circulator bearings / shaft seal (magnetic-bearing or water-cooled bearing service)",
    "Primary helium pressure boundary (vessel penetrations, ducting, circulator housing, connecting pipework)",
    "Primary pressure-relief / safety valve",
    "Steam generator tube / tube bundle (helium-to-water boundary)",
    "Steam generator heat-removal path / secondary heat sink",
    "Feedwater system (feed pumps, control valves, feedwater train)",
    "Turbine-generator / main condenser",
    "Shutdown-cooling circulator and drive (active backup forced cooling)",
    "Shutdown-cooling helium-to-water heat exchanger (in-vessel)",
    "RCCS natural-circulation flow path (panels, risers, ductwork around the vessel)",
    "Control rod / rod-group drive",
    "Control rod assembly / latch",
    "Reactivity control under xenon spatial transient",
    "Refuelling reactivity configuration (fuel block placement, startup line-up)",
    "Helium purification trains (copper-oxide bed, molecular sieve, low-temperature adsorber)",
    "Helium purification connecting line / pressure boundary",
    "Helium inventory-control / makeup / relief subsystem and its piping",
    "Offsite power feed and non-Class-1E AC distribution buses",
    "Class 1E 125 V DC system (battery, charger, distribution)",
    "Class 1E uninterruptible power supply / vital instrument inverter",
    "Instrument and service air (compressors, dryers, header)",
    "Reactor plant (component) cooling water pumps, heat exchangers and loop",
    "Service water / ultimate heat sink (pumps, intake, heat exchangers)",
    "Essential HVAC / ventilation to electrical, switchgear and I&C spaces",
    "Fuel-handling machine / refuelling line-up (in-vessel and ex-vessel)",
    "Spent / stored fuel cooling (ex-core storage source)",
    "Operator interface to reactivity control (rod control during operation/startup)",
    "Operator interface to primary boundary / forced-cooling trains",
    "Operator interface to secondary side / steam generator line-up"
  ],
  "failureModes": [
    {
      "id": "FM-1",
      "componentId": "Main helium circulator drive motor / power supply",
      "mode": "Spurious motor trip or loss of drive power (circulator stops while reactor pressurized)",
      "causes": [
        "Motor electrical fault or protection-relay trip",
        "Loss of the circulator AC supply or upstream bus",
        "Variable-speed drive / inverter fault",
        "Operator or interlock spurious trip signal"
      ],
      "localEffects": [
        "Forced helium flow through the core and steam generator stops",
        "Circulator coastdown then natural-convection-only flow inside the pressurized primary"
      ],
      "systemEffects": [
        "Pressurized loss of forced cooling: normal core heat removal lost with the primary still at pressure",
        "Reactor trips; decay heat must shift to the SCS or, if unavailable, the passive RCCS",
        "Core heatup transient bounded by passive conduction/radiation to the RCCS"
      ],
      "detection": [
        "Circulator speed/current and trip alarm",
        "Core outlet helium temperature rise",
        "Primary flow-low and reactor-trip annunciation"
      ],
      "safeguards": [
        "Reactor protection system scram on loss of forced flow",
        "SCS auto-start as the backup forced path",
        "Passive RCCS removes decay heat with no power required",
        "Large thermal margin of the prismatic core and low power density"
      ],
      "severity": 7,
      "derivedInitiatorIds": [
        "IE-01",
        "IE-14"
      ]
    },
    {
      "id": "FM-2",
      "componentId": "Main circulator bearings / shaft seal (magnetic-bearing or water-cooled bearing service)",
      "mode": "Bearing or seal failure causing circulator seizure or coastdown",
      "causes": [
        "Active magnetic bearing controller or power loss",
        "Bearing cooling-water loss on water-cooled bearing designs",
        "Mechanical wear, imbalance or seal degradation",
        "Loss of bearing/seal cooling from the component cooling water system"
      ],
      "localEffects": [
        "Loss of rotor support and circulator runs down or seizes",
        "On water-lubricated/water-cooled bearing designs, bearing-water can leak across the seal into the primary helium"
      ],
      "systemEffects": [
        "Pressurized loss of forced cooling from the main loop",
        "On a seal-water in-leak path, moisture ingress to the primary causing graphite/fuel chemical attack and possible positive reactivity"
      ],
      "detection": [
        "Bearing temperature and vibration monitoring",
        "Magnetic-bearing controller fault alarm",
        "Primary helium moisture monitor rise on a water in-leak"
      ],
      "safeguards": [
        "Reactor scram and SCS backup on circulator loss",
        "Helium moisture monitoring with circulator/feed isolation",
        "Helium purification removes ingressed moisture",
        "Bearing-water inventory limited and isolable"
      ],
      "severity": 7,
      "derivedInitiatorIds": [
        "IE-01",
        "IE-14",
        "IE-23"
      ]
    },
    {
      "id": "FM-3",
      "componentId": "Primary helium pressure boundary (vessel penetrations, ducting, circulator housing, connecting pipework)",
      "mode": "Boundary leak or break (small, moderate, or large) causing primary depressurization",
      "causes": [
        "Penetration, weld or flange failure",
        "Connecting-line or small-bore instrument/purification tap break",
        "Gross duct or housing failure (large break)",
        "Material degradation, fatigue or erosion"
      ],
      "localEffects": [
        "Helium discharges from the primary into the containment/confinement",
        "Primary pressure falls at a rate set by the break size"
      ],
      "systemEffects": [
        "Loss of helium inventory and radionuclide-retention pressure boundary",
        "Small break: slow depressurization with forced cooling still available",
        "Large break: rapid depressurization and depressurized loss of forced cooling (D-LOFC) with reduced natural convection and risk of air ingress and graphite oxidation"
      ],
      "detection": [
        "Primary pressure-low and rate-of-change alarms",
        "Containment activity and pressure monitors",
        "Helium makeup demand increase"
      ],
      "safeguards": [
        "Reactor scram on low primary pressure",
        "Passive RCCS and core conduction/radiation cooldown for D-LOFC",
        "Confinement/containment retains released activity",
        "Air-ingress limited by confinement design and low driving head"
      ],
      "severity": 9,
      "derivedInitiatorIds": [
        "IE-15",
        "IE-16",
        "IE-17",
        "IE-37"
      ]
    },
    {
      "id": "FM-4",
      "componentId": "Primary pressure-relief / safety valve",
      "mode": "Relief or safety valve fails open or lifts spuriously (stuck-open primary relief path)",
      "causes": [
        "Valve mechanical sticking or spring/seat failure",
        "Spurious actuation signal or setpoint drift",
        "Failure to reseat after a legitimate lift"
      ],
      "localEffects": [
        "Open relief path vents primary helium continuously",
        "Uncontrolled depressurization through the relief line"
      ],
      "systemEffects": [
        "Loss of primary inventory and pressure-boundary function",
        "Slow-to-moderate depressurization transient and release of circulating activity through the relief path",
        "Challenge to heat removal as pressure and natural convection degrade"
      ],
      "detection": [
        "Valve position indication and relief-line temperature/flow",
        "Primary pressure-low trend",
        "Confinement activity monitor"
      ],
      "safeguards": [
        "Isolation valve in series with the relief path where provided",
        "Reactor scram on low pressure",
        "Confinement retains released activity",
        "Helium makeup offsets slow loss"
      ],
      "severity": 7,
      "derivedInitiatorIds": [
        "IE-18"
      ]
    },
    {
      "id": "FM-5",
      "componentId": "Steam generator tube / tube bundle (helium-to-water boundary)",
      "mode": "Tube leak or rupture admitting water/steam into the primary helium (water ingress, wet depressurization)",
      "causes": [
        "Tube fatigue, corrosion, fretting or weld failure",
        "Flow-induced vibration and erosion",
        "Overpressure or thermal-shock tube failure"
      ],
      "localEffects": [
        "Secondary water/steam enters the primary at higher secondary pressure",
        "Helium pressure can rise and lift the relief valve (wet depressurization)"
      ],
      "systemEffects": [
        "Moisture ingress to the core: positive reactivity from increased neutron moderation and a power excursion",
        "Graphite and fuel chemical attack (hydrolysis/oxidation) and combustible-gas generation",
        "Loss of the helium pressure boundary at the heat-exchanger interface and a radionuclide-release path; loss of steam-generator heat removal"
      ],
      "detection": [
        "Primary helium moisture monitor (key HTGR detector)",
        "Primary pressure rise and steam-generator level/flow mismatch",
        "Confinement activity and hydrogen monitors"
      ],
      "safeguards": [
        "Moisture-high trip with reactor scram, steam-generator isolation and feedwater trip",
        "Steam-generator dump/blowdown to limit ingress mass",
        "Helium purification removes moisture",
        "Reserve shutdown control equipment for reactivity backup"
      ],
      "severity": 8,
      "derivedInitiatorIds": [
        "IE-13",
        "IE-19",
        "IE-20",
        "IE-21",
        "IE-22",
        "IE-47"
      ]
    },
    {
      "id": "FM-6",
      "componentId": "Steam generator heat-removal path / secondary heat sink",
      "mode": "Loss of steam generator heat removal (loss of primary heat sink)",
      "causes": [
        "Steam-generator isolation or tube-side blockage",
        "Secondary-side line-up fault or loss of steam path",
        "Loss of condenser vacuum reflected back to the steam generator"
      ],
      "localEffects": [
        "Helium gives up little heat in the steam generator",
        "Core inlet helium temperature rises"
      ],
      "systemEffects": [
        "Loss-of-heat-sink transient; heat-generation/removal balance upset",
        "Reactor trips and decay heat transfers to the SCS or passive RCCS"
      ],
      "detection": [
        "Steam-generator outlet temperature and steam-flow indication",
        "Core inlet/outlet temperature rise",
        "Heat-balance mismatch alarm"
      ],
      "safeguards": [
        "Reactor scram on loss of heat sink",
        "SCS backup forced cooling",
        "Passive RCCS decay-heat removal"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-02"
      ]
    },
    {
      "id": "FM-7",
      "componentId": "Feedwater system (feed pumps, control valves, feedwater train)",
      "mode": "Loss of feedwater to the steam generator",
      "causes": [
        "Feed-pump trip or loss of feed-pump power",
        "Feedwater control-valve failure closed",
        "Feedwater line fault or suction loss",
        "Loss of instrument air to feedwater control valves"
      ],
      "localEffects": [
        "Feed flow to the steam generator stops or falls",
        "Steam-generator inventory and heat-sink capacity collapse"
      ],
      "systemEffects": [
        "Loss-of-heat-sink transient with reactor trip",
        "Decay heat transfers to the SCS or passive RCCS"
      ],
      "detection": [
        "Feed-flow-low and steam-generator level-low alarms",
        "Feed-pump trip annunciation"
      ],
      "safeguards": [
        "Reactor scram on loss of feedwater / low level",
        "SCS and passive RCCS backup heat removal",
        "Feedwater control valves fail to a defined position"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-03"
      ]
    },
    {
      "id": "FM-8",
      "componentId": "Turbine-generator / main condenser",
      "mode": "Turbine trip or loss of the power conversion system (condenser isolation, generator trip)",
      "causes": [
        "Turbine or generator protective trip",
        "Loss of condenser vacuum or condenser isolation",
        "Grid disturbance or load rejection",
        "Main-stop/control-valve closure"
      ],
      "localEffects": [
        "Steam path to the turbine/condenser is lost",
        "Secondary-side heat rejection collapses"
      ],
      "systemEffects": [
        "Power-conversion transient with loss of the normal heat sink and reactor trip",
        "Possible mild overcooling or pressure transient pending controlled response",
        "Decay heat transfers to the SCS or passive RCCS"
      ],
      "detection": [
        "Turbine/generator trip and condenser-vacuum-low alarms",
        "Steam-pressure and bypass-demand indication"
      ],
      "safeguards": [
        "Reactor scram on turbine trip",
        "Steam bypass/dump to the condenser where available",
        "SCS and passive RCCS backup heat removal"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-05",
        "IE-11"
      ]
    },
    {
      "id": "FM-9",
      "componentId": "Shutdown-cooling circulator and drive (active backup forced cooling)",
      "mode": "SCS circulator fails to run / SCS unavailable in shutdown states",
      "causes": [
        "SCS circulator motor or drive fault",
        "Loss of SCS power or control",
        "SCS train out of service for maintenance",
        "Failure to auto-start on demand"
      ],
      "localEffects": [
        "Backup forced helium circulation in the shutdown loop is lost",
        "No active decay-heat removal in cooldown/refuelling states"
      ],
      "systemEffects": [
        "Shutdown-mode loss of forced cooling; core relies on the passive RCCS",
        "Slow vessel and core heatup on the passive path"
      ],
      "detection": [
        "SCS circulator speed/current and trip alarm",
        "Core/vessel temperature rise in shutdown",
        "SCS availability status"
      ],
      "safeguards": [
        "Passive RCCS removes decay heat with no power",
        "Large passive grace time at shutdown decay-heat levels",
        "Restoration of the main loop or SCS train"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-04"
      ]
    },
    {
      "id": "FM-10",
      "componentId": "Shutdown-cooling helium-to-water heat exchanger (in-vessel)",
      "mode": "SCS heat-exchanger tube failure admitting water to the primary (non-steam-generator water ingress)",
      "causes": [
        "SCS heat-exchanger tube corrosion, fatigue or weld failure",
        "Thermal/pressure cycling during cooldown duty",
        "Water-side overpressure relative to the depressurized primary"
      ],
      "localEffects": [
        "SCS cooling water leaks into the primary helium through the failed tube",
        "Loss of the SCS heat-removal path"
      ],
      "systemEffects": [
        "Water ingress with moisture-driven graphite/fuel hydrolysis and oxidation",
        "Positive reactivity from added moderation in the undermoderated core",
        "Loss of the SCS backup forced-cooling path during a shutdown state"
      ],
      "detection": [
        "Primary helium moisture monitor",
        "SCS water-side level/inventory loss",
        "Confinement activity monitor"
      ],
      "safeguards": [
        "SCS isolation on moisture-high",
        "Helium purification removes ingressed moisture",
        "Reserve shutdown control equipment for reactivity",
        "Passive RCCS as the remaining heat-removal path"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-26"
      ]
    },
    {
      "id": "FM-11",
      "componentId": "RCCS natural-circulation flow path (panels, risers, ductwork around the vessel)",
      "mode": "Degraded or blocked passive natural-circulation path (reduced passive heat removal)",
      "causes": [
        "Air inlet/outlet or riser blockage or fouling",
        "Panel or duct deformation reducing flow area",
        "Degraded radiant/convective coupling to the vessel"
      ],
      "localEffects": [
        "Reduced natural-circulation heat removal from the reactor cavity",
        "Higher vessel and reactor-cavity temperatures"
      ],
      "systemEffects": [
        "Reduced margin during loss of forced cooling; does not by itself initiate but aggravates LOFC sequences",
        "Slower cooldown and higher peak fuel temperature during P-LOFC and D-LOFC"
      ],
      "detection": [
        "RCCS panel/cavity temperature instrumentation",
        "RCCS flow/temperature indication",
        "Periodic inlet/outlet inspection"
      ],
      "safeguards": [
        "Fully passive, redundant flow paths with no moving parts or power",
        "Large core thermal inertia and low power density",
        "Conduction/radiation cooldown keeps fuel below failure temperature"
      ],
      "severity": 4,
      "derivedInitiatorIds": [
        "IE-17"
      ]
    },
    {
      "id": "FM-12",
      "componentId": "Control rod / rod-group drive",
      "mode": "Inadvertent rod or rod-bank withdrawal (transient overpower / reactivity insertion)",
      "causes": [
        "Rod-drive controller or power fault",
        "Spurious withdrawal command",
        "Control-logic or interlock failure"
      ],
      "localEffects": [
        "Positive reactivity added as rods withdraw",
        "Core power and temperature rise"
      ],
      "systemEffects": [
        "Transient overpower / reactivity-insertion transient",
        "Power rise limited by strong negative temperature feedback; trip terminates the event"
      ],
      "detection": [
        "Rod-position indication and rod-withdrawal alarm",
        "Neutron flux / power-rate (high startup-rate) trip",
        "Core temperature rise"
      ],
      "safeguards": [
        "Reactor scram on high flux or short period",
        "Reserve shutdown control equipment as diverse shutdown",
        "Strong negative temperature/Doppler feedback",
        "Withdrawal-rate and interlock limits"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-08"
      ]
    },
    {
      "id": "FM-13",
      "componentId": "Control rod assembly / latch",
      "mode": "Control rod drop or inadvertent rod insertion (asymmetric reactivity action)",
      "causes": [
        "Latch or gripper release failure",
        "Drive-mechanism fault",
        "Loss of rod-holding power"
      ],
      "localEffects": [
        "Asymmetric negative reactivity and local flux tilt",
        "Sudden power and temperature redistribution"
      ],
      "systemEffects": [
        "Reactivity transient with power/temperature distribution change",
        "Possible spurious downstream trip"
      ],
      "detection": [
        "Rod-position indication and rod-drop alarm",
        "Flux-tilt / asymmetry detection"
      ],
      "safeguards": [
        "Reactor scram on flux asymmetry or trip",
        "Negative temperature feedback",
        "Reserve shutdown control equipment backup"
      ],
      "severity": 5,
      "derivedInitiatorIds": [
        "IE-09"
      ]
    },
    {
      "id": "FM-14",
      "componentId": "Reactivity control under xenon spatial transient",
      "mode": "Xenon-oscillation-induced reactivity transient (spatial power redistribution)",
      "causes": [
        "Xenon spatial oscillation following a power maneuver",
        "Inadequate rod-pattern control of the axial/radial xenon distribution"
      ],
      "localEffects": [
        "Slow spatial redistribution of core power",
        "Local power and temperature swings"
      ],
      "systemEffects": [
        "Reactivity/temperature transient challenging reactivity control",
        "Local fuel-temperature margin reduced if uncontrolled"
      ],
      "detection": [
        "In-core/ex-core flux distribution monitoring",
        "Axial/radial power-shape indication"
      ],
      "safeguards": [
        "Rod-pattern control and power-maneuver procedures",
        "Reactor scram on flux/temperature limits",
        "Negative temperature feedback damps the oscillation"
      ],
      "severity": 4,
      "derivedInitiatorIds": [
        "IE-10"
      ]
    },
    {
      "id": "FM-15",
      "componentId": "Refuelling reactivity configuration (fuel block placement, startup line-up)",
      "mode": "Fuel-loading / mispositioning or rod mis-positioning reactivity error",
      "causes": [
        "Fuel block placed in the wrong core position",
        "Reserve-shutdown or rod line-up error during startup",
        "Procedure or configuration-control error"
      ],
      "localEffects": [
        "Core reactivity differs from the intended loading",
        "Reduced shutdown margin or unexpected reactivity addition"
      ],
      "systemEffects": [
        "Reactivity error challenging heat-generation control during refuelling/startup",
        "Potential inadvertent criticality margin reduction"
      ],
      "detection": [
        "Source-range neutron monitoring during loading",
        "Loading-pattern verification and independent checks",
        "Shutdown-margin measurement at startup"
      ],
      "safeguards": [
        "Two-person/independent verification of loading and line-ups",
        "Source-range trip and administrative reactivity limits",
        "Reserve shutdown control equipment available"
      ],
      "severity": 5,
      "derivedInitiatorIds": [
        "IE-12",
        "IE-42"
      ]
    },
    {
      "id": "FM-16",
      "componentId": "Helium purification trains (copper-oxide bed, molecular sieve, low-temperature adsorber)",
      "mode": "Loss of helium purification function (loss of coolant chemistry control)",
      "causes": [
        "Purification train trip, bypass or saturation",
        "Adsorber/bed breakthrough or regeneration fault",
        "Loss of purification support utilities"
      ],
      "localEffects": [
        "Moisture and chemical impurities accumulate in the primary helium",
        "Coolant chemistry drifts out of specification"
      ],
      "systemEffects": [
        "Loss of chemical-attack control: graphite/fuel corrosion and plateout potential increase",
        "No immediate power transient; degrades a protective chemistry function"
      ],
      "detection": [
        "Primary helium moisture and impurity (oxygen/CO) monitors",
        "Purification-train performance and pressure-drop indication"
      ],
      "safeguards": [
        "Redundant/standby purification trains",
        "Chemistry technical-specification limits with action statements",
        "Reactor power reduction on adverse chemistry"
      ],
      "severity": 4,
      "derivedInitiatorIds": [
        "IE-35",
        "IE-40"
      ]
    },
    {
      "id": "FM-17",
      "componentId": "Helium purification connecting line / pressure boundary",
      "mode": "Purification line break or pressure-boundary leak outside the primary boundary",
      "causes": [
        "Small-bore purification-line break or weld failure",
        "Component pressure-boundary leak in the purification loop",
        "Isolation-valve failure on the purification tap"
      ],
      "localEffects": [
        "Primary helium escapes through the purification connection",
        "Local release of primary helium activity outside the boundary"
      ],
      "systemEffects": [
        "Small primary depressurization through the helium-purification connection",
        "Radionuclide release outside the primary boundary; loss of chemistry control"
      ],
      "detection": [
        "Primary pressure-low and makeup-demand trend",
        "Area/confinement activity monitors near the purification system",
        "Purification-loop pressure/flow anomaly"
      ],
      "safeguards": [
        "Automatic isolation of the purification connection on low pressure or high activity",
        "Confinement retains released activity",
        "Helium makeup offsets the slow loss"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-24",
        "IE-36"
      ]
    },
    {
      "id": "FM-18",
      "componentId": "Helium inventory-control / makeup / relief subsystem and its piping",
      "mode": "Inventory-control system breach outside the primary boundary, or loss of makeup/pressure control",
      "causes": [
        "Makeup/relief-line or storage-connection break or leak",
        "Inventory-control valve fails open to a vent/relief path",
        "Loss of makeup-compressor or control function"
      ],
      "localEffects": [
        "Primary helium escapes through the inventory-control connection, or makeup is lost",
        "Primary pressure drifts from the controlled band"
      ],
      "systemEffects": [
        "Loss of primary inventory/pressure control with a slow depressurization and radionuclide-release path",
        "Reduced ability to maintain coolant pressure and quality"
      ],
      "detection": [
        "Primary pressure and makeup-flow indication",
        "Inventory-control valve position and storage-pressure trend",
        "Confinement activity monitor"
      ],
      "safeguards": [
        "Isolation of the inventory-control connection on low pressure/high activity",
        "Redundant makeup capability",
        "Confinement retains released activity"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-25"
      ]
    },
    {
      "id": "FM-19",
      "componentId": "Offsite power feed and non-Class-1E AC distribution buses",
      "mode": "Loss of offsite power / loss of normal AC distribution",
      "causes": [
        "Switchyard, grid or transformer fault",
        "Main or unit-board breaker trip",
        "Normal AC distribution bus fault or load-centre loss"
      ],
      "localEffects": [
        "AC supply to circulators, feedwater and balance-of-plant auxiliaries is lost",
        "Forced-cooling prime movers and power-conversion auxiliaries trip"
      ],
      "systemEffects": [
        "Plant-wide transient: loss of forced cooling and heat sink with reactor trip",
        "Decay heat transfers to onsite-powered SCS or, on extended loss, the passive RCCS",
        "Concurrent challenge to multiple support and frontline systems"
      ],
      "detection": [
        "Bus undervoltage and breaker-trip alarms",
        "Loss-of-offsite-power annunciation",
        "Circulator/feedwater trip indications"
      ],
      "safeguards": [
        "Reactor scram on loss of forced cooling/power",
        "Onsite standby power to vital loads",
        "Passive RCCS needs no AC power",
        "Class 1E DC/UPS carry protection through the transient"
      ],
      "severity": 7,
      "derivedInitiatorIds": [
        "IE-06",
        "IE-27",
        "IE-28"
      ]
    },
    {
      "id": "FM-20",
      "componentId": "Class 1E 125 V DC system (battery, charger, distribution)",
      "mode": "Loss of Class 1E 125 V DC power",
      "causes": [
        "Battery failure or depletion",
        "Battery-charger failure with battery exhaustion",
        "DC distribution bus fault or breaker trip"
      ],
      "localEffects": [
        "Control power to protection logic, switchgear control and vital inverters is lost",
        "Affected breakers and actuators lose control power"
      ],
      "systemEffects": [
        "Loss of control/protection power degrading the ability to actuate and monitor safety systems",
        "Protective trip of the affected train; reactivity and radionuclide-control functions challenged"
      ],
      "detection": [
        "DC bus voltage-low and charger-fail alarms",
        "Ground-detection and battery-monitor indication"
      ],
      "safeguards": [
        "Redundant Class 1E DC divisions and batteries",
        "Sized battery duty cycle for the coping period",
        "Protection logic fails to a safe (trip) state",
        "Passive RCCS independent of DC"
      ],
      "severity": 7,
      "derivedInitiatorIds": [
        "IE-29"
      ]
    },
    {
      "id": "FM-21",
      "componentId": "Class 1E uninterruptible power supply / vital instrument inverter",
      "mode": "Loss of vital instrument (uninterruptible) power",
      "causes": [
        "Inverter failure or transfer fault",
        "Loss of the UPS feeder with depleted backup",
        "Vital instrument bus fault"
      ],
      "localEffects": [
        "Conditioned power to the reactor protection system and vital instrumentation is lost",
        "Affected I&C channels de-energize"
      ],
      "systemEffects": [
        "Loss of vital instrument power blinding/disabling I&C and prompting a protective trip",
        "Degraded monitoring of reactivity and radionuclide-control functions"
      ],
      "detection": [
        "Vital bus undervoltage and inverter-fail alarms",
        "Loss of affected instrument channels"
      ],
      "safeguards": [
        "Redundant divisional UPS and vital buses",
        "Fail-safe (de-energize-to-trip) protection design",
        "Battery-backed ride-through of supply transients"
      ],
      "severity": 7,
      "derivedInitiatorIds": [
        "IE-30"
      ]
    },
    {
      "id": "FM-22",
      "componentId": "Instrument and service air (compressors, dryers, header)",
      "mode": "Loss of instrument and service air",
      "causes": [
        "Air-compressor trip or loss of compressor power",
        "Dryer failure or moisture carryover",
        "Header rupture or major leak"
      ],
      "localEffects": [
        "Air-operated valves and actuators drift to their fail-safe positions",
        "Pneumatic control of feedwater, isolation and inventory line-ups is lost"
      ],
      "systemEffects": [
        "Plant transient as fail-safe valve repositioning disturbs feedwater and heat removal",
        "Reactor trip; challenge to heat-removal line-ups"
      ],
      "detection": [
        "Air-header pressure-low and compressor-trip alarms",
        "Affected valve-position changes",
        "Dryer dewpoint-high alarm"
      ],
      "safeguards": [
        "Air-operated valves fail to defined safe positions",
        "Air-receiver capacity for coping time",
        "Reactor scram on the resulting transient",
        "Backup/cross-tied air supply where provided"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-33"
      ]
    },
    {
      "id": "FM-23",
      "componentId": "Reactor plant (component) cooling water pumps, heat exchangers and loop",
      "mode": "Loss of component (reactor plant) cooling water",
      "causes": [
        "CCW pump trip or loss of pump power",
        "Loop leak, rupture or loss of inventory",
        "Heat-exchanger fouling or isolation fault"
      ],
      "localEffects": [
        "Cooling to circulator motors/bearings/coolers, SCS and electrical/I&C loads is lost",
        "Served components heat up and trip on high temperature"
      ],
      "systemEffects": [
        "Loss of cooling forces circulator and SCS trips, causing loss of forced cooling",
        "Chemical-attack control challenged where cooling supports chemistry equipment; reactor trip"
      ],
      "detection": [
        "CCW flow/temperature-low and pump-trip alarms",
        "Served-component high-temperature alarms",
        "Surge-tank level-low indication"
      ],
      "safeguards": [
        "Redundant CCW pumps and trains",
        "Reactor scram and SCS/RCCS backup on the resulting LOFC",
        "Passive RCCS needs no component cooling"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-31"
      ]
    },
    {
      "id": "FM-24",
      "componentId": "Service water / ultimate heat sink (pumps, intake, heat exchangers)",
      "mode": "Loss of service water / ultimate heat sink to forced-cooling systems",
      "causes": [
        "Service-water pump trip or loss of power",
        "Intake blockage, fouling or loss of source",
        "Header leak or rupture"
      ],
      "localEffects": [
        "Final heat rejection from component cooling and forced-cooling chains is lost",
        "Heat exchangers can no longer reject heat"
      ],
      "systemEffects": [
        "Forced heat-removal chains defeated, cascading to loss of forced cooling and heat sink",
        "Reactor trip; decay heat transfers to the passive RCCS"
      ],
      "detection": [
        "Service-water flow/pressure-low and pump-trip alarms",
        "Heat-exchanger outlet-temperature-high alarms"
      ],
      "safeguards": [
        "Redundant service-water pumps and intakes",
        "Passive RCCS as the independent ultimate sink for decay heat",
        "Reactor scram on loss of heat sink"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-32"
      ]
    },
    {
      "id": "FM-25",
      "componentId": "Essential HVAC / ventilation to electrical, switchgear and I&C spaces",
      "mode": "Loss of essential ventilation causing room overheating",
      "causes": [
        "HVAC fan or chiller trip or loss of power",
        "Damper failure or duct blockage",
        "Loss of HVAC cooling-water support"
      ],
      "localEffects": [
        "Electrical, switchgear and I&C room temperatures rise",
        "Electronics and protection equipment overheat and degrade"
      ],
      "systemEffects": [
        "Thermally-induced degradation/trip of control and protection equipment, prompting a protective trip",
        "Challenge to heat-generation control and radionuclide-control monitoring"
      ],
      "detection": [
        "Room high-temperature alarms",
        "HVAC fan/chiller trip annunciation"
      ],
      "safeguards": [
        "Redundant HVAC trains for essential spaces",
        "Equipment temperature qualification and coping margin",
        "Protection logic fails to a safe state on degradation",
        "Passive RCCS independent of HVAC"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-34"
      ]
    },
    {
      "id": "FM-26",
      "componentId": "Fuel-handling machine / refuelling line-up (in-vessel and ex-vessel)",
      "mode": "Fuel-handling fault or refuelling line-up mispositioning (source-handling event)",
      "causes": [
        "Fuel-handling machine mechanical or control fault",
        "Dropped or mishandled fuel block",
        "Refuelling line-up / configuration error"
      ],
      "localEffects": [
        "Fuel block damage or loss of cooling line-up during handling",
        "Local breach of the TRISO/handling boundary"
      ],
      "systemEffects": [
        "Refuelling-mode source-handling event challenging radionuclide control with the vessel open",
        "Loss of the handling cooling configuration and possible local release"
      ],
      "detection": [
        "Refuelling-floor and confinement activity monitors",
        "Handling-machine position/interlock indication",
        "Fuel-temperature monitoring during handling"
      ],
      "safeguards": [
        "Handling interlocks and load/position limits",
        "Independent verification of refuelling line-ups",
        "Confinement and refuelling-floor ventilation/filtration",
        "SCS cooling maintained during handling"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-38",
        "IE-44"
      ]
    },
    {
      "id": "FM-27",
      "componentId": "Spent / stored fuel cooling (ex-core storage source)",
      "mode": "Loss of cooling to spent / stored fuel and ex-core storage",
      "causes": [
        "Storage-cooling train trip or loss of power",
        "Cooling-flow blockage or inventory loss",
        "Loss of support utilities to storage cooling"
      ],
      "localEffects": [
        "Stored/spent-fuel temperature rises",
        "Reduced margin in the ex-core storage source"
      ],
      "systemEffects": [
        "Loss of decay-heat removal from the stored-fuel source challenging radionuclide control",
        "Slow heatup with large passive grace time at storage decay-heat levels"
      ],
      "detection": [
        "Storage-cooling flow/temperature alarms",
        "Stored-fuel temperature monitoring"
      ],
      "safeguards": [
        "Redundant storage-cooling provisions",
        "Large thermal margin/grace time of TRISO stored fuel",
        "Passive heat-loss paths from the storage array"
      ],
      "severity": 4,
      "derivedInitiatorIds": [
        "IE-39"
      ]
    },
    {
      "id": "FM-28",
      "componentId": "Operator interface to reactivity control (rod control during operation/startup)",
      "mode": "Operator-induced reactivity insertion (erroneous rod or rod-group withdrawal)",
      "causes": [
        "Operator commission error withdrawing the wrong rod/group",
        "Misinterpretation of reactivity status",
        "Procedure non-compliance during a maneuver"
      ],
      "localEffects": [
        "Unintended positive reactivity added by operator action",
        "Core power and temperature rise"
      ],
      "systemEffects": [
        "Operator-induced reactivity/overpower transient at the initiator",
        "Challenge to heat-generation and heat-removal control"
      ],
      "detection": [
        "Flux/power-rate trip and rod-position indication",
        "Independent monitoring and crew cross-check",
        "Core temperature rise"
      ],
      "safeguards": [
        "Reactor scram on high flux/short period",
        "Reserve shutdown control equipment backup",
        "Negative temperature feedback",
        "Procedures, interlocks and crew verification"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-41",
        "IE-45"
      ]
    },
    {
      "id": "FM-29",
      "componentId": "Operator interface to primary boundary / forced-cooling trains",
      "mode": "Operator-induced depressurization or inadvertent trip/isolation of the operating forced-cooling train",
      "causes": [
        "Inadvertent vent or relief-valve opening during maintenance",
        "Erroneous isolation/trip of the operating circulator or cooling train",
        "Mis-line-up of the heat-transport/SCS configuration"
      ],
      "localEffects": [
        "Primary vents to lower pressure, or forced flow is lost by the operator action",
        "Loss of the running heat-removal path or boundary integrity"
      ],
      "systemEffects": [
        "Operator-induced loss of forced cooling or primary boundary integrity",
        "Challenge to heat removal and to radionuclide retention"
      ],
      "detection": [
        "Primary pressure-low and flow-low alarms",
        "Valve/breaker position indication",
        "Crew cross-check and configuration control"
      ],
      "safeguards": [
        "Reactor scram and SCS/RCCS backup on loss of cooling",
        "Independent verification before primary/cooling line-up changes",
        "Confinement retains released activity",
        "Interlocks on vent and isolation paths"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-43",
        "IE-46"
      ]
    },
    {
      "id": "FM-30",
      "componentId": "Operator interface to secondary side / steam generator line-up",
      "mode": "Operator-induced overcooling or secondary mis-line-up causing primary moisture ingress",
      "causes": [
        "Erroneous secondary/heat-removal maneuver causing overcooling",
        "Mis-line-up admitting water/steam toward the primary interface",
        "Procedure error during steam-generator operations"
      ],
      "localEffects": [
        "Excessive heat extraction (overcooling) or a moisture pathway toward the primary",
        "Secondary-side conditions move outside the intended band"
      ],
      "systemEffects": [
        "Overcooling reactivity/temperature transient, or operator-induced water/steam ingress with positive reactivity and graphite/fuel chemical attack",
        "Challenge to reactivity control and TRISO retention"
      ],
      "detection": [
        "Primary moisture monitor and core temperature/flux response",
        "Steam-generator level/flow mismatch",
        "Crew cross-check of secondary line-up"
      ],
      "safeguards": [
        "Moisture-high trip with scram, steam-generator isolation and feedwater trip",
        "Negative temperature feedback and reactor scram on overcooling",
        "Independent verification of secondary line-ups",
        "Helium purification removes ingressed moisture"
      ],
      "severity": 6,
      "derivedInitiatorIds": [
        "IE-45",
        "IE-47"
      ]
    }
  ]
};

const HAZARD_ANALYSES: HazardAnalysis[] = [
  {
    uuid: "HAZ-1",
    name: "Internal fire",
    description: "Internal fire at the Generic HTGR: any in-plant fire (cable trays and electrical raceways, switchgear and motor-control centers, control and relay rooms, the helium-circulator and lube-oil skids, the turbine-generator and its hydrogen/oil systems, cable spreading and battery rooms, and fires in the reactor cavity and the RCCS riser/duct spaces). The internal-events concern is not the resulting loss of forced cooling, which the passive RCCS conduction cooldown bounds, but the fire-specific damage modes identified in NUREG/CR-6850: spurious actuation and hot-shorts that command unwanted plant actions (trips, spurious primary depressurization, spurious rod motion), thermal failure of primary-boundary penetrations, seals and small lines that can open a depressurizing breach, thermal and smoke damage that blinds or disables the passive RCCS in the cavity, and the role of fire heat in sustaining the chimney and graphite oxidation if a depressurizing primary breach is also present. Quantified in the dedicated Fire PRA element, not here.",
    hazardType: "INTERNAL",
    subcategory: "Internal fire",
    severityLevels: ["Incipient / localized cable or panel fire (single division, suppressed before propagation)", "Fully developed compartment fire with loss of a forced-cooling or support division", "Multi-compartment or cavity/RCCS-space fire challenging the passive heat-removal path", "Fire concurrent with a primary breach establishing an air-ingress chimney (graphite-oxidation regime)"],
    affectedAreas: ["Cable spreading rooms and electrical raceways", "Switchgear, motor-control-center and battery rooms", "Main control room and relay/I&C rooms", "Helium-circulator skid and lube-oil systems", "Turbine-generator hall and power-conversion oil/hydrogen systems", "Shutdown Cooling System and reactor-plant-cooling-water equipment rooms", "Reactor cavity and RCCS riser/duct and cavity-cooling spaces", "Fuel-handling and spent/stored-fuel building"],
    radionuclideBarrierIds: ["Primary helium boundary", "Confinement", "TRISO coating"],
    inducingMechanisms: ["Cable, raceway, switchgear or transformer fire damages normal AC distribution and the offsite-power interface, dropping the operating forced-cooling trains and producing trip/loss-of-power transients (main circulator trip, loss of feedwater and steam-generator heat sink, turbine trip, LOOP, loss of non-Class-1E AC).", "Fire in battery rooms, vital-instrument-power or essential-HVAC spaces removes Class 1E DC, the vital UPS, and ventilation to electrical and I&C rooms, causing support-system-driven initiators and forcing reactor trip.", "Fire at the helium-circulator skid and its lube-oil system, or in the Shutdown Cooling System and reactor-plant-cooling-water rooms, disables the active forced-cooling and shutdown-cooling paths (pressurized loss of forced cooling and loss of the active backup).", "Hot-shorts and spurious actuation from a control, relay or cable fire command unwanted plant actions: a spurious general scram, spurious control-rod motion (withdrawal or drop), spurious lift of a primary relief/safety valve, and inadvertent opening of a primary vent or helium-pressure-control path, producing trips, reactivity transients and small-to-moderate depressurizations.", "Thermal damage from a sustained compartment fire to primary-boundary penetrations, gaskets, instrument lines and small connections can fail the helium pressure boundary directly, producing a small, moderate or large primary leak / depressurization (depressurized loss of forced cooling) independent of any spurious valve action.", "Fire heat and smoke in the reactor cavity or in the RCCS riser/duct and cavity-cooling spaces degrades or blinds the passive Reactor Cavity Cooling System and its natural-circulation path; loss of service water / ultimate heat sink to forced systems can also follow a fire in those galleries.", "Fire in the fuel-handling building or at the spent/stored-fuel storage challenges the source-handling line-up and the cooling to ex-core stored fuel, inducing fuel-handling and stored-fuel-cooling events.", "A fire that supplies sustained heat at a coincident depressurizing primary breach plus a confinement/structure breach establishes the chimney that drives air ingress and graphite oxidation, the genuinely risk-significant fire outcome for this graphite core."],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-07", "IE-08", "IE-09", "IE-14", "IE-15", "IE-16", "IE-17", "IE-18", "IE-25", "IE-27", "IE-28", "IE-29", "IE-30", "IE-31", "IE-32", "IE-33", "IE-34", "IE-35", "IE-36", "IE-37", "IE-38", "IE-39", "IE-40"],
    potentialCombinations: ["Fire-induced LOOP plus loss of forced cooling: a switchgear/transformer fire causing IE-28 (LOOP) concurrent with IE-01/IE-14 forced-cooling loss, riding out passively on the RCCS unless the cavity path is also fire-degraded.", "Cable/relay-fire hot-short causing a spurious primary depressurization (IE-18/IE-36/IE-37) concurrent with a fire-induced confinement/structure breach, establishing the air-ingress chimney for graphite oxidation.", "Fire-induced primary-boundary breach (IE-17 depressurized loss of forced cooling from thermal failure of a penetration/seal) concurrent with a fire-induced confinement/structure breach, directly establishing the depressurized air-ingress chimney that drives graphite oxidation.", "Cavity / RCCS-space fire degrading the passive heat-removal path (RCCS blinding) concurrent with a fire-induced loss of the active forced-cooling trains, removing both the active and the passive cooling defenses.", "Fire-induced internal flood: actuation or failure of fire-suppression water in electrical or forced-cooling spaces, spreading damage as a secondary internal-flood scenario.", "Fire in the fuel-handling building or the stored-fuel vault during a handling evolution: a fire that disrupts the in-vessel and ex-vessel source-handling line-up (IE-38) and removes cooling from the spent and stored fuel (IE-39), a spent-fuel-under-hazard path for the graphite fuel blocks."],
    analysisMethods: ["NUREG/CR-6850 (EPRI/NRC Fire PRA methodology) fire-scenario development, fire-area partitioning and ignition-frequency assignment", "Fire-induced circuit-failure and hot-short / spurious-actuation analysis (NUREG/CR-6850 and NUREG-2178)", "Fire modeling and zone-of-influence/damage analysis (NUREG-1934, CFAST/FDS) for cable and target damage and for cavity/RCCS heat-up", "Multi-compartment and fire-propagation analysis", "Fire-specific HRA for post-fire operator actions (NUREG-1921)", "ASME/ANS RA-S non-LWR (RA-S-1.4) fire-hazard PRA requirements applied to the gas-cooled, passively-cooled design"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "Internal fire is out of scope for this internal-events PRA element and is developed and quantified in the dedicated Fire PRA element using the NUREG/CR-6850 methodology. It is recorded here only as a considered hazard group whose fire-induced plant trips, support-system losses, spurious actuations, primary-boundary breaches and depressurizations map onto the internal-events initiator set above. Reflecting HTGR physics, the fire-induced loss of forced cooling is itself benign because the passive RCCS conduction cooldown bounds fuel temperature, so the core rides out the heat-removal transient. The residual risk-significant fire outcomes carried by the dedicated element are therefore: a fire that blinds or disables the passive RCCS or its cavity natural-circulation path; a fire (or its hot-short, or its direct thermal failure of a primary penetration/seal) that produces a primary depressurization which, combined with a confinement/structure breach, sustains the chimney and heat driving graphite air oxidation; and fires in the fuel-handling and spent/stored-fuel spaces that challenge the source-handling line-up and ex-core fuel cooling.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-2",
    name: "Internal flooding",
    description: "Internal flooding at the Generic HTGR: a flood, spray, or high-energy-line-break wetting source inside plant structures arising from rupture or spurious actuation of water-bearing systems (service water / reactor-plant cooling water, fire-suppression, the steam-generator/feedwater/main-steam secondary side, and circulator bearing/seal water). For an LWR this is mainly an equipment-submergence transient; for the Generic HTGR the dominant flood concern is a water-ingress path. Water reaching the primary circuit through a steam-generator tube/header or an in-vessel heat-exchanger boundary admits water/steam that inserts positive reactivity into the undermoderated graphite core and drives moisture-graphite/fuel oxidation, while flooding of the reactor cavity threatens the passive RCCS heat sink and ex-core stored-fuel cooling. Submergence and spray of forced-cooling support equipment, electrical buses, and I&C spaces produces the usual support-system trips, but those are benign because passive RCCS conduction cooldown bounds fuel temperature.",
    hazardType: "INTERNAL",
    subcategory: "Internal flooding (water/steam ingress and equipment submergence)",
    severityLevels: ["Minor spray/leak confined to one room (drips, monitored, no submergence)", "Moderate flood from a service-water or fire-suppression line rupture submerging forced-cooling support equipment and electrical/I&C spaces in one division", "High-energy secondary line break (feedwater/main-steam/SG header) inside the reactor building driving SG-tube failure and water/steam ingress to the primary", "Major flood reaching the reactor cavity, blocking/submerging the RCCS heat sink or ex-core stored-fuel cooling (cavity-flooding BDBE)"],
    affectedAreas: ["Reactor building / reactor cavity and the RCCS standpipe and cavity-cooling region", "Steam-generator, feedwater, and main-steam cavity and the SG / SCS heat-exchanger penetrations of the helium pressure boundary", "Helium-circulator bay (water-lubricated bearing/seal water source)", "Forced-cooling support-equipment rooms (RPCW/component-cooling, service-water, instrument-air, HVAC)", "Electrical switchgear, battery (DC), and vital-instrument (UPS) rooms and I&C spaces", "Fuel-handling and spent/stored-fuel storage areas", "Turbine / power-conversion building (circulating-water and condenser source)"],
    radionuclideBarrierIds: ["TRISO coating", "Primary helium boundary", "Confinement"],
    inducingMechanisms: ["Secondary-side high-energy line break (feedwater, main-steam, or SG header rupture) inside the reactor building floods/sprays the SG cavity and overpressurizes or mechanically fails steam-generator tubes, admitting water/steam through the SG heat-exchanger section of the helium pressure boundary into the primary circuit: positive reactivity insertion in the undermoderated graphite core plus moisture-driven graphite/fuel oxidation, with primary-pressure rise that can lift the safety relief valves (IE-13, IE-19, IE-20, IE-21, IE-22)", "Flood/spray water entering the in-vessel Shutdown Cooling System helium-to-water heat exchanger or upsetting the helium-circulator water-lubricated bearing/seal pressure balance opens a non-SG water-ingress path into the primary helium (IE-23, IE-26)", "Service-water / reactor-plant (component) cooling-water or fire-suppression line rupture or spurious deluge submerges or sprays the forced-cooling support trains and their heat exchangers, defeating the main helium circulator, the steam-generator feedwater path, and the SCS, and isolating the ultimate heat sink (IE-01, IE-02, IE-03, IE-04, IE-14, IE-31, IE-32)", "Flooding of electrical switchgear, DC battery rooms, vital-instrument (UPS) rooms, instrument-air headers, and essential-ventilation/HVAC spaces fails non-1E AC, Class 1E DC, vital UPS, instrument/service air, and equipment-room cooling, tripping the running forced-cooling train and the power-conversion system and producing a fail-safe reactor trip (IE-05, IE-07, IE-27, IE-29, IE-30, IE-33, IE-34)", "Flood propagation into the reactor cavity submerges or blocks the passive Reactor Cavity Cooling System and its standpipes, degrading the conduction/radiation heat sink, and floods ex-core spent/stored fuel storage, challenging stored-fuel cooling (challenges RCCS heat sink; IE-39)", "Flood or spray in the fuel-handling and refuelling area disables fuel-handling machine interlocks or drives a mispositioning/source-handling event on in-vessel or ex-vessel fuel (IE-38)"],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-07", "IE-13", "IE-14", "IE-19", "IE-20", "IE-21", "IE-22", "IE-23", "IE-26", "IE-27", "IE-29", "IE-30", "IE-31", "IE-32", "IE-33", "IE-34", "IE-38", "IE-39"],
    potentialCombinations: ["Flood-induced steam/water ingress: a high-energy feedwater or main-steam line break inside the reactor building that both floods support spaces and ruptures steam-generator tubes, combining equipment submergence with primary water/steam ingress (positive reactivity + graphite oxidation) (IE-A6)", "Flood-induced loss of forced cooling: a service-water or component-cooling-water line rupture that simultaneously fails the main helium circulator loop and the SCS backup, forcing reliance on the passive RCCS (IE-A6)", "Flood plus RCCS-cavity degradation: a major reactor-cavity flood that defeats the passive RCCS heat sink concurrent with the forced-cooling loss it causes (IE-A6)", "Cavity flood defeating two passive/ex-core sinks: a single reactor-building/cavity flood source that both degrades the passive RCCS heat sink and submerges or blocks ex-core spent/stored-fuel cooling (IE-39), challenging the in-core conduction cooldown and the stored-fuel sink together (IE-A6)"],
    analysisMethods: ["Internal flooding PRA per ASME/ANS RA-S-1.4 / RA-S-1.2 (non-LWR advanced-reactor) flooding methodology and the NRC NEI 18-04 / RG 1.247 LMP technology-inclusive framework", "Flood-source identification and propagation walkdowns and plant-area/flood-zone partitioning (EPRI internal-flooding guidance, NUREG/CR-6850 flood-area analog for spatial partitioning)", "Flood-induced equipment-submergence and spray/jet susceptibility evaluation with flood height/timing propagation analysis between connected zones", "Steam-generator tube / heat-exchanger boundary structural and water-ingress analysis (positive-reactivity and moisture-graphite-oxidation source-term coupling) feeding the water-ingress event sequences", "Reactor-cavity flooding and RCCS-availability assessment for the passive heat sink", "Internal-flooding initiating-event frequency quantification from pipe-rupture and component-leak generic data (EPRI pipe-rupture frequencies, plant operating experience)"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "Internal flooding is screened out of this internal-events PRA element and is quantified in the dedicated internal-flooding hazard PRA element; step 06 records only that the hazard was considered, that it maps to the internal-events initiators listed under inducedInitiatorIds, and that it participates in the IE-A6 hazard combinations noted above. Per HTGR physics the flood-induced loss of forced cooling (circulator, feedwater, SCS, or their AC/DC/UPS/CCW/service-water/instrument-air/HVAC supports) is benign: passive RCCS conduction/radiation cooldown bounds fuel temperature with the helium boundary intact, so submergence transients ride out passively and do not by themselves challenge TRISO. The residual risk-significant flood outcomes the dedicated element develops are therefore (1) water/steam ingress through a steam-generator tube/header, SCS heat exchanger, or circulator water-bearing path, which inserts positive reactivity into the undermoderated graphite core, oxidizes graphite/fuel, and can lift the primary relief valves; (2) flooding or blockage of the RCCS and reactor cavity that degrades the passive heat sink; and (3) flooding of fuel-handling and spent/stored-fuel storage that challenges source handling and stored-fuel cooling. Internal flooding does not establish the depressurized-breach-plus-chimney geometry required for graphite air-ingress combustion, so the air-ingress accident class is not a flood concern.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-3",
    name: "High-energy line break / pipe failure (incl. internal missiles)",
    description: "Rupture or guillotine break of a high-energy line at the Generic HTGR, treated as one mechanically-coupled hazard with the internal missiles (pipe whip, jet impingement, valve/fastener fragments) the break generates. Two break populations dominate. (1) Primary helium pressure-boundary lines and penetrations (main coolant duct/cross-vessel, helium purification and inventory/pressure-control connections, instrument lines, pressure-relief lines) whose break depressurizes the primary circuit. (2) Secondary high-energy lines (steam-generator main steam, feedwater, and SCS heat-exchanger water side) whose break causes loss of the forced-cooling heat sink and, if it communicates with the primary side, water/steam ingress. The coupled internal-missile field can simultaneously sever the operating forced-cooling train, damage interfacing-system piping, and breach the surrounding confinement/structure or the RCCS standpipes in the reactor cavity. The risk-significant combinations are a depressurizing primary break together with a structure breach that opens a chimney for graphite oxidation (air ingress), and a steam-generator/secondary water path that adds moisture reactivity and oxidizes graphite (water/steam ingress); a pure loss of forced cooling is benign because passive RCCS conduction cooldown bounds fuel temperature unless the same missile/whip field also degrades the RCCS or reactor-cavity cooling channel.",
    hazardType: "INTERNAL",
    subcategory: "High-energy line break / pipe failure and internal missiles",
    severityLevels: ["Small high-energy crack/leak (slow primary depressurization or minor secondary leak, forced cooling and confinement intact)", "Moderate line break (intermediate primary depressurization or significant secondary water/steam release, limited local pipe-whip damage)", "Large/double-ended guillotine break with full pipe-whip and jet-impingement missile field (rapid primary depressurization and/or major water/steam ingress, potential confinement or RCCS-cavity damage)"],
    affectedAreas: ["Reactor cavity and primary system vault (main coolant duct/cross-vessel, vessel penetrations, RCCS standpipes)", "Steam-generator / power-conversion cell and feedwater piping runs", "Helium purification, inventory/pressure-control, and helium services rooms", "Instrument-line and relief/blowdown penetration routings", "Shutdown Cooling System heat-exchanger and water-side piping spaces", "Confinement boundary and structural members adjacent to high-energy line routings"],
    radionuclideBarrierIds: ["TRISO coating", "Primary helium boundary", "Confinement"],
    inducingMechanisms: ["Guillotine or split break of the main helium coolant duct / cross-vessel piping or a large vessel penetration vents the primary circuit, producing rapid depressurization (large primary boundary break / D-LOFC) with the discharging jet and whipping pipe acting as an internal missile against adjacent structures", "Break of a smaller primary-connected line (helium purification connection, instrument-line penetration, pressure-relief/blowdown line) produces a small-to-moderate primary depressurization through that connection while forced cooling can remain available", "A stuck-open or jet-/missile-damaged pressure-relief or safety valve establishes a persistent stuck-open primary blowdown path", "Break of a steam-generator main-steam or feedwater line, or whip/jet damage to the SG cell, removes the secondary heat sink and feedwater, tripping the turbine/power-conversion system and causing pressurized loss of forced cooling", "A steam-generator tube rupture or SG/secondary line break that communicates with the primary side drives water/steam into the helium circuit (HPB heat-exchanger breach), adding moisture (positive) reactivity and oxidizing graphite; range from small tube leak to large/multiple-tube rupture with relief-valve lift", "Break of the Shutdown Cooling System heat-exchanger or its water-side piping admits water into the SCS/primary heat-transfer path (SCS heat-exchanger tube/water-ingress failure) and disables the SCS active backup forced-cooling function", "Internal missiles (pipe whip, jet impingement, pipe/valve fragments) sever or seize the operating main helium circulator or its supporting lines, tripping the circulator and, if the SG loop is co-damaged, causing loss of the entire main loop heat transport", "Missile/jet damage to circulator water-lubricated bearing/seal lines or to helium inventory/pressure-control and purification piping breaches those interfacing systems and can admit bearing/seal water or vent helium makeup", "Coincident jet-impingement or missile breach of the confinement boundary or the reactor-cavity structure, combined with a depressurizing primary break, opens a flow path (chimney) for natural-circulation air ingress and graphite oxidation", "Missile/whip damage to RCCS standpipes, ducts, or cavity structure degrades the passive reactor cavity cooling channel within the affected cell"],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-13", "IE-14", "IE-15", "IE-16", "IE-17", "IE-18", "IE-19", "IE-20", "IE-21", "IE-22", "IE-23", "IE-24", "IE-25", "IE-26", "IE-36", "IE-37", "IE-40"],
    potentialCombinations: ["High-energy-line-break-induced large primary depressurization concurrent with a missile/jet breach of the confinement or reactor-cavity structure, establishing an air-ingress chimney (IE-A6: depressurizing primary break + confinement breach -> air ingress / graphite oxidation)", "High-energy-secondary-line-break (steam/feedwater) with coincident primary-to-secondary communication producing combined loss of heat sink and water/steam ingress (IE-A6: steam-line break + moisture reactivity / graphite oxidation)", "Pipe-whip / jet-impingement missile field that simultaneously severs the operating forced-cooling train and breaches an interfacing helium-services or SCS water line (IE-A6: HELB-induced loss of main loop heat transport + interfacing-system ingress)", "Missile/whip damage to RCCS standpipes or reactor-cavity structure concurrent with a HELB-induced loss of forced cooling, degrading the passive cavity cooling channel so the otherwise-benign LOFC is no longer bounded by RCCS conduction cooldown (IE-A6: HELB-induced loss of forced cooling + RCCS/cavity-cooling degradation)", "Jet-impingement or missile damage that initiates a secondary internal flood/spray in the SG or SCS cell concurrent with the originating break (IE-A6: HELB-induced internal flood)", "Helium-line break followed by ignition of leaked combustibles or hot-jet impingement on cabling causing a localized internal fire in the affected cell (IE-A6: HELB-induced internal fire)"],
    analysisMethods: ["ASME/ANS RA-S-1.4 high-energy line break (HELB) and internal-missiles methodology adapted for the non-LWR mechanistic-source-term framework", "Pipe-break location and break-type selection per high-energy-line-break siting analysis (terminal-end, high-stress, and arbitrary-intermediate break postulation)", "Pipe-whip and jet-impingement load analysis (whip-restraint adequacy, jet-impingement targets, and spatial interaction / separation review)", "Internal-missile generation, trajectory, and target-damage assessment for rotating-equipment and pressure-part fragments", "Spatial systems-interaction / proximity walkdown mapping high-energy lines to RCCS, confinement, forced-cooling, and interfacing-system targets", "Air-ingress and water/steam-ingress phenomenological and source-term analysis (e.g., MELCOR / mechanistic source-term evaluation) for breach-plus-confinement and SG-communication scenarios"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "High-energy line break / pipe failure including the coupled internal-missile field is SCREENED_OUT of this internal-events element and is developed in the dedicated internal-hazards (HELB and internal-missiles) PRA element, with interfaces to the internal-flood and internal-fire elements for the secondary effects it can trigger. Step 06 records only that the hazard was CONSIDERED and maps the internal-events initiators it would induce (the depressurization, water/steam-ingress, loss-of-heat-sink, loss-of-SCS, and interfacing-line-break IEs listed) so the dedicated element starts from a complete induced-initiator set; the frequency and consequence quantification of pipe breaks and missiles is performed there, not here. Reflecting HTGR physics: a HELB whose only effect is loss of forced cooling (circulator trip, loss of SG/feedwater, loss of SCS, loss of main loop heat transport) is benign, because passive RCCS conduction/radiation cooldown bounds fuel temperature and the core rides the transient out; consequently the residual risk-significant outcomes the dedicated element must resolve are (1) air ingress, requiring a depressurizing primary breach PLUS a missile/jet breach of the confinement or cavity structure to open a graphite-oxidation chimney, (2) water/steam ingress from an SG/secondary break communicating with the primary circuit (moisture reactivity and graphite oxidation), and (3) localized loss or blockage of the RCCS / reactor-cavity cooling channel from missile or whip damage in the cavity, which is the one mechanism that defeats the passive heat sink and removes the bounding on an otherwise-benign LOFC. Spent-fuel and source-handling events are not credibly initiated by these line breaks and are screened to their own treatment.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-4",
    name: "Internal explosion / combustible-gas (incl. CO/H2 from graphite oxidation)",
    description: "Internal deflagration or explosion at the Generic HTGR arising from accumulated combustible gas. Credible sources are station hydrogen (bottle storage, generator/turbine seal gas, water-chemistry addition), battery-room hydrogen, lube-oil mist and switchgear/arc-flash energetics, and, uniquely to the HTGR, carbon monoxide and hydrogen generated by graphite oxidation when air or water/steam ingresses a hot core. A deflagration in the confinement volume, the reactor cavity, or an electrical/turbine space produces an overpressure transient and missiles. The risk-significant feature is that a blast can breach the low-pressure vented confinement and create the open structure pathway that lets a graphite-oxidation chimney establish and self-sustain, so the hazard acts as an outcome-amplifier on an air-ingress sequence rather than as a benign loss-of-forced-cooling event. The CO/H2 variant is not a standalone initiator; it is the combustion of gas already produced by an air- or water-ingress event in progress.",
    hazardType: "INTERNAL",
    subcategory: "Internal explosion / combustible-gas deflagration",
    severityLevels: ["Minor localized deflagration (single component/space, no barrier challenge)", "Confined-space explosion damaging forced-cooling or electrical equipment (plant trip)", "Confinement-breaching deflagration opening a structure pathway", "CO/H2 deflagration coupled to an in-progress air/water-ingress event sustaining a graphite-oxidation chimney (BDBE)"],
    affectedAreas: ["Vented low-pressure confinement volume", "Reactor cavity / RCCS region", "Turbine and power-conversion building (hydrogen seal gas, lube oil)", "Switchgear and electrical rooms", "Battery / DC equipment rooms", "Helium purification and gas-handling spaces", "Hydrogen storage and water-chemistry addition areas", "Spent / stored fuel handling and storage areas"],
    radionuclideBarrierIds: ["Confinement", "Primary helium boundary", "TRISO coating"],
    inducingMechanisms: ["Hydrogen accumulation in the turbine/generator hall (seal gas or chemistry-addition leak) ignites and deflagrates, damaging the power-conversion train and tripping the turbine and main circulator, manifesting as a general reactor trip", "Battery-room or switchgear hydrogen/arc-flash explosion damages AC/DC distribution, causing loss of normal AC, loss of Class 1E DC/UPS, and consequential loss of offsite power and HVAC to electrical spaces", "Lube-oil mist or switchgear explosion in forced-cooling support spaces disables feedwater, the steam generator heat path, the Shutdown Cooling System, component cooling water, service water, or instrument air", "Blast overpressure and missiles in the confinement or cavity strike primary-circuit piping, helium purification lines, instrument penetrations, or relief valves, opening a small-to-large primary depressurization", "Deflagration in the reactor cavity damages or blocks the RCCS and creates the confinement/structure breach that establishes a graphite-oxidation air-ingress chimney", "Explosion damage to a steam-generator or water-lubricated circulator bearing/seal boundary opens a small, moderate, or large water/steam ingress path, adding moisture and oxidizing graphite", "CO/H2 produced by graphite oxidation during an ongoing air- or water-ingress event ignites and the resulting overpressure enlarges the confinement breach, amplifying the chimney and challenging TRISO via continued oxidation", "Explosion in a fuel-handling or spent-fuel space disrupts the source-handling line-up or cooling to stored/ex-core fuel"],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-07", "IE-14", "IE-15", "IE-16", "IE-17", "IE-18", "IE-19", "IE-20", "IE-21", "IE-22", "IE-23", "IE-24", "IE-25", "IE-26", "IE-27", "IE-28", "IE-29", "IE-30", "IE-31", "IE-32", "IE-33", "IE-34", "IE-35", "IE-36", "IE-37", "IE-38", "IE-39", "IE-40"],
    potentialCombinations: ["Explosion-induced fire (deflagration ignites lube oil, cabling, or hydrogen sustaining a compartment fire)", "Explosion-induced internal flood (blast ruptures a fire-protection, service-water, or feedwater line causing in-cavity flooding)", "Explosion + LOOP + loss of forced cooling (switchgear/battery deflagration drops AC plus the operating cooling train)", "Combustible-gas explosion coupled to air ingress (confinement-breaching blast establishes the graphite-oxidation chimney)", "CO/H2 deflagration secondary to a water/steam-ingress event (moisture-driven oxidation generates the gas that then explodes)", "Explosion-induced depressurized loss of forced cooling with air ingress (single blast opens both the primary boundary and the confinement, giving the depressurized-breach plus confinement-breach combination that drives the air-ingress chimney)"],
    analysisMethods: ["Internal hazards / internal explosion PRA per ASME/ANS RA-S-1.4 non-internal-events methodology", "Combustible-gas (hydrogen) generation, accumulation, and deflagration/detonation analysis (NFPA 68/69 venting and explosion-protection bases)", "Graphite-oxidation CO/H2 source-term and ignition analysis (air-ingress and water/steam-ingress chemistry kinetics for HTGR graphite)", "Overpressure and missile structural-response evaluation of the confinement, cavity, and primary boundary", "Spatial/compartment combustible-load mapping with screening and quantitative deflagration assessment, then mapping survivors to the internal-events model"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "Screened out of the internal-events PRA element. Internal explosion and combustible-gas deflagration is an internal hazard quantified in the dedicated internal-explosion / combustible-gas hazard PRA element, not here; this Step 06 record only documents that the hazard was considered and maps the plant-level initiators it would induce from the internal-events set. Consistent with HTGR physics, an explosion that merely trips forced cooling (circulator, steam generator, Shutdown Cooling System, or supporting AC/DC) is benign because passive RCCS conduction/radiation cooldown bounds fuel temperature and the core rides the transient out. The residual risk-significant outcomes carried into the dedicated element are: a confinement- or cavity-breaching deflagration that opens the structure pathway sustaining a graphite-oxidation air-ingress chimney (challenging Confinement, the Primary helium boundary, and ultimately TRISO); blast damage that opens a water/steam-ingress path; loss or blockage of the RCCS / reactor cavity from in-cavity explosion damage; and combustion of CO/H2 already generated by an in-progress air- or water-ingress event, where the explosion amplifies the breach rather than initiating the sequence. Spent-fuel and source-handling explosion impacts are likewise developed there.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-5",
    name: "Heavy-load / fuel-handling drop",
    description: "Drop of a heavy load (crane, transfer cask, vessel head, component) or a fuel-handling drop onto in-vessel fuel blocks, spent/stored fuel blocks, the primary helium pressure boundary, or supporting systems at the Generic HTGR. The hazard is a handling-phase mechanical-impact event capable of breaching TRISO-laden fuel blocks or the helium boundary outside the operating core and releasing primary-circuit plateout, stored-fuel, or in-core source activity. It is screened as its own handling-phase hazard because the dominant load paths (refuelling penetrations, transfer casks, the spent/stored-fuel handling line-up) bypass normal at-power protection and directly challenge the fuel and the pressure boundary.",
    hazardType: "INTERNAL",
    subcategory: "Heavy-load and fuel/source-handling drop (mechanical impact)",
    severityLevels: ["Minor handling impact with no fuel-block or boundary breach (load arrested, dropped within design envelope)", "Single fuel-block or local boundary damage with limited plateout/stored-fuel release", "Drop breaching the primary helium boundary causing depressurization with intact confinement", "Drop breaching both the helium boundary and confinement/structure, establishing an air-ingress chimney with graphite oxidation and significant source release"],
    affectedAreas: ["Reactor building refuelling floor and over-vessel handling area", "Primary helium pressure boundary (vessel head, refuelling and instrument penetrations, helium piping)", "Spent / stored fuel block storage and transfer area", "Fuel-handling machine and transfer-cask load paths", "Helium purification, inventory and pressure-control component bays in the handling area", "Local AC and I&C cabinets/buswork beneath crane load paths"],
    radionuclideBarrierIds: ["TRISO coating", "Primary helium boundary", "Confinement"],
    inducingMechanisms: ["Drop of a heavy load (crane block, transfer cask, vessel head, large component) onto the reactor vessel head, refuelling penetration, or helium piping breaches the primary helium pressure boundary, producing a small, moderate, or large depressurization depending on impact energy and breach size", "Impact on a primary pressure-relief or safety valve jams the relief path open, giving a stuck-open primary depressurization", "Impact on the helium purification line or an instrument penetration opens a small primary depressurization path through that connection", "Drop within the fuel-handling line-up onto in-vessel or spent/stored fuel blocks cracks TRISO-laden blocks, releasing plateout and stored-fuel activity and constituting an in-vessel or ex-vessel source-handling event", "A dropped or mispositioned fuel block during core loading inserts a fuel-loading/mispositioning reactivity error", "Drop interrupting cooling to the spent/stored fuel block storage source defeats decay-heat removal from that ex-core source", "Drop severing main-loop, circulator, or shutdown-cooling support trips the helium circulator and removes forced cooling and main loop heat transport (benign under passive RCCS but recorded as an induced transient and reactor trip)", "Drop onto local AC distribution or I&C cabinets/buswork beneath the crane load path causes loss of non-Class 1E AC and a general reactor trip", "Impact on helium inventory, pressure-control, makeup, or purification components outside the primary boundary breaches those interfacing systems"],
    inducedInitiatorIds: ["IE-01", "IE-04", "IE-07", "IE-12", "IE-14", "IE-15", "IE-16", "IE-17", "IE-18", "IE-24", "IE-25", "IE-27", "IE-35", "IE-36", "IE-37", "IE-38", "IE-39", "IE-40"],
    potentialCombinations: ["Drop-induced primary boundary breach combined with a coincident confinement/structure breach establishing an air-ingress chimney and graphite oxidation (drop-induced depressurization + air ingress)", "Drop-induced fuel-block damage releasing stored-fuel and plateout activity coincident with a handling-phase helium-boundary breach (drop-induced source-handling event + depressurization)", "Drop onto the steam generator, shutdown-cooling heat exchanger, or water-lubricated circulator bearing breaching a water/steam boundary into the primary circuit coincident with the helium-boundary breach (drop-induced depressurization + water/steam ingress)", "Drop-induced fire from crane hydraulic/lubricating oil or impacted electrical equipment in the handling area (drop-induced fire)"],
    analysisMethods: ["NUREG-0612 / NUREG-0554 heavy-loads control and single-failure-proof handling-system evaluation", "Drop-load-path and impact-energy structural analysis against fuel-block and primary-boundary capacity", "Fuel-handling and spent/stored-fuel source-term and consequence analysis with TRISO/plateout release fractions", "ASME/ANS RA-S-1.4 (non-LWR advanced reactor PRA) other-hazards and handling-event screening and quantification", "HRA for handling and rigging human errors in the fuel-handling and heavy-load procedures"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "Out of scope for the internal-events element and developed in the dedicated heavy-load and fuel/source-handling drop hazard element. A heavy-load or fuel-handling drop is a handling-phase mechanical-impact hazard quantified with its own load-path, drop-frequency, and source-term models rather than the at-power internal-events initiator models. Reflecting Generic HTGR physics, any drop-induced loss of forced cooling (circulator trip, loss of main loop heat transport, loss of shutdown cooling) is benign because passive RCCS conduction/radiation cooldown bounds fuel temperature and the core rides it out. The risk-significant drop outcomes are instead a depressurizing primary-boundary breach, breach of TRISO-laden in-vessel or spent/stored fuel blocks releasing plateout and stored-fuel activity, loss of cooling to the ex-core fuel storage source, and the air-ingress combination if a drop breaches both the helium boundary and confinement/structure. These handling-phase and source-handling outcomes, the combinations triggered by the drop, and their consequences are evaluated in the dedicated element; this internal-events element records only that the hazard was considered and maps which internal-events initiators it would induce.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-6",
    name: "Seismic",
    description: "Ground motion from a seismic event at the Generic HTGR site. A single earthquake is the bounding common-cause external hazard because it can act on every system and structure at once: it can trip the main helium circulator and the power conversion train, collapse offsite power, breach the primary helium pressure boundary, crack the confinement and reactor-cavity structure, and disable or block the passive Reactor Cavity Cooling System (RCCS). The combination that matters for an HTGR is a depressurizing primary breach together with a confinement/structure breach (a chimney for air ingress), plus loss of the RCCS heat path, which converts an otherwise-benign loss of forced cooling into a potential graphite-oxidation and fuel-release sequence.",
    hazardType: "EXTERNAL",
    subcategory: "Seismic ground motion (vibratory ground motion and seismically-induced failures)",
    severityLevels: ["Below-SSE / OBE-level operating-basis ground motion (forced-cooling trips, LOOP, reactor trip; primary boundary and RCCS intact)", "Safe-shutdown earthquake (SSE / design-basis) ground motion (component anchorage and tube/penetration failures credible; small-to-moderate primary leaks; SG tube ruptures)", "Beyond-design-basis (BDBE) ground motion (large primary boundary break plus confinement/reactor-cavity structural failure; RCCS loss or cavity blockage; multiple correlated failures enabling air ingress)"],
    affectedAreas: ["Reactor building and confinement structure", "Reactor cavity and RCCS risers/ducts/standpipes and RCCS support structure", "Reactor vessel supports and primary helium pressure boundary (vessel, cross-vessel/duct, penetrations, relief and instrument lines)", "Steam generator and secondary/feedwater piping", "Helium circulator, Shutdown Cooling System, and helium purification/inventory systems", "Switchyard and offsite power connections, onsite Class 1E and non-Class 1E electrical distribution and DC/UPS", "Reactor plant cooling water, service water/ultimate heat sink, instrument air, and HVAC for electrical/I&C spaces", "Fuel-handling machine and spent/stored fuel storage and its cooling"],
    radionuclideBarrierIds: ["TRISO coating", "Primary helium boundary", "Confinement"],
    inducingMechanisms: ["Ground motion trips the main helium circulator and the power conversion system and fails the steam generator/feedwater path, producing a pressurized loss of forced cooling and loss of the normal heat sink (passively bounded by RCCS conduction cooldown).", "Seismic failure of the switchyard and grid connection causes loss of offsite power, which trips the circulator and feedwater and forces transfer to the Shutdown Cooling System, itself vulnerable to the same event.", "Inertial loading and anchorage failure rupture the primary helium pressure boundary (vessel penetrations, cross-vessel duct, relief lines, instrument lines, helium purification connections), producing small, moderate, or large depressurizations; a coincident confinement/reactor-cavity structural breach establishes the chimney geometry for air ingress.", "Relative motion between the steam generator tube bundle and shell shears SG tubes, opening a high-pressure-boundary water/steam ingress path that adds positive reactivity (moisture) and oxidizes graphite; relief-valve lift on the secondary side can aggravate the ingress.", "Seismic damage to the helium circulator's water-lubricated bearings/seals or its shutdown-cooling-system heat exchanger breaches a cooling-water boundary inside the primary, adding a further seismically-induced moisture-ingress path.", "Seismic damage to or blockage of the reactor cavity and RCCS standpipes/ducts (structural collapse, debris, support failure) degrades or defeats the passive decay-heat removal path.", "Failure of support systems by ground motion (Class 1E and non-1E AC distribution, DC and vital UPS, reactor plant cooling water, service water/ultimate heat sink, instrument/service air, essential HVAC) disables the active forced-cooling and shutdown-cooling trains.", "Seismically induced reactivity effects: core overcooling from a sudden change in heat-removal rate, moisture-reactivity insertion from SG tube ingress, and potential rod/drive disturbances during strong motion.", "Seismic loads on the fuel-handling machine during refuelling or on spent/stored fuel storage cause a source-handling event or loss of cooling to the ex-core fuel source."],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-07", "IE-11", "IE-13", "IE-14", "IE-15", "IE-16", "IE-17", "IE-18", "IE-19", "IE-20", "IE-21", "IE-22", "IE-23", "IE-24", "IE-25", "IE-26", "IE-27", "IE-28", "IE-29", "IE-30", "IE-31", "IE-32", "IE-33", "IE-34", "IE-35", "IE-36", "IE-37", "IE-38", "IE-39", "IE-40"],
    potentialCombinations: ["Seismically-induced fire (earthquake ignites or ruptures flammable/oil systems, e.g. circulator lube oil or electrical faults, with degraded suppression)", "Seismically-induced internal flood (earthquake ruptures service-water/fire-water/cooling-water piping or tanks, flooding cavity or electrical/I&C spaces)", "Seismic + loss of offsite power + loss of forced cooling (correlated LOOP, circulator trip, and SCS unavailability)", "Seismically-induced steam/feedwater line break with SG tube rupture (concurrent secondary-side break and water/steam ingress to the primary)", "Seismically-induced primary boundary breach plus confinement/reactor-cavity structural breach (combined depressurization-plus-chimney geometry enabling air ingress)", "Seismically-induced RCCS/reactor-cavity damage combined with a depressurized loss of forced cooling", "Seismically-induced fuel-handling/spent-fuel storage structural failure combined with loss of cooling to the ex-core fuel source (fuel-handling-building structural collapse plus IE-39)", "Seismically-induced reactivity insertion concurrent with impeded control-rod insertion: ground motion that shifts or distorts the prismatic fuel blocks and the control-rod channels adds reactivity (IE-08, IE-11) while challenging the maintain-core-geometry function and the gravity scram-insertion path, the prismatic-HTGR seismic geometry-distortion ATWS concern, bounded by the strong negative temperature coefficient.", "Seismically-induced loss of vented-confinement isolation or essential-HVAC filtration (IE-34) concurrent with an in-progress release path: ground motion that defeats the confinement isolation dampers or the HVAC filtration while a primary depressurization (IE-15, IE-16, IE-17) or a plateout-mobilizing transient is underway, degrading the third barrier during the release."],
    analysisMethods: ["Seismic Probabilistic Risk Assessment (SPRA) per ASME/ANS RA-S-1.4 / the seismic portion of the Advanced Non-LWR PRA Standard RA-S-1.4", "Probabilistic Seismic Hazard Analysis (PSHA) to develop site seismic hazard curves and uniform hazard / ground-motion response spectra", "Seismic fragility analysis of SSCs (capacity-based fragility curves, HCLPF values per EPRI seismic margin methodology)", "Seismic equipment list (SEL) and seismic walkdowns (e.g. EPRI/SQUG GIP-based screening for ruggedness and seismic interactions/II-over-I)", "Soil-structure interaction and structural dynamic response analysis for the reactor building, confinement, reactor cavity, and RCCS", "Seismic systems analysis: seismic event trees / fault trees with correlated (common-cause) seismic failures and seismic-induced LOOP, fire, and flood combinations (IE-A6)", "Seismic Margin Assessment (SMA) as a complementary/screening evaluation where applicable"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "Seismic is CONSIDERED here but is out of scope for quantification in the internal-events PRA element; it is developed in the dedicated Seismic PRA (SPRA) element. This Step 06 record documents that the hazard was evaluated and maps the internal-events initiators it would induce. Reflecting HTGR physics, the seismically-induced loss of forced cooling by itself (circulator trip, LOOP, SCS loss) is generally benign because passive RCCS conduction/radiation cooldown bounds fuel temperature and the core rides it out. The residual seismic risk drivers, which the dedicated SPRA must address with correlated multi-failure modeling, are: (1) air ingress from a primary boundary breach coincident with a confinement/reactor-cavity structural breach that forms a chimney for graphite oxidation; (2) water/steam ingress from seismically-induced SG tube rupture, secondary-line break, or circulator/SCS cooling-water boundary failure adding moisture reactivity and oxidizing graphite; (3) loss or blockage of the RCCS / reactor cavity from structural damage or debris; and (4) spent-fuel and source-handling events under seismic loading. Because seismic is the bounding common-cause external hazard, the SPRA also treats the seismic-triggered hazard combinations (seismically-induced fire and flood, seismic + LOOP + LOFC, and seismic spent-fuel events) under IE-A6.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-7",
    name: "High winds and tornadoes (including tornado missiles)",
    description: "External hazard group covering straight-line high winds, tornadoes, and the wind-borne (tornado-generated) missiles they carry, evaluated as a single load case because the same event simultaneously damages exposed Reactor Cavity Cooling System (RCCS) air-intake/exhaust stacks and ducting (loss or blockage of the passive heat sink) and can perforate the vented low-pressure confinement and surrounding external structures, opening the breach path that, given a coincident primary helium leak, establishes a chimney for air ingress and graphite oxidation. At the Generic HTGR (prismatic-block, helium-cooled, ~350 MWth, Generic Nuclear LLC) the wind/missile load also threatens above-grade forced-cooling and support equipment (turbine hall, steam generator, feedwater, helium circulators, Shutdown Cooling System, switchyard, service water/UHS, and electrical/I&C buildings). Consistent with HTGR passive-safety physics, a wind- or missile-induced loss of forced cooling is bounded by passive RCCS conduction/radiation cooldown, so the risk-significant residual outcomes are air ingress (depressurized primary breach plus confinement/structure breach), water/steam ingress from missile rupture of external water or secondary paths, RCCS/cavity damage, and spent-fuel/source-handling events. This record documents that the hazard group was considered in the internal-events element, maps the plant-level internal-events initiators it would induce, and notes hazard combinations under IE-A6; the hazard itself is screened out of this element and quantified in the dedicated high-wind/tornado external-hazard PRA.",
    hazardType: "EXTERNAL",
    subcategory: "High winds and tornadoes (including tornado missiles)",
    severityLevels: ["Design-basis straight-line / extreme sustained winds below tornado threshold", "Design-basis tornado (DBT) wind field with associated pressure drop", "Tornado-generated missile spectrum (light, intermediate, and massive/penetrating missiles per ANSI/ANS-2.3 and Reg. Guide 1.76 / 1.221)", "Beyond-design-basis tornado / missile load (low-frequency tail)"],
    affectedAreas: ["RCCS air-intake and exhaust stacks, louvers, and external ducting (passive heat-sink boundary)", "Vented low-pressure confinement structure and external reactor-building walls/roof penetrations", "Reactor cavity and RCCS riser/header runs exposed near the confinement boundary", "Turbine / power conversion hall and main helium circulator equipment", "Steam generator, feedwater, and secondary-side piping in above-grade structures", "Shutdown Cooling System equipment and its heat exchanger", "Switchyard, offsite transmission, transformers, and non-Class 1E AC distribution", "Service-water / ultimate-heat-sink cooling towers, intake structures, and makeup water tanks", "Electrical, I&C, DC/UPS, and essential-ventilation (HVAC) building spaces", "Helium purification, inventory/pressure-control, and instrument-air systems housed above grade", "Spent / stored fuel handling, transfer, and ex-core storage areas and their cooling"],
    radionuclideBarrierIds: ["Primary helium boundary", "Confinement"],
    inducingMechanisms: ["Tornado-generated missiles strike and perforate the RCCS air-intake/exhaust stacks, louvers, or external ducting, or wind debris blocks the intakes, degrading or disabling the passive reactor-cavity heat sink (loss/blockage of the RCCS)", "Missile impact or wind pressure perforates or fails the vented low-pressure confinement and external reactor-building walls/roof, breaching the confinement barrier and creating an open structure-side flow path", "A penetrating missile that reaches exposed primary-circuit penetrations, instrument lines, or the helium purification/pressure-control connections opens a primary helium leak; combined with the structure/confinement breach this establishes the air-ingress chimney for graphite oxidation", "High wind and missile loading on the switchyard, transmission towers, and transformers causes loss of offsite power and loss of non-Class 1E AC, tripping the main helium circulator and the power conversion system and producing a general reactor trip", "Missile or wind damage to the turbine hall, circulator, steam generator, feedwater, and Shutdown Cooling System equipment causes turbine trip and loss of normal and backup forced cooling (a benign LOFC at this plant because passive RCCS conduction cooldown bounds fuel temperature)", "Wind/missile damage to service-water/UHS cooling towers, intake structures, component-cooling water, instrument/service air, vital DC/UPS, and essential HVAC defeats the support systems needed for forced cooling", "Missile rupture of external water lines, the secondary side, or makeup/storage tanks, or impact on the SCS heat exchanger, opens a water/steam path into the primary creating a moisture-ingress and positive-reactivity transient", "Missile or wind-driven debris damage to the helium purification system housed above grade defeats coolant chemistry control", "Missile impact or wind-driven debris/blackout in the fuel-handling, transfer, and ex-core storage areas causes a source-handling event or loss of cooling to spent/stored fuel"],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-07", "IE-14", "IE-15", "IE-16", "IE-17", "IE-26", "IE-27", "IE-28", "IE-29", "IE-30", "IE-31", "IE-32", "IE-33", "IE-34", "IE-35", "IE-36", "IE-37", "IE-38", "IE-39", "IE-40"],
    potentialCombinations: ["Tornado/high-wind-induced loss of offsite power coincident with loss of forced cooling (wind + LOOP + LOFC), bounded passively by the RCCS", "Tornado-missile-induced confinement/structure breach coincident with a missile-induced primary helium leak, establishing the air-ingress chimney for graphite oxidation (wind-induced primary-plus-confinement breach)", "Tornado-missile rupture of an external water line / secondary-side or makeup tank coincident with an SCS heat-exchanger breach, producing a wind-induced water/steam ingress with moisture reactivity", "Tornado-missile-induced loss or blockage of the RCCS stacks coincident with loss of all forced cooling (wind-induced loss of both the active and passive heat-removal paths)", "Tornado-missile-induced loss/blockage of the RCCS coincident with the confinement/structure breach and a primary helium leak, simultaneously defeating the passive heat sink and opening the air-ingress chimney (the bounding wind-induced HTGR combination)", "Tornado-missile impact triggering a localized fire (e.g., transformer or fuel/oil ignition) as a wind-induced fire combination in affected switchyard/turbine areas", "Tornado-missile strike on the fuel-handling building concurrent with loss of stored-fuel cooling (IE-39) and a possible confinement breach above the stored fuel, the high-wind analogue of the aircraft-impact fuel-handling combination."],
    analysisMethods: ["Dedicated external-hazard (high-wind/tornado) PRA per ASME/ANS RA-S external-hazards methodology and NUREG-1407 screening/progressive screening", "Wind and tornado hazard characterization per ANSI/ANS-2.3 (estimating tornado and extreme straight-line wind characteristics) with site wind-speed/return-period hazard curves", "Tornado-missile spectrum and design-basis wind definition per Reg. Guide 1.76 (design-basis tornado) and Reg. Guide 1.221 (design-basis hurricane/extreme wind)", "Tornado-missile generation, transport, and impact / barrier-perforation analysis (missile probability and structural penetration evaluation)", "Structural fragility and wind/missile capacity evaluation of the confinement, RCCS stacks/ducting, and SSCs, convolved with the hazard to produce conditional damage and induced-initiator frequencies", "Plant walkdowns and missile-exposure / spatial-interaction screening to identify exposed RCCS and primary-boundary targets"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "High winds and tornadoes (including tornado missiles) are an external hazard group and are out of scope for quantification in this internal-events PRA element; the hazard is screened out here (screeningStatus = SCREENED_OUT) and is developed and quantified in the dedicated high-wind / tornado external-hazard PRA element. This record only documents that the group was considered and maps the internal-events initiators it would induce. Reflecting Generic HTGR physics, a wind- or missile-induced loss of forced cooling (circulator/SG/SCS trip, LOOP, or support-system loss) is generally benign because passive RCCS conduction/radiation cooldown bounds fuel temperature and the core rides the event out, so induced LOFC is not the risk driver. The risk-significant residual outcomes that the dedicated element must resolve are: (1) air ingress, where a tornado-missile-induced confinement/external-structure breach combines with a coincident missile-induced primary helium leak to open a chimney for graphite oxidation; (2) water/steam ingress from missile rupture of external/secondary water paths or the SCS heat exchanger, adding positive reactivity and oxidizing graphite; (3) loss or blockage of the RCCS / reactor cavity from missile perforation or debris blockage of the exposed air-intake/exhaust stacks and ducting; and (4) spent-fuel / source-handling events from missile impact or loss of cooling in the fuel-handling and ex-core storage areas.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-8",
    name: "External flooding",
    description: "External flooding is a site-wide water hazard at the Generic HTGR from riverine/probable-maximum-flood overflow, local intense precipitation and roof/yard drainage, dam or levee failure, and storm surge, evaluated against the design-basis flood per ANSI/ANS-2.8. Floodwater can enter the yard, the service-water and ultimate-heat-sink intake, the switchyard, the diesel and electrical buildings, and the lower elevations of the reactor and auxiliary buildings. Unlike an LWR, the dominant concern is not submergence of forced-cooling equipment, because passive RCCS conduction and radiation from the vessel bound fuel temperature when forced cooling is lost. The genuinely risk-significant outcomes are floodwater reaching the reactor cavity and RCCS spaces, where it removes or blocks the passive heat sink, and any external-water path into an already-open primary boundary that introduces water or steam to oxidize graphite and add positive reactivity. Spent and stored fuel cooling under flood conditions is a further concern.",
    hazardType: "EXTERNAL",
    subcategory: "External flood (riverine / probable maximum flood, local intense precipitation, dam and levee failure, storm surge) per ANSI/ANS-2.8",
    severityLevels: ["Below design-basis flood (site grade not exceeded, drainage adequate)", "Design-basis flood per ANSI/ANS-2.8 (protected by flood barriers and watertight penetrations)", "Local intense precipitation / internal-drainage overload", "Beyond-design-basis flood (barrier overtopping, reactor-cavity and RCCS-space inundation, intake loss)"],
    affectedAreas: ["Site yard and grade, surface-water drainage and roof drains", "Service-water intake structure and ultimate heat sink", "Switchyard and offsite-power supply", "Standby diesel generator building and fuel-oil storage", "Electrical switchgear, battery (Class 1E DC/UPS) and I&C rooms at lower elevations", "Reactor building lower elevations, reactor cavity and RCCS air/water spaces", "RCCS heat-rejection loop and chimney/inlet-outlet pathways", "Turbine and power-conversion building", "Spent / stored fuel handling and storage building", "Helium circulator and shutdown-cooling-system support-water spaces"],
    radionuclideBarrierIds: ["TRISO coating", "Primary helium boundary", "Confinement"],
    inducingMechanisms: ["Floodwater and storm surge overtop or undermine the switchyard and offsite supply, causing loss of offsite power and de-energizing normal AC distribution, which trips the main helium circulator and the power-conversion train (benign loss of forced cooling backed by passive RCCS).", "Inundation of the standby diesel generator building, fuel-oil supply, and lower-elevation Class 1E switchgear, battery and inverter rooms causes loss of vital AC, 125 V DC, and uninterruptible instrument power, defeating active backup forced cooling and support systems.", "Flooding or debris/silt blockage of the service-water intake and ultimate heat sink, and of component-cooling-water and essential-ventilation equipment, removes the cooling support to the steam generator, feedwater, shutdown cooling, instrument air, and HVAC for the forced-cooling path.", "Floodwater entering the reactor building lower elevations reaches the reactor cavity and the RCCS air/water heat-rejection spaces, submerging or blocking RCCS inlet/outlet and the heat-rejection loop and degrading the passive heat sink (the principal HTGR-significant outcome).", "Floodwater inundates the water-lubricated helium-circulator bearing/seal support water, which communicates directly with the primary boundary across the seal interface and provides a direct flood-driven moisture-ingress route that oxidizes graphite and inserts positive moisture reactivity; an external-water path into the primary that does not require a separate tube or component failure.", "Inundation of the spent / stored fuel handling and storage building floods source-handling line-ups and the cooling support to ex-core stored fuel.", "Sudden loss of forced cooling and the resulting plant disturbance actuate the reactor protection system, producing a general reactor trip."],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-07", "IE-14", "IE-23", "IE-27", "IE-28", "IE-29", "IE-30", "IE-31", "IE-32", "IE-33", "IE-34", "IE-39"],
    potentialCombinations: ["Flood-induced loss of offsite power with concurrent loss of forced cooling (external flood + LOOP + LOFC), bounded passively by RCCS", "Flood-induced loss of forced cooling concurrent with floodwater reaching, blocking or submerging the reactor cavity and RCCS heat-rejection spaces, degrading the passive heat sink (the signature HTGR-challenging flood combination)", "Flood-induced internal flood / equipment-area inundation from failed flood barriers, watertight doors, or backflow through floor drains and penetrations", "External flood with water/steam ingress where rising water enters a concurrently open primary path or backs up the secondary/service-water side into the steam generator", "External flood coincident with the initiating severe-weather system (high wind / hurricane storm surge driving the flood and the loss of offsite power together)"],
    analysisMethods: ["ANSI/ANS-2.8 design-basis flood and probable-maximum-flood determination (riverine, local intense precipitation, dam/levee failure, storm surge/seiche)", "External flooding PRA per ASME/ANS RA-S (non-LWR / advanced-reactor PRA standard ANS RA-S-1.4) external-hazards methodology", "External-hazard screening and progressive screening (bounding flood-height and flood-frequency hazard curves) per the dedicated external-flooding PRA element", "Flood-induced equipment fragility and flood-protection-feature (barrier, watertight door, penetration seal) reliability evaluation", "RCCS / reactor-cavity flood-vulnerability and passive-heat-sink degradation assessment", "Plant walkdowns and as-built flood-path / drainage and intake-blockage assessment"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "External flooding is screened out of this internal-events PRA element and is developed in the dedicated External Flooding PRA element using ANSI/ANS-2.8 design-basis-flood characterization and the external-hazards methodology of ANS RA-S-1.4. Step 06 records only that the hazard was considered and maps the internal-events initiators it would induce. At the Generic HTGR a flood-induced loss of offsite power, loss of vital AC/DC/UPS, and loss of the service-water/ultimate-heat-sink and other forced-cooling support produce a loss of forced cooling that is benign, because passive RCCS conduction and radiation from the vessel bound fuel temperature. The residual, risk-significant concerns carried to the dedicated element are floodwater reaching and blocking or submerging the reactor cavity and RCCS heat-rejection spaces (loss of the passive heat sink), an external-water path into a concurrently open primary boundary that oxidizes graphite and inserts moisture reactivity (water/steam ingress), and flooding of spent/stored-fuel cooling and source handling. Air ingress is not a direct flood outcome and is treated where the corresponding primary-and-confinement breach hazards are developed.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-9",
    name: "Extreme ambient temperatures",
    description: "External hazard group covering extreme ambient air temperatures at the Generic HTGR site, both extreme heat and extreme cold, acting on the plant's ultimate heat sinks and on support systems. Extreme heat raises the temperature of the ambient air that is the RCCS ultimate heat sink, eroding the passive conduction/radiation cooldown margin that bounds peak TRISO fuel temperature during a loss of forced cooling, and degrades forced-cooling support systems (service water, essential HVAC, switchyard and electrical equipment ratings). Extreme cold can freeze RCCS water-loop, service-water, feedwater, and instrument/sensing lines and stress the grid. The group is screened here because it bears directly on the passive-heat-sink performance that is the HTGR's primary safety case and is quantified in the dedicated external-hazards (other external hazards / extreme ambient temperature) PRA element.",
    hazardType: "EXTERNAL",
    subcategory: "Other external hazards - extreme ambient (air) temperature (extreme heat and extreme cold)",
    severityLevels: ["Design-basis high/low ambient air temperature (within the site environmental design envelope; no safety function lost)", "Beyond-design-basis extreme heat (ambient sink temperature elevated enough to measurably erode RCCS passive cooldown margin and trip/derate forced-cooling support systems)", "Beyond-design-basis extreme/prolonged cold (sustained sub-freezing causing freeze-burst of RCCS water loop, service water, feedwater, and instrument lines)", "Extreme-temperature-coincident grid stress leading to loss of offsite power"],
    affectedAreas: ["Reactor cavity and RCCS ultimate-heat-sink path (air intakes/exhausts, ducts, and any RCCS water loop/standpipes)", "Reactor cavity cooling system water inventory and makeup (if water-cooled standpipe variant)", "Service water / cooling-water intake and cooling towers (ultimate heat sink to forced-cooling systems)", "Switchyard, offsite-power feed, and outdoor electrical equipment", "Essential HVAC and ventilation for electrical and I&C rooms", "Turbine/power-conversion and feedwater systems (secondary side)", "Helium circulator support (water-lubricated bearing/seal cooling, if applicable)", "Shutdown Cooling System heat exchanger and its cooling-water supply", "Spent/stored fuel storage and its cooling/ventilation", "Instrument, sensing, and sampling lines exposed to ambient temperature"],
    radionuclideBarrierIds: ["TRISO coating"],
    inducingMechanisms: ["Extreme heat raises the RCCS ultimate-heat-sink (ambient air) inlet temperature, reducing the conduction/radiation temperature difference from the vessel to the cavity and eroding the passive cooldown margin that bounds peak TRISO fuel temperature during any loss of forced cooling; this degrades the passive heat sink rather than directly producing a discrete trip", "Extreme heat derates or trips forced-cooling support systems at the Generic HTGR: high ambient temperature reduces service-water / cooling-tower heat-rejection capability (IE-31, IE-32), overloads essential HVAC to electrical and I&C spaces (IE-34), and pushes outdoor electrical and switchyard equipment past temperature ratings, leading to loss of non-Class 1E AC distribution (IE-27)", "Extreme-heat-driven regional grid demand and outdoor-equipment overtemperature cause loss of offsite power (IE-06 / IE-28), which trips the main helium circulator (pressurized loss of forced cooling, IE-01), trips the turbine / power conversion system (IE-05), and challenges the Shutdown Cooling System backup forced-cooling train (IE-04)", "Loss of secondary heat removal: high ambient temperature degrading the heat sink, or freeze of feedwater lines in extreme cold, causes loss of the steam generator as primary heat sink (IE-02) and loss of feedwater (IE-03); combined unavailability of circulator and SG loop gives loss of main loop heat transport (IE-14)", "Any of the above loss-of-forced-cooling or support-system perturbations actuates a protective reactor trip / scram (IE-07); for the HTGR this is benign because passive RCCS conduction/radiation then bounds fuel temperature", "Extreme prolonged cold freezes the RCCS water loop / standpipes and service-water, feedwater, and cooling-water supplies, causing loss of service water / ultimate heat sink to forced-cooling systems (IE-32), loss of reactor plant cooling water (IE-31), and loss of feedwater (IE-03)", "Freeze-burst of water lines that interface the primary system - the Shutdown Cooling System heat-exchanger cooling water (IE-26) and any water-lubricated helium-circulator bearing/seal cooling (IE-23) - can establish a water/moisture ingress path into the primary boundary, the genuinely risk-significant cold outcome because moisture oxidizes graphite and adds positive reactivity", "Freeze of instrument, sensing, and sampling lines causes loss of instrument and service air (IE-33) and can fail vital instrument readings, contributing to spurious trips (IE-07)", "Extreme cold can also stress the regional grid and freeze/ice switchyard and outdoor electrical equipment, causing loss of offsite power (IE-06 / IE-28) and the same downstream circulator and turbine trips, concurrent with the freeze-burst water-ingress damage", "Loss of cooling or ventilation to spent/stored fuel storage under extreme ambient temperature challenges the ex-core fuel storage source heat removal (IE-39)"],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-07", "IE-14", "IE-23", "IE-26", "IE-27", "IE-28", "IE-31", "IE-32", "IE-33", "IE-34", "IE-39"],
    potentialCombinations: ["Extreme heat + loss of offsite power + loss of forced cooling (high-ambient grid stress trips offsite power and the helium circulator, with the RCCS ultimate-heat-sink margin simultaneously degraded by the elevated ambient air temperature)", "Extreme cold + loss of offsite power + freeze-burst water ingress (sustained-cold grid stress and iced switchyard equipment cause LOOP and helium-circulator trip concurrent with freeze-burst of SCS heat-exchanger or circulator-bearing cooling lines driving moisture into the primary boundary)", "Extreme cold-induced internal flood / water ingress (freeze-burst of RCCS, service-water, or SCS / circulator cooling lines flooding the reactor cavity or driving moisture into the primary boundary)", "Extreme heat coincident with drought-degraded ultimate heat sink (loss of service-water / cooling-tower capability concurrent with reduced RCCS air-side margin)"],
    analysisMethods: ["ASME/ANS RA-S-1.4 non-LWR PRA standard, external-hazards (other external hazards) technical element - hazard screening and progressive screening criteria", "NUREG-1407 / ANSI-ANS-2.8-style site environmental hazard characterization for extreme maximum and minimum ambient air temperature (design-envelope exceedance frequencies)", "Site-specific extreme-temperature hazard frequency from meteorological records and extreme-value statistics", "Bounding HTGR thermal-hydraulic / passive-cooldown analysis quantifying RCCS heat-sink sensitivity (peak TRISO fuel temperature versus elevated ambient sink temperature) using the mechanistic source term framework (LMP / NEI 18-04)", "Plant-response and event-sequence quantification crediting passive RCCS conduction/radiation cooldown for induced loss-of-forced-cooling sequences"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "Out of scope for this internal-events element and developed in the dedicated external-hazards (other external hazards - extreme ambient temperature) PRA element, which characterizes the site extreme-heat and extreme-cold frequencies and quantifies plant response. The bulk of the induced initiators are losses of forced cooling and forced-cooling support systems (circulator trip, loss of SG heat sink, LOOP, loss of service water/HVAC/AC); for the Generic HTGR these are benign because passive RCCS conduction/radiation cooldown bounds peak TRISO fuel temperature without forced cooling. The residual risk-significant concerns that the dedicated element must resolve are HTGR-specific: extreme heat raising the RCCS ultimate-heat-sink (ambient air) temperature and thereby eroding the passive cooldown margin itself, and extreme cold freeze-bursting water lines that interface the primary boundary (SCS heat exchanger, circulator water-cooled bearings) to create a water/moisture ingress path that oxidizes graphite and adds positive reactivity, plus loss of cooling to the spent/stored fuel source. Only the TRISO coating barrier is challenged, and only indirectly via degraded heat-sink margin or moisture ingress; the primary helium boundary and confinement are not directly breached by ambient temperature, so no air-ingress chimney pathway is credible from this hazard alone. Screened out of internal events as hazardType EXTERNAL with screeningStatus SCREENED_OUT.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-10",
    name: "Lightning & severe weather (snow/ice loads, hail)",
    description: "External severe-weather hazard group covering lightning strikes and non-tornadic severe-weather loads (snow and ice accumulation, ice-storm/glaze loading, hail) at the Generic HTGR. The dominant effects are loss-of-offsite-power and forced-cooling transients that the passive core rides out via RCCS conduction/radiation cooldown. The group is retained as a distinct severe-weather group because snow/ice accumulation and ice-storm glaze can blanket or block the passive RCCS air intake and exhaust pathways (louvers, ducts, stacks) and can ice the service-water cooling towers, making RCCS-pathway and ultimate-heat-sink availability the focus rather than the reactor trip itself. High winds and tornado/missile loading are treated in the separate high-wind/tornado group.",
    hazardType: "EXTERNAL",
    subcategory: "Lightning and severe weather (snow/ice loads, hail)",
    severityLevels: ["Annual-exceedance hazard intensities consistent with the site climatology (lightning flash density, hail size/energy distribution)", "Design-basis snow/ice roof and structure loads and design-basis glaze (ice-storm) accretion on RCCS pathways and grid hardware", "Beyond-design-basis combined snow plus ice (glaze) loading and prolonged sub-freezing events that simultaneously load RCCS intakes/exhausts and ice the service-water cooling towers", "Direct/indirect lightning attachment to the switchyard, transmission lines, and grounded plant structures with associated surge and electromagnetic transients"],
    affectedAreas: ["Offsite power switchyard, incoming transmission lines, and grid interface", "Non-Class 1E and Class 1E AC/DC electrical distribution and I&C/instrument power affected by lightning surge", "Reactor Cavity Cooling System air intake louvers, ducts, and exhaust stacks (passive heat-sink pathway)", "Service-water ultimate-heat-sink cooling towers, intake structures, and forced-cooling support cooling water", "Rooftop and outdoor HVAC, essential ventilation intakes, and instrument-air equipment exposed to hail and ice", "Turbine/power-conversion building and main circulator/SG forced-cooling support systems fed from offsite power"],
    radionuclideBarrierIds: [],
    inducingMechanisms: ["Lightning attachment to the switchyard or incoming transmission lines, or wind/ice-storm damage to lines and insulators, opens the grid connection and produces a loss of offsite power, dropping the main helium circulator and steam-generator forced-cooling train", "Lightning surge and electromagnetic transients couple into non-Class 1E AC distribution, Class 1E DC, and vital instrument/UPS power, causing electrical bus trips, spurious protective actuations, and a general reactor trip/scram", "Ice-storm glaze and heavy snow accumulation blanket or block the RCCS air intake louvers, ducts, and exhaust stacks, degrading the passive conduction/radiation heat-sink airflow path (a degradation of the passive heat sink rather than a plant trip initiator)", "Snow/ice icing and freezing of the service-water cooling towers and intake structures degrade or remove the ultimate heat sink to the forced-cooling support systems", "Hail and ice impact damage rooftop and outdoor HVAC, essential ventilation intakes, and instrument-air components serving electrical and I&C spaces", "Loss of offsite power and loss of forced-cooling support systems propagate to circulator trip, loss of the SG primary heat sink, loss of feedwater, turbine/PCS trip, and loss of the active Shutdown Cooling System, all of which the passive RCCS cooldown bounds for fuel temperature"],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-07", "IE-14", "IE-27", "IE-28", "IE-29", "IE-30", "IE-31", "IE-32", "IE-33", "IE-34"],
    potentialCombinations: ["Lightning/severe-weather-induced loss of offsite power concurrent with loss of forced cooling (LOOP + LOFC), with the passive RCCS as the heat-sink path", "Severe-weather LOOP concurrent with degradation of the ultimate heat sink from cooling-tower icing (LOOP + loss of service-water/UHS to forced-cooling support)", "Snow/ice glaze loading that simultaneously blocks RCCS intake/exhaust pathways while a concurrent weather-induced LOOP removes forced cooling, stressing both the passive and active heat-removal paths", "Lightning-induced fire (switchyard/transformer or structure ignition from a direct strike or surge) concurrent with the lightning-induced loss of offsite power, where the resulting fire is developed as the trigger for the internal-fire (severe-weather-induced fire) combination element"],
    analysisMethods: ["ASME/ANS RA-S-1.4 external-hazards screening and analysis (PRA-Standard severe-weather treatment)", "NUREG-1407 / Generic Letter 88-20 Supplement 4 IPEEE other-external-events screening (lightning, snow/ice, hail) using progressive screening criteria", "ANSI/ANS-2.3 and site-specific extreme-weather/meteorological hazard frequency characterization (lightning flash density, snow/ice load, glaze accretion, hail)", "ASCE 7 snow, ice (glaze), and atmospheric-icing load characterization for RCCS pathway and structure loading", "Bounding/conservative screening analysis of RCCS intake-exhaust blockage and ultimate-heat-sink availability under design and beyond-design snow/ice loads"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "Out of scope for this internal-events PRA element and quantified in the dedicated external-hazards (severe-weather: lightning, snow/ice, hail) PRA element; it is recorded here only as CONSIDERED, with its induced plant-level initiators mapped to the internal-events set. Per Generic HTGR physics, the loss-of-offsite-power and forced-cooling transients this hazard induces are benign because passive RCCS conduction/radiation cooldown bounds fuel temperature, so the induced LOFC is rideable. This severe-weather group does not by itself create a depressurizing primary breach, a confinement/structure chimney for graphite air ingress, or a water/steam ingress path, so no radionuclide barrier is directly challenged. The residual concern carried to the dedicated element is availability of the passive heat-removal pathway, specifically snow/ice glaze blockage or blanketing of the RCCS intake/exhaust louvers and stacks and icing of the service-water ultimate heat sink, evaluated as RCCS-cavity/pathway and UHS availability rather than as a reactor-trip initiator.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-11",
    name: "Aircraft impact",
    description: "A high-energy external impact from a fixed-wing aircraft (commercial or military) or large air-vehicle crash onto the Generic HTGR reactor building, RCCS air-intake/exhaust structures, helium-handling building, or fuel-handling/spent-fuel area, including the kinetic structural load, secondary engine/landing-gear missiles, and the accompanying aviation-fuel (hydrocarbon) fire. The hazard is treated separately from wind-borne and turbine missiles because a single event can simultaneously breach the helium primary boundary, breach the low-pressure vented confinement, damage the Reactor Cavity Cooling System (RCCS) and reactor-cavity structure, and add a sustained hydrocarbon fire, uniquely producing the breach-plus-chimney-plus-heat condition that drives graphite oxidation and air ingress.",
    hazardType: "EXTERNAL",
    subcategory: "Aircraft impact (external man-made impact and fire)",
    severityLevels: ["Glancing impact or small-aircraft crash: localized structural damage to outbuildings, switchyard, or air intakes without primary-boundary breach; loss of forced cooling and offsite power, core rides out the transient passively on RCCS conduction/radiation cooldown", "Large-aircraft impact on the reactor building: breach of the helium primary boundary at a range of sizes with simultaneous confinement and RCCS-structure damage, depressurized loss of forced cooling", "Large-aircraft impact plus sustained aviation-fuel fire: primary breach plus a confinement and RCCS-cavity opening that establishes a chimney, with the hydrocarbon fire supplying heat and an air pathway for graphite oxidation and air ingress (the bounding risk-significant outcome)", "Impact on the fuel-handling building or spent-fuel store: direct mechanical damage to in-vessel or ex-core fuel-handling source paths and loss of cooling to stored fuel"],
    affectedAreas: ["Reactor building and helium primary pressure boundary", "Low-pressure vented confinement structure and penetrations", "RCCS air intake/exhaust stacks, RCCS piping, and the reactor cavity", "Steam generator, main helium circulator, and power-conversion building", "Helium purification, helium inventory and pressure-control, and shutdown-cooling buildings", "Switchyard, offsite-power lines, and onsite Class 1E and non-Class 1E electrical distribution", "Support-system structures (component cooling water, service water/ultimate heat sink, instrument and service air, essential HVAC)", "Fuel-handling building and spent/stored-fuel storage"],
    radionuclideBarrierIds: ["TRISO coating", "Primary helium boundary", "Confinement"],
    inducingMechanisms: ["Direct kinetic impact and secondary engine/gear missiles puncture the helium primary pressure boundary, producing a small, moderate, or large depressurizing breach (depressurized loss of forced cooling)", "The same impact also tears the low-pressure vented confinement and shears RCCS intake/exhaust stacks or cavity structure, so a primary breach is paired with a confinement and RCCS-structure opening that establishes a chimney for air ingress and graphite oxidation; the aviation-fuel fire supplies the heat and draught", "Impact load and vibration sever or jam primary relief and safety-valve lines, leaving a stuck-open primary relief path", "Impact and shock to the steam generator and secondary piping rupture SG tubes and secondary water/steam lines, driving water/steam ingress into the primary circuit with positive moisture reactivity and graphite oxidation", "Mechanical disruption of the main helium circulator, steam generator, and feedwater trains trips forced cooling and the primary heat sink; the active Shutdown Cooling System and its heat exchanger are damaged in the same footprint", "Severance of the switchyard and offsite-power lines and collapse of onsite electrical structures cause loss of offsite power and loss of Class 1E DC, vital UPS, and non-Class 1E AC distribution", "Impact damage to component cooling water, service water/ultimate heat sink, instrument and service air, and essential HVAC structures removes the support systems for the forced-cooling and I&C trains", "Rupture of helium purification, helium inventory and pressure-control, instrument-line, and purification-line penetrations causes interfacing-system breaches and small primary depressurizations outside the main boundary, and loss of coolant-chemistry and inventory/makeup control", "Impact on the fuel-handling building or spent-fuel store mechanically disrupts an in-progress in-vessel or ex-core fuel-handling source path and removes cooling from stored fuel"],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-07", "IE-11", "IE-13", "IE-14", "IE-15", "IE-16", "IE-17", "IE-18", "IE-19", "IE-20", "IE-21", "IE-22", "IE-23", "IE-24", "IE-25", "IE-26", "IE-27", "IE-28", "IE-29", "IE-30", "IE-31", "IE-32", "IE-33", "IE-34", "IE-35", "IE-36", "IE-37", "IE-38", "IE-39", "IE-40"],
    potentialCombinations: ["Aircraft-impact-induced hydrocarbon fire\nThe aviation-fuel load delivered by the impact ignites a sustained pool/spray fire over the reactor or support buildings, so the impact directly triggers a fire hazard that is itself developed in the fire PRA element.", "Aircraft-impact-induced air-ingress chimney (primary breach plus confinement/RCCS breach plus heat)\nA single impact opens the helium primary boundary, the vented confinement, and the RCCS/cavity structure together, and the fuel fire supplies heat and draught, establishing the breach-plus-chimney-plus-heat condition that drives graphite oxidation and air ingress; this is the bounding combination that justifies separating aircraft impact from wind-borne and turbine missiles.", "Aircraft impact plus loss of offsite power plus loss of forced cooling\nImpact severs offsite-power lines and trips the circulator, steam generator, and Shutdown Cooling System in one footprint, combining LOOP with a depressurized loss of forced cooling.", "Aircraft-impact-induced steam/secondary-line break with water/steam ingress\nShock and missiles rupture SG tubes and secondary water/steam lines, adding a moisture/positive-reactivity and graphite-oxidation path concurrent with the structural damage.", "Aircraft-impact-induced internal flood\nSevered service-water, feedwater, or fire-protection lines from the impact flood the reactor cavity or support spaces, triggering an internal-flood hazard concurrent with the impact.", "Aircraft impact on the fuel-handling building plus loss of spent-fuel cooling concurrent with confinement breach\nA strike on the fuel-handling building or spent-fuel store simultaneously disrupts an in-progress fuel-handling source path, removes cooling from stored fuel, and breaches the confinement above it, combining a fuel-handling/spent-fuel source event with a confinement-bypass release path."],
    analysisMethods: ["NEI 07-13 aircraft impact assessment methodology", "10 CFR 50.150 aircraft impact assessment for new reactors", "Structural impact and local/global response analysis (missile penetration, perforation, and scabbing; Riera force-time impact loading)", "Hydrocarbon (aviation-fuel) fire effects analysis drawing on NUREG/CR-6850 (EPRI 1011989) fire-PRA methods for the fuel-fire portion", "External-events screening and bounding-frequency analysis per ASME/ANS RA-S-1.4 (external-hazards PRA) and the NEI 18-04 / RG 1.233 licensing-modernization framework", "Air-ingress and graphite-oxidation consequence analysis for the breach-plus-chimney condition"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "Aircraft impact is an external hazard and is out of scope for this internal-events PRA element; its frequency and consequences are developed in the dedicated aircraft-impact (external-hazards) PRA element, with the accompanying aviation-fuel fire carried in the fire PRA element and any induced flooding in the internal/external flood element, and the resulting hazard-induced frequencies are imported back here under IE-N-12. Step 06 records only that the hazard was considered and maps the plant-level initiators it would induce from the internal-events set. Reflecting HTGR physics, an impact that merely trips forced cooling (circulator, steam generator, feedwater, Shutdown Cooling System) or causes LOOP is benign because passive RCCS conduction and radiation cooldown bounds fuel temperature and the core rides out the loss of forced cooling without TRISO failure; therefore the residual risk-significant outcomes that the dedicated element must quantify are (1) air ingress from a depressurizing primary breach combined with a confinement and RCCS-structure breach that establishes a chimney for graphite oxidation, aggravated by the hydrocarbon fire, (2) water/steam ingress from impact-induced SG tube and secondary-line rupture adding positive moisture reactivity and graphite oxidation, (3) loss or blockage of the RCCS and reactor cavity from impact and fire damage in the cavity, and (4) spent-fuel and fuel-handling source events when the impact strikes the fuel-handling building or stored-fuel area. The hazard is therefore SCREENED_OUT of the internal-events element with this basis.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-12",
    name: "External fire / wildfire",
    description: "Site-boundary external fire or wildfire at the Generic HTGR: a combustion event originating outside plant structures (vegetation/wildland fire, nearby industrial or transformer/switchyard fire, or fire involving outdoor fuel/oil storage) whose smoke, combustion products, radiant and convective thermal load, and ember/firebrand transport challenge exposed site systems. The HTGR-specific concern is fouling and oxygen-depletion of the Reactor Cavity Cooling System (RCCS) air intakes, which degrades the passive decay-heat sink, combined with thermal and fire damage to the outdoor switchyard, transformers, transmission corridor, ultimate-heat-sink and service-water equipment, and intake/exhaust ventilation paths. It is retained as a distinct site-boundary fire hazard separate from internal (in-plant) fire because the initiating combustible source, the smoke/intake-fouling mechanism, and the simultaneous radiant-plus-LOOP loading are external in origin.",
    hazardType: "EXTERNAL",
    subcategory: "External fire / wildland (wildfire) hazard",
    severityLevels: ["Local / nuisance smoke event: partial intake fouling and reduced visibility, no loss of offsite power, forced cooling and RCCS intakes remain within design margin", "Design-basis external fire: wildland or adjacent-facility fire at the exclusion-area boundary producing sustained radiant/thermal loading, heavy smoke ingress to ventilation and RCCS intakes, and loss of offsite power from switchyard/transmission-line damage", "Beyond-design-basis conflagration: large fast-moving wildfire fully engulfing the site perimeter with prolonged radiant heat, dense smoke and oxygen depletion across all RCCS air intakes, multi-train damage to outdoor switchyard, transformers and ultimate-heat-sink equipment, and extended loss of offsite power"],
    affectedAreas: ["Reactor Cavity Cooling System (RCCS) air intake and exhaust stacks / louvers", "Reactor cavity passive heat-removal flow path", "Outdoor switchyard, main and station-service transformers, and offsite transmission corridor", "Ultimate heat sink, service-water intake structure, and cooling-tower / heat-exchanger area", "Plant ventilation and essential HVAC outdoor air intakes and filtration", "Turbine / power-conversion and feedwater systems exposed at building exterior", "Outdoor and yard portions of normal AC, Class 1E DC, and instrument/service-air support systems", "Ex-core / spent-fuel storage building cooling and ventilation support", "Site exclusion-area boundary, access roads, and outdoor fuel/oil storage"],
    radionuclideBarrierIds: ["Confinement"],
    inducingMechanisms: ["Wildland or adjacent-facility fire produces dense smoke and combustion products that foul, partially block, and oxygen-deplete the RCCS air intakes/louvers, degrading the passive natural-circulation decay-heat sink from the reactor cavity (HTGR-specific heat-removal challenge; does not by itself breach any barrier).", "Radiant and convective thermal loading plus ember/firebrand transport damages the outdoor switchyard, main and station-service transformers, and the offsite transmission corridor, causing loss of offsite power (IE-06 / IE-28) and the dependent electrical cascade.", "Loss of offsite power and switchyard damage trip the main helium circulator and the power-conversion train, producing a pressurized loss of forced cooling (IE-01), turbine/PCS trip (IE-05), general reactor trip (IE-07), and loss of the main loop heat transport (IE-14).", "Fire and thermal damage to feedwater and secondary heat-removal equipment, and loss of the steam-generator heat sink following turbine/feedwater isolation, cause loss of primary heat sink (IE-02) and loss of feedwater (IE-03).", "Loss of normal AC distribution from transformer/switchyard fire (IE-27) and consequential challenge to the Class 1E 125 V DC battery chargers and vital uninterruptible instrument power (IE-29, IE-30) on extended loss of charging.", "Thermal/fire damage and intake fouling at the ultimate-heat-sink and service-water intake structure degrade or fail service water to the active forced-cooling systems (IE-32) and reactor-plant/component cooling water (IE-31), and disable the active Shutdown Cooling System backup (IE-04).", "Smoke and heat loading on outdoor air intakes and yard equipment challenge essential HVAC/ventilation to electrical and I&C spaces (IE-34) and the instrument-and-service-air supply (IE-33).", "Fire damage or loss of cooling/ventilation support to the ex-core spent-/stored-fuel storage building defeats cooling to the spent-fuel and ex-core fuel storage source (IE-39)."],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-07", "IE-14", "IE-27", "IE-28", "IE-29", "IE-30", "IE-31", "IE-32", "IE-33", "IE-34", "IE-39"],
    potentialCombinations: ["External fire / wildfire concurrent with loss of offsite power and pressurized loss of forced cooling (wildfire-induced LOOP + P-LOFC), with simultaneous RCCS air-intake smoke fouling degrading the passive heat sink", "External fire / wildfire concurrent with loss of the ultimate heat sink / service-water intake (wildfire damage to the intake structure coincident with loss of forced cooling)", "External fire / wildfire as an aggravating concurrent hazard to a high-wind / extreme-wind event (wind-driven wildfire spread with simultaneous wind loading and LOOP)", "External fire / wildfire concurrent with loss of cooling/ventilation to the ex-core spent-/stored-fuel storage source (wildfire-induced loss of spent-fuel cooling coincident with LOOP)"],
    analysisMethods: ["Dedicated external-hazard PRA element screening and bounding analysis per ASME/ANS RA-S-1.4 (Non-LWR Advanced Reactor PRA Standard), external-flooding/external-events high-level requirements adapted for external fire", "External-hazard identification and screening per ANSI/ANS-2.27 and the NRC SRP/Reg-Guide external-events framework (proximity, frequency-of-occurrence, and consequence screening against the exclusion-area boundary)", "Wildland-fire hazard characterization using site-specific fuel-load, fire-spread, and fire-weather modeling, with defensible-space / firebreak credit and smoke / combustion-product intake-fouling evaluation for the RCCS air intakes", "External fire-induced loss-of-offsite-power and switchyard/transmission vulnerability assessment feeding the internal-events and LOOP event-sequence models", "Fire-PRA structural and equipment thermal-response analysis (NUREG/CR-6850 / NUREG-2178 methods adapted to external radiant and smoke loading) for exposed outdoor structures and the ultimate heat sink"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "External fire / wildfire is out of scope for this internal-events PRA element and is developed in the dedicated external-fire / external-events hazard PRA element; it is recorded here only as CONSIDERED, with its induced plant-level initiators mapped back to the internal-events initiator set. Per ASME/ANS RA-S-1.4, hazard groups are screened from the internal-events element and quantified in their own elements, so this record carries screeningStatus SCREENED_OUT with the basis pointing to that dedicated element. The HTGR passive-cooling physics shape the residual concern: a wildfire-induced loss of offsite power and loss of forced cooling is largely benign because the core rides out the transient on passive RCCS conduction/radiation cooldown that bounds fuel temperature without forced flow, so induced LOFC/LOOP alone is not the risk driver. The genuinely risk-significant outcomes the dedicated element must address are HTGR-specific: degradation or blockage of the RCCS / reactor-cavity heat sink from smoke fouling and oxygen depletion of the air intakes (the passive heat sink the design relies on), and damage to or loss of cooling of the ex-core spent-/stored-fuel source. External fire does not mechanically breach the helium pressure boundary and the RCCS intakes feed the reactor cavity rather than the primary circuit, so it does not on its own create the depressurizing-breach-plus-confinement-breach chimney needed for graphite-oxidizing air ingress, and it introduces no water/steam ingress path; those mechanisms are therefore not credited for this hazard. Confinement is listed as the only challenged barrier because heavy smoke/combustion-product loading challenges the vented low-pressure confinement ventilation and filtration function, while TRISO coatings and the helium pressure boundary are not directly challenged by an external fire.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-13",
    name: "Nearby industrial / transportation hazardous-material release and explosion",
    description: "External man-made hazard group covering an off-site explosion (high-pressure gas or hazardous-liquid pipeline, rail tank car, road tanker, or an adjacent fixed industrial facility) and the associated release of a toxic, asphyxiant, or flammable vapor cloud, screened per Reg Guide 1.91 (explosions) and Reg Guide 1.78 (control-room habitability / hazardous chemical release). The hazard delivers two coupled loads to the Generic HTGR: (1) an external blast overpressure plus blast-generated missiles that can deform or breach reactor-building, confinement, and Reactor Cavity Cooling System (RCCS) structures and rupture exposed primary and secondary pressure boundaries; and (2) a toxic or oxygen-displacing cloud, or a flammable cloud that may deflagrate, that is drawn into RCCS air intakes, control-room and switchgear HVAC intakes, and other plant air paths, degrading operator habitability and the quality of the RCCS ultimate-heat-sink air. Because the plant sits within standoff distances of public transportation corridors and any neighboring chemical/industrial plant, this is treated as a standalone external man-made hazard group rather than rolled into fire or internal events.",
    hazardType: "EXTERNAL",
    subcategory: "Man-made external hazard: off-site explosion, blast / missile, and hazardous-material (toxic, asphyxiant, flammable) cloud release",
    severityLevels: ["Below screening threshold: peak incident overpressure at safety-related structures below the 1 psi Reg Guide 1.91 screening value and toxic concentration at intakes below Reg Guide 1.78 / Reg Guide 1.95 toxicity limits, with the source beyond credible standoff distance", "Design-basis range: overpressure at or above 1 psi but within the demonstrated structural capacity of the reactor building, confinement, and RCCS cavity, or a detectable toxic/asphyxiant cloud reaching intakes that is bounded by control-room isolation and self-contained breathing apparatus credit", "Beyond-design-basis: high-yield close-in detonation or large flammable-cloud deflagration producing blast/missile damage that breaches the primary helium boundary together with confinement and RCCS-cavity structure, or a dense toxic/asphyxiant cloud that defeats control-room isolation and forces abandonment, removing operator action and degrading the passive air heat sink"],
    affectedAreas: ["Reactor building and vented low-pressure confinement structure", "Reactor cavity and RCCS air intakes, ducts, riser panels, and exhaust stacks", "Reactor cavity / RCCS standpipe and ultimate-heat-sink air path", "Main control room and its HVAC / outside-air intakes", "Switchyard, offsite-power transmission corridor, and transformer yard", "Turbine / power-conversion building, steam generator, and feedwater/secondary piping runs", "Helium purification, helium inventory and pressure-control, and instrument-penetration lines exposed outside the primary boundary", "Spent / stored fuel block storage and ex-core fuel handling area and its cooling support", "Class 1E and non-Class 1E electrical, DC, UPS, plant cooling water, service water, instrument/service air, and HVAC support spaces", "Site standoff zones along adjacent pipeline, rail, road, and neighboring-facility boundaries"],
    radionuclideBarrierIds: ["TRISO coating", "Primary helium boundary", "Confinement"],
    inducingMechanisms: ["External blast overpressure and blast-generated missiles strike the switchyard, transmission corridor, and transformer yard, collapsing offsite power and tripping non-Class 1E AC distribution; this trips the main helium circulator and turbine/PCS and forces a reactor trip, producing a pressurized loss of forced cooling that the passive RCCS conduction/radiation cooldown then bounds", "Blast and missile damage to the turbine building, steam generator, and feedwater/secondary piping removes the normal primary heat sink and feedwater and disables the main heat-transport loop and the active Shutdown Cooling System, leaving decay-heat removal to the passive RCCS path", "Blast or missile impact deforms or punctures the exposed primary helium pressure boundary (vessel penetrations, cross-vessel/duct, coaxial piping) producing primary leaks across the small-to-large depressurization spectrum, or jolts a primary relief/safety valve open, depressurizing the primary and driving a depressurized loss of forced cooling", "Blast/missile impact ruptures small connected lines that penetrate the primary boundary, namely helium purification, helium inventory/pressure-control, and instrument penetrations, giving a small primary depressurization outside the main boundary and loss of coolant-chemistry control", "Combined blast breach of the primary helium boundary AND of the confinement / RCCS-cavity structure establishes an open chimney geometry that admits air to the hot graphite core and reflector, initiating air ingress and graphite oxidation, the dominant HTGR risk outcome for this hazard", "Blast rupture of the steam generator or feedwater/secondary piping that communicates with the primary heat-exchanger boundary admits water or steam into the helium circuit, adding positive moisture reactivity and oxidizing graphite (water/steam-ingress chain)", "Toxic, asphyxiant, or flammable cloud is drawn into RCCS air intakes and the reactor-cavity ultimate-heat-sink air path, degrading or, for a dense asphyxiant/combustion-product cloud, locally blocking the quality and density of the passive heat-sink air at the intakes", "Toxic or O2-displacing cloud drawn into control-room and switchgear HVAC intakes degrades operator habitability, threatening manual actions and forcing reliance on control-room isolation and breathing apparatus, and can disable essential ventilation to electrical and I&C spaces", "Blast/missile and intake fouling defeat plant support systems (Class 1E 125 V DC, vital UPS/instrument power, reactor plant cooling water, service water / ultimate heat sink to forced-cooling systems, instrument and service air, helium purification), degrading the active forced-cooling and chemistry-control trains while the passive RCCS path remains the credited heat sink", "Blast/missile damage to spent / stored fuel block storage and to its cooling and ventilation support degrades cooling of the ex-core fuel source, and blast/missile disturbance during in-vessel or ex-vessel fuel handling can drop or displace a fuel/source line-up, causing a fuel-handling event"],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-07", "IE-14", "IE-15", "IE-16", "IE-17", "IE-18", "IE-13", "IE-19", "IE-21", "IE-22", "IE-24", "IE-25", "IE-27", "IE-28", "IE-29", "IE-30", "IE-31", "IE-32", "IE-33", "IE-34", "IE-35", "IE-36", "IE-37", "IE-38", "IE-39", "IE-40"],
    potentialCombinations: ["Explosion-induced air ingress: blast/missile breach of the primary helium boundary concurrent with breach of confinement and the RCCS-cavity structure, establishing a chimney for graphite oxidation (IE-A6 combination of IE-17 large primary break + confinement/structure breach)", "Explosion-induced water/steam ingress: blast rupture of the steam generator or secondary/feedwater piping into the primary heat-exchanger boundary (IE-A6 combination of structural blast damage + IE-19 / IE-22 moisture ingress)", "Explosion + loss of offsite power + loss of forced cooling: blast damage to the switchyard and transmission corridor coincident with circulator/PCS trip (IE-A6 combination of IE-28 LOOP + IE-01/IE-14 loss of forced cooling)", "Explosion-induced fire / deflagration: ignition of a flammable released cloud or of blast-damaged plant equipment producing a concurrent on-site fire load that loads the dedicated fire PRA", "Toxic/asphyxiant cloud + operator loss: hazardous-material intrusion at control-room intakes coincident with a blast-induced transient, degrading operator action while a plant initiator is in progress"],
    analysisMethods: ["Reg Guide 1.91 evaluation of explosions on plant structures (1 psi overpressure screening distance, blast-yield and standoff modeling for pipelines, rail, road, and adjacent facilities)", "Reg Guide 1.78 / Reg Guide 1.95 control-room habitability analysis for accidental release of toxic and hazardous chemicals (atmospheric dispersion to intakes, isolation and breathing-apparatus credit)", "NUREG-0800 Standard Review Plan Sections 2.2.1-2.2.3 (nearby industrial, transportation, and military facility hazards) and 3.5.1.6 (external missiles)", "Probabilistic external man-made hazard screening and frequency-consequence quantification per the external-hazards methodology of ASME/ANS RA-S-1.4 / the Advanced Non-LWR PRA standard (probability of explosion event x conditional structural/intake damage)", "Blast-load structural fragility and missile-impact assessment of the reactor building, confinement, and RCCS cavity, with HTGR air-ingress and graphite-oxidation consequence analysis for the breach combination"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "This off-site explosion and hazardous-material release hazard group is out of scope for the internal-events PRA element. It is recorded here only as CONSIDERED and is screened out (screeningStatus = SCREENED_OUT) of internal events; the blast/missile, toxic-cloud, and explosion-induced fire loads are developed and quantified in the dedicated external man-made hazards element (nearby industrial and transportation hazard analysis per Reg Guide 1.91 and Reg Guide 1.78), with explosion-induced fire passed to the fire PRA element. The mapped initiators above show that most explosion-induced outcomes funnel into a loss of forced cooling (circulator/PCS/SCS trip, LOOP, loss of support systems); for the Generic HTGR these are generally benign because passive RCCS conduction and radiation from the vessel bound fuel temperature and the core rides out the loss of forced cooling without fuel damage. The residual risk-significant outcomes that the dedicated element must quantify are therefore the HTGR-specific ones: (1) air ingress, where a blast breach of the primary helium boundary occurs together with a breach of confinement and the RCCS cavity, opening a chimney for graphite oxidation; (2) water/steam ingress, where blast rupture of the steam generator or secondary piping admits moisture to the primary, adding positive reactivity and oxidizing graphite; (3) loss or intake blockage of the RCCS / reactor cavity from blast, missiles, or a dense asphyxiant/combustion cloud fouling the passive ultimate-heat-sink air path; (4) degradation of operator action and control-room habitability from a toxic/asphyxiant cloud; and (5) spent / stored fuel and in-vessel or ex-vessel source-handling events under blast or release. The internal-events element credits no defense against these external loads, so the hazard group is fully transferred to the dedicated external man-made hazards element.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-14",
    name: "Turbine-generated missiles (main turbine-generator overspeed burst / rotating-machinery fragments)",
    description: "On-site plant-centered external hazard: a destructive overspeed burst or ductile/brittle failure of the high-speed main turbine-generator rotor (and other large rotating machinery) ejects high-energy metal fragments. At the Generic HTGR, a steam/direct-cycle plant with a high-speed turbine-generator in the turbine hall adjacent to the reactor/confinement building, both high-trajectory (roof-penetrating) and low-trajectory (in-plane, building-wall) fragments are credible. The risk-defining concern is a low-trajectory fragment that strikes the reactor/confinement building and simultaneously breaches the vented low-pressure confinement, punctures the helium primary pressure boundary (vessel, cross-vessel duct, or a primary nozzle), and damages the Reactor Cavity Cooling System / reactor-cavity structure, establishing the depressurization-plus-confinement-breach chimney that drives graphite oxidation (air ingress). Fragments can alternatively sever steam, feedwater, or steam-generator pressure parts to open a water/steam-ingress path, and the originating burst is itself a turbine trip with attendant loss of the power-conversion system and likely loss of offsite power.",
    hazardType: "EXTERNAL",
    subcategory: "Plant-centered man-made hazard - rotating-machinery (turbine) missiles",
    severityLevels: ["Contained burst - casing arrests fragments; bounded by an ordinary turbine trip / loss of power conversion with no missile escaping the turbine hall (IE-05, possible IE-28 LOOP)", "Low-energy / arrested escaping fragment - perforates turbine-hall structures and adjacent secondary piping (feedwater, condensate, service water) but does not reach the reactor/confinement building; produces support-system and heat-sink losses plus secondary fire/flood", "High-energy low-trajectory fragment striking the reactor/confinement building - simultaneous confinement breach + helium primary-boundary puncture + RCCS/cavity damage establishing an air-ingress chimney (depressurized loss of forced cooling with structure breach)", "Beyond-design-basis multiple-fragment burst - combined primary depressurization, steam/feedwater-line and steam-generator breach (water/steam ingress), RCCS loss, and a co-incident turbine-hall fire/flood"],
    affectedAreas: ["Turbine hall / power-conversion building (rotor burst origin, lube-oil and hydrogen-cooled generator systems)", "Reactor / confinement building shell and roof (low- and high-trajectory fragment targets)", "Reactor cavity and Reactor Cavity Cooling System (RCCS) ducts, panels, and cavity structure", "Helium primary pressure boundary - reactor vessel, cross-vessel duct, primary nozzles and penetrations", "Steam generator, main steam and feedwater lines, and condensate runs in the fragment trajectory", "Main helium circulator, Shutdown Cooling System, and their support trains (RPCW, service water, instrument air, normal AC) where co-located on the impact path", "Switchyard / main-generator-to-grid connection and normal-AC distribution"],
    radionuclideBarrierIds: ["TRISO coating", "Primary helium boundary", "Confinement"],
    inducingMechanisms: ["Rotor overspeed (loss of speed control on load rejection / governor or overspeed-trip failure) or material defect causes the turbine-generator disc/rotor to burst, ejecting high-energy fragments from the turbine hall - the burst is itself a turbine trip and loss of the power-conversion system, and a hydrogen-cooled generator failure or lube-oil release seeds a turbine-hall fire", "A low-trajectory fragment perforates the reactor/confinement building wall and punctures the reactor vessel / cross-vessel duct / a primary nozzle, producing a large rapid primary depressurization while at the same instant breaching the vented confinement - the simultaneous primary-boundary opening plus confinement opening creates the buoyancy-driven chimney for air ingress and graphite oxidation; smaller or glancing fragment penetrations give moderate or small primary leaks", "A fragment trajectory through the reactor cavity shears or crushes RCCS ducts, panels, or cavity structure, degrading or blocking the passive decay-heat path coincident with the loss of forced cooling and the structure breach", "A fragment severs or ruptures main steam, feedwater, or steam-generator pressure parts (tubes/headers), admitting secondary water/steam into the primary helium circuit - a moisture-reactivity insertion in the undermoderated core plus graphite/fuel oxidation, with the primary pressure rise lifting the safety-relief valves", "Fragment impact on the main helium circulator, the Shutdown Cooling System, or their support trains (reactor plant cooling water, service water / ultimate heat sink, instrument and service air, normal non-Class-1E AC) disables forced cooling and heat-sink/feedwater paths", "The generator burst and switchyard/grid-connection damage cause a unit trip and loss of offsite power with loss of normal AC distribution", "A fragment rupturing feedwater, condensate, or service-water lines floods the turbine hall and adjacent rooms, a secondary internal flood from the same initiating impact"],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-13", "IE-14", "IE-15", "IE-16", "IE-17", "IE-19", "IE-20", "IE-21", "IE-22", "IE-27", "IE-28", "IE-31", "IE-32", "IE-33"],
    potentialCombinations: ["Turbine-missile-induced turbine-hall fire (lube-oil ignition / hydrogen-cooled generator failure) concurrent with the loss of power conversion and support systems", "Turbine-missile-induced internal flood from severed feedwater / condensate / service-water lines coincident with the impact", "Turbine missile + loss of offsite power + loss of forced cooling (low-trajectory fragment trips the unit, disables the circulator/SCS, and damages normal AC / the grid connection)", "Turbine-missile-induced primary depressurization with simultaneous confinement breach and RCCS/cavity damage producing the air-ingress chimney (combined primary-boundary + confinement + structure breach)", "Turbine-missile-induced steam/feedwater-line or steam-generator break with primary water/steam ingress (moisture reactivity insertion plus graphite oxidation)", "Beyond-design-basis multiple-fragment burst producing concurrent primary depressurization/air-ingress (primary-boundary + confinement + RCCS breach) and steam/feedwater/steam-generator water/steam ingress in the same event"],
    analysisMethods: ["NUREG-1407 / NUREG/CR-2300 plant-centered external-event (turbine-missile) screening and probabilistic methodology", "ANSI/ANS-58.21 external-events PRA process for man-made / plant-centered hazards", "Turbine-missile generation-strike-damage probability chain P1 x P2 x P3 (rotor-burst frequency x fragment-ejection/strike probability x barrier-penetration/damage probability), per NUREG-0800 SRP 3.5.1.3 and the turbine-missile probability guidance (e.g. the 1E-4 unacceptable-damage-frequency target)", "Fragment-trajectory and ballistic-penetration analysis against confinement, vessel, cross-vessel, and RCCS targets, with overspeed-failure-frequency and disc-integrity data", "Mapping of damaged SSCs to the internal-events initiator set and event trees (air-ingress and water-ingress sequences), with HTGR-specific passive-RCCS and graphite-oxidation consequence analysis in the dedicated hazard element"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "Turbine-generated missiles are an external (plant-centered, man-made) hazard and are out of scope for this internal-events PRA element; they are screened out here and developed in the dedicated external-events / plant-centered-hazards PRA element, which performs the turbine-missile generation-strike-damage probability analysis and fragment-trajectory study and quantifies the induced sequences. Step 06 records only that the hazard was considered and that, were the dedicated element to retain it, it would feed the internal-events initiators listed (a turbine trip and likely LOOP with loss of forced cooling, primary depressurization, water/steam ingress, and support-system losses) into the existing event-sequence models. The HTGR physics shapes the residual concern: a turbine-missile-induced loss of forced cooling alone is benign because passive RCCS conduction/radiation cooldown bounds fuel temperature, so an induced circulator/SCS/heat-sink trip rides out passively. The genuinely risk-significant turbine-missile outcomes are the impact chains that open barriers - a low-trajectory fragment that simultaneously breaches the confinement and the helium primary boundary while damaging the RCCS/cavity to establish the air-ingress chimney (graphite oxidation), and a fragment that opens a steam/feedwater/steam-generator water/steam-ingress path (positive reactivity in the undermoderated core plus graphite oxidation). This hazard is not bounded by the aircraft-impact group (different fragment orientation, energy spectrum, and probability basis - an in-plane rotating-machinery burst versus an aerial strike) and is distinct from the off-site man-made explosion/missile group, which scopes off-site blast, missiles, and toxic clouds rather than on-site rotating-machinery fragments.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
  {
    uuid: "HAZ-15",
    name: "Non-vibratory geotechnical / soil hazards",
    description: "External non-seismic geotechnical and soil hazards acting on the Generic HTGR site independent of any earthquake: slope instability and landslide, ground subsidence (including mining or karst/solution-cavity collapse and groundwater-withdrawal subsidence), soil liquefaction and the differential settlement it drives, and expansive or collapsing soils that swell, shrink, or hydro-collapse under and around foundations. These are quasi-static or slow-onset ground-deformation mechanisms (settlement, heave, lateral spread, subsidence) plus the dynamic case of a landslide or debris flow impacting site structures. They are treated as a category distinct from seismic vibratory ground motion: the seismic group scopes only vibratory shaking and seismically-induced failures, so a stand-alone slope failure, a non-seismic subsidence or liquefaction event, an expansive-soil heave, or a collapsing-soil settlement is not captured there and must be considered here. For an HTGR the safety relevance is geometric: differential settlement or subsidence beneath the reactor cavity and the Reactor Cavity Cooling System (RCCS) structure can distort the cavity geometry and the RCCS standpipe/riser/duct alignment that constitutes the passive heat sink, and slope or soil failure can shear the buried service-water / ultimate-heat-sink path and underground electrical duct banks, all without an earthquake. Because passive RCCS conduction and radiation cooldown bounds fuel temperature, a geotechnically-induced loss of forced cooling is generally benign; the risk-significant outcomes are instead distortion of the cavity/RCCS passive heat sink, a depressurized primary breach combined with a confinement/structure breach that admits air-ingress graphite oxidation, water/steam ingress from settlement-distorted steam-generator tubes or sheared buried secondary lines, and distortion of spent-fuel storage and handling geometry.",
    hazardType: "EXTERNAL",
    subcategory: "Geotechnical / soil-stability hazards (non-seismic): slope instability and landslide; ground subsidence (mining, karst/solution-cavity collapse, groundwater-withdrawal); soil liquefaction and differential settlement; expansive and collapsing soils",
    severityLevels: ["Minor: localized soil movement or settlement within foundation tolerance; no structure-supported safety function degraded; bounded by routine settlement monitoring", "Moderate: differential settlement or expansive-soil heave distorting building and component supports enough to challenge buried/embedded piping, RCCS duct alignment, or a forced-cooling support system, with reactor trip and a possible small primary or secondary leak path", "Severe: slope failure / landslide impact or large subsidence/liquefaction event that shears the buried ultimate-heat-sink path or underground duct banks, distorts the reactor-cavity / RCCS geometry, opens a depressurized primary breach with a coincident confinement/structure breach (air-ingress chimney), or coincides with spent-fuel handling - producing concurrent loss of forced cooling, loss of offsite power, and a candidate water-ingress, air-ingress, or RCCS-cavity-damage outcome"],
    affectedAreas: ["Reactor cavity and Reactor Cavity Cooling System (RCCS) standpipes, risers, ducts, and supporting structure", "Reactor building foundation and embedded primary-boundary penetrations (instrument lines, helium purification lines, pressure-control connections)", "Buried service-water / ultimate-heat-sink piping and intake structure", "Underground electrical duct banks, switchyard, and transmission-tower foundations (offsite-power path)", "Steam generator and feedwater building supports and buried secondary water lines", "Component cooling water and reactor plant cooling water buried headers", "Spent / stored fuel storage structure and the fuel-handling building and equipment", "Site slopes, embankments, and cut/fill adjacent to safety-related structures"],
    radionuclideBarrierIds: ["Primary helium boundary", "Confinement"],
    inducingMechanisms: ["Differential settlement or subsidence beneath the reactor building shears or strains embedded small-bore primary-boundary penetrations (instrument lines, helium purification lines, pressure-control connections), opening a slow primary depressurization path (small/moderate primary leak; loss of helium purification and inventory control).", "Landslide or debris-flow impact, or a large subsidence/liquefaction lateral spread, can mechanically shear a larger embedded primary penetration or distort the reactor-building boundary enough to open a more rapid, larger primary breach (depressurized loss of forced cooling).", "Subsidence or differential settlement of the reactor-cavity / RCCS structure distorts the RCCS standpipe, riser, and duct geometry and the cavity gap, degrading the passive heat-sink path - the signature HTGR concern - and, if combined with a confinement/structure breach and a depressurized primary breach, can establish a chimney geometry favoring graphite oxidation by air ingress.", "Slope failure, landslide, or liquefaction-driven lateral spread shears or buries the underground service-water / ultimate-heat-sink piping and intake, causing loss of service water and reactor plant / component cooling water to the forced-cooling systems.", "Ground failure of underground electrical duct banks, switchyard foundations, or transmission-tower footings on unstable or liquefiable soil interrupts offsite power and onsite AC/DC distribution to the operating forced-cooling train and its support systems.", "Loss or distortion of a forced-cooling support system (service water, cooling water, AC/DC, instrument air, essential HVAC) trips the main helium circulator, the steam generator / feedwater path, or the Shutdown Cooling System and produces a general reactor trip and pressurized loss of forced cooling.", "Differential settlement of steam-generator or feedwater supports, or shear of buried secondary water lines, distorts SG tube supports and can open a steam-generator water/steam ingress path (tube leak through single, multiple, or relief-lifting rupture) that adds moisture reactivity and oxidizes graphite - a risk-significant water-ingress outcome; the same settlement can fail Shutdown Cooling System heat-exchanger tubes.", "Expansive-soil heave or collapsing-soil hydro-collapse under foundations cyclically strains embedded piping and component supports, fatiguing penetrations and the secondary water boundary over time.", "Differential settlement or slope/landslide impact on the spent / stored fuel storage structure or the fuel-handling building distorts storage and handling geometry, challenging the cooling of stored fuel and any in-progress source-handling line-up."],
    inducedInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-04", "IE-05", "IE-06", "IE-07", "IE-14", "IE-15", "IE-16", "IE-17", "IE-19", "IE-20", "IE-21", "IE-22", "IE-24", "IE-25", "IE-26", "IE-27", "IE-28", "IE-29", "IE-30", "IE-31", "IE-32", "IE-33", "IE-34", "IE-35", "IE-36", "IE-37", "IE-38", "IE-39", "IE-40"],
    potentialCombinations: ["Geotechnically-induced loss of offsite power with loss of forced cooling: a slope/liquefaction failure of buried duct banks and the switchyard causing LOOP concurrent with a circulator/SG trip (LOOP + LOFC), ridden out passively by the RCCS unless the cavity is also degraded.", "Geotechnically-induced loss of the ultimate heat sink: slope or soil failure shearing the buried service-water path concurrent with loss of forced cooling.", "Subsidence/settlement-induced RCCS-cavity degradation combined with a confinement/structure breach forming an air-ingress chimney for graphite oxidation.", "Landslide-impact or large-settlement depressurized primary breach concurrent with a confinement/structure breach: a depressurized primary boundary failure plus loss of confinement integrity admitting air ingress and graphite oxidation (depressurized-breach air ingress).", "Differential-settlement-induced steam-generator water/steam ingress concurrent with a forced-cooling transient (moisture reactivity plus graphite oxidation).", "Landslide / slope-failure impact combined with a spent-fuel-handling event distorting the storage or handling geometry.", "Geotechnically-induced internal flood: shear or rupture of a buried service-water, feedwater, or cooling-water line by ground movement flooding the affected building.", "Seismically-induced reactivity insertion concurrent with impeded control-rod insertion: ground motion that shifts or distorts the prismatic fuel blocks and the control-rod channels adds reactivity (IE-08, IE-11) while challenging the maintain-core-geometry function and the gravity scram-insertion path, the prismatic-HTGR seismic geometry-distortion ATWS concern, bounded by the strong negative temperature coefficient.", "Seismically-induced loss of vented-confinement isolation or essential-HVAC filtration (IE-34) concurrent with an in-progress release path: ground motion that defeats the confinement isolation dampers or the HVAC filtration while a primary depressurization (IE-15, IE-16, IE-17) or a plateout-mobilizing transient is underway, degrading the third barrier during the release."],
    analysisMethods: ["ANSI/ANS-2.8 and ASCE/SEI 7 site geotechnical and slope-stability evaluation", "Site-characterization geotechnical investigation per RG 1.132 (subsurface), RG 1.138 (laboratory soil testing), and RG 1.198 (liquefaction potential of soils)", "Slope-stability and landslide analysis (limit-equilibrium and deformation methods) per RG 1.27 and the SRP/NUREG-0800 siting criteria", "Settlement, subsidence, and expansive/collapsing-soil bearing-and-deformation analysis against foundation tolerances", "Liquefaction-triggering and lateral-spread / differential-settlement evaluation", "External-hazard screening and progressive screening per ASME/ANS RA-S-1.4 (non-LWR PRA standard) and the NEI 18-04 / RG 1.233 LMP framework, with site-specific screening against design-basis foundation and slope criteria", "Fragility/structural-response evaluation of the reactor-cavity/RCCS structure and buried distribution to imposed ground deformation in the dedicated external-hazards element"],
    screeningStatus: ScreeningStatus.SCREENED_OUT,
    screeningBasis: "Out of scope for this internal-events PRA element. Non-vibratory geotechnical and soil hazards were explicitly CONSIDERED here and are SCREENED_OUT for development in the dedicated external-hazards (site geotechnical / slope-stability) PRA element; they are not quantified in internal events. The dedicated element screens them primarily on siting: the site is characterized per RG 1.132/1.138/1.198, foundations and slopes are designed and demonstrated stable against settlement, subsidence, liquefaction, lateral spread, and expansive/collapsing-soil deformation, and the buried ultimate-heat-sink and duct-bank routing is qualified, so a credible independent geotechnical event is expected to screen out on low frequency and bounded deformation. Reflecting HTGR physics, the residual concern that the dedicated element must resolve is NOT a loss of forced cooling - because passive RCCS conduction/radiation cooldown bounds fuel temperature, a geotechnically-induced circulator/SG/SDCS or support-system trip (LOFC, even with LOOP) is generally benign and the core rides it out. The genuinely risk-significant outcomes carried forward are (1) distortion of the reactor-cavity / RCCS geometry by differential settlement or subsidence that degrades the passive heat sink; (2) the air-ingress chimney case if a confinement/structure breach accompanies a depressurized primary breach; (3) water/steam ingress from settlement-distorted steam-generator tubes or sheared buried secondary water lines; and (4) spent-fuel / source-handling challenges if storage or handling geometry is distorted. The dedicated element confirms the cavity/RCCS structure and the buried heat-sink and primary-penetration paths retain integrity under the design-basis ground deformation, and that the few primary-leak, depressurized-breach, and water-ingress paths enumerated here remain below the screening frequency.",
    implementsSrs: [sr("IE-A5", "A"), sr("IE-A6", "A")],
  },
];

const INITIATING_EVENT_GROUPS: InitiatingEventGroup[] = [
  {
    uuid: "IEG-01",
    name: "Pressurized loss of forced cooling, intact boundary",
    description: "Pressurized loss-of-heat-removal transients with the primary boundary intact; response is reactor trip plus passive RCCS pressurized cooldown.",
    memberInitiatorIds: ["IE-01", "IE-02", "IE-03", "IE-05", "IE-07", "IE-14", "IE-46"],
    boundingInitiatorId: "IE-14",
    groupingBasis: "All are pressurized loss-of-heat-removal transients with intact primary boundary needing the same trip plus passive RCCS response. IE-14 loses both the circulator and the SG loop simultaneously, so it imposes the most limiting heat-removal demand and envelopes the single-train losses (IE-01 circulator, IE-02/IE-03 SG side, IE-05 turbine, IE-07 scram, IE-46 operator trip). No member needs a depressurization or ingress response, so none is masked.",
    similarMitigationRequirements: ["Reactor trip", "Passive RCCS pressurized cooldown"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Remove core heat"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-07"],
    meanFrequency: { value: 2.943, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [2.53, 2.3] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.HIGH,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-02",
    name: "Loss of backup forced cooling in shutdown",
    description: "Loss of the Shutdown Cooling System active backup train during shutdown states.",
    memberInitiatorIds: ["IE-04"],
    boundingInitiatorId: "IE-04",
    groupingBasis: "Standalone shutdown-state loss of the active backup forced-cooling train. Response is restore SCS or fall back to passive RCCS; distinct from at-power transients by plant state, so it is not folded into IEG-01.",
    similarMitigationRequirements: ["Restore SCS", "Passive RCCS"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Remove core heat"],
    applicableStates: ["POS-04", "POS-05", "POS-07"],
    meanFrequency: { value: 0.054, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.02016, 10.1] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-03",
    name: "Loss of offsite power and normal AC",
    description: "Loss of offsite power and normal non-Class-1E AC distribution; recovery via Class 1E power and passive cooling.",
    memberInitiatorIds: ["IE-06", "IE-27", "IE-28"],
    boundingInitiatorId: "IE-28",
    groupingBasis: "All defeat normal AC supply and demand the same trip plus Class 1E plus passive RCCS response. IE-28 LOOP across the broadest set of plant states bounds the at-power LOOP (IE-06) and the normal-AC-distribution loss (IE-27). Protection and forced cooling are recoverable on Class 1E, so no member needs an additional response.",
    similarMitigationRequirements: ["Reactor trip", "Class 1E power", "Passive RCCS"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Remove core heat", "Control reactivity"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08"],
    meanFrequency: { value: 0.0975, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.07786, 2.8] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.HIGH,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-04",
    name: "Loss of vital DC and instrument power",
    description: "Loss of Class 1E DC and vital instrument/UPS power; protection-and-monitoring support loss kept separate from mechanical support losses.",
    memberInitiatorIds: ["IE-29", "IE-30"],
    boundingInitiatorId: "IE-29",
    groupingBasis: "Both degrade protection and instrumentation power, demanding fail-safe trip plus monitoring restoration plus passive RCCS. IE-29 (Class 1E 125 V DC) bounds IE-30 (vital instrument UPS) because DC loss disables more protection and switching functions. Split from the mechanical support group because protection itself is challenged here.",
    similarMitigationRequirements: ["Fail-safe reactor trip", "Instrument/monitoring restoration", "Passive RCCS"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Control reactivity", "Remove core heat", "Maintain radionuclide barriers"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-08"],
    meanFrequency: { value: 0.023, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.01213, 6] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-05",
    name: "Loss of mechanical support cooling, air, and HVAC",
    description: "Loss of component cooling water, instrument/service air, or essential HVAC; mechanical support losses where protection survives.",
    memberInitiatorIds: ["IE-31", "IE-33", "IE-34"],
    boundingInitiatorId: "IE-31",
    groupingBasis: "All are mechanical support-system losses that trip the plant but leave protection and instrumentation intact; response is trip plus monitoring plus passive RCCS. IE-31 (reactor plant cooling water) bounds because component cooling loss disables the widest set of running mechanical loads. Kept separate from IEG-04 because the reactor protection function is not challenged here.",
    similarMitigationRequirements: ["Reactor trip", "Monitoring", "Passive RCCS"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Remove core heat", "Maintain radionuclide barriers"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"],
    meanFrequency: { value: 0.12, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.07201, 4.7] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-06",
    name: "Transient overpower from positive reactivity insertion",
    description: "Rod or rod-bank withdrawal driving a positive reactivity insertion / overpower.",
    memberInitiatorIds: ["IE-08", "IE-41"],
    boundingInitiatorId: "IE-08",
    groupingBasis: "Both are positive-insertion overpower events requiring trip on flux and rod insertion. IE-08 (control-rod-bank withdrawal) bounds IE-41 (operator-induced single rod-group withdrawal) by insertion magnitude. Kept distinct from the power-distribution/overcooling reactivity group because the challenge here is a direct positive insertion, a different overpower response.",
    similarMitigationRequirements: ["Trip on flux/power", "Rod insertion"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Control reactivity"],
    applicableStates: ["POS-01", "POS-02", "POS-03"],
    meanFrequency: { value: 0.015, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.007759, 6] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.LOW,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-07",
    name: "Power-distribution and overcooling reactivity",
    description: "Spatial power-distribution and overcooling-driven reactivity transients mitigated by flux trip and negative feedback.",
    memberInitiatorIds: ["IE-09", "IE-10", "IE-11", "IE-45"],
    boundingInitiatorId: "IE-11",
    groupingBasis: "All are reactivity transients driven by power-distribution shifts (IE-09 rod drop, IE-10 xenon oscillation) or overcooling-induced insertion (IE-11, IE-45 operator overcooling), mitigated by trip on flux plus negative temperature feedback. IE-11 (reactivity insertion from a sudden rise in heat-removal rate) is the largest overcooling insertion and bounds the others. No member needs a direct large positive-insertion overpower response, which is handled separately in IEG-06.",
    similarMitigationRequirements: ["Trip on flux/power", "Negative temperature feedback"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Control reactivity", "Remove core heat"],
    applicableStates: ["POS-01", "POS-02", "POS-03"],
    meanFrequency: { value: 0.0165, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.009667, 4.7] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.LOW,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-08",
    name: "Startup and shutdown reactivity mis-positioning",
    description: "Fuel-loading and reserve-shutdown / rod mis-positioning reactivity errors during low-power line-ups.",
    memberInitiatorIds: ["IE-12", "IE-42"],
    boundingInitiatorId: "IE-42",
    groupingBasis: "Both are low-power line-up reactivity errors requiring source-range monitoring and reserve-shutdown actuation. IE-42 (reserve-shutdown / rod mis-positioning during startup) bounds IE-12 (fuel-loading mis-positioning) by the rate and magnitude of insertion during the startup approach to criticality.",
    similarMitigationRequirements: ["Source-range monitoring", "Reserve-shutdown actuation"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Control reactivity"],
    applicableStates: ["POS-03", "POS-05", "POS-06"],
    meanFrequency: { value: 0.0145, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.007447, 6.1] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.LOW,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-09",
    name: "Small helium leak with forced cooling",
    description: "Slow primary helium depressurization with forced cooling credited; lowest primary-boundary leak tier.",
    memberInitiatorIds: ["IE-15"],
    boundingInitiatorId: "IE-15",
    groupingBasis: "Standalone lowest leak tier: slow depressurization with forced cooling available. Response is leak isolation plus helium makeup. Distinct from the intermediate and large break tiers by depressurization rate and by whether forced cooling stays credited.",
    similarMitigationRequirements: ["Leak isolation", "Helium makeup"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Maintain radionuclide barriers", "Remove core heat"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"],
    meanFrequency: { value: 0.01, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.003753, 10.1] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-10",
    name: "Intermediate depressurization break",
    description: "Moderate primary boundary break or stuck-open relief path giving intermediate depressurization.",
    memberInitiatorIds: ["IE-16", "IE-18"],
    boundingInitiatorId: "IE-16",
    groupingBasis: "Both give intermediate depressurization needing depressurization management plus passive RCCS. IE-16 (moderate boundary break, not isolable) bounds IE-18 (stuck-open relief, isolable) because the unisolable break is the more limiting depressurization. Kept separate from the small leak (cooling credited) and the large D-LOFC tiers.",
    similarMitigationRequirements: ["Depressurization management", "Passive RCCS"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Maintain radionuclide barriers", "Remove core heat"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"],
    meanFrequency: { value: 0.003, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.0009389, 10.7] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-11",
    name: "Large break depressurized loss of forced cooling",
    description: "Large primary boundary break / rapid depressurization with air-ingress potential (D-LOFC).",
    memberInitiatorIds: ["IE-17"],
    boundingInitiatorId: "IE-17",
    groupingBasis: "Standalone most-limiting break: rapid depressurization, passive low-pressure cooling, and air-ingress / chemical-attack management. It is not folded with the intermediate tier because the air-ingress response and the low-pressure RCCS heat-up are demands the intermediate breaks do not impose.",
    similarMitigationRequirements: ["Passive RCCS low-pressure cooldown", "Air-ingress management"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Remove core heat", "Maintain radionuclide barriers", "Limit chemical attack (air/water ingress)"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"],
    meanFrequency: { value: 5e-05, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [9.557e-06, 20] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.HIGH,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-12",
    name: "Operator inadvertent depressurization in shutdown",
    description: "Human-error primary vent / inadvertent depressurization during maintenance, isolable in shutdown states.",
    memberInitiatorIds: ["IE-43"],
    boundingInitiatorId: "IE-43",
    groupingBasis: "Standalone isolable shutdown depressurization driven by operator action; response is re-isolation plus shutdown cooling. Distinct from the mechanical break tiers because the path is isolable and occurs in shutdown plant states.",
    similarMitigationRequirements: ["Re-isolation of vent path", "Shutdown cooling"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Maintain radionuclide barriers", "Remove core heat"],
    applicableStates: ["POS-04", "POS-05", "POS-08"],
    meanFrequency: { value: 0.018, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.006729, 10] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-13",
    name: "Slow moisture ingress, boundary intact",
    description: "Small/slow water-into-helium ingress with the primary boundary intact: small SG tube leak and circulator bearing/seal seepage.",
    memberInitiatorIds: ["IE-20", "IE-23"],
    boundingInitiatorId: "IE-20",
    groupingBasis: "Both are slow moisture-ingress paths with the primary boundary intact, mitigated by moisture detection plus helium purification. IE-20 (small SG tube leak) bounds IE-23 (circulator bearing/seal seepage) by moisture mass rate. IE-13 was removed from this group because it is an actual SG tube rupture and cannot be bounded by a small slow leak; it is moved to the moderate-ingress group.",
    similarMitigationRequirements: ["Moisture detection", "Helium purification"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Limit chemical attack (air/water ingress)", "Control reactivity"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04"],
    meanFrequency: { value: 0.01363, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.00922, 4.1] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-14",
    name: "Moderate water ingress, boundary intact (SGTR)",
    description: "Moderate SG-tube-rupture water/steam ingress with the primary boundary intact, driving a moisture reactivity transient and requiring SG isolation.",
    memberInitiatorIds: ["IE-13", "IE-21", "IE-47"],
    boundingInitiatorId: "IE-21",
    groupingBasis: "All three are moderate moisture-ingress events with the primary boundary intact, requiring SG isolation plus moisture purification plus reactivity control on the moisture-induced insertion. IE-21 (moderate water-ingress SGTR) carries the largest intact-boundary moisture mass and bounds the SGTR reactivity transient IE-13 and the operator mis-line-up moisture event IE-47. The wet-depressurization breach (IE-19) is deliberately excluded so its depressurization response is not masked.",
    similarMitigationRequirements: ["SG isolation", "Moisture/helium purification"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Limit chemical attack (air/water ingress)", "Control reactivity", "Maintain radionuclide barriers"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05"],
    meanFrequency: { value: 0.0055, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.003258, 4.8] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-15",
    name: "Large SGTR water ingress with relief lift (BDBE)",
    description: "Large or multiple SG tube rupture with relief-valve lift, the most limiting moisture-ingress event.",
    memberInitiatorIds: ["IE-22"],
    boundingInitiatorId: "IE-22",
    groupingBasis: "Standalone most-limiting moisture event: large/multiple SGTR with relief lift, needing the fastest SG isolation plus relief management. It is not folded with the moderate-ingress group because its moisture mass and relief-lift release path exceed what the moderate isolation response envelopes.",
    similarMitigationRequirements: ["Fastest SG isolation", "Relief-path management"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Limit chemical attack (air/water ingress)", "Maintain radionuclide barriers", "Control reactivity"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04"],
    meanFrequency: { value: 8e-05, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [9.48e-06, 29.9] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-16",
    name: "SCS heat-exchanger water ingress in shutdown",
    description: "Shutdown Cooling System heat-exchanger tube failure admitting water through the SCS boundary during shutdown states.",
    memberInitiatorIds: ["IE-26"],
    boundingInitiatorId: "IE-26",
    groupingBasis: "Standalone shutdown-state water ingress that simultaneously disables the credited shutdown cooling path, requiring SCS heat-exchanger isolation plus transfer to passive RCCS. Distinct from the at-power SGTR ingress events by plant state and by the loss of the very cooling system that would otherwise mitigate.",
    similarMitigationRequirements: ["Isolate SCS heat exchanger", "Transfer to passive RCCS"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Limit chemical attack (air/water ingress)", "Remove core heat"],
    applicableStates: ["POS-04", "POS-05", "POS-06", "POS-08"],
    meanFrequency: { value: 0.006, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.002253, 10] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-17",
    name: "Ex-boundary interfacing release",
    description: "Pressure-boundary breach of a system interfacing with the primary, releasing helium and radionuclides outside the primary boundary.",
    memberInitiatorIds: ["IE-24", "IE-25"],
    boundingInitiatorId: "IE-24",
    groupingBasis: "Both are breaches that put a release path outside the primary boundary (confinement bypass), requiring line isolation plus pressure management. IE-24 (helium purification pressure-boundary leak/rupture) bounds IE-25 (helium inventory/pressure-control breach) by release inventory. IE-40 was removed because it is a loss of the makeup control function, not an ex-boundary release, so it does not share the isolate-the-release response.",
    similarMitigationRequirements: ["Isolate interfacing line", "Pressure management"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Maintain radionuclide barriers"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06"],
    meanFrequency: { value: 0.008, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.004207, 6] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-18",
    name: "Fuel-handling source events",
    description: "Fuel-handling / refuelling source-handling and mis-positioning events challenging the radionuclide barrier during handling.",
    memberInitiatorIds: ["IE-38", "IE-44"],
    boundingInitiatorId: "IE-38",
    groupingBasis: "Both are fuel-handling source events in refuelling states needing handling interlocks plus confinement. IE-38 (in-vessel and ex-vessel fuel-handling source event) bounds IE-44 (operator mis-positioning of the fuel-handling line-up) because it spans the broader handling envelope.",
    similarMitigationRequirements: ["Fuel-handling interlocks", "Confinement"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Maintain radionuclide barriers"],
    applicableStates: ["POS-06"],
    meanFrequency: { value: 0.008, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.004215, 5.9] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.LOW,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-19",
    name: "Loss of cooling to stored fuel",
    description: "Loss of cooling to spent / stored and ex-core fuel storage, independent of reactor cooling.",
    memberInitiatorIds: ["IE-39"],
    boundingInitiatorId: "IE-39",
    groupingBasis: "Standalone loss of cooling to the ex-core stored-fuel source, independent of the reactor heat-removal chain; response is restore storage cooling plus makeup. It cannot be folded into reactor-cooling groups because the heat source and credited systems are separate.",
    similarMitigationRequirements: ["Restore storage cooling", "Storage makeup"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Remove core heat", "Maintain radionuclide barriers"],
    applicableStates: ["POS-05", "POS-06", "POS-08"],
    meanFrequency: { value: 0.01, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.003756, 9.9] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.LOW,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-20",
    name: "Wet depressurization SGTR breach",
    description: "SG-tube-rupture HPB heat-exchanger breach producing simultaneous water/steam ingress and primary depressurization.",
    memberInitiatorIds: ["IE-19"],
    boundingInitiatorId: "IE-19",
    groupingBasis: "Standalone because it uniquely couples moisture ingress with a depressurizing primary-boundary breach. It needs both SG isolation/moisture purification and a depressurized-cooling plus release-path response. Folding it under the intact-boundary moderate-ingress group would mask its depressurization response, and folding it under the dry breaks would mask its moisture/chemical-attack response.",
    similarMitigationRequirements: ["SG isolation", "Moisture purification", "Depressurized cooling and release-path management"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Limit chemical attack (air/water ingress)", "Maintain radionuclide barriers", "Control reactivity", "Remove core heat"],
    applicableStates: ["POS-01", "POS-02", "POS-03"],
    meanFrequency: { value: 0.0008, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.0001525, 20.1] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.HIGH,
    implementsSrs: [sr("IE-B4", "B")],
  },
  {
    uuid: "IEG-21",
    name: "Loss of helium inventory and pressure control",
    description: "Loss of the helium inventory and pressure (makeup) control function, with no ex-boundary release path.",
    memberInitiatorIds: ["IE-40"],
    boundingInitiatorId: "IE-40",
    groupingBasis: "Standalone loss of the makeup/pressure-control function. The response is restoration of inventory and pressure control, not isolation of an ex-boundary release. It is split from IEG-17 because IE-24/IE-25 are pressure-boundary breaches with a release path, which is a different event-tree response that does not envelope a pure function loss.",
    similarMitigationRequirements: ["Restore helium inventory and pressure control", "Pressure management"],
    groupingDoesNotMaskRiskSignificantSequences: true,
    comparableImpactAcrossMembers: true,
    challengedSafetyFunctions: ["Maintain radionuclide barriers"],
    applicableStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"],
    meanFrequency: { value: 0.03, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.01136, 9.9] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    riskImportance: ImportanceLevel.MEDIUM,
    implementsSrs: [sr("IE-B4", "B")],
  },
];

const SCREENING_RECORDS: InitiatingEventScreeningRecord[] = [
  {
    initiatorOrGroupId: "IE-01",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Main helium circulator trip is a pressurized loss of forced cooling that leaves the TRISO, primary boundary, and confinement intact, so the IE-C9a precondition is met. It is retained because it is a credible plant-challenging transient not bounded by any higher-frequency modeled event and not benign before a complicated shutdown, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-02",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of the steam generator heat sink is a pressurized loss of forced cooling with all transport barriers intact, meeting the precondition. It is retained because it poses a credible heat-removal challenge not bounded by a higher-frequency event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-03",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of feedwater degrades steam generator heat removal but breaches no radionuclide transport barrier, so the precondition is met. It is retained because it is a credible cooling transient not bounded by a higher-frequency modeled event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-04",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of the active Shutdown Cooling System is a support-system transient that leaves the transport barriers intact, meeting the precondition. It is retained because the loss of backup forced cooling in shutdown is a credible challenge not bounded by a higher-frequency event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-05",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Turbine trip / loss of the power conversion system is a pressurized loss of forced cooling with barriers intact, so the precondition is met. It is retained because it is a credible plant transient not bounded by a higher-frequency event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-06",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of offsite power is a support-system transient that leaves all transport barriers intact, meeting the precondition. It is retained because loss of normal AC is a credible challenge not bounded by a higher-frequency modeled event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-07",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "A general reactor trip or spurious scram leaves the transport barriers intact, so the precondition is met. It is retained because it is a credible reactor transient not bounded by a higher-frequency event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-08",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Control rod or rod bank withdrawal causing transient overpower is a positive-reactivity insertion that does not breach any transport barrier, meeting the precondition. It is retained because it is a credible reactivity challenge not bounded by a higher-frequency event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-09",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Control rod drop or inadvertent rod action is a power-distribution reactivity transient with barriers intact, so the precondition is met. It is retained because it is a credible reactivity challenge not bounded by a higher-frequency modeled event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-10",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "A xenon-oscillation-induced reactivity transient redistributes power without breaching any transport barrier, meeting the precondition. It is retained because it is a credible reactivity challenge not bounded by a higher-frequency event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-11",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Reactivity insertion from a sudden increase in primary heat removal (core overcooling) leaves the transport barriers intact, so the precondition is met. It is retained because it is a credible overcooling reactivity challenge not bounded by a higher-frequency event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-12",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "A fuel-loading or mispositioning reactivity error during startup/shutdown is a reactivity transient that breaches no transport barrier, meeting the precondition. It is retained because it is a credible mis-positioning challenge not bounded by a higher-frequency modeled event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-13",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "This moisture-induced reactivity transient from moderate water/steam ingress is grouped as boundary-intact, leaving the radionuclide transport barriers intact, so the precondition is met. It is retained because the moisture reactivity and chemistry challenge is credible, not bounded by a higher-frequency event, and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-14",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of main loop heat transport with circulator and SG loop unavailable at power is a pressurized loss of forced cooling with barriers intact, meeting the precondition. It is retained because it is a credible heat-removal challenge not bounded by a higher-frequency event and not benign, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-15",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A small primary helium leak is a breach of the primary helium pressure boundary, so the barrier-integrity precondition (IE-C9a) fails and the SCR gate cannot be reached. It is retained as the modeled small-leak event that carries the slow-depressurization frequency, and the DEGRADED label reflects the slow chemistry effect rather than removing the boundary breach.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-16",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A moderate primary boundary break is a direct breach of the primary helium pressure boundary, failing the IE-C9a precondition. It is a credible intermediate-depressurization challenge not bounded by any higher-frequency modeled event, so it is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-17",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A large primary boundary break with rapid depressurization (D-LOFC) breaches the primary helium pressure boundary, failing the IE-C9a precondition. It is the bounding rapid-depressurization initiator and is retained for explicit modeling.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-18",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A stuck-open pressure-relief/safety valve opens the primary helium pressure boundary, so the IE-C9a precondition fails. It is a credible depressurization path retained for explicit modeling and not bounded by a higher-frequency event.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-19",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A steam generator tube rupture opens the high-pressure boundary with water/steam ingress, breaching the primary boundary and failing the IE-C9a precondition. The wet-depressurization challenge with moisture ingress is a distinct credible event and is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-20",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A small steam generator tube leak opens the primary helium pressure boundary, so the barrier-integrity precondition (IE-C9a) is not met and the event cannot enter the SCR test. It is retained with no SCR criterion because the boundary breach blocks the gate.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-21",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A steam generator tube rupture breaches the primary helium pressure boundary, failing the IE-C9a precondition. The breach blocks the screening gate, so it is retained with no SCR criterion.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-22",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A large or multiple SGTR with relief-valve lift both breaches the primary boundary and opens a relief path, so the IE-C9a precondition fails. The open boundary blocks the gate and the event is retained with no SCR criterion.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-23",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "Water ingress through a circulator water-lubricated bearing or seal breaches the primary helium pressure boundary, failing IE-C9a. The breach blocks the gate, so it is retained with no SCR criterion.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-24",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A helium purification system pressure-boundary leak or rupture bypasses the primary boundary and releases outside it, so the IE-C9a precondition is not met. The bypass blocks the gate and the event is retained with no SCR criterion.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-25",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A helium inventory and pressure-control system breach outside the primary boundary is an ex-boundary interfacing release that bypasses the transport barrier, failing IE-C9a. The bypass blocks the gate, so it is retained with no SCR criterion.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-26",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A Shutdown Cooling System heat-exchanger tube failure opens the SCS boundary and admits water ingress, breaching a transport barrier and failing IE-C9a. The breach blocks the gate, so it is retained with no SCR criterion.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-27",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of normal non-Class 1E AC distribution is a support-system transient that leaves all transport barriers intact, so the precondition is met. It is retained because it is a credible challenge to forced cooling that is not bounded by any higher-frequency modeled event and is not benign-correctable, so the SCR test fails.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-28",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of offsite power leaves the radionuclide transport barriers intact, satisfying the precondition. It is a distinct, credible plant-wide power challenge not subsumed by a higher-frequency modeled event, so the SCR test fails and the event is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-29",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of Class 1E 125 V DC power is a support-system transient with no barrier failure, so the precondition is met. It is retained because the loss of vital DC is a credible challenge not bounded by a higher-frequency event and not benign-correctable, failing the SCR test.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-30",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of the Class 1E uninterruptible (vital instrument) power supply leaves the transport barriers intact, satisfying the precondition. It is a credible instrument-power challenge not bounded by a higher-frequency modeled event and not benign, so it is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-31",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of reactor plant (component) cooling water is a mechanical support-cooling transient that does not breach any transport barrier, so the precondition is met. It is retained because it is a credible challenge to forced-cooling support not bounded by a higher-frequency event and not benign-correctable.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-32",
    retained: false,
    criterion: "SCR-2",
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of service water / ultimate heat sink leaves the transport barriers intact, satisfying the precondition. Its impact is bounded by and consolidated into the loss-of-HTS (loss of main loop cooling) event tree of equal or higher frequency, so it is merged rather than modeled separately.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-33",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of instrument and service air is a support-system transient with all transport barriers intact, so the precondition is met. It is a credible challenge not bounded by a higher-frequency modeled event and not benign, so the SCR test fails and it is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-34",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of HVAC / essential ventilation to electrical and I&C spaces leaves the transport barriers intact, satisfying the precondition. It is retained because it is a credible support-system challenge not bounded by a higher-frequency event and not benign-correctable.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-35",
    retained: false,
    criterion: "SCR-3",
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of helium purification produces only limited, slow graphite oxidation/hydrolysis with no transport-barrier failure, so the precondition is met despite the degraded label. The effect is detected and corrected before any complicated shutdown with insignificant risk, and the serious ingress cases are covered by the primary-leak and steam-generator-leak trees, so it is benign and screened out.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-36",
    retained: false,
    criterion: "SCR-1",
    barrierIntegrityPreconditionMet: false,
    justification: "A helium purification line break is a real primary-helium-boundary breach causing small depressurization, so the precondition is not met. It is identical in impact to the retained small primary-leak event and is consolidated into the small-leak event (IE-15) that already carries its frequency.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-37",
    retained: false,
    criterion: "SCR-1",
    barrierIntegrityPreconditionMet: false,
    justification: "An instrument line break is a real primary-coolant-boundary failure causing small depressurization, so the precondition is not met. It is identical in impact to the small primary-leak event and is consolidated into the small-leak event (IE-15) that already carries its frequency.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-38",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "A fuel-handling / refuelling source-handling event breaches a radionuclide transport barrier, so the barrier-integrity precondition is not met and the event cannot be screened at the gate. It is therefore retained with the barrier breach blocking the SCR test.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-39",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of cooling to spent / stored fuel and ex-core fuel storage leaves the transport barriers intact, satisfying the precondition. It is a credible challenge to a separate stored-fuel heat sink not bounded by a higher-frequency modeled event and not benign, so it is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-40",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Loss of helium inventory and pressure (makeup) control leaves the primary boundary and transport barriers intact, so the precondition is met. It is retained because it is a credible pressure-control challenge not bounded by a higher-frequency modeled event and not benign-correctable, failing the SCR test.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-41",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Erroneous control-rod withdrawal is a positive-reactivity transient that leaves the TRISO, primary helium boundary, and confinement intact, so the IE-C9a precondition is met. It is a credible transient-overpower challenge not bounded by any higher-frequency modeled event and not benignly self-correcting, so the SCR test fails and the event is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-42",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Reserve-shutdown and rod mis-positioning during startup line-up is a reactivity transient with all transport barriers intact, satisfying IE-C9a. It is a credible startup reactivity challenge not bounded by a higher-frequency event and not self-correcting before a complicated shutdown, so the SCR test fails and it is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-43",
    retained: true,
    barrierIntegrityPreconditionMet: false,
    justification: "Operator-induced primary depressurization through an inadvertent vent or relief-valve opening breaches the primary helium pressure boundary, so the IE-C9a barrier-integrity precondition is not met. The breach blocks the screening gate, and the event is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-44",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "For this grouped fuel-handling initiator the transport barriers remain intact, so the IE-C9a precondition is met. It is a credible fuel-handling line-up error not bounded by a higher-frequency modeled event and not benign, so the SCR test fails and the event is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-45",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "An operator-induced overcooling maneuver is a heat-removal and reactivity transient that leaves all transport barriers intact, satisfying IE-C9a. It is a credible overcooling power-distribution challenge not bounded by a higher-frequency event and not self-correcting, so the SCR test fails and it is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-46",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "Inadvertent operator trip or isolation of the operating forced-cooling train is a pressurized loss-of-forced-cooling transient with an intact primary boundary; the degraded label reflects only heat-removal loss bounded by the passive RCCS, so the IE-C9a precondition is met. It is a credible heat-removal challenge not bounded by a higher-frequency event and not benign, so the SCR test fails and it is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
  {
    initiatorOrGroupId: "IE-47",
    retained: true,
    barrierIntegrityPreconditionMet: true,
    justification: "An operator SG or secondary-side mis-line-up causing moderate moisture ingress with the primary boundary intact is a chemistry and reactivity transient that does not fail a transport barrier, so the degraded label still meets the IE-C9a precondition. It is a credible water-ingress challenge not bounded by a higher-frequency event and not self-correcting, so the SCR test fails and it is retained.",
    implementsSrs: [sr("IE-C9", "C")],
  },
];

const QUANTIFICATIONS: InitiatingEventFrequencyQuantification[] = [
  {
    initiatorOrGroupId: "IEG-01",
    meanFrequency: { value: 2.943, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [2.53, 2.3] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "FAULT_TREE",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR (prismatic-block, helium-cooled, ~350 MWth, single reactor) with no plant data; each member built from generic U.S. power-reactor IE data (NUREG/CR-5750) for the data-rich transients (IE-01 circulator/forced-flow trip, IE-02 loss of heat sink, IE-03 loss of feedwater, IE-05 turbine trip, IE-07 reactor trip), HTGR design reliability and gas-cooled fleet experience for the loss-of-main-loop combination event (IE-14), and THERP/SPAR-H HRA for the operator-induced loss of forced cooling (IE-46). With no operating history the design-adjusted prior is taken as the posterior; lognormal error factors carry the uncertainty (4 to 6 data-rich transients, 10 for the combination and human-error initiators). Group basis is FAULT_TREE because IE-14 (combination loss of main loop) is the bounding member defining the group top event.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["IE frequencies are quantified at the point of plant challenge, before any mitigating-system or operator-recovery response. Crediting RCCS, SCS restart, or main-loop restoration belongs to the downstream event-tree branches, not the IE frequency.", "The passive RCCS that bounds fuel temperature on loss of forced cooling is a mitigation success path, not an IE-frequency reducer; including it here would double-count credit taken in the accident-sequence model.", "For IE-46 no recovery credit is applied because the initiator is defined as the unrecovered commission act placing the plant in the loss-of-forced-cooling state; post-trip recovery is modeled separately."],
    faultTreeDetails: {
      modelId: "FT-IEG-01",
      topEvent: "Loss of main loop heat transport (combined loss of the main helium circulator forced-flow path and the steam-generator heat-sink path, reactor at power, primary boundary intact) - IE-14, the bounding member of IEG-01.",
      modifications: [],
      quantifiesFrequencyNotProbability: true,
      hfeContributionsIncluded: true,
      componentFailureCombinationsIncluded: true,
    },
    operatorContribution: {
      controlRoomContributionEstimated: true,
      basis: "Operator-induced initiators in the group use a per-demand human error probability times the demand rate, summed with the hardware-driven members.",
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Each member carries a lognormal defined by its mean and error factor: EF 4 for the largest-data transients (IE-05, IE-07), EF 5-6 for the remaining generic data-rich transients (IE-01, IE-02, IE-03), and EF 10 for the loss-of-main-loop combination (IE-14) and the human-error initiator (IE-46). GENERIC members use a Jeffreys non-informative prior giving (events+0.5)/reactorYears; with no plant data the posterior equals the design-adjusted prior. The group frequency and uncertainty are obtained downstream by summing member means and propagating member lognormals by Monte Carlo.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C11", "C"), sr("IE-C14", "C"), sr("IE-C13", "C")],
  },
  {
    initiatorOrGroupId: "IEG-02",
    meanFrequency: { value: 0.054, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.02016, 10.1] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "FAULT_TREE",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; frequency built from generic industry component data, HTGR design reliability, and gas-cooled fleet experience. The SCS architecture and its role as dedicated backup to main-loop cooling come from the MHTGR PRA (DOE-HTGR-86-011), FMEA Table 5-5, and INL/EXT-12-26895 Sec. 6.1; the P-LOFC/D-LOFC heatup cases assume both HTS and SCS unavailable, confirming SCS is the credited active backup whose loss is the shutdown-mode loss of forced cooling. Circulator trip-while-running and standby fail-to-start rates are NUREG/CR-6928-class. With no operating data the design-adjusted posterior equals the prior.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["IE frequency defined at the point the SCS backup forced-cooling path is lost; operator restoration of the main loop or SCS train and the passive RCCS taking over are downstream mitigating responses modeled in the event tree, not credits against the initiator frequency.", "Crediting recovery here would double-count mitigation the success-path analysis already represents, so the per-member fault-tree terms use as-found train unreliabilities with no recovery factor."],
    faultTreeDetails: {
      modelId: "FT-IEG-02",
      topEvent: "Loss of the active backup forced-cooling path in shutdown: the Shutdown Cooling System is unavailable to remove decay heat in forced-cooldown, cold-shutdown, post-trip, and refuelling states, leaving the passive RCCS as the heat-removal path (IE-04).",
      modifications: [],
      quantifiesFrequencyNotProbability: true,
      hfeContributionsIncluded: false,
      hfeExclusionBasis: "The bounding fault-tree event is a hardware combination; any operator-error initiators in the group are quantified separately by HEP times demand and summed in.",
      componentFailureCombinationsIncluded: true,
    },
    uncertaintyCharacterization: {
      riskSignificant: false,
      method: "Lognormal on the member frequency with EF 10 (sparse/design-derived combination event); the fault-tree mean is the sum of cut-set term products, propagated downstream by Monte Carlo when the group frequency is formed.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C11", "C"), sr("IE-C14", "C")],
  },
  {
    initiatorOrGroupId: "IEG-03",
    meanFrequency: { value: 0.0975, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.07786, 2.8] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "GENERIC_DATA",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational ~350 MWth single-reactor Generic HTGR with no plant data; per-member frequencies from generic LWR electrical-support data (NUREG/CR-5750), HTGR design reliability, and gas-cooled fleet experience plus the MHTGR PSID/PRA (DOE-HTGR-86-011) and NGNP PRA white paper. LOOP and loss of normal AC have rich industry counts, so each member is GENERIC at the Jeffreys posterior mean (events+0.5)/reactorYears anchored to NUREG/CR-5750 (LOOP category B 4.6E-2/ry, vital ac-bus category C/C1). With no HTGR operating data the design-adjusted prior equals the posterior; gas-cooled fleet experience confirms LOOP and loss-of-AC behave as plant-wide transients bounded by P-LOFC.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["IE frequencies are bare occurrence rates; offsite-power recovery, Class 1E restoration, and SCS/passive-RCCS response are credited downstream in the event-sequence and station-blackout models, not the IE frequency.", "Crediting LOOP non-recovery in the IE rate would double-count mitigation modeled in the loss-of-AC / SBO event trees."],
    genericDataComparison: {
      performed: true,
      differencesExplanation: "Generic United States power-reactor rates adjusted to the Generic HTGR design and the gas-cooled fleet experience.",
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal per member mean with EF 5 (data-rich NUREG/CR-5750 electrical-support categories), propagated by Monte Carlo when summed to the group frequency. Member means: IE-28 4.65E-2, IE-06 3.05E-2, IE-27 2.05E-2; group sum ~9.75E-2/yr.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C")],
  },
  {
    initiatorOrGroupId: "IEG-04",
    meanFrequency: { value: 0.023, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.01213, 6] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "FAULT_TREE",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; frequencies from generic LWR component data (NUREG/CR-6928, IEEE-493, EPRI ALWR URD) for Class 1E batteries, chargers, DC buses, and vital inverters, adjusted to the Generic HTGR Class 1E DC and UPS architectures in the MHTGR PSID (DOE-HTGR-86-024). Gas-cooled fleet support-system experience confirms the order of magnitude. With no plant-specific data the posterior mean equals the design-adjusted prior.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["IE frequencies are quantified up to loss of the vital-power bus; operator restoration of DC or UPS power is mitigation credited in the event-sequence models, not the initiator frequency.", "The fault-tree terms use as-demanded standby unavailabilities of the redundant division/channel and cross-division CCF only; no post-initiator repair or re-energization is credited."],
    faultTreeDetails: {
      modelId: "FT-IEG-04",
      topEvent: "Loss of vital DC or instrument power to the Generic HTGR (IEG-04): the in-service Class 1E vital-power bus is lost with its redundant division/channel unavailable, demanding fail-safe reactor trip, monitoring restoration, and passive RCCS decay-heat removal.",
      modifications: [],
      quantifiesFrequencyNotProbability: true,
      hfeContributionsIncluded: false,
      hfeExclusionBasis: "The bounding fault-tree event is a hardware combination; any operator-error initiators in the group are quantified separately by HEP times demand and summed in.",
      componentFailureCombinationsIncluded: true,
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal per member with EF 10 (sparse redundant-support fault-tree estimates). Member means are summed for the group frequency, with parametric Monte Carlo propagation downstream; the rare-event approximation is not invoked.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C11", "C"), sr("IE-C14", "C")],
  },
  {
    initiatorOrGroupId: "IEG-05",
    meanFrequency: { value: 0.12, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.07201, 4.7] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "FAULT_TREE",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; each member built from generic industry support-system reliability data (NUREG/CR-6928, EPRI instrument-air and CCW studies) as prior, adjusted for the HTGR design, posterior equal to the design-adjusted prior. HTGR-specific reliability from the MHTGR PSID (DOE-HTGR-86011) and gas-cooled fleet experience. All three members are mechanical support-system losses that trip the plant but leave reactor protection and barriers intact; the passive RCCS bounds fuel temperature, so these are transient initiators.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["Operator recovery of a lost support train (restart of a standby pump/compressor/fan, crosstie alignment) is credited downstream in the event-tree mitigation, not the IE frequency, to avoid double-counting recovery between initiator and sequence model.", "The fault-tree terms already embed automatic standby-train start; only manual post-trip recovery is excluded, consistent with treating the support-system loss as the as-challenged initiator."],
    faultTreeDetails: {
      modelId: "FT-IEG-05",
      topEvent: "Loss of a mechanical support system (component cooling water, instrument/service air, or essential HVAC) that trips the Generic HTGR while reactor protection, instrumentation, and the radionuclide transport barriers remain intact",
      modifications: [],
      quantifiesFrequencyNotProbability: true,
      hfeContributionsIncluded: false,
      hfeExclusionBasis: "The bounding fault-tree event is a hardware combination; any operator-error initiators in the group are quantified separately by HEP times demand and summed in.",
      componentFailureCombinationsIncluded: true,
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal per member with EF 10 (sparse HTGR-specific support-system data, design-adjusted generic prior); the group frequency is the sum of the three member means, propagated by Monte Carlo downstream.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C11", "C"), sr("IE-C14", "C")],
  },
  {
    initiatorOrGroupId: "IEG-06",
    meanFrequency: { value: 0.015, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.007759, 6] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "DESIGN_BASED",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; frequencies from generic industry data, HTGR design reliability, and gas-cooled fleet experience plus the NGNP PRA white paper. No count of HTGR rod-withdrawal initiators exists, so the generic data is the prior and the posterior equals the design-adjusted prior. The hardware-driven bank withdrawal (IE-08) is an engineering reliability estimate of a CRDM/rod-control fault rate (DESIGN_BASED); the operator erroneous withdrawal (IE-41) is a human-error initiator (HEP_DEMAND). Both members stay within the reactivity-event band of 1E-2 to 1E-3 per plant-year.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["Reactor trip on high flux/power, control-rod insertion, and reserve shutdown are mitigation modeled in the downstream event sequences, not the IE frequency.", "Crediting trip or rod insertion in the initiator frequency would double-count mitigation; the IE frequency is the raw challenge rate of the positive-reactivity insertion."],
    operatorContribution: {
      controlRoomContributionEstimated: true,
      basis: "Operator-induced initiators in the group use a per-demand human error probability times the demand rate, summed with the hardware-driven members.",
    },
    uncertaintyCharacterization: {
      riskSignificant: false,
      method: "Lognormal per member mean with EF 10 (sparse design-derived and human-error data). The group frequency is the sum of the two member means (5E-3 + 1E-2 = 1.5E-2/yr), with Monte Carlo propagation downstream.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C13", "C")],
  },
  {
    initiatorOrGroupId: "IEG-07",
    meanFrequency: { value: 0.0165, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.009667, 4.7] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "FAULT_TREE",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; every member frequency from three external sources used as prior, posterior equal to the design-adjusted prior. (1) Generic reactor-trip/reactivity data for IE-09 (rod drop / inadvertent rod action); (2) HTGR design reliability for IE-10 (xenon), IE-11 (overcooling cut-set conditionals and circulator/SCS demand frequencies); (3) gas-cooled fleet experience for the HTGR-specific reactivity and overcooling phenomenology. Human-error inputs use THERP/SPAR-H screening. All four members fall in the reactivity-event band of about 1E-2 to 1E-3 per plant-year. Group basis is FAULT_TREE because IE-11 (combination overcooling) is the bounding member defining the top event.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["IE frequencies are quantified at the point of initiation, before any mitigating or recovery action. Operator recovery and the flux/power trip plus negative temperature feedback are credited downstream, not the IE frequency.", "Crediting recovery in the IE frequency would double-count credit taken in the event trees; the conditional factors inside the IE-11 fault tree are conditional-occurrence probabilities of the reactivity challenge, not post-initiation recovery."],
    faultTreeDetails: {
      modelId: "FT-IEG-07",
      topEvent: "IE-11 occurs: an overcooling reactivity transient from a sudden increase in primary heat-removal rate (core overcooling acting through the negative temperature coefficient) with transport barriers intact.",
      modifications: [],
      quantifiesFrequencyNotProbability: true,
      hfeContributionsIncluded: true,
      componentFailureCombinationsIncluded: true,
    },
    operatorContribution: {
      controlRoomContributionEstimated: true,
      basis: "Operator-induced initiators in the group use a per-demand human error probability times the demand rate, summed with the hardware-driven members.",
    },
    uncertaintyCharacterization: {
      riskSignificant: false,
      method: "Per-member lognormals with EF 10 for the data-rich rod-drop and the fault-tree overcooling member, EF 15 for the sparse xenon estimate and the human-error initiator. The GENERIC member carries a Jeffreys-prior posterior so its mean is (events+0.5)/reactorYears. The group frequency is the sum of the member means, propagated by Monte Carlo downstream.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C11", "C"), sr("IE-C14", "C"), sr("IE-C13", "C")],
  },
  {
    initiatorOrGroupId: "IEG-08",
    meanFrequency: { value: 0.0145, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.007447, 6.1] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "GENERIC_DATA",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; generic data is the prior and the design-adjusted prior is the posterior. Both members are at-initiator human-failure reactivity errors during low-power line-ups (fuel loading and startup), so frequencies come from generic HRA data (THERP/ASEP, NUREG/CR-1278) combined with the demand rate implied by about 1.5 refuelling outages per year, anchored to gas-cooled fleet experience and the MHTGR PSID startup/refuelling reactivity treatment. Per-demand HEPs already credit independent verification, source-range monitoring, source-range trip, and reserve-shutdown safeguards. EF 10 reflects sparse design-stage human-error data. Member rates are in the 1E-2 to 1E-3/yr reactivity band, not the rare 1E-5 to 1E-4 band, so rareEvent is false.",
    recoveryActionsIncluded: true,
    recoveryActionJustifications: ["IE-12: the per-demand HEP credits two-person/independent verification of the loading pattern and source-range monitoring during loading, procedural recovery actions consistent with the HTGR refuelling philosophy (IE-C5).", "IE-42: the per-demand HEP credits independent verification of the rod / reserve-shutdown line-up, the source-range neutron trip during approach to criticality, and administrative reactivity limits, recovering the mis-positioning before unplanned criticality (IE-C5)."],
    operatorContribution: {
      controlRoomContributionEstimated: true,
      basis: "Operator-induced initiators in the group use a per-demand human error probability times the demand rate, summed with the hardware-driven members.",
    },
    genericDataComparison: {
      performed: true,
      differencesExplanation: "Generic United States power-reactor rates adjusted to the Generic HTGR design and the gas-cooled fleet experience.",
    },
    uncertaintyCharacterization: {
      riskSignificant: false,
      method: "Lognormal per member with EF 10 (sparse pre-operational human-error data); member means summed for the group mean, with group uncertainty propagated by Monte Carlo over the two lognormals.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C13", "C"), sr("IE-C5", "C")],
  },
  {
    initiatorOrGroupId: "IEG-09",
    meanFrequency: { value: 0.01, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.003753, 10.1] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "DESIGN_BASED",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; frequencies from generic industry component data, HTGR design reliability, and gas-cooled-fleet experience plus the MHTGR PSID. The small primary helium leak is an HTGR-specific primary-helium-pressure-boundary breach with no direct industry event count, so it is a design-based engineering estimate rather than a Jeffreys posterior. The value is built from a small-bore-penetration/seal leak-site population (~200 sites) times a generic small-leak rate per site-year (~5E-5), reproducing the ~1E-2/yr small-leak band. With no plant operating data the design-adjusted prior equals the posterior. As a primary-boundary depressurization initiator at 1E-2/yr this group is risk-significant per criterion 4 and is not LOW.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["The frequency is the rate of occurrence of the primary-helium-boundary small leak; leak isolation and helium makeup are downstream mitigating responses, not credits against the initiator frequency.", "Crediting pre-initiator recovery would mask the boundary breach; the slow-depressurization framing is preserved for the downstream sequence model rather than absorbed into the initiator rate."],
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal on the member frequency with EF 10 (median 1E-2/yr, 5th 1E-3/yr, 95th 1E-1/yr), reflecting a sparse-data HTGR-specific boundary event supported by gas-cooled boundary-population reasoning. The single-member group frequency carries the same lognormal, propagated by Monte Carlo downstream.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C")],
  },
  {
    initiatorOrGroupId: "IEG-10",
    meanFrequency: { value: 0.003, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.0009389, 10.7] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "DESIGN_BASED",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; frequencies from generic industry boundary-break data, HTGR design reliability, and gas-cooled fleet experience plus the MHTGR PSID/PRA. The MHTGR PRA primary-leak-by-size families and the NGNP PRA barrier-integrity framework provide the intermediate-break basis. No HTGR-specific count exists for an intermediate primary helium break or a stuck-open primary relief path, so both members are DESIGN_BASED engineering reliability estimates rather than Jeffreys-prior posteriors. These are two of the four rare depressurization-breach groups, carrying the larger error factor (20) and rareEvent=true.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["IE frequencies are quantified at the boundary-breach demand and exclude downstream mitigation; recovery of the depressurization (isolation of the stuck-open relief path for IE-18, depressurization management plus passive RCCS) is modeled in the event-tree sequences, not the initiator frequency.", "The unisolable moderate break IE-16 has no pre-event recovery by definition, so crediting recovery would be physically inconsistent; recovery is left to the mitigating-system response."],
    rareEventTreatment: {
      industryGenericDataUsed: true,
      plantSpecificAugmentation: "HTGR primary-boundary and steam-generator-tube design reliability and gas-cooled fleet experience.",
      expertJudgmentUsed: true,
      expertJudgmentBasis: "Pre-operational Generic HTGR with no plant operating data; frequencies from generic industry boundary-break data, HTGR design reliability, and gas-cooled fleet experience plus the MHTGR PSID/PRA. The MHTGR PRA primary-leak-by-size families ",
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal per member mean with EF 20 (rare, sparse-data HTGR-specific boundary-break events with no operating count). Member means are propagated as lognormals and the group frequency is the sum of the member distributions, computed downstream by Monte Carlo / moment propagation.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C17", "C")],
  },
  {
    initiatorOrGroupId: "IEG-11",
    meanFrequency: { value: 5e-05, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [9.557e-06, 20] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "DESIGN_BASED",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant-specific operating data; frequencies from generic industry data, HTGR design-reliability estimates, and gas-cooled-fleet experience plus the MHTGR PSID. The design-adjusted estimate is the prior, and with zero plant exposure the posterior mean equals it. The single member is a large primary-boundary break with no industry count, so a DESIGN_BASED structural-reliability estimate: a guillotine-scale break of a large primary line or a vessel-scale breach is a beyond-design-basis structural event, placed mid-band at 5E-5/yr within the 1E-5 to 1E-4/yr large-break / D-LOFC band, with a wide EF 20. This is the large-break rare group of criterion 3.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["The quantity is the rate at which the large primary-boundary break occurs, not a mitigated-sequence frequency, so no operator or system recovery is credited in the rate.", "The break is a near-instantaneous structural rupture with rapid depressurization; there is no pre-initiator recovery window.", "Mitigation of the resulting depressurized loss of forced cooling (passive RCCS, core conduction/radiation cooldown) is credited downstream, not in this initiator frequency."],
    rareEventTreatment: {
      industryGenericDataUsed: true,
      plantSpecificAugmentation: "HTGR primary-boundary and steam-generator-tube design reliability and gas-cooled fleet experience.",
      expertJudgmentUsed: true,
      expertJudgmentBasis: "Pre-operational Generic HTGR with no plant-specific operating data; frequencies from generic industry data, HTGR design-reliability estimates, and gas-cooled-fleet experience plus the MHTGR PSID. The design-adjusted estimate is the prior, a",
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal with median equal to the design-based point value and EF 20, propagated by Monte Carlo to the group frequency. With zero plant exposure the posterior mean equals the design-adjusted prior mean; the wide error factor captures the sparse-data, rare-structural-event epistemic uncertainty.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C17", "C")],
  },
  {
    initiatorOrGroupId: "IEG-12",
    meanFrequency: { value: 0.018, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.006729, 10] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "GENERIC_DATA",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant-specific operating history; frequency built from generic HRA data plus gas-cooled fleet experience. IE-43 is an at-initiator human-failure event (erroneous primary depressurization / inadvertent vent or relief-valve opening during maintenance), quantified by HEP_DEMAND: per-demand HEP times depressurization-relevant manual evolutions per year. The per-demand HEP (3E-3) is from THERP NUREG/CR-1278 and SPAR-H NUREG/CR-6883 for a proceduralized manual valve evolution under off-normal shutdown conditions with self-recovery. The demand rate (~6/yr) is derived from ~1.5 refuelling outages with several boundary line-up/venting evolutions each in POS-04, POS-05, POS-08. The inadvertent vent in shutdown is isolable and bounded by re-isolation plus SCS and passive RCCS. As a high-frequency depressurization group it is risk-significant per criterion 4 and not LOW. With no plant operating data the design-adjusted prior is the posterior.",
    recoveryActionsIncluded: true,
    recoveryActionJustifications: ["The per-demand HEP of 3E-3 is a post-recovery value: the manual depressurization evolution is proceduralized with a self-checking/verification step and an independent-check opportunity, so the screening HEP credits operator self-recovery before the vent path is fully opened.", "Mitigation recovery after the initiator (re-isolation and restoration of cooling) is captured downstream in the event-sequence and mitigating-system models, not the IE frequency, so no additional post-initiator recovery is folded into 1.8E-2/yr."],
    operatorContribution: {
      controlRoomContributionEstimated: true,
      basis: "Operator-induced initiators in the group use a per-demand human error probability times the demand rate, summed with the hardware-driven members.",
    },
    genericDataComparison: {
      performed: true,
      differencesExplanation: "Generic United States power-reactor rates adjusted to the Generic HTGR design and the gas-cooled fleet experience.",
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal on the mean frequency with EF 10, reflecting sparse human-error inputs with no plant-specific history; the HEP and the demand count are the dominant uncertainty contributors, propagated by Monte Carlo on the product hep x demandsPerYear, with the design-adjusted generic prior taken as the posterior mean.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C13", "C"), sr("IE-C5", "C")],
  },
  {
    initiatorOrGroupId: "IEG-13",
    meanFrequency: { value: 0.01363, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.00922, 4.1] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "GENERIC_DATA",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; frequencies from generic industry data, HTGR design reliability, and gas-cooled-fleet experience plus the MHTGR PSID. The generic data is the prior and the posterior equals the design-adjusted prior. IE-20 (small SG tube leak) is GENERIC from generic SG-tube-leak experience reframed for the helium-to-water boundary; its rate is the Jeffreys posterior mean (events+0.5)/reactorYears. IE-23 (circulator water-lubricated bearing/seal water ingress) is DESIGN_BASED because no fleet count exists for that HTGR-specific helium-to-water interface, so it is an engineering reliability allocation. This is a water-ingress group, so per criterion 4 it is risk-significant and not LOW. Member rates are in the ~1E-2/yr leak band, not the rare 1E-5 to 1E-4 band, so rareEvent is false.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["IE frequency is the demand rate of the boundary in-leak; mitigation is by helium moisture monitoring plus helium purification and SG or circulator-seal isolation, which act after the initiator and belong to the event-sequence response, not the IE frequency.", "Crediting recovery against the initiator would double-count detection-and-isolation reliability modeled downstream, so the per-member frequencies are kept at the raw boundary-breach demand rate."],
    genericDataComparison: {
      performed: true,
      differencesExplanation: "Generic United States power-reactor rates adjusted to the Generic HTGR design and the gas-cooled fleet experience.",
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal per member with EF 5 for the data-rich GENERIC member IE-20 and EF 10 for the sparse DESIGN_BASED member IE-23. IE-20 carries a Jeffreys-prior posterior mean; IE-23 a design-adjusted prior mean. The group mean is the sum of member means, propagated by Monte Carlo downstream.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C")],
  },
  {
    initiatorOrGroupId: "IEG-14",
    meanFrequency: { value: 0.0055, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.003258, 4.8] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "GENERIC_DATA",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; member frequencies from generic industry data, HTGR design reliability, and gas-cooled fleet experience plus the MHTGR PSID. The generic data is the prior and the posterior mean equals the design-adjusted prior. IE-13 uses generic SG-tube-rupture experience (NUREG/CR-6928, EPRI SG integrity, Fort St. Vrain SG experience) as a Jeffreys-prior posterior mean. IE-21, the bounding moderate-ingress SGTR breach, has no industry count and is an HTGR-specific design-reliability estimate anchored to LWR SGTR rates and the MHTGR PSID water-ingress basis. IE-47 is a human-error initiator with HEP from NUREG-1921/THERP and demand frequency from ~1.5 refuelling outages with secondary-side line-up evolutions. Member rates are in the SG-tube-rupture ~1E-3/yr band, not the rare 1E-5 to 1E-4 band, so rareEvent is false; as a water-ingress group it stays risk-significant per criterion 4.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["IE frequencies are the bare challenge rate; operator recovery and mitigating-system response (moisture-high trip, scram, SG isolation and feedwater trip, SG dump/blowdown, helium purification, reserve shutdown) are credited downstream, not the IE frequency.", "For the IE-47 mis-line-up initiator the HEP is the unrecovered probability of committing the line-up error that admits moisture; post-initiator recovery of the resulting ingress is a separate event-tree credit and is excluded from the initiator frequency."],
    operatorContribution: {
      controlRoomContributionEstimated: true,
      basis: "Operator-induced initiators in the group use a per-demand human error probability times the demand rate, summed with the hardware-driven members.",
    },
    genericDataComparison: {
      performed: true,
      differencesExplanation: "Generic United States power-reactor rates adjusted to the Generic HTGR design and the gas-cooled fleet experience.",
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal per member with EF 10 (sparse-data SGTR boundary events and a human-error initiator), giving a 90% credible interval of mean/EF to mean*EF; IE-13 is a Jeffreys-prior (events+0.5)/reactorYears posterior mean. Member distributions are summed by Monte Carlo / moment propagation downstream to obtain the group mean and 5th/95th percentiles.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C13", "C")],
  },
  {
    initiatorOrGroupId: "IEG-15",
    meanFrequency: { value: 8e-05, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [9.48e-06, 29.9] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "FAULT_TREE",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant-specific operating data; frequencies from generic industry data, HTGR design reliability, and gas-cooled fleet experience plus the MHTGR PSID, with the gas-fleet SG and water-ingress record as the primary anchor. The generic/design-adjusted prior is the posterior. IE-22 is a combination BDBE (large/multiple SGTR with primary relief-valve lift), quantified by a fault-tree sum of cut-set-like terms: a base large/multiple SGTR rupture frequency (~1E-3/yr, top of the SG-tube-rupture band for the multiple-tube case) with the conditional probability of relief-valve lift (~5E-2), plus an escalation term where moisture detection and dump-and-isolate fail to terminate ingress before relief lift (SGTR ~1E-3/yr times ~3E-2). The two terms sum to 8E-5/yr, in the 1E-5 to 1E-4/yr large/multiple BDBE SGTR band. This is the large-BDBE-SGTR rare group of criterion 3.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["No operator recovery credit is taken in the IE frequency itself, per standard PRA practice that recovery is modeled downstream in the event-tree mitigation.", "The moisture-monitor dump-and-isolate response appears only as a hardware/automatic failure term inside the fault tree (defining escalation to the relief-lift BDBE condition); it is a system unavailability, not a credited post-initiator recovery action.", "Crediting operator recovery here would double-count against the water-ingress mitigation modeled in the downstream event tree."],
    faultTreeDetails: {
      modelId: "FT-IEG-15",
      topEvent: "IE-22: Large / multiple steam generator tube rupture with primary relief-valve lift (BDBE water ingress into the helium primary)",
      modifications: [],
      quantifiesFrequencyNotProbability: true,
      hfeContributionsIncluded: false,
      hfeExclusionBasis: "The bounding fault-tree event is a hardware combination; any operator-error initiators in the group are quantified separately by HEP times demand and summed in.",
      componentFailureCombinationsIncluded: true,
    },
    rareEventTreatment: {
      industryGenericDataUsed: true,
      plantSpecificAugmentation: "HTGR primary-boundary and steam-generator-tube design reliability and gas-cooled fleet experience.",
      expertJudgmentUsed: true,
      expertJudgmentBasis: "Pre-operational Generic HTGR with no plant-specific operating data; frequencies from generic industry data, HTGR design reliability, and gas-cooled fleet experience plus the MHTGR PSID, with the gas-fleet SG and water-ingress record as the ",
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal with EF 30 (sparse-data BDBE combination event), propagated by Monte Carlo on the fault-tree product-and-sum to obtain the group mean frequency.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C11", "C"), sr("IE-C14", "C"), sr("IE-C17", "C")],
  },
  {
    initiatorOrGroupId: "IEG-16",
    meanFrequency: { value: 0.006, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.002253, 10] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "GENERIC_DATA",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; the generic industry rate is the prior and the posterior equals the design-adjusted prior. IE-26 is an SCS helium-to-water HX tube failure, the same boundary-failure class as a SG tube leak, quantified from generic HX/SG-tube-failure industry data adjusted by HTGR design reliability and gas-cooled fleet experience. The Jeffreys posterior mean (events+0.5)/reactorYears is used with one mapped event over an effective 250 reactor-year exposure, scaled down from the full SG-tube-leak band for the smaller, lower-pressure, lower-duty shutdown-only SCS HX. This is a water-ingress group; member rate is in the ~1E-2/yr leak band, not the rare 1E-5 to 1E-4 band, so rareEvent is false while the group remains risk-significant per criterion 4.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["Recovery is not credited in the IE frequency. The IE frequency counts only the occurrence of the SCS HX boundary failure with water ingress. The credited responses (isolate the SCS HX, transfer core-heat removal to the passive RCCS) are mitigation modeled downstream, not reductions to the initiator frequency."],
    genericDataComparison: {
      performed: true,
      differencesExplanation: "Generic United States power-reactor rates adjusted to the Generic HTGR design and the gas-cooled fleet experience.",
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal on the member mean frequency with EF 10 (one indirectly-mapped event and sparse gas-cooled-specific data). The mean is the Jeffreys-prior posterior mean (events+0.5)/reactorYears. The single-member group frequency equals the member mean and its lognormal spread, propagated by Monte Carlo downstream.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C")],
  },
  {
    initiatorOrGroupId: "IEG-17",
    meanFrequency: { value: 0.008, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.004207, 6] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "DESIGN_BASED",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; the generic data is the prior and the posterior equals the design-adjusted prior. Both members are HTGR-specific ex-boundary interfacing-system breaches with no industry event count, so each frequency is a DESIGN_BASED engineering reliability estimate. The estimates draw on HTGR design reliability of the helium auxiliary connections and gas-cooled fleet helium-service experience plus the MHTGR PSID primary-leak-by-size categorization and NGNP PRA interfacing-systems breach families. Both members land in the ex-boundary helium-service breach band of 1E-3 to 1E-2/yr, not the rare 1E-5 to 1E-4 band, so rareEvent is false; the group remains risk-significant as an ex-boundary depressurization/release path per criterion 4.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["IE frequency is the unmitigated demand frequency for the breach occurring. Recovery (automatic isolation on low pressure or high activity, redundant helium makeup, confinement retention) is credited downstream, not the initiator frequency.", "Crediting isolation or makeup recovery in the initiator would double-count mitigation the accident-sequence model evaluates, so the per-member frequencies are left as raw breach occurrence rates."],
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal per member with EF 10 (sparse HTGR-specific ex-boundary breach estimates). The group frequency is the sum of the two member means, with member uncertainties propagated by Monte Carlo downstream.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C18", "C")],
  },
  {
    initiatorOrGroupId: "IEG-18",
    meanFrequency: { value: 0.008, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.004215, 5.9] }, source: "Step-09 quantification, GENERIC_DATA basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "GENERIC_DATA",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; the generic data is the prior and the posterior equals the design-adjusted prior. Member frequencies from three sources: generic industry refuelling/fuel-handling event data (NUREG/CR-6928 class), gas-cooled fleet refuelling experience and the MHTGR PSID fuel-handling treatment, and standard pre-initiator HRA (SPAR-H/THERP) for the line-up action. IE-38 uses a Jeffreys-prior posterior mean (events+0.5)/reactorYears over an exposure scaled to ~1.5 refuelling outages per year; IE-44 uses HEP-per-demand times the refuelling line-up demand rate. Member rates are in the 1E-3 to 1E-2/yr fuel-handling band, not the rare 1E-5 to 1E-4 band, so rareEvent is false. Fuel-handling is not a high-frequency support, depressurization, or air/water-ingress group, so it remains LOW per criterion 4.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["IE frequencies are quantified at the point the fuel-handling source event occurs; post-initiator recovery (confinement isolation, ventilation/filtration, restoring SCS handling cooling) is credited downstream, not the initiator frequency.", "For IE-44 the independent verification of the refuelling line-up is a pre-initiator barrier already embedded in the per-demand HEP, lowering the HEP rather than being a separately credited recovery action; no additional initiator-level recovery is taken."],
    operatorContribution: {
      controlRoomContributionEstimated: true,
      basis: "Operator-induced initiators in the group use a per-demand human error probability times the demand rate, summed with the hardware-driven members.",
    },
    genericDataComparison: {
      performed: true,
      differencesExplanation: "Generic United States power-reactor rates adjusted to the Generic HTGR design and the gas-cooled fleet experience.",
    },
    uncertaintyCharacterization: {
      riskSignificant: false,
      method: "Lognormal per member with EF 10 (sparse design-stage data, no plant-specific history). IE-38 mean is the Jeffreys-prior posterior mean (events+0.5)/reactorYears; IE-44 mean is hep times demandsPerYear. The group frequency is the sum of the two member lognormals, propagated by Monte Carlo downstream.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C13", "C")],
  },
  {
    initiatorOrGroupId: "IEG-19",
    meanFrequency: { value: 0.01, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.003756, 9.9] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "FAULT_TREE",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; frequency from generic industry component data, HTGR design reliability, and gas-cooled fleet experience plus the MHTGR PSID. The generic/design-reliability values form the prior and the design-adjusted prior equals the posterior. IE-39 has no direct industry count, so it is a fault-tree combination of generic component factors: storage-cooling train trip frequency and backup unavailability, support-utility loss frequency with a conditional non-restoration probability, and a cooling-path blockage/inventory-loss rate (NUREG/CR-6928 class). Loss of stored-fuel cooling is a slow, large-grace-time event distinct from the air/water-ingress and depressurization groups, so it remains LOW per criterion 4.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["The initiating event is the loss of the stored-fuel forced-cooling function, so operator restoration of cooling is modeled downstream as mitigation, not a reduction of the initiating frequency.", "The large passive grace time of the stored TRISO fuel and the passive heat-loss paths are treated as event-tree mitigation features, not a divisor on the initiator frequency.", "The conditional non-restoration factor (0.1) on the support-utility-loss term is a short-window failure-to-restore-support-before-challenge factor internal to that cut set, not a separately credited operator recovery action."],
    faultTreeDetails: {
      modelId: "FT-IEG-19",
      topEvent: "Loss of forced cooling to the ex-core spent / stored fuel storage source (IE-39)",
      modifications: [],
      quantifiesFrequencyNotProbability: true,
      hfeContributionsIncluded: false,
      hfeExclusionBasis: "The bounding fault-tree event is a hardware combination; any operator-error initiators in the group are quantified separately by HEP times demand and summed in.",
      componentFailureCombinationsIncluded: true,
    },
    uncertaintyCharacterization: {
      riskSignificant: false,
      method: "Lognormal with EF 10 (sparse pre-operational gas-cooled stored-fuel-cooling data); mean = 1.0E-2/yr from the fault-tree term sum. Group-level uncertainty is propagated downstream by Monte Carlo / moment propagation of the single member's lognormal.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C11", "C"), sr("IE-C14", "C")],
  },
  {
    initiatorOrGroupId: "IEG-20",
    meanFrequency: { value: 0.0008, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.0001525, 20.1] }, source: "Step-09 quantification, DESIGN_BASED basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "DESIGN_BASED",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; frequency from generic industry data, HTGR design reliability, and gas-cooled fleet experience plus the MHTGR PSID. The generic data is the prior and the posterior equals the design-adjusted prior. IE-19 has no direct industry count because no operating reactor couples an SG-tube rupture with a depressurizing helium-boundary breach, so it is DESIGN_BASED: the generic single-tube SGTR rate near 1E-3/yr from PWR experience (NUREG/CR-5750) is the anchor, adjusted by the HTGR SG-tube design and the conditional that the rupture breaches the high-pressure helium boundary, giving a mean of 8E-4/yr. This is one of the four rare depressurization-breach groups of criterion 3, so it carries the larger error factor (20) and rareEvent=true.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["The IE frequency is the unmitigated rate of the SG-tube-rupture boundary breach; SG isolation, moisture/helium purification, and the depressurized-cooling response are mitigating actions credited downstream, not the IE frequency."],
    rareEventTreatment: {
      industryGenericDataUsed: true,
      plantSpecificAugmentation: "HTGR primary-boundary and steam-generator-tube design reliability and gas-cooled fleet experience.",
      expertJudgmentUsed: true,
      expertJudgmentBasis: "Pre-operational Generic HTGR with no plant operating data; frequency from generic industry data, HTGR design reliability, and gas-cooled fleet experience plus the MHTGR PSID. The generic data is the prior and the posterior equals the design",
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal with EF 20 (rare, sparse-data HTGR-specific depressurization-coupled SGTR breach); the 8E-4/yr value is the mean of the lognormal and propagates as the design-adjusted prior with no plant-specific update.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C17", "C")],
  },
  {
    initiatorOrGroupId: "IEG-21",
    meanFrequency: { value: 0.03, units: FrequencyUnit.PER_PLANT_YEAR, distribution: { type: DistributionType.LOGNORMAL, parameters: [0.01136, 9.9] }, source: "Step-09 quantification, FAULT_TREE basis; generic industry, HTGR design, and gas-cooled fleet data." },
    basis: "FAULT_TREE",
    plantCalendarYearBasis: true,
    posTimeFractionApplied: true,
    dataSourceJustification: "Pre-operational Generic HTGR with no plant operating data; frequencies from generic industry data, HTGR design reliability, and gas-cooled fleet experience plus the MHTGR PSID. For IE-40 there is no industry count for a loss of the helium inventory/pressure (makeup) control system, so the value is a fault-tree combination of a running makeup/pressure-control train trip rate, the unavailability of the redundant makeup path, and a standby common-cause/maintenance loss-of-function term, anchored to the MHTGR PSID support-systems treatment and generic non-safety auxiliary/standby-train reliability. The generic data is the prior and the posterior equals the design-adjusted prior. This is a high-frequency support-system group (3E-2/yr), so per criterion 4 it is risk-significant and not LOW.",
    recoveryActionsIncluded: false,
    recoveryActionJustifications: ["The quantified frequency is the as-challenged loss of the helium inventory/pressure makeup-control function; no operator recovery of the control system is credited in the IE frequency.", "Recovery and makeup restoration are credited downstream in the mitigating-system and event-sequence models, not the IE frequency, to avoid double-counting.", "The passive RCCS bounds fuel temperature on loss of forced cooling independent of helium makeup, so no recovery credit is needed to keep the initiator within its safety role."],
    faultTreeDetails: {
      modelId: "FT-IEG-21",
      topEvent: "IE-40: Loss of the helium inventory and pressure (makeup) control system (primary-circuit inventory/pressure-control function unavailable), per plant-year.",
      modifications: [],
      quantifiesFrequencyNotProbability: true,
      hfeContributionsIncluded: false,
      hfeExclusionBasis: "The bounding fault-tree event is a hardware combination; any operator-error initiators in the group are quantified separately by HEP times demand and summed in.",
      componentFailureCombinationsIncluded: true,
    },
    uncertaintyCharacterization: {
      riskSignificant: true,
      method: "Lognormal per member with EF 10 (sparse HTGR-specific auxiliary support system, no operating count); the fault-tree member mean is the sum of its cut-set-like term means, each term the product of its factor means, propagated to the group total downstream. With no plant operating data the posterior equals the design-adjusted lognormal prior.",
      probabilisticRepresentationProvided: true,
    },
    implementsSrs: [sr("IE-C2", "C"), sr("IE-C7", "C"), sr("IE-C8", "C"), sr("IE-C19", "C"), sr("IE-C11", "C"), sr("IE-C14", "C")],
  },
];

const NOW = "2026-06-20T12:00:00.000Z";

const PENDING = "Pending. Populated as the analysis is built out in the later steps.";

export const IE_ANALYSIS: InitiatingEventsAnalysis = {
  uuid: "ie-generic-1",
  name: "IE Workbook 1",
  type: TechnicalElementTypes.INITIATING_EVENT_ANALYSIS,
  version: "1",
  created: "2026-06-20T12:00:00.000Z",
  modified: NOW,
  owner: "Aakash Patel",
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: "2026-06-20T12:00:00.000Z", actor: "Aakash Patel" }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "1", lastUpdated: NOW, schemaVersion: "0.0.1" },
    analysisDate: NOW,
    analysts: ["Aakash Patel"],
    reviewers: REVIEWERS,
    scope: "Initiating Event Analysis for the Generic HTGR. Internal events across all retained plant operating states (pre-operational).",
    limitations: ["Pre-operational; pending as-built validation."],
    lastModifiedDate: NOW,
    lastModifiedBy: "Aakash Patel",
    plantIdentity: {
      name: "Generic HTGR",
      vendor: "Generic Nuclear LLC",
      reactorType: "High-temperature gas-cooled reactor (prismatic)",
      thermalPower: "350 MWth",
      primaryCoolant: "Helium",
      intermediateCoolant: "None (direct steam cycle)",
      powerConversionFluid: "Steam (Rankine cycle)",
      siteName: "Generic site",
    },
  },
  conformanceMatrix: [
    cm("IE-A2", "A", "MET", BOTH, "Escape mechanisms identified for the in-core TRISO fuel, primary-circuit plateout, spent fuel blocks, and primary helium activity."),
    cm("IE-A1", "A", "MET", BOTH, "47 initiating events identified by the structured, systematic, plant-specific process across the challenge categories."),
    cm("IE-A5", "A", "MET", BOTH, "All seven challenge categories considered. The five internal-events categories are in scope; internal fire and flood and the external hazards are out of scope and handled by separate hazard analyses."),
    cm("IE-A6", "A", "MET", BOTH, "Hazard-combination initiators considered: the fifteen hazard groups carry their IE-A6 combinations, including seismically-induced fire, flood, and steam-line break with water ingress, seismic core-geometry-distortion ATWS, fire-induced internal flood, and tornado-missile with loss of offsite power. Each combination is screened to its dedicated hazard PRA element."),
    cm("IE-A8", "A", "MET", BOTH, "Generic analyses and gas-cooled and comparable-system operating experience reviewed for completeness."),
    cm("IE-A9", "A", "MET", BOTH, "FMEA carried to the subsystem and train level across the main and support systems; 22 initiators identified inductively."),
    cm("IE-A10", "A", "MET", BOTH, "Multiple-failure and support-system initiators included in the systematic evaluation."),
    cm("IE-A11", "A", "MET", BOTH, "Events at comparable gas-cooled and modular-reactor plants reviewed across the applicable states."),
    cm("IE-A12", "A", "MET", BOTH, "Identified events adversarially re-checked for overlooked initiators; genuine gaps added and unsupported events dropped."),
    cm("IE-A14", "A", "MET", PRE, "Similar-plant operating experience reviewed for initiating-event precursors at the pre-operational stage."),
    cm("IE-A15", "A", "MET", BOTH, "DC and instrument power, instrument air, component cooling, HVAC, and helium purification support-system alignments swept."),
    cm("IE-A16", "A", "NOT_APPLICABLE", BOTH, "Single-reactor site; multi-reactor initiating events not applicable."),
    cm("IE-B1", "B", "MET", BOTH, "Grouping facilitates event-sequence analysis and quantification and is justified not to change risk-significant sequences: 21 groups, each bounded by its most limiting member, with masking checks that split wet depressurization, large water ingress, and inventory-control losses into their own groups."),
    cm("IE-B2", "B", "MET", BOTH, "A structured process was used: three independent groupings by mitigation response, safety-function challenge, and HTGR phenomenology, judged and reconciled, then adversarially audited for bounding validity and masking."),
    cm("IE-B3", "B", "MET", PRE, "Pre-operational: the grouping detail is consistent with the available design information for the Generic HTGR."),
    cm("IE-B4", "B", "MET", BOTH, "Events grouped only when they share mitigation requirements and are bounded by the worst-case member, with no risk-significant sequence masked. The audit moved IE-13 to the moderate-ingress group and split IE-19 and IE-40 into their own groups to preserve distinct depressurization and inventory-control responses."),
    cm("IE-B5", "B", "NOT_APPLICABLE", BOTH, "Single-reactor site: no multi-reactor or shared-source group combinations apply."),
    cm("IE-B6", "B", "MET", PRE, "Pre-operational: assumptions from missing as-built detail that could affect grouping are tracked with the pre-operational assumptions and close at commissioning."),
    cm("IE-C9", "C", "MET", BOTH, "Screening applied the two-stage IE-C9 gate to all 47 initiators: the barrier-integrity precondition plus the screening-criteria test. 43 are retained, with boundary breaches held by the barrier gate and intact-barrier transients held by the unmet criteria. Loss of purification screened out under SCR-3, and the service-water, purification-line, and instrument-line events merged into their bounding events under SCR-1 and SCR-2."),
    cm("IE-C1", "C", "NOT_APPLICABLE", BOTH, "Operating-plant SR: the Generic HTGR is pre-operational, so the pre-operational data SR IE-C2 governs instead."),
    cm("IE-C2", "C", "MET", PRE, "Frequencies built from generic industry data, HTGR design reliability, and gas-cooled fleet experience (AVR, THTR-300, Fort St. Vrain, and the MHTGR safety analysis)."),
    cm("IE-C3", "C", "NOT_APPLICABLE", BOTH, "Operating-plant SR: no current operating data exist for this pre-operational plant."),
    cm("IE-C4", "C", "NOT_APPLICABLE", BOTH, "Operating-plant recovery SR: superseded for pre-operational by IE-C5."),
    cm("IE-C5", "C", "MET", PRE, "Recovery is modeled in the downstream event trees, not credited against the initiator frequency, consistent with the operating philosophy."),
    cm("IE-C6", "C", "NOT_APPLICABLE", BOTH, "Operating-plant Bayesian-update SR: with no plant data the design-adjusted generic prior is the posterior."),
    cm("IE-C7", "C", "MET", PRE, "Gas-cooled fleet experience used for the HTGR-specific events where power-reactor data are insufficient."),
    cm("IE-C8", "C", "MET", BOTH, "Group frequencies are on a plant-calendar-year basis with the POS time fraction applied."),
    cm("IE-C10", "C", "NOT_APPLICABLE", BOTH, "Operating-plant data-representativeness SR: addressed under the pre-operational data SRs."),
    cm("IE-C11", "C", "MET", BOTH, "Loss of main loop and the support-system losses use fault trees, with operator-error initiators summed in by HEP times demand."),
    cm("IE-C12", "C", "MET", BOTH, "The fault trees produce a failure frequency rather than a probability, with component-data and human-reliability inputs."),
    cm("IE-C13", "C", "MET", BOTH, "Operator-induced initiators are quantified by a human error probability times the demand rate and identified separately within the group."),
    cm("IE-C14", "C", "MET", BOTH, "The combination fault trees include a running-train failure with the standby or backup train unavailable."),
    cm("IE-C15", "C", "MET", BOTH, "Design-specific information is used in assessing recovery actions and demand rates."),
    cm("IE-C16", "C", "MET", BOTH, "Design-based rates were compared against generic data as a reasonableness check."),
    cm("IE-C17", "C", "MET", BOTH, "The large break, the large BDBE steam-generator-tube rupture, and the wet depressurization breach use industry generic data augmented by HTGR design reliability, with larger error factors."),
    cm("IE-C18", "C", "MET", BOTH, "The ex-boundary helium-service breach frequency reflects the pathway configuration, interlocks, and isolation."),
    cm("IE-C19", "C", "MET", BOTH, "Every group carries a mean and a lognormal uncertainty distribution, and the risk-significant groups are flagged (CC-II)."),
  ],
  internalReviewComments: { openCount: 0, resolvedCount: 0, comments: [] },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Internal events across all retained plant operating states for the full operating cycle of the Generic HTGR.",
  includesNonInternalHazardGroups: false,
  applicablePlantOperatingStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08"],
  searchMethods,
  initiators: INITIATORS,
  masterLogicDiagrams: [MLD_MODEL],
  heatBalanceFaultTrees: HBFT_MODELS,
  failureModesAnalyses: [FMEA_MODEL],
  hazardAnalyses: HAZARD_ANALYSES,
  initiatingEventGroups: INITIATING_EVENT_GROUPS,
  completenessSearch: COMPLETENESS,
  sourceMechanisms,
  identificationReviews: REVIEWS,
  plantRepresentationAccuracy: {
    scope: "PRE_OPERATIONAL",
    accuracy: ImportanceLevel.MEDIUM,
    basis: "Scope, plant identity, and radioactive sources established from the Generic HTGR design basis and the POS handoff. Initiating-event identification and quantification are pending in later steps.",
    detailConsistentWithPlant: true,
    sufficientForRiskSignificantContributors: false,
    sufficiencyJustification: "Sufficiency cannot be judged until the initiating-event identification is complete.",
    highConfidenceAreas: ["Scope boundary", "Radioactive sources in scope"],
    lowerConfidenceAreas: ["Initiating-event set (pending)"],
    improvementPlans: ["Complete the systematic identification across all seven challenge categories in steps 03 and 04."],
    implementsSrs: [sr("IE-D2", "D")],
  },
  quantifications: QUANTIFICATIONS,
  screeningRecords: SCREENING_RECORDS,
  modelUncertainty: {
    uuid: "ie-mu-1",
    name: "IE model uncertainty documentation",
    uncertaintySources: [],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  documentation: {
    processDescription:
      "Initiating events were identified by a forward search that combined deductive and inductive methods. A master logic diagram decomposed an uncontrolled radionuclide release through the four plant safety functions down to the events that challenge each one. Heat-balance fault trees traced the full-power energy balance to the imbalances that defeat heat removal. A failure modes and effects analysis swept every front-line and support system to the component level. An operating-experience review and a generic HTGR initiator catalogue were screened for events the deductive models might miss. Each candidate was then tested against the plant operating states and the radioactive source inventory carried in the POS workbook.",
    inputSources: "Generic HTGR POS workbook (operating states and radioactive sources), the MHTGR-350 benchmark, the Modular HTGR Safety Characterization, and the NGNP PRA white paper.",
    appliedMethods:
      "Six search methods were applied. The master logic diagram and the heat-balance fault trees formed the deductive backbone. The FMEA, a HAZOP of the power-conversion and heat-transport line-ups, and a preliminary hazard screen formed the inductive sweep. An operating-experience review and a generic-list comparison were the experience methods. The methods are recorded in the search-methods catalogue with their coverage and supporting standards, and the master logic diagram, the four heat-balance fault trees, and the FMEA are stored as the worked artifacts behind the search.",
    resultsSummary: PENDING,
    functionalCategoriesConsidered:
      "All seven challenge categories were considered. Five are in scope for this internal-events analysis: anticipated transients, reactor coolant boundary breaches, breaches through interfacing systems, special HTGR-specific initiators, and human-failure initiators. The two hazard categories, internal hazards such as fire and flood and external hazards, are out of scope here and are carried by the separate hazard analyses. The forty-seven retained initiators span all five in-scope categories in every operating state where they are credible. The two hazard categories were not left implicit. Fifteen internal and external hazard groups were enumerated, each mapped to the plant-level initiators it would induce and screened to its dedicated hazard PRA element, with the hazard-combination cases recorded for IE-A6.",
    plantUniqueInitiatorsSearch:
      "The HTGR-specific initiators were searched explicitly. Moisture and water or steam ingress through the steam generator, air ingress on a boundary breach, graphite and core-temperature transients, helium-circulator and forced-cooling faults, and the pressurized and depressurized loss-of-forced-cooling families were all surfaced by the heat-balance fault trees and the special-initiator branch of the master logic diagram. These are the events a light-water template would miss, and they are the dominant challenges to heat removal and to the TRISO and graphite barriers.",
    stateSpecificInitiatorsSearch:
      "Each initiator was tested against the eight retained operating states. Events that exist only in a given line-up were captured there. Examples are the shutdown and refueling heat-removal losses, the maintenance line-ups with a cooling train out of service, and the depressurized maintenance state. The coverage matrix of category against state shows where each category is credible and confirms that no in-scope state was left without a heat-removal or boundary challenge.",
    rcbFailureSearch:
      "The reactor coolant boundary was searched as its own category. The primary helium pressure boundary, the steam-generator pressure boundary, the purification and helium-services interfaces, and the instrument and sample penetrations were each traced for leak and break modes in the FMEA and grouped into the boundary-breach and interfacing-systems-breach families. The graded depressurization spectrum, from small instrument-line leaks to large primary breaks, is represented.",
    completenessAssessment:
      "The search is judged complete for the internal-events scope. All five in-scope challenge categories are covered. The per-system FMEA reached the support-system level, including direct-current and instrument power, instrument air, component cooling, ventilation, and helium purification. The radioactive source escape mechanisms from the four sources in the POS workbook were each tied to at least one initiator. Multiple-failure and temporary-alignment initiators were included. Multi-reactor and shared-source events were assessed and found not applicable to this single-reactor site. A round of adversarial review challenged the set for missing events and confirmed that every retained initiator traces to at least one search model. The two open items are the hazard-group initiators, which are out of scope, and the quantitative frequencies, which are assigned in the frequency step.",
    groupingProcessAndBasis:
      "The 43 retained initiators were grouped into 21 initiating-event groups. The process ran three independent groupings, one by mitigation response, one by the bounding challenge to the safety functions, and one by HTGR phenomenology, then judged them and reconciled the best into a single partition, then audited that partition adversarially for bounding validity and masking. Initiators share a group only when they impose the same mitigation requirements and are bounded by the most limiting member. The grouping is deliberately conservative about masking. Pressurized loss of forced cooling, the primary-boundary leak tiers, the moisture and water ingress events, the reactivity families, the support-system losses, and the source and fuel-handling events are kept as distinct responses. Where a candidate merge would have hidden a different response, the audit split it out. A wet depressurizing steam-generator-tube rupture was separated from the intact-boundary moisture events, the large steam-generator-tube rupture was kept apart from the moderate one, and the loss of the helium inventory-control function was separated from the pressure-boundary breaches. Each group records its members, its bounding member, the shared mitigation requirements, and the safety functions it challenges. Frequencies are assigned to the groups in the frequency step.",
    screeningProcessAndBasis:
      "Every one of the 47 identified initiators was screened against the two-stage IE-C9 gate. The first stage is the barrier-integrity precondition, which asks whether the event avoids any failure or bypass of a radionuclide transport barrier. The second stage is the screening-criteria test, which asks whether the event has the same impact as a much-higher-frequency modeled event or is detected and corrected before a complicated shutdown. An event screens out only when it passes both stages. Forty-three initiators are retained. The boundary-breach events, the depressurizations and the steam-generator-tube and fuel-handling breaches, are held by the barrier precondition, which a breach fails by definition. The intact-barrier transients, the heat-removal, reactivity, support-system and chemistry events, are held by the screening-criteria test, because each is a credible challenge not bounded by a higher-frequency event and not benign before a complicated shutdown. Four initiators leave the separate-event set. Loss of helium purification screens out, because its only effect is a slow and limited graphite oxidation of insignificant risk that is detected and corrected, and the more serious chemistry cases are already carried by the air-ingress and water-ingress trees. Loss of service water merges into the loss-of-main-loop event that bounds it, and the helium-purification-line and instrument-line breaks merge into the small primary-leak event that already carries their depressurization. The screening was authored per category and then audited adversarially for completeness, disposition, barrier-precondition consistency, and criteria.",
    frequencyDerivation:
      "Each of the 21 retained groups was quantified by summing the frequencies of its member initiators on a plant-calendar-year basis. Per-member rates came from four methods. Generic industry data gave the data-rich transients, with the rate taken as a Jeffreys-prior posterior, the event count plus one half over the reactor-year exposure. Design-based reliability gave the HTGR-specific primary-boundary breaks and depressurizations. Human-error initiators used a human error probability times the demand rate. Combination events, the loss of main loop and the support-system losses, used small fault trees whose member rate is the sum of the cut-set term products. The group mean is the analytic sum of its member means. The uncertainty is a lognormal carried on each member by its error factor, propagated to the group by a Monte Carlo of two hundred thousand trials that samples each member and sums. The calculations were run in Python and are reproducible from the recorded inputs.",
    quantificationApproach:
      "The quantification is a generic-data-with-Bayesian and fault-tree approach. There is no plant operating history, so for each generic event the industry data is the prior and, with no plant evidence, the design-adjusted prior is taken as the posterior. The error factors carry the epistemic uncertainty, three to ten for the data-rich events and ten to thirty for the rare and sparse-data events. The rare groups, the large primary break, the large steam-generator-tube rupture, and the wet depressurization breach, use industry generic data augmented by HTGR design reliability and the gas-cooled fleet experience. The solver wiring is deferred, so the arithmetic is done in transparent Python rather than an engine, and it will be re-run through the calculation workflow when the engine is connected.",
    dataSourceJustification:
      "The data are generic United States power-reactor initiating-event data for the data-rich transients and support-system losses, the gas-cooled fleet experience from AVR, THTR-300, and Fort St. Vrain together with the MHTGR design records for the HTGR-specific events, and standard human-reliability sources for the operator-induced initiators. The reactor-trip, turbine-trip, loss-of-feedwater, loss-of-heat-sink, and loss-of-offsite-power rates follow the NUREG/CR-5750 categories. The component-failure and standby-demand rates follow NUREG/CR-6928. The primary-boundary break and steam-generator-tube failure frequencies are design-based and anchored to the MHTGR safety analysis. Each rate is adjusted to the Generic HTGR design, and the generic-to-design differences are recorded with each group.",
    modelUncertaintySources: PENDING,
    asBuiltLimitations: "Pre-operational; assumptions close at commissioning.",
    praTaskInterfaces: "Feeds Event Sequence Analysis and Event Sequence Quantification.",
    implementsSrs: [sr("IE-D1", "D")],
  },
};
