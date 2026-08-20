import { z } from "zod";
import type { InternalFloodAnalysisRecord, InternalFloodInvestigation, InternalFloodModelUncertainty, InternalFloodPraInterfaceRecord, InternalFloodPreOperationalAssumption, InternalFloodProcessDocumentation, InternalFloodScreeningDecision } from "../../internal-flood/internal-flood-pra-common";
import { SRReferenceSchema } from "../core/pra-common";

export const InternalFloodPraSubelementSchema = z.enum(["FLPP", "FLSO", "FLSN", "FLEV", "FLPR", "FLHR", "FLESQ"]);
export const InternalFloodRecordStatusSchema = z.enum(["DRAFT", "READY", "REVIEWED", "APPROVED", "SCREENED", "RETAINED", "OPEN", "CLOSED"]);

export const InternalFloodAnalysisRecordSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  basis: z.string(),
  owner: z.string(),
  status: InternalFloodRecordStatusSchema,
  evidenceRefs: z.array(z.string()),
  relatedRefs: z.array(z.string()),
  assumptionRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const InternalFloodInvestigationSchema = InternalFloodAnalysisRecordSchema.extend({
  investigationType: z.enum(["WALKDOWN", "INTERVIEW", "TABLETOP", "COMPUTERIZED_WALKDOWN", "DOCUMENT_REVIEW"]),
  scope: z.string(),
  plantOperatingStateRefs: z.array(z.string()),
  locations: z.array(z.string()),
  participants: z.array(z.string()),
  performedDate: z.string(),
  observations: z.array(z.string()),
  findingRefs: z.array(z.string()),
  confirmedRecordRefs: z.array(z.string()),
});

export const InternalFloodScreeningDecisionSchema = InternalFloodAnalysisRecordSchema.extend({
  screenedObjectType: z.enum(["FLOOD_AREA", "FLOOD_SOURCE", "FLOOD_SCENARIO", "EVENT_SEQUENCE_FAMILY"]),
  screenedObjectRefs: z.array(z.string()),
  criterion: z.enum(["SCR-1", "SCR-2", "SCR-3", "IE-C9", "TWO_ORDER_COMPARISON", "RETAINED"]),
  disposition: z.enum(["SCREENED", "RETAINED"]),
  conservativeAssumptions: z.array(z.string()),
  quantitativeValue: z.number().optional(),
  quantitativeUnit: z.string().optional(),
  threshold: z.number().optional(),
  affectedEventSequenceFamilyRefs: z.array(z.string()),
});

export const InternalFloodModelUncertaintySchema = InternalFloodAnalysisRecordSchema.extend({
  sourceSubelement: InternalFloodPraSubelementSchema,
  uncertaintyType: z.enum(["PARAMETER", "MODEL", "ASSUMPTION"]),
  affectedRecordRefs: z.array(z.string()),
  potentialImpact: z.string(),
  reasonableAlternatives: z.array(z.string()),
  treatment: z.string(),
  sensitivityStudyRefs: z.array(z.string()),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const InternalFloodPreOperationalAssumptionSchema = InternalFloodAnalysisRecordSchema.extend({
  affectedRecordRefs: z.array(z.string()),
  missingDesignInformation: z.array(z.string()),
  limitation: z.string(),
  closureAction: z.string(),
  closurePhase: z.string(),
  closureStatus: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

export const InternalFloodProcessDocumentationSchema = z.object({
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

export const InternalFloodPraInterfaceRecordSchema = InternalFloodAnalysisRecordSchema.extend({
  technicalElementCode: z.enum(["POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ", "RI"]),
  technicalElementName: z.string(),
  direction: z.enum(["INPUT", "OUTPUT"]),
  role: z.string(),
  producer: z.enum(["POS", "IE", "ES", "SC", "SY", "HR", "DA", "FL", "ESQ", "RI"]),
  consumer: z.enum(["POS", "IE", "ES", "SC", "SY", "HR", "DA", "FL", "ESQ", "RI"]),
  payloadType: z.enum(["OPERATING_STATE", "INITIATING_EVENT", "EVENT_SEQUENCE", "SUCCESS_CRITERION", "SYSTEM_MODEL", "HUMAN_FAILURE_EVENT", "DATA_PARAMETER", "SEQUENCE_FAMILY_RESULT", "RISK_CONTRIBUTOR"]),
  columns: z.array(z.string()),
  transferItems: z.array(z.object({
    uuid: z.string(),
    name: z.string(),
    recordRef: z.string(),
    sourceModelRef: z.string(),
    destinationRefs: z.array(z.string()),
    values: z.array(z.string()),
    evidenceRefs: z.array(z.string()),
    status: z.enum(["CONTROLLED", "WORKING", "OPEN"]),
  })),
  standardRequirementRefs: z.array(z.string()),
  producerRefs: z.array(z.string()),
  consumerRefs: z.array(z.string()),
  transferBasis: z.string(),
  consistencyChecks: z.array(z.string()),
  consistent: z.boolean(),
  openItems: z.array(z.string()),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AnalysisRecord = Expect<Equal<z.infer<typeof InternalFloodAnalysisRecordSchema>, InternalFloodAnalysisRecord>>;
type _Investigation = Expect<Equal<z.infer<typeof InternalFloodInvestigationSchema>, InternalFloodInvestigation>>;
type _Screening = Expect<Equal<z.infer<typeof InternalFloodScreeningDecisionSchema>, InternalFloodScreeningDecision>>;
type _Uncertainty = Expect<Equal<z.infer<typeof InternalFloodModelUncertaintySchema>, InternalFloodModelUncertainty>>;
type _PreOp = Expect<Equal<z.infer<typeof InternalFloodPreOperationalAssumptionSchema>, InternalFloodPreOperationalAssumption>>;
type _Documentation = Expect<Equal<z.infer<typeof InternalFloodProcessDocumentationSchema>, InternalFloodProcessDocumentation>>;
type _Interface = Expect<Equal<z.infer<typeof InternalFloodPraInterfaceRecordSchema>, InternalFloodPraInterfaceRecord>>;
