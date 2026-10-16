import type { JSX } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Law, UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { expressionText } from "../../shared/uncertainText";
import { FrequencyLawField } from "../frequencyLawField";

const UPDATED: readonly Law[] = [
  { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures: 2, exposure: 10 }] },
  { family: "POPULATION", mu: { family: "NORMAL", mean: -5, standardDeviation: 1 }, sigma: { family: "UNIFORM", lower: 0.1, upper: 2 }, upper: null, evidence: [{ likelihood: "POISSON", failures: 1, exposure: 10 }], target: null },
  { family: "EMPIRICAL_BAYES", evidence: [{ likelihood: "POISSON", failures: 1, exposure: 10 }, { likelihood: "POISSON", failures: 3, exposure: 12 }], target: null },
  { family: "DURATION", model: "EXPONENTIAL", times: [2, 5], censored: [], priors: [], output: { kind: "MEAN" } },
  { family: "TREND", bins: [{ time: 1, failures: 2, exposure: 1 }, { time: 2, failures: 1, exposure: 1 }], at: 2 },
];

function field(law: Law, onChange: (expression: UncertainExpression) => void): JSX.Element {
  return <FrequencyLawField expression={{ node: "VALUE", value: { unit: "PER_YEAR", law } }} mean={0.1} describe={(expression) => expressionText(expression)} editable addLabel="Add a frequency" onChange={onChange} />;
}

describe("FrequencyLawField", () => {
  it.each(UPDATED.map((law) => [law.family, law] as const))("describes a %s frequency and offers to type a law", (_, law) => {
    const onChange = jest.fn();
    render(field(law, onChange));
    expect(screen.queryByLabelText("Law")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Type a law instead" }));
    expect(onChange).toHaveBeenCalledWith({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.1 } } });
  });

  it("edits a typed product frequency in the law editor", () => {
    render(field({ family: "PRODUCT", factors: [{ family: "POINT", value: 0.1 }, { family: "POINT", value: 2 }] }, jest.fn()));
    expect(screen.queryByRole("button", { name: "Type a law instead" })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Law")[0]).toHaveValue("PRODUCT");
  });
});
