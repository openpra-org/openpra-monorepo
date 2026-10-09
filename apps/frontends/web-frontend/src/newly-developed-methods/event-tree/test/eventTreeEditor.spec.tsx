import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { EndState } from "interfaces-mef-types/core/events";
import type { EventSequence, EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { applyEventTreeOperation } from "../eventTreeOperations";
import { EventTreeEditor } from "../eventTreeEditor";
import type { EventTreeOperation } from "../eventTreeTypes";
import { evaluateUncertainty } from "../../shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../shared/test/praxisUncertainty";

jest.mock("../../shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

async function praxisSettled(): Promise<void> {
  await act(async () => {
    await settledWithPraxis(() => undefined);
  });
}

const perYear = (value: number): UncertainExpression => ({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value } } });

const EMPTY_RESULT: EventTreeAnalysisResult = {
  schemaVersion: "1.0.0", runId: "run", owner: { workbookId: "workbook", workbookRevision: 1, modelId: "ET-1" },
  mode: "INDEPENDENT", completedAt: "2026-01-01T00:00:00Z", validationIssues: [], endStateAggregates: [], sequences: [],
};

const model = applyEventTreeOperation({
  uuid: "ET-1",
  name: "Loss of flow",
  initiatingEventId: "IE-1",
  initiatingEventFrequency: { expression: perYear(0.01) },
  functionalEvents: {},
  sequences: {},
  branches: {},
  initialState: { branchId: "" },
  implementsSrs: [],
} satisfies EventTree, {
  kind: "ADD_FUNCTIONAL_EVENT",
  functionalEvent: {
    uuid: "FE-1",
    name: "Reactor trip",
    label: "RT",
    order: 0,
    faultTreeTopEvent: {
      workbookId: "SY-1",
      modelId: "FT-1",
      entityId: "TOP-1",
      referenceType: "FAULT_TREE_TOP_EVENT",
    },
  },
});

function renderEditor(overrides: Partial<Parameters<typeof EventTreeEditor>[0]> = {}) {
  const onOperation = jest.fn<void, [EventTreeOperation]>();
  const onSelectionChange = jest.fn<void, [string | null]>();
  const rendered = render(<EventTreeEditor
    model={model}
    eventSequences={[]}
    availableInitiatingEvents={[{ id: "IE-1", name: "Loss of flow" }]}
    availableTransfers={[]}
    representation="event-sequence-diagram"
    capabilities={{ author: true, quantification: true }}
    selection={null}
    validation={[]}
    onOperation={onOperation}
    onRepresentationChange={jest.fn()}
    onSelectionChange={onSelectionChange}
    onRun={jest.fn()}
    {...overrides}
  />);
  return { onOperation, onSelectionChange, ...rendered };
}

function classifiedTreeFixture(): { linkedModel: EventTree; eventSequences: EventSequence[] } {
  const sequences = Object.values(model.sequences);
  const successful = sequences.find((sequence) => sequence.functionalEventStates?.["FE-1"] === "SUCCESS")!;
  const failed = sequences.find((sequence) => sequence.functionalEventStates?.["FE-1"] === "FAILURE")!;
  return {
    linkedModel: {
      ...model,
      sequences: {
        [successful.uuid]: {
          ...successful,
          eventSequenceId: "ES-SAFE",
          endState: EndState.SUCCESSFUL_MITIGATION,
        },
        [failed.uuid]: {
          ...failed,
          eventSequenceId: "ES-RELEASE",
          endState: EndState.RADIONUCLIDE_RELEASE,
        },
      },
    },
    eventSequences: [
      {
        uuid: "ES-SAFE",
        name: "Safe linked sequence",
        initiatingEventId: "IE-1",
        plantOperatingStateId: "POS-1",
        endState: EndState.SUCCESSFUL_MITIGATION,
        sequenceFamilyId: "ESF-OK",
        implementsSrs: [],
      },
      {
        uuid: "ES-RELEASE",
        name: "Release linked sequence",
        initiatingEventId: "IE-1",
        plantOperatingStateId: "POS-1",
        endState: EndState.RADIONUCLIDE_RELEASE,
        sequenceFamilyId: "ESF-LATE",
        releaseCategoryId: "RC-2",
        implementsSrs: [],
      },
    ],
  };
}

describe("EventTreeEditor", () => {
  it("selects a destination tree and displays each complete transfer path", () => {
    const source = Object.values(model.sequences)[0]!;
    const { onOperation } = renderEditor({
      selection: source.uuid,
      availableTransfers: [{ id: "ET-2", name: "Backup", sequenceIds: ["S", "F"] }],
      analysisResult: {
        schemaVersion: "1.0.0", runId: "run", owner: { workbookId: "workbook", workbookRevision: 1, modelId: model.uuid },
        mode: "INDEPENDENT", completedAt: "2026-01-01T00:00:00Z", validationIssues: [], endStateAggregates: [],
        sequences: [
          { sequenceId: "path-s", sequenceChain: [{ modelId: model.uuid, entityId: source.uuid }, { modelId: "ET-2", entityId: "S" }],
            path: [{ functionalEventId: "FE-1", outcome: "FAILURE" }, { functionalEventId: "FE-2", outcome: "SUCCESS" }],
            result: { kind: "END_STATE", endStateId: "SAFE" }, conditionalProbability: 0.14, annualFrequency: 0.0014 },
          { sequenceId: "path-f", sequenceChain: [{ modelId: model.uuid, entityId: source.uuid }, { modelId: "ET-2", entityId: "F" }],
            path: [{ functionalEventId: "FE-1", outcome: "FAILURE" }, { functionalEventId: "FE-2", outcome: "FAILURE" }],
            result: { kind: "END_STATE", endStateId: "RELEASE" }, conditionalProbability: 0.06, annualFrequency: 0.0006 },
        ],
      },
    });
    fireEvent.change(screen.getByLabelText("Sequence result"), { target: { value: "TRANSFER" } });
    expect(onOperation).toHaveBeenLastCalledWith({ kind: "SET_SEQUENCE_TRANSFER", sequenceId: source.uuid, targetEventTreeId: "ET-2" });
    expect(screen.queryByLabelText("Target sequence")).not.toBeInTheDocument();
    const results = within(screen.getByLabelText("Transferred sequence results"));
    expect(results.getAllByRole("row")).toHaveLength(3);
    expect(results.getByText(`${source.name} → Backup / Sequence 2`)).toBeInTheDocument();
    expect(results.getByText("FAILURE → FAILURE")).toBeInTheDocument();
    expect(results.getByText("0.06")).toBeInTheDocument();
  });

  it("edits the initiating frequency as an uncertain expression", () => {
    const { onOperation } = renderEditor();
    const frequency = within(screen.getByRole("group", { name: "Initiating-event frequency" }));
    const value = frequency.getByLabelText("Value");

    fireEvent.focus(value);
    fireEvent.change(value, { target: { value: "0.02" } });
    fireEvent.blur(value);
    fireEvent.change(frequency.getByLabelText("Law"), { target: { value: "LOGNORMAL" } });

    expect(onOperation).toHaveBeenCalledWith({
      kind: "UPDATE_TREE",
      changes: { initiatingEventFrequency: { expression: perYear(0.02), annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_760 } } },
    });
    expect(onOperation).toHaveBeenLastCalledWith({
      kind: "UPDATE_TREE",
      changes: { initiatingEventFrequency: expect.objectContaining({ expression: { node: "VALUE", value: { unit: "PER_YEAR", law: expect.objectContaining({ family: "LOGNORMAL", mean: 0.01 }) } } }) },
    });
    expect(screen.queryByRole("spinbutton", { name: "Initiating-event frequency" })).not.toBeInTheDocument();
  });

  it("keeps the time basis in the expression unit and the annualization beside it", () => {
    const { onOperation } = renderEditor();

    expect(Array.from(screen.getByLabelText<HTMLSelectElement>("Initiating-event frequency unit").options).map((option) => option.value)).toEqual(["PER_YEAR", "PER_HOUR"]);
    fireEvent.change(screen.getByLabelText("Initiating-event frequency unit"), { target: { value: "PER_HOUR" } });
    fireEvent.change(screen.getByLabelText("Annualization basis"), { target: { value: "CRITICAL_YEAR" } });
    fireEvent.blur(screen.getByLabelText("Annualization hours per year"), { target: { value: "7000" } });

    expect(onOperation.mock.calls.map(([operation]) => operation)).toEqual([
      { kind: "UPDATE_TREE", changes: { initiatingEventFrequency: { expression: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 0.01 } } }, annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_760 } } } },
      { kind: "UPDATE_TREE", changes: { initiatingEventFrequency: { expression: perYear(0.01), annualization: { basis: "CRITICAL_YEAR", hoursPerYear: 8_760 } } } },
      { kind: "UPDATE_TREE", changes: { initiatingEventFrequency: { expression: perYear(0.01), annualization: { basis: "PLANT_YEAR", hoursPerYear: 7_000 } } } },
    ]);
  });

  it("offers to add a frequency when the tree has none", () => {
    const { onOperation, unmount } = renderEditor({ model: { ...model, initiatingEventFrequency: undefined } });

    expect(screen.getByLabelText("Initiating-event frequency unit")).toBeDisabled();
    expect(screen.getByLabelText("Annualization basis")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Add a frequency" }));
    expect(onOperation).toHaveBeenCalledWith({
      kind: "UPDATE_TREE",
      changes: { initiatingEventFrequency: { expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: expect.any(Number) } } }, annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_760 } } },
    });

    unmount();
    renderEditor({ model: { ...model, initiatingEventFrequency: undefined }, capabilities: { author: false } });
    expect(screen.queryByRole("button", { name: "Add a frequency" })).not.toBeInTheDocument();
    expect(screen.getByText("No frequency yet.")).toBeInTheDocument();
  });

  it("seeds a missing frequency from the chosen initiating event", () => {
    const seeded = { expression: perYear(3e-3), annualization: { basis: "REACTOR_YEAR", hoursPerYear: 8_000 } } as const;
    const { onOperation } = renderEditor({
      model: { ...model, initiatingEventFrequency: undefined },
      availableInitiatingEvents: [{ id: "IE-1", name: "Loss of flow" }, { id: "IE-2", name: "Loss of heat sink", frequency: seeded }],
    });
    fireEvent.change(screen.getByLabelText("Initiating event"), { target: { value: "IE-2" } });
    expect(onOperation).toHaveBeenCalledWith({ kind: "UPDATE_TREE", changes: { initiatingEventId: "IE-2", initiatingEventFrequency: seeded } });
  });

  it("shows the PRAXIS point of the initiating frequency in the tree header", async () => {
    const { container, rerender } = renderEditor({ representation: "event-tree", analysisResult: EMPTY_RESULT });
    const header = (): string => container.querySelector(".estree__ie-freq")?.textContent ?? "";
    expect(header()).toBe("…");
    await praxisSettled();
    expect(header()).toBe("1.00e-2 /yr");

    const perHour: EventTree = { ...model, initiatingEventFrequency: { expression: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "LOGNORMAL", mean: 2e-5, errorFactor: 3, level: 0.95 } } } } };
    rerender(<EventTreeEditor
      model={perHour}
      eventSequences={[]}
      availableInitiatingEvents={[{ id: "IE-1", name: "Loss of flow" }]}
      availableTransfers={[]}
      representation="event-tree"
      capabilities={{ author: true, quantification: true }}
      selection={null}
      validation={[]}
      analysisResult={EMPTY_RESULT}
      onOperation={jest.fn()}
      onRepresentationChange={jest.fn()}
      onSelectionChange={jest.fn()}
    />);
    await praxisSettled();
    expect(header()).toBe("2.00e-5 /h");
  });

  it("names a frequency PRAXIS cannot evaluate", async () => {
    const linked: EventTree = { ...model, initiatingEventFrequency: { expression: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook", entityId: "IE-FREQ-UNKNOWN" } } } };
    const { container } = renderEditor({ model: linked, representation: "event-tree", analysisResult: EMPTY_RESULT });
    await praxisSettled();
    const header = container.querySelector(".estree__ie-freq");
    expect(header?.textContent).toBe("Not available");
    expect(header?.getAttribute("title")).toContain("IE-FREQ-UNKNOWN");
  });

  describe("linked and composed frequencies", () => {
    const yearly = { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-IE-01" } as const;
    const hourly = { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-IE-02" } as const;
    const frequencyParameters = new Map([
      [`${yearly.workbookId}:${yearly.entityId}`, { reference: yearly, expression: perYear(4e-2) }],
      [`${hourly.workbookId}:${hourly.entityId}`, { reference: hourly, expression: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 3e-6 } } } as const }],
    ]);
    const frequencyOptions = [
      { reference: yearly, label: "DA-IE-01 in Plant DA", unit: "PER_YEAR" },
      { reference: hourly, label: "DA-IE-02 in Plant DA", unit: "PER_HOUR" },
    ] as const;
    const withFrequency = (expression: UncertainExpression): EventTree => ({ ...model, initiatingEventFrequency: { expression } });
    const header = (container: HTMLElement): HTMLElement | null => container.querySelector(".estree__ie-freq");

    it("offers DA frequency links of the same unit and links one", () => {
      const { onOperation } = renderEditor({ frequencyOptions, frequencyParameters });
      const source = within(screen.getByRole("group", { name: "Initiating-event frequency" })).getByLabelText<HTMLSelectElement>("Source");
      expect(Array.from(source.options).map((option) => option.textContent)).toEqual(["Typed here", "DA-IE-01 in Plant DA"]);
      fireEvent.change(source, { target: { value: "da-1:DA-IE-01" } });
      expect(onOperation).toHaveBeenCalledWith({
        kind: "UPDATE_TREE",
        changes: { initiatingEventFrequency: { expression: { node: "PARAMETER", reference: yearly }, annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_760 } } },
      });
    });

    it("shows the PRAXIS point of a linked frequency in the unit of the DA parameter", async () => {
      const { container } = renderEditor({ model: withFrequency({ node: "PARAMETER", reference: hourly }), representation: "event-tree", analysisResult: EMPTY_RESULT, frequencyOptions, frequencyParameters });
      expect(screen.getByLabelText<HTMLSelectElement>("Initiating-event frequency unit").value).toBe("PER_HOUR");
      expect(within(screen.getByRole("group", { name: "Initiating-event frequency" })).getByLabelText<HTMLSelectElement>("Source").value).toBe("da-1:DA-IE-02");
      await praxisSettled();
      expect(header(container)?.textContent).toBe("3.00e-6 /h");
    });

    it("shows the PRAXIS point of a composed frequency and says it is composed", async () => {
      const composed: UncertainExpression = { node: "OPERATION", operation: "MULTIPLY", operands: [{ node: "PARAMETER", reference: yearly }, { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 0.5 } } }] };
      const { container } = renderEditor({ model: withFrequency(composed), representation: "event-tree", analysisResult: EMPTY_RESULT, frequencyOptions, frequencyParameters });
      expect(screen.getByText("Composed: (DA-IE-01 in Plant DA × 0.5)")).toBeInTheDocument();
      expect(within(screen.getByRole("group", { name: "Initiating-event frequency" })).queryByLabelText("Value")).not.toBeInTheDocument();
      await praxisSettled();
      expect(header(container)?.textContent).toBe("2.00e-2 /yr");
    });

    it("never converts a mix of per-year and per-hour terms with a fixed year", async () => {
      const mixed: UncertainExpression = { node: "OPERATION", operation: "ADD", operands: [{ node: "PARAMETER", reference: yearly }, { node: "PARAMETER", reference: hourly }] };
      const { container } = renderEditor({ model: withFrequency(mixed), representation: "event-tree", analysisResult: EMPTY_RESULT, frequencyParameters });
      await praxisSettled();
      expect(header(container)?.textContent).toBe("Mixed units");
      expect(jest.mocked(evaluateUncertainty).mock.calls.flatMap(([request]) => request.expressions.map((query) => query.expression))).not.toContainEqual(mixed);
    });
  });

  it("lets an author add the first functional event without showing a plus icon", () => {
    const emptyModel: EventTree = {
      ...model,
      functionalEvents: {},
      sequences: {},
      branches: {},
      initialState: { branchId: "" },
    };
    const { onOperation } = renderEditor({ model: emptyModel });

    const addFunctionalEvent = screen.getByRole("button", { name: "Add functional event" });
    expect(addFunctionalEvent).toHaveTextContent(/^Add functional event$/);
    fireEvent.click(addFunctionalEvent);

    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ kind: "ADD_FUNCTIONAL_EVENT" }));
  });

  it("places undo and redo inside the diagram toolbar", () => {
    const { container } = renderEditor();
    const diagramToolbar = container.querySelector(".estree__bar");
    const documentHeader = container.querySelector(".et-editor__header");
    const undo = screen.getByRole("button", { name: "Undo event-tree edit" });
    const redo = screen.getByRole("button", { name: "Redo event-tree edit" });

    expect(diagramToolbar).toContainElement(undo);
    expect(diagramToolbar).toContainElement(redo);
    expect(documentHeader).not.toContainElement(undo);
    expect(documentHeader).not.toContainElement(redo);
  });

  it("renders the canonical diagram and selects functional events and sequence paths", () => {
    const { onSelectionChange } = renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /RT Reactor trip/i }));
    expect(onSelectionChange).toHaveBeenCalledWith("FE-1");
    const sequence = Object.keys(model.sequences)[0]!;
    fireEvent.click(screen.getByRole("button", { name: new RegExp(sequence) }));
    expect(onSelectionChange).toHaveBeenCalledWith(sequence);
  });

  it("shows only the applicable sequence family or release category on end-state nodes", () => {
    const { linkedModel, eventSequences } = classifiedTreeFixture();
    renderEditor({ model: linkedModel, eventSequences, representation: "event-tree" });

    const safeEndState = screen.getByRole("button", { name: /Safe linked sequence/i });
    const releaseEndState = screen.getByRole("button", { name: /Release linked sequence/i });

    expect(safeEndState).toHaveTextContent(/^ESF-OK$/);
    expect(releaseEndState).toHaveTextContent(/^RC-2$/);
    expect(releaseEndState).not.toHaveTextContent("ESF-LATE");

    fireEvent.click(safeEndState);
    expect(screen.queryByText("Safe linked sequence")).not.toBeInTheDocument();
  });

  it("uses the standard inspector typography for an unlinked functional event", () => {
    const unlinkedModel: EventTree = {
      ...model,
      functionalEvents: {
        "FE-1": {
          ...model.functionalEvents["FE-1"]!,
          faultTreeTopEvent: undefined,
        },
      },
    };
    const onSelectFaultTreeLink = jest.fn();
    renderEditor({ model: unlinkedModel, selection: "FE-1", onSelectFaultTreeLink });

    expect(screen.getByText("Not linked")).toHaveClass("et-editor__reference-status");
    fireEvent.click(screen.getByRole("button", { name: "Link fault tree" }));
    expect(onSelectFaultTreeLink).toHaveBeenCalledWith(expect.objectContaining({ uuid: "FE-1" }));
  });

  it("highlights only the selected route through a classic event-tree fork", () => {
    const { linkedModel, eventSequences } = classifiedTreeFixture();
    const { container } = renderEditor({ model: linkedModel, eventSequences, representation: "event-tree" });
    const selectedEndState = screen.getByRole("button", { name: /Safe linked sequence/i });
    const oppositeEndState = screen.getByRole("button", { name: /Release linked sequence/i });
    const selectedY = Number.parseFloat(selectedEndState.style.top);
    const oppositeY = Number.parseFloat(oppositeEndState.style.top);

    fireEvent.mouseEnter(selectedEndState);

    const verticalBranches = Array.from(container.querySelectorAll<SVGLineElement>(".estree__seg"))
      .filter((line) => line.getAttribute("x1") === line.getAttribute("x2"));
    const selectedBranch = verticalBranches.find((line) =>
      [Number(line.getAttribute("y1")), Number(line.getAttribute("y2"))].includes(selectedY));
    const oppositeBranch = verticalBranches.find((line) =>
      [Number(line.getAttribute("y1")), Number(line.getAttribute("y2"))].includes(oppositeY));

    expect(selectedBranch).toHaveClass("estree__seg--hot");
    expect(oppositeBranch).not.toHaveClass("estree__seg--hot");
    expect(container.querySelectorAll(".estree__seg--hot")).toHaveLength(3);
  });

  it("emits structural operations and supports read-only presentation", () => {
    const { onOperation, unmount } = renderEditor();
    fireEvent.contextMenu(screen.getByRole("button", { name: /RT Reactor trip/i }), { clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Insert functional event after" }));
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ kind: "ADD_FUNCTIONAL_EVENT" }));
    const operation = onOperation.mock.calls[0]?.[0];
    expect(operation?.kind === "ADD_FUNCTIONAL_EVENT" ? operation.functionalEvent.uuid : "").toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    unmount();
    renderEditor({ capabilities: { author: false, quantification: false } });
    expect(screen.getByTestId("event-tree-editor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add functional event" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ordered functional events")).not.toBeInTheDocument();
  });

  it("disables quantification while validation errors remain", () => {
    renderEditor({ validation: [{ code: "ET_INVALID", message: "Invalid tree", severity: "ERROR" }] });
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "1 issue" })).toBeInTheDocument();
  });

  it("keeps long validation codes and messages in separate wrapping columns", () => {
    const code = "ET_FUNCTIONAL_EVENT_REFERENCE_WITH_AN_EXCEPTIONALLY_LONG_CODE";
    const message = "The selected functional event has a long validation explanation that must remain readable without overlapping its code.";
    renderEditor({ validation: [{ code, message, severity: "ERROR" }] });

    fireEvent.click(screen.getByRole("button", { name: "1 issue" }));
    expect(screen.getByText(code)).toHaveClass("et-editor__finding-code");
    expect(screen.getByText(message)).toHaveClass("et-editor__finding-message");
  });

  it("closes a context menu before handling a left-click selection", () => {
    const { onSelectionChange } = renderEditor();
    const functionalEvent = screen.getByRole("button", { name: /RT Reactor trip/i });

    fireEvent.contextMenu(functionalEvent, { clientX: 100, clientY: 100 });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(functionalEvent);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenLastCalledWith("FE-1");
  });

  it("opens functional-event and end-state actions from their context menus", () => {
    const onSelectFaultTreeLink = jest.fn();
    const { onOperation, onSelectionChange } = renderEditor({ onSelectFaultTreeLink });
    const functionalEvent = screen.getByRole("button", { name: /RT Reactor trip/i });
    onSelectionChange.mockClear();
    fireEvent.contextMenu(functionalEvent, { clientX: 100, clientY: 100 });
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    expect(onSelectionChange).not.toHaveBeenCalledWith("FE-1");
    fireEvent.click(screen.getByRole("menuitem", { name: "Change fault-tree link" }));
    expect(onSelectFaultTreeLink).toHaveBeenCalledWith(expect.objectContaining({ uuid: "FE-1" }));

    const sequenceId = Object.keys(model.sequences)[0]!;
    onSelectionChange.mockClear();
    fireEvent.contextMenu(screen.getByRole("button", { name: new RegExp(sequenceId) }), { clientX: 100, clientY: 100 });
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    expect(onSelectionChange).not.toHaveBeenCalledWith(sequenceId);
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark radionuclide release" }));
    expect(onOperation).toHaveBeenCalledWith({
      kind: "SET_SEQUENCE_END_STATE",
      sequenceId,
      endState: "RADIONUCLIDE_RELEASE",
    });
  });

  it("confirms destructive structural changes in the shared editor dialog", () => {
    const { onOperation } = renderEditor();
    fireEvent.contextMenu(screen.getByRole("button", { name: /RT Reactor trip/i }), { clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete functional event…" }));

    expect(screen.getByRole("alertdialog", { name: "Delete RT?" })).toBeInTheDocument();
    expect(onOperation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete functional event" }));

    expect(onOperation).toHaveBeenCalledWith({ kind: "DELETE_FUNCTIONAL_EVENT", functionalEventId: "FE-1" });
  });

  it("labels an absent functional-event state as bypassed rather than failed", () => {
    const sequenceId = Object.keys(model.sequences)[0]!;
    const bypassedModel: EventTree = {
      ...model,
      sequences: {
        ...model.sequences,
        [sequenceId]: { ...model.sequences[sequenceId]!, functionalEventStates: { "FE-1": "BYPASSED" } },
      },
    };
    renderEditor({ model: bypassedModel, representation: "table" });
    expect(screen.getByText("RT B")).toHaveClass("et-editor__path-step--bypassed");
  });
});
