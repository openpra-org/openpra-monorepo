import { Unique, Named } from "./meta";
import { ImportanceLevel, SensitivityStudy } from "./shared-patterns";
import { SRReference } from "./pra-common";

export interface PlantRepresentationAccuracy {
  scope: "OPERATING" | "PRE_OPERATIONAL";
  accuracy: ImportanceLevel;
  basis: string;
  detailConsistentWithPlant: boolean;
  sufficientForRiskSignificantContributors: boolean;
  sufficiencyJustification: string;
  highConfidenceAreas: string[];
  lowerConfidenceAreas: string[];
  improvementPlans: string[];
  implementsSrs: SRReference[];
}

export interface BaseDesignInformation {
  sourceId: string;
  sourceType: string;
  revision?: string;
  date?: string;
  description?: string;
  requirementId?: string;
  standardSection?: string;
}

export interface BaseProcessDocumentation extends Unique, Named {
  processDescription: string;
  inputsDescription?: string;
  designInformation?: BaseDesignInformation[];
  methodsDescription?: string;
  resultsDescription?: string;
  supportingDocumentationReferences?: string[];
  requirementReferences?: {
    requirementId: string;
    implementation: string;
  }[];
}

export interface BaseModelUncertaintyDocumentation extends Unique, Named {
  uncertaintySources: {
    source: string;
    impact: string;
    applicableElements?: string[];
  }[];
  relatedAssumptions: {
    assumption: string;
    basis: string;
    applicableElements?: string[];
  }[];
  reasonableAlternatives: {
    alternative: string;
    reasonNotSelected: string;
    applicableElements?: string[];
  }[];
  requirementReference?: string;
}

export interface BaseAssumption extends Unique {
  description: string;
  impact?: string;
  rationale?: string;
  references?: string[];
  isPreOperational?: boolean;
  addressingPlans?: string;
  status?: "OPEN" | "CLOSED" | "IN_PROGRESS";
  limitations?: string[];
}

export interface PreOperationalAssumption extends BaseAssumption {
  assumptionId: string;
  requiredDesignInformation?: BaseDesignInformation[];
  resolutionPlan?: string;
  status: "OPEN" | "CLOSED" | "IN_PROGRESS";
  limitations: string[];
  influenceOnDefinition: string;
  riskImpact: ImportanceLevel;
  closureBasis: string;
  plannedClosureActions: string[];
  affectedElementIds: string[];
  implementsSrs?: SRReference[];
  affectedTechnicalElementCodes?: string[];
  potentialAlternatives?: string[];
  sensitivityAnalysis?: SensitivityStudy;
  owner?: string;
}

export interface BasePreOperationalAssumptionsDocumentation extends Unique, Named {
  assumptions: PreOperationalAssumption[];
  supportingDocumentationReferences?: string[];
  validationPhase?: string;
}

export interface BasePeerReviewDocumentation extends Unique, Named {
  reviewDate: string;
  reviewers: string[];
  findingsAndObservations: {
    id: string;
    description: string;
    significance: ImportanceLevel;
    resolutionStatus: "OPEN" | "CLOSED" | "IN_PROGRESS";
    resolutionActions?: string[];
    associatedRequirements?: string[];
  }[];
  scope: string;
  methodology: string;
  reportReference?: string;
}

export interface BaseTraceabilityDocumentation extends Unique, Named {
  modelingDecisions?: Record<string, string>;
  dataSourceReferences?: Record<string, string[]>;
  analysisFlowDiagram?: string;
  changeLog?: {
    version: string;
    date: string;
    changes: string[];
    analyst: string;
  }[];
  crossReferences?: {
    technicalElement: string;
    elementId: string;
    relationship: string;
    description?: string;
  }[];
}
