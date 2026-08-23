import { fireEvent, render, screen } from "@testing-library/react";
import type { EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
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

describe("EventTreeEditor", () => {
  it("renders the canonical diagram and selects functional events and sequence paths", () => {
    const { onSelectionChange } = renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /RT Reactor trip/i }));
    expect(onSelectionChange).toHaveBeenCalledWith("FE-1");
    const sequence = Object.keys(model.sequences)[0]!;
    fireEvent.click(screen.getByRole("button", { name: new RegExp(sequence) }));
    expect(onSelectionChange).toHaveBeenCalledWith(sequence);
  });

  it("emits structural operations and supports read-only presentation", () => {
    const { onOperation, unmount } = renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add functional event" }));
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ kind: "ADD_FUNCTIONAL_EVENT" }));
    const operation = onOperation.mock.calls[0]?.[0];
    expect(operation?.kind === "ADD_FUNCTIONAL_EVENT" ? operation.functionalEvent.uuid : "").toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    unmount();
    renderEditor({ capabilities: { author: false, quantification: false } });
    expect(screen.getByTestId("event-tree-editor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add functional event" })).not.toBeInTheDocument();
  });

  it("disables quantification while validation errors remain", () => {
    renderEditor({ validation: [{ code: "ET_INVALID", message: "Invalid tree", severity: "ERROR" }] });
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "1 issue" })).toBeInTheDocument();
  });
});
