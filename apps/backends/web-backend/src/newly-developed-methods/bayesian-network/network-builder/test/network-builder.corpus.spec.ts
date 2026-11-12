import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonText } from "../core/spec-text";
import { isMapping, isSequence } from "../core/spec-values";
import type { SpecMapping } from "../core/spec-values";
import { compareCase } from "./corpus-comparison";
import type { CaseReport } from "./corpus-comparison";

const corpusDirectory = process.env.NETWORK_BUILDER_CORPUS ?? join(__dirname, "fixtures", "corpus");
const reportPath = process.env.NETWORK_BUILDER_REPORT ?? "";
const caseFilter = process.env.NETWORK_BUILDER_CASES ?? "";

describe("network builder reference corpus", () => {
  it("reproduces every reference case", () => {
    const wanted = caseFilter.length > 0 ? new Set(caseFilter.split(",")) : null;
    const files = readdirSync(corpusDirectory)
      .filter((name) => name.endsWith(".json"))
      .sort();
    const reports: CaseReport[] = [];
    for (const name of files) {
      const parsed = parseJsonText(readFileSync(join(corpusDirectory, name), "utf-8"));
      const records: SpecMapping[] =
        isSequence(parsed) ? parsed.filter(isMapping)
        : isMapping(parsed) ? [parsed]
        : [];
      for (const record of records) {
        if (wanted !== null && !wanted.has(String(record.case))) continue;
        reports.push(compareCase(record));
      }
    }
    if (reportPath.length > 0) writeFileSync(reportPath, JSON.stringify(reports, null, 1), "utf-8");
    expect(reports.length).toBeGreaterThan(0);
    expect(
      reports
        .filter((report) => report.status !== "match")
        .map((report) => `${report.source}: ${report.status} ${report.problems.slice(0, 2).join(" ; ")}`),
    ).toEqual([]);
  });
});
