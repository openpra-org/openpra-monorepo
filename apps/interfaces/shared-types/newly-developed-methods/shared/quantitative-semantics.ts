import { z } from "zod";
import { AnnualizationConventionSchema, EventTreeInitiatingEventFrequencySchema } from "interfaces-mef-types/zod/modeling";
import type { AnnualizationConvention, EventTreeInitiatingEventFrequency } from "interfaces-mef-types/modeling";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { UncertainExpressionSchema } from "interfaces-mef-types/zod/core/uncertainty";
import { WorkbookEntityIdSchema } from "./method-model";
import type { WorkbookEntityId } from "./method-model";

interface BasicEventQuantificationTrace {
  basicEventId: WorkbookEntityId;
  expression: UncertainExpression;
  pointProbability: number;
}

interface AnnualizedEventFrequency {
  value: number;
  unit: "PER_YEAR";
}

interface EventTreeFrequencySemantics {
  initiatingEventFrequency: EventTreeInitiatingEventFrequency;
  annualization: AnnualizationConvention;
  annualizedInitiatingEventFrequency: AnnualizedEventFrequency;
}

const ProbabilitySchema = z.number().min(0).max(1);

const BasicEventQuantificationTraceSchema = z
  .object({
    basicEventId: WorkbookEntityIdSchema,
    expression: UncertainExpressionSchema,
    pointProbability: ProbabilitySchema,
  })
  .strict();

const AnnualizedEventFrequencySchema = z
  .object({
    value: z.number().finite().nonnegative(),
    unit: z.literal("PER_YEAR"),
  })
  .strict();

const EventTreeFrequencySemanticsSchema = z
  .object({
    initiatingEventFrequency: EventTreeInitiatingEventFrequencySchema,
    annualization: AnnualizationConventionSchema,
    annualizedInitiatingEventFrequency: AnnualizedEventFrequencySchema,
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertBasicEventTrace = Expect<
  Equal<z.infer<typeof BasicEventQuantificationTraceSchema>, BasicEventQuantificationTrace>
>;
type _AssertAnnualizedFrequency = Expect<
  Equal<z.infer<typeof AnnualizedEventFrequencySchema>, AnnualizedEventFrequency>
>;
type _AssertFrequencySemantics = Expect<
  Equal<z.infer<typeof EventTreeFrequencySemanticsSchema>, EventTreeFrequencySemantics>
>;

export {
  AnnualizedEventFrequencySchema,
  BasicEventQuantificationTraceSchema,
  EventTreeFrequencySemanticsSchema,
};
export type {
  AnnualizedEventFrequency,
  BasicEventQuantificationTrace,
  EventTreeFrequencySemantics,
};
