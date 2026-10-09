import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { HazardConditionedMethodModels } from "interfaces-mef-types/hazard-conditioned-models";
import { HazardFaultTreeEditor } from "../hazardConditionedModelEditors";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

const GATE_ID = "10000000-0000-4000-8000-000000000001";
const LEAF_ID = "10000000-0000-4000-8000-000000000002";
const EVENT_ID = "10000000-0000-4000-8000-000000000003";

function models(): HazardConditionedMethodModels {
  return {
    initiatingEventFaultTrees: [{
      modelId: "10000000-0000-4000-8000-000000000004",
      code: "HAZ-IE-FT",
      name: "Flood-induced loss of cooling",
      description: "",
      topGate: { gateId: GATE_ID },
      gates: [{ id: GATE_ID, kind: "GATE", gateType: "OR", code: "TOP", name: "Loss of cooling", description: "" }],
      leafNodes: [{ id: LEAF_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_ID }],
      gateInputs: [{ id: "10000000-0000-4000-8000-000000000005", gateId: GATE_ID, childId: LEAF_ID, order: 0 }],
      nodePositions: [],
      layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    }],
    faultTreeCatalogue: {
      basicEvents: [{
        id: EVENT_ID,
        code: "BE-SUMP",
        name: "Sump pump fails to run",
        description: "",
        probability: {
          value: 0.0004798848184297544,
          quantificationBasis: { kind: "FAILURE_RATE", failureRate: { value: 2e-5, unit: "HOUR" }, missionTime: { value: 24, unit: "HOUR" }, conversion: "EXPONENTIAL" },
        },
      }],
    },
    eventTrees: [],
    eventSequences: [],
  };
}

describe("HazardFaultTreeEditor", () => {
  it("reads a stored failure rate as a typed mission model and saves it in that form", async () => {
    const onChange = jest.fn<void, [HazardConditionedMethodModels]>();
    render(<HazardFaultTreeEditor models={models()} editable onChange={onChange} />);
    const box = screen.getByRole("button", { name: /Sump pump fails to run/ });

    expect(within(box).getByText("…")).toBeInTheDocument();
    await act(async () => {
      await settledWithPraxis(() => undefined);
    });
    expect(within(box).getByText("4.8e-4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Auto layout" }));
    const saved = onChange.mock.calls.at(-1)?.[0].faultTreeCatalogue.basicEvents[0];
    expect(saved?.probability).toEqual({
      value: 0.0004798848184297544,
      expression: {
        node: "MODEL",
        model: {
          form: "MISSION",
          rate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 2e-5 } } },
          missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } },
        },
      },
    });
  });
});
