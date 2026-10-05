import { fireEvent, render, screen } from "@testing-library/react";
import type { SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { applyFaultTreeOperation } from "../../newly-developed-methods/fault-tree";
import { EventDialogContent } from "../SyEventDialogs";

jest.mock("../../newly-developed-methods/fault-tree", () => ({
  FaultTreeEditor: jest.fn(() => null),
  applyFaultTreeOperation: jest.fn(),
}));

const SYSTEM_ID = "SYS-CCW";
const MODEL_ID = "FT-CCW";
const HOUSE = { id: "leaf-house", kind: "HOUSE_EVENT" as const, code: "H-TRAIN-B", name: "Train B in service", description: "", state: true };

const TREE: SystemLogicModel = {
  uuid: MODEL_ID,
  code: "FT-CCW",
  name: "Cooling water fault tree",
  systemReference: SYSTEM_ID,
  description: "Cooling water fails",
  modelRepresentation: "FAULT_TREE",
  topGate: { gateId: "G1" },
  gates: [{ id: "G1", code: "G1", name: "Top", description: "", kind: "GATE", gateType: "OR" }],
  leafNodes: [{ id: "leaf-pump", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-pump" }, HOUSE],
  gateInputs: [],
  nodePositions: [],
  layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
  implementsSrs: [],
};

type BasicEvent = SystemsAnalysis["systemBasicEvents"][number];

function makeAnalysis(repairModeled: boolean, event: Partial<BasicEvent> = {}): SystemsAnalysis {
  return {
    systemDefinitions: [{
      uuid: SYSTEM_ID,
      name: "Component cooling water",
      boundaries: [],
      successCriteriaIds: [],
      missionTimeHours: 72,
      modeledComponentsAndFailures: {},
      informationBasis: "as-designed-as-intended",
      implementsSrs: [],
    }],
    systemLogicModels: [TREE],
    systemBasicEvents: [{
      uuid: "be-pump",
      code: "CCW-PMP-FS",
      name: "Pump fails to start",
      eventType: "BASIC",
      failureMode: "FAILURE_TO_START",
      probability: 0.01,
      repairModeled,
      implementsSrs: [],
      ...event,
    }],
    systemToSafetyFunctionMappings: [],
    systemDependencies: [],
    commonCauseFailureGroups: [],
    humanFailureEventIntegrations: [],
  } as unknown as SystemsAnalysis;
}

const mockMutateSy = jest.fn();
let mockAnalysis = makeAnalysis(false);
const mockFailureModes = [{ workbookId: "da-1", workbookName: "Approved DA", failureModeId: "FM-FTS", name: "Fails to start" }];
const mockParameters = [{
  workbookId: "da-1",
  workbookName: "Approved DA",
  parameterId: "DA-BE-1",
  parameterName: "Cooling-water pump fails to start",
  parameterType: "PROBABILITY" as const,
  value: 0.003,
  failureModeId: "FM-FTS",
  failureModeName: "Fails to start",
}, {
  workbookId: "da-1",
  workbookName: "Approved DA",
  parameterId: "DA-RATE-1",
  parameterName: "Cooling-water pump fails to run",
  parameterType: "FAILURE_RATE" as const,
  value: 2e-5,
  rateUnit: "HOUR" as const,
}, {
  workbookId: "da-1",
  workbookName: "Approved DA",
  parameterId: "DA-LOOP",
  parameterName: "Loss of offsite power",
  parameterType: "FREQUENCY" as const,
  value: 0.03,
  rateUnit: "YEAR" as const,
}];

const RATE_BASIS = { kind: "FAILURE_RATE" as const, failureRate: { value: 1e-5, unit: "HOUR" as const }, missionTime: { value: 72, unit: "HOUR" as const }, conversion: "EXPONENTIAL" as const };

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => ({
    sy: mockAnalysis,
    editable: true,
    mutateSy: mockMutateSy,
    shortOf: (id: string) => id,
    controlledParameters: mockParameters,
    controlledHumanFailures: [],
    controlledFailureModes: mockFailureModes,
  }),
}));

function applyLastMutation(): SystemsAnalysis {
  const calls = mockMutateSy.mock.calls;
  const mutator = calls[calls.length - 1]![0] as (draft: SystemsAnalysis) => SystemsAnalysis;
  return mutator(mockAnalysis);
}

function commit(element: HTMLElement, value: string): void {
  fireEvent.focus(element);
  fireEvent.change(element, { target: { value } });
  fireEvent.blur(element);
}

describe("SY event dialogs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalysis = makeAnalysis(false);
  });

  it("commits a hand-entered probability", () => {
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    commit(screen.getByRole("spinbutton", { name: "Probability" }), "0.05");
    expect(applyLastMutation().systemBasicEvents[0]).toMatchObject({ probability: 0.05, quantificationBasis: { kind: "PROBABILITY" } });
  });

  it("switches to a failure rate over the system mission time", () => {
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Input" }), { target: { value: "FAILURE_RATE" } });
    expect(applyLastMutation().systemBasicEvents[0]!.quantificationBasis).toEqual({
      kind: "FAILURE_RATE",
      failureRate: { value: 0, unit: "HOUR" },
      missionTime: { value: 72, unit: "HOUR" },
      conversion: "EXPONENTIAL",
    });
  });

  it("asks why repair is credited", () => {
    mockAnalysis = makeAnalysis(true);
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Justification required");
    commit(screen.getByRole("textbox", { name: "Repair justification" }), "Plant repair data support a 10 h mean repair time.");
    expect(applyLastMutation().systemBasicEvents[0]!.repairJustification).toBe("Plant repair data support a 10 h mean repair time.");
  });

  it("takes the failure mode from DA", () => {
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Failure mode source" }), { target: { value: JSON.stringify(["da-1", "FM-FTS"]) } });
    expect(applyLastMutation().systemBasicEvents[0]).toMatchObject({ failureMode: "Fails to start", failureModeSource: { workbookId: "da-1", failureModeId: "FM-FTS" } });
  });

  it("types a failure mode and keeps the standard code for a standard label", () => {
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    commit(screen.getByRole("combobox", { name: "Failure mode" }), "Fail to run");
    expect(applyLastMutation().systemBasicEvents[0]!.failureMode).toBe("FAILURE_TO_RUN");
    commit(screen.getByRole("combobox", { name: "Failure mode" }), "Seal leaks past the shaft");
    expect(applyLastMutation().systemBasicEvents[0]).toMatchObject({ failureMode: "Seal leaks past the shaft" });
    expect(applyLastMutation().systemBasicEvents[0]!.failureModeSource).toBeUndefined();
  });

  it("brings the DA failure mode with a linked DA parameter", () => {
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Data Analysis parameter" }), { target: { value: JSON.stringify(["da-1", "DA-BE-1"]) } });
    expect(applyLastMutation().systemBasicEvents[0]).toMatchObject({
      probability: 0.003,
      failureMode: "Fails to start",
      failureModeSource: { workbookId: "da-1", failureModeId: "FM-FTS" },
      controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-BE-1" },
    });
  });

  it("links a DA rate per hour and a DA frequency per year with their units", () => {
    mockAnalysis = makeAnalysis(false, { quantificationBasis: RATE_BASIS });
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    const picker = screen.getByRole("combobox", { name: "Data Analysis parameter" });
    expect(screen.getByRole("option", { name: "Approved DA · Loss of offsite power · 3.0E-2 /yr" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Cooling-water pump fails to start/ })).toBeNull();
    fireEvent.change(picker, { target: { value: JSON.stringify(["da-1", "DA-LOOP"]) } });
    const yearly = applyLastMutation().systemBasicEvents[0]!;
    expect(yearly.quantificationBasis).toEqual({ ...RATE_BASIS, failureRate: { value: 0.03, unit: "YEAR" } });
    expect(yearly.probability).toBeCloseTo(1 - Math.exp(-0.03 * 72 / 8760), 12);
    fireEvent.change(picker, { target: { value: JSON.stringify(["da-1", "DA-RATE-1"]) } });
    const hourly = applyLastMutation().systemBasicEvents[0]!;
    expect(hourly.quantificationBasis).toEqual({ ...RATE_BASIS, failureRate: { value: 2e-5, unit: "HOUR" } });
    expect(hourly.probability).toBeCloseTo(1 - Math.exp(-2e-5 * 72), 12);
  });

  it("types a rate in the unit the analyst picks", () => {
    mockAnalysis = makeAnalysis(false, { quantificationBasis: RATE_BASIS });
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Rate unit" }), { target: { value: "YEAR" } });
    const typed = applyLastMutation().systemBasicEvents[0]!;
    expect(typed.quantificationBasis).toEqual({ ...RATE_BASIS, failureRate: { value: 1e-5, unit: "YEAR" } });
    expect(typed.probability).toBeCloseTo(1 - Math.exp(-1e-5 * 72 / 8760), 15);
  });

  it("flags a DA value that changed and applies it", () => {
    mockAnalysis = makeAnalysis(false, { probability: 0.002, controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-BE-1" } });
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("DA now gives 3.0E-3. This event still holds 2.0E-3.");
    fireEvent.click(screen.getByRole("button", { name: "Apply DA value" }));
    expect(applyLastMutation().systemBasicEvents[0]).toMatchObject({ probability: 0.003, controlledDataSource: { entityId: "DA-BE-1" } });
  });

  it("says nothing while the held value matches DA", () => {
    mockAnalysis = makeAnalysis(false, { probability: 0.003, controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-BE-1" } });
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", { name: "Apply DA value" })).toBeNull();
  });

  it("sets a house event's state through the fault-tree operation", () => {
    jest.mocked(applyFaultTreeOperation).mockImplementation((model, catalogue) => ({ model, catalogue }));
    render(<EventDialogContent context={{ kind: "house", id: "leaf-house", modelId: MODEL_ID }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "State" }), { target: { value: "false" } });
    expect(applyFaultTreeOperation).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: MODEL_ID }),
      expect.anything(),
      { type: "UPDATE_LEAF", leafId: "leaf-house", leaf: { ...HOUSE, state: false } },
    );
    expect(mockMutateSy).toHaveBeenCalledTimes(1);
  });
});
