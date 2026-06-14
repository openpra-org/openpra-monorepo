import { z } from "zod";
import { BooleanNodeIdSchema, BasicEventIdSchema } from "./boolean-logic";
import type { BasicEventBindingTable, ExpressionNode } from "../basic-event-bindings";

export const ExpressionNodeSchema: z.ZodType<ExpressionNode> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("constant"), value: z.number() }),
    z.object({ kind: z.literal("parameter"), name: z.string() }),
    z.object({ kind: z.literal("missionTime") }),
    z.object({ kind: z.literal("time") }),
    z.object({ kind: z.literal("op"), op: z.string(), args: z.array(ExpressionNodeSchema) }),
  ]),
);

export const RateBasisSchema = z.enum(["PER_DEMAND", "PER_HOUR"]);

export const SummaryFamilySchema = z.enum(["LOGNORMAL", "NORMAL"]);

export const SummaryCentralSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mean"), value: z.number() }),
  z.object({ kind: z.literal("median"), value: z.number() }),
]);

export const SummarySpreadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("errorFactor"), value: z.number() }),
  z.object({ kind: z.literal("stdDev"), value: z.number() }),
  z.object({ kind: z.literal("percentiles"), p05: z.number(), p95: z.number() }),
]);

export const SummarySpecSchema = z.object({
  central: SummaryCentralSchema,
  spread: SummarySpreadSchema,
  family: SummaryFamilySchema,
});

export const ExposureSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("demands"), value: z.number() }),
  z.object({ kind: z.literal("hours"), value: z.number() }),
]);

export const RawDataPriorSchema = z.enum(["JEFFREYS", "UNIFORM"]);

export const RawDataSpecSchema = z.object({
  failures: z.number(),
  exposure: ExposureSchema,
  prior: RawDataPriorSchema,
});

export const BasicEventValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("probability"), value: z.number() }),
  z.object({
    kind: z.literal("rate"),
    rate: z.number(),
    basis: RateBasisSchema,
    missionTime: z.number().optional(),
  }),
  z.object({ kind: z.literal("summary"), summary: SummarySpecSchema }),
  z.object({ kind: z.literal("rawData"), rawData: RawDataSpecSchema }),
  z.object({ kind: z.literal("expression"), expression: ExpressionNodeSchema }),
]);

export const BasicEventBindingSchema = z.object({
  basicEventId: BasicEventIdSchema,
  value: BasicEventValueSchema,
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
  parameters: z.record(z.string(), ExpressionNodeSchema).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertBasicEventBindingTableMirrorsType = Expect<
  Equal<z.infer<typeof BasicEventBindingTableSchema>, BasicEventBindingTable>
>;
