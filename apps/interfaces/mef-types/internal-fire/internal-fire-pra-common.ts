import { Named, Unique } from "../core/meta";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type InternalFirePraSubelement =
  | "FPP"
  | "FES"
  | "FCS"
  | "FQLS"
  | "FPRM"
  | "FSS"
  | "FIGN"
  | "FCF"
  | "FHR"
  | "FESQ";

export type InternalFirePraTechnicalElementCode =
  | "POS"
  | "IE"
  | "ES"
  | "SC"
  | "SY"
  | "HR"
  | "DA"
  | "ESQ"
  | "RI";

export type InternalFireRecordStatus =
  | "DRAFT"
  | "READY"
  | "REVIEWED"
  | "APPROVED"
  | "SCREENED"
  | "RETAINED"
  | "OPEN"
  | "CLOSED";

export interface InternalFireSrCatalogEntry {
  hlr: HlrId;
  stages: PlantStage[];
  description: string;
}

export interface InternalFireAnalysisRecord extends Unique, Named {
  code: string;
  description: string;
  basis: string;
  owner: string;
  status: InternalFireRecordStatus;
  evidenceRefs: string[];
  relatedRefs: string[];
  assumptionRefs: string[];
  implementsSrs: SRReference[];
}

export interface InternalFireInvestigation extends InternalFireAnalysisRecord {
  investigationType: "WALKDOWN" | "INTERVIEW" | "TALK_THROUGH" | "TABLETOP" | "COMPUTERIZED_WALKDOWN" | "DOCUMENT_REVIEW";
  scope: string;
  plantOperatingStateRefs: string[];
  locations: string[];
  participants: string[];
  performedDate: string;
  observations: string[];
  findingRefs: string[];
  confirmedRecordRefs: string[];
}

export interface InternalFireScreeningDecision extends InternalFireAnalysisRecord {
  screenedObjectType: "PAU" | "IGNITION_SOURCE" | "FIRE_SCENARIO" | "MULTI_COMPARTMENT_SCENARIO" | "EVENT_SEQUENCE_FAMILY";
  screenedObjectRefs: string[];
  criterion: "FQLS-A1" | "FQLS-A2" | "APPROVED_ADDITIONAL" | "SCR-2" | "SCR-3" | "RETAINED";
  disposition: "SCREENED" | "RETAINED";
  conservativeAssumptions: string[];
  quantitativeValue?: number;
  quantitativeUnit?: string;
  threshold?: number;
  affectedEventSequenceFamilyRefs: string[];
}

export interface InternalFireModelUncertainty extends InternalFireAnalysisRecord {
  sourceSubelement: InternalFirePraSubelement;
  uncertaintyType: "PARAMETER" | "MODEL" | "ASSUMPTION";
  affectedRecordRefs: string[];
  potentialImpact: string;
  reasonableAlternatives: string[];
  treatment: string;
  sensitivityStudyRefs: string[];
  importance: "LOW" | "MEDIUM" | "HIGH";
}

export interface InternalFirePreOperationalAssumption extends InternalFireAnalysisRecord {
  affectedRecordRefs: string[];
  missingDesignInformation: string[];
  limitation: string;
  closureAction: string;
  closurePhase: string;
  closureStatus: "OPEN" | "IN_PROGRESS" | "CLOSED";
}

export interface InternalFireProcessDocumentation extends Unique, Named {
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

export interface InternalFirePraInterfaceTransferItem extends Unique, Named {
  recordRef: string;
  sourceModelRef: string;
  destinationRefs: string[];
  values: string[];
  evidenceRefs: string[];
  status: "CONTROLLED" | "WORKING" | "OPEN";
}

export interface InternalFirePraInterfaceRecord extends InternalFireAnalysisRecord {
  technicalElementCode: InternalFirePraTechnicalElementCode;
  technicalElementName: string;
  direction: "INPUT" | "OUTPUT";
  role: string;
  producer: InternalFirePraTechnicalElementCode | "F";
  consumer: InternalFirePraTechnicalElementCode | "F";
  payloadType:
    | "OPERATING_STATE"
    | "INITIATING_EVENT"
    | "EVENT_SEQUENCE"
    | "SUCCESS_CRITERION"
    | "SYSTEM_MODEL"
    | "HUMAN_FAILURE_EVENT"
    | "DATA_PARAMETER"
    | "FIRE_SCENARIO_RESULT"
    | "SEQUENCE_FAMILY_RESULT"
    | "RISK_CONTRIBUTOR";
  columns: string[];
  transferItems: InternalFirePraInterfaceTransferItem[];
  standardRequirementRefs: string[];
  producerRefs: string[];
  consumerRefs: string[];
  transferBasis: string;
  consistencyChecks: string[];
  consistent: boolean;
  openItems: string[];
}

export function createInternalFireSrCatalog(
  prefix: InternalFirePraSubelement,
  requirements: Record<string, string[]>,
  stageOverrides: Record<string, PlantStage[]> = {},
): Record<string, InternalFireSrCatalogEntry> {
  const catalog: Record<string, InternalFireSrCatalogEntry> = {};
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
