import {
  BayesianNetworkModelSchema,
  FaultTreeModelSchema,
  HclConfigurationModelSchema,
  validateHclAnalysisReady,
  validateHclConfigurationModel,
  validateHclDraft,
} from "../..";

const BN_ID = "123e4567-e89b-42d3-a456-426614174700";
const FT_ID = "123e4567-e89b-42d3-a456-426614174701";
const HCL_ID = "123e4567-e89b-42d3-a456-426614174702";
const NODE_ID = "123e4567-e89b-42d3-a456-426614174703";
const FALSE_STATE_ID = "123e4567-e89b-42d3-a456-426614174704";
const TRUE_STATE_ID = "123e4567-e89b-42d3-a456-426614174705";
const GATE_ID = "123e4567-e89b-42d3-a456-426614174706";
const LEAF_ID = "123e4567-e89b-42d3-a456-426614174707";
const BASIC_EVENT_ID = "123e4567-e89b-42d3-a456-426614174708";
const BINDING_ID = "123e4567-e89b-42d3-a456-426614174709";

const metadata = {
  schemaVersion: "1.0.0",
  projectId: "project-1",
  revision: 1,
  createdBy: "ada",
  createdAt: "2026-08-20T20:00:00.000Z",
  updatedBy: "ada",
  updatedAt: "2026-08-20T20:00:00.000Z",
};
const layout = {
  viewport: { x: 0, y: 0, zoom: 1 },
  mode: "MANUAL",
  direction: "TOP_TO_BOTTOM",
};

const bayesianNetwork = BayesianNetworkModelSchema.parse({
  ...metadata,
  id: BN_ID,
  methodType: "BAYESIAN_NETWORK",
  code: "BN-001",
  name: "Dependency BN",
  description: "",
  nodes: [
    {
      id: NODE_ID,
      code: "PUMP",
      name: "Pump",
      description: "",
      kind: "CHANCE_NODE",
      states: [
        { id: FALSE_STATE_ID, code: "WORKS", name: "Works" },
        { id: TRUE_STATE_ID, code: "FAILS", name: "Fails" },
      ],
    },
  ],
  edges: [],
  conditionalProbabilityTables: [
    {
      nodeId: NODE_ID,
      parents: [],
      rows: [
        {
          id: "123e4567-e89b-42d3-a456-426614174710",
          parentStates: [],
          values: [
            { stateId: FALSE_STATE_ID, probability: 0.9 },
            { stateId: TRUE_STATE_ID, probability: 0.1 },
          ],
        },
      ],
    },
  ],
  nodePositions: [],
  layout,
});

const faultTree = FaultTreeModelSchema.parse({
  ...metadata,
  id: FT_ID,
  methodType: "FAULT_TREE",
  code: "FT-001",
  name: "Pump failure",
  description: "",
  topGate: { gateId: GATE_ID },
  gates: [
    {
      id: GATE_ID,
      code: "TOP",
      name: "Top gate",
      description: "",
      kind: "GATE",
      gateType: "OR",
    },
  ],
  leafNodes: [
    {
      id: LEAF_ID,
      kind: "BASIC_EVENT_REFERENCE",
      basicEventId: BASIC_EVENT_ID,
    },
  ],
  gateInputs: [
    {
      id: "123e4567-e89b-42d3-a456-426614174711",
      gateId: GATE_ID,
      childId: LEAF_ID,
      order: 0,
    },
  ],
  nodePositions: [],
  layout,
});

const configuration = HclConfigurationModelSchema.parse({
  ...metadata,
  id: HCL_ID,
  methodType: "HYBRID_CAUSAL_LOGIC",
  code: "HCL-001",
  name: "Pump dependency mapping",
  description: "",
  bayesianNetwork: { modelId: BN_ID },
  faultTrees: [{ faultTree: { modelId: FT_ID } }],
  bindings: [
    {
      id: BINDING_ID,
      faultTreeBasicEvent: { modelId: FT_ID, entityId: BASIC_EVENT_ID },
      bayesianNetworkNode: { modelId: BN_ID, entityId: NODE_ID },
      trueStateIds: [TRUE_STATE_ID],
    },
  ],
  baseEvidence: { observations: [] },
  solverSettings: {
    variableOrder: null,
    foldConstants: false,
    spliceNullGates: false,
  },
});

describe("HCL semantic validation", () => {
  it("accepts resolved BN, FT, bound event, node, and true-state references", () => {
    expect(
      validateHclConfigurationModel(configuration, {
        bayesianNetworks: [bayesianNetwork],
        faultTrees: [faultTree],
      }),
    ).toEqual([]);
  });

  it("reports missing model references and requires at least one fault tree", () => {
    const withoutFaultTrees = HclConfigurationModelSchema.parse({
      ...configuration,
      faultTrees: [],
      bindings: [],
    });
    expect(
      validateHclConfigurationModel(withoutFaultTrees, {
        bayesianNetworks: [],
        faultTrees: [],
      }).map((issue) => issue.code),
    ).toEqual(["HCL_BAYESIAN_NETWORK_NOT_FOUND", "HCL_FAULT_TREE_REQUIRED"]);
  });

  it("reports unresolved FT basic events and reuses BN true-state validation", () => {
    const invalid = HclConfigurationModelSchema.parse({
      ...configuration,
      bindings: [
        {
          ...configuration.bindings[0],
          faultTreeBasicEvent: {
            modelId: FT_ID,
            entityId: "123e4567-e89b-42d3-a456-426614174799",
          },
          trueStateIds: [FALSE_STATE_ID, TRUE_STATE_ID],
        },
      ],
    });
    expect(
      validateHclConfigurationModel(invalid, {
        bayesianNetworks: [bayesianNetwork],
        faultTrees: [faultTree],
      }).map((issue) => issue.code),
    ).toEqual(
      expect.arrayContaining([
        "BN_HCL_TRUE_STATES_CANNOT_INCLUDE_ALL",
        "HCL_FAULT_TREE_BASIC_EVENT_NOT_FOUND",
      ]),
    );
  });

  it("keeps invalid drafts saveable but blocks the same analysis-ready model", () => {
    const context = { bayesianNetworks: [], faultTrees: [] };
    const draft = validateHclDraft(configuration, "2026-08-20T21:00:00.000Z", context);
    const analysis = validateHclAnalysisReady(
      configuration,
      "2026-08-20T21:00:00.000Z",
      context,
    );

    expect(draft.validation.valid).toBe(false);
    expect(draft.saveAllowed).toBe(true);
    expect(analysis.validation.valid).toBe(false);
    expect(analysis.quantificationAllowed).toBe(false);
  });
});
