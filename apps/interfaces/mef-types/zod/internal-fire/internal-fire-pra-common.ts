import { z } from "zod";
import type {
  InternalFireAnalysisRecord,
  InternalFireInvestigation,
  InternalFireModelUncertainty,
  InternalFirePraInterfaceRecord,
  InternalFirePreOperationalAssumption,
  InternalFireProcessDocumentation,
  InternalFireScreeningDecision,
} from "../../internal-fire/internal-fire-pra-common";
import { SRReferenceSchema } from "../core/pra-common";

export const InternalFirePraSubelementSchema = z.enum(["FPP", "FES", "FCS", "FQLS", "FPRM", "FSS", "FIGN", "FCF", "FHR", "FESQ"]);
export const InternalFireRecordStatusSchema = z.enum(["DRAFT", "READY", "REVIEWED", "APPROVED", "SCREENED", "RETAINED", "OPEN", "CLOSED"]);

export const InternalFireAnalysisRecordSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  basis: z.string(),
  owner: z.string(),
  status: InternalFireRecordStatusSchema,
  evidenceRefs: z.array(z.string()),
  relatedRefs: z.array(z.string()),
  assumptionRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const InternalFireInvestigationSchema = InternalFireAnalysisRecordSchema.extend({
  investigationType: z.enum(["WALKDOWN", "INTERVIEW", "TALK_THROUGH", "TABLETOP", "COMPUTERIZED_WALKDOWN", "DOCUMENT_REVIEW"]),
  scope: z.string(),
  plantOperatingStateRefs: z.array(z.string()),
  locations: z.array(z.string()),
  participants: z.array(z.string()),
  performedDate: z.string(),
  observations: z.array(z.string()),
  findingRefs: z.array(z.string()),
  confirmedRecordRefs: z.array(z.string()),
});

export const InternalFireScreeningDecisionSchema = InternalFireAnalysisRecordSchema.extend({
  screenedObjectType: z.enum(["PAU", "IGNITION_SOURCE", "FIRE_SCENARIO", "MULTI_COMPARTMENT_SCENARIO", "EVENT_SEQUENCE_FAMILY"]),
  screenedObjectRefs: z.array(z.string()),
  criterion: z.enum(["FQLS-A1", "FQLS-A2", "APPROVED_ADDITIONAL", "SCR-2", "SCR-3", "RETAINED"]),
  disposition: z.enum(["SCREENED", "RETAINED"]),
  conservativeAssumptions: z.array(z.string()),
  quantitativeValue: z.number().optional(),
  quantitativeUnit: z.string().optional(),
  threshold: z.number().optional(),
  affectedEventSequenceFamilyRefs: z.array(z.string()),
});

export const InternalFireModelUncertaintySchema = InternalFireAnalysisRecordSchema.extend({
  sourceSubelement: InternalFirePraSubelementSchema,
  uncertaintyType: z.enum(["PARAMETER", "MODEL", "ASSUMPTION"]),
  affectedRecordRefs: z.array(z.string()),
  potentialImpact: z.string(),
  reasonableAlternatives: z.array(z.string()),
  treatment: z.string(),
  sensitivityStudyRefs: z.array(z.string()),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const InternalFirePreOperationalAssumptionSchema = InternalFireAnalysisRecordSchema.extend({
  affectedRecordRefs: z.array(z.string()),
  missingDesignInformation: z.array(z.string()),
  limitation: z.string(),
  closureAction: z.string(),
  closurePhase: z.string(),
  closureStatus: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

export const InternalFireProcessDocumentationSchema = z.object({
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

export const InternalFirePraInterfaceRecordSchema = InternalFireAnalysisRecordSchema.extend({
  technicalElementCode: z.enum(["POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ", "RI"]),
  technicalElementName: z.string(),
  direction: z.enum(["INPUT", "OUTPUT"]),
  role: z.string(),
  producer: z.enum(["POS", "IE", "ES", "SC", "SY", "HR", "DA", "F", "ESQ", "RI"]),
  consumer: z.enum(["POS", "IE", "ES", "SC", "SY", "HR", "DA", "F", "ESQ", "RI"]),
  payloadType: z.enum(["OPERATING_STATE", "INITIATING_EVENT", "EVENT_SEQUENCE", "SUCCESS_CRITERION", "SYSTEM_MODEL", "HUMAN_FAILURE_EVENT", "DATA_PARAMETER", "FIRE_SCENARIO_RESULT", "SEQUENCE_FAMILY_RESULT", "RISK_CONTRIBUTOR"]),
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
type _AnalysisRecord = Expect<Equal<z.infer<typeof InternalFireAnalysisRecordSchema>, InternalFireAnalysisRecord>>;
type _Investigation = Expect<Equal<z.infer<typeof InternalFireInvestigationSchema>, InternalFireInvestigation>>;
type _Screening = Expect<Equal<z.infer<typeof InternalFireScreeningDecisionSchema>, InternalFireScreeningDecision>>;
type _Uncertainty = Expect<Equal<z.infer<typeof InternalFireModelUncertaintySchema>, InternalFireModelUncertainty>>;
type _PreOp = Expect<Equal<z.infer<typeof InternalFirePreOperationalAssumptionSchema>, InternalFirePreOperationalAssumption>>;
type _Documentation = Expect<Equal<z.infer<typeof InternalFireProcessDocumentationSchema>, InternalFireProcessDocumentation>>;
type _Interface = Expect<Equal<z.infer<typeof InternalFirePraInterfaceRecordSchema>, InternalFirePraInterfaceRecord>>;
