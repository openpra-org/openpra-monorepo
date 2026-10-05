import { JSX, useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { DaOutage } from "interfaces-mef-types/da/data-analysis";
import type { PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { POS_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/pos-seed";
import { daOutageOptions, type PosDaOutageOption } from "../posDaLinks";
import { FrequencyScreen } from "../posScreens";
import { PosWorkbookProvider, type PosWorkbookData } from "../posWorkbookContext";

const STATE = POS_ANALYSIS.plantOperatingStates.find((state) => state.operatingMode !== "POWER")!;

function outage(fields: Partial<DaOutage> & Pick<DaOutage, "id">): DaOutage {
  return { evolution: "Refueling outage", outageType: "REFUELING", stateId: STATE.uuid, hours: 720, perYear: 0.5, basis: "PLANNED_SCHEDULE", ...fields };
}

let latest: PlantOperatingStatesAnalysis = POS_ANALYSIS;

function Harness({ pos, options }: { pos: PlantOperatingStatesAnalysis; options: PosDaOutageOption[] }): JSX.Element {
  const [data, setData] = useState<PosWorkbookData>({ pos, cc: {} as PRAConfigurationControl, nms: [], daOutages: options });
  const patch = (mutator: (draft: PlantOperatingStatesAnalysis) => PlantOperatingStatesAnalysis): void => setData((previous) => {
    latest = mutator(previous.pos);
    return { ...previous, pos: latest };
  });
  return (
    <PosWorkbookProvider data={data}>
      <FrequencyScreen ccId="CC-II" setCcId={jest.fn()} stage="pre_operational" setStage={jest.fn()} openDrawer={jest.fn()} onAction={jest.fn()} canEdit={true} mefPatch={patch} mefPatchDebounced={patch} />
    </PosWorkbookProvider>
  );
}

function openState(): HTMLElement {
  const row = screen.getAllByText(STATE.description)[0]!.closest("tr")!;
  fireEvent.click(row);
  return row;
}

describe("POS links to DA outages", () => {
  it("sums each state's DA outages and skips outages DA takes from POS", () => {
    const options = daOutageOptions([{
      id: "da-1",
      name: "Plant DA",
      mef: {
        name: "Plant DA",
        outages: [
          outage({ id: "OUT-1", hours: 720, perYear: 0.5 }),
          outage({ id: "OUT-2", hours: 120, perYear: 1 }),
          outage({ id: "OUT-3", hours: 48, perYear: 2, valueFrom: "POS" }),
          outage({ id: "OUT-4", stateId: undefined }),
        ],
      },
    }]);
    expect(options).toEqual([{ workbookId: "da-1", workbookName: "Plant DA", stateId: STATE.uuid, outageIds: ["OUT-1", "OUT-2"], hoursPerYear: 480, entriesPerYear: 1.5 }]);
  });

  it("imports a state's hours from DA and goes back to typing", () => {
    const option: PosDaOutageOption = { workbookId: "da-1", workbookName: "Plant DA", stateId: STATE.uuid, outageIds: ["OUT-1"], hoursPerYear: 480, entriesPerYear: 1.5 };
    render(<Harness pos={POS_ANALYSIS} options={[option]} />);
    openState();
    expect(screen.getByText("Mean duration (h/yr)")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Hours from" }), { target: { value: "da-1" } });
    const imported = latest.plantOperatingStates.find((state) => state.uuid === STATE.uuid);
    expect(imported?.outageSource).toEqual({ workbookId: "da-1" });
    expect(imported?.meanDurationHours).toBe(480);
    expect(typeof imported?.meanEntryFrequency === "number" ? imported.meanEntryFrequency : imported?.meanEntryFrequency.value).toBe(1.5);
    expect(screen.queryByText("Mean duration (h/yr)")).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Hours from" }), { target: { value: "" } });
    expect(latest.plantOperatingStates.find((state) => state.uuid === STATE.uuid)?.outageSource).toBeUndefined();
    expect(screen.getByText("Mean duration (h/yr)")).toBeInTheDocument();
  });

  it("flags changed DA outages and applies them", () => {
    const option: PosDaOutageOption = { workbookId: "da-1", workbookName: "Plant DA", stateId: STATE.uuid, outageIds: ["OUT-1"], hoursPerYear: STATE.meanDurationHours + 24, entriesPerYear: 1 };
    const held = { ...POS_ANALYSIS, plantOperatingStates: POS_ANALYSIS.plantOperatingStates.map((state) => (state.uuid === STATE.uuid ? { ...state, outageSource: { workbookId: "da-1" } } : state)) };
    render(<Harness pos={held} options={[option]} />);
    const row = openState();
    expect(within(row).getByText("From DA")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("DA now gives");
    fireEvent.click(screen.getByRole("button", { name: "Apply DA value" }));
    expect(latest.plantOperatingStates.find((state) => state.uuid === STATE.uuid)?.meanDurationHours).toBe(STATE.meanDurationHours + 24);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
