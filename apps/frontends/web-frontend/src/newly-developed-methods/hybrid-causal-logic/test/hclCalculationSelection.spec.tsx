import { fireEvent, render, screen } from "@testing-library/react";
import type { WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import { stringifyJson } from "interfaces-shared-types/json";
import { HclBindingEditor } from "../hclBindingEditor";
import { HclUncertaintyReview } from "../hclUncertaintyReview";
import { TEST_ID, testBayesianNetworkModel } from "../../bayesian-network/test/bayesianNetworkTestModel";

const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const valid = { sampleCount: 10, seed: 42, sampler: "MC", basicEvents: [], cptRows: [], cptGenerators: [] };
const retired = { sampleCount: 10, seed: 42, sampler: "MC", basicEventDistributions: [], cptRowDistributions: [], cptProbabilityClipEpsilon: 0 };
const configuration: WorkbookHclConfiguration = {
  modelId: id(1), code: "HCL", name: "HCL", description: "",
  bayesianNetwork: { workbookId: "esq", modelId: TEST_ID.model },
  faultTrees: [{ workbookId: "sy", modelId: id(2) }],
  bindings: [], baseEvidence: { observations: [] },
  evidenceScenarios: [{ id: id(3), code: "ROW", name: "Row", enabled: true, evidence: { observations: [] } }],
  solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
};
const tree = { workbookId: "sy", workbookName: "Systems", modelId: id(2), modelCode: "FT", modelName: "FT", topGateId: id(4), basicEvents: [] };

it.each([null, "legacy", [], {}, { ...valid, sampler: "BAD" }, { ...valid, basicEvents: null }, retired])(
  "holds saved draft %j for review without using or changing it", (uncertainty) => {
    const conf = { ...configuration, solverSettings: { ...configuration.solverSettings, uncertainty } };
    const before = structuredClone(conf);
    const onChange = jest.fn();
    render(
      <HclBindingEditor
        model={testBayesianNetworkModel()}
        editable
        workbookId="esq"
        configurations={[conf]}
        faultTreeOptions={[tree]}
        baseEvidence={{ observations: [] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Configuration" }));
    expect(screen.getByText("Uncertainty", { selector: "summary" })).toHaveTextContent("Uncertainty Needs review");
    expect(screen.getByRole("status")).toHaveTextContent("Saved uncertainty settings need review. Probability calculations can still run.");
    expect(screen.getByRole("textbox", { name: "Saved uncertainty settings" })).toHaveValue(stringifyJson(uncertainty, 2));
    expect(screen.queryByRole("button", { name: "Enable uncertainty" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disable uncertainty" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "CPT row uncertainty" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(conf).toEqual(before);
  },
);

it("saves reviewed settings in the configuration and then shows the uncertainty laws", () => {
  const conf = { ...configuration, solverSettings: { ...configuration.solverSettings, uncertainty: retired } };
  const onChange = jest.fn();
  const view = (configurations: WorkbookHclConfiguration[]) => (
    <HclBindingEditor
      model={testBayesianNetworkModel()}
      editable
      workbookId="esq"
      configurations={configurations}
      faultTreeOptions={[tree]}
      baseEvidence={{ observations: [] }}
      onChange={onChange}
    />
  );
  const { rerender } = render(view([conf]));
  fireEvent.click(screen.getByRole("button", { name: "Configuration" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Saved uncertainty settings" }), { target: { value: JSON.stringify(valid) } });
  fireEvent.click(screen.getByRole("button", { name: "Apply reviewed settings" }));
  expect(onChange).toHaveBeenCalledWith([{ ...conf, solverSettings: { ...configuration.solverSettings, uncertainty: valid } }]);
  rerender(view(onChange.mock.calls[0]?.[0]));
  expect(screen.getByText("Uncertainty", { selector: "summary" })).toHaveTextContent("Uncertainty On");
  expect(screen.getByRole("region", { name: "CPT row uncertainty" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Basic event uncertainty" })).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Saved uncertainty settings" })).not.toBeInTheDocument();
});

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
