import { fireEvent, render, screen } from "@testing-library/react";
import type { HclBasicEventProbabilityDistribution, HclSampler } from "interfaces-mef-types/modeling";
import { HclDistributionParameters } from "../hclUncertaintyControls";

it.each([
  ["MC", { family: "NORMAL", mean: .3, standardDeviation: .1 }, "Standard deviation", "0", true],
  ["LHS", { family: "NORMAL", mean: .3, standardDeviation: .1 }, "Standard deviation", "0", false],
  ["MC", { family: "LOGNORMAL", median: .2, errorFactor: 2 }, "Error factor", "1", true],
  ["LHS", { family: "LOGNORMAL", median: .2, errorFactor: 2 }, "Error factor", "1", false],
  ["MC", { family: "LOGNORMAL", median: .2, errorFactor: 2 }, "Median", "2", true],
  ["MC", { family: "UNIFORM", lower: 0, upper: 1 }, "Lower", "-2", true],
  ["MC", { family: "UNIFORM", lower: 0, upper: 1 }, "Upper", "0", true],
  ["MC", { family: "UNIFORM", lower: 0, upper: 1 }, "Upper", "-1", false],
  ["LHS", { family: "UNIFORM", lower: 0, upper: 1 }, "Upper", "-1", true],
  ["MC", { family: "LOGITNORMAL", mu: -2, sigma: .5 }, "Logit standard deviation", "0", true],
  ["LHS", { family: "LOGITNORMAL", mu: -2, sigma: .5 }, "Logit standard deviation", "0", false],
  ["MC", { family: "BETA", alpha: 2, beta: 8 }, "Alpha", "0.0000001", true],
] as [HclSampler, HclBasicEventProbabilityDistribution, string, string, boolean][])(
  "%s editing %j %s=%s follows source domain", (sampler, distribution, label, value, accepted) => {
    const onChange = jest.fn(), onError = jest.fn();
    render(<HclDistributionParameters distribution={distribution} sampler={sampler} disabled={false} onChange={onChange} onError={onError} />);
    const input = screen.getByRole("spinbutton", { name: label });
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(accepted ? 1 : 0);
    expect(onError).toHaveBeenCalledTimes(accepted ? 0 : 1);
    if (accepted) expect((input as HTMLInputElement).checkValidity()).toBe(true);
  },
);
