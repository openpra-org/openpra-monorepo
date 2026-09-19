import {
  WorkbookOwnedModelMetadataSchema,
  WorkbookOwnershipMetadataSchema,
} from "..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174000";
const TIMESTAMP = "2026-08-21T21:00:00.000Z";

describe("workbook-owned backend contracts", () => {
  const ownership = {
    schemaVersion: "1.0.0" as const,
    workbookId: "sy-workbook",
    workbookRevision: 4,
    ownerUsername: "analyst",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };

  it("owns version, revision, ownership, and timestamps at workbook scope", () => {
    expect(WorkbookOwnershipMetadataSchema.parse(ownership)).toEqual(ownership);
    expect(
      WorkbookOwnedModelMetadataSchema.parse({
        ...ownership,
        modelId: MODEL_ID,
        methodType: "FAULT_TREE",
      }),
    ).toMatchObject({ workbookId: "sy-workbook", workbookRevision: 4, modelId: MODEL_ID });
  });

  it.each([
    { ...ownership, projectId: "project-1" },
    { ...ownership, revision: 4 },
    { ...ownership, modelRevision: 4 },
    { ...ownership, createdBy: "analyst" },
    { ...ownership, workbookRevision: 0 },
    { ...ownership, updatedAt: "today" },
  ])("rejects standalone-model persistence metadata %#", (candidate) => {
    expect(WorkbookOwnershipMetadataSchema.safeParse(candidate).success).toBe(false);
  });
});
