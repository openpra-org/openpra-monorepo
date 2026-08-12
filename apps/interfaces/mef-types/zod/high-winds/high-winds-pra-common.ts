import { z } from "zod";
import { SRReferenceSchema } from "../core/pra-common";

export const HighWindsPraSubelementSchema = z.enum(["WHA", "WFR", "WPR"]);
export const HighWindsHazardTypeSchema = z.enum(["STRAIGHT_WIND", "TROPICAL_CYCLONE", "TORNADO"]);
export const HighWindsEffectTypeSchema = z.enum(["WIND_PRESSURE", "ATMOSPHERIC_PRESSURE_CHANGE", "WIND_GENERATED_MISSILE", "STRUCTURAL_INTERACTION", "WIND_DRIVEN_RAIN"]);
export const HighWindsRecordStatusSchema = z.enum(["DRAFT", "READY", "REVIEWED", "APPROVED", "SCREENED", "RETAINED", "OPEN", "CLOSED"]);

export const HighWindsAnalysisRecordSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  basis: z.string(),
  owner: z.string(),
  status: HighWindsRecordStatusSchema,
  evidenceRefs: z.array(z.string()),
  relatedRefs: z.array(z.string()),
  assumptionRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HighWindsInvestigationSchema = HighWindsAnalysisRecordSchema.extend({
  investigationType: z.enum(["WALKDOWN", "MISSILE_SURVEY", "INTERVIEW", "TALK_THROUGH", "TABLETOP", "COMPUTERIZED_WALKDOWN", "DOCUMENT_REVIEW"]),
  scope: z.string(),
  plantOperatingStateRefs: z.array(z.string()),
  locations: z.array(z.string()),
  participants: z.array(z.string()),
  performedDate: z.string(),
  observations: z.array(z.string()),
  findingRefs: z.array(z.string()),
  confirmedRecordRefs: z.array(z.string()),
});

export const HighWindsScreeningDecisionSchema = HighWindsAnalysisRecordSchema.extend({
  screenedObjectType: z.enum(["HAZARD", "SSC", "WIND_EFFECT", "FAILURE_MODE", "MISSILE_SOURCE", "EVENT_SEQUENCE_FAMILY"]),
  screenedObjectRefs: z.array(z.string()),
  hazardTypes: z.array(HighWindsHazardTypeSchema),
  windEffects: z.array(HighWindsEffectTypeSchema),
  criterion: z.enum(["SCR-1", "SCR-2", "SCR-3", "APPROVED_ALTERNATE", "RETAINED"]),
  disposition: z.enum(["SCREENED", "RETAINED"]),
  conservativeAssumptions: z.array(z.string()),
  quantitativeValue: z.number().optional(),
  quantitativeUnit: z.string().optional(),
  threshold: z.number().optional(),
  aggregateFrequencyPerPlantYear: z.number().optional(),
  investigationRefs: z.array(z.string()),
  affectedEventSequenceFamilyRefs: z.array(z.string()),
});

export const HighWindsModelUncertaintySchema = HighWindsAnalysisRecordSchema.extend({
  sourceSubelement: HighWindsPraSubelementSchema,
  uncertaintyType: z.enum(["PARAMETER", "MODEL", "ASSUMPTION"]),
  affectedRecordRefs: z.array(z.string()),
  potentialImpact: z.string(),
  reasonableAlternatives: z.array(z.string()),
  treatment: z.string(),
  sensitivityStudyRefs: z.array(z.string()),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const HighWindsPreOperationalAssumptionSchema = HighWindsAnalysisRecordSchema.extend({
  affectedRecordRefs: z.array(z.string()),
  missingDesignInformation: z.array(z.string()),
  limitation: z.string(),
  closureAction: z.string(),
  closurePhase: z.string(),
  closureStatus: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

export const HighWindsProcessDocumentationSchema = z.object({
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

const HighWindsPraTechnicalElementCodeSchema = z.enum(["HS", "POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ", "RI", "XF", "F", "FL", "O"]);

export const HighWindsPraInterfaceRecordSchema = HighWindsAnalysisRecordSchema.extend({
  technicalElementCode: HighWindsPraTechnicalElementCodeSchema,
  technicalElementName: z.string(),
  direction: z.enum(["INPUT", "OUTPUT"]),
  role: z.string(),
  producer: z.union([HighWindsPraTechnicalElementCodeSchema, z.literal("W")]),
  consumer: z.union([HighWindsPraTechnicalElementCodeSchema, z.literal("W")]),
  payloadType: z.enum(["HAZARD_SCREENING_RESULT", "OPERATING_STATE", "INITIATING_EVENT", "EVENT_SEQUENCE", "SUCCESS_CRITERION", "SYSTEM_MODEL", "HUMAN_FAILURE_EVENT", "DATA_PARAMETER", "HAZARD_CURVE", "FRAGILITY", "HIGH_WIND_EQUIPMENT_LIST", "COEXISTENT_HAZARD", "SEQUENCE_FAMILY_RESULT", "RISK_CONTRIBUTOR"]),
  columns: z.array(z.string()),
  transferItems: z.array(z.object({
    uuid: z.string(),
    name: z.string(),
    description: z.string().optional(),
    recordRef: z.string(),
    sourceModelRef: z.string(),
    destinationRefs: z.array(z.string()),
    values: z.array(z.string()),
    evidenceRefs: z.array(z.string()),
    status: z.enum(["CONTROLLED", "WORKING", "OPEN"]),
  })),
  producerRefs: z.array(z.string()),
  consumerRefs: z.array(z.string()),
  consistencyChecks: z.array(z.string()),
  consistent: z.boolean(),
  openItems: z.array(z.string()),
});
