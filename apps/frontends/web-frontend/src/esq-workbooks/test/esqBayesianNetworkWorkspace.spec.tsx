import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { EsqBayesianNetworkWorkspace } from "../esqBayesianNetworkWorkspace";

const emptyQuantification = {
  bayesianNetworks: [],
  hclConfigurations: [],
} as unknown as EventSequenceQuantification;

const mockMutateEsq = jest.fn();

jest.mock("../esqWorkbookContext", () => ({
  useEsqWorkbook: () => ({
    esq: emptyQuantification,
    editable: true,
    mutateEsq: mockMutateEsq,
    runtime: { workbookId: null, projectId: null, revision: null },
  }),
}));

describe("Event Sequence Quantification Bayesian-network workspace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows only the heading and create action when no network exists", async () => {
    render(<EsqBayesianNetworkWorkspace />);

    expect(await screen.findByRole("button", { name: "Add network" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Event-tree Bayesian dependency network" })).toBeInTheDocument();
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
});
