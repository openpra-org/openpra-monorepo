import { z } from "zod";
import {
  HclConfigurationDefinitionBaseSchema,
  refineHclConfigurationDefinition,
} from "interfaces-mef-types/zod/modeling";
import { WorkbookModelIdSchema } from "../shared";
import type { HclConfigurationModel } from "./hcl-configuration";

const HclConfigurationModelSchema = z.object({
  modelId: WorkbookModelIdSchema,
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000),
  ...HclConfigurationDefinitionBaseSchema.shape,
})
  .strict()
  .superRefine((configuration, context) => refineHclConfigurationDefinition(configuration, context));

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertHclConfigurationModel = Expect<
  Equal<z.infer<typeof HclConfigurationModelSchema>, HclConfigurationModel>
>;

export {
  HclBayesianNetworkReferenceSchema,
  HclFaultTreeReferenceSchema,
  HclEventBindingSchema,
  HclBaseEvidenceSchema,
  HclEvidenceScenarioSchema,
  HclHazardGridDefinitionSchema,
  HclBasicEventProbabilityDistributionSchema,
  HclBasicEventUncertaintySchema,
  HclCptRowUncertaintySchema,
  HclUncertaintySettingsSchema,
  HclSolverSettingsSchema,
  HclConfigurationDefinitionBaseSchema,
  HclConfigurationDefinitionSchema,
} from "interfaces-mef-types/zod/modeling";
export { HclConfigurationModelSchema };
