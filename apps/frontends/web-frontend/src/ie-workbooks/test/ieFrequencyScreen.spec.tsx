import { JSX, useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { IE_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed";
import { FrequencyScreen } from "../ieScreens";
import { IeWorkbookProvider, type IeWorkbookData } from "../ieWorkbookContext";
import type { IeDaFrequencyOption } from "../ieDaLinks";

const quantified = new Set(IE_ANALYSIS.quantifications.map((quantification) => quantification.initiatorOrGroupId));
const GROUP = IE_ANALYSIS.initiatingEventGroups.find((candidate) => quantified.has(candidate.uuid))!;
const OPTION: IeDaFrequencyOption = { workbookId: "da-1", workbookName: "Plant DA", parameterId: "DA-IE-77", parameterName: GROUP.name, value: 0.042 };

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

function typed(): InitiatingEventsAnalysis {
  return { ...IE_ANALYSIS, initiatingEventGroups: IE_ANALYSIS.initiatingEventGroups.map((candidate) => ({ ...candidate, controlledDataSource: undefined })) };
}

function openRow(container: HTMLElement): HTMLTableRowElement {
  const table = container.querySelector("table.postable");
  if (!(table instanceof HTMLTableElement)) throw new Error("No quantification table.");
  const cell = within(table).getAllByText(GROUP.uuid)[0]!;
  const row = cell.closest("tr")!;
  fireEvent.click(row);
  return row;
}

describe("IE frequency step", () => {
  beforeAll(() => {
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  });

  it("imports a group frequency from DA and goes back to typing", () => {
    const { container } = render(<Harness ie={typed()} options={[OPTION]} />);
    openRow(container);
    expect(screen.getByText("Mean frequency (per plant-yr)")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Value from" }), { target: { value: JSON.stringify(["da-1", "DA-IE-77"]) } });
    const group = latest.initiatingEventGroups.find((candidate) => candidate.uuid === GROUP.uuid);
    expect(group?.controlledDataSource).toEqual({ referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-IE-77" });
    expect(group?.meanFrequency).toEqual(expect.objectContaining({ value: 0.042 }));
    expect(screen.queryByText("Mean frequency (per plant-yr)")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open quantifier →" })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Value from" }), { target: { value: "" } });
    expect(latest.initiatingEventGroups.find((candidate) => candidate.uuid === GROUP.uuid)?.controlledDataSource).toBeUndefined();
    expect(screen.getByText("Mean frequency (per plant-yr)")).toBeInTheDocument();
  });

  it("shows a changed DA value and applies it", () => {
    const held: InitiatingEventsAnalysis = {
      ...typed(),
      initiatingEventGroups: typed().initiatingEventGroups.map((candidate) => (candidate.uuid === GROUP.uuid
        ? { ...candidate, controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-IE-77" } }
        : candidate)),
    };
    const { container } = render(<Harness ie={held} options={[OPTION]} />);
    const row = openRow(container);
    expect(within(row).getByText("Changed in DA")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("DA now gives 4.2E-02 per plant-yr.");

    fireEvent.click(screen.getByRole("button", { name: "Apply DA value" }));
    expect(latest.initiatingEventGroups.find((candidate) => candidate.uuid === GROUP.uuid)?.meanFrequency).toEqual(expect.objectContaining({ value: 0.042 }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
