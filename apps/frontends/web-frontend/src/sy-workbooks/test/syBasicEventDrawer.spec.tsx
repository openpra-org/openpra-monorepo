import { fireEvent, render, screen } from "@testing-library/react";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { DrawerContent } from "../syScreens2";

const mockMutateSy = jest.fn();
const mockAnalysis = {
  systemDefinitions: [],
  systemLogicModels: [],
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
  parameterType: "PROBABILITY" as const,
  value: 0.025,
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
    controlledHumanFailures: mockControlledHumanFailures,
  }),
}));

describe("SY basic-event controlled probability authoring", () => {
  beforeEach(() => mockMutateSy.mockClear());

  it("stores a typed DA parameter reference and its current display value", () => {
    render(<DrawerContent context={{ kind: "be", id: "be-1" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Data Analysis parameter" }), {
      target: { value: JSON.stringify(["da-workbook", "parameter-1"]) },
    });

    expect(mockMutateSy).toHaveBeenCalledTimes(1);
    const next = mockMutateSy.mock.calls[0]![0](mockAnalysis) as SystemsAnalysis;
    expect(next.systemBasicEvents[0]).toMatchObject({
      probability: 0.025,
      controlledDataSource: {
        referenceType: "WORKBOOK_PARAMETER",
        workbookId: "da-workbook",
        entityId: "parameter-1",
      },
    });
    expect(next.systemBasicEvents[0]?.dataAnalysisBasicEventRef).toBeUndefined();
  });

  it("stores the exact HRA event and HEP quantification for a human-error event", () => {
    render(<DrawerContent context={{ kind: "be", id: "be-hfe" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Human Reliability event and HEP" }), {
      target: { value: JSON.stringify(["hr-workbook", "hfe-1", "hep-1"]) },
    });

    expect(mockMutateSy).toHaveBeenCalledTimes(1);
    const next = mockMutateSy.mock.calls[0]![0](mockAnalysis) as SystemsAnalysis;
    expect(next.systemBasicEvents[1]).toMatchObject({
      probability: 0.037,
      controlledDataSource: {
        referenceType: "HUMAN_FAILURE_EVENT",
        workbookId: "hr-workbook",
        entityId: "hfe-1",
        quantificationId: "hep-1",
      },
    });
    expect(next.systemBasicEvents[1]?.dataAnalysisBasicEventRef).toBeUndefined();
  });

  it("links a Systems Analysis HFE integration to the same exact HRA quantification", () => {
    render(<DrawerContent context={{ kind: "hfe", id: "integration-1" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", {
      name: "Integrated Human Reliability event and HEP",
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
