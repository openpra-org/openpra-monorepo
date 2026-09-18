import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { EsqBayesianNetworkWorkspace } from "../esqBayesianNetworkWorkspace";
import { createEmptyBayesianNetwork } from "../../newly-developed-methods/bayesian-network";
import { listWorkbooks } from "../../workbooks/workbookApi";
import { getSyWorkbook } from "../../sy-workbooks/syWorkbookApi";
import { getEsWorkbook } from "../../es-workbooks/esWorkbookApi";
import type { EsqWorkbookRuntime } from "../esqWorkbookContext";

const emptyQuantification = {
  uuid: "blank-esq",
  bayesianNetworks: [],
  hclConfigurations: [],
} as unknown as EventSequenceQuantification;

const mockMutateEsq = jest.fn();
let mockEsq = emptyQuantification;
let mockRuntime: EsqWorkbookRuntime = { workbookId: null, projectId: null, revision: null, saveStatus: "saved" };

jest.mock("../../workbooks/workbookApi", () => ({ listWorkbooks: jest.fn() }));
jest.mock("../../sy-workbooks/syWorkbookApi", () => ({ getSyWorkbook: jest.fn() }));
jest.mock("../../es-workbooks/esWorkbookApi", () => ({ getEsWorkbook: jest.fn() }));
jest.mock("../../newly-developed-methods/bayesian-network", () => ({
  ...jest.requireActual("../../newly-developed-methods/bayesian-network"),
  BayesianNetworkEditor: ({ model }: { model: { name: string } }) => <section data-testid="dependency-network">{model.name}</section>,
}));

jest.mock("../esqWorkbookContext", () => ({
  useEsqWorkbook: () => ({
    esq: mockEsq,
    editable: true,
    mutateEsq: mockMutateEsq,
    runtime: mockRuntime,
  }),
}));

describe("Event Sequence Quantification Bayesian-network workspace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEsq = emptyQuantification;
    mockRuntime = { workbookId: null, projectId: null, revision: null, saveStatus: "saved" };
  });

  it("shows only the heading and create action when no network exists", async () => {
    render(<EsqBayesianNetworkWorkspace />);

    const addNetwork = await screen.findByRole("button", { name: "Add network" });
    expect(addNetwork).toBeInTheDocument();
    expect(addNetwork.parentElement).toHaveClass("bneditor__network-head");
    expect(screen.getByRole("heading", { name: "Bayesian dependency network" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^About / })).not.toBeInTheDocument();
    expect(screen.queryByText(/No Bayesian dependency network is available/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Immutable analysis runs" })).not.toBeInTheDocument();
  });

  it("creates an empty ESQ network from the clean empty state", async () => {
    render(<EsqBayesianNetworkWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: "Add network" }));

    await waitFor(() => expect(mockMutateEsq).toHaveBeenCalledTimes(1));
    const mutate = mockMutateEsq.mock.calls[0]?.[0] as (
      current: EventSequenceQuantification,
    ) => EventSequenceQuantification;
    expect(mutate(emptyQuantification).bayesianNetworks).toHaveLength(1);
  });

  function projectWithDissertation() {
    const network = createEmptyBayesianNetwork("Dissertation network");
    const configuration = {
      modelId: "source-hcl",
      code: "Dissertation HCL",
      bayesianNetwork: { workbookId: "source-sy", modelId: network.modelId },
      faultTrees: [{ workbookId: "source-sy", modelId: "source-ft" }],
      baseEvidence: { observations: [] },
      bindings: [],
    };
    mockRuntime = { workbookId: "new-esq", projectId: "project", revision: 0, saveStatus: "saved" };
    jest.mocked(listWorkbooks).mockImplementation(async (_project, element) => ({
      workbooks: [{ id: element === "SY" ? "source-sy" : "source-es", name: "Dissertation" }],
    }) as Awaited<ReturnType<typeof listWorkbooks>>);
    jest.mocked(getSyWorkbook).mockResolvedValue({ mef: {
      systemLogicModels: [{ uuid: "source-ft", code: "FT", name: "Source FT", leafNodes: [], topGate: null }],
      systemBasicEvents: [],
      dependencyBayesianNetworks: [network],
      dependencyHclConfigurations: [configuration],
    } } as unknown as Awaited<ReturnType<typeof getSyWorkbook>>);
    jest.mocked(getEsWorkbook).mockResolvedValue({ mef: { eventTrees: [{
      uuid: "source-et", name: "Source ET", sequences: {}, functionalEvents: {
        failure: { uuid: "failure", name: "Failure", faultTreeTopEvent: { workbookId: "source-sy", modelId: "source-ft", entityId: "top" } },
      },
    }] } } as unknown as Awaited<ReturnType<typeof getEsWorkbook>>);
    return { network, configuration };
  }

  it("does not display an existing project case until its configuration is selected", async () => {
    projectWithDissertation();
    render(<EsqBayesianNetworkWorkspace />);
    const select = await screen.findByLabelText("Dependency configuration");
    expect(select).toHaveValue("");
    expect(screen.queryByTestId("dependency-network")).not.toBeInTheDocument();
    const addNetwork = screen.getByRole("button", { name: "Add network" });
    const actions = select.closest(".esqbn__network-actions");
    expect(actions).toContainElement(addNetwork);
    expect(actions?.lastElementChild).toBe(addNetwork);
    expect(mockMutateEsq).not.toHaveBeenCalled();

    fireEvent.change(select, { target: { value: "SY:source-sy:source-hcl" } });
    expect(screen.getByTestId("dependency-network")).toHaveTextContent("Dissertation network");
    expect(mockMutateEsq).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: "" } });
    expect(screen.queryByTestId("dependency-network")).not.toBeInTheDocument();
  });

  it("does not carry an external selection into another workbook", async () => {
    projectWithDissertation();
    const { rerender } = render(<EsqBayesianNetworkWorkspace />);
    fireEvent.change(await screen.findByLabelText("Dependency configuration"), { target: { value: "SY:source-sy:source-hcl" } });
    expect(screen.getByTestId("dependency-network")).toBeInTheDocument();
    mockRuntime = { ...mockRuntime, workbookId: "another-esq" };
    mockEsq = { ...emptyQuantification, uuid: "another-blank" };
    rerender(<EsqBayesianNetworkWorkspace />);
    expect(screen.queryByTestId("dependency-network")).not.toBeInTheDocument();
  });

  it("displays an explicitly loaded local case before unrelated project cases and clears it on unload", async () => {
    const { network, configuration } = projectWithDissertation();
    mockEsq = { ...emptyQuantification, uuid: "esq-hcl-case-study", bayesianNetworks: [{ ...network, name: "Loaded dissertation" }], hclConfigurations: [configuration] } as unknown as EventSequenceQuantification;
    const { rerender } = render(<EsqBayesianNetworkWorkspace />);
    expect(await screen.findByLabelText("Dependency configuration")).toHaveValue("ESQ:new-esq:source-hcl");
    expect(screen.getByTestId("dependency-network")).toHaveTextContent("Loaded dissertation");
    fireEvent.change(screen.getByLabelText("Dependency configuration"), { target: { value: "SY:source-sy:source-hcl" } });
    mockEsq = emptyQuantification;
    rerender(<EsqBayesianNetworkWorkspace />);
    expect(screen.queryByTestId("dependency-network")).not.toBeInTheDocument();
  });

  it("lists an unconfigured SY network without selecting it automatically", async () => {
    const { network } = projectWithDissertation();
    jest.mocked(getEsWorkbook).mockResolvedValue({ mef: { eventTrees: [] } } as unknown as Awaited<ReturnType<typeof getEsWorkbook>>);
    render(<EsqBayesianNetworkWorkspace />);
    await screen.findByRole("button", { name: "Add network" });
    expect(screen.queryByTestId("dependency-network")).not.toBeInTheDocument();
    const select = screen.getByLabelText("Dependency configuration");
    expect(screen.getByRole("option", { name: /Dissertation · .*network only/ })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: `NETWORK:SY:source-sy:${network.modelId}` } });
    expect(screen.getByTestId("dependency-network")).toHaveTextContent("Dissertation network");
  });
});
