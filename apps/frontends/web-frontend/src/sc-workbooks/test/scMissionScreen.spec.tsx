import { act, fireEvent, render, screen } from "@testing-library/react";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { ScWorkbookProvider, type ScMutator } from "../scWorkbookContext";
import { MissionScreen } from "../scScreens";
import { createBlankSc } from "../../../../../backends/web-backend/src/sc-workbooks/blank-sc";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

function hours(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value } } };
}

const SC: SuccessCriteriaDevelopment = {
  ...createBlankSc("SC", "alice"),
  missionTimes: [{ uuid: "MT-1", eventSequenceReference: "ES-1", missionTime: hours(72), basis: "Passive cooling holds", safeStableStateAchievedWithinMissionTime: true, analysisReferences: [], implementsSrs: [] }],
  componentMissionTimes: [{ uuid: "CMT-1", componentId: "Circulator", missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "UNIFORM", lower: 20, upper: 28 } } }, eventSequenceReference: "ES-1", analysisReferences: [], implementsSrs: [] }],
};

const mutateSc = jest.fn();

function renderScreen(sc: SuccessCriteriaDevelopment = SC): void {
  render(
    <ScWorkbookProvider data={{ sc, cc: {} as PRAConfigurationControl, nms: [], links: null }} editable mutateSc={mutateSc}>
      <MissionScreen />
    </ScWorkbookProvider>,
  );
}

function applyLast(sc: SuccessCriteriaDevelopment = SC): SuccessCriteriaDevelopment {
  const calls = mutateSc.mock.calls;
  const mutator = calls[calls.length - 1]![0] as ScMutator;
  return mutator(sc);
}

async function settled(): Promise<void> {
  await act(async () => {
    await settledWithPraxis(() => undefined);
  });
}

describe("SC mission times", () => {
  beforeEach(() => {
    mutateSc.mockClear();
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
  });

  it("shows the PRAXIS point of each mission time", async () => {
    renderScreen();
    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
    await settled();
    expect(screen.getByText("72 h")).toBeInTheDocument();
    expect(screen.getByText("24 h")).toBeInTheDocument();
  });

  it("edits a mission time as an expression in hours", async () => {
    renderScreen();
    await settled();
    fireEvent.click(screen.getByRole("button", { name: /ES-1/ }));
    const value = screen.getByRole("textbox", { name: "Value" });
    fireEvent.focus(value);
    fireEvent.change(value, { target: { value: "96" } });
    fireEvent.blur(value);
    expect(applyLast().missionTimes[0]!.missionTime).toEqual(hours(96));

    fireEvent.change(screen.getByRole("combobox", { name: "Law" }), { target: { value: "LOGNORMAL" } });
    expect(applyLast().missionTimes[0]!.missionTime).toMatchObject({ node: "VALUE", value: { unit: "HOURS", law: { family: "LOGNORMAL" } } });
  });

  it("adds new records with a typed point in hours", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Add mission time" }));
    expect(applyLast().missionTimes[1]!.missionTime).toMatchObject({ node: "VALUE", value: { unit: "HOURS", law: { family: "POINT" } } });
    fireEvent.click(screen.getByRole("button", { name: "Add component" }));
    expect(applyLast().componentMissionTimes![1]!.missionTime).toMatchObject({ node: "VALUE", value: { unit: "HOURS", law: { family: "POINT" } } });
  });
});
