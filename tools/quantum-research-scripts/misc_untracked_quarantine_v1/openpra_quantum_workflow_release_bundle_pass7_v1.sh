#!/usr/bin/env bash
set -euo pipefail

SCRIPT_VERSION="1.0.0"
UTC_NOW="$(date -u +"%Y%m%d_%H%M%SZ")"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: This script must be run inside the OpenPRA git repository."
  exit 1
fi

cd "${REPO_ROOT}"

REPORT_DIR="artifacts/quantum_integration/workflow_release_bundle_pass7_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_BUNDLE="packages/web-backend/tests/quantumReadiness.workflowReleaseBundle.write.http.spec.ts"

python3 <<'PY'
from pathlib import Path
import sys

service_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts")
controller_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts")

service = service_path.read_text(encoding="utf-8")
controller = controller_path.read_text(encoding="utf-8")

service_interface_block = """
export interface QuantumWorkflowReleaseBundleWriteResult {
  outputDir: string;
  bundleDir: string;
  summaryPath: string;
  manifestCopyPath: string | null;
  releaseSummaryPath: string;
  releaseManifestPath: string;
}

"""

service_method_block = """
  buildWorkflowReleaseBundleToFilesystem(
    workflowRunDir: string,
    outputDir: string
  ): QuantumWorkflowReleaseBundleWriteResult {
    const inspection = this.inspectWorkflowRun(workflowRunDir);
    const summaryWrite = this.buildWorkflowReleaseSummaryToFilesystem(
      workflowRunDir,
      outputDir
    );
    const manifestWrite = this.buildWorkflowReleaseManifestToFilesystem(
      workflowRunDir,
      outputDir
    );

    const resolvedOutputDir = path.resolve(outputDir);
    const bundleDir = path.join(resolvedOutputDir, "openpra_quantum_release_bundle_v1");
    fs.mkdirSync(bundleDir, { recursive: true });

    const releaseSummaryPath = path.join(
      bundleDir,
      "openpra_quantum_workflow_release_summary_v1.json"
    );
    const releaseManifestPath = path.join(
      bundleDir,
      "openpra_quantum_workflow_release_manifest_v1.json"
    );

    fs.copyFileSync(summaryWrite.workflowReleaseSummaryPath, releaseSummaryPath);
    fs.copyFileSync(manifestWrite.workflowReleaseManifestPath, releaseManifestPath);

    let manifestCopyPath: string | null = null;

    if (inspection.manifestPath) {
      manifestCopyPath = path.join(
        bundleDir,
        "openpra_quantum_workflow_run_manifest_v1.json"
      );
      fs.copyFileSync(inspection.manifestPath, manifestCopyPath);
    }

    return {
      outputDir: resolvedOutputDir,
      bundleDir,
      summaryPath: summaryWrite.workflowReleaseSummaryPath,
      manifestCopyPath,
      releaseSummaryPath,
      releaseManifestPath
    };
  }

"""

controller_import_old = """  type QuantumWorkflowReleaseManifestResult,
  type QuantumWorkflowReleaseManifestWriteResult,
  type QuantumWorkflowReleaseSummaryResult,"""

controller_import_new = """  type QuantumWorkflowReleaseBundleWriteResult,
  type QuantumWorkflowReleaseManifestResult,
  type QuantumWorkflowReleaseManifestWriteResult,
  type QuantumWorkflowReleaseSummaryResult,"""

controller_interface_block = """
export interface QuantumWorkflowReleaseBundleWriteRequest {
  workflowRunDir: string;
  outputDir: string;
}

"""

controller_endpoint_block = """
  @Post("/release/workflow-bundle/write")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseBundleToFilesystem(
    @Body() body: QuantumWorkflowReleaseBundleWriteRequest
  ): QuantumWorkflowReleaseBundleWriteResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseBundleToFilesystem(
        body.workflowRunDir,
        body.outputDir
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

"""

def insert_before_first(text: str, anchors: list[str], block: str, err: str) -> str:
    for anchor in anchors:
        if anchor in text:
            return text.replace(anchor, block + anchor, 1)
    sys.exit(err)

if "export interface QuantumWorkflowReleaseBundleWriteResult" not in service:
    service = insert_before_first(
        service,
        ["\n@Injectable()\nexport class QuantumReadinessService {"],
        "\n" + service_interface_block,
        "ERROR: Could not find service release bundle interface insertion anchor."
    )

if "buildWorkflowReleaseBundleToFilesystem(" not in service:
    service = insert_before_first(
        service,
        [
            "\n  buildWorkflowReleaseManifestToFilesystem(\n",
            "\n  buildWorkflowReleaseManifest(\n",
            "\n  buildWorkflowReleaseSummaryToFilesystem(\n"
        ],
        "\n" + service_method_block,
        "ERROR: Could not find service release bundle method insertion anchor."
    )

if "type QuantumWorkflowReleaseBundleWriteResult," not in controller:
    if controller_import_old not in controller:
        sys.exit("ERROR: Could not find controller release bundle import insertion anchor.")
    controller = controller.replace(controller_import_old, controller_import_new, 1)

if "export interface QuantumWorkflowReleaseBundleWriteRequest" not in controller:
    controller = insert_before_first(
        controller,
        ["\n@Controller()\nexport class QuantumReadinessController {"],
        "\n" + controller_interface_block,
        "ERROR: Could not find controller release bundle interface insertion anchor."
    )

if '@Post("/release/workflow-bundle/write")' not in controller:
    controller = insert_before_first(
        controller,
        [
            '\n  @Post("/release/workflow-manifest")\n',
            '\n  @Post("/release/workflow-summary")\n'
        ],
        "\n" + controller_endpoint_block,
        "ERROR: Could not find controller release bundle endpoint insertion anchor."
    )

service_path.write_text(service, encoding="utf-8")
controller_path.write_text(controller, encoding="utf-8")
PY

cat > "${HTTP_SPEC_BUNDLE}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowReleaseBundleWriteHttpResponse {
  outputDir: string;
  bundleDir: string;
  summaryPath: string;
  manifestCopyPath: string | null;
  releaseSummaryPath: string;
  releaseManifestPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow release bundle write", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn()
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock
        }
      ]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/quantum-readiness");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/quantum-readiness/release/workflow-bundle/write writes a release bundle", async () => {
    const workflowRunDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-bundle-run-")
    );
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-bundle-out-")
    );

    writeJson(
      path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json"),
      { ok: true }
    );

    writeJson(
      path.join(
        workflowRunDir,
        "artifacts",
        "preparation",
        "openpra_quantum_preparation_bundle_v1.json"
      ),
      { ok: true }
    );

    writeJson(
      path.join(
        workflowRunDir,
        "artifacts",
        "execution",
        "openpra_quantum_execution_artifact_v1.json"
      ),
      { ok: true }
    );

    writeJson(
      path.join(
        workflowRunDir,
        "artifacts",
        "execution",
        "openpra_quantum_execution_provenance_manifest_v1.json"
      ),
      { ok: true }
    );

    writeJson(
      path.join(
        workflowRunDir,
        "artifacts",
        "recovery",
        "openpra_quantum_recovery_artifact_v1.json"
      ),
      { ok: true }
    );

    writeJson(
      path.join(
        workflowRunDir,
        "artifacts",
        "recovery",
        "openpra_quantum_importance_comparison_v1.json"
      ),
      { ok: true }
    );

    writeJson(
      path.join(
        workflowRunDir,
        "artifacts",
        "recovery",
        "openpra_quantum_importance_comparison_report_v1.json"
      ),
      { ok: true }
    );

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-bundle/write")
      .send({
        workflowRunDir,
        outputDir
      })
      .expect(200);

    const body = response.body as WorkflowReleaseBundleWriteHttpResponse;

    expect(body.outputDir).toBe(outputDir);
    expect(fs.existsSync(body.bundleDir)).toBe(true);
    expect(fs.existsSync(body.releaseSummaryPath)).toBe(true);
    expect(fs.existsSync(body.releaseManifestPath)).toBe(true);
    expect(body.manifestCopyPath).not.toBeNull();
    expect(fs.existsSync(body.manifestCopyPath as string)).toBe(true);
  });
});
EOF

echo "==> Running quantum-readiness tests"
if ./node_modules/.bin/nx test quantum-readiness > "${REPORT_DIR}/nx_test_quantum_readiness.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_test_quantum_readiness.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_test_quantum_readiness.status"
fi

echo "==> Running web-backend tests"
if ./node_modules/.bin/nx test web-backend > "${REPORT_DIR}/nx_test_web_backend.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_test_web_backend.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_test_web_backend.status"
fi

echo "==> Running quantum-readiness build"
if ./node_modules/.bin/nx build quantum-readiness > "${REPORT_DIR}/nx_build_quantum_readiness.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_build_quantum_readiness.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_build_quantum_readiness.status"
fi

echo "DONE"
echo "Report directory: ${REPORT_DIR}"
echo "quantum-readiness test: $(cat "${REPORT_DIR}/nx_test_quantum_readiness.status")"
echo "web-backend test: $(cat "${REPORT_DIR}/nx_test_web_backend.status")"
echo "quantum-readiness build: $(cat "${REPORT_DIR}/nx_build_quantum_readiness.status")"
