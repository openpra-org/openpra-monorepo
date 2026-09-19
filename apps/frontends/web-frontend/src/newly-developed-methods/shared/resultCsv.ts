import { numberText } from "interfaces-shared-types/json";

/** Display formatting must never change exported numeric values. */
export type ResultCsvRecord = Record<string, string | number | boolean | null | undefined>;

function csvCell(value: ResultCsvRecord[string]): string {
  let text = value == null ? "" : typeof value === "number" ? numberText(value) : String(value);
  // Labels are text, including when a spreadsheet might interpret them as formulas.
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** HCL_MH reports.py/_write_csv likewise writes raw values with named columns. */
export function resultRecordsToCsv(records: readonly ResultCsvRecord[]): string {
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))];
  return (
    "\uFEFF" +
    [
      columns.map(csvCell).join(","),
      ...records.map((record) => columns.map((column) => csvCell(record[column])).join(",")),
    ].join("\r\n") +
    "\r\n"
  );
}

export function downloadResultCsv(filename: string, records: readonly ResultCsvRecord[]): void {
  const url = URL.createObjectURL(new Blob([resultRecordsToCsv(records)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to consume the download before releasing its URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
