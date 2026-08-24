import { fireEvent, render, screen } from "@testing-library/react";
import { EndState } from "interfaces-mef-types/core/events";
import type { EventSequence, EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import { applyEventTreeOperation } from "../eventTreeOperations";
import { EventTreeEditor } from "../eventTreeEditor";
import type { EventTreeOperation } from "../eventTreeTypes";

const model = applyEventTreeOperation({
  uuid: "ET-1",
  name: "Loss of flow",
  initiatingEventId: "IE-1",
  initiatingEventFrequency: { value: 0.01 },
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
