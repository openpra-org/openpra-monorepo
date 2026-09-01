import { z } from "zod";
import {
  CanvasLayoutMetadataSchema,
  CanvasPositionSchema,
  MethodEntityReferenceSchema,
  MethodModelReferenceSchema,
  WorkbookEntityIdSchema,
} from "./shared";
import { AnnualizationConventionSchema, EventFrequencyUnitSchema } from "./quantitative-semantics";
import type {
  EventTreeBranchOutcome,
  EventTreeBranchResult,
  EventTreeCanvasLayout,
  EventTreeControlledDataSourceReference,
  EventTreeDefinition,
  EventTreeEndState,
  EventTreeEndStateBranchResult,
  EventTreeEntityIdentity,
  EventTreeFunctionalEvent,
  EventTreeFunctionalEventFaultTreeLink,
  EventTreeHclConfigurationReference,
  EventTreeInitiatingEventFrequency,
  EventTreeInitiatingEventReference,
  EventTreeNodePosition,
  EventTreeSequence,
  EventTreeSequencePathStep,
  EventTreeTransferBranchResult,
} from "../../modeling/event-tree";

const EventTreeEntityIdentitySchema = z.object({
  id: WorkbookEntityIdSchema,
  code: z.string().trim().min(1, "Entity code is required").max(64, "Entity code must be 64 characters or fewer"),
  name: z.string().trim().min(1, "Entity name is required").max(200, "Entity name must be 200 characters or fewer"),
  description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
});

const EventTreeInitiatingEventReferenceSchema = z
  .object({
    target: MethodEntityReferenceSchema,
  })
  .strict();

const EventTreeControlledDataSourceReferenceSchema = z
  .object({
    workbookId: z.string().trim().min(1, "Workbook id is required"),
    parameterId: WorkbookEntityIdSchema,
  })
  .strict();

const EventTreeInitiatingEventFrequencySchema = z
  .object({
    value: z.number().nonnegative("Initiating-event frequency cannot be negative"),
    unit: EventFrequencyUnitSchema.optional(),
    annualization: AnnualizationConventionSchema.optional(),
    controlledDataSource: EventTreeControlledDataSourceReferenceSchema.optional(),
  })
  .strict();

const EventTreeFunctionalEventSchema = EventTreeEntityIdentitySchema.extend({
  order: z.number().int().nonnegative(),
}).strict();

const EventTreeFunctionalEventFaultTreeLinkSchema = z
  .object({
    functionalEventId: WorkbookEntityIdSchema,
    faultTreeTopGate: MethodEntityReferenceSchema,
  })
  .strict();

const EventTreeBranchOutcomeSchema = z.enum(["SUCCESS", "FAILURE", "BYPASSED"]);

const EventTreeSequencePathStepSchema = z
  .object({
    functionalEventId: WorkbookEntityIdSchema,
    outcome: EventTreeBranchOutcomeSchema,
  })
  .strict();

const EventTreeEndStateSchema = EventTreeEntityIdentitySchema.strict();

const EventTreeEndStateBranchResultSchema = z
  .object({
    kind: z.literal("END_STATE"),
    endStateId: WorkbookEntityIdSchema,
  })
  .strict();

const EventTreeTransferBranchResultSchema = z
  .object({
    kind: z.literal("TRANSFER"),
    target: MethodEntityReferenceSchema,
  })
  .strict();

const EventTreeBranchResultSchema = z.discriminatedUnion("kind", [
  EventTreeEndStateBranchResultSchema,
  EventTreeTransferBranchResultSchema,
]);

const EventTreeSequenceSchema = EventTreeEntityIdentitySchema.extend({
  path: z.array(EventTreeSequencePathStepSchema),
  result: EventTreeBranchResultSchema,
}).strict();

const EventTreeNodePositionSchema = z
  .object({
    nodeId: WorkbookEntityIdSchema,
    position: CanvasPositionSchema,
  })
  .strict();

const EventTreeHclConfigurationReferenceSchema = z
  .object({
    configuration: MethodModelReferenceSchema,
  })
  .strict();

const EventTreeCanvasLayoutSchema = z
  .object({
    metadata: CanvasLayoutMetadataSchema,
    nodePositions: z.array(EventTreeNodePositionSchema),
  })
  .strict();

const EventTreeDefinitionSchema = z
  .object({
    initiatingEvent: EventTreeInitiatingEventReferenceSchema.nullable(),
    initiatingEventFrequency: EventTreeInitiatingEventFrequencySchema.nullable(),
    functionalEvents: z.array(EventTreeFunctionalEventSchema),
    functionalEventFaultTreeLinks: z.array(EventTreeFunctionalEventFaultTreeLinkSchema),
    endStates: z.array(EventTreeEndStateSchema),
    sequences: z.array(EventTreeSequenceSchema),
    hclConfiguration: EventTreeHclConfigurationReferenceSchema.nullable(),
    canvas: EventTreeCanvasLayoutSchema,
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertEventTreeEntityIdentity = Expect<
  Equal<z.infer<typeof EventTreeEntityIdentitySchema>, EventTreeEntityIdentity>
>;
type _AssertEventTreeInitiatingEventReference = Expect<
  Equal<z.infer<typeof EventTreeInitiatingEventReferenceSchema>, EventTreeInitiatingEventReference>
>;
type _AssertEventTreeControlledDataSourceReference = Expect<
  Equal<z.infer<typeof EventTreeControlledDataSourceReferenceSchema>, EventTreeControlledDataSourceReference>
>;
type _AssertEventTreeInitiatingEventFrequency = Expect<
  Equal<z.infer<typeof EventTreeInitiatingEventFrequencySchema>, EventTreeInitiatingEventFrequency>
>;
type _AssertEventTreeFunctionalEvent = Expect<
  Equal<z.infer<typeof EventTreeFunctionalEventSchema>, EventTreeFunctionalEvent>
>;
type _AssertEventTreeFunctionalEventFaultTreeLink = Expect<
  Equal<z.infer<typeof EventTreeFunctionalEventFaultTreeLinkSchema>, EventTreeFunctionalEventFaultTreeLink>
>;
type _AssertEventTreeBranchOutcome = Expect<
  Equal<z.infer<typeof EventTreeBranchOutcomeSchema>, EventTreeBranchOutcome>
>;
type _AssertEventTreeSequencePathStep = Expect<
  Equal<z.infer<typeof EventTreeSequencePathStepSchema>, EventTreeSequencePathStep>
>;
type _AssertEventTreeEndState = Expect<Equal<z.infer<typeof EventTreeEndStateSchema>, EventTreeEndState>>;
type _AssertEventTreeEndStateBranchResult = Expect<
  Equal<z.infer<typeof EventTreeEndStateBranchResultSchema>, EventTreeEndStateBranchResult>
>;
type _AssertEventTreeTransferBranchResult = Expect<
  Equal<z.infer<typeof EventTreeTransferBranchResultSchema>, EventTreeTransferBranchResult>
>;
type _AssertEventTreeBranchResult = Expect<
  Equal<z.infer<typeof EventTreeBranchResultSchema>, EventTreeBranchResult>
>;
type _AssertEventTreeSequence = Expect<Equal<z.infer<typeof EventTreeSequenceSchema>, EventTreeSequence>>;
type _AssertEventTreeNodePosition = Expect<
  Equal<z.infer<typeof EventTreeNodePositionSchema>, EventTreeNodePosition>
>;
type _AssertEventTreeHclConfigurationReference = Expect<
  Equal<z.infer<typeof EventTreeHclConfigurationReferenceSchema>, EventTreeHclConfigurationReference>
>;
type _AssertEventTreeCanvasLayout = Expect<
  Equal<z.infer<typeof EventTreeCanvasLayoutSchema>, EventTreeCanvasLayout>
>;
type _AssertEventTreeDefinition = Expect<
  Equal<z.infer<typeof EventTreeDefinitionSchema>, EventTreeDefinition>
>;

export {
  EventTreeEntityIdentitySchema,
  EventTreeInitiatingEventReferenceSchema,
  EventTreeControlledDataSourceReferenceSchema,
  EventTreeInitiatingEventFrequencySchema,
  EventTreeFunctionalEventSchema,
  EventTreeFunctionalEventFaultTreeLinkSchema,
  EventTreeBranchOutcomeSchema,
  EventTreeSequencePathStepSchema,
  EventTreeEndStateSchema,
  EventTreeEndStateBranchResultSchema,
  EventTreeTransferBranchResultSchema,
  EventTreeBranchResultSchema,
  EventTreeSequenceSchema,
  EventTreeNodePositionSchema,
  EventTreeHclConfigurationReferenceSchema,
  EventTreeCanvasLayoutSchema,
  EventTreeDefinitionSchema,
};
