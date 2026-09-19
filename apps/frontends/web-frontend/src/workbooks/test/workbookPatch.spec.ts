import { applyWorkbookPatch, createWorkbookPatch, WorkbookPatchBodySchema } from "interfaces-shared-types/workbooks";

describe("workbook path patches", () => {
  test("sends only the edited leaf instead of the complete workbook", () => {
    const current = {
      name: "Internal Flood PRA",
      floodSources: [{ uuid: "FL-SRC-01", name: "Service water", pressureKpa: 720 }],
      notes: "Baseline",
    };
    const next = {
      ...current,
      floodSources: [{ ...current.floodSources[0]!, name: "Essential service water" }],
    };

    const operations = createWorkbookPatch(current, next);

    expect(operations).toEqual([
      { op: "replace", path: ["floodSources", 0, "name"], value: "Essential service water" },
    ]);
    expect(JSON.stringify({ operations })).not.toContain("pressureKpa");
    expect(applyWorkbookPatch(current, operations)).toEqual(next);
  });

  test("supports object additions, removals, and array edits", () => {
    const current = { records: [{ id: "A", note: "old" }, { id: "B", note: "keep" }], optional: "remove" };
    const next = { records: [{ id: "A", note: "new" }, { id: "C", note: "added" }], added: true };
    const operations = createWorkbookPatch(current, next);

    expect(applyWorkbookPatch(current, operations)).toEqual(next);
    expect(operations.some((operation) => operation.op === "remove")).toBe(true);
    expect(operations.some((operation) => operation.op === "add")).toBe(true);
  });

  test("sends one structural operation when a method node is inserted or removed", () => {
    const firstGate = { id: "gate-1", kind: "GATE", gateType: "OR", name: "Top gate" };
    const removedGate = { id: "gate-2", kind: "GATE", gateType: "AND", name: "Removed gate" };
    const lastGate = { id: "gate-3", kind: "GATE", gateType: "NOT", name: "Last gate" };
    const current = { systemLogicModels: [{ id: "ft-1", gates: [firstGate, removedGate, lastGate] }] };
    const next = { systemLogicModels: [{ id: "ft-1", gates: [firstGate, lastGate] }] };

    const operations = createWorkbookPatch(current, next);

    expect(operations).toEqual([
      { op: "remove", path: ["systemLogicModels", 0, "gates", 1] },
    ]);
    expect(applyWorkbookPatch(current, operations)).toEqual(next);

    const insertionOperations = createWorkbookPatch(next, current);
    expect(insertionOperations).toEqual([
      { op: "add", path: ["systemLogicModels", 0, "gates", 1], value: removedGate },
    ]);
    expect(applyWorkbookPatch(next, insertionOperations)).toEqual(current);
  });

  test("sends only changed coordinates when a method node moves", () => {
    const current = {
      systemLogicModels: [{
        id: "ft-1",
        nodePositions: [{ nodeId: "gate-1", position: { x: 120, y: 80 } }],
        layout: { direction: "TOP_TO_BOTTOM", algorithm: "MANUAL" },
      }],
    };
    const next = {
      systemLogicModels: [{
        ...current.systemLogicModels[0]!,
        nodePositions: [{ nodeId: "gate-1", position: { x: 240, y: 160 } }],
      }],
    };

    const operations = createWorkbookPatch(current, next);

    expect(operations).toEqual([
      { op: "replace", path: ["systemLogicModels", 0, "nodePositions", 0, "position", "x"], value: 240 },
      { op: "replace", path: ["systemLogicModels", 0, "nodePositions", 0, "position", "y"], value: 160 },
    ]);
    expect(JSON.stringify(operations)).not.toContain("layout");
    expect(JSON.stringify(operations)).not.toContain("nodeId");
    expect(applyWorkbookPatch(current, operations)).toEqual(next);
  });

  test("rejects empty, root, unsafe, and malformed patches", () => {
    expect(() => WorkbookPatchBodySchema.parse({ operations: [] })).toThrow();
    expect(() => applyWorkbookPatch({ name: "A" }, [{ op: "replace", path: [], value: { name: "B" } }])).toThrow();
    expect(() => applyWorkbookPatch({ name: "A" }, [{ op: "add", path: ["__proto__"], value: {} }])).toThrow("Unsafe workbook patch path");
    expect(() => applyWorkbookPatch({ records: [] }, [{ op: "replace", path: ["records", 2], value: "x" }])).toThrow();
  });
});
