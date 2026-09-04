interface HclImportanceExportRow {
  rank: number;
  basicEvent: string;
  bayesianNetworkNode: string;
  eventProbability: number;
  probabilityIfTrue: number;
  probabilityIfFalse: number;
  birnbaum: number;
  criticality: number | null;
  fussellVesely: number | null;
  riskAchievementWorth: number | null;
  riskReductionWorth: number | null;
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeHclImportanceCsv(rows: readonly HclImportanceExportRow[]): string {
  const header = [
    "Rank",
    "Basic event",
    "Bayesian network node",
    "Event probability",
    "P(target | event true)",
    "P(target | event false)",
    "Birnbaum",
    "Criticality",
    "Fussell-Vesely",
    "Risk achievement worth",
    "Risk reduction worth",
  ];
  return [
    header.map(csvCell).join(","),
    ...rows.map((row) => [
      row.rank,
      row.basicEvent,
      row.bayesianNetworkNode,
      row.eventProbability,
      row.probabilityIfTrue,
      row.probabilityIfFalse,
      row.birnbaum,
      row.criticality,
      row.fussellVesely,
      row.riskAchievementWorth,
      row.riskReductionWorth,
    ].map(csvCell).join(",")),
  ].join("\r\n");
}

export { serializeHclImportanceCsv };
export type { HclImportanceExportRow };
