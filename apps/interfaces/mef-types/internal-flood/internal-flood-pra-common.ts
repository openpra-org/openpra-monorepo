import { Named, Unique } from "../core/meta";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type InternalFloodPraSubelement = "FLPP" | "FLSO" | "FLSN" | "FLEV" | "FLPR" | "FLHR" | "FLESQ";

export type InternalFloodPraTechnicalElementCode = "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA" | "ESQ" | "RI";
export type InternalFloodPraInterfaceDirection = "INPUT" | "OUTPUT";

export type InternalFloodRecordStatus =
  | "DRAFT"
  | "READY"
  | "REVIEWED"
  | "APPROVED"
  | "SCREENED"
  | "RETAINED"
  | "OPEN"
  | "CLOSED";

export interface InternalFloodSrCatalogEntry {
  hlr: HlrId;
  stages: PlantStage[];
  description: string;
}

export interface InternalFloodAnalysisRecord extends Unique, Named {
  code: string;
  description: string;
  basis: string;
  owner: string;
  status: InternalFloodRecordStatus;
  evidenceRefs: string[];
  relatedRefs: string[];
  assumptionRefs: string[];
  implementsSrs: SRReference[];
}

export interface InternalFloodInvestigation extends InternalFloodAnalysisRecord {
  investigationType: "WALKDOWN" | "INTERVIEW" | "TABLETOP" | "COMPUTERIZED_WALKDOWN" | "DOCUMENT_REVIEW";
  scope: string;
  plantOperatingStateRefs: string[];
  locations: string[];
  participants: string[];
  performedDate: string;
  observations: string[];
  findingRefs: string[];
  confirmedRecordRefs: string[];
}

export interface InternalFloodScreeningDecision extends InternalFloodAnalysisRecord {
  screenedObjectType: "FLOOD_AREA" | "FLOOD_SOURCE" | "FLOOD_SCENARIO" | "EVENT_SEQUENCE_FAMILY";
  screenedObjectRefs: string[];
  criterion: "SCR-1" | "SCR-2" | "SCR-3" | "IE-C9" | "TWO_ORDER_COMPARISON" | "RETAINED";
  disposition: "SCREENED" | "RETAINED";
  conservativeAssumptions: string[];
  quantitativeValue?: number;
  quantitativeUnit?: string;
  threshold?: number;
  affectedEventSequenceFamilyRefs: string[];
}

export interface InternalFloodModelUncertainty extends InternalFloodAnalysisRecord {
  sourceSubelement: InternalFloodPraSubelement;
  uncertaintyType: "PARAMETER" | "MODEL" | "ASSUMPTION";
  affectedRecordRefs: string[];
  potentialImpact: string;
  reasonableAlternatives: string[];
  treatment: string;
  sensitivityStudyRefs: string[];
  importance: "LOW" | "MEDIUM" | "HIGH";
}

export interface InternalFloodPreOperationalAssumption extends InternalFloodAnalysisRecord {
  affectedRecordRefs: string[];
  missingDesignInformation: string[];
  limitation: string;
  closureAction: string;
  closurePhase: string;
  closureStatus: "OPEN" | "IN_PROGRESS" | "CLOSED";
}

export interface InternalFloodProcessDocumentation extends Unique, Named {
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

export interface InternalFloodPraInterfaceTransferItem extends Unique, Named {
  recordRef: string;
  sourceModelRef: string;
  destinationRefs: string[];
  values: string[];
  evidenceRefs: string[];
  status: "CONTROLLED" | "WORKING" | "OPEN";
}

export interface InternalFloodPraInterfaceRecord extends InternalFloodAnalysisRecord {
  technicalElementCode: InternalFloodPraTechnicalElementCode;
  technicalElementName: string;
  direction: InternalFloodPraInterfaceDirection;
  role: string;
  producer: InternalFloodPraTechnicalElementCode | "FL";
  consumer: InternalFloodPraTechnicalElementCode | "FL";
  payloadType:
    | "OPERATING_STATE"
    | "INITIATING_EVENT"
    | "EVENT_SEQUENCE"
    | "SUCCESS_CRITERION"
    | "SYSTEM_MODEL"
    | "HUMAN_FAILURE_EVENT"
    | "DATA_PARAMETER"
    | "SEQUENCE_FAMILY_RESULT"
    | "RISK_CONTRIBUTOR";
  columns: string[];
  transferItems: InternalFloodPraInterfaceTransferItem[];
  standardRequirementRefs: string[];
  producerRefs: string[];
  consumerRefs: string[];
  transferBasis: string;
  consistencyChecks: string[];
  consistent: boolean;
  openItems: string[];
}

export function createInternalFloodSrCatalog(
  prefix: InternalFloodPraSubelement,
  requirements: Record<string, string[]>,
  stageOverrides: Record<string, PlantStage[]> = {},
): Record<string, InternalFloodSrCatalogEntry> {
  const catalog: Record<string, InternalFloodSrCatalogEntry> = {};
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
