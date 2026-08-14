import { type OtherHazardsPRA, type OtherHazardsRecordStatus } from "interfaces-mef-types/other-hazards/other-hazards-pra";

function semanticRecords(value: unknown): Array<{ status?: OtherHazardsRecordStatus }> {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(semanticRecords);
  const object = value as Record<string, unknown>;
  const current = typeof object.uuid === "string" && typeof object.code === "string"
    ? [{ status: typeof object.status === "string" ? object.status as OtherHazardsRecordStatus : undefined }]
    : [];
  return [...current, ...Object.values(object).flatMap(semanticRecords)];
}

export function countOtherHazardsPraRecords(mef: OtherHazardsPRA, statuses?: OtherHazardsRecordStatus[]): number {
  const records = semanticRecords(mef);
  return statuses === undefined ? records.length : records.filter((record) => record.status !== undefined && statuses.includes(record.status)).length;
}
