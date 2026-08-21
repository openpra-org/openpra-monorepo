import {
  HclBaseEvidenceSchema,
  HclBayesianNetworkReferenceSchema,
  HclConfigurationModelSchema,
  HclEventBindingSchema,
  HclFaultTreeReferenceSchema,
  HclQuantificationResultSchema,
  HclSolverSettingsSchema,
  HclValidationResultSchema,
} from "..";

const BN_MODEL_ID = "123e4567-e89b-42d3-a456-426614174700";
const FT_MODEL_ID = "123e4567-e89b-42d3-a456-426614174701";
const OTHER_FT_MODEL_ID = "123e4567-e89b-42d3-a456-426614174702";
const BINDING_ID = "123e4567-e89b-42d3-a456-426614174703";
const BASIC_EVENT_ID = "123e4567-e89b-42d3-a456-426614174704";
const BN_NODE_ID = "123e4567-e89b-42d3-a456-426614174705";
const TRUE_STATE_ID = "123e4567-e89b-42d3-a456-426614174706";
const OTHER_TRUE_STATE_ID = "123e4567-e89b-42d3-a456-426614174707";
const RUN_ID = "123e4567-e89b-42d3-a456-426614174708";
const TOP_GATE_ID = "123e4567-e89b-42d3-a456-426614174709";
const OTHER_BASIC_EVENT_ID = "123e4567-e89b-42d3-a456-426614174710";
const CONFIGURATION_ID = "123e4567-e89b-42d3-a456-426614174711";
const OTHER_CONFIGURATION_ID = "123e4567-e89b-42d3-a456-426614174712";

describe("HCL model-reference contracts", () => {
  it("accepts a UUID-only Bayesian-network reference", () => {
    expect(HclBayesianNetworkReferenceSchema.safeParse({ bayesianNetwork: { modelId: BN_MODEL_ID } }).success).toBe(
      true,
    );
  });

  it("accepts independent UUID-only references for multiple fault trees", () => {
    expect(HclFaultTreeReferenceSchema.safeParse({ faultTree: { modelId: FT_MODEL_ID } }).success).toBe(true);
    expect(HclFaultTreeReferenceSchema.safeParse({ faultTree: { modelId: OTHER_FT_MODEL_ID } }).success).toBe(true);
  });

  it.each([
    { bayesianNetwork: { modelId: "BN-MHTGR" } },
    { bayesianNetwork: { modelId: BN_MODEL_ID, name: "MHTGR causal network" } },
    { modelId: BN_MODEL_ID },
  ])("rejects malformed BN reference %#", (candidate) => {
    expect(HclBayesianNetworkReferenceSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { faultTree: { modelId: "FT-RT" } },
    { faultTree: { modelId: FT_MODEL_ID, code: "FT-RT" } },
    { faultTreeId: FT_MODEL_ID },
  ])("rejects malformed FT reference %#", (candidate) => {
    expect(HclFaultTreeReferenceSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("HCL event binding identity", () => {
  const binding = {
    id: BINDING_ID,
    faultTreeBasicEvent: { modelId: FT_MODEL_ID, entityId: BASIC_EVENT_ID },
    bayesianNetworkNode: { modelId: BN_MODEL_ID, entityId: BN_NODE_ID },
    trueStateIds: [TRUE_STATE_ID],
  };

  it("binds one FT basic event to one BN node using stable entity references", () => {
    expect(HclEventBindingSchema.safeParse(binding).success).toBe(true);
  });

  it.each([
    { ...binding, id: "BINDING-1" },
    { ...binding, faultTreeBasicEvent: { modelId: "FT-RT", entityId: BASIC_EVENT_ID } },
    { ...binding, faultTreeBasicEvent: { modelId: FT_MODEL_ID, entityId: "BE-PUMP" } },
    { ...binding, bayesianNetworkNode: { modelId: "BN-MHTGR", entityId: BN_NODE_ID } },
    { ...binding, bayesianNetworkNode: { modelId: BN_MODEL_ID, entityId: "N-PUMP" } },
    {
      ...binding,
      faultTreeBasicEvent: { modelId: FT_MODEL_ID, entityId: BASIC_EVENT_ID, basicEventCode: "BE-PUMP" },
    },
  ])("rejects malformed binding fields %#", (candidate) => {
    expect(HclEventBindingSchema.safeParse(candidate).success).toBe(false);
  });

  it("accepts one or more unique BN states as the event-true selection", () => {
    expect(HclEventBindingSchema.safeParse(binding).success).toBe(true);
    expect(HclEventBindingSchema.safeParse({ ...binding, trueStateIds: [TRUE_STATE_ID, OTHER_TRUE_STATE_ID] }).success).toBe(
      true,
    );
  });

  it.each([
    { ...binding, trueStateIds: [] },
    { ...binding, trueStateIds: ["FAILED"] },
    { ...binding, trueStateIds: [TRUE_STATE_ID, TRUE_STATE_ID] },
  ])("rejects malformed true-state selection %#", (candidate) => {
    expect(HclEventBindingSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("HCL base evidence", () => {
  it("accepts empty or observed base evidence", () => {
    expect(HclBaseEvidenceSchema.safeParse({ observations: [] }).success).toBe(true);
    expect(
      HclBaseEvidenceSchema.safeParse({
        observations: [{ nodeId: BN_NODE_ID, stateId: TRUE_STATE_ID }],
      }).success,
    ).toBe(true);
  });

  it.each([
    { observations: [{ nodeId: "N-PUMP", stateId: TRUE_STATE_ID }] },
    { observations: [{ nodeId: BN_NODE_ID, stateId: "FAILED" }] },
    {
      observations: [
        { nodeId: BN_NODE_ID, stateId: TRUE_STATE_ID },
        { nodeId: BN_NODE_ID, stateId: OTHER_TRUE_STATE_ID },
      ],
    },
    { observations: [], evidenceWeight: 1 },
  ])("rejects malformed or conflicting base evidence %#", (candidate) => {
    expect(HclBaseEvidenceSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("PRAXIS HCL solver settings", () => {
  const defaults = {
    variableOrder: null,
    foldConstants: false,
    spliceNullGates: false,
  };

  it("accepts PRAXIS defaults and an explicit stable BDD variable order", () => {
    expect(HclSolverSettingsSchema.safeParse(defaults).success).toBe(true);
    expect(
      HclSolverSettingsSchema.safeParse({
        ...defaults,
        variableOrder: [BASIC_EVENT_ID, "123e4567-e89b-42d3-a456-426614174708"],
        foldConstants: true,
        spliceNullGates: true,
      }).success,
    ).toBe(true);
  });

  it.each([
    { ...defaults, variableOrder: [] },
    { ...defaults, variableOrder: ["BE-PUMP"] },
    { ...defaults, variableOrder: [BASIC_EVENT_ID, BASIC_EVENT_ID] },
    { ...defaults, foldConstants: "true" },
    { ...defaults, spliceNullGates: 1 },
    { ...defaults, backend: "TENSORBAYES" },
    { ...defaults, approximation: "MARGINAL_ONLY" },
    { ...defaults, compileHeuristic: "MIN_FILL" },
    { ...defaults, cacheSize: 10_000 },
  ])("rejects malformed or unsupported solver setting %#", (candidate) => {
    expect(HclSolverSettingsSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("HCL validation and quantification results", () => {
  const validation = {
    schemaVersion: "1.0.0",
    modelId: FT_MODEL_ID,
    revision: 3,
    mode: "ANALYSIS_READY",
    valid: true,
    issues: [],
    validatedAt: "2026-08-20T15:30:00.000Z",
  };

  const quantification = {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    modelId: FT_MODEL_ID,
    modelRevision: 3,
    faultTreeTopGate: { modelId: FT_MODEL_ID, entityId: TOP_GATE_ID },
    probability: 0.015,
    bddNodes: 7,
    bddVariables: 2,
    variableOrder: [BASIC_EVENT_ID, OTHER_BASIC_EVENT_ID],
    bridge: {
      quantifications: 3,
      bddContextCacheHits: 2,
      bddContextCacheMisses: 1,
      bnQueryCacheHits: 4,
      bnQueryCacheMisses: 2,
    },
    junctionTree: {
      numCliques: 2,
      maxCliqueSize: 3,
      treewidth: 2,
      totalTableEntries: 12,
    },
    validationIssues: [],
    completedAt: "2026-08-20T15:31:00.000Z",
  };

  it("accepts a shared validation result envelope", () => {
    expect(HclValidationResultSchema.safeParse({ schemaVersion: "1.0.0", validation }).success).toBe(true);
  });

  it("accepts the current PRAXIS HCL quantification metrics with stable editor ids", () => {
    expect(HclQuantificationResultSchema.safeParse(quantification).success).toBe(true);
  });

  it.each([
    { ...quantification, probability: -0.01 },
    { ...quantification, probability: 1.01 },
    { ...quantification, bddNodes: -1 },
    { ...quantification, bddVariables: 1 },
    { ...quantification, variableOrder: [BASIC_EVENT_ID, BASIC_EVENT_ID] },
    { ...quantification, bridge: { ...quantification.bridge, quantifications: 1.5 } },
    { ...quantification, junctionTree: { ...quantification.junctionTree, treewidth: -1 } },
    { ...quantification, completedAt: "yesterday" },
    { ...quantification, unsupportedMetric: 1 },
  ])("rejects malformed or unsupported quantification output %#", (candidate) => {
    expect(HclQuantificationResultSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("independent HCL mapping model", () => {
  const metadata = {
    schemaVersion: "1.0.0",
    id: CONFIGURATION_ID,
    projectId: "project-mhtgr",
    methodType: "HYBRID_CAUSAL_LOGIC",
    code: "HCL-MHTGR",
    name: "MHTGR HCL mapping",
    description: "Reusable BN-to-FT event bindings.",
    revision: 1,
    createdBy: "analyst@example.com",
    createdAt: "2026-08-20T15:00:00.000Z",
    updatedBy: "analyst@example.com",
    updatedAt: "2026-08-20T15:00:00.000Z",
  };
  const solverSettings = {
    variableOrder: null,
    foldConstants: false,
    spliceNullGates: false,
  };
  const binding = {
    id: BINDING_ID,
    faultTreeBasicEvent: { modelId: FT_MODEL_ID, entityId: BASIC_EVENT_ID },
    bayesianNetworkNode: { modelId: BN_MODEL_ID, entityId: BN_NODE_ID },
    trueStateIds: [TRUE_STATE_ID],
  };
  const configuration = {
    ...metadata,
    bayesianNetwork: { modelId: BN_MODEL_ID },
    faultTrees: [{ faultTree: { modelId: FT_MODEL_ID } }, { faultTree: { modelId: OTHER_FT_MODEL_ID } }],
    bindings: [
      binding,
      {
        ...binding,
        id: "123e4567-e89b-42d3-a456-426614174713",
        faultTreeBasicEvent: { modelId: OTHER_FT_MODEL_ID, entityId: OTHER_BASIC_EVENT_ID },
      },
    ],
    baseEvidence: { observations: [] },
    solverSettings,
  };

  it("keeps one BN-to-multiple-FT mapping in its own versioned model", () => {
    expect(HclConfigurationModelSchema.safeParse(configuration).success).toBe(true);
  });

  it("allows the same BN reference to be reused by independent HCL configurations", () => {
    const otherConfiguration = {
      ...configuration,
      id: OTHER_CONFIGURATION_ID,
      code: "HCL-MHTGR-OTHER",
      faultTrees: [{ faultTree: { modelId: OTHER_FT_MODEL_ID } }],
      bindings: [configuration.bindings[1]],
    };

    expect(HclConfigurationModelSchema.safeParse(configuration).success).toBe(true);
    expect(HclConfigurationModelSchema.safeParse(otherConfiguration).success).toBe(true);
    expect(otherConfiguration.bayesianNetwork).toEqual(configuration.bayesianNetwork);
  });

  it("permits an incomplete draft mapping without coupling it to an ET", () => {
    expect(
      HclConfigurationModelSchema.safeParse({
        ...configuration,
        faultTrees: [],
        bindings: [],
      }).success,
    ).toBe(true);
  });

  it.each([
    { ...configuration, methodType: "FAULT_TREE" },
    { ...configuration, faultTrees: [configuration.faultTrees[0], configuration.faultTrees[0]] },
    { ...configuration, bindings: [binding, binding] },
    {
      ...configuration,
      bindings: [
        {
          ...binding,
          faultTreeBasicEvent: { modelId: "123e4567-e89b-42d3-a456-426614174714", entityId: BASIC_EVENT_ID },
        },
      ],
    },
    {
      ...configuration,
      bindings: [
        {
          ...binding,
          bayesianNetworkNode: { modelId: "123e4567-e89b-42d3-a456-426614174715", entityId: BN_NODE_ID },
        },
      ],
    },
    {
      ...configuration,
      bindings: [
        binding,
        { ...binding, id: "123e4567-e89b-42d3-a456-426614174716" },
      ],
    },
    { ...configuration, eventTrees: [{ modelId: "123e4567-e89b-42d3-a456-426614174717" }] },
  ])("rejects cross-model coupling or inconsistent mapping scope %#", (candidate) => {
    expect(HclConfigurationModelSchema.safeParse(candidate).success).toBe(false);
  });
});
