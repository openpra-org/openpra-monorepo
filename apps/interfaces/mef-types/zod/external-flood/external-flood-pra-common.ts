import { z } from "zod";
import { SRReferenceSchema } from "../core/pra-common";

export const ExternalFloodPraSubelementSchema = z.enum(["XFHA", "XFFR", "XFPR"]);
export const ExternalFloodHazardTypeSchema = z.enum([
  "LOCAL_INTENSE_PRECIPITATION", "RIVERINE_FLOOD", "DAM_OR_IMPOUNDMENT_FAILURE",
  "STORM_SURGE", "SEICHE", "TSUNAMI", "GROUNDWATER", "WAVE_RUNUP", "ICE_EFFECTS",
]);
export const ExternalFloodEffectTypeSchema = z.enum([
  "STATIC_WATER_LEVEL", "HYDROSTATIC_LOAD", "HYDRODYNAMIC_LOAD", "WAVE_LOAD",
  "DEBRIS_IMPACT", "EROSION_AND_SCOUR", "SEDIMENTATION", "GROUNDWATER_INTRUSION",
  "DRAINAGE_BACKFLOW", "SITE_ACCESS_LOSS",
]);
export const ExternalFloodRecordStatusSchema = z.enum([
  "DRAFT", "READY", "REVIEWED", "APPROVED", "SCREENED", "RETAINED", "OPEN", "CLOSED",
]);

export const ExternalFloodAnalysisRecordSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  basis: z.string(),
  owner: z.string(),
  status: ExternalFloodRecordStatusSchema,
  evidenceRefs: z.array(z.string()),
  relatedRefs: z.array(z.string()),
  assumptionRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ExternalFloodInvestigationSchema = ExternalFloodAnalysisRecordSchema.extend({
  investigationType: z.enum(["WALKDOWN", "INTERVIEW", "TALK_THROUGH", "TABLETOP", "SURVEY", "DOCUMENT_REVIEW"]),
  scope: z.string(),
  plantOperatingStateRefs: z.array(z.string()),
  locations: z.array(z.string()),
  participants: z.array(z.string()),
  performedDate: z.string(),
  observations: z.array(z.string()),
  findingRefs: z.array(z.string()),
  confirmedRecordRefs: z.array(z.string()),
});

export const ExternalFloodModelUncertaintySchema = ExternalFloodAnalysisRecordSchema.extend({
  sourceSubelement: ExternalFloodPraSubelementSchema,
  uncertaintyType: z.enum(["PARAMETER", "MODEL", "ASSUMPTION"]),
  affectedRecordRefs: z.array(z.string()),
  potentialImpact: z.string(),
  reasonableAlternatives: z.array(z.string()),
  treatment: z.string(),
  sensitivityStudyRefs: z.array(z.string()),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const ExternalFloodPreOperationalAssumptionSchema = ExternalFloodAnalysisRecordSchema.extend({
  affectedRecordRefs: z.array(z.string()),
  missingDesignInformation: z.array(z.string()),
  limitation: z.string(),
  closureAction: z.string(),
  closurePhase: z.string(),
  closureStatus: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

export const ExternalFloodProcessDocumentationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  processDescription: z.string(),
  inputsDescription: z.string(),
  methodsDescription: z.string(),
  resultsDescription: z.string(),
  limitations: z.array(z.string()),
  supportingDocumentRefs: z.array(z.string()),
  traceabilityLinks: z.array(z.object({
    uuid: z.string(),
    requirementRef: z.string(),
    inputRefs: z.array(z.string()),
    modelRefs: z.array(z.string()),
    resultRefs: z.array(z.string()),
    documentationRefs: z.array(z.string()),
  })),
});

const ExternalFloodTechnicalElementCodeSchema = z.enum([
  "HS", "POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ", "RI", "S", "W", "FL", "F", "O",
]);

export const ExternalFloodPraInterfaceRecordSchema = ExternalFloodAnalysisRecordSchema.extend({
  technicalElementCode: ExternalFloodTechnicalElementCodeSchema,
  technicalElementName: z.string(),
  direction: z.enum(["INPUT", "OUTPUT"]),
  role: z.string(),
  producer: z.union([ExternalFloodTechnicalElementCodeSchema, z.literal("XF")]),
  consumer: z.union([ExternalFloodTechnicalElementCodeSchema, z.literal("XF")]),
  payloadType: z.enum([
    "HAZARD_SCREENING_RESULT", "OPERATING_STATE", "INITIATING_EVENT", "EVENT_SEQUENCE",
    "SUCCESS_CRITERION", "SYSTEM_MODEL", "HUMAN_FAILURE_EVENT", "DATA_PARAMETER",
    "HAZARD_CURVE", "FRAGILITY", "EXTERNAL_FLOOD_EQUIPMENT_LIST", "COEXISTENT_HAZARD",
    "SEQUENCE_FAMILY_RESULT", "RISK_CONTRIBUTOR",
  ]),
  columns: z.array(z.string()),
  transferItems: z.array(z.object({
    uuid: z.string(), name: z.string(), description: z.string().optional(), recordRef: z.string(),
    sourceModelRef: z.string(), destinationRefs: z.array(z.string()), values: z.array(z.string()),
    evidenceRefs: z.array(z.string()), status: z.enum(["CONTROLLED", "WORKING", "OPEN"]),
  })),
  producerRefs: z.array(z.string()),
  consumerRefs: z.array(z.string()),
  consistencyChecks: z.array(z.string()),
  consistent: z.boolean(),
  openItems: z.array(z.string()),
});
