import { JSX, useCallback, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EsqBayesianNetwork, EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { HclEvidenceScenario, HclHazardGridDefinition } from "interfaces-mef-types/modeling";
import type { HclBatchInput } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { addNode } from "../../newly-developed-methods/bayesian-network";
import { TEST_ID } from "../../newly-developed-methods/bayesian-network/test/bayesianNetworkTestModel";
import { downloadText } from "../../newly-developed-methods/hybrid-causal-logic/hclEvidenceScenarioInterchange";
import { EsqDependencyEvidence, dependencyEvidenceProblem, type DependencyEvidence } from "../EsqDependencyEvidence";
import { EsqWorkbookProvider } from "../esqWorkbookContext";
import { generateEsqHclScenarios } from "../esqWorkbookApi";
import {
  CONFIGURATION_ID,
  ESQ_ID,
  SAVED,
  SCENARIO_LOW,
  dependencyConfiguration,
  dependencyEsq,
  dependencyScenarios,
  testNetwork,
} from "./esqDependencyFixtures";

jest.mock("../../newly-developed-methods/hybrid-causal-logic/hclEvidenceScenarioInterchange", () => ({
  ...jest.requireActual<typeof import("../../newly-developed-methods/hybrid-causal-logic/hclEvidenceScenarioInterchange")>("../../newly-developed-methods/hybrid-causal-logic/hclEvidenceScenarioInterchange"),
  downloadText: jest.fn(),
}));

jest.mock("../esqWorkbookApi", () => ({
  ...jest.requireActual<typeof import("../esqWorkbookApi")>("../esqWorkbookApi"),
  generateEsqHclScenarios: jest.fn(),
}));

const START_SCALE = { value: 1, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } };
const GRID: HclHazardGridDefinition = {
  name: "Demand grid",
  hazardNodeIds: [TEST_ID.a],
  annualFrequencyScale: { value: 1, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } },
  normalizeWeights: false,
};

function generated(): HclEvidenceScenario[] {
  return [
    [TEST_ID.aFalse, TEST_ID.bFalse],
    [TEST_ID.aFalse, TEST_ID.bTrue],
    [TEST_ID.aTrue, TEST_ID.bFalse],
    [TEST_ID.aTrue, TEST_ID.bTrue],
  ].map(([a, b], index) => ({
    id: `30000000-0000-4000-8000-00000000002${String(index)}`,
    code: `hz_000${String(index + 1)}`,
    name: `Cell ${String(index + 1)}`,
    enabled: true,
    evidence: { observations: [{ nodeId: TEST_ID.a, stateId: a ?? "" }, { nodeId: TEST_ID.b, stateId: b ?? "" }] },
  }));
}

function Harness({ initial, evidence, onChange, editable = true, running = false }: {
  initial: EventSequenceQuantification;
  evidence: DependencyEvidence;
  onChange: (esq: EventSequenceQuantification) => void;
  editable?: boolean;
  running?: boolean;
}): JSX.Element | null {
  const [esq, setEsq] = useState(initial);
  const [batchInput, setBatchInput] = useState<HclBatchInput | null>(null);
  const [open, setOpen] = useState(true);
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => {
    const next = mutator(current);
    onChange(next);
    return next;
  }), [onChange]);
  const [configuration] = esq.hclConfigurations;
  const [network] = esq.bayesianNetworks;
  if (configuration === undefined || network === undefined) return null;
  return (
    <EsqWorkbookProvider data={{ esq }} editable={editable} mutateEsq={mutateEsq} runtime={SAVED}>
      <EsqDependencyEvidence configuration={configuration} network={network} evidence={evidence} batchInput={batchInput} running={running} open={open} onBatchInput={setBatchInput} onOpen={setOpen} />
    </EsqWorkbookProvider>
  );
}

function mount(patch: Partial<EsqHclConfiguration> = {}, evidence: DependencyEvidence = "SCENARIOS", options: { editable?: boolean; running?: boolean; network?: EsqBayesianNetwork } = {}): jest.Mock<void, [EventSequenceQuantification]> {
  const { network = testNetwork(), ...rest } = options;
  const onChange = jest.fn<void, [EventSequenceQuantification]>();
  render(<Harness initial={dependencyEsq([dependencyConfiguration({ evidenceScenarios: dependencyScenarios(), ...patch })], [network])} evidence={evidence} onChange={onChange} {...rest} />);
  return onChange;
}

function saved(onChange: jest.Mock<void, [EventSequenceQuantification]>): EsqHclConfiguration {
  const calls = onChange.mock.calls;
  const configuration = calls[calls.length - 1]?.[0].hclConfigurations[0];
  if (configuration === undefined) throw new Error("nothing was saved");
  return configuration;
}

function facts(): HTMLElement {
  return screen.getByRole("table", { name: "Evidence" });
}

function rows(): HTMLElement {
  return screen.getByRole("table", { name: "Evidence scenarios" });
}

function closedText(): string | null {
  const toggle = screen.getByRole("button", { name: "Evidence scenarios" });
  fireEvent.click(toggle);
  const text = screen.getByRole("region", { name: "Evidence scenarios" }).textContent;
  fireEvent.click(toggle);
  return text;
}

function upload(filename: string, text: string): void {
  const file = new File([text], filename);
  Object.defineProperty(file, "text", { value: async () => text });
  fireEvent.change(screen.getByLabelText("Upload evidence scenarios"), { target: { files: [file] } });
}

function openGenerator(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));
  return screen.getByRole("dialog", { name: "Generate evidence scenarios" });
}

describe("ESQ Step 05 dependency evidence", () => {
  beforeEach(() => {
    jest.mocked(downloadText).mockReset();
    jest.mocked(generateEsqHclScenarios).mockReset();
  });

  it("lists the base evidence, the saved scenarios and the tools", () => {
    mount({ baseEvidence: { observations: [{ nodeId: TEST_ID.b, stateId: TEST_ID.bTrue }] } });
    const section = within(screen.getByRole("region", { name: "Evidence scenarios" }));
    expect(within(facts()).getByRole("row", { name: "Base evidence B TRUE" })).toBeInTheDocument();
    expect(within(facts()).queryByRole("rowheader", { name: "Scenarios" })).not.toBeInTheDocument();
    expect(within(facts()).queryByRole("rowheader", { name: "Grid nodes" })).not.toBeInTheDocument();
    expect(within(rows()).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["On", "Scenario", "Evidence", ""]);
    expect(within(rows()).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual(["LOWLow demandA FALSERemove", "HIGHHigh demandA TRUERemove"]);
    for (const name of ["Add scenario", "Generate", "Upload", "Sample", "Export"]) expect(section.getByRole("button", { name })).toBeInTheDocument();
    expect(section.queryByRole("button", { name: "Save scenarios" })).not.toBeInTheDocument();
    expect(section.queryByRole("button", { name: "Use saved scenarios" })).not.toBeInTheDocument();
  });

  it("closes to one row that shows the scenario count and opens again", () => {
    mount();
    const toggle = screen.getByRole("button", { name: "Evidence scenarios" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("region", { name: "Evidence scenarios" })).toHaveTextContent("Evidence scenarios2 saved");
    expect(screen.queryByRole("table", { name: "Evidence" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Evidence scenarios" })).not.toBeInTheDocument();
    for (const name of ["Add scenario", "Generate", "Upload", "Sample", "Export"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(within(rows()).getAllByRole("row")).toHaveLength(3);
  });

  it("adds a scenario and opens its window", () => {
    const onChange = mount();
    fireEvent.click(screen.getByRole("button", { name: "Add scenario" }));
    expect(saved(onChange).evidenceScenarios?.[2]).toEqual({ id: expect.any(String), code: "SCN-3", name: "Evidence scenario 3", enabled: true, evidence: { observations: [] } });
    const dialog = within(screen.getByRole("dialog", { name: "Evidence scenario" }));
    expect(dialog.getByRole("textbox", { name: "Scenario code" })).toHaveValue("SCN-3");
    expect(dialog.getByRole("textbox", { name: "Scenario name" })).toHaveValue("Evidence scenario 3");
    expect(within(rows()).getAllByRole("row")).toHaveLength(4);
    expect(within(rows()).getByRole("row", { name: "Use SCN-3 SCN-3 Evidence scenario 3 None Remove" })).toBeInTheDocument();
  });

  it("edits the code, the name and a node state of a saved scenario", () => {
    const onChange = mount();
    fireEvent.click(screen.getByRole("button", { name: "Edit LOW" }));
    const dialog = within(screen.getByRole("dialog", { name: "Evidence scenario" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Scenario code" }), { target: { value: "DRY" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(dialog.getByRole("textbox", { name: "Scenario code" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Scenario name" }), { target: { value: "Dry room" } });
    fireEvent.blur(dialog.getByRole("textbox", { name: "Scenario name" }));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(saved(onChange).evidenceScenarios?.[0]).toMatchObject({ id: SCENARIO_LOW, code: "DRY", name: "Dry room" });
    expect(dialog.getByRole("heading", { name: "DRY" })).toBeInTheDocument();
    const stateOfA = dialog.getByRole("combobox", { name: "A state in DRY" });
    expect(within(stateOfA).getAllByRole("option").map((option) => option.textContent)).toEqual(["Base evidence", "FALSE", "TRUE"]);
    expect(stateOfA).toHaveValue(TEST_ID.aFalse);
    fireEvent.change(stateOfA, { target: { value: TEST_ID.aTrue } });
    expect(saved(onChange).evidenceScenarios?.[0]?.evidence.observations).toEqual([{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }]);
    fireEvent.change(dialog.getByRole("combobox", { name: "B state in DRY" }), { target: { value: TEST_ID.bTrue } });
    fireEvent.change(dialog.getByRole("combobox", { name: "A state in DRY" }), { target: { value: "" } });
    expect(saved(onChange).evidenceScenarios?.[0]?.evidence.observations).toEqual([{ nodeId: TEST_ID.b, stateId: TEST_ID.bTrue }]);
    expect(saved(onChange).evidenceScenarios?.[1]).toEqual(dependencyScenarios()[1]);
    fireEvent.click(dialog.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Evidence scenario" })).not.toBeInTheDocument();
    expect(within(rows()).getByRole("row", { name: "Use DRY DRY Dry room B TRUE Remove" })).toBeInTheDocument();
  });

  it("pages the nodes of a scenario ten at a time", () => {
    let network = testNetwork();
    for (let added = 0; added < 10; added += 1) network = addNode(network).model;
    const onChange = mount({}, "SCENARIOS", { network });
    fireEvent.click(screen.getByRole("button", { name: "Edit LOW" }));
    const dialog = within(screen.getByRole("dialog", { name: "Evidence scenario" }));
    expect(within(dialog.getByRole("table", { name: "Scenario evidence" })).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Node", "State"]);
    expect(within(dialog.getByRole("table", { name: "Scenario evidence" })).getAllByRole("combobox")).toHaveLength(10);
    expect(dialog.queryByRole("combobox", { name: "N-12 state in LOW" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog.getByRole("navigation", { name: "Scenario evidence pagination" })).getByRole("button", { name: "Next" }));
    expect(within(dialog.getByRole("table", { name: "Scenario evidence" })).getAllByRole("combobox")).toHaveLength(2);
    const last = network.nodes[11];
    fireEvent.change(dialog.getByRole("combobox", { name: "N-12 state in LOW" }), { target: { value: last?.states[1]?.id } });
    expect(saved(onChange).evidenceScenarios?.[0]?.evidence.observations).toEqual([
      { nodeId: TEST_ID.a, stateId: TEST_ID.aFalse },
      { nodeId: last?.id, stateId: last?.states[1]?.id },
    ]);
  });

  it("switches a saved scenario off and removes a scenario", () => {
    const onChange = mount();
    fireEvent.click(screen.getByRole("checkbox", { name: "Use LOW" }));
    expect(saved(onChange).evidenceScenarios?.map((scenario) => [scenario.code, scenario.enabled])).toEqual([["LOW", false], ["HIGH", true]]);
    expect(screen.getByRole("checkbox", { name: "Use LOW" })).not.toBeChecked();
    expect(closedText()).toBe("Evidence scenarios1 of 2 turned on");
    fireEvent.click(screen.getByRole("button", { name: "Remove HIGH" }));
    expect(saved(onChange).evidenceScenarios).toEqual([{ ...dependencyScenarios()[0], enabled: false }]);
    expect(closedText()).toBe("Evidence scenarios0 of 1 turned on");
    fireEvent.click(screen.getByRole("button", { name: "Remove LOW" }));
    expect(saved(onChange).evidenceScenarios).toEqual([]);
    expect(screen.queryByRole("table", { name: "Evidence scenarios" })).not.toBeInTheDocument();
  });

  it("refuses a grid change that would put two scenarios in one cell", () => {
    const onChange = mount({ evidenceScenarios: generated(), hazardGrid: { ...GRID, hazardNodeIds: [TEST_ID.a, TEST_ID.b] } }, "HAZARD");
    fireEvent.click(within(facts()).getByRole("checkbox", { name: "B" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(within(facts()).getByRole("checkbox", { name: "B" })).toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent("Scenarios hz_0001 and hz_0002 would share one grid cell.");
    fireEvent.change(within(facts()).getByRole("combobox", { name: "Weights" }), { target: { value: "NORMALIZED" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps one scenario on while the hazard grid is there", () => {
    const [low] = dependencyScenarios();
    if (low === undefined) throw new Error("fixture has no scenario");
    const onChange = mount({ evidenceScenarios: [low], hazardGrid: GRID }, "HAZARD");
    fireEvent.click(screen.getByRole("checkbox", { name: "Use LOW" }));
    expect(screen.getByRole("checkbox", { name: "Use LOW" })).toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent("The hazard grid needs one scenario that is on.");
    fireEvent.click(screen.getByRole("button", { name: "Remove LOW" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The hazard grid needs one scenario that is on.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("adds a scenario turned off under a hazard grid and turns it on only when it fits", () => {
    const onChange = mount({ hazardGrid: GRID }, "HAZARD");
    fireEvent.click(screen.getByRole("button", { name: "Add scenario" }));
    expect(saved(onChange).evidenceScenarios?.[2]).toMatchObject({ code: "SCN-3", enabled: false, evidence: { observations: [] } });
    const dialog = within(screen.getByRole("dialog", { name: "Evidence scenario" }));
    fireEvent.click(dialog.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Use SCN-3" }));
    expect(screen.getByRole("checkbox", { name: "Use SCN-3" })).not.toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent("Scenario SCN-3 would not set every grid node.");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("refuses a scenario edit that the workbook could not store", () => {
    const onChange = mount({ hazardGrid: GRID }, "HAZARD");
    fireEvent.click(screen.getByRole("button", { name: "Edit LOW" }));
    const dialog = within(screen.getByRole("dialog", { name: "Evidence scenario" }));
    const code = dialog.getByRole("textbox", { name: "Scenario code" });
    fireEvent.change(code, { target: { value: "" } });
    fireEvent.blur(code);
    expect(dialog.getByRole("alert")).toHaveTextContent("A scenario needs a code.");
    expect(code).toHaveValue("LOW");
    fireEvent.change(code, { target: { value: "high" } });
    fireEvent.blur(code);
    expect(dialog.getByRole("alert")).toHaveTextContent("Another scenario already has the code HIGH.");
    expect(code).toHaveValue("LOW");
    const name = dialog.getByRole("textbox", { name: "Scenario name" });
    fireEvent.change(name, { target: { value: " " } });
    fireEvent.blur(name);
    expect(dialog.getByRole("alert")).toHaveTextContent("A scenario needs a name.");
    const state = dialog.getByRole("combobox", { name: "A state in LOW" });
    fireEvent.change(state, { target: { value: TEST_ID.aTrue } });
    expect(dialog.getByRole("alert")).toHaveTextContent("Scenarios LOW and HIGH would share one grid cell.");
    fireEvent.change(state, { target: { value: "" } });
    expect(dialog.getByRole("alert")).toHaveTextContent("Scenario LOW would not set every grid node.");
    expect(state).toHaveValue(TEST_ID.aFalse);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("generates scenarios, shows them as temporary rows and saves them with their grid", async () => {
    jest.mocked(generateEsqHclScenarios).mockResolvedValue({ schemaVersion: "1.0.0", scenarios: generated() });
    const onChange = mount({ evidenceScenarios: [] }, "HAZARD");
    const dialog = within(openGenerator());
    expect(dialog.getByRole("heading", { name: "BN-TEST · Test network" })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Generate" })).toBeDisabled();
    fireEvent.click(dialog.getByRole("checkbox", { name: "A" }));
    expect(dialog.getByRole("checkbox", { name: "A FALSE" })).toBeChecked();
    expect(dialog.getByRole("checkbox", { name: "A TRUE" })).toBeChecked();
    expect(dialog.getByText("2 combinations before exclusions")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("checkbox", { name: "B" }));
    expect(dialog.getByText("4 combinations before exclusions")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Generate evidence scenarios" })).not.toBeInTheDocument());
    expect(generateEsqHclScenarios).toHaveBeenCalledWith(ESQ_ID, CONFIGURATION_ID, 5, {
      dimensions: [
        { id: "A", bnNode: TEST_ID.a, states: [TEST_ID.aFalse, TEST_ID.aTrue], stateLabels: { [TEST_ID.aFalse]: "FALSE", [TEST_ID.aTrue]: "TRUE" } },
        { id: "B", bnNode: TEST_ID.b, states: [TEST_ID.bFalse, TEST_ID.bTrue], stateLabels: { [TEST_ID.bFalse]: "FALSE", [TEST_ID.bTrue]: "TRUE" } },
      ],
      excludedAssignments: [],
    });
    expect(closedText()).toBe("Evidence scenarios4 temporary rows");
    expect(within(rows()).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([
      "FALSE-FALSEFalse · FalseA FALSE · B FALSE",
      "FALSE-TRUEFalse · TrueA FALSE · B TRUE",
      "TRUE-FALSETrue · FalseA TRUE · B FALSE",
      "TRUE-TRUETrue · TrueA TRUE · B TRUE",
    ]);
    expect(within(facts()).getByRole("checkbox", { name: "A" })).toBeChecked();
    expect(within(facts()).getByRole("checkbox", { name: "B" })).toBeChecked();
    expect(screen.queryByRole("button", { name: "Add scenario" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save scenarios" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(saved(onChange).evidenceScenarios?.map((scenario) => [scenario.id, scenario.code, scenario.name])).toEqual(generated().map((scenario, index) => [
      scenario.id,
      ["FALSE-FALSE", "FALSE-TRUE", "TRUE-FALSE", "TRUE-TRUE"][index],
      ["False · False", "False · True", "True · False", "True · True"][index],
    ]));
    expect(saved(onChange).hazardGrid).toEqual({ name: "DEP-1 hazard grid", annualFrequencyScale: START_SCALE, normalizeWeights: false, hazardNodeIds: [TEST_ID.a, TEST_ID.b] });
    expect(closedText()).toBe("Evidence scenarios4 saved");
    expect(screen.queryByRole("button", { name: "Save scenarios" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use saved scenarios" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Use FALSE-FALSE" })).toBeChecked();
  });

  it("sends the state selections, the exclusions and the limit to the generator", async () => {
    jest.mocked(generateEsqHclScenarios).mockResolvedValue({ schemaVersion: "1.0.0", scenarios: [] });
    const onChange = mount();
    const dialog = within(openGenerator());
    fireEvent.click(dialog.getByRole("checkbox", { name: "A" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: "B" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: "B TRUE" }));
    fireEvent.click(dialog.getByRole("button", { name: "Add exclusion" }));
    fireEvent.change(dialog.getByRole("combobox", { name: "Exclusion 1 A" }), { target: { value: TEST_ID.aFalse } });
    fireEvent.change(dialog.getByRole("spinbutton", { name: "Scenario limit" }), { target: { value: "2" } });
    expect(dialog.getByText("2 combinations before exclusions")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Generate" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent("No scenario remains after the exclusions.");
    expect(generateEsqHclScenarios).toHaveBeenCalledWith(ESQ_ID, CONFIGURATION_ID, 5, {
      dimensions: [
        { id: "A", bnNode: TEST_ID.a, states: [TEST_ID.aFalse, TEST_ID.aTrue], stateLabels: { [TEST_ID.aFalse]: "FALSE", [TEST_ID.aTrue]: "TRUE" } },
        { id: "B", bnNode: TEST_ID.b, states: [TEST_ID.bFalse], stateLabels: { [TEST_ID.bFalse]: "FALSE", [TEST_ID.bTrue]: "TRUE" } },
      ],
      excludedAssignments: [{ A: TEST_ID.aFalse }],
      maxScenarios: 2,
    });
    expect(within(rows()).getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Use saved scenarios" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("asks for a state of every grid node and a whole scenario limit before it generates", () => {
    mount();
    const dialog = within(openGenerator());
    fireEvent.click(dialog.getByRole("checkbox", { name: "A" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: "A FALSE" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: "A TRUE" }));
    fireEvent.click(dialog.getByRole("button", { name: "Generate" }));
    expect(dialog.getByRole("alert")).toHaveTextContent("Pick at least one state of A.");
    fireEvent.click(dialog.getByRole("checkbox", { name: "A TRUE" }));
    fireEvent.change(dialog.getByRole("spinbutton", { name: "Scenario limit" }), { target: { value: "1.5" } });
    fireEvent.click(dialog.getByRole("button", { name: "Generate" }));
    expect(dialog.getByRole("alert")).toHaveTextContent("The scenario limit is a whole number of at least 1.");
    expect(generateEsqHclScenarios).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Generate evidence scenarios" })).not.toBeInTheDocument();
  });

  it("goes back to the saved scenarios without saving the uploaded rows", async () => {
    const onChange = mount({ hazardGrid: GRID }, "HAZARD");
    upload("rows.json", JSON.stringify({ scenarios: [{ code: "WET", name: "Wet room", evidence: { A: "TRUE", B: "FALSE" } }] }));
    expect(await screen.findByRole("button", { name: "Use saved scenarios" })).toBeInTheDocument();
    expect(closedText()).toBe("Evidence scenarios1 temporary row");
    expect(within(rows()).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual(["WETWet roomA TRUE · B FALSE"]);
    expect(within(facts()).getByRole("checkbox", { name: "A" })).toBeChecked();
    fireEvent.click(within(facts()).getByRole("checkbox", { name: "B" }));
    expect(within(facts()).getByRole("checkbox", { name: "B" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Use saved scenarios" }));
    expect(closedText()).toBe("Evidence scenarios2 saved");
    expect(within(facts()).queryByRole("checkbox", { name: "B" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit LOW" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says why an uploaded file cannot be read", async () => {
    mount();
    upload("rows.json", "{");
    expect(await screen.findByRole("alert")).toHaveTextContent("The selected file is not valid JSON.");
    upload("rows.csv", "code,evidence\nBAD,\"{\"\"MISSING\"\":\"\"TRUE\"\"}\"");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Scenario 'BAD' refers to unknown node 'MISSING'."));
    expect(within(rows()).getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Use saved scenarios" })).not.toBeInTheDocument();
  });

  it("edits the hazard grid of the saved scenarios in the configuration", () => {
    const onChange = mount({}, "HAZARD");
    expect(within(facts()).getAllByRole("checkbox").map((box) => box.closest("label")?.textContent)).toEqual(["A"]);
    expect(within(facts()).queryByRole("spinbutton", { name: "Annual scale" })).not.toBeInTheDocument();
    fireEvent.click(within(facts()).getByRole("checkbox", { name: "A" }));
    expect(saved(onChange).hazardGrid).toEqual({ name: "DEP-1 hazard grid", annualFrequencyScale: START_SCALE, normalizeWeights: false, hazardNodeIds: [TEST_ID.a] });
    fireEvent.change(within(facts()).getByRole("spinbutton", { name: "Annual scale" }), { target: { value: "2" } });
    fireEvent.change(within(facts()).getByRole("spinbutton", { name: "Annual scale" }), { target: { value: "2.5" } });
    expect(saved(onChange).hazardGrid?.annualFrequencyScale.value).toBe(1);
    fireEvent.blur(within(facts()).getByRole("spinbutton", { name: "Annual scale" }));
    expect(onChange).toHaveBeenCalledTimes(2);
    fireEvent.change(within(facts()).getByRole("combobox", { name: "Annual scale unit" }), { target: { value: "PER_DAY" } });
    fireEvent.change(within(facts()).getByRole("spinbutton", { name: "Hours per year" }), { target: { value: "8000" } });
    fireEvent.blur(within(facts()).getByRole("spinbutton", { name: "Hours per year" }));
    fireEvent.change(within(facts()).getByRole("combobox", { name: "Weights" }), { target: { value: "NORMALIZED" } });
    expect(saved(onChange).hazardGrid).toEqual({
      name: "DEP-1 hazard grid",
      annualFrequencyScale: { value: 2.5, unit: "PER_DAY", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8000 } },
      normalizeWeights: true,
      hazardNodeIds: [TEST_ID.a],
    });
    expect(saved(onChange).evidenceScenarios).toEqual(dependencyScenarios());
    for (const refused of ["-1", ""]) {
      fireEvent.change(within(facts()).getByRole("spinbutton", { name: "Annual scale" }), { target: { value: refused } });
      fireEvent.blur(within(facts()).getByRole("spinbutton", { name: "Annual scale" }));
      expect(saved(onChange).hazardGrid?.annualFrequencyScale.value).toBe(2.5);
      expect(within(facts()).getByRole("spinbutton", { name: "Annual scale" })).toHaveValue(2.5);
    }
    fireEvent.click(within(facts()).getByRole("checkbox", { name: "A" }));
    expect(saved(onChange)).not.toHaveProperty("hazardGrid");
    expect(within(facts()).queryByRole("spinbutton", { name: "Annual scale" })).not.toBeInTheDocument();
  });

  it("shows a scenario whose state is gone and lets the user repair it", () => {
    const [low] = dependencyScenarios();
    if (low === undefined) throw new Error("fixture has no scenario");
    const onChange = mount({ evidenceScenarios: [{ ...low, evidence: { observations: [{ nodeId: TEST_ID.a, stateId: "deleted-state" }] } }] });
    expect(within(rows()).getByRole("row", { name: "Use LOW LOW Low demand A missing state Remove" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit LOW" }));
    const state = within(screen.getByRole("dialog", { name: "Evidence scenario" })).getByRole("combobox", { name: "A state in LOW" });
    expect(state).toHaveDisplayValue("Missing state");
    expect(within(state).getByRole("option", { name: "Missing state" })).toBeDisabled();
    fireEvent.change(state, { target: { value: TEST_ID.aTrue } });
    expect(saved(onChange).evidenceScenarios?.[0]?.evidence.observations).toEqual([{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }]);
    expect(within(state).queryByRole("option", { name: "Missing state" })).not.toBeInTheDocument();
  });

  it("shows evidence on a node that is gone and lets the user clear it", () => {
    const [low] = dependencyScenarios();
    if (low === undefined) throw new Error("fixture has no scenario");
    const onChange = mount({ evidenceScenarios: [{ ...low, evidence: { observations: [{ nodeId: "deleted-node", stateId: "deleted-state" }] } }] });
    expect(within(rows()).getByRole("row", { name: "Use LOW LOW Low demand Missing node missing state Remove" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit LOW" }));
    const state = within(screen.getByRole("dialog", { name: "Evidence scenario" })).getByRole("combobox", { name: "Missing node state in LOW" });
    expect(state).toHaveDisplayValue("Missing state");
    fireEvent.change(state, { target: { value: "" } });
    expect(saved(onChange).evidenceScenarios?.[0]?.evidence.observations).toEqual([]);
    expect(screen.queryByRole("combobox", { name: "Missing node state in LOW" })).not.toBeInTheDocument();
  });

  it("names the scenario that sets a node or a state that is gone", () => {
    const [low, high] = dependencyScenarios();
    if (low === undefined || high === undefined) throw new Error("fixture has no scenario");
    const network = testNetwork();
    const problem = "Evidence scenario HIGH sets a node or a state that is not in the network.";
    const goneState = dependencyConfiguration({ evidenceScenarios: [low, { ...high, evidence: { observations: [{ nodeId: TEST_ID.a, stateId: "deleted-state" }] } }] });
    const goneNode = dependencyConfiguration({ evidenceScenarios: [low, { ...high, evidence: { observations: [{ nodeId: "deleted-node", stateId: TEST_ID.aTrue }] } }], hazardGrid: GRID });
    expect(dependencyEvidenceProblem(goneState, "SCENARIOS", network)).toBe(problem);
    expect(dependencyEvidenceProblem(goneNode, "HAZARD", network)).toBe(problem);
    expect(dependencyEvidenceProblem(goneState, "BASE", network)).toBeUndefined();
    expect(dependencyEvidenceProblem(dependencyConfiguration({ evidenceScenarios: [low, { ...high, enabled: false, evidence: { observations: [{ nodeId: TEST_ID.a, stateId: "deleted-state" }] } }] }), "SCENARIOS", network)).toBeUndefined();
    expect(dependencyEvidenceProblem(dependencyConfiguration({ evidenceScenarios: [low, high] }), "SCENARIOS", network)).toBeUndefined();
  });

  it("keeps a grid node that a scenario no longer sets in the list so it can be taken out", () => {
    const [low, high] = dependencyScenarios();
    if (low === undefined || high === undefined) throw new Error("fixture has no scenario");
    const onChange = mount({ evidenceScenarios: [low, { ...high, evidence: { observations: [] } }], hazardGrid: GRID }, "HAZARD");
    const node = within(facts()).getByRole("checkbox", { name: "A" });
    expect(node).toBeChecked();
    fireEvent.click(node);
    expect(saved(onChange)).not.toHaveProperty("hazardGrid");
  });

  it("shows a grid node that is gone from the network and takes it out", () => {
    const onChange = mount({ hazardGrid: { ...GRID, hazardNodeIds: ["deleted-node", TEST_ID.a] } }, "HAZARD");
    const missing = within(facts()).getByRole("checkbox", { name: "Missing node" });
    expect(missing).toBeChecked();
    fireEvent.click(missing);
    expect(saved(onChange).hazardGrid?.hazardNodeIds).toEqual([TEST_ID.a]);
  });

  it("downloads sample rows and exports the rows on screen", () => {
    mount();
    fireEvent.click(within(screen.getByRole("menu", { name: "Sample" })).getByRole("menuitem", { name: "JSON" }));
    const sample = jest.mocked(downloadText).mock.calls[0];
    expect(sample?.[0]).toBe("BN-TEST-evidence-sample.json");
    expect(sample?.[2]).toBe("application/json");
    expect(JSON.parse(sample?.[1] ?? "")).toEqual({
      schemaVersion: "1.0.0",
      scenarios: [
        { code: "SAMPLE-01", name: "Sample evidence 1", enabled: true, evidence: { A: "FALSE", B: "FALSE" } },
        { code: "SAMPLE-02", name: "Sample evidence 2", enabled: true, evidence: { A: "TRUE", B: "TRUE" } },
      ],
    });
    fireEvent.click(within(screen.getByRole("menu", { name: "Export" })).getByRole("menuitem", { name: "CSV" }));
    expect(jest.mocked(downloadText).mock.calls[1]).toEqual([
      "BN-TEST-evidence-scenarios.csv",
      'code,name,enabled,evidence\r\nLOW,Low demand,true,"{""A"":""FALSE""}"\r\nHIGH,High demand,true,"{""A"":""TRUE""}"\r\n',
      "text/csv",
    ]);
  });

  it("shows the scenarios and the grid to a reader without edits", () => {
    const onChange = mount({ hazardGrid: GRID }, "HAZARD", { editable: false });
    for (const name of ["Add scenario", "Generate", "Save scenarios"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(within(facts()).getAllByRole("row").map((row) => row.textContent)).toEqual([
      "Base evidenceNone",
      "Hazard gridDemand grid",
      "Grid nodesA",
      "Annual scale1 per year",
      "Hours per year8760",
      "WeightsRaw",
    ]);
    expect(within(rows()).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Scenario", "Evidence"]);
    expect(screen.queryByRole("checkbox", { name: "Use LOW" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove LOW" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View HIGH" }));
    const dialog = within(screen.getByRole("dialog", { name: "Evidence scenario" }));
    expect(dialog.getByRole("textbox", { name: "Scenario code" })).toBeDisabled();
    expect(dialog.getByRole("textbox", { name: "Scenario name" })).toBeDisabled();
    expect(dialog.getByRole("combobox", { name: "A state in HIGH" })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("holds the edits while a run is under way", () => {
    mount({ hazardGrid: GRID }, "HAZARD", { running: true });
    expect(screen.queryByRole("button", { name: "Add scenario" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    expect(screen.queryByRole("checkbox", { name: "Use LOW" })).not.toBeInTheDocument();
    expect(within(facts()).queryByRole("checkbox", { name: "A" })).not.toBeInTheDocument();
    expect(within(facts()).getByRole("row", { name: "Grid nodes A" })).toBeInTheDocument();
  });

  it("marks a scenario that is turned off for a reader", () => {
    const [low, high] = dependencyScenarios();
    if (low === undefined || high === undefined) throw new Error("fixture has no scenario");
    mount({ evidenceScenarios: [{ ...low, enabled: false }, high] }, "SCENARIOS", { editable: false });
    expect(closedText()).toBe("Evidence scenarios1 of 2 turned on");
    expect(within(rows()).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual(["LOWLow demand · OffA FALSE", "HIGHHigh demandA TRUE"]);
  });
});
