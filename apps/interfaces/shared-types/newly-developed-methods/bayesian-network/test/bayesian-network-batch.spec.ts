import { BayesianNetworkExecuteRequestSchema, BayesianNetworkBatchAnalysisResultSchema } from "..";

const id = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const scenario = { id, code: "EQ", name: "Earthquake", evidence: { observations: [] } };
const query = { scenarios: [scenario], queryNodeIds: [id] };
const request = { schemaVersion: "1.0.0", modelId: id, workbookRevision: 1, query };

it("accepts evidence batches and preserves scenario identity", () => {
  expect(BayesianNetworkExecuteRequestSchema.parse(request)).toEqual(request);
});

it.each([
  { ...query, scenarios: [] },
  { ...query, scenarios: [scenario, scenario] },
  { ...query, queryNodeIds: [] },
  { ...query, queryNodeIds: [id, id] },
  { ...query, evidence: { observations: [] } },
])("rejects invalid or ambiguous batch query %#", (candidate) => {
  expect(BayesianNetworkExecuteRequestSchema.safeParse({ ...request, query: candidate }).success).toBe(false);
});

it("validates successful and failed rows with consistent statuses", () => {
  const common = { schemaVersion: "1.0.0", runId: id,
    owner: { workbookId: "sy", workbookRevision: 1, modelId: id }, completedAt: "2026-09-10T12:00:00Z" };
  const row = { scenarioId: id, scenarioCode: "EQ", scenarioName: "Earthquake", status: "SUCCEEDED", failure: null,
    result: { ...common, evidence: scenario.evidence, validationIssues: [],
      marginals: [{ nodeId: id, values: [{ stateId: id, probability: 0.2 }, { stateId: other, probability: 0.8 }] }] } };
  const batch = { ...common, queryNodeIds: [id], scenarios: [row,
    { ...row, scenarioId: other, status: "FAILED", failure: "Impossible evidence", result: null }],
    diagnostics: { junctionTreeCompilations: 1, scenarioEvaluations: 2 } };
  expect(BayesianNetworkBatchAnalysisResultSchema.parse(batch)).toEqual(batch);
  expect(BayesianNetworkBatchAnalysisResultSchema.safeParse({ ...batch, scenarios: [{ ...row, result: null }] }).success).toBe(false);
});
