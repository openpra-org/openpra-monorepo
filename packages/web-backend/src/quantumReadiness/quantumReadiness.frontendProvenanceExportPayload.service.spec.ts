import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { QuantumReadinessService } from "./quantumReadiness.service";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("QuantumReadinessService frontend provenance export payload", () => {
  it("returns the provenance export payload through the service method", () => {
    const rootDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-service-frontend-provenance-export-"));

    writeJson(rootDirectoryPath, "importance/importance_comparison_report_v1.json", {
      caseLabel: "phase2b_row_0698",
      subtreeId: "phase2b_row_0698",
      boundednessStatement: "screening only",
    });

    const result = QuantumReadinessService.prototype.getFrontendProvenanceExportPayload.call(
      {} as QuantumReadinessService,
      {
        rootDirectoryPath,
        subtreeId: "phase2b_row_0698",
        scriptVersion: "quantumReadiness.frontendProvenanceExportPayload.service.spec",
      },
    );

    expect(result.target.subtreeId).toBe("phase2b_row_0698");
    expect(result.summary.boundednessStatement).toBe("screening only");
  });
});
