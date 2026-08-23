import type { FaultTreeEditorCatalogue, FaultTreeEditorModel } from "../faultTreeTypes";
import {
  FaultTreeOperationError,
  applyFaultTreeOperation,
  computeFaultTreeAutoLayout,
  createFaultTreeAutoLayoutOperation,
  nextFaultTreeId,
} from "../faultTreeOperations";

const ID = {
  model: "10000000-0000-4000-8000-000000000001",
  top: "10000000-0000-4000-8000-000000000002",
  left: "10000000-0000-4000-8000-000000000003",
  right: "10000000-0000-4000-8000-000000000004",
  shared: "10000000-0000-4000-8000-000000000005",
  basic: "10000000-0000-4000-8000-000000000006",
  topLeft: "10000000-0000-4000-8000-000000000007",
  topRight: "10000000-0000-4000-8000-000000000008",
  leftShared: "10000000-0000-4000-8000-000000000009",
  rightShared: "10000000-0000-4000-8000-00000000000a",
} as const;

function catalogue(): FaultTreeEditorCatalogue {
  return {
    basicEvents: [
      {
        id: ID.basic,
        code: "BE_SHARED",
        name: "Basic event",
        description: "",
        probability: { value: 0.1 },
      },
    ],
    presentations: [
      { basicEventId: ID.basic, failureModeShort: "FAIL", repairCredited: true },
    ],
  };
}

function model(): FaultTreeEditorModel {
  return {
    modelId: ID.model,
    code: "FT_TEST",
    name: "Fault tree",
    description: "",
    topGate: { gateId: ID.top },
    gates: [
      { id: ID.top, kind: "GATE", gateType: "OR", code: "TOP", name: "Top", description: "" },
      { id: ID.left, kind: "GATE", gateType: "AND", code: "LEFT", name: "Left", description: "" },
      { id: ID.right, kind: "GATE", gateType: "AND", code: "RIGHT", name: "Right", description: "" },
    ],
    leafNodes: [{ id: ID.shared, kind: "BASIC_EVENT_REFERENCE", basicEventId: ID.basic }],
    gateInputs: [
      { id: ID.topLeft, gateId: ID.top, childId: ID.left, order: 0 },
      { id: ID.topRight, gateId: ID.top, childId: ID.right, order: 1 },
      { id: ID.leftShared, gateId: ID.left, childId: ID.shared, order: 0 },
      { id: ID.rightShared, gateId: ID.right, childId: ID.shared, order: 0 },
    ],
    nodePositions: [],
    layout: {
      mode: "AUTOMATIC",
      direction: "TOP_TO_BOTTOM",
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

describe("fault-tree domain operations", () => {
  it("adds a basic-event reference and its parent connection atomically", () => {
    const before = model();
    const result = applyFaultTreeOperation(before, catalogue(), {
      type: "ADD_LEAF",
      leaf: { kind: "BASIC_EVENT_REFERENCE", basicEventId: ID.basic },
      parentGateId: ID.top,
      order: 1,
    });

    expect(result.affectedId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.model.leafNodes).toHaveLength(2);
    expect(result.model.gateInputs).toContainEqual(
      expect.objectContaining({ gateId: ID.top, childId: result.affectedId, order: 1 }),
    );
    expect(result.model.gateInputs.filter(({ gateId }) => gateId === ID.top).map(({ order }) => order)).toEqual([
      0, 1, 2,
    ]);
    expect(before.leafNodes).toHaveLength(1);
  });

  it("creates a basic-event definition and its child reference atomically", () => {
    const result = applyFaultTreeOperation(model(), catalogue(), {
      type: "ADD_BASIC_EVENT",
      basicEvent: {
        code: "BE_NEW",
        name: "New basic event",
        description: "",
        probability: { value: 0 },
      },
      parentGateId: ID.top,
    });

    const createdEvent = result.catalogue.basicEvents.find(({ code }) => code === "BE_NEW");
    const createdLeaf = result.model.leafNodes.find(
      (leaf) => leaf.kind === "BASIC_EVENT_REFERENCE" && leaf.basicEventId === createdEvent?.id,
    );
    expect(createdEvent).toBeDefined();
    expect(createdLeaf).toBeDefined();
    expect(result.model.gateInputs).toContainEqual(
      expect.objectContaining({ gateId: ID.top, childId: createdLeaf?.id }),
    );
  });

  it("allocates deterministic UUIDs without colliding with the current snapshot", () => {
    const before = model();
    const first = nextFaultTreeId(before, catalogue());
    const withFirst = applyFaultTreeOperation(before, catalogue(), {
      type: "ADD_GATE",
      gate: { kind: "GATE", gateType: "OR", code: "NEW", name: "New", description: "" },
    });

    expect(withFirst.affectedId).toBe(first);
    expect(nextFaultTreeId(withFirst.model, withFirst.catalogue)).not.toBe(first);
  });

  it("preserves a shared descendant when deleting one parent subtree", () => {
    const result = applyFaultTreeOperation(model(), catalogue(), {
      type: "DELETE_GATE",
      gateId: ID.left,
      subtree: true,
    });

    expect(result.model.gates.some(({ id }) => id === ID.left)).toBe(false);
    expect(result.model.leafNodes.some(({ id }) => id === ID.shared)).toBe(true);
    expect(result.model.gateInputs).toContainEqual(
      expect.objectContaining({ gateId: ID.right, childId: ID.shared }),
    );
  });

  it("deletes only orphaned descendants in a subtree", () => {
    const withoutOtherParent = applyFaultTreeOperation(model(), catalogue(), {
      type: "DISCONNECT",
      inputId: ID.rightShared,
    });
    const result = applyFaultTreeOperation(withoutOtherParent.model, withoutOtherParent.catalogue, {
      type: "DELETE_GATE",
      gateId: ID.left,
      subtree: true,
    });

    expect(result.model.leafNodes.some(({ id }) => id === ID.shared)).toBe(false);
  });

  it("rejects cycles, duplicate connections, and missing basic-event references", () => {
    expect(() =>
      applyFaultTreeOperation(model(), catalogue(), {
        type: "CONNECT",
        gateId: ID.left,
        childId: ID.top,
      }),
    ).toThrow(FaultTreeOperationError);

    expect(() =>
      applyFaultTreeOperation(model(), catalogue(), {
        type: "CONNECT",
        gateId: ID.right,
        childId: ID.shared,
      }),
    ).toThrow("already connected");

    expect(() =>
      applyFaultTreeOperation(model(), catalogue(), {
        type: "ADD_LEAF",
        leaf: {
          kind: "BASIC_EVENT_REFERENCE",
          basicEventId: "20000000-0000-4000-8000-000000000001",
        },
      }),
    ).toThrow("targets missing event");
  });

  it("reparents one incoming edge without disturbing another parent", () => {
    const disconnected = applyFaultTreeOperation(model(), catalogue(), {
      type: "DISCONNECT",
      inputId: ID.rightShared,
    });
    const result = applyFaultTreeOperation(disconnected.model, disconnected.catalogue, {
      type: "REPARENT",
      inputId: ID.leftShared,
      gateId: ID.right,
    });

    expect(result.model.gateInputs).toContainEqual({
      id: ID.leftShared,
      gateId: ID.right,
      childId: ID.shared,
      order: 0,
    });
    expect(result.model.gateInputs.some(({ gateId }) => gateId === ID.left)).toBe(false);
  });

  it("does not delete a catalogue event while a leaf references it", () => {
    expect(() =>
      applyFaultTreeOperation(model(), catalogue(), {
        type: "DELETE_BASIC_EVENT",
        basicEventId: ID.basic,
      }),
    ).toThrow("referenced basic event");
  });

  it("lays out every DAG node once and creates one atomic layout operation", () => {
    const before = model();
    const positions = computeFaultTreeAutoLayout(before);
    const operation = createFaultTreeAutoLayoutOperation(before, {
      direction: "LEFT_TO_RIGHT",
    });

    expect(positions).toHaveLength(before.gates.length + before.leafNodes.length);
    expect(new Set(positions.map(({ nodeId }) => nodeId)).size).toBe(positions.length);
    expect(operation).toMatchObject({
      type: "SET_LAYOUT",
      layout: { mode: "AUTOMATIC", direction: "LEFT_TO_RIGHT" },
    });
    expect(operation.nodePositions).toHaveLength(positions.length);
  });
});
