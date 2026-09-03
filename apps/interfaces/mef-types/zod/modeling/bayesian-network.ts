import { z } from "zod";
import { CanvasLayoutMetadataSchema, CanvasPositionSchema, WorkbookEntityIdSchema } from "./shared";
import type {
  BayesianNetworkChanceNode,
  BayesianNetworkConditionalProbabilityTable,
  BayesianNetworkCptRow,
  BayesianNetworkCptValue,
  BayesianNetworkCptValues,
  BayesianNetworkDefinition,
  BayesianNetworkDirectedEdge,
  BayesianNetworkEvidenceConfiguration,
  BayesianNetworkEvidenceObservation,
  BayesianNetworkEntityIdentity,
  BayesianNetworkModuleInputBinding,
  BayesianNetworkModuleInputPort,
  BayesianNetworkModuleInstance,
  BayesianNetworkModuleNodeMapping,
  BayesianNetworkModuleOutputBinding,
  BayesianNetworkModuleOutputPort,
  BayesianNetworkModuleStateMapping,
  BayesianNetworkModuleTemplate,
  BayesianNetworkNode,
  BayesianNetworkNodePosition,
  BayesianNetworkNodeState,
  BayesianNetworkNodeStates,
  BayesianNetworkParentReference,
  BayesianNetworkParentStateSelection,
  BayesianNetworkXdslMetadata,
  BayesianNetworkXdslNodeIdentifier,
} from "../../modeling/bayesian-network";

const BayesianNetworkEntityIdentitySchema = z.object({
  id: WorkbookEntityIdSchema,
  code: z.string().trim().min(1, "Entity code is required").max(64, "Entity code must be 64 characters or fewer"),
  name: z.string().trim().min(1, "Entity name is required").max(200, "Entity name must be 200 characters or fewer"),
  description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
});

const BayesianNetworkNodeStateSchema = z
  .object({
    id: WorkbookEntityIdSchema,
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
    nodeId: WorkbookEntityIdSchema,
    order: z.number().int().nonnegative(),
  })
  .strict();

const BayesianNetworkDirectedEdgeSchema = z
  .object({
    id: WorkbookEntityIdSchema,
    parentNodeId: WorkbookEntityIdSchema,
    childNodeId: WorkbookEntityIdSchema,
  })
  .strict();

const BayesianNetworkParentStateSelectionSchema = z
  .object({
    parentNodeId: WorkbookEntityIdSchema,
    stateId: WorkbookEntityIdSchema,
  })
  .strict();

const BayesianNetworkCptValueSchema = z
  .object({
    stateId: WorkbookEntityIdSchema,
    probability: z.number().min(0, "Probability cannot be less than zero").max(1, "Probability cannot exceed one"),
  })
  .strict();

const BayesianNetworkCptValuesSchema = z
  .tuple([BayesianNetworkCptValueSchema, BayesianNetworkCptValueSchema])
  .rest(BayesianNetworkCptValueSchema);

const BayesianNetworkCptRowSchema = z
  .object({
    id: WorkbookEntityIdSchema,
    parentStates: z.array(BayesianNetworkParentStateSelectionSchema),
    values: BayesianNetworkCptValuesSchema,
  })
  .strict();

const BayesianNetworkConditionalProbabilityTableSchema = z
  .object({
    nodeId: WorkbookEntityIdSchema,
    parents: z.array(BayesianNetworkParentReferenceSchema),
    rows: z.array(BayesianNetworkCptRowSchema),
  })
  .strict();

const BayesianNetworkNodePositionSchema = z
  .object({
    nodeId: WorkbookEntityIdSchema,
    position: CanvasPositionSchema,
  })
  .strict();

const BayesianNetworkXdslNodeIdentifierSchema = z
  .object({
    nodeId: WorkbookEntityIdSchema,
    sourceId: z.string().trim().min(1, "XDSL node id is required"),
  })
  .strict();

const BayesianNetworkXdslMetadataSchema = z
  .object({
    rootAttributes: z.record(z.string(), z.string()),
    extensionsXml: z.string().optional(),
    nodeIdentifiers: z.array(BayesianNetworkXdslNodeIdentifierSchema),
  })
  .strict()
  .superRefine((metadata, context) => {
    const internalIds = new Set<string>();
    const sourceIds = new Set<string>();
    metadata.nodeIdentifiers.forEach((identifier, index) => {
      if (internalIds.has(identifier.nodeId)) {
        context.addIssue({
          code: "custom",
          path: ["nodeIdentifiers", index, "nodeId"],
          message: "Each Bayesian-network node can have only one XDSL identifier",
        });
      }
      if (sourceIds.has(identifier.sourceId)) {
        context.addIssue({
          code: "custom",
          path: ["nodeIdentifiers", index, "sourceId"],
          message: "XDSL node identifiers must be unique",
        });
      }
      internalIds.add(identifier.nodeId);
      sourceIds.add(identifier.sourceId);
    });
  });

const BayesianNetworkModuleInputPortSchema = BayesianNetworkEntityIdentitySchema.extend({
  node: BayesianNetworkNodeSchema,
}).strict();

const BayesianNetworkModuleOutputPortSchema = BayesianNetworkEntityIdentitySchema.extend({
  nodeId: WorkbookEntityIdSchema,
}).strict();

const BayesianNetworkModuleTemplateSchema = BayesianNetworkEntityIdentitySchema.extend({
  nodes: z.array(BayesianNetworkNodeSchema),
  edges: z.array(BayesianNetworkDirectedEdgeSchema),
  conditionalProbabilityTables: z.array(BayesianNetworkConditionalProbabilityTableSchema),
  nodePositions: z.array(BayesianNetworkNodePositionSchema),
  inputPorts: z.array(BayesianNetworkModuleInputPortSchema),
  outputPorts: z.array(BayesianNetworkModuleOutputPortSchema),
}).strict();

const BayesianNetworkModuleInputBindingSchema = z
  .object({
    portId: WorkbookEntityIdSchema,
    nodeId: WorkbookEntityIdSchema,
  })
  .strict();

const BayesianNetworkModuleStateMappingSchema = z
  .object({
    templateStateId: WorkbookEntityIdSchema,
    stateId: WorkbookEntityIdSchema,
  })
  .strict();

const BayesianNetworkModuleNodeMappingSchema = z
  .object({
    templateNodeId: WorkbookEntityIdSchema,
    nodeId: WorkbookEntityIdSchema,
    stateMappings: z.array(BayesianNetworkModuleStateMappingSchema),
  })
  .strict();

const BayesianNetworkModuleOutputBindingSchema = z
  .object({
    portId: WorkbookEntityIdSchema,
    nodeId: WorkbookEntityIdSchema,
  })
  .strict();

const BayesianNetworkModuleInstanceSchema = BayesianNetworkEntityIdentitySchema.extend({
  templateId: WorkbookEntityIdSchema,
  inputBindings: z.array(BayesianNetworkModuleInputBindingSchema),
  nodeMappings: z.array(BayesianNetworkModuleNodeMappingSchema),
  outputBindings: z.array(BayesianNetworkModuleOutputBindingSchema),
}).strict();

const BayesianNetworkEvidenceObservationSchema = z
  .object({
    nodeId: WorkbookEntityIdSchema,
    stateId: WorkbookEntityIdSchema,
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

const BayesianNetworkDefinitionSchema = z
  .object({
    nodes: z.array(BayesianNetworkNodeSchema),
    edges: z.array(BayesianNetworkDirectedEdgeSchema),
    conditionalProbabilityTables: z.array(BayesianNetworkConditionalProbabilityTableSchema),
    nodePositions: z.array(BayesianNetworkNodePositionSchema),
    layout: CanvasLayoutMetadataSchema,
    xdslMetadata: BayesianNetworkXdslMetadataSchema.optional(),
    moduleTemplates: z.array(BayesianNetworkModuleTemplateSchema).optional(),
    moduleInstances: z.array(BayesianNetworkModuleInstanceSchema).optional(),
  })
  .strict();

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
type _AssertBayesianNetworkXdslNodeIdentifier = Expect<
  Equal<z.infer<typeof BayesianNetworkXdslNodeIdentifierSchema>, BayesianNetworkXdslNodeIdentifier>
>;
type _AssertBayesianNetworkXdslMetadata = Expect<
  Equal<z.infer<typeof BayesianNetworkXdslMetadataSchema>, BayesianNetworkXdslMetadata>
>;
type _AssertBayesianNetworkModuleInputPort = Expect<
  Equal<z.infer<typeof BayesianNetworkModuleInputPortSchema>, BayesianNetworkModuleInputPort>
>;
type _AssertBayesianNetworkModuleOutputPort = Expect<
  Equal<z.infer<typeof BayesianNetworkModuleOutputPortSchema>, BayesianNetworkModuleOutputPort>
>;
type _AssertBayesianNetworkModuleTemplate = Expect<
  Equal<z.infer<typeof BayesianNetworkModuleTemplateSchema>, BayesianNetworkModuleTemplate>
>;
type _AssertBayesianNetworkModuleInputBinding = Expect<
  Equal<z.infer<typeof BayesianNetworkModuleInputBindingSchema>, BayesianNetworkModuleInputBinding>
>;
type _AssertBayesianNetworkModuleStateMapping = Expect<
  Equal<z.infer<typeof BayesianNetworkModuleStateMappingSchema>, BayesianNetworkModuleStateMapping>
>;
type _AssertBayesianNetworkModuleNodeMapping = Expect<
  Equal<z.infer<typeof BayesianNetworkModuleNodeMappingSchema>, BayesianNetworkModuleNodeMapping>
>;
type _AssertBayesianNetworkModuleOutputBinding = Expect<
  Equal<z.infer<typeof BayesianNetworkModuleOutputBindingSchema>, BayesianNetworkModuleOutputBinding>
>;
type _AssertBayesianNetworkModuleInstance = Expect<
  Equal<z.infer<typeof BayesianNetworkModuleInstanceSchema>, BayesianNetworkModuleInstance>
>;
type _AssertBayesianNetworkEvidenceObservation = Expect<
  Equal<z.infer<typeof BayesianNetworkEvidenceObservationSchema>, BayesianNetworkEvidenceObservation>
>;
type _AssertBayesianNetworkEvidenceConfiguration = Expect<
  Equal<z.infer<typeof BayesianNetworkEvidenceConfigurationSchema>, BayesianNetworkEvidenceConfiguration>
>;
type _AssertBayesianNetworkDefinition = Expect<
  Equal<z.infer<typeof BayesianNetworkDefinitionSchema>, BayesianNetworkDefinition>
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
};
