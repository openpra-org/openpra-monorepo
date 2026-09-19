import { z } from "zod";
import type {
  BayesianNetworkNodeReference,
  EventTreeFunctionalEventReference,
  EventSequenceFamilyQuantificationReference,
  EventSequenceFamilyWorkbookReference,
  FaultTreeBasicEventCatalogueReference,
  FaultTreeTopEventReference,
  HclBindingReference,
  HumanFailureEventReference,
  IntegratedRiskResultReference,
  RadiologicalConsequenceResultReference,
  WorkbookParameterReference,
  WorkbookCrossReference,
  WorkbookCrossReferenceType,
} from "../../modeling/references";
import { WorkbookEntityAddressSchema, WorkbookModelEntityAddressSchema } from "./shared";

const WorkbookCrossReferenceTypeSchema = z.enum([
  "FAULT_TREE_TOP_EVENT",
  "FAULT_TREE_BASIC_EVENT",
  "EVENT_TREE_FUNCTIONAL_EVENT",
  "BAYESIAN_NETWORK_NODE",
  "HCL_BINDING",
  "WORKBOOK_PARAMETER",
  "HUMAN_FAILURE_EVENT",
  "EVENT_SEQUENCE_FAMILY",
  "EVENT_SEQUENCE_FAMILY_QUANTIFICATION",
  "RADIOLOGICAL_CONSEQUENCE_RESULT",
  "INTEGRATED_RISK_RESULT",
]);

const FaultTreeTopEventReferenceSchema = WorkbookModelEntityAddressSchema.extend({
  referenceType: z.literal("FAULT_TREE_TOP_EVENT"),
}).strict();

const FaultTreeBasicEventCatalogueReferenceSchema = WorkbookEntityAddressSchema.extend({
  referenceType: z.literal("FAULT_TREE_BASIC_EVENT"),
}).strict();

const EventTreeFunctionalEventReferenceSchema = WorkbookModelEntityAddressSchema.extend({
  referenceType: z.literal("EVENT_TREE_FUNCTIONAL_EVENT"),
}).strict();

const BayesianNetworkNodeReferenceSchema = WorkbookModelEntityAddressSchema.extend({
  referenceType: z.literal("BAYESIAN_NETWORK_NODE"),
}).strict();

const HclBindingReferenceSchema = WorkbookModelEntityAddressSchema.extend({
  referenceType: z.literal("HCL_BINDING"),
}).strict();

const WorkbookParameterReferenceSchema = z
  .object({
    referenceType: z.literal("WORKBOOK_PARAMETER"),
    workbookId: z.string().trim().min(1),
    entityId: z.string().trim().min(1),
  })
  .strict();

const HumanFailureEventReferenceSchema = z
  .object({
    referenceType: z.literal("HUMAN_FAILURE_EVENT"),
    workbookId: z.string().trim().min(1),
    entityId: z.string().trim().min(1),
    quantificationId: z.string().trim().min(1),
  })
  .strict();

function workbookScopedDomainReference<TReferenceType extends string>(referenceType: TReferenceType) {
  return z
    .object({
      referenceType: z.literal(referenceType),
      workbookId: z.string().trim().min(1),
      entityId: z.string().trim().min(1),
    })
    .strict();
}

// ES/ESQ/RC/RI domain records use controlled human-readable identifiers in
// existing workbooks (for example ESF-EARLY and RCQ-ESF-EARLY), not UUIDs.
const EventSequenceFamilyWorkbookReferenceSchema = workbookScopedDomainReference("EVENT_SEQUENCE_FAMILY");
const EventSequenceFamilyQuantificationReferenceSchema = workbookScopedDomainReference(
  "EVENT_SEQUENCE_FAMILY_QUANTIFICATION",
);
const RadiologicalConsequenceResultReferenceSchema = workbookScopedDomainReference(
  "RADIOLOGICAL_CONSEQUENCE_RESULT",
);
const IntegratedRiskResultReferenceSchema = workbookScopedDomainReference("INTEGRATED_RISK_RESULT");

const WorkbookCrossReferenceSchema = z.discriminatedUnion("referenceType", [
  FaultTreeTopEventReferenceSchema,
  FaultTreeBasicEventCatalogueReferenceSchema,
  EventTreeFunctionalEventReferenceSchema,
  BayesianNetworkNodeReferenceSchema,
  HclBindingReferenceSchema,
  WorkbookParameterReferenceSchema,
  HumanFailureEventReferenceSchema,
  EventSequenceFamilyWorkbookReferenceSchema,
  EventSequenceFamilyQuantificationReferenceSchema,
  RadiologicalConsequenceResultReferenceSchema,
  IntegratedRiskResultReferenceSchema,
]);

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertWorkbookCrossReferenceType = Expect<
  Equal<z.infer<typeof WorkbookCrossReferenceTypeSchema>, WorkbookCrossReferenceType>
>;
type _AssertFaultTreeTopEventReference = Expect<
  Equal<z.infer<typeof FaultTreeTopEventReferenceSchema>, FaultTreeTopEventReference>
>;
type _AssertFaultTreeBasicEventCatalogueReference = Expect<
  Equal<
    z.infer<typeof FaultTreeBasicEventCatalogueReferenceSchema>,
    FaultTreeBasicEventCatalogueReference
  >
>;
type _AssertEventTreeFunctionalEventReference = Expect<
  Equal<z.infer<typeof EventTreeFunctionalEventReferenceSchema>, EventTreeFunctionalEventReference>
>;
type _AssertBayesianNetworkNodeReference = Expect<
  Equal<z.infer<typeof BayesianNetworkNodeReferenceSchema>, BayesianNetworkNodeReference>
>;
type _AssertHclBindingReference = Expect<
  Equal<z.infer<typeof HclBindingReferenceSchema>, HclBindingReference>
>;
type _AssertWorkbookParameterReference = Expect<
  Equal<z.infer<typeof WorkbookParameterReferenceSchema>, WorkbookParameterReference>
>;
type _AssertHumanFailureEventReference = Expect<
  Equal<z.infer<typeof HumanFailureEventReferenceSchema>, HumanFailureEventReference>
>;
type _AssertEventSequenceFamilyWorkbookReference = Expect<
  Equal<z.infer<typeof EventSequenceFamilyWorkbookReferenceSchema>, EventSequenceFamilyWorkbookReference>
>;
type _AssertEventSequenceFamilyQuantificationReference = Expect<
  Equal<z.infer<typeof EventSequenceFamilyQuantificationReferenceSchema>, EventSequenceFamilyQuantificationReference>
>;
type _AssertRadiologicalConsequenceResultReference = Expect<
  Equal<z.infer<typeof RadiologicalConsequenceResultReferenceSchema>, RadiologicalConsequenceResultReference>
>;
type _AssertIntegratedRiskResultReference = Expect<
  Equal<z.infer<typeof IntegratedRiskResultReferenceSchema>, IntegratedRiskResultReference>
>;
type _AssertWorkbookCrossReference = Expect<
  Equal<z.infer<typeof WorkbookCrossReferenceSchema>, WorkbookCrossReference>
>;

export {
  WorkbookCrossReferenceTypeSchema,
  FaultTreeTopEventReferenceSchema,
  FaultTreeBasicEventCatalogueReferenceSchema,
  EventTreeFunctionalEventReferenceSchema,
  BayesianNetworkNodeReferenceSchema,
  HclBindingReferenceSchema,
  WorkbookParameterReferenceSchema,
  HumanFailureEventReferenceSchema,
  EventSequenceFamilyWorkbookReferenceSchema,
  EventSequenceFamilyQuantificationReferenceSchema,
  RadiologicalConsequenceResultReferenceSchema,
  IntegratedRiskResultReferenceSchema,
  WorkbookCrossReferenceSchema,
};
