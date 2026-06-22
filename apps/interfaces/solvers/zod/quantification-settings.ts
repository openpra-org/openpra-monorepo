import { z } from "zod";
import type { QuantificationRequest } from "../quantification-settings";

export const SolverTargetSchema = z.enum(["SCRAM", "PRAXIS"]);

export const ConvergenceIntervalPolicySchema = z.enum(["bayes", "wald"]);

export const VariableOrderingSchema = z.enum(["sift", "gsift", "ils"]);

export const QuantificationSettingsSchema = z.object({
  solver: SolverTargetSchema.optional(),

  mocus: z.boolean().optional(),
  bdd: z.boolean().optional(),
  zbdd: z.boolean().optional(),
  pdag: z.boolean().optional(),
  adaptive: z.boolean().optional(),

  rareEvent: z.boolean().optional(),
  mcub: z.boolean().optional(),
  monteCarlo: z.boolean().optional(),

  primeImplicants: z.boolean().optional(),
  primeImplicantsTdd: z.boolean().optional(),
  reorder: VariableOrderingSchema.optional(),
  reorderBudgetSeconds: z.number().optional(),
  probability: z.boolean().optional(),
  importance: z.boolean().optional(),
  uncertainty: z.boolean().optional(),
  ccf: z.boolean().optional(),
  sil: z.boolean().optional(),

  limitOrder: z.number().optional(),
  cutOff: z.number().optional(),
  missionTime: z.number().optional(),
  timeStep: z.number().optional(),
  numTrials: z.number().optional(),
  numQuantiles: z.number().optional(),
  numBins: z.number().optional(),
  seed: z.number().optional(),

  confidence: z.number().optional(),
  delta: z.number().optional(),
  burnIn: z.number().optional(),
  earlyStop: z.boolean().optional(),
  ciPolicy: ConvergenceIntervalPolicySchema.optional(),
  batchSize: z.number().optional(),
  sampleSize: z.number().optional(),
  overheadRatio: z.number().optional(),

  noKn: z.boolean().optional(),
  noXor: z.boolean().optional(),
  keepNullGates: z.boolean().optional(),
  compilationLevel: z.number().optional(),

  oracleP: z.number().optional(),
  watchMode: z.boolean().optional(),
});

export const QuantificationRequestSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  booleanModelRef: z.number(),
  bindingTableRef: z.number(),
  ccfGroupTableRef: z.number().optional(),
  settings: QuantificationSettingsSchema,
  modelVersionRef: z.string().optional(),
  configurationControlRecordId: z.string().optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertQuantificationRequestMirrorsType = Expect<
  Equal<z.infer<typeof QuantificationRequestSchema>, QuantificationRequest>
>;
