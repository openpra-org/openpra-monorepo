import { Named, Unique } from "../core/meta";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type HighWindsPraSubelement = "WHA" | "WFR" | "WPR";

export type HighWindsHazardType =
  | "STRAIGHT_WIND"
  | "TROPICAL_CYCLONE"
  | "TORNADO";

export type HighWindsEffectType =
  | "WIND_PRESSURE"
  | "ATMOSPHERIC_PRESSURE_CHANGE"
  | "WIND_GENERATED_MISSILE"
  | "STRUCTURAL_INTERACTION"
  | "WIND_DRIVEN_RAIN";

export type HighWindsPraTechnicalElementCode =
  | "HS"
  | "POS"
  | "IE"
  | "ES"
  | "SC"
  | "SY"
  | "HR"
  | "DA"
  | "ESQ"
  | "RI"
  | "XF"
  | "F"
  | "FL"
  | "O";

export type HighWindsRecordStatus =
  | "DRAFT"
  | "READY"
  | "REVIEWED"
  | "APPROVED"
  | "SCREENED"
  | "RETAINED"
  | "OPEN"
  | "CLOSED";

export interface HighWindsSrCatalogEntry {
  hlr: HlrId;
  stages: PlantStage[];
  description: string;
}

export interface HighWindsAnalysisRecord extends Unique, Named {
  code: string;
  description: string;
  basis: string;
  owner: string;
  status: HighWindsRecordStatus;
  evidenceRefs: string[];
  relatedRefs: string[];
  assumptionRefs: string[];
  implementsSrs: SRReference[];
}

export interface HighWindsInvestigation extends HighWindsAnalysisRecord {
  investigationType:
    | "WALKDOWN"
    | "MISSILE_SURVEY"
    | "INTERVIEW"
    | "TALK_THROUGH"
    | "TABLETOP"
    | "COMPUTERIZED_WALKDOWN"
    | "DOCUMENT_REVIEW";
  scope: string;
  plantOperatingStateRefs: string[];
  locations: string[];
  participants: string[];
  performedDate: string;
  observations: string[];
  findingRefs: string[];
  confirmedRecordRefs: string[];
}

export interface HighWindsScreeningDecision extends HighWindsAnalysisRecord {
  screenedObjectType:
    | "HAZARD"
    | "SSC"
    | "WIND_EFFECT"
    | "FAILURE_MODE"
    | "MISSILE_SOURCE"
    | "EVENT_SEQUENCE_FAMILY";
  screenedObjectRefs: string[];
  hazardTypes: HighWindsHazardType[];
  windEffects: HighWindsEffectType[];
  criterion: "SCR-1" | "SCR-2" | "SCR-3" | "APPROVED_ALTERNATE" | "RETAINED";
  disposition: "SCREENED" | "RETAINED";
  conservativeAssumptions: string[];
  quantitativeValue?: number;
  quantitativeUnit?: string;
  threshold?: number;
  aggregateFrequencyPerPlantYear?: number;
  investigationRefs: string[];
  affectedEventSequenceFamilyRefs: string[];
}

export interface HighWindsModelUncertainty extends HighWindsAnalysisRecord {
  sourceSubelement: HighWindsPraSubelement;
  uncertaintyType: "PARAMETER" | "MODEL" | "ASSUMPTION";
  affectedRecordRefs: string[];
  potentialImpact: string;
  reasonableAlternatives: string[];
  treatment: string;
  sensitivityStudyRefs: string[];
  importance: "LOW" | "MEDIUM" | "HIGH";
}

export interface HighWindsPreOperationalAssumption extends HighWindsAnalysisRecord {
  affectedRecordRefs: string[];
  missingDesignInformation: string[];
  limitation: string;
  closureAction: string;
  closurePhase: string;
  closureStatus: "OPEN" | "IN_PROGRESS" | "CLOSED";
}

export interface HighWindsProcessDocumentation extends Unique, Named {
  processDescription: string;
  inputsDescription: string;
  methodsDescription: string;
  resultsDescription: string;
  limitations: string[];
  supportingDocumentRefs: string[];
  traceabilityLinks: {
    uuid: string;
    requirementRef: string;
    inputRefs: string[];
    modelRefs: string[];
    resultRefs: string[];
    documentationRefs: string[];
  }[];
}

export interface HighWindsPraInterfaceTransferItem extends Unique, Named {
  recordRef: string;
  sourceModelRef: string;
  destinationRefs: string[];
  values: string[];
  evidenceRefs: string[];
  status: "CONTROLLED" | "WORKING" | "OPEN";
}

export interface HighWindsPraInterfaceRecord extends HighWindsAnalysisRecord {
  technicalElementCode: HighWindsPraTechnicalElementCode;
  technicalElementName: string;
  direction: "INPUT" | "OUTPUT";
  role: string;
  producer: HighWindsPraTechnicalElementCode | "W";
  consumer: HighWindsPraTechnicalElementCode | "W";
  payloadType:
    | "HAZARD_SCREENING_RESULT"
    | "OPERATING_STATE"
    | "INITIATING_EVENT"
    | "EVENT_SEQUENCE"
    | "SUCCESS_CRITERION"
    | "SYSTEM_MODEL"
    | "HUMAN_FAILURE_EVENT"
    | "DATA_PARAMETER"
    | "HAZARD_CURVE"
    | "FRAGILITY"
    | "HIGH_WIND_EQUIPMENT_LIST"
    | "COEXISTENT_HAZARD"
    | "SEQUENCE_FAMILY_RESULT"
    | "RISK_CONTRIBUTOR";
  columns: string[];
  transferItems: HighWindsPraInterfaceTransferItem[];
  producerRefs: string[];
  consumerRefs: string[];
  consistencyChecks: string[];
  consistent: boolean;
  openItems: string[];
}

export function createHighWindsSrCatalog(
  prefix: HighWindsPraSubelement,
  requirements: Record<string, string[]>,
  stageOverrides: Record<string, PlantStage[]> = {},
): Record<string, HighWindsSrCatalogEntry> {
  const catalog: Record<string, HighWindsSrCatalogEntry> = {};
  for (const [hlr, descriptions] of Object.entries(requirements)) {
    descriptions.forEach((description, index) => {
      const sr = `${prefix}-${hlr}${String(index + 1)}`;
      catalog[sr] = {
        hlr: hlr as HlrId,
        stages: stageOverrides[sr] ?? ["OPERATIONAL", "PRE_OPERATIONAL"],
        description,
      };
    });
  }
  return catalog;
}
