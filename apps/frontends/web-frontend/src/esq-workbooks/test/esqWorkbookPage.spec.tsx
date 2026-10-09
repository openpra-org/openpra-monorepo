import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EventSequenceQuantification, EsqLinkedWorkbooks } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { EsqWorkbookPage } from "../esqWorkbookPage";
import {
  getEsqWorkbook, getEsqExampleOptions, loadEsqExample, unloadEsqExample,
  type EsqWorkbookResponse,
} from "../esqWorkbookApi";
import { listEsqLinkOptions, loadLinkedEs, NO_LINK_OPTIONS } from "../esqLinks";
import { blankEsq } from "./esqFixtures";

let mockWorkbookId = "new-esq";
jest.mock("react-router-dom", () => ({ useParams: () => ({ id: mockWorkbookId }) }));
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { username: "analyst" } }) }));
jest.mock("../../api/client", () => ({ fetchJson: jest.fn() }));
jest.mock("../../projects/projectApi", () => ({ getProject: async () => ({ name: "Project" }) }));
jest.mock("../esqWorkbookApi", () => ({
  getEsqWorkbook: jest.fn(), getEsqExampleOptions: jest.fn(),
  loadEsqExample: jest.fn(), unloadEsqExample: jest.fn(),
}));
jest.mock("../esqLinks", () => ({
  ...jest.requireActual("../esqLinks"),
  listEsqLinkOptions: jest.fn(),
  loadLinkedEs: jest.fn(),
  loadLinkedSy: jest.fn(),
  loadLinkedDa: jest.fn(),
  loadLinkedHr: jest.fn(),
  loadLinkedIe: jest.fn(),
  loadLinkedPos: jest.fn(),
  loadLinkedSc: jest.fn(),
  loadLinkedRi: jest.fn(),
}));
jest.mock("../esqDaLinks", () => ({ loadEsqDaLinks: jest.fn(async () => []) }));
jest.mock("../useEsqMefPatch", () => ({ useEsqMefPatch: () => ({ patch: jest.fn(), saveStatus: "saved" }) }));
jest.mock("../esqWorkbench", () => ({
  EsqWorkbench: ({ data, onLoadExample, onUnloadExample }: {
    data: { esq: { uuid: string } };
    onLoadExample: () => void;
    onUnloadExample?: () => void;
  }) => {
    const context = jest.requireActual<typeof import("../esqWorkbookContext")>("../esqWorkbookContext");
    const { upstream } = context.useEsqWorkbook();
    return <>
      <div data-testid="workbook">{data.esq.uuid}</div>
      <div data-testid="linked-es">{upstream.es?.name ?? "No ES"}</div>
      <button onClick={onLoadExample}>Load example</button>
      {onUnloadExample && <button onClick={onUnloadExample}>Unload example</button>}
    </>;
  },
}));
jest.mock("../../workbooks/exampleWorkbookModal", () => ({
  LoadExampleModal: ({ onConfirm }: { onConfirm: (id: string) => Promise<void> }) => <button onClick={() => { void onConfirm("hcl"); }}>Load dissertation</button>,
  UnloadExampleModal: ({ onConfirm }: { onConfirm: () => Promise<void> }) => <button onClick={() => { void onConfirm(); }}>Confirm unload</button>,
}));

function response(uuid: string, linkedWorkbooks?: EsqLinkedWorkbooks): EsqWorkbookResponse {
  const mef: EventSequenceQuantification = { ...blankEsq(), uuid, ...(linkedWorkbooks === undefined ? {} : { linkedWorkbooks }) };
  return {
    workbookId: mockWorkbookId, projectId: "project", ownerUsername: "analyst", revision: 0,
    myRoles: ["preparer"], hasPreviousMef: linkedWorkbooks !== undefined, updatedAt: "2026-10-05T00:00:00Z",
    mef,
  };
}

const DISSERTATION_ES = { name: "Dissertation ES" } as EventSequenceAnalysis;

describe("ESQ linked workbooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkbookId = "new-esq";
    jest.mocked(getEsqWorkbook).mockResolvedValue(response("blank"));
    jest.mocked(getEsqExampleOptions).mockResolvedValue([{ id: "hcl", label: "Dissertation" }]);
    jest.mocked(loadEsqExample).mockResolvedValue(response("esq-hcl-case-study", { ES: "example-es-hcl" }));
    jest.mocked(unloadEsqExample).mockResolvedValue(response("blank"));
    jest.mocked(listEsqLinkOptions).mockResolvedValue(NO_LINK_OPTIONS);
    jest.mocked(loadLinkedEs).mockResolvedValue(DISSERTATION_ES);
  });

  it("lists the project's workbooks and loads no linked workbook for a blank workbook", async () => {
    render(<EsqWorkbookPage />);
    expect(await screen.findByTestId("workbook")).toHaveTextContent("blank");
    await waitFor(() => expect(listEsqLinkOptions).toHaveBeenCalledWith("project"));
    expect(loadLinkedEs).not.toHaveBeenCalled();
    expect(screen.getByTestId("linked-es")).toHaveTextContent("No ES");
  });

  it("loads the example's linked workbooks after confirmation and drops them on unload", async () => {
    render(<EsqWorkbookPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Load example" }));
    expect(loadEsqExample).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Load dissertation" }));
    await waitFor(() => expect(screen.getByTestId("linked-es")).toHaveTextContent("Dissertation ES"));
    expect(loadEsqExample).toHaveBeenCalledWith("new-esq", "hcl");
    expect(loadLinkedEs).toHaveBeenCalledWith("example-es-hcl");
    fireEvent.click(screen.getByRole("button", { name: "Unload example" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm unload" }));
    await waitFor(() => expect(screen.getByTestId("linked-es")).toHaveTextContent("No ES"));
    expect(screen.getByTestId("workbook")).toHaveTextContent("blank");
  });

  it("does not show the previous workbook while another loads", async () => {
    jest.mocked(getEsqWorkbook).mockResolvedValueOnce(response("esq-hcl-case-study", { ES: "example-es-hcl" }));
    const { rerender } = render(<EsqWorkbookPage />);
    await waitFor(() => expect(screen.getByTestId("linked-es")).toHaveTextContent("Dissertation ES"));
    let finish!: (value: EsqWorkbookResponse) => void;
    jest.mocked(getEsqWorkbook).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    mockWorkbookId = "another-esq";
    rerender(<EsqWorkbookPage />);
    expect(screen.queryByTestId("workbook")).not.toBeInTheDocument();
    expect(screen.getByText("Loading workbook…")).toBeInTheDocument();
    await act(async () => { finish(response("another-blank")); });
    expect(screen.getByTestId("workbook")).toHaveTextContent("another-blank");
    expect(screen.getByTestId("linked-es")).toHaveTextContent("No ES");
  });

  it("ignores a linked workbook that arrives after unloading", async () => {
    let finish!: (value: EventSequenceAnalysis) => void;
    jest.mocked(loadLinkedEs).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    jest.mocked(getEsqWorkbook).mockResolvedValueOnce(response("esq-hcl-case-study", { ES: "example-es-hcl" }));
    render(<EsqWorkbookPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Unload example" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm unload" }));
    await waitFor(() => expect(screen.getByTestId("workbook")).toHaveTextContent("blank"));
    await act(async () => { finish(DISSERTATION_ES); });
    expect(screen.getByTestId("linked-es")).toHaveTextContent("No ES");
  });
});
