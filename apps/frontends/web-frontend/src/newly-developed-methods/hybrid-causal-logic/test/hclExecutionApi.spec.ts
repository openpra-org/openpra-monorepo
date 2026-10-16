import { fetchJson, postJson } from "../../../api/client";
import { runSyHclFaultTree, runSyHclFaultTreeBatch } from "../../../sy-workbooks/syWorkbookApi";
import { runEsqHclFaultTree, runEsqHclFaultTreeBatch, runEsqHclEventTree, runEsqHclEventTreeBatch } from "../../../esq-workbooks/esqWorkbookApi";
import type { HclBatchExecuteResult, HclCalculationType, HclExecuteResult } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods/shared";

jest.mock("../../../api/client", () => ({ fetchJson: jest.fn(), postJson: jest.fn() }));
const post = jest.mocked(postJson);
const get = jest.mocked(fetchJson);
type Host = "sy" | "esq";
const hcl = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";
const batchId = "00000000-0000-4000-8000-000000000003";
const time = "2026-10-16T00:00:00Z";
const ft = { referenceType: "FAULT_TREE_TOP_EVENT", workbookId: "sy", modelId: "ft", entityId: "top" } as const;
const et = { workbookId: "esq", modelId: "ET-A" };
const dependency = { workbookId: "sy", modelId: hcl };

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

const single: Array<[string, Host, (mode: HclCalculationType) => Promise<HclExecuteResult>, object]> = [
  ["SY FT", "sy", (mode) => runSyHclFaultTree("sy", hcl, 2, ft, mode, "scenario"), { faultTreeTopGate: ft, evidenceScenarioId: "scenario" }],
  ["ESQ FT", "esq", (mode) => runEsqHclFaultTree("esq", hcl, 2, ft, mode), { faultTreeTopGate: ft }],
  ["ESQ ET", "esq", (mode) => runEsqHclEventTree("esq", hcl, 2, et, mode, dependency), { eventTree: et, dependencyConfiguration: dependency }],
];
const batch: Array<[string, Host, (mode: HclCalculationType) => Promise<HclBatchExecuteResult>, object]> = [
  ["SY FT batch", "sy", (mode) => runSyHclFaultTreeBatch("sy", hcl, 2, ft, mode, ["scenario"], true), { faultTreeTopGate: ft, evidenceScenarioIds: ["scenario"], integrateHazardGrid: true }],
  ["ESQ FT batch", "esq", (mode) => runEsqHclFaultTreeBatch("esq", hcl, 2, ft, mode, ["scenario"], false), { faultTreeTopGate: ft, evidenceScenarioIds: ["scenario"] }],
  ["ESQ ET batch", "esq", (mode) => runEsqHclEventTreeBatch("esq", hcl, 2, et, mode, ["scenario"], false, dependency), { eventTree: et, evidenceScenarioIds: ["scenario"], dependencyConfiguration: dependency }],
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
  ["SY FT", "sy", () => runSyHclFaultTreeBatch("sy", hcl, 2, ft, "PROBABILITY", ["uploaded"], false, batchInput)],
  ["ESQ FT", "esq", () => runEsqHclFaultTreeBatch("esq", hcl, 2, ft, "PROBABILITY", ["uploaded"], false, batchInput)],
  ["ESQ ET", "esq", () => runEsqHclEventTreeBatch("esq", hcl, 2, et, "PROBABILITY", ["uploaded"], false, dependency, batchInput)],
] as const)("%s sends temporary scenario contents", async (_name, host, execute) => {
  storedBatch(host);
  await execute();
  expect(post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ batchInput, evidenceScenarioIds: ["uploaded"] }));
});
