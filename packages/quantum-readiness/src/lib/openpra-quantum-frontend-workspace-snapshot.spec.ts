import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildOpenPraQuantumFrontendWorkspaceSnapshot,
  loadLatestOpenPraQuantumFrontendWorkspaceSnapshot,
} from "./openpra-quantum-frontend-workspace-snapshot";

describe("openpra-quantum-frontend-workspace-snapshot", () => {
  it("builds and loads the frontend workspace snapshot", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-workspace-"));
    const frontendSummaryRoot = path.join(tempDir, "frontend_summary");
    const canonicalProgramReportRoot = path.join(tempDir, "program_report");
    const snapshotRoot = path.join(tempDir, "workspace_snapshot");

    fs.mkdirSync(frontendSummaryRoot, { recursive: true });
    fs.mkdirSync(canonicalProgramReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(frontendSummaryRoot, "frontend_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:40:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: frontendSummaryRoot,
          canonicalProgramReportRootDirectoryPath: canonicalProgramReportRoot,
          readinessStatus: "ready",
          readyForFrontend: true,
          totalWs5Cases: 3,
          totalWs6Cases: 2,
          totalUnionCases: 3,
          ws5CoverageComplete: true,
          ws6CoverageComplete: true,
          ws6MissingResultCount: 0,
          operatorAttentionCount: 0,
          caseRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
              showInFrontend: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
              showInFrontend: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: false,
              boundednessMatches: true,
              ws6ExecutionStatus: null,
              ws6HasResult: null,
              showInFrontend: true,
            },
          ],
        },
        null,
        2,
      ) + "\n",
      (encoding = "utf8"),
    );

    fs.writeFileSync(
      path.join(canonicalProgramReportRoot, "canonical_program_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:30:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: canonicalProgramReportRoot,
          boundedReportRootDirectoryPath: "/bounded",
          ws6ExecutionReportRootDirectoryPath: "/ws6",
          ws5CaseLabels: ["phase2b_row_0698__G_G348", "phase2b_row_1037__G_G348", "phase2b_row_0905__G_G939"],
          ws6CaseLabels: ["phase2b_row_0698__G_G348", "phase2b_row_0905__G_G939"],
          unionCaseLabels: ["phase2b_row_0698__G_G348", "phase2b_row_0905__G_G939", "phase2b_row_1037__G_G348"],
          totalWs5Cases: 3,
          totalWs6Cases: 2,
          totalUnionCases: 3,
          boundednessAllMatch: true,
          ws6AllCompleted: true,
          readyForFrontend: true,
          operatorAttentionCount: 0,
          ws6MissingResultCount: 0,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: false,
              boundednessMatches: true,
              ws6ExecutionStatus: null,
              ws6HasResult: null,
            },
          ],
        },
        null,
        2,
      ) + "\n",
      (encoding = "utf8"),
    );

    const built = buildOpenPraQuantumFrontendWorkspaceSnapshot({
      rootDirectoryPath: snapshotRoot,
      frontendSummaryRootDirectoryPath: frontendSummaryRoot,
      canonicalProgramReportRootDirectoryPath: canonicalProgramReportRoot,
      scriptVersion: "openpra-quantum-frontend-workspace-snapshot.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(built.summary.cards).toHaveLength(4);
    expect(built.summary.caseRows).toHaveLength(3);
    expect(fs.existsSync(built.summaryPath)).toBe(true);
    expect(fs.existsSync(built.manifestPath)).toBe(true);

    const loaded = loadLatestOpenPraQuantumFrontendWorkspaceSnapshot({
      rootDirectoryPath: snapshotRoot,
    });

    expect(loaded.summary.readinessStatus).toBe("ready");
    expect(loaded.summary.cards[0].title).toBe("Frontend readiness");
  });
});
