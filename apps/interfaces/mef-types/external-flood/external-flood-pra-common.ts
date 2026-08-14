import { Named, Unique } from "../core/meta";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type ExternalFloodPraSubelement = "XFHA" | "XFFR" | "XFPR";

export type ExternalFloodHazardType =
  | "LOCAL_INTENSE_PRECIPITATION"
  | "RIVERINE_FLOOD"
  | "DAM_OR_IMPOUNDMENT_FAILURE"
  | "STORM_SURGE"
  | "SEICHE"
  | "TSUNAMI"
  | "GROUNDWATER"
  | "WAVE_RUNUP"
  | "ICE_EFFECTS";

export type ExternalFloodEffectType =
  | "STATIC_WATER_LEVEL"
  | "HYDROSTATIC_LOAD"
  | "HYDRODYNAMIC_LOAD"
  | "WAVE_LOAD"
  | "DEBRIS_IMPACT"
  | "EROSION_AND_SCOUR"
  | "SEDIMENTATION"
  | "GROUNDWATER_INTRUSION"
  | "DRAINAGE_BACKFLOW"
  | "SITE_ACCESS_LOSS";

export type ExternalFloodTechnicalElementCode =
  | "HS" | "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA"
  | "ESQ" | "RI" | "S" | "W" | "FL" | "F" | "O";

export type ExternalFloodRecordStatus =
  | "DRAFT" | "READY" | "REVIEWED" | "APPROVED"
  | "SCREENED" | "RETAINED" | "OPEN" | "CLOSED";

export interface ExternalFloodSrCatalogEntry {
  hlr: HlrId;
  stages: PlantStage[];
  description: string;
}

/**
 * Common controlled record. Step-specific fields are declared by each Zod
 * collection and are intentionally allowed here so all workbook collections
 * retain one consistent record contract.
 */
export interface ExternalFloodAnalysisRecord extends Unique, Named {
  code: string;
  description: string;
  basis: string;
  owner: string;
  status: ExternalFloodRecordStatus;
  evidenceRefs: string[];
  relatedRefs: string[];
  assumptionRefs: string[];
  implementsSrs: SRReference[];
  [key: string]: unknown;
}

export interface ExternalFloodInvestigation extends ExternalFloodAnalysisRecord {
  investigationType: "WALKDOWN" | "INTERVIEW" | "TALK_THROUGH" | "TABLETOP" | "SURVEY" | "DOCUMENT_REVIEW";
  scope: string;
  plantOperatingStateRefs: string[];
  locations: string[];
  participants: string[];
  performedDate: string;
  observations: string[];
  findingRefs: string[];
  confirmedRecordRefs: string[];
}

export interface ExternalFloodModelUncertainty extends ExternalFloodAnalysisRecord {
  sourceSubelement: ExternalFloodPraSubelement;
  uncertaintyType: "PARAMETER" | "MODEL" | "ASSUMPTION";
  affectedRecordRefs: string[];
  potentialImpact: string;
  reasonableAlternatives: string[];
  treatment: string;
  sensitivityStudyRefs: string[];
  importance: "LOW" | "MEDIUM" | "HIGH";
}

export interface ExternalFloodPreOperationalAssumption extends ExternalFloodAnalysisRecord {
  affectedRecordRefs: string[];
  missingDesignInformation: string[];
  limitation: string;
  closureAction: string;
  closurePhase: string;
  closureStatus: "OPEN" | "IN_PROGRESS" | "CLOSED";
}

export interface ExternalFloodProcessDocumentation extends Unique, Named {
  processDescription: string;
  inputsDescription: string;
  methodsDescription: string;
  resultsDescription: string;
  limitations: string[];
  supportingDocumentRefs: string[];
  traceabilityLinks: Array<{
    uuid: string;
    requirementRef: string;
    inputRefs: string[];
    modelRefs: string[];
    resultRefs: string[];
    documentationRefs: string[];
  }>;
}

export interface ExternalFloodPraInterfaceTransferItem extends Unique, Named {
  recordRef: string;
  sourceModelRef: string;
  destinationRefs: string[];
  values: string[];
  evidenceRefs: string[];
  status: "CONTROLLED" | "WORKING" | "OPEN";
}

export interface ExternalFloodPraInterfaceRecord extends ExternalFloodAnalysisRecord {
  technicalElementCode: ExternalFloodTechnicalElementCode;
  technicalElementName: string;
  direction: "INPUT" | "OUTPUT";
  role: string;
  producer: ExternalFloodTechnicalElementCode | "XF";
  consumer: ExternalFloodTechnicalElementCode | "XF";
  payloadType:
    | "HAZARD_SCREENING_RESULT" | "OPERATING_STATE" | "INITIATING_EVENT"
    | "EVENT_SEQUENCE" | "SUCCESS_CRITERION" | "SYSTEM_MODEL"
    | "HUMAN_FAILURE_EVENT" | "DATA_PARAMETER" | "HAZARD_CURVE"
    | "FRAGILITY" | "EXTERNAL_FLOOD_EQUIPMENT_LIST" | "COEXISTENT_HAZARD"
    | "SEQUENCE_FAMILY_RESULT" | "RISK_CONTRIBUTOR";
  columns: string[];
  transferItems: ExternalFloodPraInterfaceTransferItem[];
  producerRefs: string[];
  consumerRefs: string[];
  consistencyChecks: string[];
  consistent: boolean;
  openItems: string[];
}

export function createExternalFloodSrCatalog(
  prefix: ExternalFloodPraSubelement,
  requirements: Record<string, string[]>,
  stageOverrides: Record<string, PlantStage[]> = {},
): Record<string, ExternalFloodSrCatalogEntry> {
  const catalog: Record<string, ExternalFloodSrCatalogEntry> = {};
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
