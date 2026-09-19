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

const BN_WORKBOOK_ID = "esq-workbook";
const FT_WORKBOOK_ID = "sy-workbook";
const HCL_WORKBOOK_ID = "esq-workbook";
const owner = { workbookId: HCL_WORKBOOK_ID, workbookRevision: 1, modelId: HCL_ID } as const;
const layout = {
  viewport: { x: 0, y: 0, zoom: 1 },
  mode: "MANUAL",
  direction: "TOP_TO_BOTTOM",
};

const bayesianNetwork = BayesianNetworkModelSchema.parse({
  modelId: BN_ID,
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
  modelId: FT_ID,
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
  modelId: HCL_ID,
  code: "HCL-001",
  name: "Pump dependency mapping",
  description: "",
  bayesianNetwork: { workbookId: BN_WORKBOOK_ID, modelId: BN_ID },
  faultTrees: [{ workbookId: FT_WORKBOOK_ID, modelId: FT_ID }],
  bindings: [
    {
      id: BINDING_ID,
      faultTreeBasicEvent: {
        referenceType: "FAULT_TREE_BASIC_EVENT",
        workbookId: FT_WORKBOOK_ID,
        entityId: BASIC_EVENT_ID,
      },
      bayesianNetworkNode: {
        referenceType: "BAYESIAN_NETWORK_NODE",
        workbookId: BN_WORKBOOK_ID,
        modelId: BN_ID,
        entityId: NODE_ID,
      },
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
  it.each([
    [{ family: "BETA", alpha: 2, beta: 8, trueStateId: TRUE_STATE_ID }, true],
    [{ family: "BETA", alpha: 2, beta: 8, trueStateId: BASIC_EVENT_ID }, false],
    [{ family: "DIRICHLET", alpha: [8, 2] }, true],
    [{ family: "DIRICHLET", alpha: [8, 1, 1] }, false],
  ])("checks the CPT prior against the referenced BN states: %j", (prior, valid) => {
    const model = HclConfigurationModelSchema.parse({ ...configuration, solverSettings: {
      ...configuration.solverSettings,
      uncertainty: { sampleCount: 513, seed: 42, sampler: "LHS", basicEventDistributions: [], cptRowDistributions: [{
        bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: BN_WORKBOOK_ID, modelId: BN_ID, entityId: NODE_ID },
        cptRowId: bayesianNetwork.conditionalProbabilityTables[0]!.rows[0]!.id, prior,
      }] },
    } });
    const issues = validateHclConfigurationModel(model, { bayesianNetworks: [{ workbookId: BN_WORKBOOK_ID, model: bayesianNetwork }], faultTrees: [{ workbookId: FT_WORKBOOK_ID, model: faultTree }] });
    expect(issues.some((issue) => issue.code === "HCL_CPT_PRIOR_INVALID")).toBe(!valid);
  });
  it("accepts resolved BN, FT, bound event, node, and true-state references", () => {
    expect(
      validateHclConfigurationModel(configuration, {
        bayesianNetworks: [{ workbookId: BN_WORKBOOK_ID, model: bayesianNetwork }],
        faultTrees: [{ workbookId: FT_WORKBOOK_ID, model: faultTree }],
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
            ...configuration.bindings[0].faultTreeBasicEvent,
            entityId: "123e4567-e89b-42d3-a456-426614174799",
          },
          trueStateIds: [FALSE_STATE_ID, TRUE_STATE_ID],
        },
      ],
    });
    expect(
      validateHclConfigurationModel(invalid, {
        bayesianNetworks: [{ workbookId: BN_WORKBOOK_ID, model: bayesianNetwork }],
        faultTrees: [{ workbookId: FT_WORKBOOK_ID, model: faultTree }],
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
    const draft = validateHclDraft(configuration, owner, "2026-08-20T21:00:00.000Z", context);
    const analysis = validateHclAnalysisReady(
      configuration,
      owner,
      "2026-08-20T21:00:00.000Z",
      context,
    );

    expect(draft.validation.valid).toBe(false);
    expect(draft.saveAllowed).toBe(true);
    expect(analysis.validation.valid).toBe(false);
    expect(analysis.quantificationAllowed).toBe(false);
  });
});


describe("seismic generators resolve against the BN", () => {
  it.each([FALSE_STATE_ID, GATE_ID])("checks PGA-bin state coverage: %s", (noneStateId) => {
    const model = HclConfigurationModelSchema.parse({ ...configuration, solverSettings: { ...configuration.solverSettings,
      uncertainty: { sampleCount: 100, seed: 42, basicEventDistributions: [], cptRowDistributions: [], cptGenerators: [{
        bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: BN_WORKBOOK_ID, modelId: BN_ID, entityId: NODE_ID },
        generator: { type: "seismic_pga_bins", noneStateId, missionTime: 1, frequencyToProbability: "poisson", bins: [{ stateId: TRUE_STATE_ID, medianFrequency: .01, errorFactor95: 2 }] },
      }] },
    } });
    const issues = validateHclConfigurationModel(model, { bayesianNetworks: [{ workbookId: BN_WORKBOOK_ID, model: bayesianNetwork }], faultTrees: [{ workbookId: FT_WORKBOOK_ID, model: faultTree }] });
    expect(issues.some((i) => i.code === "HCL_CPT_GENERATOR_INVALID")).toBe(noneStateId !== FALSE_STATE_ID);
  });
  it("rejects fragility whose PGA node is not a parent", () => {
    const model = HclConfigurationModelSchema.parse({ ...configuration, solverSettings: { ...configuration.solverSettings,
      uncertainty: { sampleCount: 100, seed: 42, basicEventDistributions: [], cptRowDistributions: [], cptGenerators: [{
        bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: BN_WORKBOOK_ID, modelId: BN_ID, entityId: NODE_ID },
        generator: { type: "seismic_fragility", pgaParentId: NODE_ID, theta: .5, betaR: .3, betaU: 0, trueStateId: TRUE_STATE_ID, falseStateId: FALSE_STATE_ID, pgaCenters: [{ stateId: TRUE_STATE_ID, value: .5 }, { stateId: FALSE_STATE_ID, value: 0 }] },
      }] },
    } });
    const issues = validateHclConfigurationModel(model, { bayesianNetworks: [{ workbookId: BN_WORKBOOK_ID, model: bayesianNetwork }] });
    expect(issues.some((i) => i.code === "HCL_CPT_GENERATOR_INVALID")).toBe(true);
  });
});
