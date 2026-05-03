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

REPORT_DIR="artifacts/quantum_integration/workflow_release_summary_pass5_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_SUMMARY="packages/web-backend/tests/quantumReadiness.workflowReleaseSummary.http.spec.ts"
HTTP_SPEC_WRITE="packages/web-backend/tests/quantumReadiness.workflowReleaseSummary.write.http.spec.ts"

python3 <<'PY'
from pathlib import Path
import sys

service_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts")
controller_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts")

service = service_path.read_text(encoding="utf-8")
controller = controller_path.read_text(encoding="utf-8")

service_interface_block = """
export interface QuantumWorkflowReleaseSummaryResult {
  workflowRunDir: string;
  manifestPath: string | null;
  directories: {
    preparation: string | null;
    execution: string | null;
    recovery: string | null;
    batch: string | null;
    logs: string | null;
  };
  counts: {
    preparationBundles: number;
    preparationArtifacts: number;
    executionArtifacts: number;
    executionProvenance: number;
    recoveryArtifacts: number;
    recoveryBatchRollups: number;
    importanceComparisons: number;
    importanceReports: number;
    logFiles: number;
  };
  readiness: {
    hasPreparation: boolean;
    hasExecution: boolean;
    hasRecovery: boolean;
    hasImportanceComparison: boolean;
    hasImportanceReport: boolean;
    releaseReady: boolean;
  };
}

export interface QuantumWorkflowReleaseSummaryWriteResult {
  outputDir: string;
  workflowReleaseSummaryPath: string;
}

"""

service_method_block = """
  buildWorkflowReleaseSummary(
    workflowRunDir: string
  ): QuantumWorkflowReleaseSummaryResult {
    const inspection = this.inspectWorkflowRun(workflowRunDir);
    const recoveryDir = inspection.directories.recovery;
    const importanceComparisons =
      recoveryDir !== null
        ? listFilesMatching(
            recoveryDir,
            /^openpra_quantum_importance_comparison_v1\\.json$/
          ).length
        : 0;
    const importanceReports =
      recoveryDir !== null
        ? listFilesMatching(
            recoveryDir,
            /^openpra_quantum_importance_comparison_report_v1\\.json$/
          ).length
        : 0;

    const counts = {
      preparationBundles: inspection.files.preparationBundles.length,
      preparationArtifacts: inspection.files.preparationArtifacts.length,
      executionArtifacts: inspection.files.executionArtifacts.length,
      executionProvenance: inspection.files.executionProvenance.length,
      recoveryArtifacts: inspection.files.recoveryArtifacts.length,
      recoveryBatchRollups: inspection.files.recoveryBatchRollups.length,
      importanceComparisons,
      importanceReports,
      logFiles: inspection.files.logFiles.length
    };

    const readiness = {
      hasPreparation: counts.preparationBundles > 0,
      hasExecution:
        counts.executionArtifacts > 0 && counts.executionProvenance > 0,
      hasRecovery:
        counts.recoveryArtifacts > 0 || counts.recoveryBatchRollups > 0,
      hasImportanceComparison: counts.importanceComparisons > 0,
      hasImportanceReport: counts.importanceReports > 0,
      releaseReady:
        counts.preparationBundles > 0 &&
        counts.executionArtifacts > 0 &&
        counts.executionProvenance > 0 &&
        (counts.recoveryArtifacts > 0 || counts.recoveryBatchRollups > 0) &&
        counts.importanceComparisons > 0 &&
        counts.importanceReports > 0
    };

    return {
      workflowRunDir: inspection.workflowRunDir,
      manifestPath: inspection.manifestPath,
      directories: {
        preparation: inspection.directories.preparation,
        execution: inspection.directories.execution,
        recovery: inspection.directories.recovery,
        batch: inspection.directories.batch,
        logs: inspection.directories.logs
      },
      counts,
      readiness
    };
  }

  buildWorkflowReleaseSummaryToFilesystem(
    workflowRunDir: string,
    outputDir: string
  ): QuantumWorkflowReleaseSummaryWriteResult {
    const result = this.buildWorkflowReleaseSummary(workflowRunDir);
    const resolvedOutputDir = path.resolve(outputDir);
    const workflowReleaseSummaryPath = path.join(
      resolvedOutputDir,
      "openpra_quantum_workflow_release_summary_v1.json"
    );

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(
      workflowReleaseSummaryPath,
      JSON.stringify(result, null, 2) + "\\n",
      "utf8"
    );

    return {
      outputDir: resolvedOutputDir,
      workflowReleaseSummaryPath
    };
  }

"""

controller_import_old = """  type QuantumWorkflowRunInspectionResult,
  type QuantumWorkflowRunListingResult"""

controller_import_new = """  type QuantumWorkflowReleaseSummaryResult,
  type QuantumWorkflowReleaseSummaryWriteResult,
  type QuantumWorkflowRunInspectionResult,
  type QuantumWorkflowRunListingResult"""

controller_interface_block = """
export interface QuantumWorkflowReleaseSummaryRequest {
  workflowRunDir: string;
}

export interface QuantumWorkflowReleaseSummaryWriteRequest {
  workflowRunDir: string;
  outputDir: string;
}

"""

controller_endpoint_block = """
  @Post("/release/workflow-summary")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseSummary(
    @Body() body: QuantumWorkflowReleaseSummaryRequest
  ): QuantumWorkflowReleaseSummaryResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseSummary(
        body.workflowRunDir
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-summary/write")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseSummaryToFilesystem(
    @Body() body: QuantumWorkflowReleaseSummaryWriteRequest
  ): QuantumWorkflowReleaseSummaryWriteResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseSummaryToFilesystem(
        body.workflowRunDir,
        body.outputDir
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

"""

def insert_before_first(text: str, anchor: str, block: str, err: str) -> str:
    if anchor not in text:
        sys.exit(err)
    return text.replace(anchor, block + anchor, 1)

if "export interface QuantumWorkflowReleaseSummaryResult" not in service:
    service = insert_before_first(
        service,
        "\n@Injectable()\nexport class QuantumReadinessService {",
        "\n" + service_interface_block,
        "ERROR: Could not find service release summary interface insertion anchor."
    )

if "buildWorkflowReleaseSummary(" not in service:
    service = insert_before_first(
        service,
        "\n  analyzeFaultTreeGraph(\n",
        "\n" + service_method_block,
        "ERROR: Could not find service release summary method insertion anchor."
    )

if "type QuantumWorkflowReleaseSummaryResult," not in controller:
    if controller_import_old not in controller:
        sys.exit("ERROR: Could not find controller release summary import insertion anchor.")
    controller = controller.replace(controller_import_old, controller_import_new, 1)

if "export interface QuantumWorkflowReleaseSummaryRequest" not in controller:
    controller = insert_before_first(
        controller,
        "\n@Controller()\nexport class QuantumReadinessController {",
        "\n" + controller_interface_block,
        "ERROR: Could not find controller release summary interface insertion anchor."
    )

if '@Post("/release/workflow-summary")' not in controller:
    controller = insert_before_first(
        controller,
        '\n  @Post("/workflow/run-scaffold")\n',
        "\n" + controller_endpoint_block,
        "ERROR: Could not find controller release summary endpoint insertion anchor."
    )

service_path.write_text(service, encoding="utf-8")
controller_path.write_text(controller, encoding="utf-8")
PY

cat > "${HTTP_SPEC_SUMMARY}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowReleaseSummaryHttpResponse {
  workflowRunDir: string;
  manifestPath: string | null;
  counts: {
    preparationBundles: number;
    preparationArtifacts: number;
    executionArtifacts: number;
    executionProvenance: number;
    recoveryArtifacts: number;
    recoveryBatchRollups: number;
    importanceComparisons: number;
    importanceReports: number;
    logFiles: number;
  };
  readiness: {
    hasPreparation: boolean;
    hasExecution: boolean;
    hasRecovery: boolean;
    hasImportanceComparison: boolean;
    hasImportanceReport: boolean;
    releaseReady: boolean;
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow release summary", () => {
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

  it("POST /api/quantum-readiness/release/workflow-summary returns release readiness counts", async () => {
    const workflowRunDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-summary-")
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

    fs.mkdirSync(path.join(workflowRunDir, "logs"), { recursive: true });
    fs.writeFileSync(path.join(workflowRunDir, "logs", "run.log"), "ok\n", "utf8");

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-summary")
      .send({
        workflowRunDir
      })
      .expect(200);

    const body = response.body as WorkflowReleaseSummaryHttpResponse;

    expect(body.workflowRunDir).toBe(workflowRunDir);
    expect(body.counts.preparationBundles).toBe(1);
    expect(body.counts.executionArtifacts).toBe(1);
    expect(body.counts.executionProvenance).toBe(1);
    expect(body.counts.recoveryArtifacts).toBe(1);
    expect(body.counts.importanceComparisons).toBe(1);
    expect(body.counts.importanceReports).toBe(1);
    expect(body.counts.logFiles).toBe(1);
    expect(body.readiness.releaseReady).toBe(true);
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

interface WorkflowReleaseSummaryWriteHttpResponse {
  outputDir: string;
  workflowReleaseSummaryPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow release summary write", () => {
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

  it("POST /api/quantum-readiness/release/workflow-summary/write writes a release summary artifact", async () => {
    const workflowRunDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-summary-write-run-")
    );
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-summary-write-out-")
    );

    writeJson(
      path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json"),
      { ok: true }
    );
    fs.mkdirSync(path.join(workflowRunDir, "artifacts", "recovery"), { recursive: true });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-summary/write")
      .send({
        workflowRunDir,
        outputDir
      })
      .expect(200);

    const body = response.body as WorkflowReleaseSummaryWriteHttpResponse;

    expect(body.outputDir).toBe(outputDir);
    expect(body.workflowReleaseSummaryPath).toBe(
      path.join(outputDir, "openpra_quantum_workflow_release_summary_v1.json")
    );
    expect(fs.existsSync(body.workflowReleaseSummaryPath)).toBe(true);
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
