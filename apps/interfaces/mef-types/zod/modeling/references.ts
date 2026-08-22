import { z } from "zod";
import type {
  BayesianNetworkNodeReference,
  EventTreeFunctionalEventReference,
  FaultTreeBasicEventCatalogueReference,
  FaultTreeTopEventReference,
  HclBindingReference,
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

const WorkbookParameterReferenceSchema = WorkbookEntityAddressSchema.extend({
  referenceType: z.literal("WORKBOOK_PARAMETER"),
}).strict();

const WorkbookCrossReferenceSchema = z.discriminatedUnion("referenceType", [
  FaultTreeTopEventReferenceSchema,
  FaultTreeBasicEventCatalogueReferenceSchema,
  EventTreeFunctionalEventReferenceSchema,
  BayesianNetworkNodeReferenceSchema,
  HclBindingReferenceSchema,
  WorkbookParameterReferenceSchema,
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
  WorkbookCrossReferenceSchema,
};
