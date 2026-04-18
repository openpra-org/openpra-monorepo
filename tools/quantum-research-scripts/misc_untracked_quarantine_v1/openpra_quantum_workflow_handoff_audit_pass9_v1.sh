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

REPORT_DIR="artifacts/quantum_integration/workflow_handoff_audit_pass9_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_AUDIT="packages/web-backend/tests/quantumReadiness.workflowHandoffAudit.http.spec.ts"
HTTP_SPEC_WRITE="packages/web-backend/tests/quantumReadiness.workflowHandoffAudit.write.http.spec.ts"

python3 <<'PY'
from pathlib import Path
import sys

service_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts")
controller_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts")

service = service_path.read_text(encoding="utf-8")
controller = controller_path.read_text(encoding="utf-8")

service_interface_block = """
export interface QuantumWorkflowHandoffAuditResult {
  workflowRunDir: string;
  status: "ready" | "not_ready";
  checks: {
    hasWorkflowManifest: boolean;
    hasPreparation: boolean;
    hasExecution: boolean;
    hasRecovery: boolean;
    hasImportanceComparison: boolean;
    hasImportanceReport: boolean;
    releaseReady: boolean;
  };
  missingArtifacts: string[];
  nextActions: string[];
  releaseSummary: QuantumWorkflowReleaseSummaryResult;
  releaseManifest: QuantumWorkflowReleaseManifestResult;
}

export interface QuantumWorkflowHandoffAuditWriteResult {
  outputDir: string;
  workflowHandoffAuditPath: string;
}

"""

service_method_block = """
  buildWorkflowHandoffAudit(
    workflowRunDir: string
  ): QuantumWorkflowHandoffAuditResult {
    const releaseSummary = this.buildWorkflowReleaseSummary(workflowRunDir);
    const releaseManifest = this.buildWorkflowReleaseManifest(workflowRunDir);

    const checks = {
      hasWorkflowManifest: releaseManifest.manifestPath !== null,
      hasPreparation: releaseSummary.readiness.hasPreparation,
      hasExecution: releaseSummary.readiness.hasExecution,
      hasRecovery: releaseSummary.readiness.hasRecovery,
      hasImportanceComparison: releaseSummary.readiness.hasImportanceComparison,
      hasImportanceReport: releaseSummary.readiness.hasImportanceReport,
      releaseReady: releaseSummary.readiness.releaseReady
    };

    const missingArtifacts: string[] = [];

    if (!checks.hasWorkflowManifest) {
      missingArtifacts.push("openpra_quantum_workflow_run_manifest_v1.json");
    }
    if (!checks.hasPreparation) {
      missingArtifacts.push("openpra_quantum_preparation_bundle_v1.json");
    }
    if (!checks.hasExecution) {
      missingArtifacts.push("execution artifact and provenance manifest");
    }
    if (!checks.hasRecovery) {
      missingArtifacts.push("recovery artifact or recovery batch rollup");
    }
    if (!checks.hasImportanceComparison) {
      missingArtifacts.push("openpra_quantum_importance_comparison_v1.json");
    }
    if (!checks.hasImportanceReport) {
      missingArtifacts.push("openpra_quantum_importance_comparison_report_v1.json");
    }

    const nextActions =
      missingArtifacts.length === 0
        ? ["Ready for handoff, review, and merge readiness assessment."]
        : missingArtifacts.map(
            (artifact) => `Add or regenerate ${artifact}.`
          );

    return {
      workflowRunDir: releaseSummary.workflowRunDir,
      status: checks.releaseReady ? "ready" : "not_ready",
      checks,
      missingArtifacts,
      nextActions,
      releaseSummary,
      releaseManifest
    };
  }

  buildWorkflowHandoffAuditToFilesystem(
    workflowRunDir: string,
    outputDir: string
  ): QuantumWorkflowHandoffAuditWriteResult {
    const result = this.buildWorkflowHandoffAudit(workflowRunDir);
    const resolvedOutputDir = path.resolve(outputDir);
    const workflowHandoffAuditPath = path.join(
      resolvedOutputDir,
      "openpra_quantum_workflow_handoff_audit_v1.json"
    );

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(
      workflowHandoffAuditPath,
      JSON.stringify(result, null, 2) + "\\n",
      "utf8"
    );

    return {
      outputDir: resolvedOutputDir,
      workflowHandoffAuditPath
    };
  }

"""

controller_import_old = """  type QuantumWorkflowReleaseBundleWriteByTargetRequest,
  type QuantumWorkflowReleaseBundleWriteByTargetResult,
  type QuantumWorkflowReleaseBundleWriteResult,"""

controller_import_new = """  type QuantumWorkflowHandoffAuditResult,
  type QuantumWorkflowHandoffAuditWriteResult,
  type QuantumWorkflowReleaseBundleWriteByTargetRequest,
  type QuantumWorkflowReleaseBundleWriteByTargetResult,
  type QuantumWorkflowReleaseBundleWriteResult,"""

controller_interface_block = """
export interface QuantumWorkflowHandoffAuditRequest {
  workflowRunDir: string;
}

export interface QuantumWorkflowHandoffAuditWriteRequest {
  workflowRunDir: string;
  outputDir: string;
}

"""

controller_endpoint_block = """
  @Post("/release/workflow-handoff-audit")
  @HttpCode(HttpStatus.OK)
  buildWorkflowHandoffAudit(
    @Body() body: QuantumWorkflowHandoffAuditRequest
  ): QuantumWorkflowHandoffAuditResult {
    try {
      return this.quantumReadinessService.buildWorkflowHandoffAudit(
        body.workflowRunDir
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-handoff-audit/write")
  @HttpCode(HttpStatus.OK)
  buildWorkflowHandoffAuditToFilesystem(
    @Body() body: QuantumWorkflowHandoffAuditWriteRequest
  ): QuantumWorkflowHandoffAuditWriteResult {
    try {
      return this.quantumReadinessService.buildWorkflowHandoffAuditToFilesystem(
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

if "export interface QuantumWorkflowHandoffAuditResult" not in service:
    service = insert_before_first(
        service,
        ["\n@Injectable()\nexport class QuantumReadinessService {"],
        "\n" + service_interface_block,
        "ERROR: Could not find service handoff audit interface insertion anchor."
    )

if "buildWorkflowHandoffAudit(" not in service:
    service = insert_before_first(
        service,
        [
            "\n  buildWorkflowReleaseBundleToFilesystem(\n",
            "\n  buildWorkflowReleaseManifestToFilesystem(\n",
            "\n  buildWorkflowReleaseManifest(\n"
        ],
        "\n" + service_method_block,
        "ERROR: Could not find service handoff audit method insertion anchor."
    )

if "type QuantumWorkflowHandoffAuditResult," not in controller:
    if controller_import_old not in controller:
        sys.exit("ERROR: Could not find controller handoff audit import insertion anchor.")
    controller = controller.replace(controller_import_old, controller_import_new, 1)

if "export interface QuantumWorkflowHandoffAuditRequest" not in controller:
    controller = insert_before_first(
        controller,
        ["\n@Controller()\nexport class QuantumReadinessController {"],
        "\n" + controller_interface_block,
        "ERROR: Could not find controller handoff audit interface insertion anchor."
    )

if '@Post("/release/workflow-handoff-audit")' not in controller:
    controller = insert_before_first(
        controller,
        [
            '\n  @Post("/release/workflow-bundle/write")\n',
            '\n  @Post("/release/workflow-manifest")\n'
        ],
        "\n" + controller_endpoint_block,
        "ERROR: Could not find controller handoff audit endpoint insertion anchor."
    )

service_path.write_text(service, encoding="utf-8")
controller_path.write_text(controller, encoding="utf-8")
PY

cat > "${HTTP_SPEC_AUDIT}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowHandoffAuditHttpResponse {
  workflowRunDir: string;
  status: string;
  checks: {
    hasWorkflowManifest: boolean;
    hasPreparation: boolean;
    hasExecution: boolean;
    hasRecovery: boolean;
    hasImportanceComparison: boolean;
    hasImportanceReport: boolean;
    releaseReady: boolean;
  };
  missingArtifacts: string[];
  nextActions: string[];
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow handoff audit", () => {
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

  it("POST /api/quantum-readiness/release/workflow-handoff-audit returns ready when all release artifacts exist", async () => {
    const workflowRunDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-handoff-audit-")
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
      .post("/api/quantum-readiness/release/workflow-handoff-audit")
      .send({
        workflowRunDir
      })
      .expect(200);

    const body = response.body as WorkflowHandoffAuditHttpResponse;

    expect(body.workflowRunDir).toBe(workflowRunDir);
    expect(body.status).toBe("ready");
    expect(body.checks.releaseReady).toBe(true);
    expect(body.missingArtifacts).toEqual([]);
    expect(body.nextActions).toEqual([
      "Ready for handoff, review, and merge readiness assessment."
    ]);
  });
});
EOF

cat > "${HTTP_SPEC_WRITE}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowHandoffAuditWriteHttpResponse {
  outputDir: string;
  workflowHandoffAuditPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow handoff audit write", () => {
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

  it("POST /api/quantum-readiness/release/workflow-handoff-audit/write writes a handoff audit artifact", async () => {
    const workflowRunDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-handoff-audit-run-")
    );
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-handoff-audit-out-")
    );

    writeJson(
      path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json"),
      { ok: true }
    );
    fs.mkdirSync(path.join(workflowRunDir, "artifacts", "recovery"), { recursive: true });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-handoff-audit/write")
      .send({
        workflowRunDir,
        outputDir
      })
      .expect(200);

    const body = response.body as WorkflowHandoffAuditWriteHttpResponse;

    expect(body.outputDir).toBe(outputDir);
    expect(body.workflowHandoffAuditPath).toBe(
      path.join(outputDir, "openpra_quantum_workflow_handoff_audit_v1.json")
    );
    expect(fs.existsSync(body.workflowHandoffAuditPath)).toBe(true);
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
