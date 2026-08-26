import { fireEvent, render, screen } from "@testing-library/react";
import { type JSX, useState } from "react";
import type { WorkbookBayesianNetwork } from "interfaces-mef-types/modeling";
import { WorkbookBayesianNetworkCollectionEditor } from "../hazardConditionedModelEditors";

const MOCK_EMPTY_NETWORK: WorkbookBayesianNetwork = {
  modelId: "10000000-0000-4000-8000-000000000001",
  code: "BN-1",
  name: "Dependency network",
  description: "",
  nodes: [],
  edges: [],
  conditionalProbabilityTables: [],
  nodePositions: [],
  layout: {
    viewport: { x: 0, y: 0, zoom: 1 },
    mode: "MANUAL",
    direction: "LEFT_TO_RIGHT",
  },
};

jest.mock("../../newly-developed-methods/fault-tree", () => ({
  FaultTreeEditor: () => null,
  applyFaultTreeOperation: jest.fn(),
}));

jest.mock("../../newly-developed-methods/event-tree", () => ({
  EventTreeEditor: () => null,
  applyEventTreeOperation: jest.fn(),
  createEmptyEventTree: jest.fn(),
  validateEventTree: jest.fn(() => []),
}));

jest.mock("../../newly-developed-methods/bayesian-network", () => ({
  createEmptyBayesianNetwork: jest.fn(() => JSON.parse(JSON.stringify(MOCK_EMPTY_NETWORK))),
  BayesianNetworkEditor: ({ model, onModelChange }: {
    model: WorkbookBayesianNetwork;
    onModelChange: (model: WorkbookBayesianNetwork) => void;
  }) => (
    <div aria-label="Mock Bayesian network editor">
      <span>{model.name}</span>
      <button type="button" onClick={() => onModelChange({ ...model, name: "Updated dependency network" })}>Update network</button>
    </div>
  ),
}));

function Harness({ initial = [] }: { initial?: WorkbookBayesianNetwork[] }): JSX.Element {
  const [networks, setNetworks] = useState(initial);
  return (
    <WorkbookBayesianNetworkCollectionEditor
      networks={networks}
      editable
      onChange={setNetworks}
    />
  );
}

describe("WorkbookBayesianNetworkCollectionEditor", () => {
  it("creates, edits, and deletes workbook-owned dependency networks", () => {
    render(<Harness />);
    expect(screen.getByText("No dependency Bayesian network yet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add model" }));
    expect(screen.getByLabelText("Mock Bayesian network editor")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "BN-1 · Dependency network" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Update network" }));
    expect(screen.getByText("Updated dependency network")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "BN-1 · Updated dependency network" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete model" }));
    expect(screen.getByText("No dependency Bayesian network yet")).toBeInTheDocument();
  });
});
