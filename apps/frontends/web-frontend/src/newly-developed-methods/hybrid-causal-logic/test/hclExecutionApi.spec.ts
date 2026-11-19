import { fetchJson, postJson } from "../../../api/client";
import { generateEsqHclScenarios, runEsqHclFaultTree, runEsqHclFaultTreeBatch, runEsqHclEventTree, runEsqHclEventTreeBatch } from "../../../esq-workbooks/esqWorkbookApi";
import type { HclBatchExecuteResult, HclCalculationType, HclExecuteResult } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods/shared";

jest.mock("../../../api/client", () => ({ fetchJson: jest.fn(), postJson: jest.fn() }));
const post = jest.mocked(postJson);
const get = jest.mocked(fetchJson);
type Host = "esq";
const hcl = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";
const batchId = "00000000-0000-4000-8000-000000000003";
const time = "2026-10-16T00:00:00Z";
const ft = { referenceType: "FAULT_TREE_TOP_EVENT", workbookId: "sy", modelId: "ft", entityId: "top" } as const;
const et = { workbookId: "esq", modelId: "ET-A" };
const sampling = { sampleCount: 64, seed: 7, sampler: "LHS" as const };

function analysisRun(host: Host, id: string, status: "QUEUED" | "SUCCEEDED"): AnalysisRunMetadata {
  const finished = status === "SUCCEEDED";
  return {
    schemaVersion: "1.0.0",
    id,
    owner: { workbookId: host, modelId: hcl, workbookRevision: 2 },
    sourceWorkbooks: [{ workbookId: host, workbookRevision: 2 }],
    methodType: "HYBRID_CAUSAL_LOGIC",
    status,
    requestedBy: "analyst",
    requestedAt: time,
    startedAt: finished ? time : null,
    completedAt: finished ? time : null,
    engine: finished ? { name: "PRAXIS", version: "1.0.0" } : null,
    failure: null,
  };
}

function scenarioBatch(host: Host, status: "QUEUED" | "SUCCEEDED"): HclBatchExecuteResult {
  return {
    schemaVersion: "1.0.0",
    batchId,
    runs: [{ scenarioId: "scenario", scenarioCode: "S1", scenarioName: "Scenario", run: analysisRun(host, runId, status) }],
  };
}

function storedBatch(host: Host): HclBatchExecuteResult {
  const stored = scenarioBatch(host, "SUCCEEDED");
  post.mockResolvedValue(scenarioBatch(host, "QUEUED"));
  get.mockImplementation(async (path) => (path.endsWith("/result") ? stored : analysisRun(host, batchId, "SUCCEEDED")));
  return stored;
}

beforeEach(() => {
  jest.useFakeTimers();
  post.mockReset();
  get.mockReset();
});
afterEach(() => jest.useRealTimers());

const cutSets = { score: "FAILED_EVENTS_AND_SEQUENCE" as const, keep: 25, limitOrder: 3, cutOff: 1e-9 };
const treeCutSets = { keep: 25, limitOrder: 3, cutOff: 1e-9, causes: 4 };

const single: Array<[string, Host, (mode: HclCalculationType) => Promise<HclExecuteResult>, object]> = [
  ["ESQ ET with importance", "esq", (mode) => runEsqHclEventTree("esq", hcl, 2, et, mode, undefined, cutSets, true), { eventTree: et, dependencyCutSets: cutSets, dependencyImportance: true }],
  ["ESQ ET with sampled importance", "esq", (mode) => runEsqHclEventTree("esq", hcl, 2, et, mode, sampling, undefined, 7), { eventTree: et, sampling, dependencyImportance: true, dependencyImportanceEvents: 7 }],
  ["ESQ FT", "esq", (mode) => runEsqHclFaultTree("esq", hcl, 2, ft, mode), { faultTreeTopGate: ft }],
  ["ESQ FT with sampling", "esq", (mode) => runEsqHclFaultTree("esq", hcl, 2, ft, mode, sampling), { faultTreeTopGate: ft, sampling }],
  ["ESQ FT with ranked cut sets", "esq", (mode) => runEsqHclFaultTree("esq", hcl, 2, ft, mode, undefined, treeCutSets), { faultTreeTopGate: ft, dependencyCutSets: treeCutSets }],
  ["ESQ FT with importance", "esq", (mode) => runEsqHclFaultTree("esq", hcl, 2, ft, mode, undefined, treeCutSets, true), { faultTreeTopGate: ft, dependencyCutSets: treeCutSets, dependencyImportance: true }],
  ["ESQ FT with importance off", "esq", (mode) => runEsqHclFaultTree("esq", hcl, 2, ft, mode, undefined, undefined, false), { faultTreeTopGate: ft }],
  ["ESQ FT with sampled importance", "esq", (mode) => runEsqHclFaultTree("esq", hcl, 2, ft, mode, sampling, undefined, 7), { faultTreeTopGate: ft, sampling, dependencyImportance: true, dependencyImportanceEvents: 7 }],
  ["ESQ ET", "esq", (mode) => runEsqHclEventTree("esq", hcl, 2, et, mode), { eventTree: et }],
  ["ESQ ET with ranked cut sets", "esq", (mode) => runEsqHclEventTree("esq", hcl, 2, et, mode, undefined, cutSets), { eventTree: et, dependencyCutSets: cutSets }],
];
const batch: Array<[string, Host, (mode: HclCalculationType) => Promise<HclBatchExecuteResult>, object]> = [
  ["ESQ ET batch with importance", "esq", (mode) => runEsqHclEventTreeBatch("esq", hcl, 2, et, mode, ["scenario"], false, undefined, undefined, undefined, true), { eventTree: et, evidenceScenarioIds: ["scenario"], dependencyImportance: true }],
  ["ESQ FT batch", "esq", (mode) => runEsqHclFaultTreeBatch("esq", hcl, 2, ft, mode, ["scenario"], false), { faultTreeTopGate: ft, evidenceScenarioIds: ["scenario"] }],
  ["ESQ FT batch over the hazard grid with sampling", "esq", (mode) => runEsqHclFaultTreeBatch("esq", hcl, 2, ft, mode, ["scenario"], true, undefined, sampling), { faultTreeTopGate: ft, evidenceScenarioIds: ["scenario"], integrateHazardGrid: true, sampling }],
  ["ESQ FT batch with ranked cut sets", "esq", (mode) => runEsqHclFaultTreeBatch("esq", hcl, 2, ft, mode, ["scenario"], true, undefined, undefined, treeCutSets), { faultTreeTopGate: ft, evidenceScenarioIds: ["scenario"], integrateHazardGrid: true, dependencyCutSets: treeCutSets }],
  ["ESQ FT batch with importance", "esq", (mode) => runEsqHclFaultTreeBatch("esq", hcl, 2, ft, mode, ["scenario"], false, undefined, undefined, treeCutSets, true), { faultTreeTopGate: ft, evidenceScenarioIds: ["scenario"], dependencyCutSets: treeCutSets, dependencyImportance: true }],
  ["ESQ FT batch with sampled importance", "esq", (mode) => runEsqHclFaultTreeBatch("esq", hcl, 2, ft, mode, ["scenario"], false, undefined, sampling, undefined, 7), { faultTreeTopGate: ft, evidenceScenarioIds: ["scenario"], sampling, dependencyImportance: true, dependencyImportanceEvents: 7 }],
  ["ESQ ET batch", "esq", (mode) => runEsqHclEventTreeBatch("esq", hcl, 2, et, mode, ["scenario"], false), { eventTree: et, evidenceScenarioIds: ["scenario"] }],
  ["ESQ ET batch with ranked cut sets", "esq", (mode) => runEsqHclEventTreeBatch("esq", hcl, 2, et, mode, ["scenario"], true, undefined, undefined, cutSets), { eventTree: et, evidenceScenarioIds: ["scenario"], integrateHazardGrid: true, dependencyCutSets: cutSets }],
];

for (const mode of ["PROBABILITY", "UNCERTAINTY"] as const) {
  const request = { schemaVersion: "1.0.0", modelId: hcl, workbookRevision: 2, calculationType: mode };

  it.each(single)(`%s transports ${mode} with the target and evidence and follows the queued run`, async (_name, host, execute, target) => {
    post.mockResolvedValue({ schemaVersion: "1.0.0", run: analysisRun(host, runId, "QUEUED") });
    get.mockResolvedValue(analysisRun(host, runId, "SUCCEEDED"));
    const finished = execute(mode);
    await jest.runAllTimersAsync();
    expect(await finished).toEqual({ schemaVersion: "1.0.0", run: analysisRun(host, runId, "SUCCEEDED") });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(expect.any(String), { ...request, ...target });
    expect(get.mock.calls).toEqual([[`/api/${host}-workbooks/${host}/analysis-runs/${runId}`]]);
  });

  it.each(batch)(`%s transports ${mode} with the target and evidence and reads the finished batch`, async (_name, host, execute, target) => {
    const stored = storedBatch(host);
    expect(await execute(mode)).toEqual(stored);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(expect.any(String), { ...request, ...target });
    expect(get.mock.calls).toEqual([
      [`/api/${host}-workbooks/${host}/analysis-runs/${batchId}`],
      [`/api/${host}-workbooks/${host}/hcl-configurations/${hcl}/runs/${batchId}/result`],
    ]);
  });
}

const batchInput = { evidenceScenarios: [{ id: "uploaded", code: "UP", name: "Uploaded", enabled: true,
  evidence: { observations: [{ nodeId: "node", stateId: "state" }] } }] };
it.each([
  ["ESQ FT", "esq", () => runEsqHclFaultTreeBatch("esq", hcl, 2, ft, "PROBABILITY", ["uploaded"], false, batchInput)],
  ["ESQ ET", "esq", () => runEsqHclEventTreeBatch("esq", hcl, 2, et, "PROBABILITY", ["uploaded"], false, batchInput)],
] as const)("%s sends temporary scenario contents", async (_name, host, execute) => {
  storedBatch(host);
  await execute();
  expect(post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ batchInput, evidenceScenarioIds: ["uploaded"] }));
});

it("ESQ scenario generation sends the sweep to the configuration", async () => {
  const spec = { dimensions: [{ id: "A", bnNode: "node", states: ["state"] }], excludedAssignments: [{ A: "state" }], maxScenarios: 2 };
  const generated = { schemaVersion: "1.0.0" as const, scenarios: batchInput.evidenceScenarios };
  post.mockResolvedValue(generated);
  expect(await generateEsqHclScenarios("esq", hcl, 2, spec)).toEqual(generated);
  expect(post.mock.calls).toEqual([[`/api/esq-workbooks/esq/hcl-configurations/${hcl}/generate-scenarios`, { schemaVersion: "1.0.0", modelId: hcl, workbookRevision: 2, spec }]]);
  expect(get).not.toHaveBeenCalled();
});
