import {
  RevisionedWorkbookPatchBodySchema,
  WorkbookPatchBodySchema,
} from "../WorkbookPatch";

describe("revisioned workbook patch contract", () => {
  const operation = { op: "replace" as const, path: ["name"], value: "Updated" };

  it("requires a positive integer expected revision", () => {
    expect(
      RevisionedWorkbookPatchBodySchema.parse({
        expectedRevision: 3,
        operations: [operation],
      }),
    ).toEqual({ expectedRevision: 3, operations: [operation] });

    for (const expectedRevision of [undefined, 0, -1, 1.5]) {
      expect(() =>
        RevisionedWorkbookPatchBodySchema.parse({
          expectedRevision,
          operations: [operation],
        }),
      ).toThrow();
    }
  });

  it("keeps unrelated workbook patches on the operations-only contract", () => {
    expect(WorkbookPatchBodySchema.parse({ operations: [operation] })).toEqual({
      operations: [operation],
    });
  });
});
