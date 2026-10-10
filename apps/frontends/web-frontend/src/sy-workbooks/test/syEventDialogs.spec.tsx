import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { applyFaultTreeOperation } from "../../newly-developed-methods/fault-tree";
import { EventDialogContent } from "../SyEventDialogs";
import { settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { scMissionTimeOptions, scMissionTimeTable, type ScMissionTimes } from "../../sc-workbooks/scMissionTimeLinks";

jest.mock("../../newly-developed-methods/fault-tree", () => ({
  FaultTreeEditor: jest.fn(() => null),
  applyFaultTreeOperation: jest.fn(),
}));

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => jest.requireActual("./syUncertaintyPraxis"));

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

const SC_WORKBOOK = "sc-1";

const SC: ScMissionTimes = {
  missionTimes: [{ uuid: "MT-LOCC", eventSequenceReference: "ES-7", missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 72 } } }, basis: "", safeStableStateAchievedWithinMissionTime: true, analysisReferences: [], implementsSrs: [] }],
  componentMissionTimes: [{ uuid: "CMT-PUMP", componentId: "CCW pump", missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } }, eventSequenceReference: "ES-7", analysisReferences: [], implementsSrs: [] }],
};

const SC_LINK: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: SC_WORKBOOK, entityId: "MT-LOCC" } };

const mockLinks = { scMissionTimeOptions: scMissionTimeOptions(SC_WORKBOOK, SC), scMissionTimeTable: scMissionTimeTable(SC_WORKBOOK, SC) };

function point(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function makeAnalysis(repairModeled: boolean, event: Partial<BasicEvent> = {}): SystemsAnalysis {
  return {
    systemDefinitions: [{
      uuid: SYSTEM_ID,
      name: "Component cooling water",
      boundaries: [],
      successCriteriaIds: [],
      missionTime: SC_LINK,
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
      expression: point(0.01),
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
  estimate: point(0.003),
  unit: "PROBABILITY" as const,
  failureModeId: "FM-FTS",
  failureModeName: "Fails to start",
}, {
  workbookId: "da-1",
  workbookName: "Approved DA",
  parameterId: "DA-RATE-1",
  parameterName: "Cooling-water pump fails to run",
  estimate: { node: "VALUE" as const, value: { unit: "PER_HOUR" as const, law: { family: "POINT" as const, value: 2e-5 } } },
  unit: "PER_HOUR" as const,
}];
const mockLegacyParameters = [{
  workbookId: "da-1",
  workbookName: "Approved DA",
  parameterId: "DA-CCF-TOTAL",
  parameterName: "Pump group common cause",
  parameterType: "PROBABILITY" as const,
  value: 0.003,
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
    links: mockLinks,
    editable: true,
    mutateSy: mockMutateSy,
    shortOf: (id: string) => id,
    controlledParameters: mockParameters,
    controlledCcfVectors: [],
    controlledCcfFactors: [],
    controlledLegacyParameters: mockLegacyParameters,
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

function collapsedCcfEvent(event: Partial<BasicEvent> = {}): Partial<BasicEvent> {
  return { failureMode: "COMMON_CAUSE_FAILURE", expression: undefined, probability: 0.002, ...event };
}

describe("SY event dialogs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalysis = makeAnalysis(false);
  });

  it("types a component value into the expression and shows its point value", async () => {
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText("1.0E-2")).toBeInTheDocument());
    expect(screen.queryByRole("spinbutton", { name: "Probability" })).not.toBeInTheDocument();
    commit(screen.getByRole("textbox", { name: "Value" }), "0.05");
    const event = applyLastMutation().systemBasicEvents[0]!;
    expect(event.expression).toEqual(point(0.05));
    expect(event).not.toHaveProperty("probability");
    expect(event).not.toHaveProperty("quantificationBasis");
  });

  it("carries the shared member value into the common cause group total as an expression", () => {
    const base = makeAnalysis(false);
    const partner: BasicEvent = { uuid: "be-pump-b", code: "CCW-PMPB-FS", name: "Pump B fails to start", eventType: "BASIC", failureMode: "FAILURE_TO_START", expression: point(0.05), implementsSrs: [] };
    mockAnalysis = {
      ...base,
      systemBasicEvents: [...base.systemBasicEvents, partner],
      commonCauseFailureGroups: [{
        uuid: "ccf-pumps", name: "Pumps", description: "", scope: "INTRASYSTEM", affectedComponents: [], affectedSystems: [SYSTEM_ID],
        factors: { model: "BETA_FACTOR", beta: { node: "VALUE", value: { unit: "FRACTION", law: { family: "POINT", value: 0.05 } } } },
        total: point(0.02),
        members: { basicEvents: [{ id: "be-pump" }, { id: "be-pump-b" }] },
        implementsSrs: [],
      }],
    };
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    commit(screen.getByRole("textbox", { name: "Value" }), "0.05");
    expect(applyLastMutation().commonCauseFailureGroups[0]?.total).toEqual(point(0.05));
    commit(screen.getByRole("textbox", { name: "Value" }), "0.07");
    expect(applyLastMutation().commonCauseFailureGroups[0]?.total).toEqual(point(0.02));
  });

  it("switches to a failure rate over a link to the system mission time", () => {
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Form" }), { target: { value: "MISSION" } });
    expect(applyLastMutation().systemBasicEvents[0]!.expression).toEqual({
      node: "MODEL",
      model: {
        form: "MISSION",
        rate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 1e-5 } } },
        missionTime: SC_LINK,
      },
    });
  });

  it("offers every SC mission time in the mission time slot and evaluates the link with PRAXIS", async () => {
    mockAnalysis = makeAnalysis(false, { expression: { node: "MODEL", model: { form: "MISSION", rate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 1e-5 } } }, missionTime: SC_LINK } } });
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);
    await act(async () => { await settledWithPraxis(() => undefined); });

    expect(screen.getByText("7.2E-4")).toBeInTheDocument();
    const [rateSource, timeSource] = screen.getAllByRole("combobox", { name: "Source" });
    expect(rateSource).not.toHaveTextContent("MT-LOCC");
    expect(timeSource).toHaveTextContent("MT-LOCC · sequence ES-7");
    fireEvent.change(timeSource!, { target: { value: `${SC_WORKBOOK}:CMT-PUMP` } });
    expect(applyLastMutation().systemBasicEvents[0]!.expression).toMatchObject({ model: { missionTime: { node: "PARAMETER", reference: { entityId: "CMT-PUMP" } } } });
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
    expect(applyLastMutation().systemBasicEvents[0]).toMatchObject({ failureMode: "Fails to start", failureModeSource: { workbookId: "da-1", failureModeId: "FM-FTS" }, expression: point(0.01) });
  });

  it("types a failure mode and keeps the standard code for a standard label", () => {
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    commit(screen.getByRole("combobox", { name: "Failure mode" }), "Fail to run");
    expect(applyLastMutation().systemBasicEvents[0]!.failureMode).toBe("FAILURE_TO_RUN");
    commit(screen.getByRole("combobox", { name: "Failure mode" }), "Seal leaks past the shaft");
    expect(applyLastMutation().systemBasicEvents[0]).toMatchObject({ failureMode: "Seal leaks past the shaft" });
    expect(applyLastMutation().systemBasicEvents[0]!.failureModeSource).toBeUndefined();
  });

  it("moves the value between the expression and the probability when the event becomes a human failure", () => {
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    commit(screen.getByRole("combobox", { name: "Failure mode" }), "Human failure event");
    const human = applyLastMutation().systemBasicEvents[0]!;
    expect(human).toMatchObject({ failureMode: "HUMAN_ERROR", probability: 0.01, quantificationBasis: { kind: "PROBABILITY" } });
    expect(human).not.toHaveProperty("expression");
  });

  it("links a DA probability estimate and brings its failure mode", () => {
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    expect(screen.queryByRole("option", { name: "Approved DA · Cooling-water pump fails to run" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: "da-1:DA-BE-1" } });
    const event = applyLastMutation().systemBasicEvents[0]!;
    expect(event).toMatchObject({
      expression: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-BE-1" } },
      failureMode: "Fails to start",
      failureModeSource: { workbookId: "da-1", failureModeId: "FM-FTS" },
    });
    expect(event).not.toHaveProperty("controlledDataSource");
  });

  it("links a DA rate inside a mission model", () => {
    mockAnalysis = makeAnalysis(false, { expression: { node: "MODEL", model: { form: "MISSION",
      rate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 1e-5 } } },
      missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 72 } } } } } });
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    expect(screen.queryByRole("option", { name: "Approved DA · Cooling-water pump fails to start" })).not.toBeInTheDocument();
    fireEvent.change(screen.getAllByRole("combobox", { name: "Source" })[0]!, { target: { value: "da-1:DA-RATE-1" } });
    expect(applyLastMutation().systemBasicEvents[0]!.expression).toEqual({ node: "MODEL", model: { form: "MISSION",
      rate: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-RATE-1" } },
      missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 72 } } } } });
  });

  it("offers to add a value when a component event has none", () => {
    mockAnalysis = makeAnalysis(false, { expression: undefined });
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    expect(screen.getByText("No value yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add a value" }));
    expect(applyLastMutation().systemBasicEvents[0]!.expression).toEqual(point(0));
  });

  it("keeps the probability and rate controls on a common cause event", () => {
    mockAnalysis = makeAnalysis(false, collapsedCcfEvent({ quantificationBasis: RATE_BASIS }));
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    expect(screen.queryByRole("combobox", { name: "Form" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Rate unit" }), { target: { value: "YEAR" } });
    const typed = applyLastMutation().systemBasicEvents[0]!;
    expect(typed.quantificationBasis).toEqual({ ...RATE_BASIS, failureRate: { value: 1e-5, unit: "YEAR" } });
    expect(typed.probability).toBeCloseTo(1 - Math.exp(-1e-5 * 72 / 8760), 15);
  });

  it("flags a DA value that changed on a common cause event and applies it", () => {
    mockAnalysis = makeAnalysis(false, collapsedCcfEvent({ controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-CCF-TOTAL" } }));
    render(<EventDialogContent context={{ kind: "be", id: "be-pump" }} onClose={jest.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("DA now gives 3.0E-3. This event still holds 2.0E-3.");
    fireEvent.click(screen.getByRole("button", { name: "Apply DA value" }));
    expect(applyLastMutation().systemBasicEvents[0]).toMatchObject({ probability: 0.003, controlledDataSource: { entityId: "DA-CCF-TOTAL" } });
  });

  it("says nothing on a component event linked to DA", () => {
    mockAnalysis = makeAnalysis(false, { expression: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-BE-1" } } });
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
