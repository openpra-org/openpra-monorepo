import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { EsqWorkbookPage } from "../esqWorkbookPage";
import { fetchJson } from "../../api/client";
import {
  fetchEsqLinkedInputs, getEsqWorkbook, getEsqExampleOptions, loadEsqExample, unloadEsqExample,
  type EsqWorkbookResponse,
} from "../esqWorkbookApi";
import type { EsqLinkedInputs } from "../esqWorkbookContext";

let mockWorkbookId = "new-esq";
jest.mock("react-router-dom", () => ({ useParams: () => ({ id: mockWorkbookId }) }));
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { username: "analyst" } }) }));
jest.mock("../../api/client", () => ({ fetchJson: jest.fn() }));
jest.mock("../../projects/projectApi", () => ({ getProject: async () => ({ name: "Project" }) }));
jest.mock("../esqWorkbookApi", () => ({
  fetchEsqLinkedInputs: jest.fn(), getEsqWorkbook: jest.fn(), getEsqExampleOptions: jest.fn(),
  loadEsqExample: jest.fn(), unloadEsqExample: jest.fn(),
}));
jest.mock("../useEsqMefPatch", () => ({ useEsqMefPatch: () => ({ patch: jest.fn(), saveStatus: "saved" }) }));
jest.mock("../esqWorkbench", () => ({
  EsqWorkbench: ({ data, onLoadExample, onUnloadExample }: {
    data: { esq: { uuid: string }; links: EsqLinkedInputs | null };
    onLoadExample: () => void;
    onUnloadExample?: () => void;
  }) => <>
    <div data-testid="workbook">{data.esq.uuid}</div>
    <div data-testid="linked-inputs">{data.links?.esFamilies.map((f) => f.name).join(",") ?? "No example inputs"}</div>
    <button onClick={onLoadExample}>Load example</button>
    {onUnloadExample && <button onClick={onUnloadExample}>Unload example</button>}
  </>,
}));
jest.mock("../../workbooks/exampleWorkbookModal", () => ({
  LoadExampleModal: ({ onConfirm }: { onConfirm: (id: string) => Promise<void> }) => <button onClick={() => { void onConfirm("hcl"); }}>Load dissertation</button>,
  UnloadExampleModal: ({ onConfirm }: { onConfirm: () => Promise<void> }) => <button onClick={() => { void onConfirm(); }}>Confirm unload</button>,
}));

function response(uuid: string): EsqWorkbookResponse {
  return {
    workbookId: mockWorkbookId, projectId: "project", ownerUsername: "analyst", revision: 0,
    myRoles: ["preparer"], hasPreviousMef: uuid === "esq-hcl-case-study", updatedAt: "2026-09-17T00:00:00Z",
    mef: { uuid, name: "ESQ", version: "1", workflowState: "DRAFT", internalReviewComments: { comments: [] } } as unknown as EventSequenceQuantification,
  };
}
const linkedInputs: EsqLinkedInputs = {
  posStates: [], ieGroups: [], esFamilies: [{ id: "family", name: "Dissertation family" }],
  eventTrees: [], eventSequences: [], dynamicRuns: [], scMissionTimes: [], sySystems: [], hrActions: [], daParams: [],
};

describe("ESQ example loading", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkbookId = "new-esq";
    jest.mocked(getEsqWorkbook).mockResolvedValue(response("blank"));
    jest.mocked(getEsqExampleOptions).mockResolvedValue([{ id: "hcl", label: "Dissertation" }]);
    jest.mocked(loadEsqExample).mockResolvedValue(response("esq-hcl-case-study"));
    jest.mocked(unloadEsqExample).mockResolvedValue(response("blank"));
    jest.mocked(fetchEsqLinkedInputs).mockResolvedValue(linkedInputs);
  });

  it("loads the saved blank workbook without requesting any example data", async () => {
    render(<EsqWorkbookPage />);
    expect(await screen.findByTestId("workbook")).toHaveTextContent("blank");
    expect(fetchJson).not.toHaveBeenCalled();
    expect(fetchEsqLinkedInputs).not.toHaveBeenCalled();
    expect(loadEsqExample).not.toHaveBeenCalled();
  });

  it("loads dissertation inputs only after confirmation and removes them on unload", async () => {
    render(<EsqWorkbookPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Load example" }));
    expect(loadEsqExample).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Load dissertation" }));
    await waitFor(() => expect(screen.getByTestId("linked-inputs")).toHaveTextContent("Dissertation family"));
    expect(loadEsqExample).toHaveBeenCalledWith("new-esq", "hcl");
    expect(fetchEsqLinkedInputs).toHaveBeenCalledWith("hcl");
    fireEvent.click(screen.getByRole("button", { name: "Unload example" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm unload" }));
    await waitFor(() => expect(screen.getByTestId("linked-inputs")).toHaveTextContent("No example inputs"));
    expect(screen.getByTestId("workbook")).toHaveTextContent("blank");
  });

  it("reopens a previously loaded dissertation and does not show it while another workbook loads", async () => {
    jest.mocked(getEsqWorkbook).mockResolvedValueOnce(response("esq-hcl-case-study"));
    const { rerender } = render(<EsqWorkbookPage />);
    await waitFor(() => expect(screen.getByTestId("linked-inputs")).toHaveTextContent("Dissertation family"));
    let finish!: (value: EsqWorkbookResponse) => void;
    jest.mocked(getEsqWorkbook).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    mockWorkbookId = "another-esq";
    rerender(<EsqWorkbookPage />);
    expect(screen.queryByTestId("workbook")).not.toBeInTheDocument();
    expect(screen.getByText("Loading workbook…")).toBeInTheDocument();
    await act(async () => { finish(response("another-blank")); });
    expect(screen.getByTestId("workbook")).toHaveTextContent("another-blank");
    expect(screen.getByTestId("linked-inputs")).toHaveTextContent("No example inputs");
    expect(fetchEsqLinkedInputs).toHaveBeenCalledTimes(1);
  });

  it("ignores a late example response after unloading", async () => {
    let finish!: (value: EsqLinkedInputs) => void;
    jest.mocked(fetchEsqLinkedInputs).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    jest.mocked(getEsqWorkbook).mockResolvedValueOnce(response("esq-hcl-case-study"));
    render(<EsqWorkbookPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Unload example" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm unload" }));
    await waitFor(() => expect(screen.getByTestId("workbook")).toHaveTextContent("blank"));
    await act(async () => { finish(linkedInputs); });
    expect(screen.getByTestId("linked-inputs")).toHaveTextContent("No example inputs");
  });
});
