import type { HclEventBinding, HclEvidenceScenario } from "interfaces-mef-types/modeling";
import {
  resolveHclBatchTargetRelevance,
  type HclBatchFaultTreeTarget,
} from "../hcl-target-relevance";

const WORKBOOK = "11111111-1111-4111-8111-111111111111";
const NETWORK = "22222222-2222-4222-8222-222222222222";
const SEISMIC = "33333333-3333-4333-8333-333333333331";
const FIRE = "33333333-3333-4333-8333-333333333332";
const SEISMIC_DEPENDENCY = "33333333-3333-4333-8333-333333333333";
const FIRE_DEPENDENCY = "33333333-3333-4333-8333-333333333334";
const LOW = "44444444-4444-4444-8444-444444444441";
const HIGH = "44444444-4444-4444-8444-444444444442";
const FALSE = "44444444-4444-4444-8444-444444444443";
const TRUE = "44444444-4444-4444-8444-444444444444";
const FT_SEISMIC = "55555555-5555-4555-8555-555555555551";
const FT_FIRE = "55555555-5555-4555-8555-555555555552";
const FT_PARENT = "55555555-5555-4555-8555-555555555553";
const FT_OTHER = "55555555-5555-4555-8555-555555555554";
const BE_SEISMIC = "66666666-6666-4666-8666-666666666661";
const BE_FIRE = "66666666-6666-4666-8666-666666666662";
const BE_CONSTANT_FALSE = "66666666-6666-4666-8666-666666666663";
const ET_DIRECT = "77777777-7777-4777-8777-777777777771";
const ET_PARENT = "77777777-7777-4777-8777-777777777772";
const ET_OTHER = "77777777-7777-4777-8777-777777777773";

function gateId(modelId: string): string {
  return `${modelId}:TOP`;
}

function faultTree(
  modelId: string,
  basicEventIds: readonly string[],
  transfers: readonly string[] = [],
  constantBasicEventStates: Readonly<Record<string, boolean>> = {},
  gateType: "AND" | "OR" = "OR",
): HclBatchFaultTreeTarget {
  const basicLeaves = basicEventIds.map((basicEventId, index) => ({
    id: `${modelId}:BE:${String(index)}`,
    kind: "BASIC_EVENT_REFERENCE" as const,
    basicEventId,
  }));
  const transferLeaves = transfers.map((targetModelId, index) => ({
    id: `${modelId}:TRANSFER:${String(index)}`,
    kind: "TRANSFER_REFERENCE" as const,
    target: {
      workbookId: WORKBOOK,
      modelId: targetModelId,
      entityId: gateId(targetModelId),
    },
  }));
  const leaves = [...basicLeaves, ...transferLeaves];
  return {
    workbookId: WORKBOOK,
    modelId,
    topGateId: gateId(modelId),
    gates: [{ id: gateId(modelId), gateType }],
    leafNodes: leaves,
    gateInputs: leaves.map((leaf, order) => ({
      gateId: gateId(modelId),
      childId: leaf.id,
      order,
    })),
    constantBasicEventStates,
  };
}

const node = (id: string, code: string) => ({
  id,
  kind: "CHANCE_NODE" as const,
  code,
  name: code,
  description: "",
  states: [
    { id: LOW, code: "LOW", name: "Low" },
    { id: HIGH, code: "HIGH", name: "High" },
  ] as [
    { id: string; code: string; name: string },
    { id: string; code: string; name: string },
  ],
});

const binding = (
  id: string,
  nodeId: string,
  basicEventId: string,
): HclEventBinding => ({
  id,
  faultTreeBasicEvent: {
    referenceType: "FAULT_TREE_BASIC_EVENT",
    workbookId: WORKBOOK,
    entityId: basicEventId,
  },
  bayesianNetworkNode: {
    referenceType: "BAYESIAN_NETWORK_NODE",
    workbookId: WORKBOOK,
    modelId: NETWORK,
    entityId: nodeId,
  },
  trueStateIds: [HIGH],
});

const scenario = (
  id: string,
  seismicStateId: string,
  fireStateId: string,
): HclEvidenceScenario => ({
  id,
  code: id,
  name: id,
  enabled: true,
  evidence: {
    observations: [
      { nodeId: SEISMIC, stateId: seismicStateId },
      { nodeId: FIRE, stateId: fireStateId },
    ],
  },
});

const commonInput = {
  bayesianNetwork: {
    nodes: [
      node(SEISMIC, "SEISMIC"),
      node(FIRE, "FIRE"),
      node(SEISMIC_DEPENDENCY, "SEISMIC-DEP"),
      node(FIRE_DEPENDENCY, "FIRE-DEP"),
    ],
    edges: [
      { id: "88888888-8888-4888-8888-888888888881", parentNodeId: SEISMIC, childNodeId: SEISMIC_DEPENDENCY },
      { id: "88888888-8888-4888-8888-888888888882", parentNodeId: FIRE, childNodeId: FIRE_DEPENDENCY },
    ],
  },
  baseEvidence: { observations: [] },
  bindings: [
    binding("99999999-9999-4999-8999-999999999991", SEISMIC_DEPENDENCY, BE_SEISMIC),
    binding("99999999-9999-4999-8999-999999999992", FIRE_DEPENDENCY, BE_FIRE),
  ],
  faultTrees: [
    faultTree(FT_SEISMIC, [BE_SEISMIC]),
    faultTree(FT_FIRE, [BE_FIRE]),
    faultTree(FT_PARENT, [], [FT_SEISMIC]),
    faultTree(FT_OTHER, []),
  ],
  eventTrees: [
    {
      workbookId: WORKBOOK,
      modelId: ET_DIRECT,
      faultTrees: [{ workbookId: WORKBOOK, modelId: FT_PARENT }],
      transferTargets: [],
    },
    {
      workbookId: WORKBOOK,
      modelId: ET_PARENT,
      faultTrees: [],
      transferTargets: [{ workbookId: WORKBOOK, modelId: ET_DIRECT }],
    },
    {
      workbookId: WORKBOOK,
      modelId: ET_OTHER,
      faultTrees: [{ workbookId: WORKBOOK, modelId: FT_OTHER }],
      transferTargets: [],
    },
  ],
};

describe("HCL batch target relevance", () => {
  it("uses only evidence whose effective value varies and follows FT and ET transfers", () => {
    const result = resolveHclBatchTargetRelevance({
      ...commonInput,
      scenarios: [
        scenario("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", LOW, FALSE),
        scenario("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", HIGH, FALSE),
      ],
    });

    expect(result.varyingEvidenceNodeIds).toEqual([SEISMIC]);
    expect(result.affectedBayesianNetworkNodeIds).toEqual(expect.arrayContaining([SEISMIC, SEISMIC_DEPENDENCY]));
    expect(result.affectedBayesianNetworkNodeIds).not.toContain(FIRE_DEPENDENCY);
    expect(result.faultTreeKeys).toEqual([
      `${WORKBOOK}:${FT_PARENT}`,
      `${WORKBOOK}:${FT_SEISMIC}`,
    ].sort());
    expect(result.eventTreeKeys).toEqual([
      `${WORKBOOK}:${ET_DIRECT}`,
      `${WORKBOOK}:${ET_PARENT}`,
    ].sort());
  });

  it("includes fire targets as soon as the fire evidence changes", () => {
    const result = resolveHclBatchTargetRelevance({
      ...commonInput,
      scenarios: [
        scenario("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", LOW, FALSE),
        scenario("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", LOW, TRUE),
      ],
    });

    expect(result.varyingEvidenceNodeIds).toEqual([FIRE]);
    expect(result.faultTreeKeys).toEqual([`${WORKBOOK}:${FT_FIRE}`]);
  });

  it("returns no batch targets when the effective evidence is identical", () => {
    const result = resolveHclBatchTargetRelevance({
      ...commonInput,
      scenarios: [
        scenario("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", LOW, FALSE),
        scenario("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", LOW, FALSE),
      ],
    });

    expect(result.varyingEvidenceNodeIds).toEqual([]);
    expect(result.faultTreeKeys).toEqual([]);
    expect(result.eventTreeKeys).toEqual([]);
  });

  it("excludes structurally affected fault trees whose top event is fixed by constant logic", () => {
    const masked = faultTree(
      FT_PARENT,
      [BE_CONSTANT_FALSE],
      [FT_SEISMIC],
      { [BE_CONSTANT_FALSE]: false },
      "AND",
    );
    const result = resolveHclBatchTargetRelevance({
      ...commonInput,
      faultTrees: [faultTree(FT_SEISMIC, [BE_SEISMIC]), masked],
      eventTrees: [],
      scenarios: [
        scenario("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", LOW, FALSE),
        scenario("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", HIGH, FALSE),
      ],
    });

    expect(result.faultTreeKeys).toEqual([`${WORKBOOK}:${FT_SEISMIC}`]);
    expect(result.constantMaskedFaultTreeKeys).toEqual([`${WORKBOOK}:${FT_PARENT}`]);
  });
});
