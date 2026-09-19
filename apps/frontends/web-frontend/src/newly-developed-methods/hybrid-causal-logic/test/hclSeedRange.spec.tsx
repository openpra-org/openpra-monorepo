import { fireEvent, render, screen } from "@testing-library/react";
import type { WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import { ToastProvider } from "../../../toast/toastProvider";
import { HclBindingEditor } from "../hclBindingEditor";
import { TEST_ID, testBayesianNetworkModel } from "../../bayesian-network/test/bayesianNetworkTestModel";

const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const configuration: WorkbookHclConfiguration = {
  modelId: id(1), code: "HCL", name: "HCL", description: "",
  bayesianNetwork: { workbookId: "esq", modelId: TEST_ID.model },
  faultTrees: [{ workbookId: "sy", modelId: id(2) }], bindings: [], baseEvidence: { observations: [] },
  solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true,
    uncertainty: { sampleCount: 31, seed: 42, sampler: "MC", basicEventDistributions: [], cptRowDistributions: [] } },
};
const tree = { workbookId: "sy", workbookName: "Systems", modelId: id(2), modelCode: "FT", modelName: "FT", topGateId: id(3), basicEvents: [] };

it.each([
  ["0", true], ["4294967295", true], ["4294967296", true], ["4294967297", true],
  ["9007199254740990", true], ["9007199254740991", true],
  ["9007199254740992", false], ["9007199254740993", false], ["-1", false], ["1.5", false], ["", false],
])("edits seed %s without truncation or unsafe rounding", (value, accepted) => {
  const onChange = jest.fn();
  render(<ToastProvider><HclBindingEditor model={testBayesianNetworkModel()} editable workbookId="esq"
    configurations={[configuration]} faultTreeOptions={[tree]} eventTreeOptions={[]} scope="FAULT_TREE"
    baseEvidence={{ observations: [] }} validation={[]} running={false} runError={null} runResult={null}
    batchRunResult={null} calculationType="UNCERTAINTY" onChange={onChange}
    onRunFaultTree={jest.fn()} onRunEventTree={jest.fn()} /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Configuration", exact: true }));
  const input = screen.getByRole("spinbutton", { name: "Seed" });
  expect(input).toHaveAttribute("max", String(Number.MAX_SAFE_INTEGER));
  fireEvent.change(input, { target: { value } });fireEvent.blur(input);
  expect(onChange).toHaveBeenCalledTimes(accepted ? 1 : 0);
  if (accepted) {
    expect(onChange.mock.calls[0][0][0].solverSettings.uncertainty.seed).toBe(Number(value));
    expect((input as HTMLInputElement).checkValidity()).toBe(true);
  } else expect(screen.getByText(/Uncertainty seed must be a whole number from 0 to 9007199254740991/)).toBeInTheDocument();
});
