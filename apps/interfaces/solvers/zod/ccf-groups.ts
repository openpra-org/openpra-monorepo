import { z } from "zod";
import { CcfModelType, CcfTestingScheme } from "../ccf-groups";
import { BasicEventIdSchema } from "./boolean-logic";
import type { CcfGroupTable } from "../ccf-groups";

export const CcfModelTypeSchema = z.enum(CcfModelType);

export const CcfTestingSchemeSchema = z.enum(CcfTestingScheme);

export const BetaFactorModelSchema = z.object({
  modelType: z.literal(CcfModelType.BETA_FACTOR),
  beta: z.number(),
  totalFailureProbability: z.number(),
});

export const MglModelSchema = z.object({
  modelType: z.literal(CcfModelType.MGL),
  beta: z.number(),
  gamma: z.number().optional(),
  delta: z.number().optional(),
  additionalFactors: z.record(z.string(), z.number()).optional(),
  totalFailureProbability: z.number(),
});

export const AlphaFactorModelSchema = z.object({
  modelType: z.literal(CcfModelType.ALPHA_FACTOR),
  alphaFactors: z.record(z.string(), z.number()),
  totalFailureProbability: z.number(),
  testingScheme: CcfTestingSchemeSchema.optional(),
});

export const PhiFactorModelSchema = z.object({
  modelType: z.literal(CcfModelType.PHI_FACTOR),
  phiFactors: z.record(z.string(), z.number()),
  totalFailureProbability: z.number(),
});

export const CcfParameterModelSchema = z.discriminatedUnion("modelType", [
  BetaFactorModelSchema,
  MglModelSchema,
  AlphaFactorModelSchema,
  PhiFactorModelSchema,
]);

export const CcfGroupSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  memberBasicEventIds: z.array(BasicEventIdSchema),
  model: CcfParameterModelSchema,
  dataAnalysisCCFParameterRef: z.string().optional(),
});

export const CcfGroupTableSchema = z.object({
  id: z.number(),
  booleanModelRef: z.number(),
  groups: z.array(CcfGroupSchema),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertCcfGroupTableMirrorsType = Expect<
  Equal<z.infer<typeof CcfGroupTableSchema>, CcfGroupTable>
>;
