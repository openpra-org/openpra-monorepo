import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { HclCptPrior } from "interfaces-mef-types/modeling";
import { createCptPrior, HclCptPriorControls } from "../hclCptPriorControls";

const states = [
  { id: "123e4567-e89b-42d3-a456-426614174701", code: "FALSE" },
  { id: "123e4567-e89b-42d3-a456-426614174702", code: "TRUE" },
];
function Harness({ onChange, initial = createCptPrior(states), nodeStates = states }: {
  onChange: jest.Mock; initial?: HclCptPrior; nodeStates?: typeof states;
}) {
  const [prior, setPrior] = useState(initial);
  const [error, setError] = useState("");
  return <><HclCptPriorControls prior={prior} states={nodeStates} disabled={false} onChange={(value) => { setPrior(value); onChange(value); }} onError={setError} /><div role="alert">{error}</div></>;
}

it("edits explicit Beta parameters and the probability state", async () => {
  const user = userEvent.setup(); const changed = jest.fn();
  render(<Harness onChange={changed} />);
  await user.selectOptions(screen.getByLabelText("CPT prior"), "BETA");
  expect(changed).toHaveBeenLastCalledWith({ family: "BETA", alpha: 1, beta: 1, trueStateId: states[1]!.id });
  await user.selectOptions(screen.getByLabelText("Beta probability state"), states[0]!.id);
  const alpha = screen.getByLabelText("Alpha");
  await user.clear(alpha); await user.type(alpha, "2"); await user.tab();
  expect(changed).toHaveBeenLastCalledWith({ family: "BETA", alpha: 2, beta: 1, trueStateId: states[0]!.id });
  const beta = screen.getByLabelText("Beta");
  await user.clear(beta); await user.type(beta, "0"); await user.tab();
  expect(beta).toHaveValue(1);
  expect(screen.getByRole("alert")).not.toBeEmptyDOMElement();
});

it("edits multi-state Dirichlet parameters, preserving zeros and rejecting invalid rows", async () => {
  const user = userEvent.setup(); const changed = jest.fn();
  const nodeStates = [...states, { id: "123e4567-e89b-42d3-a456-426614174703", code: "DEGRADED" }];
  render(<Harness onChange={changed} nodeStates={nodeStates} initial={{ family: "DIRICHLET", alpha: [1, 0, 0] }} />);
  expect(screen.queryByRole("option", { name: "Beta" })).not.toBeInTheDocument();
  const alpha = screen.getByLabelText("Alpha for FALSE");
  await user.clear(alpha); await user.type(alpha, "0"); await user.tab();
  expect(alpha).toHaveValue(1); expect(changed).not.toHaveBeenCalled();
  const degraded = screen.getByLabelText("Alpha for DEGRADED");
  await user.clear(degraded); await user.type(degraded, "3"); await user.tab();
  expect(changed).toHaveBeenLastCalledWith({ family: "DIRICHLET", alpha: [1, 0, 3] });
});

it("requires deliberate replacement of an ESS-only saved row", async () => {
  const changed = jest.fn(); const user = userEvent.setup();
  render(<HclCptPriorControls prior={undefined} states={states} disabled={false} onChange={changed} onError={jest.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("explicit prior");
  expect(changed).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Set explicit prior" }));
  expect(changed).toHaveBeenCalledWith({ family: "DIRICHLET", alpha: [1, 1] });
});
