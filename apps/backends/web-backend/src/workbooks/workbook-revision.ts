import { BadRequestException, ConflictException } from "@nestjs/common";

interface RevisionedWorkbookDocument {
  revision?: number;
}

interface WorkbookRevisionFilter {
  workbookId: string;
  revision?: number;
  $or?: Array<{ revision: number } | { revision: { $exists: false } }>;
}

function readWorkbookRevision(document: RevisionedWorkbookDocument): number {
  if (document.revision === undefined || document.revision === null) return 1;
  if (!Number.isSafeInteger(document.revision) || document.revision < 1) {
    throw new BadRequestException("Stored workbook revision is invalid");
  }
  return document.revision;
}

function workbookRevisionConflict(
  expectedRevision: number,
  currentRevision?: number,
): ConflictException {
  const current = currentRevision === undefined ? "changed before this update completed" : `current ${currentRevision}`;
  return new ConflictException(`Workbook revision conflict: expected ${expectedRevision}, ${current}`);
}

function assertExpectedWorkbookRevision(
  document: RevisionedWorkbookDocument,
  expectedRevision: number,
): void {
  const currentRevision = readWorkbookRevision(document);
  if (expectedRevision !== currentRevision) {
    throw workbookRevisionConflict(expectedRevision, currentRevision);
  }
}

function createWorkbookRevisionFilter(
  workbookId: string,
  expectedRevision: number,
): WorkbookRevisionFilter {
  if (expectedRevision === 1) {
    return {
      workbookId,
      $or: [{ revision: 1 }, { revision: { $exists: false } }],
    };
  }
  return { workbookId, revision: expectedRevision };
}

function parseExpectedWorkbookRevision(value: unknown): number {
  const parsed = typeof value === "string" && value.trim().length > 0 ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || (parsed as number) < 1) {
    throw new BadRequestException("expectedRevision must be a positive integer");
  }
  return parsed as number;
}

export {
  assertExpectedWorkbookRevision,
  createWorkbookRevisionFilter,
  parseExpectedWorkbookRevision,
  readWorkbookRevision,
  workbookRevisionConflict,
};
