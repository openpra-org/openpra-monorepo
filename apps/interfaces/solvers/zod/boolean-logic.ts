import { z } from "zod";
import { BooleanOperator, BooleanNodeKind } from "../boolean-logic";
import type { BooleanModel } from "../boolean-logic";

export const BooleanNodeIdSchema = z.number();
export const BasicEventIdSchema = z.number();

export const BooleanOperatorSchema = z.enum(BooleanOperator);

export const BooleanNodeKindSchema = z.enum(BooleanNodeKind);

export const BooleanGateNodeSchema = z.object({
  id: BooleanNodeIdSchema,
  kind: z.literal(BooleanNodeKind.GATE),
  operator: BooleanOperatorSchema,
  inputs: z.array(BooleanNodeIdSchema),
  k: z.number().optional(),
});

export const BooleanBasicEventNodeSchema = z.object({
  id: BooleanNodeIdSchema,
  kind: z.literal(BooleanNodeKind.BASIC_EVENT),
  basicEventId: BasicEventIdSchema,
});

export const BooleanHouseEventNodeSchema = z.object({
  id: BooleanNodeIdSchema,
  kind: z.literal(BooleanNodeKind.HOUSE_EVENT),
});

export const BooleanNodeSchema = z.discriminatedUnion("kind", [
  BooleanGateNodeSchema,
  BooleanBasicEventNodeSchema,
  BooleanHouseEventNodeSchema,
]);

export const BooleanTreeSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  topNodeId: BooleanNodeIdSchema,
  systemReference: z.string().optional(),
});

export const BooleanSequenceSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  initiatingEventId: BasicEventIdSchema,
  expressionNodeId: BooleanNodeIdSchema,
  endStateId: z.number().optional(),
  eventSequenceReference: z.string().optional(),
  plantOperatingStateReference: z.string().optional(),
});

export const EndStateNodeSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  sequenceIds: z.array(z.number()),
  aggregationNodeId: BooleanNodeIdSchema.optional(),
  releaseCategoryReference: z.string().optional(),
});

export const BooleanModelSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  nodes: z.record(z.number(), BooleanNodeSchema),
  faultTrees: z.array(BooleanTreeSchema),
  sequences: z.array(BooleanSequenceSchema).optional(),
  endStates: z.array(EndStateNodeSchema).optional(),
  houseEventIds: z.array(BooleanNodeIdSchema).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertBooleanModelMirrorsType = Expect<
  Equal<z.infer<typeof BooleanModelSchema>, BooleanModel>
>;
