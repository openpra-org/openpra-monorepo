import { z } from "zod";
import {
  CanvasLayoutMetadataSchema,
  CanvasPositionSchema,
  MethodEntityReferenceSchema,
  WorkbookEntityIdSchema,
} from "./shared";
import { WorkbookParameterReferenceSchema } from "./references";
import type {
  FaultTreeAndGate,
  FaultTreeBasicEvent,
  FaultTreeBasicEventCatalogueDefinition,
  FaultTreeBasicEventProbability,
  FaultTreeBasicEventReference,
  FaultTreeControlledDataSourceReference,
  FaultTreeDefinition,
  FaultTreeEntityIdentity,
  FaultTreeGate,
  FaultTreeGateInput,
  FaultTreeHouseEvent,
  FaultTreeKOfNGate,
  FaultTreeLeafNode,
  FaultTreeNodePosition,
  FaultTreeNotGate,
  FaultTreeOrGate,
  FaultTreeTopGateReference,
  FaultTreeTransferReference,
  FaultTreeUndevelopedEvent,
} from "../../modeling/fault-tree";

const FaultTreeEntityIdentitySchema = z.object({
  id: WorkbookEntityIdSchema,
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
    gateId: WorkbookEntityIdSchema,
  })
  .strict();

const FaultTreeBasicEventReferenceSchema = z
  .object({
    id: WorkbookEntityIdSchema,
    kind: z.literal("BASIC_EVENT_REFERENCE"),
    basicEventId: WorkbookEntityIdSchema,
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
    id: WorkbookEntityIdSchema,
    gateId: WorkbookEntityIdSchema,
    childId: WorkbookEntityIdSchema,
    order: z.number().int().nonnegative(),
  })
  .strict();

const FaultTreeNodePositionSchema = z
  .object({
    nodeId: WorkbookEntityIdSchema,
    position: CanvasPositionSchema,
  })
  .strict();

const FaultTreeControlledDataSourceReferenceSchema = WorkbookParameterReferenceSchema;

const FaultTreeBasicEventProbabilitySchema = z
  .object({
    value: z.number().min(0, "Probability cannot be less than zero").max(1, "Probability cannot exceed one"),
    controlledDataSource: FaultTreeControlledDataSourceReferenceSchema.optional(),
  })
  .strict();

const FaultTreeBasicEventSchema = FaultTreeEntityIdentitySchema.extend({
  probability: FaultTreeBasicEventProbabilitySchema,
}).strict();

const FaultTreeBasicEventCatalogueDefinitionSchema = z
  .object({
    basicEvents: z.array(FaultTreeBasicEventSchema),
  })
  .strict();

const FaultTreeDefinitionSchema = z
  .object({
    topGate: FaultTreeTopGateReferenceSchema.nullable(),
    gates: z.array(FaultTreeGateSchema),
    leafNodes: z.array(FaultTreeLeafNodeSchema),
    gateInputs: z.array(FaultTreeGateInputSchema),
    nodePositions: z.array(FaultTreeNodePositionSchema),
    layout: CanvasLayoutMetadataSchema,
  })
  .strict();

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
type _AssertFaultTreeBasicEventCatalogueDefinition = Expect<
  Equal<
    z.infer<typeof FaultTreeBasicEventCatalogueDefinitionSchema>,
    FaultTreeBasicEventCatalogueDefinition
  >
>;
type _AssertFaultTreeDefinition = Expect<
  Equal<z.infer<typeof FaultTreeDefinitionSchema>, FaultTreeDefinition>
>;

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
  FaultTreeBasicEventCatalogueDefinitionSchema,
  FaultTreeDefinitionSchema,
};
