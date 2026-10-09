import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { HclUncertaintySettings } from "interfaces-mef-types/modeling";
import { HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { HclCptRowControls, cptRowVector, rowChoices } from "../hclCptPriorControls";
import { TEST_ID, testBayesianNetworkModel } from "../../bayesian-network/test/bayesianNetworkTestModel";

const model = testBayesianNetworkModel();
const reference = { workbookId: "esq", modelId: model.modelId };
const empty: HclUncertaintySettings = { sampleCount: 100, seed: 7, sampler: "LHS", basicEvents: [], cptRows: [], cptGenerators: [] };

function Harness({ changed, initial = empty, network = model, editable = true }: { changed: jest.Mock; initial?: HclUncertaintySettings; network?: BayesianNetworkModel; editable?: boolean }): JSX.Element {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <HclCptRowControls model={network} reference={reference} settings={settings} editable={editable} onError={setError} onChange={(next) => { setSettings(next); changed(next); }} />
      <div role="alert">{error ?? ""}</div>
    </>
  );
}

function commit(input: HTMLElement, value: string): void {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

it("starts a row law at the CPT row in the node's state order and edits it as a Dirichlet law", () => {
  const changed = jest.fn();
  render(<Harness changed={changed} />);
  expect(screen.getByRole("combobox", { name: "Uncertain CPT row" })).toHaveValue(`${TEST_ID.a}:${TEST_ID.aRow}`);
  fireEvent.click(screen.getByRole("button", { name: "Add row law" }));
  const added: HclUncertaintySettings = changed.mock.lastCall[0];
  expect(added.cptRows).toEqual([{
    bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: "esq", modelId: model.modelId, entityId: TEST_ID.a },
    cptRowId: TEST_ID.aRow,
    row: { node: "VALUE", law: { family: "FIXED", values: [0.8, 0.2] } },
  }]);
  expect(HclUncertaintySettingsSchema.safeParse(added).success).toBe(true);

  fireEvent.click(screen.getByText("Configured CPT rows"));
  const item = screen.getByText("A · prior").closest("details");
  expect(item).not.toBeNull();
  const row = within(item!);
  expect(row.getByRole("textbox", { name: "False" })).toHaveValue("0.8");
  expect(row.getByRole("textbox", { name: "True" })).toHaveValue("0.2");
  commit(row.getByRole("textbox", { name: "False" }), "0.9");
  expect(changed).toHaveBeenCalledTimes(1);

  fireEvent.change(row.getByRole("combobox", { name: "Law" }), { target: { value: "DIRICHLET" } });
  expect(changed.mock.lastCall[0].cptRows[0].row).toEqual({ node: "VALUE", law: { family: "DIRICHLET", concentrations: [8, 2] } });
  commit(row.getByRole("textbox", { name: "True concentration" }), "0.5");
  const edited: HclUncertaintySettings = changed.mock.lastCall[0];
  expect(edited.cptRows[0]?.row).toEqual({ node: "VALUE", law: { family: "DIRICHLET", concentrations: [8, 0.5] } });
  expect(HclUncertaintySettingsSchema.safeParse(edited).success).toBe(true);
  expect(item!.querySelector(".hcleditor__uncertainty-family")).toHaveTextContent("Dirichlet");

  fireEvent.click(row.getByRole("button", { name: "Delete" }));
  expect(changed.mock.lastCall[0].cptRows).toEqual([]);
});

it("leaves out nodes that use a generator and rows that already hold a law", () => {
  const generated: HclUncertaintySettings = {
    ...empty,
    cptGenerators: [{
      bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: "esq", modelId: model.modelId, entityId: TEST_ID.a },
      generator: { kind: "SEISMIC_PGA_BINS", noneStateId: TEST_ID.aFalse, missionTime: { node: "VALUE", value: { unit: "YEARS", law: { family: "POINT", value: 1 } } }, conversion: "POISSON", bins: [{ stateId: TEST_ID.aTrue, frequency: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.01 } } } }] },
    }],
    cptRows: [{ bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: "esq", modelId: model.modelId, entityId: TEST_ID.b }, cptRowId: TEST_ID.bRow, row: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [1, 1] } } }],
  };
  render(<Harness changed={jest.fn()} initial={generated} />);
  expect(screen.queryByRole("combobox", { name: "Uncertain CPT row" })).not.toBeInTheDocument();
  expect(rowChoices(model).map((choice) => choice.label)).toEqual(["A · prior", "B · prior"]);
});

it("refuses a CPT row that misses a state and flags a row law that no longer fits the node", () => {
  const broken = testBayesianNetworkModel();
  const table = broken.conditionalProbabilityTables[0]!;
  const missing: BayesianNetworkModel = { ...broken, conditionalProbabilityTables: [{ ...table, rows: [{ ...table.rows[0]!, values: [table.rows[0]!.values[0]] }] }, broken.conditionalProbabilityTables[1]!] };
  const choice = rowChoices(missing)[0]!;
  expect(cptRowVector(missing, choice)).toBe("That CPT row does not give a probability for every state.");

  const changed = jest.fn();
  render(<Harness changed={changed} network={missing} />);
  fireEvent.click(screen.getByRole("button", { name: "Add row law" }));
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByText("That CPT row does not give a probability for every state.")).toBeInTheDocument();
});

it("shows a stale row law and offers no edits in read-only mode", () => {
  const stale: HclUncertaintySettings = {
    ...empty,
    cptRows: [{ bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: "esq", modelId: model.modelId, entityId: TEST_ID.b }, cptRowId: TEST_ID.bRow, row: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [1, 1, 1] } } }],
  };
  render(<Harness changed={jest.fn()} initial={stale} editable={false} />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Configured CPT rows"));
  expect(screen.getByText("The row law has 3 values but B has 2 states.")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Law" })).toBeDisabled();
});
