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

REPORT_DIR="artifacts/quantum_integration/release_handoff_bundle_pass10_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_BUNDLE="packages/web-backend/tests/quantumReadiness.releaseHandoffBundle.write.http.spec.ts"

python3 <<'PY'
from pathlib import Path
import re
import sys

service_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts")
controller_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts")

service = service_path.read_text(encoding="utf-8")
controller = controller_path.read_text(encoding="utf-8")

service_interface_block = """
export interface QuantumReleaseHandoffBundleWriteResult {
  outputDir: string;
  bundleDir: string;
  workflowBundleDir: string;
  handoffAuditPath: string;
  releaseSummaryPath: string;
  releaseManifestPath: string;
  workflowManifestCopyPath: string | null;
}

"""

service_method_block = """
  buildReleaseHandoffBundleToFilesystem(
    workflowRunDir: string,
    outputDir: string
  ): QuantumReleaseHandoffBundleWriteResult {
    const workflowBundle = this.buildWorkflowReleaseBundleToFilesystem(
      workflowRunDir,
      outputDir
    );
    const handoffAudit = this.buildWorkflowHandoffAuditToFilesystem(
      workflowRunDir,
      outputDir
    );

    const resolvedOutputDir = path.resolve(outputDir);
    const bundleDir = path.join(
      resolvedOutputDir,
      "openpra_quantum_release_handoff_bundle_v1"
    );
    fs.mkdirSync(bundleDir, { recursive: true });

    const releaseSummaryPath = path.join(
      bundleDir,
      "openpra_quantum_workflow_release_summary_v1.json"
    );
    const releaseManifestPath = path.join(
      bundleDir,
      "openpra_quantum_workflow_release_manifest_v1.json"
    );
    const handoffAuditPath = path.join(
      bundleDir,
      "openpra_quantum_workflow_handoff_audit_v1.json"
    );

    fs.copyFileSync(workflowBundle.releaseSummaryPath, releaseSummaryPath);
    fs.copyFileSync(workflowBundle.releaseManifestPath, releaseManifestPath);
    fs.copyFileSync(handoffAudit.workflowHandoffAuditPath, handoffAuditPath);

    let workflowManifestCopyPath: string | null = null;
    if (workflowBundle.manifestCopyPath) {
      workflowManifestCopyPath = path.join(
        bundleDir,
        "openpra_quantum_workflow_run_manifest_v1.json"
      );
      fs.copyFileSync(workflowBundle.manifestCopyPath, workflowManifestCopyPath);
    }

    return {
      outputDir: resolvedOutputDir,
      bundleDir,
      workflowBundleDir: workflowBundle.bundleDir,
      handoffAuditPath,
      releaseSummaryPath,
      releaseManifestPath,
      workflowManifestCopyPath
    };
  }

"""

controller_interface_block = """
export interface QuantumReleaseHandoffBundleWriteRequest {
  workflowRunDir: string;
  outputDir: string;
}

"""

controller_endpoint_block = """
  @Post("/release/handoff-bundle/write")
  @HttpCode(HttpStatus.OK)
  buildReleaseHandoffBundleToFilesystem(
    @Body() body: QuantumReleaseHandoffBundleWriteRequest
  ): QuantumReleaseHandoffBundleWriteResult {
    try {
      return this.quantumReadinessService.buildReleaseHandoffBundleToFilesystem(
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

if "export interface QuantumReleaseHandoffBundleWriteResult" not in service:
    service = insert_before_first(
        service,
        ["\n@Injectable()\nexport class QuantumReadinessService {"],
        "\n" + service_interface_block,
        "ERROR: Could not find service release handoff bundle interface insertion anchor."
    )

if "buildReleaseHandoffBundleToFilesystem(" not in service:
    service = insert_before_first(
        service,
        [
            "\n  buildWorkflowHandoffAuditToFilesystem(\n",
            "\n  buildWorkflowHandoffAudit(\n",
            "\n  buildWorkflowReleaseBundleToFilesystem(\n"
        ],
        "\n" + service_method_block,
        "ERROR: Could not find service release handoff bundle method insertion anchor."
    )

if "type QuantumReleaseHandoffBundleWriteResult," not in controller:
    pattern = r'import\s*\{\s*(.*?)\s*\}\s*from\s*"./quantumReadiness\.service";'
    match = re.search(pattern, controller, flags=re.DOTALL)
    if not match:
        sys.exit("ERROR: Could not find controller release handoff bundle import block.")
    block = match.group(1)
    addition = "  type QuantumReleaseHandoffBundleWriteResult,"
    if addition not in block:
        new_block = block.rstrip() + "\n" + addition
        replacement = 'import {\n' + new_block.strip("\n") + '\n} from "./quantumReadiness.service";'
        controller = controller[:match.start()] + replacement + controller[match.end():]

if "export interface QuantumReleaseHandoffBundleWriteRequest" not in controller:
    controller = insert_before_first(
        controller,
        ["\n@Controller()\nexport class QuantumReadinessController {"],
        "\n" + controller_interface_block,
        "ERROR: Could not find controller release handoff bundle interface insertion anchor."
    )

if '@Post("/release/handoff-bundle/write")' not in controller:
    controller = insert_before_first(
        controller,
        [
            '\n  @Post("/release/workflow-handoff-audit")\n',
            '\n  @Post("/release/workflow-bundle/write")\n'
        ],
        "\n" + controller_endpoint_block,
        "ERROR: Could not find controller release handoff bundle endpoint insertion anchor."
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

interface ReleaseHandoffBundleWriteHttpResponse {
  outputDir: string;
  bundleDir: string;
  workflowBundleDir: string;
  handoffAuditPath: string;
  releaseSummaryPath: string;
  releaseManifestPath: string;
  workflowManifestCopyPath: string | null;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP release handoff bundle write", () => {
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

  it("POST /api/quantum-readiness/release/handoff-bundle/write writes a final release handoff bundle", async () => {
    const workflowRunDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-handoff-run-")
    );
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-handoff-out-")
    );

    writeJson(
      path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json"),
      { ok: true }
    );
    writeJson(
      path.join(workflowRunDir, "artifacts", "preparation", "openpra_quantum_preparation_bundle_v1.json"),
      { ok: true }
    );
    writeJson(
      path.join(workflowRunDir, "artifacts", "execution", "openpra_quantum_execution_artifact_v1.json"),
      { ok: true }
    );
    writeJson(
      path.join(workflowRunDir, "artifacts", "execution", "openpra_quantum_execution_provenance_manifest_v1.json"),
      { ok: true }
    );
    writeJson(
      path.join(workflowRunDir, "artifacts", "recovery", "openpra_quantum_recovery_artifact_v1.json"),
      { ok: true }
    );
    writeJson(
      path.join(workflowRunDir, "artifacts", "recovery", "openpra_quantum_importance_comparison_v1.json"),
      { ok: true }
    );
    writeJson(
      path.join(workflowRunDir, "artifacts", "recovery", "openpra_quantum_importance_comparison_report_v1.json"),
      { ok: true }
    );

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/handoff-bundle/write")
      .send({
        workflowRunDir,
        outputDir
      })
      .expect(200);

    const body = response.body as ReleaseHandoffBundleWriteHttpResponse;

    expect(body.outputDir).toBe(outputDir);
    expect(fs.existsSync(body.bundleDir)).toBe(true);
    expect(fs.existsSync(body.workflowBundleDir)).toBe(true);
    expect(fs.existsSync(body.handoffAuditPath)).toBe(true);
    expect(fs.existsSync(body.releaseSummaryPath)).toBe(true);
    expect(fs.existsSync(body.releaseManifestPath)).toBe(true);
    expect(body.workflowManifestCopyPath).not.toBeNull();
    expect(fs.existsSync(body.workflowManifestCopyPath as string)).toBe(true);
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
