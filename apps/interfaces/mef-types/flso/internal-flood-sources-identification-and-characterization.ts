import { InternalFloodAnalysisRecord, InternalFloodInvestigation, InternalFloodModelUncertainty, InternalFloodPreOperationalAssumption, InternalFloodProcessDocumentation, InternalFloodScreeningDecision, createInternalFloodSrCatalog } from "../internal-flood/internal-flood-pra-common";

export type InternalFloodFluid = "WATER" | "STEAM" | "SODIUM" | "OIL" | "CHEMICAL" | "GAS_CONDENSATE" | "OTHER";

export interface InternalFloodSource extends InternalFloodAnalysisRecord {
  sourceType: "PIPE" | "TANK" | "VESSEL" | "POOL" | "HEAT_EXCHANGER" | "HOSE" | "FIRE_SUPPRESSION" | "EXTERNAL_CONNECTION" | "OTHER";
  systemRef: string;
  floodAreaRef: string;
  connectedFloodAreaRefs: string[];
  fluid: InternalFloodFluid;
  inventoryCubicMetres?: number;
  operatingPressureKpa: number;
  operatingTemperatureCelsius: number;
  nominalDiameterMillimetres?: number;
  material: string;
  ageYears?: number;
  isolationRefs: string[];
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  maintenanceExposureHoursPerYear?: number;
  investigationRefs: string[];
  spatialLocationConfirmed: boolean;
}

export interface InternalFloodSourceFailureMechanism extends InternalFloodAnalysisRecord {
  sourceRef: string;
  mechanism:
    | "LEAK"
    | "RUPTURE"
    | "SPRAY"
    | "OVERFLOW"
    | "DRAIN_DOWN"
    | "OPERATOR_ERROR"
    | "MAINTENANCE_ERROR"
    | "FIRE_SUPPRESSION_ACTUATION"
    | "OTHER";
  breachType: "PINHOLE" | "CRACK" | "PARTIAL_BREAK" | "FULL_BREAK" | "OPEN_END" | "OVERFLOW" | "OTHER";
  breachAreaSquareMillimetres?: number;
  credibleCauses: string[];
  consequentialEffects: string[];
  applicablePlantOperatingStateRefs: string[];
}

export interface InternalFloodReleaseCharacterization extends InternalFloodAnalysisRecord {
  sourceRef: string;
  failureMechanismRef: string;
  releaseRateCubicMetresPerMinute: number;
  minimumReleaseRateCubicMetresPerMinute: number;
  maximumReleaseRateCubicMetresPerMinute: number;
  availableInventoryCubicMetres: number;
  unisolatedDurationMinutes: number;
  releasedVolumeCubicMetres: number;
  fluidTemperatureCelsius: number;
  dischargePressureKpa: number;
  isolationSignal: string;
  isolationTimeMinutes?: number;
  releaseCalculationRef: string;
  uncertaintyTreatment: string;
}

export interface InternalFloodSourcesIdentificationAndCharacterization {
  sources: InternalFloodSource[];
  failureMechanisms: InternalFloodSourceFailureMechanism[];
  releaseCharacterizations: InternalFloodReleaseCharacterization[];
  sourceScreeningDecisions: InternalFloodScreeningDecision[];
  investigations: InternalFloodInvestigation[];
  modelUncertainties: InternalFloodModelUncertainty[];
  preOperationalAssumptions: InternalFloodPreOperationalAssumption[];
  documentation: InternalFloodProcessDocumentation;
}

export const FLSO_SR_CATALOG = createInternalFloodSrCatalog(
  "FLSO",
  {
    A: [
      "Identify equipment, internal, and connected external flood sources in each flood area for every modeled plant operating state.",
      "Include water, steam, and other applicable fluids capable of creating flood-induced damage.",
      "Identify sources capable of affecting more than one reactor or radioactive-material source.",
      "Screen a source-free flood area only when the applicable screening criterion is satisfied and the area is not a propagation path.",
      "Identify credible pressure-boundary, component, human, maintenance, fire-suppression, and other release mechanisms.",
      "Characterize breach type, credible flow-rate range, available capacity, pressure, temperature, duration, and released volume.",
      "Confirm source location, connected in-leakage, and release information using plant data or appropriately scoped investigations.",
      "Identify source-characterization model uncertainty, related assumptions, reasonable alternatives, and potential risk impact.",
      "Identify pre-operational assumptions caused by unavailable as-built and as-operated source information.",
    ],
    B: [
      "Document the source-identification and characterization process, inputs, methods, results, sources, failure mechanisms, investigations, and screening.",
      "Document source model uncertainty, related assumptions, and reasonable alternatives.",
      "Document pre-operational source assumptions and limitations caused by unavailable as-built and as-operated information.",
    ],
  },
  {
    "FLSO-A9": ["PRE_OPERATIONAL"],
    "FLSO-B3": ["PRE_OPERATIONAL"],
  },
);
