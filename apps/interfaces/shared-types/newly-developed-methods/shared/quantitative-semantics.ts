import { z } from "zod";
import {
  AnnualizationConventionSchema,
  EventFrequencyUnitSchema,
  FaultTreeBasicEventQuantificationBasisSchema,
} from "interfaces-mef-types/zod/modeling";
import type {
  AnnualizationConvention,
  EventFrequencyUnit,
  FaultTreeBasicEventQuantificationBasis,
} from "interfaces-mef-types/modeling";
import { WorkbookEntityIdSchema } from "./method-model";
import type { WorkbookEntityId } from "./method-model";

interface BasicEventQuantificationInput {
  value: number;
  quantificationBasis?: FaultTreeBasicEventQuantificationBasis;
}

interface BasicEventQuantificationTrace {
  basicEventId: WorkbookEntityId;
  input: BasicEventQuantificationInput;
  resolvedProbability: number;
}

interface TypedEventFrequency {
  value: number;
  unit: EventFrequencyUnit;
}

interface EventTreeFrequencySemantics {
  initiatingEventFrequency: TypedEventFrequency;
  annualization: AnnualizationConvention;
  annualizedInitiatingEventFrequency: TypedEventFrequency & { unit: "PER_YEAR" };
}

const ProbabilitySchema = z.number().min(0).max(1);

const BasicEventQuantificationInputSchema = z
  .object({
    value: ProbabilitySchema,
    quantificationBasis: FaultTreeBasicEventQuantificationBasisSchema.optional(),
  })
  .strict();

const BasicEventQuantificationTraceSchema = z
  .object({
    basicEventId: WorkbookEntityIdSchema,
    input: BasicEventQuantificationInputSchema,
    resolvedProbability: ProbabilitySchema,
  })
  .strict();

const TypedEventFrequencySchema = z
  .object({
    value: z.number().nonnegative(),
    unit: EventFrequencyUnitSchema,
  })
  .strict();

const EventTreeFrequencySemanticsSchema = z
  .object({
    initiatingEventFrequency: TypedEventFrequencySchema,
    annualization: AnnualizationConventionSchema,
    annualizedInitiatingEventFrequency: TypedEventFrequencySchema.extend({
      unit: z.literal("PER_YEAR"),
    }).strict(),
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertBasicEventInput = Expect<
  Equal<z.infer<typeof BasicEventQuantificationInputSchema>, BasicEventQuantificationInput>
>;
type _AssertBasicEventTrace = Expect<
  Equal<z.infer<typeof BasicEventQuantificationTraceSchema>, BasicEventQuantificationTrace>
>;
type _AssertTypedFrequency = Expect<
  Equal<z.infer<typeof TypedEventFrequencySchema>, TypedEventFrequency>
>;
type _AssertFrequencySemantics = Expect<
  Equal<z.infer<typeof EventTreeFrequencySemanticsSchema>, EventTreeFrequencySemantics>
>;

export {
  BasicEventQuantificationInputSchema,
  BasicEventQuantificationTraceSchema,
  EventTreeFrequencySemanticsSchema,
  TypedEventFrequencySchema,
};
export type {
  BasicEventQuantificationInput,
  BasicEventQuantificationTrace,
  EventTreeFrequencySemantics,
  TypedEventFrequency,
};
