import { type InternalFloodPRA, type InternalFloodRecordStatus } from "interfaces-mef-types/internal-flood/internal-flood-pra";

function semanticRecords(value: unknown): Array<{ status?: InternalFloodRecordStatus }> {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => semanticRecords(item));
  const object = value as Record<string, unknown>;
  const current = typeof object.uuid === "string" && typeof object.code === "string"
    ? [{ status: typeof object.status === "string" ? object.status as InternalFloodRecordStatus : undefined }]
    : [];
  return [...current, ...Object.values(object).flatMap((item) => semanticRecords(item))];
}

export function countInternalFloodRecords(mef: InternalFloodPRA, statuses?: InternalFloodRecordStatus[]): number {
  const records = semanticRecords(mef);
  return statuses === undefined ? records.length : records.filter((record) => record.status !== undefined && statuses.includes(record.status)).length;
}
