import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type MethodArtifactKind =
  | "ANALYTICAL_METHOD"
  | "TOOL"
  | "SKILL"
  | "SOLVER"
  | "AGENT"
  | "MODELING_TECHNIQUE";

export interface ScopeAndLimitations {
  purpose: string;
  scope: string;
  applicabilityConditions: string[];
  limitations: string[];
  implementsSrs: SRReference[];
}

export interface EngineeringAndScienceBasis {
  references: string[];
  rationale: string;
  consistencyWithPurposeAndScope: string;
  implementsSrs: SRReference[];
}

export interface MethodData {
  dataKind: "NUMERIC" | "NON_NUMERIC" | "MIXED";
  sources: string[];
  analysisApproach: string;
  applicationApproach: string;
  technicalSoundnessBasis: string;
  implementsSrs: SRReference[];
}

export interface UncertaintyCharacterization {
  uncertaintyTypes: string[];
  modelUncertaintySources: string[];
  associatedAssumptions: string[];
  treatmentApproach: string;
  implementsSrs: SRReference[];
}

export interface ResultsQuality {
  reproducibilityBasis: string;
  reasonablenessBasis: string;
  consistencyWithAssumptionsAndData: string;
  benchmarkComparisons: string[];
  implementsSrs: SRReference[];
}

export interface MethodDocumentation {
  description: string;
  traceabilityBasis: string;
  incorporationGuidance: string;
  implementsSrs: SRReference[];
}

export interface TechnicalElementOverlap {
  overlappingTechnicalElementCode: string;
  overlappingTechnicalElementSr: string;
  overlappingNmSr: string;
  resolution: "TECHNICAL_ELEMENT_SR_TAKES_PRIORITY" | "NM_SR_APPLIES" | "BOTH_APPLY";
  rationale: string;
}

export interface NewlyDevelopedMethod
  extends TechnicalElement<TechnicalElementTypes.NEWLY_DEVELOPED_METHOD> {
  artifactKind: MethodArtifactKind;
  introducedAfterFirstPeerReview: boolean;
  appliedInTechnicalElementIds: string[];

  scopeAndLimitations: ScopeAndLimitations;
  engineeringAndScienceBasis: EngineeringAndScienceBasis;
  methodData: MethodData;
  uncertaintyCharacterization: UncertaintyCharacterization;
  resultsQuality: ResultsQuality;
  documentation: MethodDocumentation;

  technicalElementOverlaps: TechnicalElementOverlap[];
}

export const NM_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {};
