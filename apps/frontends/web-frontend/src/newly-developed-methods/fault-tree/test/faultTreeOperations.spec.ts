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

  it("stacks each gate's basic events within that gate's recursive subtree", () => {
    const secondLeaf = "20000000-0000-4000-8000-000000000001";
    const thirdLeaf = "20000000-0000-4000-8000-000000000002";
    const before: FaultTreeEditorModel = {
      ...model(),
      leafNodes: [
        ...model().leafNodes,
        { id: secondLeaf, kind: "BASIC_EVENT_REFERENCE", basicEventId: ID.basic },
        { id: thirdLeaf, kind: "BASIC_EVENT_REFERENCE", basicEventId: ID.basic },
      ],
      gateInputs: [
        ...model().gateInputs,
        { id: "30000000-0000-4000-8000-000000000001", gateId: ID.left, childId: secondLeaf, order: 1 },
        { id: "30000000-0000-4000-8000-000000000002", gateId: ID.left, childId: thirdLeaf, order: 2 },
      ],
    };

    const positions = new Map(computeFaultTreeAutoLayout(before).map(({ nodeId, position }) => [nodeId, position]));
    const leaves = [ID.shared, secondLeaf, thirdLeaf].map((id) => positions.get(id)!);

    expect(new Set(leaves.map(({ x }) => x)).size).toBe(1);
    expect(leaves.map(({ y }) => y)).toEqual([...leaves.map(({ y }) => y)].sort((left, right) => left - right));
    expect(leaves[1].y - leaves[0].y).toBeGreaterThanOrEqual(192);
    expect(leaves[2].y - leaves[1].y).toBeGreaterThanOrEqual(192);
    expect(leaves.every(({ y }) => y > positions.get(ID.left)!.y)).toBe(true);
    expect(positions.get(ID.left)!.y).toBeGreaterThan(positions.get(ID.top)!.y);
    expect(positions.get(ID.right)!.y).toBeGreaterThan(positions.get(ID.top)!.y);
  });

  it("keeps non-basic terminals horizontal and puts transfers last within their parent subtree", () => {
    const houseId = "20000000-0000-4000-8000-000000000003";
    const undevelopedId = "20000000-0000-4000-8000-000000000004";
    const transferId = "20000000-0000-4000-8000-000000000005";
    const before: FaultTreeEditorModel = {
      ...model(),
      leafNodes: [
        ...model().leafNodes,
        { id: houseId, kind: "HOUSE_EVENT", code: "HE", name: "House", description: "", state: true },
        { id: undevelopedId, kind: "UNDEVELOPED_EVENT", code: "UE", name: "Undeveloped", description: "" },
        {
          id: transferId,
          kind: "TRANSFER_REFERENCE",
          code: "TR",
          name: "Transfer",
          description: "",
          target: {
            modelId: "40000000-0000-4000-8000-000000000001",
            entityId: "40000000-0000-4000-8000-000000000002",
          },
        },
      ],
      gateInputs: [
        ...model().gateInputs,
        { id: "30000000-0000-4000-8000-000000000003", gateId: ID.left, childId: houseId, order: 1 },
        { id: "30000000-0000-4000-8000-000000000004", gateId: ID.left, childId: undevelopedId, order: 2 },
        { id: "30000000-0000-4000-8000-000000000005", gateId: ID.left, childId: transferId, order: 3 },
      ],
    };

    const positions = new Map(computeFaultTreeAutoLayout(before).map(({ nodeId, position }) => [nodeId, position]));
    const horizontalNodes = [houseId, undevelopedId].map((id) => positions.get(id)!);
    const transfer = positions.get(transferId)!;

    expect(new Set(horizontalNodes.map(({ y }) => y)).size).toBe(1);
    expect(new Set(horizontalNodes.map(({ x }) => x)).size).toBe(horizontalNodes.length);
    expect(horizontalNodes.map(({ x }) => x)).toEqual(
      [...horizontalNodes.map(({ x }) => x)].sort((left, right) => left - right),
    );
    expect(transfer.x).toBeGreaterThan(Math.max(...horizontalNodes.map(({ x }) => x)));
    expect(transfer.y).toBe(positions.get(ID.left)!.y + 150);
  });

  it("keeps the captured six-gate, sixteen-basic-event, one-transfer shape collision free", () => {
    const gateIds = Array.from({ length: 6 }, (_, index) => `gate-${index}`);
    const basicIds = Array.from({ length: 16 }, (_, index) => `basic-${index}`);
    const transferId = "transfer-0";
    const gates: FaultTreeEditorModel["gates"] = gateIds.map((id, index) => ({
      id,
      kind: "GATE",
      gateType: index === 1 ? "K_OF_N" : "OR",
      ...(index === 1 ? { k: 2 } : {}),
      code: `G-${index}`,
      name: `Gate ${index}`,
      description: "",
    }));
    const leafNodes: FaultTreeEditorModel["leafNodes"] = [
      ...basicIds.map((id) => ({ id, kind: "BASIC_EVENT_REFERENCE" as const, basicEventId: ID.basic })),
      {
        id: transferId,
        kind: "TRANSFER_REFERENCE",
        code: "TR-DC",
        name: "Loss of DC",
        description: "",
        target: {
          modelId: "target-model",
          entityId: "target-gate",
        },
      },
    ];
    const gateInputs: FaultTreeEditorModel["gateInputs"] = [];
    const connect = (gateId: string, childId: string, order: number): void => {
      gateInputs.push({ id: `edge-${gateInputs.length}`, gateId, childId, order });
    };
    connect(gateIds[0], gateIds[1], 0);
    connect(gateIds[0], gateIds[5], 1);
    connect(gateIds[0], basicIds[15], 2);
    connect(gateIds[0], transferId, 3);
    [2, 3, 4].forEach((gateIndex, order) => connect(gateIds[1], gateIds[gateIndex], order));
    basicIds.slice(0, 12).forEach((basicId, index) => connect(gateIds[2 + Math.floor(index / 4)], basicId, index % 4));
    basicIds.slice(12, 15).forEach((basicId, order) => connect(gateIds[5], basicId, order));
    const before: FaultTreeEditorModel = {
      ...model(),
      topGate: { gateId: gateIds[0] },
      gates,
      leafNodes,
      gateInputs,
      nodePositions: [],
    };

    const positions = new Map(computeFaultTreeAutoLayout(before).map(({ nodeId, position }) => [nodeId, position]));
    const basicPositions = basicIds.map((id) => positions.get(id)!);
    const gatePositions = gateIds.map((id) => positions.get(id)!);
    const transferPosition = positions.get(transferId)!;
    const allPositions = [...basicPositions, ...gatePositions, transferPosition];

    expect(new Set(basicPositions.map(({ x }) => x)).size).toBeGreaterThan(1);
    expect(transferPosition.y).toBeGreaterThan(positions.get(gateIds[0])!.y);
    expect(basicPositions[15].x).toBeLessThan(positions.get(gateIds[1])!.x);
    expect(positions.get(gateIds[1])!.x).toBeLessThan(transferPosition.x);
    expect(positions.get(gateIds[5])!.x).toBeLessThan(transferPosition.x);
    expect(positions.get(gateIds[2])!.y).toBeGreaterThan(positions.get(gateIds[1])!.y);
    expect(basicPositions[0].y).toBeGreaterThan(positions.get(gateIds[2])!.y);
    for (let left = 0; left < allPositions.length; left += 1) {
      for (let right = left + 1; right < allPositions.length; right += 1) {
        const xSeparated = Math.abs(allPositions[left].x - allPositions[right].x) >= 184;
        const ySeparated = Math.abs(allPositions[left].y - allPositions[right].y) >= 66;
        expect(xSeparated || ySeparated).toBe(true);
      }
    }
  });
});
