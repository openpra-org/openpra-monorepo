import { z } from "zod";
import { BayesianNetworkDefinitionSchema } from "interfaces-mef-types/zod/modeling";
import { WorkbookModelIdSchema } from "../shared";
import type { BayesianNetworkModel } from "./bayesian-network-model";

const BayesianNetworkModelSchema = z.object({
  modelId: WorkbookModelIdSchema,
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000),
  ...BayesianNetworkDefinitionSchema.shape,
}).strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertBayesianNetworkModel = Expect<
  Equal<z.infer<typeof BayesianNetworkModelSchema>, BayesianNetworkModel>
>;

export {
  BayesianNetworkEntityIdentitySchema,
  BayesianNetworkNodeStateSchema,
  BayesianNetworkNodeStatesSchema,
  BayesianNetworkChanceNodeSchema,
  BayesianNetworkNodeSchema,
  BayesianNetworkParentReferenceSchema,
  BayesianNetworkDirectedEdgeSchema,
  BayesianNetworkParentStateSelectionSchema,
  BayesianNetworkCptValueSchema,
  BayesianNetworkCptValuesSchema,
  BayesianNetworkCptRowSchema,
  BayesianNetworkConditionalProbabilityTableSchema,
  BayesianNetworkNodePositionSchema,
  BayesianNetworkXdslNodeIdentifierSchema,
  BayesianNetworkXdslMetadataSchema,
  BayesianNetworkModuleInputPortSchema,
  BayesianNetworkModuleOutputPortSchema,
  BayesianNetworkModuleTemplateSchema,
  BayesianNetworkModuleInputBindingSchema,
  BayesianNetworkModuleStateMappingSchema,
  BayesianNetworkModuleNodeMappingSchema,
  BayesianNetworkModuleOutputBindingSchema,
  BayesianNetworkModuleInstanceSchema,
  BayesianNetworkEvidenceObservationSchema,
  BayesianNetworkEvidenceConfigurationSchema,
  BayesianNetworkDefinitionSchema,
} from "interfaces-mef-types/zod/modeling";
export { BayesianNetworkModelSchema };
