import { InternalFloodAnalysisRecord, InternalFloodInvestigation, InternalFloodModelUncertainty, InternalFloodPreOperationalAssumption, InternalFloodProcessDocumentation, InternalFloodScreeningDecision, createInternalFloodSrCatalog } from "../internal-flood/internal-flood-pra-common";

export interface InternalFloodPropagationPath extends InternalFloodAnalysisRecord {
  originFloodAreaRef: string;
  destinationFloodAreaRef: string;
  pathType: "DOOR_GAP" | "PENETRATION" | "STAIRWELL" | "HATCH" | "DRAIN" | "BACKFLOW" | "HVAC" | "GRATE" | "SEAL_FAILURE" | "STRUCTURAL_FAILURE" | "OTHER";
  openingAreaSquareMetres: number;
  invertElevationMetres: number;
  activationHeadMetres: number;
  flowCapacityCubicMetresPerMinute: number;
  travelTimeMinutes: number;
  direction: "ONE_WAY" | "BIDIRECTIONAL";
  barrierRef?: string;
  structuralFailurePossible: boolean;
  operatingStateDependencies: string[];
  investigationRefs: string[];
}

export interface InternalFloodMitigationFeature extends InternalFloodAnalysisRecord {
  floodAreaRef: string;
  featureType: "ALARM" | "DIKE" | "CURB" | "WATERTIGHT_DOOR" | "BARRIER" | "DRAIN" | "SUMP" | "PUMP" | "SHIELD" | "BLOWOUT_PANEL" | "DAMPER" | "ISOLATION" | "OTHER";
  credited: boolean;
  passive: boolean;
  designCapacity: number;
  capacityUnit: string;
  actuationOrAvailabilityBasis: string;
  dependentPowerRefs: string[];
  dependentHumanActionRefs: string[];
  failureModeRefs: string[];
  surveillanceOrTestRef: string;
  plantOperatingStateRefs: string[];
}

export interface InternalFloodSscSusceptibility extends InternalFloodAnalysisRecord {
  sscRef: string;
  floodAreaRef: string;
  creditedFunctions: string[];
  failureMechanisms: ("SUBMERGENCE" | "SPRAY" | "HUMIDITY" | "CONDENSATION" | "JET_IMPINGEMENT" | "PIPE_WHIP" | "TEMPERATURE" | "PRESSURE" | "CHEMICAL_REACTION" | "OTHER")[];
  lowestDamageElevationMetres?: number;
  sprayExposure: string;
  qualifiedTemperatureCelsius?: number;
  qualifiedPressureKpa?: number;
  operabilityBasis: "TEST" | "ANALYSIS" | "EXPERT_JUDGMENT" | "COMBINATION";
  operabilityEvidenceRefs: string[];
  failureBasicEventRefs: string[];
  mitigationFeatureRefs: string[];
}

export interface InternalFloodHydraulicTimePoint {
  elapsedMinutes: number;
  floodHeightMetres: number;
  floodedVolumeCubicMetres: number;
  inflowCubicMetresPerMinute: number;
  drainageCubicMetresPerMinute: number;
}

export interface InternalFloodHydraulicCalculation extends InternalFloodAnalysisRecord {
  floodScenarioRef: string;
  floodAreaRef: string;
  sourceReleaseRef: string;
  propagationPathRefs: string[];
  mitigationFeatureRefs: string[];
  initialInventoryCubicMetres: number;
  totalReleasedVolumeCubicMetres: number;
  maximumFloodHeightMetres: number;
  timeToMaximumHeightMinutes: number;
  timeToCriticalDamageMinutes?: number;
  occupancyAndFreeVolumeBasis: string;
  calculationMethod: string;
  modelOrCode: string;
  timeHistory: InternalFloodHydraulicTimePoint[];
  verification: string;
}

export interface InternalFloodScenario extends InternalFloodAnalysisRecord {
  scenarioId: string;
  sourceRef: string;
  sourceFailureMechanismRef: string;
  releaseCharacterizationRef: string;
  originFloodAreaRef: string;
  affectedFloodAreaRefs: string[];
  propagationPathRefs: string[];
  mitigationFeatureRefs: string[];
  hydraulicCalculationRefs: string[];
  affectedSscSusceptibilityRefs: string[];
  failedSscRefs: string[];
  initiatingEventCandidate: string;
  automaticResponseRefs: string[];
  operatorActionRefs: string[];
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  chemicalOrPhysicalInteraction: string;
  limitingOrBoundingBasis: string;
  disposition: "RETAINED" | "SCREENED" | "GROUPED";
}

export interface InternalFloodScenariosDevelopment {
  propagationPaths: InternalFloodPropagationPath[];
  mitigationFeatures: InternalFloodMitigationFeature[];
  sscSusceptibilities: InternalFloodSscSusceptibility[];
  hydraulicCalculations: InternalFloodHydraulicCalculation[];
  floodScenarios: InternalFloodScenario[];
  screeningDecisions: InternalFloodScreeningDecision[];
  investigations: InternalFloodInvestigation[];
  modelUncertainties: InternalFloodModelUncertainty[];
  preOperationalAssumptions: InternalFloodPreOperationalAssumption[];
  documentation: InternalFloodProcessDocumentation;
}

export const FLSN_SR_CATALOG = createInternalFloodSrCatalog(
  "FLSN",
  {
    A: [
      "Identify flood-propagation paths from each retained source to all credible accumulation locations for each modeled plant operating state.",
      "Identify and characterize alarms, dikes, curbs, sumps, watertight doors, barriers, drains, pumps, shields, panels, dampers, and other mitigation features.",
      "Identify automatic and operator responses that can terminate, isolate, redirect, or mitigate the flood.",
      "Determine drainage, retention, sump, and pumping capacities credited in flood scenarios.",
      "Identify PRA-relevant SSCs, their spatial locations, and applicable flood-mitigation features along each propagation path.",
      "Evaluate SSC susceptibility to submergence, spray, humidity, condensation, temperature, pressure, jet impingement, pipe whip, and other applicable effects.",
      "Establish SSC operability or failure using applicable test data, engineering analysis, expert judgment, or a justified combination.",
      "Identify inter-area hydraulic connections and credible failures of doors, penetrations, seals, drains, HVAC paths, and structures.",
      "Calculate inventory, release, propagation, drainage, occupancy, barrier failure, environmental conditions, and other scenario parameters needed to characterize consequences.",
      "Determine maximum or critical flood heights, time to damage, and flood effects on susceptible SSCs in each affected area.",
      "Use conservatively estimated source flow rates when screening the origin and receiving flood areas.",
      "Use realistic release duration and timing when determining maximum or critical flood height for retained scenarios.",
      "Construct each retained scenario from its source, failure, paths, barriers, affected SSCs, automatic responses, and operator actions for each applicable operating state.",
      "Develop scenarios that capture a flood affecting more than one reactor or radioactive-material source.",
      "Identify every affected combination of reactors and radioactive-material sources for multi-source flood scenarios.",
      "Evaluate chemical or physical incompatibilities, including energetic reactions and consequential environmental effects.",
      "Screen flood areas only using applicable criteria and conservative representations that bound associated sources and scenarios.",
      "Screen flood sources only using applicable criteria, explicitly accounting for propagation and any credited mitigation.",
      "Confirm SSC locations, design features, propagation paths, and scenario assumptions through appropriately scoped investigations.",
      "Identify scenario-development model uncertainty, related assumptions, reasonable alternatives, and potential risk impact.",
      "Identify pre-operational assumptions caused by unavailable as-built and as-operated scenario information.",
    ],
    B: [
      "Document scenario-development inputs, methods, calculations, paths, mitigation, SSC susceptibility, scenarios, screening, and investigations.",
      "Document scenario-development model uncertainty, related assumptions, and reasonable alternatives.",
      "Document pre-operational scenario assumptions and limitations caused by unavailable as-built and as-operated information.",
    ],
  },
  {
    "FLSN-A21": ["PRE_OPERATIONAL"],
    "FLSN-B3": ["PRE_OPERATIONAL"],
  },
);
