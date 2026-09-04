export interface HclCutSetExportRow {
  rank: number;
  order: number;
  probability: number;
  coverage: number | null;
  expression: string;
  conditions: string[];
  rootCauses: string[];
  ancestors: string[];
}

function csvText(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function serializeHclCutSetsCsv(rows: readonly HclCutSetExportRow[]): string {
  const header = [
    "rank",
    "order",
    "probability",
    "coverage_fraction",
    "cut_set",
    "bn_conditions",
    "bn_root_causes",
    "bn_ancestors",
  ].join(",");
  const body = rows.map((row) => [
    String(row.rank),
    String(row.order),
    String(row.probability),
    row.coverage === null ? "" : String(row.coverage),
    csvText(row.expression),
    csvText(row.conditions.join(" | ")),
    csvText(row.rootCauses.join(" | ")),
    csvText(row.ancestors.join(" | ")),
  ].join(","));
  return `\uFEFF${[header, ...body].join("\r\n")}\r\n`;
}
