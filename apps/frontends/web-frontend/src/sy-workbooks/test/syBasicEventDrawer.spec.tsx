import { fireEvent, render, screen } from "@testing-library/react";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { DrawerContent } from "../syScreens2";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => jest.requireActual("./syUncertaintyPraxis"));

const mockMutateSy = jest.fn();
const mockAnalysis = {
  systemDefinitions: [],
  systemLogicModels: [],
  commonCauseFailureGroups: [],
  humanFailureEventIntegrations: [{
    uuid: "integration-1",
    hfeReference: "",
    system: "system-1",
    taskDescription: "",
    hfeType: "POST_INITIATOR",
    isTestMaintenance: false,
    implementsSrs: [],
  }],
  systemBasicEvents: [{
    uuid: "be-1",
    code: "BE-1",
    name: "Pump fails",
    eventType: "BASIC",
    expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.1 } } },
    implementsSrs: [],
  }, {
    uuid: "be-ccf",
    code: "CCF-1",
    name: "Pumps fail together",
    eventType: "BASIC",
    failureMode: "COMMON_CAUSE_FAILURE",
    probability: 0.1,
    implementsSrs: [],
  }, {
    uuid: "be-hfe",
    code: "HFE-1",
    name: "Operator fails to align cooling",
    eventType: "BASIC",
    failureMode: "HUMAN_ERROR",
    probability: 0.1,
    implementsSrs: [],
  }],
} as unknown as SystemsAnalysis;

const mockControlledParameters = [{
  workbookId: "da-workbook",
  workbookName: "Approved DA",
  parameterId: "parameter-1",
  parameterName: "Pump demand failure",
  estimate: { node: "VALUE" as const, value: { unit: "PROBABILITY" as const, law: { family: "POINT" as const, value: 0.025 } } },
  unit: "PROBABILITY" as const,
}];

const mockControlledLegacyParameters = [{
  workbookId: "da-workbook",
  workbookName: "Approved DA",
  parameterId: "parameter-rate",
  parameterName: "Pump group rate",
  parameterType: "FAILURE_RATE" as const,
  value: 0.002,
  rateUnit: "HOUR" as const,
}];

const mockControlledHumanFailures = [{
  workbookId: "hr-workbook",
  workbookName: "Approved HRA",
  humanFailureEventId: "hfe-1",
  humanFailureEventName: "Operator fails to align cooling",
  hfeTiming: "POST_INITIATOR" as const,
  quantificationId: "hep-1",
  methodology: "THERP",
  value: 0.037,
  valueKind: "MEAN" as const,
}];

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => ({
    sy: mockAnalysis,
    editable: true,
    mutateSy: mockMutateSy,
    shortOf: (id: string) => id,
    controlledParameters: mockControlledParameters,
    controlledLegacyParameters: mockControlledLegacyParameters,
    controlledHumanFailures: mockControlledHumanFailures,
    controlledFailureModes: [],
  }),
}));

const originalEvents = structuredClone(mockAnalysis.systemBasicEvents);

describe("SY basic-event controlled probability authoring", () => {
  beforeEach(() => {
    mockMutateSy.mockClear();
    mockAnalysis.systemBasicEvents = structuredClone(originalEvents);
  });

  it("shows legacy rate settings on a common cause event without calculating and converts only on review", () => {
    mockAnalysis.systemBasicEvents[1]!.quantificationBasis = {
      kind: "FAILURE_RATE", conversion: "LINEAR",
      failureRate: { value: .001, unit: "HOUR" }, missionTime: { value: 100, unit: "HOUR" },
    };
    render(<DrawerContent context={{ kind: "be", id: "be-ccf" }} onClose={jest.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Review the rate and mission time");
    expect(screen.getByRole("spinbutton", { name: "Failure rate" })).toHaveValue(0.001);
    expect(screen.getByRole("spinbutton", { name: "Mission time" })).toHaveValue(100);
    expect(screen.queryByRole("combobox", { name: "Input" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Data Analysis parameter" })).toBeDisabled();
    expect(mockMutateSy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use exponential conversion" }));
    const next = mockMutateSy.mock.calls[0]![0](mockAnalysis) as SystemsAnalysis;
    expect(next.systemBasicEvents[1]).toMatchObject({ probability: .09516258196404048,
      quantificationBasis: { conversion: "EXPONENTIAL", failureRate: { value: .001, unit: "HOUR" }, missionTime: { value: 100, unit: "HOUR" } },
    });
    expect(mockAnalysis.systemBasicEvents[1]?.probability).toBe(.1);
  });

  it("points to Step 01 Interfaces when no DA or HR workbook is linked", () => {
    const parameters = mockControlledParameters.splice(0);
    const legacyParameters = mockControlledLegacyParameters.splice(0);
    const humanFailures = mockControlledHumanFailures.splice(0);
    try {
      const { unmount } = render(<DrawerContent context={{ kind: "be", id: "be-1" }} onClose={jest.fn()} />);
      expect(screen.getByText("Typed. Link a DA workbook in Step 01 Interfaces to pick a parameter.")).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Source" })).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Value" })).toHaveValue("0.1");
      unmount();
      render(<DrawerContent context={{ kind: "be", id: "be-hfe" }} onClose={jest.fn()} />);
      expect(screen.getByText("Typed. Link an HR workbook in Step 01 Interfaces to pick its event and HEP.")).toBeInTheDocument();
    } finally {
      mockControlledParameters.push(...parameters);
      mockControlledLegacyParameters.push(...legacyParameters);
      mockControlledHumanFailures.push(...humanFailures);
    }
  });

  it("stores the DA parameter reference as the expression and no cached value", () => {
    render(<DrawerContent context={{ kind: "be", id: "be-1" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), {
      target: { value: "da-workbook:parameter-1" },
    });

    expect(mockMutateSy).toHaveBeenCalledTimes(1);
    const next = mockMutateSy.mock.calls[0]![0](mockAnalysis) as SystemsAnalysis;
    expect(next.systemBasicEvents[0]).toEqual(expect.objectContaining({
      expression: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook", entityId: "parameter-1" } },
    }));
    expect(next.systemBasicEvents[0]).not.toHaveProperty("probability");
    expect(next.systemBasicEvents[0]).not.toHaveProperty("controlledDataSource");
    expect(next.systemBasicEvents[0]).not.toHaveProperty("dataAnalysisBasicEventRef");
  });

  it("stores the exact HRA event and HEP quantification for a human-error event", () => {
    render(<DrawerContent context={{ kind: "be", id: "be-hfe" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Human Reliability event and HEP" }), {
      target: { value: JSON.stringify(["hr-workbook", "hfe-1", "hep-1"]) },
    });

    expect(mockMutateSy).toHaveBeenCalledTimes(1);
    const next = mockMutateSy.mock.calls[0]![0](mockAnalysis) as SystemsAnalysis;
    expect(next.systemBasicEvents[2]).toMatchObject({
      probability: 0.037,
      controlledDataSource: {
        referenceType: "HUMAN_FAILURE_EVENT",
        workbookId: "hr-workbook",
        entityId: "hfe-1",
        quantificationId: "hep-1",
      },
    });
    expect(next.systemBasicEvents[2]?.dataAnalysisBasicEventRef).toBeUndefined();
  });

  it("links a Systems Analysis HFE integration to the same exact HRA quantification", () => {
    render(<DrawerContent context={{ kind: "hfe", id: "integration-1" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", {
      name: "Human Reliability event and HEP",
    }), {
      target: { value: JSON.stringify(["hr-workbook", "hfe-1", "hep-1"]) },
    });

    const next = mockMutateSy.mock.calls[0]![0](mockAnalysis) as SystemsAnalysis;
    expect(next.humanFailureEventIntegrations[0]).toMatchObject({
      hfeReference: "hfe-1",
      hfeSource: {
        referenceType: "HUMAN_FAILURE_EVENT",
        workbookId: "hr-workbook",
        entityId: "hfe-1",
        quantificationId: "hep-1",
      },
      hfeType: "POST_INITIATOR",
      taskDescription: "Operator fails to align cooling",
    });
  });
});
