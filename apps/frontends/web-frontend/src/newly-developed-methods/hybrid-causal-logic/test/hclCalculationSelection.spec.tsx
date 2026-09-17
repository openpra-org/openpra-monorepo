import { fireEvent, render, screen } from "@testing-library/react";
import type { WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import { stringifyJson } from "interfaces-shared-types/json";
import { ToastProvider } from "../../../toast/toastProvider";
import { HclBindingEditor } from "../hclBindingEditor";
import { HclUncertaintyReview } from "../hclUncertaintyReview";
import { TEST_ID, testBayesianNetworkModel } from "../../bayesian-network/test/bayesianNetworkTestModel";

const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const valid = { sampleCount: 10, seed: 42, sampler: "MC", basicEventDistributions: [], cptRowDistributions: [] };
const configuration: WorkbookHclConfiguration = {
  modelId: id(1), code: "HCL", name: "HCL", description: "",
  bayesianNetwork: { workbookId: "esq", modelId: TEST_ID.model },
  faultTrees: [{ workbookId: "sy", modelId: id(2) }],
  bindings: [], baseEvidence: { observations: [] },
  evidenceScenarios: [{ id: id(3), code: "ROW", name: "Row", enabled: true, evidence: { observations: [] } }],
  solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
};
const tree = { workbookId: "sy", workbookName: "Systems", modelId: id(2), modelCode: "FT", modelName: "FT", topGateId: id(4), basicEvents: [] };

it.each([null, "legacy", [], {}, { ...valid, sampler: "BAD" }, { ...valid, basicEventDistributions: null }])(
  "allows point runs and blocks uncertainty without changing saved draft %j", (uncertainty) => {
    const conf = { ...configuration, solverSettings: { ...configuration.solverSettings, uncertainty } };
    const before = structuredClone(conf), onChange = jest.fn(), onRun = jest.fn();
    const view = (type: "PROBABILITY" | "UNCERTAINTY", batch = false) => <ToastProvider><HclBindingEditor
      model={testBayesianNetworkModel()} editable workbookId="esq" configurations={[conf]}
      scope="FAULT_TREE" faultTreeOptions={[tree]} eventTreeOptions={[]} baseEvidence={{ observations: [] }}
      validation={[]} running={false} runError={null} runResult={null} batchRunResult={null}
      calculationType={type} workflow={batch ? "BATCH" : "MANUAL"} onChange={onChange}
      onRunFaultTree={onRun} onRunEventTree={onRun} onRunFaultTreeBatch={onRun} onRunEventTreeBatch={onRun}
    /></ToastProvider>;
    const { rerender } = render(view("PROBABILITY"));
    fireEvent.click(screen.getByRole("button", { name: "Run probability", exact: true }));
    expect(onRun).toHaveBeenCalledTimes(1);
    rerender(view("PROBABILITY", true));
    fireEvent.click(screen.getByRole("button", { name: "Run probability batch", exact: true }));
    expect(onRun).toHaveBeenCalledTimes(2);
    rerender(view("UNCERTAINTY"));
    expect(screen.getByRole("button", { name: "Run uncertainty", exact: true })).toBeDisabled();
    expect(screen.getByText(/Uncertainty settings need review:/)).toBeInTheDocument();
    rerender(view("UNCERTAINTY", true));
    expect(screen.getByRole("button", { name: "Run uncertainty batch", exact: true })).toBeDisabled();
    rerender(view("PROBABILITY"));
    expect(screen.getByRole("button", { name: "Run probability", exact: true })).toBeEnabled();
    expect(onChange).not.toHaveBeenCalled();
    expect(conf).toEqual(before);
  },
);

it("keeps invalid JSON until explicit correction and preserves null/signed-zero draft data", () => {
  const value = { old: null, zero: -0 }, onChange = jest.fn();
  render(<HclUncertaintyReview value={value} disabled={false} onChange={onChange} />);
  const input = screen.getByRole("textbox", { name: "Saved uncertainty settings" });
  expect(input).toHaveValue(stringifyJson(value, 2));
  fireEvent.change(input, { target: { value: "{" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply reviewed settings" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: JSON.stringify(valid) } });
  fireEvent.click(screen.getByRole("button", { name: "Apply reviewed settings" }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining(valid));
  expect(Object.is(value.zero, -0)).toBe(true);
});

it("refreshes externally replaced drafts and prevents edits in read-only mode", () => {
  const onChange = jest.fn();
  const { rerender } = render(<HclUncertaintyReview value={null} disabled={false} onChange={onChange} />);
  rerender(<HclUncertaintyReview value={{ old: true }} disabled onChange={onChange} />);
  expect(screen.getByRole("textbox", { name: "Saved uncertainty settings" })).toHaveValue(stringifyJson({ old: true }, 2));
  expect(screen.getByRole("textbox", { name: "Saved uncertainty settings" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Apply reviewed settings" }));
  expect(onChange).not.toHaveBeenCalled();
});
