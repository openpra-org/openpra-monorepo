import { type HighWindsPRA, type HighWindsRecordStatus } from "interfaces-mef-types/high-winds/high-winds-pra";

function semanticRecords(value: unknown): Array<{ status?: HighWindsRecordStatus }> {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(semanticRecords);
  const object = value as Record<string, unknown>;
  const current = typeof object.uuid === "string" && typeof object.code === "string"
    ? [{ status: typeof object.status === "string" ? object.status as HighWindsRecordStatus : undefined }]
    : [];
  return [...current, ...Object.values(object).flatMap(semanticRecords)];
}

export function countHighWindsPraRecords(mef: HighWindsPRA, statuses?: HighWindsRecordStatus[]): number {
  const records = semanticRecords(mef);
  return statuses === undefined ? records.length : records.filter((record) => record.status !== undefined && statuses.includes(record.status)).length;
}
