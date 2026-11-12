import { z } from "zod";
import { stringifyJson } from "../json";

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
  return JSON.parse(stringifyJson(value)!) as T;
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => jsonValuesEqual(value, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined);
    const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && jsonValuesEqual(left[key], right[key]))
    );
  }
  return false;
}

function singleArrayRemovalIndex(before: unknown[], after: unknown[]): number | null {
  if (before.length !== after.length + 1) return null;
  let index = 0;
  while (index < after.length && jsonValuesEqual(before[index], after[index])) index += 1;
  for (let afterIndex = index; afterIndex < after.length; afterIndex += 1) {
    if (!jsonValuesEqual(before[afterIndex + 1], after[afterIndex])) return null;
  }
  return index;
}

function singleArrayInsertionIndex(before: unknown[], after: unknown[]): number | null {
  if (after.length !== before.length + 1) return null;
  let index = 0;
  while (index < before.length && jsonValuesEqual(before[index], after[index])) index += 1;
  for (let beforeIndex = index; beforeIndex < before.length; beforeIndex += 1) {
    if (!jsonValuesEqual(before[beforeIndex], after[beforeIndex + 1])) return null;
  }
  return index;
}

interface WorkbookPatchDraft {
  operations: WorkbookPatchOperation[];
  size: number;
}

const VALUE_FIELD_SIZE = ',"value":'.length;
const SEPARATOR_SIZE = ",".length;
const BRACKETS_SIZE = "[]".length;
const NULL_SIZE = "null".length;

type JsonSizes = WeakMap<object, number>;

function jsonSizeWithin(value: unknown, limit: number, sizes: JsonSizes): number {
  if (value === null || typeof value !== "object") return JSON.stringify(value)?.length ?? NULL_SIZE;
  const known = sizes.get(value);
  if (known !== undefined) return known;
  let size = BRACKETS_SIZE;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) size += SEPARATOR_SIZE;
      size += jsonSizeWithin(value[index], limit - size, sizes);
      if (size > limit) return size;
    }
  } else if (isRecord(value)) {
    let written = 0;
    for (const key of Object.keys(value)) {
      if (value[key] === undefined) continue;
      if (written > 0) size += SEPARATOR_SIZE;
      written += 1;
      size += JSON.stringify(key).length + SEPARATOR_SIZE + jsonSizeWithin(value[key], limit - size, sizes);
      if (size > limit) return size;
    }
  }
  sizes.set(value, size);
  return size;
}

function operationSize(op: WorkbookPatchOperation["op"], path: WorkbookPatchPathSegment[]): number {
  return JSON.stringify({ op, path }).length + SEPARATOR_SIZE + (op === "remove" ? 0 : VALUE_FIELD_SIZE);
}

function createWorkbookPatch<T>(current: T, next: T): WorkbookPatchOperation[] {
  const sizes: JsonSizes = new WeakMap();
  const unchanged: WorkbookPatchDraft = { operations: [], size: 0 };

  function removal(path: WorkbookPatchPathSegment[], draft: WorkbookPatchDraft): void {
    draft.operations.push({ op: "remove", path });
    draft.size += operationSize("remove", path);
  }

  function addition(path: WorkbookPatchPathSegment[], value: unknown, draft: WorkbookPatchDraft): void {
    draft.operations.push({ op: "add", path, value });
    draft.size += operationSize("add", path) + jsonSizeWithin(value, Number.POSITIVE_INFINITY, sizes);
  }

  function merge(source: WorkbookPatchDraft, draft: WorkbookPatchDraft): void {
    if (source.operations.length === 0) return;
    for (const operation of source.operations) draft.operations.push(operation);
    draft.size += source.size;
  }

  function visitArray(before: unknown[], after: unknown[], path: WorkbookPatchPathSegment[]): WorkbookPatchDraft {
    const draft: WorkbookPatchDraft = { operations: [], size: 0 };
    const removalIndex = singleArrayRemovalIndex(before, after);
    if (removalIndex !== null) {
      removal([...path, removalIndex], draft);
      return draft;
    }
    const insertionIndex = singleArrayInsertionIndex(before, after);
    if (insertionIndex !== null) {
      addition([...path, insertionIndex], after[insertionIndex], draft);
      return draft;
    }
    const sharedLength = Math.min(before.length, after.length);
    for (let index = 0; index < sharedLength; index += 1) merge(visit(before[index], after[index], [...path, index]), draft);
    for (let index = before.length - 1; index >= after.length; index -= 1) removal([...path, index], draft);
    for (let index = sharedLength; index < after.length; index += 1) addition([...path, index], after[index], draft);
    return draft;
  }

  function visitRecord(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    path: WorkbookPatchPathSegment[],
  ): WorkbookPatchDraft {
    const draft: WorkbookPatchDraft = { operations: [], size: 0 };
    const beforeKeys = Object.keys(before).filter((key) => before[key] !== undefined);
    const afterKeys = Object.keys(after).filter((key) => after[key] !== undefined);
    const afterKeySet = new Set(afterKeys);
    const beforeKeySet = new Set(beforeKeys);

    for (const key of beforeKeys) {
      if (!afterKeySet.has(key)) removal([...path, key], draft);
    }
    for (const key of afterKeys) {
      if (!beforeKeySet.has(key)) addition([...path, key], after[key], draft);
      else merge(visit(before[key], after[key], [...path, key]), draft);
    }
    return draft;
  }

  function visit(before: unknown, after: unknown, path: WorkbookPatchPathSegment[]): WorkbookPatchDraft {
    if (Object.is(before, after)) return unchanged;

    let parts: WorkbookPatchDraft | null = null;
    if (Array.isArray(before) && Array.isArray(after)) parts = visitArray(before, after, path);
    else if (isRecord(before) && isRecord(after)) parts = visitRecord(before, after, path);

    if (path.length === 0) {
      if (parts === null) throw new Error("Workbook patches cannot replace the complete MEF root");
      return parts;
    }
    if (parts !== null && parts.operations.length === 0) return unchanged;

    const replacementOverhead = operationSize("replace", path);
    const partsLimit = parts === null ? Number.POSITIVE_INFINITY : parts.size - replacementOverhead;
    const replacementSize = replacementOverhead + jsonSizeWithin(after, partsLimit, sizes);
    if (parts !== null && parts.size <= replacementSize) return parts;
    return { operations: [{ op: "replace", path, value: after }], size: replacementSize };
  }

  return visit(current, next, []).operations.map((operation) =>
    operation.op === "remove" ? operation : { ...operation, value: cloneJsonValue(operation.value) },
  );
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
