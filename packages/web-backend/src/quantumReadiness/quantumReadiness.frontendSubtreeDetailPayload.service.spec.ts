import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { QuantumReadinessService } from "./quantumReadiness.service";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("QuantumReadinessService frontend subtree detail payload", () => {
  it("returns the subtree detail payload through the service method", () => {
    const rootDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-service-frontend-subtree-detail-"));

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0698",
      subtreeId: "phase2b_row_0698",
      rootGateId: "G:G348",
      topologyClass: "A",
      basicEventCount: 5,
      requiredQubits: 5,
      qaoaRecipe: {
        beta: -0.785398163,
        gamma: 1.570796327,
        p: 1,
        mixerSpec: "qaoa_plus",
      },
    });

    const result = QuantumReadinessService.prototype.getFrontendSubtreeDetailPayload.call(
      {} as QuantumReadinessService,
      {
        rootDirectoryPath,
        subtreeId: "phase2b_row_0698",
        scriptVersion: "quantumReadiness.frontendSubtreeDetailPayload.service.spec",
      },
    );

    expect(result.target.subtreeId).toBe("phase2b_row_0698");
    expect(result.summary.topologyClass).toBe("A");
    expect(result.summary.thresholdBehavior).toBe("threshold_favorable");
    expect(result.preparation?.qaoaRecipe.mixerSpec).toBe("qaoa_plus");
  });
});
