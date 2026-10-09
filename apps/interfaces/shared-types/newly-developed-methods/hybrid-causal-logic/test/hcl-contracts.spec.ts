import {
  HclBaseEvidenceSchema,
  HclBayesianNetworkReferenceSchema,
  HclConfigurationModelSchema,
  HclEventBindingSchema,
  HclEvidenceScenarioSchema,
  HclEventTreeBatchExecuteRequestSchema,
  HclEventTreeExecuteRequestSchema,
  HclFaultTreeBatchExecuteRequestSchema,
  HclFaultTreeReferenceSchema,
  HclHazardConvolutionResultSchema,
  HclHazardGridDefinitionSchema,
  HclQuantificationResultSchema,
  HclSolverSettingsSchema,
  HclValidationResultSchema,
} from "..";
import { HclCptGeneratorSchema, HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling";
import { UncertainVectorSchema } from "interfaces-mef-types/zod/core/uncertainty";

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
const BN_WORKBOOK_ID = "esq-workbook";
const FT_WORKBOOK_ID = "sy-workbook";
const OTHER_FT_WORKBOOK_ID = "other-sy-workbook";
const EVENT_TREE_MODEL_ID = "123e4567-e89b-42d3-a456-426614174713";
const SCENARIO_ID = "123e4567-e89b-42d3-a456-426614174714";
const OTHER_SCENARIO_ID = "123e4567-e89b-42d3-a456-426614174715";

describe("CPT row vectors and shared sampling", () => {
  const base = { sampleCount: 513, seed: 42, sampler: "MC", basicEvents: [], cptRows: [], cptGenerators: [] };
  it.each([
    { node: "VALUE", law: { family: "DIRICHLET", concentrations: [8, 1, 1] } },
    { node: "VALUE", law: { family: "DIRICHLET", concentrations: [0, 2, 0] } },
    { node: "VALUE", law: { family: "DIRICHLET", concentrations: [1e-104, 2e-104] } },
    { node: "VALUE", law: { family: "FIXED", values: [0.2, 0.8] } },
    { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook", entityId: "CPT-ROW-1" } },
  ])("accepts row vector %j", (row) => expect(UncertainVectorSchema.safeParse(row).success).toBe(true));
  it.each([
    { node: "VALUE", law: { family: "DIRICHLET", concentrations: [] } },
    { node: "VALUE", law: { family: "DIRICHLET", concentrations: [0, 0] } },
    { node: "VALUE", law: { family: "DIRICHLET", concentrations: [-1, 2] } },
    { node: "VALUE", law: { family: "DIRICHLET", concentrations: [Infinity, 2] } },
    { node: "VALUE", law: { family: "DIRICHLET", concentrations: [1, 2], equivalentSampleSize: 20 } },
    { node: "VALUE", law: { family: "FIXED", values: [0.2, 0.7] } },
  ])("rejects invalid row vector %j", (row) => expect(UncertainVectorSchema.safeParse(row).success).toBe(false));
  it.each(["MC", "LHS"])("accepts the %s sampler", (sampler) => {
    expect(HclUncertaintySettingsSchema.parse({ ...base, sampler })).toEqual({ ...base, sampler });
  });
  it.each([
    { sampler: undefined },
    { basicEventSampler: "LHS" },
    { cptProbabilityClipEpsilon: 0.01 },
    { basicEventDistributions: [] },
    { cptRowDistributions: [] },
  ])("rejects removed or missing settings %j", (change) => {
    expect(HclUncertaintySettingsSchema.safeParse({ ...base, ...change }).success).toBe(false);
  });
});

describe("HCL model-reference contracts", () => {
  it("accepts a workbook-qualified Bayesian-network reference", () => {
    expect(HclBayesianNetworkReferenceSchema.safeParse({ workbookId: BN_WORKBOOK_ID, modelId: BN_MODEL_ID }).success).toBe(true);
  });

  it("accepts independent workbook-qualified references for multiple fault trees", () => {
    expect(HclFaultTreeReferenceSchema.safeParse({ workbookId: FT_WORKBOOK_ID, modelId: FT_MODEL_ID }).success).toBe(true);
    expect(HclFaultTreeReferenceSchema.safeParse({ workbookId: OTHER_FT_WORKBOOK_ID, modelId: OTHER_FT_MODEL_ID }).success).toBe(true);
  });

  it.each([
    { workbookId: BN_WORKBOOK_ID, modelId: "BN-MHTGR" },
    { modelId: BN_MODEL_ID },
    { workbookId: BN_WORKBOOK_ID, modelId: BN_MODEL_ID, name: "MHTGR causal network" },
    { modelId: BN_MODEL_ID },
  ])("rejects malformed BN reference %#", (candidate) => {
    expect(HclBayesianNetworkReferenceSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { workbookId: FT_WORKBOOK_ID, modelId: "FT-RT" },
    { modelId: FT_MODEL_ID },
    { workbookId: FT_WORKBOOK_ID, modelId: FT_MODEL_ID, code: "FT-RT" },
    { faultTreeId: FT_MODEL_ID },
  ])("rejects malformed FT reference %#", (candidate) => {
    expect(HclFaultTreeReferenceSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("HCL integration-workbook event-tree execution", () => {
  it("accepts a revisioned HCL owner and typed ES event-tree address", () => {
    expect(
      HclEventTreeExecuteRequestSchema.safeParse({
        schemaVersion: "1.0.0",
        modelId: CONFIGURATION_ID,
        workbookRevision: 3,
        eventTree: { workbookId: "es-workbook", modelId: EVENT_TREE_MODEL_ID },
      }).success,
    ).toBe(true);
  });

  it.each([
    { schemaVersion: "1.0.0", modelId: CONFIGURATION_ID, workbookRevision: 3 },
    {
      schemaVersion: "1.0.0",
      modelId: CONFIGURATION_ID,
      workbookRevision: 0,
      eventTree: { workbookId: "es-workbook", modelId: EVENT_TREE_MODEL_ID },
    },
    {
      schemaVersion: "1.0.0",
      modelId: CONFIGURATION_ID,
      workbookRevision: 3,
      eventTree: { workbookId: "es-workbook", modelId: "ET-1" },
    },
  ])("rejects malformed integration ET request %#", (candidate) => {
    expect(HclEventTreeExecuteRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("HCL evidence-scenario batches", () => {
  const scenario = {
    id: SCENARIO_ID,
    code: "HIGH-PGA",
    name: "High seismic demand",
    enabled: true,
    evidence: { observations: [{ nodeId: BN_NODE_ID, stateId: TRUE_STATE_ID }] },
  };

  it("accepts a named scenario with a complete evidence assignment", () => {
    expect(HclEvidenceScenarioSchema.safeParse(scenario).success).toBe(true);
  });

  it("accepts unique scenario sets for fault-tree and event-tree batch requests", () => {
    expect(HclFaultTreeBatchExecuteRequestSchema.safeParse({
      schemaVersion: "1.0.0",
      modelId: CONFIGURATION_ID,
      workbookRevision: 3,
      faultTreeTopGate: {
        referenceType: "FAULT_TREE_TOP_EVENT",
        workbookId: FT_WORKBOOK_ID,
        modelId: FT_MODEL_ID,
        entityId: TOP_GATE_ID,
      },
      evidenceScenarioIds: [SCENARIO_ID, OTHER_SCENARIO_ID],
      integrateHazardGrid: true,
    }).success).toBe(true);
    expect(HclEventTreeBatchExecuteRequestSchema.safeParse({
      schemaVersion: "1.0.0",
      modelId: CONFIGURATION_ID,
      workbookRevision: 3,
      eventTree: { workbookId: "es-workbook", modelId: EVENT_TREE_MODEL_ID },
      evidenceScenarioIds: [SCENARIO_ID],
    }).success).toBe(true);
  });

  it("accepts a typed hazard grid and its auditable fault-tree integration result", () => {
    const annualFrequencyScale = {
      value: 2e-4,
      unit: "PER_YEAR",
      annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_766 },
    };
    expect(HclHazardGridDefinitionSchema.safeParse({
      name: "Seismic demand grid",
      hazardNodeIds: [BN_NODE_ID],
      annualFrequencyScale,
      normalizeWeights: false,
    }).success).toBe(true);
    expect(HclHazardConvolutionResultSchema.safeParse({
      targetKind: "FAULT_TREE",
      gridName: "Seismic demand grid",
      annualFrequencyScale,
      annualizedFrequencyScale: 2e-4,
      normalizeWeights: false,
      rawWeightSum: 1,
      convolutionWeightSum: 1,
      rows: [{
        scenarioId: SCENARIO_ID,
        status: "ok",
        rawWeight: 0.2,
        normalizedWeight: 0.2,
        convolutionWeight: 0.2,
        annualFrequency: 4e-5,
        conditionalProbability: 0.5,
        probabilityContribution: 0.1,
        annualContribution: 2e-5,
      }],
      convolvedProbability: 0.1,
      integratedAnnualFrequency: 2e-5,
    }).success).toBe(true);
  });

  it("represents skipped hazard scenarios without invented conditional probabilities", () => {
    const row = {
      scenarioId: SCENARIO_ID, status: "skipped_zero_weight",
      rawWeight: 0, normalizedWeight: 0, convolutionWeight: 0, annualFrequency: 0,
      conditionalProbability: null, probabilityContribution: 0, annualContribution: 0,
    };
    const result = {
      targetKind: "FAULT_TREE", gridName: "Zero-mass grid",
      annualFrequencyScale: { value: 1, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8766 } },
      annualizedFrequencyScale: 1, normalizeWeights: true,
      rawWeightSum: 0, convolutionWeightSum: 0, rows: [row],
      convolvedProbability: 0, integratedAnnualFrequency: 0,
    };
    expect(HclHazardConvolutionResultSchema.safeParse(result).success).toBe(true);
    for (const change of [
      { conditionalProbability: 0 }, { rawWeight: 0.1 }, { annualContribution: 1 },
      { probabilityContribution: 0.1 }, { status: "ok" },
    ]) {
      expect(HclHazardConvolutionResultSchema.safeParse({ ...result, rows: [{ ...row, ...change }] }).success).toBe(false);
    }
  });

  it("rejects empty or duplicate scenario selections", () => {
    const request = {
      schemaVersion: "1.0.0",
      modelId: CONFIGURATION_ID,
      workbookRevision: 3,
      eventTree: { workbookId: "es-workbook", modelId: EVENT_TREE_MODEL_ID },
    };
    expect(HclEventTreeBatchExecuteRequestSchema.safeParse({ ...request, evidenceScenarioIds: [] }).success).toBe(false);
    expect(HclEventTreeBatchExecuteRequestSchema.safeParse({
      ...request,
      evidenceScenarioIds: [SCENARIO_ID, SCENARIO_ID],
    }).success).toBe(false);
  });
});

describe("HCL event binding identity", () => {
  const binding = {
    id: BINDING_ID,
    faultTreeBasicEvent: {
      referenceType: "FAULT_TREE_BASIC_EVENT",
      workbookId: FT_WORKBOOK_ID,
      entityId: BASIC_EVENT_ID,
    },
    bayesianNetworkNode: {
      referenceType: "BAYESIAN_NETWORK_NODE",
      workbookId: BN_WORKBOOK_ID,
      modelId: BN_MODEL_ID,
      entityId: BN_NODE_ID,
    },
    trueStateIds: [TRUE_STATE_ID],
  };

  it("binds one FT basic event to one BN node using stable entity references", () => {
    expect(HclEventBindingSchema.safeParse(binding).success).toBe(true);
  });

  it.each([
    { ...binding, id: "BINDING-1" },
    { ...binding, faultTreeBasicEvent: { ...binding.faultTreeBasicEvent, workbookId: "" } },
    { ...binding, faultTreeBasicEvent: { ...binding.faultTreeBasicEvent, entityId: "BE-PUMP" } },
    { ...binding, bayesianNetworkNode: { ...binding.bayesianNetworkNode, modelId: "BN-MHTGR" } },
    { ...binding, bayesianNetworkNode: { ...binding.bayesianNetworkNode, entityId: "N-PUMP" } },
    {
      ...binding,
      faultTreeBasicEvent: { ...binding.faultTreeBasicEvent, basicEventCode: "BE-PUMP" },
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
    expect(HclSolverSettingsSchema.safeParse({
      ...defaults,
      uncertainty: {
        sampleCount: 1000,
        seed: 2026,
        sampler: "MC",
        basicEvents: [{
          faultTreeBasicEvent: {
            referenceType: "FAULT_TREE_BASIC_EVENT",
            workbookId: FT_WORKBOOK_ID,
            entityId: BASIC_EVENT_ID,
          },
          expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "BETA", alpha: 2, beta: 18, lower: 0, upper: 1 } } },
        }],
        cptRows: [{
          bayesianNetworkNode: {
            referenceType: "BAYESIAN_NETWORK_NODE",
            workbookId: BN_WORKBOOK_ID,
            modelId: BN_MODEL_ID,
            entityId: BN_NODE_ID,
          },
          cptRowId: "123e4567-e89b-42d3-a456-426614174799",
          row: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [80, 20] } },
        }],
        cptGenerators: [],
      },
    }).success).toBe(true);
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
    owner: { workbookId: "esq-workbook", workbookRevision: 3, modelId: CONFIGURATION_ID },
    mode: "ANALYSIS_READY",
    valid: true,
    issues: [],
    validatedAt: "2026-08-20T15:30:00.000Z",
  };

  const quantification = {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    owner: { workbookId: "esq-workbook", workbookRevision: 3, modelId: CONFIGURATION_ID },
    faultTreeTopGate: {
      referenceType: "FAULT_TREE_TOP_EVENT",
      workbookId: FT_WORKBOOK_ID,
      modelId: FT_MODEL_ID,
      entityId: TOP_GATE_ID,
    },
    probability: 0.015,
    uncertainty: {
      sampleCount: 1000,
      seed: 2026,
      mean: 0.015,
      standardDeviation: 0.002,
      minimum: 0.009,
      percentile05: 0.012,
      median: 0.0148,
      percentile95: 0.019,
      maximum: 0.023,
    },
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

  it("rejects the removed HCL coefficient of variation", () => {
    expect(
      HclQuantificationResultSchema.safeParse({
        ...quantification,
        uncertainty: { ...quantification.uncertainty, coefficientOfVariation: 0.1333 },
      }).success,
    ).toBe(false);
  });

  it.each([
    { ...quantification, probability: -0.01 },
    { ...quantification, probability: 1.01 },
    { ...quantification, bddNodes: -1 },
    { ...quantification, bddVariables: 1 },
    { ...quantification, variableOrder: [BASIC_EVENT_ID, BASIC_EVENT_ID] },
    { ...quantification, bridge: { ...quantification.bridge, quantifications: 1.5 } },
    { ...quantification, junctionTree: { ...quantification.junctionTree, treewidth: -1 } },
    { ...quantification, cutSets: { totalCount: 0, cutSets: [] } },
    { ...quantification, importance: { totalCount: 0, measures: [] } },
    { ...quantification, completedAt: "yesterday" },
    { ...quantification, unsupportedMetric: 1 },
  ])("rejects malformed or unsupported quantification output %#", (candidate) => {
    expect(HclQuantificationResultSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("independent HCL mapping model", () => {
  const metadata = {
    modelId: CONFIGURATION_ID,
    code: "HCL-MHTGR",
    name: "MHTGR HCL mapping",
    description: "Reusable BN-to-FT event bindings.",
  };
  const solverSettings = {
    variableOrder: null,
    foldConstants: false,
    spliceNullGates: false,
  };
  const binding = {
    id: BINDING_ID,
    faultTreeBasicEvent: {
      referenceType: "FAULT_TREE_BASIC_EVENT",
      workbookId: FT_WORKBOOK_ID,
      entityId: BASIC_EVENT_ID,
    },
    bayesianNetworkNode: {
      referenceType: "BAYESIAN_NETWORK_NODE",
      workbookId: BN_WORKBOOK_ID,
      modelId: BN_MODEL_ID,
      entityId: BN_NODE_ID,
    },
    trueStateIds: [TRUE_STATE_ID],
  };
  const configuration = {
    ...metadata,
    bayesianNetwork: { workbookId: BN_WORKBOOK_ID, modelId: BN_MODEL_ID },
    faultTrees: [
      { workbookId: FT_WORKBOOK_ID, modelId: FT_MODEL_ID },
      { workbookId: OTHER_FT_WORKBOOK_ID, modelId: OTHER_FT_MODEL_ID },
    ],
    bindings: [
      binding,
      {
        ...binding,
        id: "123e4567-e89b-42d3-a456-426614174713",
        faultTreeBasicEvent: {
          referenceType: "FAULT_TREE_BASIC_EVENT",
          workbookId: OTHER_FT_WORKBOOK_ID,
          entityId: OTHER_BASIC_EVENT_ID,
        },
      },
    ],
    baseEvidence: { observations: [] },
    evidenceScenarios: [{
      id: SCENARIO_ID,
      code: "HIGH-PGA",
      name: "High seismic demand",
      enabled: true,
      evidence: { observations: [{ nodeId: BN_NODE_ID, stateId: TRUE_STATE_ID }] },
    }],
    solverSettings,
  };

  it("keeps one BN-to-multiple-FT mapping in its own versioned model", () => {
    expect(HclConfigurationModelSchema.safeParse(configuration).success).toBe(true);
  });

  it("requires every enabled grid row to assign every configured hazard node", () => {
    const hazardGrid = {
      name: "Seismic grid",
      hazardNodeIds: [BN_NODE_ID],
      annualFrequencyScale: {
        value: 1e-4,
        unit: "PER_YEAR",
        annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_766 },
      },
      normalizeWeights: false,
    };
    expect(HclConfigurationModelSchema.safeParse({ ...configuration, hazardGrid }).success).toBe(true);
    expect(HclConfigurationModelSchema.safeParse({
      ...configuration,
      hazardGrid,
      evidenceScenarios: [{
        ...configuration.evidenceScenarios[0],
        evidence: { observations: [] },
      }],
    }).success).toBe(false);
    expect(HclConfigurationModelSchema.safeParse({
      ...configuration,
      hazardGrid,
      evidenceScenarios: [{ ...configuration.evidenceScenarios[0], enabled: false }],
    }).success).toBe(false);
    expect(HclConfigurationModelSchema.safeParse({
      ...configuration,
      hazardGrid,
      evidenceScenarios: [
        configuration.evidenceScenarios[0],
        {
          ...configuration.evidenceScenarios[0],
          id: OTHER_SCENARIO_ID,
          code: "HIGH-PGA-DUPLICATE",
        },
      ],
    }).success).toBe(false);
  });

  it("allows the same BN reference to be reused by independent HCL configurations", () => {
    const otherConfiguration = {
      ...configuration,
      modelId: OTHER_CONFIGURATION_ID,
      code: "HCL-MHTGR-OTHER",
      faultTrees: [{ workbookId: OTHER_FT_WORKBOOK_ID, modelId: OTHER_FT_MODEL_ID }],
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

  it("rejects duplicate evidence-scenario ids or codes", () => {
    const scenario = configuration.evidenceScenarios[0];
    expect(HclConfigurationModelSchema.safeParse({
      ...configuration,
      evidenceScenarios: [scenario, { ...scenario, id: OTHER_SCENARIO_ID }],
    }).success).toBe(false);
    expect(HclConfigurationModelSchema.safeParse({
      ...configuration,
      evidenceScenarios: [scenario, { ...scenario, code: "OTHER", name: "Other" }],
    }).success).toBe(false);
  });

  it.each([
    { ...configuration, methodType: "HYBRID_CAUSAL_LOGIC" },
    { ...configuration, faultTrees: [configuration.faultTrees[0], configuration.faultTrees[0]] },
    { ...configuration, bindings: [binding, binding] },
    {
      ...configuration,
      bindings: [
        {
          ...binding,
          faultTreeBasicEvent: {
            ...binding.faultTreeBasicEvent,
            workbookId: "undeclared-sy-workbook",
          },
        },
      ],
    },
    {
      ...configuration,
      bindings: [
        {
          ...binding,
          bayesianNetworkNode: {
            ...binding.bayesianNetworkNode,
            modelId: "123e4567-e89b-42d3-a456-426614174715",
          },
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


describe("HCL fault-tree law and sampler contracts", () => {
  const laws = [
    { family: "BETA", alpha: 2, beta: 8, lower: 0, upper: 1 },
    { family: "UNIFORM", lower: 0, upper: 1 },
    { family: "LOGNORMAL", mean: 0.2, errorFactor: 8, level: 0.95 },
    { family: "LOGIT_NORMAL", mu: -2, sigma: 0.5 },
    { family: "TRIANGULAR", lower: 0, mode: 0.2, upper: 1 },
    { family: "POINT", value: 0.2 },
  ];
  const settings = (law: object, sampler: string) => ({
    foldConstants: false, spliceNullGates: false,
    uncertainty: { sampleCount: 513, seed: 42, sampler,
      basicEvents: [{
        faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: FT_WORKBOOK_ID, entityId: BASIC_EVENT_ID },
        expression: { node: "VALUE", value: { unit: "PROBABILITY", law } },
      }], cptRows: [], cptGenerators: [],
    },
  });
  it.each(laws.flatMap((law) => ["MC", "LHS"].map((sampler) => [law, sampler] as const)))(
    "accepts basic-event law %j with %s", (law, sampler) => {
      const candidate = settings(law, sampler);
      expect(HclSolverSettingsSchema.parse(candidate)).toMatchObject(candidate);
    },
  );
  it("accepts a basic event that links a DA parameter", () => {
    const candidate = settings(laws[0]!, "MC");
    const linked = {
      ...candidate,
      uncertainty: {
        ...candidate.uncertainty,
        basicEvents: candidate.uncertainty.basicEvents.map((entry) => ({
          ...entry,
          expression: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook", entityId: "DA-1" } },
        })),
      },
    };
    expect(HclSolverSettingsSchema.safeParse(linked).success).toBe(true);
  });
  it("rejects two overrides of one basic event", () => {
    const candidate = settings(laws[0]!, "MC");
    candidate.uncertainty.basicEvents = [candidate.uncertainty.basicEvents[0]!, candidate.uncertainty.basicEvents[0]!];
    expect(HclSolverSettingsSchema.safeParse(candidate).success).toBe(false);
  });
  it.each([
    { family: "BETA", alpha: 2, beta: 8 },
    { family: "LOGNORMAL", median: 0.2, errorFactor: 8 },
    { family: "LOGITNORMAL", mu: -2, sigma: 0.5 },
    { family: "GAMMA", shape: 2, scale: 0.2 },
  ])("rejects a law outside the contract %j", (law) => {
    expect(HclSolverSettingsSchema.safeParse(settings(law, "LHS")).success).toBe(false);
  });
  it.each(["lhs", "APPROXIMATE", ""])("rejects unsupported sampler %s", (sampler) => {
    expect(HclSolverSettingsSchema.safeParse(settings(laws[0]!, sampler)).success).toBe(false);
  });
});


describe("source seismic generator contracts", () => {
  const quantity = (law: object) => ({ node: "VALUE", value: { unit: "QUANTITY", law } });
  const fragility = {
    kind: "SEISMIC_FRAGILITY", pgaParentId: BN_NODE_ID, trueStateId: TRUE_STATE_ID, falseStateId: OTHER_TRUE_STATE_ID,
    median: quantity({ family: "LOGNORMAL", mean: .51, errorFactor: 1.39, level: .95 }), randomness: quantity({ family: "POINT", value: .3 }),
    demands: [{ stateId: TRUE_STATE_ID, demand: .5 }, { stateId: OTHER_TRUE_STATE_ID, demand: 0 }],
  };
  const bins = {
    kind: "SEISMIC_PGA_BINS", noneStateId: OTHER_TRUE_STATE_ID, missionTime: { node: "VALUE", value: { unit: "YEARS", law: { family: "POINT", value: 1 } } }, conversion: "POISSON",
    bins: [{ stateId: TRUE_STATE_ID, frequency: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: .0107, errorFactor: 2, level: .95 } } } }],
  };
  const reference = { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: BN_WORKBOOK_ID, modelId: BN_MODEL_ID, entityId: BN_NODE_ID };
  it.each([fragility, bins, { ...bins, conversion: "LINEAR" }])("accepts the generator: %j", (g) => expect(HclCptGeneratorSchema.safeParse(g).success).toBe(true));
  it.each([
    { ...fragility, trueStateId: OTHER_TRUE_STATE_ID }, { ...fragility, demands: [] },
    { ...fragility, demands: [fragility.demands[0], fragility.demands[0]] },
    { ...fragility, demands: [{ stateId: TRUE_STATE_ID, demand: -1 }] },
    { ...fragility, theta: .5 }, { ...fragility, median: .5 },
    { ...bins, missionTime: 1 }, { ...bins, conversion: "CAPPED_LINEAR" },
    { ...bins, bins: [{ ...bins.bins[0], stateId: OTHER_TRUE_STATE_ID }] },
    { ...bins, bins: [bins.bins[0], bins.bins[0]] }, { ...bins, renormalize: true },
  ])("rejects invalid or invented generator options: %j", (g) => expect(HclCptGeneratorSchema.safeParse(g).success).toBe(false));
  it("rejects generators sharing a node with another generator or row priors", () => {
    const g = { bayesianNetworkNode: reference, generator: bins };
    const base = { sampleCount: 513, seed: 42, sampler: "MC", basicEvents: [], cptRows: [], cptGenerators: [g] };
    expect(HclUncertaintySettingsSchema.safeParse(base).success).toBe(true);
    expect(HclUncertaintySettingsSchema.safeParse({ ...base, cptGenerators: [g, g] }).success).toBe(false);
    expect(HclUncertaintySettingsSchema.safeParse({ ...base, cptRows: [{ bayesianNetworkNode: reference, cptRowId: RUN_ID, row: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [1, 1] } } }] }).success).toBe(false);
  });
});


describe("point-only hazard convolution", () => {
  const summary = { sampleCount: 10, seed: 42, mean: 0, standardDeviation: 0, minimum: 0, percentile05: 0, median: 0, percentile95: 0, maximum: 0 };
  const common = {
    gridName: "Grid", normalizeWeights: false, rawWeightSum: 1, convolutionWeightSum: 1,
    annualFrequencyScale: { value: 1, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8766 } },
    annualizedFrequencyScale: 1,
  };
  const weight = { scenarioId: SCENARIO_ID, status: "ok", rawWeight: 1, normalizedWeight: 1, convolutionWeight: 1, annualFrequency: 1 };
  it("rejects removed FT hazard uncertainty results", () => {
    const result = { ...common, targetKind: "FAULT_TREE", convolvedProbability: 0, integratedAnnualFrequency: 0,
      rows: [{ ...weight, conditionalProbability: 0, probabilityContribution: 0, annualContribution: 0 }] };
    expect(HclHazardConvolutionResultSchema.safeParse(result).success).toBe(true);
    expect(HclHazardConvolutionResultSchema.safeParse({ ...result, uncertainty: summary }).success).toBe(false);
  });
  it("rejects removed sequence and end-state hazard uncertainty results", () => {
    const sequence = { sequenceId: RUN_ID, convolvedProbability: 0, integratedAnnualFrequency: 0 };
    const endState = { endStateId: RUN_ID, convolvedProbability: 0, integratedAnnualFrequency: 0 };
    const result = { ...common, targetKind: "EVENT_TREE", rows: [{ ...weight, sequences: [] }], sequences: [sequence], endStateAggregates: [endState] };
    expect(HclHazardConvolutionResultSchema.safeParse(result).success).toBe(true);
    expect(HclHazardConvolutionResultSchema.safeParse({ ...result, sequences: [{ ...sequence, uncertainty: summary }] }).success).toBe(false);
    expect(HclHazardConvolutionResultSchema.safeParse({ ...result, endStateAggregates: [{ ...endState, uncertainty: summary }] }).success).toBe(false);
  });

});
