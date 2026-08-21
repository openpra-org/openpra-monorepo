import { z } from "zod";
import {
  CanvasLayoutMetadataSchema,
  CanvasPositionSchema,
  MethodEntityIdSchema,
  MethodEntityReferenceSchema,
  MethodModelAuditSchema,
  MethodModelMetadataSchema,
  MethodModelRevisionSchema,
  MethodModelSchemaVersionSchema,
} from "../shared";
import type {
  FaultTreeAndGate,
  FaultTreeBasicEvent,
  FaultTreeBasicEventCatalogue,
  FaultTreeBasicEventReference,
  FaultTreeBasicEventProbability,
  FaultTreeControlledDataSourceReference,
  FaultTreeEntityIdentity,
  FaultTreeGate,
  FaultTreeGateInput,
  FaultTreeHouseEvent,
  FaultTreeKOfNGate,
  FaultTreeLeafNode,
  FaultTreeModel,
  FaultTreeNotGate,
  FaultTreeNodePosition,
  FaultTreeOrGate,
  FaultTreeTopGateReference,
  FaultTreeTransferReference,
  FaultTreeUndevelopedEvent,
} from "./fault-tree-model";

const FaultTreeEntityIdentitySchema = z.object({
  id: MethodEntityIdSchema,
  code: z.string().trim().min(1, "Entity code is required").max(64, "Entity code must be 64 characters or fewer"),
  name: z.string().trim().min(1, "Entity name is required").max(200, "Entity name must be 200 characters or fewer"),
  description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
});

const FaultTreeAndGateSchema = FaultTreeEntityIdentitySchema.extend({
  kind: z.literal("GATE"),
  gateType: z.literal("AND"),
}).strict();

const FaultTreeOrGateSchema = FaultTreeEntityIdentitySchema.extend({
  kind: z.literal("GATE"),
  gateType: z.literal("OR"),
}).strict();

const FaultTreeNotGateSchema = FaultTreeEntityIdentitySchema.extend({
  kind: z.literal("GATE"),
  gateType: z.literal("NOT"),
}).strict();

const FaultTreeKOfNGateSchema = FaultTreeEntityIdentitySchema.extend({
  kind: z.literal("GATE"),
  gateType: z.literal("K_OF_N"),
  k: z.number().int().positive("K must be a positive integer"),
}).strict();

const FaultTreeGateSchema = z.discriminatedUnion("gateType", [
  FaultTreeAndGateSchema,
  FaultTreeOrGateSchema,
  FaultTreeNotGateSchema,
  FaultTreeKOfNGateSchema,
]);

const FaultTreeTopGateReferenceSchema = z
  .object({
    gateId: MethodEntityIdSchema,
  })
  .strict();

const FaultTreeBasicEventReferenceSchema = z
  .object({
    id: MethodEntityIdSchema,
    kind: z.literal("BASIC_EVENT_REFERENCE"),
    basicEventId: MethodEntityIdSchema,
  })
  .strict();

const FaultTreeHouseEventSchema = FaultTreeEntityIdentitySchema.extend({
  kind: z.literal("HOUSE_EVENT"),
  state: z.boolean(),
}).strict();

const FaultTreeUndevelopedEventSchema = FaultTreeEntityIdentitySchema.extend({
  kind: z.literal("UNDEVELOPED_EVENT"),
}).strict();

const FaultTreeTransferReferenceSchema = FaultTreeEntityIdentitySchema.extend({
  kind: z.literal("TRANSFER_REFERENCE"),
  target: MethodEntityReferenceSchema,
}).strict();

const FaultTreeLeafNodeSchema = z.discriminatedUnion("kind", [
  FaultTreeBasicEventReferenceSchema,
  FaultTreeHouseEventSchema,
  FaultTreeUndevelopedEventSchema,
  FaultTreeTransferReferenceSchema,
]);

const FaultTreeGateInputSchema = z
  .object({
    id: MethodEntityIdSchema,
    gateId: MethodEntityIdSchema,
    childId: MethodEntityIdSchema,
    order: z.number().int().nonnegative(),
  })
  .strict();

const FaultTreeNodePositionSchema = z
  .object({
    nodeId: MethodEntityIdSchema,
    position: CanvasPositionSchema,
  })
  .strict();

const FaultTreeControlledDataSourceReferenceSchema = z
  .object({
    workbookId: z.string().trim().min(1, "Workbook id is required"),
    parameterId: MethodEntityIdSchema,
  })
  .strict();

const FaultTreeBasicEventProbabilitySchema = z
  .object({
    value: z.number().min(0, "Probability cannot be less than zero").max(1, "Probability cannot exceed one"),
    controlledDataSource: FaultTreeControlledDataSourceReferenceSchema.optional(),
  })
  .strict();

const FaultTreeBasicEventSchema = FaultTreeEntityIdentitySchema.extend({
  probability: FaultTreeBasicEventProbabilitySchema,
}).strict();

const FaultTreeBasicEventCatalogueSchema = z
  .object({
    schemaVersion: MethodModelSchemaVersionSchema,
    projectId: z.string().trim().min(1, "Project id is required"),
    revision: MethodModelRevisionSchema,
    ...MethodModelAuditSchema.shape,
    basicEvents: z.array(FaultTreeBasicEventSchema),
  })
  .strict();

const FaultTreeModelSchema = MethodModelMetadataSchema.extend({
  methodType: z.literal("FAULT_TREE"),
  topGate: FaultTreeTopGateReferenceSchema.nullable(),
  gates: z.array(FaultTreeGateSchema),
  leafNodes: z.array(FaultTreeLeafNodeSchema),
  gateInputs: z.array(FaultTreeGateInputSchema),
  nodePositions: z.array(FaultTreeNodePositionSchema),
  layout: CanvasLayoutMetadataSchema,
}).strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertFaultTreeEntityIdentity = Expect<
  Equal<z.infer<typeof FaultTreeEntityIdentitySchema>, FaultTreeEntityIdentity>
>;
type _AssertFaultTreeAndGate = Expect<Equal<z.infer<typeof FaultTreeAndGateSchema>, FaultTreeAndGate>>;
type _AssertFaultTreeOrGate = Expect<Equal<z.infer<typeof FaultTreeOrGateSchema>, FaultTreeOrGate>>;
type _AssertFaultTreeNotGate = Expect<Equal<z.infer<typeof FaultTreeNotGateSchema>, FaultTreeNotGate>>;
type _AssertFaultTreeKOfNGate = Expect<Equal<z.infer<typeof FaultTreeKOfNGateSchema>, FaultTreeKOfNGate>>;
type _AssertFaultTreeGate = Expect<Equal<z.infer<typeof FaultTreeGateSchema>, FaultTreeGate>>;
type _AssertFaultTreeTopGateReference = Expect<
  Equal<z.infer<typeof FaultTreeTopGateReferenceSchema>, FaultTreeTopGateReference>
>;
type _AssertFaultTreeBasicEventReference = Expect<
  Equal<z.infer<typeof FaultTreeBasicEventReferenceSchema>, FaultTreeBasicEventReference>
>;
type _AssertFaultTreeHouseEvent = Expect<Equal<z.infer<typeof FaultTreeHouseEventSchema>, FaultTreeHouseEvent>>;
type _AssertFaultTreeUndevelopedEvent = Expect<
  Equal<z.infer<typeof FaultTreeUndevelopedEventSchema>, FaultTreeUndevelopedEvent>
>;
type _AssertFaultTreeTransferReference = Expect<
  Equal<z.infer<typeof FaultTreeTransferReferenceSchema>, FaultTreeTransferReference>
>;
type _AssertFaultTreeLeafNode = Expect<Equal<z.infer<typeof FaultTreeLeafNodeSchema>, FaultTreeLeafNode>>;
type _AssertFaultTreeGateInput = Expect<Equal<z.infer<typeof FaultTreeGateInputSchema>, FaultTreeGateInput>>;
type _AssertFaultTreeNodePosition = Expect<
  Equal<z.infer<typeof FaultTreeNodePositionSchema>, FaultTreeNodePosition>
>;
type _AssertFaultTreeControlledDataSourceReference = Expect<
  Equal<
    z.infer<typeof FaultTreeControlledDataSourceReferenceSchema>,
    FaultTreeControlledDataSourceReference
  >
>;
type _AssertFaultTreeBasicEventProbability = Expect<
  Equal<z.infer<typeof FaultTreeBasicEventProbabilitySchema>, FaultTreeBasicEventProbability>
>;
type _AssertFaultTreeBasicEvent = Expect<
  Equal<z.infer<typeof FaultTreeBasicEventSchema>, FaultTreeBasicEvent>
>;
type _AssertFaultTreeBasicEventCatalogue = Expect<
  Equal<z.infer<typeof FaultTreeBasicEventCatalogueSchema>, FaultTreeBasicEventCatalogue>
>;
type _AssertFaultTreeModel = Expect<Equal<z.infer<typeof FaultTreeModelSchema>, FaultTreeModel>>;

export {
  FaultTreeEntityIdentitySchema,
  FaultTreeAndGateSchema,
  FaultTreeOrGateSchema,
  FaultTreeNotGateSchema,
  FaultTreeKOfNGateSchema,
  FaultTreeGateSchema,
  FaultTreeTopGateReferenceSchema,
  FaultTreeBasicEventReferenceSchema,
  FaultTreeHouseEventSchema,
  FaultTreeUndevelopedEventSchema,
  FaultTreeTransferReferenceSchema,
  FaultTreeLeafNodeSchema,
  FaultTreeGateInputSchema,
  FaultTreeNodePositionSchema,
  FaultTreeControlledDataSourceReferenceSchema,
  FaultTreeBasicEventProbabilitySchema,
  FaultTreeBasicEventSchema,
  FaultTreeBasicEventCatalogueSchema,
  FaultTreeModelSchema,
};
