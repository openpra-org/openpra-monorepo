import { z } from "zod";

const WorkbookPatchPathSegmentSchema = z.union([
  z.string().min(1).max(256),
  z.number().int().nonnegative(),
]);

const WorkbookPatchOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), path: z.array(WorkbookPatchPathSegmentSchema).min(1).max(64), value: z.unknown() }),
  z.object({ op: z.literal("remove"), path: z.array(WorkbookPatchPathSegmentSchema).min(1).max(64) }),
  z.object({ op: z.literal("replace"), path: z.array(WorkbookPatchPathSegmentSchema).min(1).max(64), value: z.unknown() }),
]);

const WorkbookPatchBodySchema = z.object({
  operations: z.array(WorkbookPatchOperationSchema).min(1).max(10_000),
});

const WorkbookRevisionSchema = z.number().int().positive();

const RevisionedWorkbookPatchBodySchema = z
  .object({
    expectedRevision: WorkbookRevisionSchema,
    operations: z.array(WorkbookPatchOperationSchema).min(1).max(10_000),
  })
  .strict();

type WorkbookPatchPathSegment = z.infer<typeof WorkbookPatchPathSegmentSchema>;
type WorkbookPatchOperation = z.infer<typeof WorkbookPatchOperationSchema>;
type WorkbookPatchBody = z.infer<typeof WorkbookPatchBodySchema>;
type RevisionedWorkbookPatchBody = z.infer<typeof RevisionedWorkbookPatchBodySchema>;

const BLOCKED_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createWorkbookPatch<T>(current: T, next: T): WorkbookPatchOperation[] {
  const operations: WorkbookPatchOperation[] = [];

  function visit(before: unknown, after: unknown, path: WorkbookPatchPathSegment[]): void {
    if (Object.is(before, after)) return;

    if (Array.isArray(before) && Array.isArray(after)) {
      const sharedLength = Math.min(before.length, after.length);
      for (let index = 0; index < sharedLength; index += 1) visit(before[index], after[index], [...path, index]);
      for (let index = before.length - 1; index >= after.length; index -= 1) operations.push({ op: "remove", path: [...path, index] });
      for (let index = sharedLength; index < after.length; index += 1) operations.push({ op: "add", path: [...path, index], value: cloneJsonValue(after[index]) });
      return;
    }

    if (isRecord(before) && isRecord(after)) {
      const beforeKeys = Object.keys(before).filter((key) => before[key] !== undefined);
      const afterKeys = Object.keys(after).filter((key) => after[key] !== undefined);
      const afterKeySet = new Set(afterKeys);
      const beforeKeySet = new Set(beforeKeys);

      for (const key of beforeKeys) {
        if (!afterKeySet.has(key)) operations.push({ op: "remove", path: [...path, key] });
      }
      for (const key of afterKeys) {
        if (!beforeKeySet.has(key)) operations.push({ op: "add", path: [...path, key], value: cloneJsonValue(after[key]) });
        else visit(before[key], after[key], [...path, key]);
      }
      return;
    }

    if (path.length === 0) throw new Error("Workbook patches cannot replace the complete MEF root");
    operations.push({ op: "replace", path, value: cloneJsonValue(after) });
  }

  visit(current, next, []);
  return operations;
}

function applyWorkbookPatch<T>(current: T, rawOperations: unknown): T {
  const operations = z.array(WorkbookPatchOperationSchema).min(1).max(10_000).parse(rawOperations);
  const draft: unknown = cloneJsonValue(current);

  for (const operation of operations) {
    const parentPath = operation.path.slice(0, -1);
    const finalSegment = operation.path.at(-1)!;
    let parent: unknown = draft;

    for (const segment of parentPath) {
      if (typeof segment === "string" && BLOCKED_PATH_SEGMENTS.has(segment)) throw new Error("Unsafe workbook patch path");
      if (Array.isArray(parent)) {
        if (typeof segment !== "number" || segment >= parent.length) throw new Error("Workbook patch array path is out of bounds");
        parent = parent[segment];
      } else if (isRecord(parent)) {
        if (typeof segment !== "string" || !Object.prototype.hasOwnProperty.call(parent, segment)) throw new Error("Workbook patch object path does not exist");
        parent = parent[segment];
      } else {
        throw new Error("Workbook patch path does not resolve to a container");
      }
    }

    if (typeof finalSegment === "string" && BLOCKED_PATH_SEGMENTS.has(finalSegment)) throw new Error("Unsafe workbook patch path");

    if (Array.isArray(parent)) {
      if (typeof finalSegment !== "number") throw new Error("Workbook patch array paths require numeric indexes");
      if (operation.op === "add") {
        if (finalSegment > parent.length) throw new Error("Workbook patch array insertion is out of bounds");
        parent.splice(finalSegment, 0, cloneJsonValue(operation.value));
      } else if (operation.op === "remove") {
        if (finalSegment >= parent.length) throw new Error("Workbook patch array removal is out of bounds");
        parent.splice(finalSegment, 1);
      } else {
        if (finalSegment >= parent.length) throw new Error("Workbook patch array replacement is out of bounds");
        parent[finalSegment] = cloneJsonValue(operation.value);
      }
      continue;
    }

    if (!isRecord(parent) || typeof finalSegment !== "string") throw new Error("Workbook patch object paths require property names");
    if (operation.op === "add") {
      if (Object.prototype.hasOwnProperty.call(parent, finalSegment)) throw new Error("Workbook patch cannot add an existing property");
      parent[finalSegment] = cloneJsonValue(operation.value);
    } else if (operation.op === "remove") {
      if (!Object.prototype.hasOwnProperty.call(parent, finalSegment)) throw new Error("Workbook patch cannot remove a missing property");
      delete parent[finalSegment];
    } else {
      if (!Object.prototype.hasOwnProperty.call(parent, finalSegment)) throw new Error("Workbook patch cannot replace a missing property");
      parent[finalSegment] = cloneJsonValue(operation.value);
    }
  }

  return draft as T;
}

export {
  WorkbookPatchBodySchema,
  WorkbookPatchOperationSchema,
  RevisionedWorkbookPatchBodySchema,
  applyWorkbookPatch,
  createWorkbookPatch,
  type RevisionedWorkbookPatchBody,
  type WorkbookPatchBody,
  type WorkbookPatchOperation,
  type WorkbookPatchPathSegment,
};
