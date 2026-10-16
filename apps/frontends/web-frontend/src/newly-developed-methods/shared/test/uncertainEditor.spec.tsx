import { fireEvent, render, screen } from "@testing-library/react";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { ExpressionEditor, LawEditor, type ParameterOption } from "../uncertainEditor";
import { lawText } from "../uncertainText";

const reference = { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-IE-01" } as const;
const OPTION: ParameterOption = { reference, label: "DA-IE-01 in Plant DA", unit: "PER_YEAR" };
const LINKED: UncertainExpression = { node: "PARAMETER", reference };
const COMPOSED: UncertainExpression = {
  node: "OPERATION",
  operation: "MULTIPLY",
  operands: [LINKED, { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 2 } } }],
};

function renderEditor(expression: UncertainExpression, options: readonly ParameterOption[] = []) {
  const onChange = jest.fn<void, [UncertainExpression]>();
  render(<ExpressionEditor expression={expression} unit="PER_YEAR" options={options} disabled={false} onChange={onChange} />);
  return onChange;
}

describe("ExpressionEditor slots", () => {
  it("shows the selected link of a parameter expression", () => {
    renderEditor(LINKED, [OPTION]);
    const source = screen.getByLabelText<HTMLSelectElement>("Source");
    expect(source.value).toBe("da-1:DA-IE-01");
    expect(source.selectedOptions[0]?.textContent).toBe("DA-IE-01 in Plant DA");
    expect(screen.queryByLabelText("Law")).not.toBeInTheDocument();
  });

  it("shows a link that is not among the options instead of an empty box", () => {
    const onChange = renderEditor(LINKED);
    const source = screen.getByLabelText<HTMLSelectElement>("Source");
    expect(source.selectedOptions[0]?.textContent).toBe("DA-IE-01 in da-1");
    fireEvent.change(source, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.01 } } });
  });

  it("says a composed expression is composed and invents no point", () => {
    const onChange = renderEditor(COMPOSED, [OPTION]);
    const source = screen.getByLabelText<HTMLSelectElement>("Source");
    expect(source.selectedOptions[0]?.textContent).toBe("Composed");
    expect(screen.getByText("Composed: (DA-IE-01 in Plant DA × 2)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Law")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
    fireEvent.change(source, { target: { value: "da-1:DA-IE-01" } });
    expect(onChange).toHaveBeenCalledWith(LINKED);
  });
});

describe("updated laws", () => {
  it("names the new evidence and families and keeps them out of hand edits", () => {
    expect(lawText({ family: "POSTERIOR", prior: null, evidence: [{ likelihood: "STANDBY_DEMAND", demand: "TEST", failures: 1, exposure: 10, testInterval: 720 }] }))
      .toBe("Jeffreys posterior with 1 failure in 10 tests every 720 h");
    expect(lawText({ family: "DURATION", model: "LOGNORMAL", times: [2, 5], censored: [9], priors: [], output: { kind: "EXCEEDANCE", time: 8 } }))
      .toBe("Lognormal durations (2 completed, 1 still open): chance of lasting past 8 h");
    render(<LawEditor law={{ family: "TREND", bins: [{ time: 1, failures: 2, exposure: 1 }, { time: 2, failures: 3, exposure: 1 }], at: 3 }} unit="PER_YEAR" disabled={false} onChange={jest.fn()} />);
    expect(screen.getByLabelText<HTMLSelectElement>("Law")).toBeDisabled();
  });
});
