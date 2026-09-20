import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnalysisRunHistory, SavedAnalysisResult } from "../analysisRunHistory";
import { useAnalysisSourceGuard } from "../useAnalysisSourceGuard";
import { notifyAnalysisRun } from "../analysisRunEvents";
import { fetchJson } from "../../../api/client";
import type { AnalysisRunDetails, AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods/shared";
jest.mock("../../../api/client", () => ({ fetchJson: jest.fn() }));
const get = jest.mocked(fetchJson);
const id = "00000000-0000-4000-8000-000000000041";
const model = "00000000-0000-4000-8000-000000000042";
const time = "2026-09-12T00:00:00Z";
const run: AnalysisRunMetadata = {
  schemaVersion: "1.0.0",
  id,
  owner: { workbookId: "w", modelId: model, workbookRevision: 1 },
  sourceWorkbooks: [
    { workbookId: "w", workbookRevision: 1 },
    { workbookId: "da", workbookRevision: 3 },
  ],
  methodType: "FAULT_TREE",
  status: "SUCCEEDED",
  requestedBy: "analyst",
  requestedAt: time,
  startedAt: time,
  completedAt: time,
  engine: { name: "PRAXIS", version: "sha256:" + "a".repeat(64) },
  failure: null,
  freshness: {
    status: "STALE",
    sources: [
      { workbookId: "w", savedRevision: 1, currentRevision: 1, status: "CURRENT" },
      { workbookId: "da", savedRevision: 3, currentRevision: 4, status: "CHANGED" },
    ],
  },
};
const details: AnalysisRunDetails = {
  run,
  target: null,
  contributions: null,
  request: { modelId: model },
  nativeRequest: {
    schemaVersion: "1.0.0",
    request: { methodType: "FAULT_TREE" },
    modelSnapshots: [{ id: model }],
    resources: {},
  },
  workbookSnapshots: [
    { hostType: "SY", identity: { workbookId: "w", workbookRevision: 1 }, mef: {} },
    { hostType: "DA", identity: { workbookId: "da", workbookRevision: 3 }, mef: {} },
  ],
  result: {
    schemaVersion: "1.0.0",
    runId: id,
    owner: run.owner,
    topGateId: model,
    topEventProbability: 0.01,
    validationIssues: [],
    completedAt: time,
  },
};
function page(nextCursor: string | null = null) {
  return { schemaVersion: "1.0.0", runs: [{ run, target: null, contributions: null }], nextCursor };
}
function openHistory() {
  fireEvent.click(screen.getByRole("button", { name: "Review saved runs" }));
}
beforeEach(() => {
  get.mockReset();
});

it("opens and closes analysis history with the saved-runs button", async () => {
  get.mockResolvedValue(page());
  render(<AnalysisRunHistory host="sy" workbookId="w" />);

  const openButton = screen.getByRole("button", { name: "Review saved runs" });
  expect(openButton).toHaveAttribute("aria-expanded", "false");
  expect(get).not.toHaveBeenCalled();
  fireEvent.click(openButton);
  expect(screen.getByRole("button", { name: "Hide saved runs" })).toHaveAttribute("aria-expanded", "true");
  await screen.findByRole("button", { name: /FAULT TREE/ });

  fireEvent.click(screen.getByRole("button", { name: "Hide saved runs" }));
  expect(screen.getByRole("button", { name: "Review saved runs" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", { name: /FAULT TREE/ })).not.toBeInTheDocument();
});

it("opens a historical result with changed DA revisions and preserved probability", async () => {
  get.mockImplementation(async (path) => (path.endsWith("/details") ? details : page()));
  render(
    <AnalysisRunHistory
      host="sy"
      workbookId="w"
    />,
  );
  expect(get).not.toHaveBeenCalled();
  openHistory();
  await screen.findByRole("button", { name: /FAULT TREE/ });
  fireEvent.click(screen.getByRole("button", { name: /FAULT TREE/ }));
  expect(await screen.findByText("0.01")).toBeInTheDocument();
  expect(screen.getByText(/saved revision 3, current revision 4/)).toBeInTheDocument();
  expect(screen.getByText(/Historical result: sources have changed/)).toBeInTheDocument();
  expect(screen.getByText(/Native build: sha256:/)).toBeInTheDocument();
});

it("loads older pages without discarding historical records lacking typed provenance", async () => {
  get.mockResolvedValueOnce(page("older-page")).mockResolvedValueOnce({ ...page(), runs: [] });
  render(
    <AnalysisRunHistory
      host="es"
      workbookId="w"
    />,
  );
  openHistory();
  fireEvent.click(await screen.findByRole("button", { name: "Older runs" }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith("/api/es-workbooks/w/analysis-runs?cursor=older-page"));
  expect(await screen.findByText("No accessible runs on this page.")).toBeInTheDocument();
});

it("clears a downloaded-detail view when source access is revoked on refresh", async () => {
  get.mockImplementation(async (path) => (path.endsWith("/details") ? details : page()));
  render(
    <AnalysisRunHistory
      host="esq"
      workbookId="w"
    />,
  );
  openHistory();
  fireEvent.click(await screen.findByRole("button", { name: /FAULT TREE/ }));
  await screen.findByText("0.01");
  get.mockRejectedValue(new Error("Source access revoked"));
  fireEvent.focus(window);
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Download saved run" })).not.toBeInTheDocument();
});

it("discards late history responses after switching workbooks", async () => {
  let resolve!: (value: unknown) => void;
  get
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue({ ...page(), runs: [] });
  const view = render(
    <AnalysisRunHistory
      host="sy"
      workbookId="w"
    />,
  );
  openHistory();
  view.rerender(
    <AnalysisRunHistory
      host="sy"
      workbookId="other"
    />,
  );
  await screen.findByText("No accessible runs on this page.");
  await act(async () => {
    resolve(page());
  });
  expect(screen.queryByRole("button", { name: /FAULT TREE/ })).not.toBeInTheDocument();
});

function Guard({ workbookId = "w" }: { workbookId?: string }) {
  const { sourceEpoch, sourceWarning } = useAnalysisSourceGuard("sy", workbookId);
  return (
    <>
      <output>{sourceEpoch}</output>
      <p>{sourceWarning}</p>
    </>
  );
}
it("invalidates active results when an external source changes", async () => {
  get.mockResolvedValue(run);
  render(<Guard />);
  act(() => notifyAnalysisRun("/api/sy-workbooks/w/fault-trees/model/runs", { run: { id } }));
  await screen.findByText(/A source workbook changed/);
  expect(screen.getByText("1")).toBeInTheDocument();
});
it("rechecks a current result on focus and invalidates it after source access is revoked", async () => {
  get.mockResolvedValue({ ...run, freshness: { status: "CURRENT", sources: [] } });
  render(<Guard />);
  act(() => notifyAnalysisRun("/api/sy-workbooks/w/fault-trees/model/runs", { run: { id } }));
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  get.mockRejectedValue(new Error("Forbidden"));
  fireEvent.focus(window);
  await screen.findByText(/Source access or revisions could not be verified/);
});
it("checks the complete batch parent rather than issuing one check per scenario", async () => {
  get.mockResolvedValue({ ...run, freshness: { status: "CURRENT", sources: [] } });
  render(<Guard />);
  act(() =>
    notifyAnalysisRun("/api/sy-workbooks/w/hcl-configurations/model/fault-tree-batch-runs", {
      batchId: id,
      runs: [{ run: { id: "child" } }],
    }),
  );
  await waitFor(() => expect(get).toHaveBeenCalledWith(`/api/sy-workbooks/w/analysis-runs/${id}`));
  expect(get).toHaveBeenCalledTimes(1);
});

it("uses preserved event-tree labels without loading current models", () => {
  const sequenceId = "00000000-0000-4000-8000-000000000043";
  const endStateId = "00000000-0000-4000-8000-000000000044";
  const eventDetails: AnalysisRunDetails = {
    ...details,
    run: { ...run, methodType: "EVENT_TREE" },
    workbookSnapshots: [
      {
        hostType: "ES",
        identity: { workbookId: "w", workbookRevision: 1 },
        mef: {
          eventTrees: [
            {
              uuid: model,
              name: "Historical plant",
              sequences: {
                success: { uuid: sequenceId, name: "Historical mitigation", endState: "SUCCESSFUL_MITIGATION" },
              },
              endStateIds: { SUCCESSFUL_MITIGATION: endStateId },
            },
          ],
        },
      },
    ],
    result: {
      schemaVersion: "1.0.0",
      runId: id,
      owner: run.owner,
      mode: "INDEPENDENT",
      completedAt: time,
      validationIssues: [],
      sequences: [
        {
          sequenceId,
          path: [],
          result: { kind: "END_STATE", endStateId },
          conditionalProbability: 0.7,
          annualFrequency: 0.007,
        },
      ],
      endStateAggregates: [{ endStateId, annualFrequency: 0.007 }],
    },
  };
  render(<SavedAnalysisResult details={eventDetails} />);
  expect(screen.getByText("Historical plant / Historical mitigation")).toBeInTheDocument();
  expect(screen.getAllByText(`Safe state (${endStateId})`).length).toBeGreaterThan(0);
  expect(get).not.toHaveBeenCalled();
});
