import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { BayesianNetworkEditorProps } from "../../newly-developed-methods/bayesian-network/bayesianNetworkTypes";
import { testBayesianNetworkModel, TEST_ID } from "../../newly-developed-methods/bayesian-network/test/bayesianNetworkTestModel";
import { postJson, fetchJson } from "../../api/client";
import { ToastProvider } from "../../toast/toastProvider";
import { SyBayesianNetworkWorkspace } from "../syBayesianNetworkWorkspace";

const mockScenarios = [
  { id: TEST_ID.aRow, code: "NO", name: "No earthquake", enabled: true,
    evidence: { observations: [{ nodeId: TEST_ID.b, stateId: TEST_ID.bFalse }] } },
  { id: TEST_ID.bRow, code: "YES", name: "Earthquake", enabled: true,
    evidence: { observations: [{ nodeId: TEST_ID.b, stateId: TEST_ID.bTrue }] } },
];

jest.mock("../../api/client", () => ({ postJson: jest.fn(), fetchJson: jest.fn() }));
jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => ({
    sy: { dependencyBayesianNetworks: [testBayesianNetworkModel()], dependencyHclConfigurations: [],
      systemLogicModels: [], systemBasicEvents: [] },
    editable: true, mutateSy: jest.fn(),
    runtime: { workbookId: "sy-workbook", revision: 1, saveStatus: "saved" },
  }),
}));
jest.mock("../../newly-developed-methods/bayesian-network", () => ({
  ...jest.requireActual("../../newly-developed-methods/bayesian-network"),
  BayesianNetworkEditor: (props: BayesianNetworkEditorProps) => <>
    <button disabled={props.running} onClick={() => props.onRunBatch?.(mockScenarios)}>Run batch</button>
    {props.queryBatchResult?.scenarios.map((row) => <p key={row.scenarioId}>{row.scenarioName}: {row.status}</p>)}
    {props.runError && <p role="alert">{props.runError}</p>}
  </>,
}));

beforeEach(() => jest.resetAllMocks());

it("submits all evidence once and fetches one stored batch with per-row statuses", async () => {
  jest.mocked(postJson).mockResolvedValue({ run: { id: "batch-run", status: "SUCCEEDED" } });
  jest.mocked(fetchJson).mockResolvedValue({ scenarios: mockScenarios.map((scenario, index) => ({
    scenarioId: scenario.id, scenarioCode: scenario.code, scenarioName: scenario.name,
    status: index === 0 ? "SUCCEEDED" : "FAILED", failure: index === 0 ? null : "Impossible evidence",
    result: index === 0 ? {
      schemaVersion: "1.0.0", runId: TEST_ID.model,
      owner: { workbookId: "sy-workbook", modelId: TEST_ID.model, workbookRevision: 1 },
      evidence: scenario.evidence, validationIssues: [], completedAt: "2026-09-10T12:00:00Z",
      marginals: [{ nodeId: TEST_ID.a, values: [
        { stateId: TEST_ID.aFalse, probability: 0.8 }, { stateId: TEST_ID.aTrue, probability: 0.2 },
      ] }],
    } : null,
  })) });
  render(<ToastProvider><SyBayesianNetworkWorkspace /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Run batch" }));
  await screen.findByText("Earthquake: FAILED");
  expect(screen.getByText("No earthquake: SUCCEEDED")).toBeInTheDocument();
  expect(postJson).toHaveBeenCalledTimes(1);
  expect(postJson).toHaveBeenCalledWith(`/api/sy-workbooks/sy-workbook/bayesian-networks/${TEST_ID.model}/runs`, {
    schemaVersion: "1.0.0", modelId: TEST_ID.model, workbookRevision: 1,
    query: { queryNodeIds: [TEST_ID.a], scenarios: mockScenarios.map(({ enabled: _, ...scenario }) => scenario) },
  });
  expect(fetchJson).toHaveBeenCalledTimes(1);
  expect(fetchJson).toHaveBeenCalledWith(`/api/sy-workbooks/sy-workbook/bayesian-networks/${TEST_ID.model}/runs/batch-run/result`);
});

it("reports request failure without falling back to repeated single queries", async () => {
  jest.mocked(postJson).mockRejectedValue(new Error("Batch request failed"));
  render(<ToastProvider><SyBayesianNetworkWorkspace /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Run batch" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Batch request failed");
  await waitFor(() => expect(screen.getByRole("button", { name: "Run batch" })).toBeEnabled());
  expect(postJson).toHaveBeenCalledTimes(1);
  expect(fetchJson).not.toHaveBeenCalled();
});
