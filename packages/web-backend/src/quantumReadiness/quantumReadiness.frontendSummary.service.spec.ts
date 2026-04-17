import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService frontend summary", () => {
  let service: QuantumReadinessService;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(() => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    service = new QuantumReadinessService(graphModelServiceMock as unknown as GraphModelService);
  });

  it("builds and loads the frontend summary", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-service-"));
    const programReportRoot = path.join(tempDir, "program_report");
    const frontendRoot = path.join(tempDir, "frontend_summary");

    fs.mkdirSync(programReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(programReportRoot, "canonical_program_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:30:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: programReportRoot,
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

    const built = service.buildFrontendSummary({
      rootDirectoryPath: frontendRoot,
      canonicalProgramReportRootDirectoryPath: programReportRoot,
      scriptVersion: "quantumReadiness.frontendSummary.service.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(built.summary.readinessStatus).toBe("ready");
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = service.loadLatestFrontendSummary({
      rootDirectoryPath: frontendRoot,
    });

    expect(loaded.summary.totalUnionCases).toBe(3);
    expect(loaded.summary.caseRows).toHaveLength(3);
  });
});
