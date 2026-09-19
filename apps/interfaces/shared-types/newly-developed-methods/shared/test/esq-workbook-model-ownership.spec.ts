import {
  EsqBayesianNetworkSchema,
  EsqHclConfigurationSchema,
} from "interfaces-mef-types/zod/esq/workbook-models";

const BN_MODEL_ID = "123e4567-e89b-42d3-a456-426614174201";
const BN_NODE_ID = "123e4567-e89b-42d3-a456-426614174202";
const BN_FALSE_STATE_ID = "123e4567-e89b-42d3-a456-426614174203";
const BN_TRUE_STATE_ID = "123e4567-e89b-42d3-a456-426614174204";
const FT_MODEL_ID = "123e4567-e89b-42d3-a456-426614174205";
const FT_BASIC_EVENT_ID = "123e4567-e89b-42d3-a456-426614174206";
const HCL_MODEL_ID = "123e4567-e89b-42d3-a456-426614174207";
const HCL_BINDING_ID = "123e4567-e89b-42d3-a456-426614174208";

const bayesianNetwork = {
  modelId: BN_MODEL_ID,
  code: "BN-DEPENDENCY",
  name: "Dependency network",
  description: "ESQ-owned dependency model",
  nodes: [
    {
      id: BN_NODE_ID,
      code: "PUMP-AVAILABLE",
      name: "Pump available",
      description: "Pump dependency state",
      kind: "CHANCE_NODE" as const,
      states: [
        { id: BN_FALSE_STATE_ID, code: "FALSE", name: "False" },
        { id: BN_TRUE_STATE_ID, code: "TRUE", name: "True" },
      ],
    },
  ],
  edges: [],
  conditionalProbabilityTables: [],
  nodePositions: [{ nodeId: BN_NODE_ID, position: { x: 80, y: 40 } }],
  layout: {
    viewport: { x: 0, y: 0, zoom: 1 },
    mode: "MANUAL" as const,
    direction: "LEFT_TO_RIGHT" as const,
  },
};

const hclConfiguration = {
  modelId: HCL_MODEL_ID,
  code: "HCL-DEPENDENCY",
  name: "Dependency bindings",
  description: "ESQ-owned HCL configuration",
  bayesianNetwork: { workbookId: "esq-workbook", modelId: BN_MODEL_ID },
  faultTrees: [{ workbookId: "sy-workbook", modelId: FT_MODEL_ID }],
  bindings: [
    {
      id: HCL_BINDING_ID,
      faultTreeBasicEvent: {
        referenceType: "FAULT_TREE_BASIC_EVENT" as const,
        workbookId: "sy-workbook",
        entityId: FT_BASIC_EVENT_ID,
      },
      bayesianNetworkNode: {
        referenceType: "BAYESIAN_NETWORK_NODE" as const,
        workbookId: "esq-workbook",
        modelId: BN_MODEL_ID,
        entityId: BN_NODE_ID,
      },
      trueStateIds: [BN_TRUE_STATE_ID] as [string, ...string[]],
    },
  ],
  baseEvidence: { observations: [] },
  solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
};

describe("ESQ workbook model ownership", () => {
  it("accepts strict workbook-owned BN and typed HCL records", () => {
    expect(EsqBayesianNetworkSchema.parse(bayesianNetwork)).toEqual(bayesianNetwork);
    expect(EsqHclConfigurationSchema.parse(hclConfiguration)).toEqual(hclConfiguration);
  });

  it("rejects standalone project-model persistence metadata", () => {
    expect(
      EsqBayesianNetworkSchema.safeParse({
        ...bayesianNetwork,
        projectId: "project-1",
        methodType: "BAYESIAN_NETWORK",
        revision: 1,
      }).success,
    ).toBe(false);
    expect(
      EsqHclConfigurationSchema.safeParse({
        ...hclConfiguration,
        projectId: "project-1",
        methodType: "HYBRID_CAUSAL_LOGIC",
      }).success,
    ).toBe(false);
  });

  it("rejects legacy unqualified HCL entity references", () => {
    const legacyBinding = {
      ...hclConfiguration,
      bindings: [
        {
          ...hclConfiguration.bindings[0],
          faultTreeBasicEvent: { modelId: FT_MODEL_ID, entityId: FT_BASIC_EVENT_ID },
          bayesianNetworkNode: { modelId: BN_MODEL_ID, entityId: BN_NODE_ID },
        },
      ],
    };

    expect(EsqHclConfigurationSchema.safeParse(legacyBinding).success).toBe(false);
  });

  it("rejects bindings whose typed targets do not match the declared models", () => {
    const mismatchedBinding = {
      ...hclConfiguration,
      bindings: [
        {
          ...hclConfiguration.bindings[0],
          bayesianNetworkNode: {
            ...hclConfiguration.bindings[0].bayesianNetworkNode,
            workbookId: "another-esq-workbook",
          },
        },
      ],
    };

    expect(EsqHclConfigurationSchema.safeParse(mismatchedBinding).success).toBe(false);
  });
});
