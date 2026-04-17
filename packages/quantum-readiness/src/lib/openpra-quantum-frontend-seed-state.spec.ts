import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildOpenPraQuantumFrontendSeedState,
  loadLatestOpenPraQuantumFrontendSeedState,
} from "./openpra-quantum-frontend-seed-state";

describe("openpra-quantum-frontend-seed-state", () => {
  it("builds and loads the frontend seed state", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-seed-state-"));
    const workspaceSnapshotRoot = path.join(tempDir, "workspace_snapshot");
    const seedRoot = path.join(tempDir, "seed_state");

    fs.mkdirSync(workspaceSnapshotRoot, { recursive: true });

    fs.writeFileSync(
      path.join(workspaceSnapshotRoot, "frontend_workspace_snapshot_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:50:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: workspaceSnapshotRoot,
          frontendSummaryRootDirectoryPath: "/frontend_summary",
          canonicalProgramReportRootDirectoryPath: "/program_report",
          readyForFrontend: true,
          readinessStatus: "ready",
          cards: [
            {
              id: "readiness",
              title: "Frontend readiness",
              status: "ready",
              primaryValue: "Ready",
              secondaryValue: "3 tracked cases",
              notes: ["WS5 cases: 3", "WS6 cases: 2"],
            },
            {
              id: "ws5",
              title: "WS5 bounded coverage",
              status: "complete",
              primaryValue: "3 cases",
              secondaryValue: "All bounded checks matched",
              notes: ["Operator attention count: 0"],
            },
            {
              id: "ws6",
              title: "WS6 execution coverage",
              status: "complete",
              primaryValue: "2 cases",
              secondaryValue: "All execution cases completed",
              notes: ["Missing result count: 0"],
            },
            {
              id: "topology",
              title: "Topology mix",
              status: "complete",
              primaryValue: "A:2 C:1",
              secondaryValue: "3 union cases",
              notes: ["WS5 ready: true", "WS6 ready: true"],
            },
          ],
          caseRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              showInFrontend: true,
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

    const built = buildOpenPraQuantumFrontendSeedState({
      rootDirectoryPath: seedRoot,
      frontendWorkspaceSnapshotRootDirectoryPath: workspaceSnapshotRoot,
      scriptVersion: "openpra-quantum-frontend-seed-state.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(built.summary.badge.label).toBe("Frontend ready");
    expect(built.summary.widgets).toHaveLength(4);
    expect(built.summary.caseTableRows).toHaveLength(3);
    expect(fs.existsSync(built.summaryPath)).toBe(true);
    expect(fs.existsSync(built.manifestPath)).toBe(true);

    const loaded = loadLatestOpenPraQuantumFrontendSeedState({
      rootDirectoryPath: seedRoot,
    });

    expect(loaded.summary.readinessStatus).toBe("ready");
    expect(loaded.summary.caseTableRows[0].displayStatus).toBe("ready");
  });
});
