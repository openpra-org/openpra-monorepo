import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { UncertainExpression, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import type { HclUncertaintySettings } from "interfaces-mef-types/modeling";
import { HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling";
import { HclSeismicGeneratorControls } from "../hclSeismicGeneratorControls";
import { TEST_ID, testBayesianNetworkModel } from "../../bayesian-network/test/bayesianNetworkTestModel";
import { connectNodes } from "../../bayesian-network/bayesianNetworkOperations";

const model = connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b);
const empty: HclUncertaintySettings = { sampleCount: 513, seed: 42, sampler: "LHS", basicEvents: [], cptRows: [], cptGenerators: [] };

function point(unit: UncertainUnit, value: number): UncertainExpression {
  return { node: "VALUE", value: { unit, law: { family: "POINT", value } } };
}

function Harness({ changed, initial = empty, disabled = false }: { changed: jest.Mock; initial?: HclUncertaintySettings; disabled?: boolean }) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <HclSeismicGeneratorControls model={model} reference={{ workbookId: "esq", modelId: model.modelId }} settings={settings} disabled={disabled} onError={setError} onChange={(next) => { setSettings(next); changed(next); }} />
      <div role="alert">{error ?? ""}</div>
    </>
  );
}

function commit(input: HTMLElement, value: string): void {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

function slot(label: string): HTMLElement {
  return screen.getByRole("group", { name: label });
}

it("adds a fragility generator, edits the median law, randomness and demands, and keeps the shared sampler", () => {
  const changed = jest.fn();
  render(<Harness changed={changed} />);
  expect(screen.getByLabelText("Generator node")).toHaveValue(TEST_ID.b);
  fireEvent.click(screen.getByRole("button", { name: "Add generator" }));
  expect(changed.mock.lastCall[0].cptGenerators[0].generator).toEqual({
    kind: "SEISMIC_FRAGILITY",
    pgaParentId: TEST_ID.a,
    trueStateId: TEST_ID.bTrue,
    falseStateId: TEST_ID.bFalse,
    median: point("QUANTITY", 1),
    randomness: point("FACTOR", 1),
    demands: [{ stateId: TEST_ID.aFalse, demand: 0 }, { stateId: TEST_ID.aTrue, demand: 0 }],
  });
  fireEvent.click(screen.getByText("B · Seismic fragility"));

  commit(within(slot("Median capacity")).getByRole("textbox", { name: "Value" }), "0.9");
  fireEvent.change(within(slot("Median capacity")).getByRole("combobox", { name: "Law" }), { target: { value: "LOGNORMAL" } });
  commit(within(slot("Randomness, β R")).getByRole("textbox", { name: "Value" }), "0.35");
  commit(screen.getByRole("textbox", { name: "Demand at TRUE" }), "0.5");
  const saved: HclUncertaintySettings = changed.mock.lastCall[0];
  expect(saved).toMatchObject({
    sampler: "LHS",
    cptGenerators: [{ generator: {
      median: { node: "VALUE", value: { unit: "QUANTITY", law: { family: "LOGNORMAL", mean: 0.9, errorFactor: 3, level: 0.95 } } },
      randomness: point("FACTOR", 0.35),
      demands: [{ stateId: TEST_ID.aFalse, demand: 0 }, { stateId: TEST_ID.aTrue, demand: 0.5 }],
    } }],
  });
  expect(HclUncertaintySettingsSchema.safeParse(saved).success).toBe(true);

  const demand = screen.getByRole("textbox", { name: "Demand at FALSE" });
  commit(demand, "-1");
  expect(demand).toHaveValue("0");
  expect(screen.getByRole("alert")).not.toBeEmptyDOMElement();

  fireEvent.change(screen.getByLabelText("Failure state"), { target: { value: TEST_ID.bFalse } });
  expect(changed.mock.lastCall[0].cptGenerators[0].generator).toMatchObject({ trueStateId: TEST_ID.bFalse, falseStateId: TEST_ID.bTrue });
  expect(screen.getByRole("alert")).toBeEmptyDOMElement();
});

it("adds root PGA bins, edits frequencies, mission time and conversion, and deletes the generator", () => {
  const changed = jest.fn();
  render(<Harness changed={changed} />);
  fireEvent.change(screen.getByLabelText("Generator"), { target: { value: "SEISMIC_PGA_BINS" } });
  expect(screen.getByLabelText("Generator node")).toHaveValue(TEST_ID.a);
  fireEvent.click(screen.getByRole("button", { name: "Add generator" }));
  fireEvent.click(screen.getByText("A · PGA bins"));
  fireEvent.change(screen.getByLabelText("Frequency conversion"), { target: { value: "LINEAR" } });
  commit(within(slot("Frequency of TRUE")).getByRole("textbox", { name: "Value" }), "0.01");
  fireEvent.change(within(slot("Frequency of TRUE")).getByRole("combobox", { name: "Law" }), { target: { value: "LOGNORMAL" } });
  commit(within(slot("Mission time")).getByRole("textbox", { name: "Value" }), "0.5");
  const saved: HclUncertaintySettings = changed.mock.lastCall[0];
  expect(saved.cptGenerators[0]?.generator).toEqual({
    kind: "SEISMIC_PGA_BINS",
    noneStateId: TEST_ID.aFalse,
    missionTime: point("YEARS", 0.5),
    conversion: "LINEAR",
    bins: [{ stateId: TEST_ID.aTrue, frequency: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 0.01, errorFactor: 3, level: 0.95 } } } }],
  });
  expect(HclUncertaintySettingsSchema.safeParse(saved).success).toBe(true);

  fireEvent.change(screen.getByLabelText("No-earthquake state"), { target: { value: TEST_ID.aTrue } });
  expect(changed.mock.lastCall[0].cptGenerators[0].generator.bins).toEqual([{ stateId: TEST_ID.aFalse, frequency: point("PER_YEAR", 0) }]);
  fireEvent.click(screen.getByRole("button", { name: "Delete generator" }));
  expect(changed.mock.lastCall[0].cptGenerators).toEqual([]);
});

it("excludes nodes already using row laws", () => {
  render(<Harness changed={jest.fn()} initial={{
    ...empty,
    cptRows: [{
      bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: "esq", modelId: model.modelId, entityId: TEST_ID.b },
      cptRowId: TEST_ID.bRow,
      row: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [1, 1] } },
    }],
  }} />);
  expect(screen.getByRole("button", { name: "Add generator" })).toBeDisabled();
});

it("does not offer mutations in read-only mode", () => {
  render(<Harness changed={jest.fn()} disabled />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
