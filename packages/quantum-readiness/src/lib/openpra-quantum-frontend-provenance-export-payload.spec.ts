import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { buildOpenPraQuantumFrontendProvenanceExportPayload } from "./openpra-quantum-frontend-provenance-export-payload";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

function writeText(rootDirectoryPath: string, relativePath: string, value: string): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, value);
}

describe("buildOpenPraQuantumFrontendProvenanceExportPayload", () => {
  it("builds a frontend provenance and export payload", () => {
    const rootDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-provenance-export-"));

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      topologyClass: "C",
      basicEventCount: 8,
    });

    writeJson(rootDirectoryPath, "provider/provider_execution_request_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      backendName: "ibm_marrakesh",
      status: "completed",
    });

    writeJson(rootDirectoryPath, "recovery/openpra_recovery_ladder_result_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      primaryMode: "union_sensitivity_recovery",
    });

    writeJson(rootDirectoryPath, "importance/importance_comparison_report_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      boundednessStatement: "screening only",
    });

    writeText(
      rootDirectoryPath,
      "_work/checkpoints/OPENPRA_SAMPLE_RELEASE_BUNDLE_v1_20260418_000000Z.tar.gz",
      "bundle",
    );
    writeText(
      rootDirectoryPath,
      "_work/checkpoints/OPENPRA_SAMPLE_RELEASE_BUNDLE_v1_20260418_000000Z.tar.gz.sha256",
      "sha256",
    );
    writeJson(rootDirectoryPath, "_work/checkpoints/workflow_release_manifest_v1.json", { status: "ok" });
    writeJson(rootDirectoryPath, "_work/checkpoints/provenance_manifest_v1.json", { status: "ok" });

    const result = buildOpenPraQuantumFrontendProvenanceExportPayload({
      rootDirectoryPath,
      subtreeId: "phase2b_row_0905",
      scriptVersion: "quantum-readiness.frontendProvenanceExportPayload.spec",
    });

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.topologyClass).toBe("C");
    expect(result.summary.providerBackendName).toBe("ibm_marrakesh");
    expect(result.summary.recoveryPrimaryMode).toBe("union_sensitivity_recovery");
    expect(result.summary.boundednessStatement).toBe("screening only");
    expect(result.summary.exportBundleCount).toBe(1);
    expect(result.summary.manifestCount).toBe(2);
    expect(result.summary.sha256Count).toBe(1);
    expect(result.exports.bundles[0].hasSha256).toBe(true);
    expect(result.readiness.recommendation).toBe("ready_for_handoff_bundle_review");
    expect(result.provenance.matchedArtifactPaths.length).toBe(4);
  });

  it("throws when the root directory path is missing", () => {
    expect(() =>
      buildOpenPraQuantumFrontendProvenanceExportPayload({
        rootDirectoryPath: "",
      }),
    ).toThrow("rootDirectoryPath is required.");
  });
});
