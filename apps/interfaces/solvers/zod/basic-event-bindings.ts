import { z } from "zod";
import { ParameterDistributionSchema } from "interfaces-mef-types/zod/core/events";
import { BooleanNodeIdSchema, BasicEventIdSchema } from "./boolean-logic";
import type { BasicEventBindingTable } from "../basic-event-bindings";

export const BasicEventValueModelSchema = z.enum([
  "PROBABILITY",
  "RATE_PER_HOUR",
  "RATE_PER_DEMAND",
]);

export const BasicEventBindingSchema = z.object({
  basicEventId: BasicEventIdSchema,
  valueModel: BasicEventValueModelSchema,
  pointProbability: z.number().optional(),
  distribution: ParameterDistributionSchema.optional(),
  dataAnalysisParameterRef: z.string().optional(),
});

export const HouseEventStateBindingSchema = z.object({
  houseEventId: BooleanNodeIdSchema,
  state: z.boolean(),
});

export const BasicEventBindingTableSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  bindings: z.array(BasicEventBindingSchema),
  houseEventStates: z.array(HouseEventStateBindingSchema).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertBasicEventBindingTableMirrorsType = Expect<
  Equal<z.infer<typeof BasicEventBindingTableSchema>, BasicEventBindingTable>
>;
