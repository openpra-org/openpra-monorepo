import { fireEvent, render, screen } from "@testing-library/react";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { createEmptyBayesianNetwork } from "../../newly-developed-methods/bayesian-network";
import { ToastProvider } from "../../toast/toastProvider";
import { SyBayesianNetworkWorkspace } from "../syBayesianNetworkWorkspace";

const emptyAnalysis = {
  dependencyBayesianNetworks: [],
  dependencyHclConfigurations: [],
  systemLogicModels: [],
  systemBasicEvents: [],
} as unknown as SystemsAnalysis;

const mockMutateSy = jest.fn();
let mockAnalysis = emptyAnalysis;

function renderWorkspace(): void {
  render(<ToastProvider><SyBayesianNetworkWorkspace /></ToastProvider>);
}

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => ({
    sy: mockAnalysis,
    editable: true,
    mutateSy: mockMutateSy,
    runtime: { workbookId: "sy-workbook", revision: 1, saveStatus: "saved" },
  }),
}));

describe("Systems Analysis Bayesian-network workspace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalysis = emptyAnalysis;
  });

  it("shows only the heading and create action when no network exists", () => {
    renderWorkspace();

    expect(screen.getByRole("heading", { name: "Bayesian dependency network" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add network" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^About / })).not.toBeInTheDocument();
    expect(screen.queryByText(/Own dependency networks/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No dependency Bayesian network exists/)).not.toBeInTheDocument();
  });

  it("creates an empty network from the clean empty state", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Add network" }));

    expect(mockMutateSy).toHaveBeenCalledTimes(1);
    const mutate = mockMutateSy.mock.calls[0]?.[0] as (current: SystemsAnalysis) => SystemsAnalysis;
    expect(mutate(emptyAnalysis).dependencyBayesianNetworks).toHaveLength(1);
  });

  it("marks the delete-network action for destructive hover styling", () => {
    mockAnalysis = {
      ...emptyAnalysis,
      dependencyBayesianNetworks: [createEmptyBayesianNetwork("Dependency network")],
    } as SystemsAnalysis;

    renderWorkspace();

    expect(screen.getByRole("button", { name: "Delete network" })).toHaveClass(
      "bneditor__network-delete",
    );
  });
});
