import { type ExternalFloodPRA, type ExternalFloodRecordStatus } from "interfaces-mef-types/external-flood/external-flood-pra";

function semanticRecords(value: unknown): Array<{ status?: ExternalFloodRecordStatus }> {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(semanticRecords);
  const object = value as Record<string, unknown>;
  const current = typeof object.uuid === "string" && typeof object.code === "string"
    ? [{ status: typeof object.status === "string" ? object.status as ExternalFloodRecordStatus : undefined }]
    : [];
  return [...current, ...Object.values(object).flatMap(semanticRecords)];
}

export function countExternalFloodPraRecords(mef: ExternalFloodPRA, statuses?: ExternalFloodRecordStatus[]): number {
  const records = semanticRecords(mef);
  return statuses === undefined ? records.length : records.filter((record) => record.status !== undefined && statuses.includes(record.status)).length;
}
