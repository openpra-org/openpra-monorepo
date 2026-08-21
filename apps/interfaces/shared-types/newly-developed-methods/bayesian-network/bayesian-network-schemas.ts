import { z } from "zod";
import { CanvasLayoutMetadataSchema, CanvasPositionSchema, MethodEntityIdSchema, MethodModelMetadataSchema } from "../shared";
import type {
  BayesianNetworkChanceNode,
  BayesianNetworkConditionalProbabilityTable,
  BayesianNetworkCptRow,
  BayesianNetworkCptValue,
  BayesianNetworkCptValues,
  BayesianNetworkDirectedEdge,
  BayesianNetworkEvidenceConfiguration,
  BayesianNetworkEvidenceObservation,
  BayesianNetworkEntityIdentity,
  BayesianNetworkModel,
  BayesianNetworkNodePosition,
  BayesianNetworkNode,
  BayesianNetworkNodeState,
  BayesianNetworkNodeStates,
  BayesianNetworkParentReference,
  BayesianNetworkParentStateSelection,
} from "./bayesian-network-model";

const BayesianNetworkEntityIdentitySchema = z.object({
  id: MethodEntityIdSchema,
  code: z.string().trim().min(1, "Entity code is required").max(64, "Entity code must be 64 characters or fewer"),
  name: z.string().trim().min(1, "Entity name is required").max(200, "Entity name must be 200 characters or fewer"),
  description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
});

const BayesianNetworkNodeStateSchema = z
  .object({
    id: MethodEntityIdSchema,
    code: z.string().trim().min(1, "State code is required").max(64, "State code must be 64 characters or fewer"),
    name: z.string().trim().min(1, "State name is required").max(200, "State name must be 200 characters or fewer"),
  })
  .strict();

const BayesianNetworkNodeStatesSchema = z
  .tuple([BayesianNetworkNodeStateSchema, BayesianNetworkNodeStateSchema])
  .rest(BayesianNetworkNodeStateSchema);

const BayesianNetworkChanceNodeSchema = BayesianNetworkEntityIdentitySchema.extend({
  kind: z.literal("CHANCE_NODE"),
  states: BayesianNetworkNodeStatesSchema,
}).strict();

const BayesianNetworkNodeSchema = BayesianNetworkChanceNodeSchema;

const BayesianNetworkParentReferenceSchema = z
  .object({
    nodeId: MethodEntityIdSchema,
    order: z.number().int().nonnegative(),
  })
  .strict();

const BayesianNetworkDirectedEdgeSchema = z
  .object({
    id: MethodEntityIdSchema,
    parentNodeId: MethodEntityIdSchema,
    childNodeId: MethodEntityIdSchema,
  })
  .strict();

const BayesianNetworkParentStateSelectionSchema = z
  .object({
    parentNodeId: MethodEntityIdSchema,
    stateId: MethodEntityIdSchema,
  })
  .strict();

const BayesianNetworkCptValueSchema = z
  .object({
    stateId: MethodEntityIdSchema,
    probability: z.number().min(0, "Probability cannot be less than zero").max(1, "Probability cannot exceed one"),
  })
  .strict();

const BayesianNetworkCptValuesSchema = z
  .tuple([BayesianNetworkCptValueSchema, BayesianNetworkCptValueSchema])
  .rest(BayesianNetworkCptValueSchema);

const BayesianNetworkCptRowSchema = z
  .object({
    id: MethodEntityIdSchema,
    parentStates: z.array(BayesianNetworkParentStateSelectionSchema),
    values: BayesianNetworkCptValuesSchema,
  })
  .strict();

const BayesianNetworkConditionalProbabilityTableSchema = z
  .object({
    nodeId: MethodEntityIdSchema,
    parents: z.array(BayesianNetworkParentReferenceSchema),
    rows: z.array(BayesianNetworkCptRowSchema),
  })
  .strict();

const BayesianNetworkNodePositionSchema = z
  .object({
    nodeId: MethodEntityIdSchema,
    position: CanvasPositionSchema,
  })
  .strict();

const BayesianNetworkEvidenceObservationSchema = z
  .object({
    nodeId: MethodEntityIdSchema,
    stateId: MethodEntityIdSchema,
  })
  .strict();

const BayesianNetworkEvidenceConfigurationSchema = z
  .object({
    observations: z.array(BayesianNetworkEvidenceObservationSchema),
  })
  .strict()
  .superRefine((configuration, context) => {
    const observedNodeIds = new Set<string>();
    configuration.observations.forEach((observation, index) => {
      if (observedNodeIds.has(observation.nodeId)) {
        context.addIssue({
          code: "custom",
          path: ["observations", index, "nodeId"],
          message: "Evidence can select only one state per node",
        });
      }
      observedNodeIds.add(observation.nodeId);
    });
  });

const BayesianNetworkModelSchema = MethodModelMetadataSchema.extend({
  methodType: z.literal("BAYESIAN_NETWORK"),
  nodes: z.array(BayesianNetworkNodeSchema),
  edges: z.array(BayesianNetworkDirectedEdgeSchema),
  conditionalProbabilityTables: z.array(BayesianNetworkConditionalProbabilityTableSchema),
  nodePositions: z.array(BayesianNetworkNodePositionSchema),
  layout: CanvasLayoutMetadataSchema,
}).strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertBayesianNetworkEntityIdentity = Expect<
  Equal<z.infer<typeof BayesianNetworkEntityIdentitySchema>, BayesianNetworkEntityIdentity>
>;
type _AssertBayesianNetworkNodeState = Expect<
  Equal<z.infer<typeof BayesianNetworkNodeStateSchema>, BayesianNetworkNodeState>
>;
type _AssertBayesianNetworkNodeStates = Expect<
  Equal<z.infer<typeof BayesianNetworkNodeStatesSchema>, BayesianNetworkNodeStates>
>;
type _AssertBayesianNetworkChanceNode = Expect<
  Equal<z.infer<typeof BayesianNetworkChanceNodeSchema>, BayesianNetworkChanceNode>
>;
type _AssertBayesianNetworkNode = Expect<Equal<z.infer<typeof BayesianNetworkNodeSchema>, BayesianNetworkNode>>;
type _AssertBayesianNetworkParentReference = Expect<
  Equal<z.infer<typeof BayesianNetworkParentReferenceSchema>, BayesianNetworkParentReference>
>;
type _AssertBayesianNetworkDirectedEdge = Expect<
  Equal<z.infer<typeof BayesianNetworkDirectedEdgeSchema>, BayesianNetworkDirectedEdge>
>;
type _AssertBayesianNetworkParentStateSelection = Expect<
  Equal<z.infer<typeof BayesianNetworkParentStateSelectionSchema>, BayesianNetworkParentStateSelection>
>;
type _AssertBayesianNetworkCptValue = Expect<
  Equal<z.infer<typeof BayesianNetworkCptValueSchema>, BayesianNetworkCptValue>
>;
type _AssertBayesianNetworkCptValues = Expect<
  Equal<z.infer<typeof BayesianNetworkCptValuesSchema>, BayesianNetworkCptValues>
>;
type _AssertBayesianNetworkCptRow = Expect<
  Equal<z.infer<typeof BayesianNetworkCptRowSchema>, BayesianNetworkCptRow>
>;
type _AssertBayesianNetworkConditionalProbabilityTable = Expect<
  Equal<
    z.infer<typeof BayesianNetworkConditionalProbabilityTableSchema>,
    BayesianNetworkConditionalProbabilityTable
  >
>;
type _AssertBayesianNetworkNodePosition = Expect<
  Equal<z.infer<typeof BayesianNetworkNodePositionSchema>, BayesianNetworkNodePosition>
>;
type _AssertBayesianNetworkEvidenceObservation = Expect<
  Equal<z.infer<typeof BayesianNetworkEvidenceObservationSchema>, BayesianNetworkEvidenceObservation>
>;
type _AssertBayesianNetworkEvidenceConfiguration = Expect<
  Equal<z.infer<typeof BayesianNetworkEvidenceConfigurationSchema>, BayesianNetworkEvidenceConfiguration>
>;
type _AssertBayesianNetworkModel = Expect<Equal<z.infer<typeof BayesianNetworkModelSchema>, BayesianNetworkModel>>;

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
  BayesianNetworkEvidenceObservationSchema,
  BayesianNetworkEvidenceConfigurationSchema,
  BayesianNetworkModelSchema,
};
