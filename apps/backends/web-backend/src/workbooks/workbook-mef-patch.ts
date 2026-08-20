import { BadRequestException } from "@nestjs/common";
import { applyWorkbookPatch, WorkbookPatchBodySchema, type WorkbookPatchOperation } from "interfaces-shared-types/workbooks";

function parseWorkbookPatchBody(body: unknown): WorkbookPatchOperation[] {
  const parsed = WorkbookPatchBodySchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(`Invalid workbook patch payload: ${parsed.error.message}`);
  return parsed.data.operations;
}

function mergeWorkbookPatch(current: unknown, operations: unknown): unknown {
  try {
    return applyWorkbookPatch(current, operations);
  } catch (error: unknown) {
    throw new BadRequestException(`Invalid workbook patch: ${(error as { message?: string }).message ?? "unknown patch error"}`);
  }
}

export { mergeWorkbookPatch, parseWorkbookPatchBody };
