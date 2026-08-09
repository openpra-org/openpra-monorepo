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

  test("rejects empty, root, unsafe, and malformed patches", () => {
    expect(() => WorkbookPatchBodySchema.parse({ operations: [] })).toThrow();
    expect(() => applyWorkbookPatch({ name: "A" }, [{ op: "replace", path: [], value: { name: "B" } }])).toThrow();
    expect(() => applyWorkbookPatch({ name: "A" }, [{ op: "add", path: ["__proto__"], value: {} }])).toThrow("Unsafe workbook patch path");
    expect(() => applyWorkbookPatch({ records: [] }, [{ op: "replace", path: ["records", 2], value: "x" }])).toThrow();
  });
});
