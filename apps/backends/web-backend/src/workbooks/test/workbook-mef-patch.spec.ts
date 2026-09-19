import { BadRequestException } from "@nestjs/common";
import {
  mergeWorkbookPatch,
  parseRevisionedWorkbookPatchBody,
  parseWorkbookPatchBody,
} from "../workbook-mef-patch";

describe("workbook MEF path patches", () => {
  test("merges only the supplied leaf operation into the current MEF", () => {
    const current = {
      name: "Internal Fire PRA",
      fireAreas: [{ uuid: "FA-01", name: "Auxiliary building", elevationFt: 100 }],
    };
    const operations = parseWorkbookPatchBody({
      operations: [
        { op: "replace", path: ["fireAreas", 0, "name"], value: "Auxiliary building - EL 100" },
      ],
    });

    expect(mergeWorkbookPatch(current, operations)).toEqual({
      name: "Internal Fire PRA",
      fireAreas: [{ uuid: "FA-01", name: "Auxiliary building - EL 100", elevationFt: 100 }],
    });
    expect(current.fireAreas[0]!.name).toBe("Auxiliary building");
  });

  test("rejects legacy full-MEF and unsafe path payloads", () => {
    expect(() => parseWorkbookPatchBody({ mef: { name: "legacy full body" } })).toThrow(BadRequestException);
    expect(() => mergeWorkbookPatch({ name: "A" }, [
      { op: "add", path: ["__proto__"], value: {} },
    ])).toThrow(BadRequestException);
  });

  test("requires a positive expected revision for revisioned method patches", () => {
    const payload = {
      expectedRevision: 7,
      operations: [{ op: "replace" as const, path: ["name"], value: "Updated" }],
    };

    expect(parseRevisionedWorkbookPatchBody(payload)).toEqual(payload);
    expect(() => parseRevisionedWorkbookPatchBody({ operations: payload.operations })).toThrow(
      BadRequestException,
    );
    expect(() =>
      parseRevisionedWorkbookPatchBody({ ...payload, expectedRevision: 0 }),
    ).toThrow(BadRequestException);
    expect(() =>
      parseRevisionedWorkbookPatchBody({ ...payload, unexpectedField: true }),
    ).toThrow(BadRequestException);
  });
});
