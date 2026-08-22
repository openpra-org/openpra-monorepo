import {
  AnalysisRunRecordSchema,
} from "../analysis-run-record.schema";

describe("AnalysisRunRecordSchema workbook ownership", () => {
  it("stores immutable owner, source, request, and complete workbook snapshots", () => {
    for (const path of ["owner", "sourceWorkbooks", "request", "workbookSnapshots"]) {
      expect(AnalysisRunRecordSchema.path(path).options.immutable).toBe(true);
      expect(AnalysisRunRecordSchema.path(path).options.required).toBe(true);
    }
  });

  it("contains no project or standalone model revision fields", () => {
    expect(AnalysisRunRecordSchema.path("projectId")).toBeUndefined();
    expect(AnalysisRunRecordSchema.path("modelId")).toBeUndefined();
    expect(AnalysisRunRecordSchema.path("modelRevision")).toBeUndefined();
    expect(AnalysisRunRecordSchema.path("modelSnapshots")).toBeUndefined();
    expect(AnalysisRunRecordSchema.path("resources")).toBeUndefined();
  });

  it("indexes run history by workbook owner and workbook-local model", () => {
    expect(AnalysisRunRecordSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { "owner.workbookId": 1, "owner.modelId": 1, requestedAt: -1 },
          expect.any(Object),
        ],
      ]),
    );
  });
});
