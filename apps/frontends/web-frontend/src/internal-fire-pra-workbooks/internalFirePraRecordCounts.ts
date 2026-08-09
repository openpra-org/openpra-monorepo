import { type InternalFirePRA, type InternalFireRecordStatus } from "interfaces-mef-types/internal-fire/internal-fire-pra";

function semanticRecords(value: unknown): Array<{ status?: InternalFireRecordStatus }> {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => semanticRecords(item));
  const object = value as Record<string, unknown>;
  const current = typeof object.uuid === "string" && typeof object.code === "string"
    ? [{ status: typeof object.status === "string" ? object.status as InternalFireRecordStatus : undefined }]
    : [];
  return [...current, ...Object.values(object).flatMap((item) => semanticRecords(item))];
}

export function countInternalFireRecords(mef: InternalFirePRA, statuses?: InternalFireRecordStatus[]): number {
  const records = semanticRecords(mef);
  return statuses === undefined ? records.length : records.filter((record) => record.status !== undefined && statuses.includes(record.status)).length;
}
