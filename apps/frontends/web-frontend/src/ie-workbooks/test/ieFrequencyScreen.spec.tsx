import { JSX, useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { FrequencyUnit, type UncertainFrequency } from "interfaces-mef-types/core/events";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { IE_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { uncertaintyIdle } from "../../newly-developed-methods/shared/useUncertainty";
import { praxisUncertainty } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { FrequencyScreen } from "../ieScreens";
import { IeWorkbookProvider, type IeWorkbookData } from "../ieWorkbookContext";
import type { IeDaFrequencyOption } from "../ieDaLinks";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

const quantified = new Set(IE_ANALYSIS.quantifications.map((quantification) => quantification.initiatorOrGroupId));
const GROUP = IE_ANALYSIS.initiatingEventGroups.find((candidate) => quantified.has(candidate.uuid))!;
const ESTIMATE: UncertainExpression = { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 0.042, errorFactor: 3, level: 0.95 } } };
const OPTION: IeDaFrequencyOption = { workbookId: "da-1", workbookName: "Plant DA", parameterId: "DA-IE-77", parameterName: GROUP.name, estimate: ESTIMATE };
const REFERENCE = { referenceType: "WORKBOOK_PARAMETER" as const, workbookId: "da-1", entityId: "DA-IE-77" };

let latest: InitiatingEventsAnalysis = IE_ANALYSIS;

function Harness({ ie, options }: { ie: InitiatingEventsAnalysis; options: IeDaFrequencyOption[] }): JSX.Element {
  const [data, setData] = useState<IeWorkbookData>({
    ie,
    cc: {} as PRAConfigurationControl,
    nms: [],
    posLink: { linkedPosWorkbookId: null, linkedName: null, states: [], sources: [] },
    daFrequencies: options,
  });
  return (
    <IeWorkbookProvider data={data} editable={true} mutateIe={(mutator) => setData((previous) => {
      latest = mutator(previous.ie);
      return { ...previous, ie: latest };
    })}>
      <FrequencyScreen />
    </IeWorkbookProvider>
  );
}

function primaryFrequency(id: string): UncertainFrequency {
  const quantification = IE_ANALYSIS.quantifications.find((candidate) => candidate.initiatorOrGroupId === id);
  const primary = quantification?.dataSources?.find((candidate) => candidate.uuid === quantification.primaryDataSourceId);
  const expression = primary?.estimate ?? primary?.faultTreeTop;
  if (expression === undefined) throw new Error(`${id} has no primary estimate.`);
  return { expression, basis: FrequencyUnit.PER_PLANT_YEAR };
}

function typed(): InitiatingEventsAnalysis {
  return {
    ...IE_ANALYSIS,
    initiatingEventGroups: IE_ANALYSIS.initiatingEventGroups.map((candidate) => {
      const { controlledDataSource: _link, ...rest } = candidate;
      return quantified.has(candidate.uuid) ? { ...rest, frequency: primaryFrequency(candidate.uuid) } : rest;
    }),
    quantifications: IE_ANALYSIS.quantifications.map((quantification) => ({ ...quantification, frequency: primaryFrequency(quantification.initiatorOrGroupId) })),
  };
}

async function settle(): Promise<void> {
  for (let round = 0; round < 40; round += 1) {
    await act(async () => {
      do await new Promise((resolve) => setTimeout(resolve, 0));
      while (!uncertaintyIdle());
    });
    if (uncertaintyIdle()) return;
  }
  throw new Error("PRAXIS answers did not settle.");
}

function openRow(container: HTMLElement): HTMLTableRowElement {
  const table = container.querySelector("table.postable");
  if (!(table instanceof HTMLTableElement)) throw new Error("No quantification table.");
  const cell = within(table).getAllByText(GROUP.uuid)[0]!;
  const row = cell.closest("tr")!;
  fireEvent.click(row);
  return row;
}

function groupOf(ie: InitiatingEventsAnalysis): InitiatingEventsAnalysis["initiatingEventGroups"][number] | undefined {
  return ie.initiatingEventGroups.find((candidate) => candidate.uuid === GROUP.uuid);
}

describe("IE frequency step", () => {
  beforeAll(() => {
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  });

  beforeEach(() => {
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
  });

  it("shows the PRAXIS mean of each frequency with its basis", async () => {
    const { container } = render(<Harness ie={typed()} options={[OPTION]} />);
    await settle();
    const row = openRow(container);
    const law = primaryFrequency(GROUP.uuid).expression;
    if (law.node !== "VALUE" || law.value.law.family !== "LOGNORMAL") throw new Error("The example group holds a lognormal.");
    const mantissa = (law.value.law.mean / Math.pow(10, Math.floor(Math.log10(law.value.law.mean)))).toFixed(1);
    expect(within(row).getByText((text) => text.startsWith(mantissa) && text.includes("E"))).toBeInTheDocument();
    expect(within(row).getByText("per plant-year")).toBeInTheDocument();
  });

  it("imports a group frequency from DA, goes back to typing and keeps the law", async () => {
    const { container } = render(<Harness ie={typed()} options={[OPTION]} />);
    await settle();
    openRow(container);
    expect(screen.getByText("Frequency")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Plant DA · DA-IE-77 · 4.2E-02" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Value from" }), { target: { value: JSON.stringify(["da-1", "DA-IE-77"]) } });
    await settle();
    expect(groupOf(latest)?.controlledDataSource).toEqual(REFERENCE);
    expect(groupOf(latest)?.frequency).toEqual({ expression: { node: "PARAMETER", reference: REFERENCE }, basis: FrequencyUnit.PER_PLANT_YEAR });
    expect(screen.queryByText("Frequency")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open quantifier →" })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Value from" }), { target: { value: "" } });
    await settle();
    expect(groupOf(latest)?.controlledDataSource).toBeUndefined();
    expect(groupOf(latest)?.frequency).toEqual({ expression: ESTIMATE, basis: FrequencyUnit.PER_PLANT_YEAR });
    expect(screen.getByText("Frequency")).toBeInTheDocument();
  });

  it("types a new law that replaces the whole expression", async () => {
    const { container } = render(<Harness ie={typed()} options={[]} />);
    await settle();
    openRow(container);
    fireEvent.change(screen.getByRole("combobox", { name: "Law" }), { target: { value: "GAMMA" } });
    await settle();
    const frequency = latest.quantifications.find((candidate) => candidate.initiatorOrGroupId === GROUP.uuid)?.frequency;
    expect(frequency?.expression).toEqual(expect.objectContaining({ node: "VALUE", value: expect.objectContaining({ unit: "PER_YEAR", law: expect.objectContaining({ family: "GAMMA" }) }) }));
    expect(groupOf(latest)?.frequency).toEqual(frequency);

    fireEvent.change(screen.getByRole("combobox", { name: "Counted per" }), { target: { value: FrequencyUnit.PER_REACTOR_YEAR } });
    await settle();
    expect(groupOf(latest)?.frequency?.basis).toBe(FrequencyUnit.PER_REACTOR_YEAR);
  });

  it("shows a changed DA estimate and applies it", async () => {
    const copy: UncertainFrequency = { expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.03 } } }, basis: FrequencyUnit.PER_PLANT_YEAR };
    const held: InitiatingEventsAnalysis = {
      ...typed(),
      initiatingEventGroups: typed().initiatingEventGroups.map((candidate) => (candidate.uuid === GROUP.uuid
        ? { ...candidate, frequency: copy, controlledDataSource: REFERENCE }
        : candidate)),
    };
    const { container } = render(<Harness ie={held} options={[OPTION]} />);
    await settle();
    const row = openRow(container);
    expect(within(row).getByText("Changed in DA")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("DA now gives 4.2E-02 per plant-year. This group still holds 3.0E-02.");

    fireEvent.click(screen.getByRole("button", { name: "Apply DA value" }));
    await settle();
    expect(groupOf(latest)?.frequency?.expression).toEqual({ node: "PARAMETER", reference: REFERENCE });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("names a held copy that only differs in spread", async () => {
    const copy: UncertainFrequency = { expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.042 } } }, basis: FrequencyUnit.PER_PLANT_YEAR };
    const held: InitiatingEventsAnalysis = {
      ...typed(),
      initiatingEventGroups: typed().initiatingEventGroups.map((candidate) => (candidate.uuid === GROUP.uuid ? { ...candidate, frequency: copy, controlledDataSource: REFERENCE } : candidate)),
    };
    const { container } = render(<Harness ie={held} options={[OPTION]} />);
    await settle();
    openRow(container);
    expect(screen.getByRole("status")).toHaveTextContent("DA now gives a different spread around the same mean, 4.2E-02 per plant-year.");
  });
});
