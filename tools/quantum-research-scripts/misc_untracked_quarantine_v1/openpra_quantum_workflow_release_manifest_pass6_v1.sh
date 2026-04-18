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

REPORT_DIR="artifacts/quantum_integration/workflow_release_manifest_pass6_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_MANIFEST="packages/web-backend/tests/quantumReadiness.workflowReleaseManifest.http.spec.ts"
HTTP_SPEC_WRITE="packages/web-backend/tests/quantumReadiness.workflowReleaseManifest.write.http.spec.ts"

python3 <<'PY'
from pathlib import Path
import sys

service_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts")
controller_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts")

service = service_path.read_text(encoding="utf-8")
controller = controller_path.read_text(encoding="utf-8")

service_interface_block = """
export interface QuantumWorkflowReleaseManifestResult {
  workflowRunDir: string;
  manifestPath: string | null;
  releaseSummary: QuantumWorkflowReleaseSummaryResult;
  artifacts: {
    preparationBundles: string[];
    preparationArtifacts: string[];
    executionArtifacts: string[];
    executionProvenance: string[];
    recoveryArtifacts: string[];
    recoveryBatchRollups: string[];
    importanceComparisons: string[];
    importanceReports: string[];
    logFiles: string[];
  };
}

export interface QuantumWorkflowReleaseManifestWriteResult {
  outputDir: string;
  workflowReleaseManifestPath: string;
}

"""

service_method_block = """
  buildWorkflowReleaseManifest(
    workflowRunDir: string
  ): QuantumWorkflowReleaseManifestResult {
    const inspection = this.inspectWorkflowRun(workflowRunDir);
    const releaseSummary = this.buildWorkflowReleaseSummary(workflowRunDir);
    const recoveryDir = inspection.directories.recovery;

    return {
      workflowRunDir: inspection.workflowRunDir,
      manifestPath: inspection.manifestPath,
      releaseSummary,
      artifacts: {
        preparationBundles: inspection.files.preparationBundles,
        preparationArtifacts: inspection.files.preparationArtifacts,
        executionArtifacts: inspection.files.executionArtifacts,
        executionProvenance: inspection.files.executionProvenance,
        recoveryArtifacts: inspection.files.recoveryArtifacts,
        recoveryBatchRollups: inspection.files.recoveryBatchRollups,
        importanceComparisons:
          recoveryDir !== null
            ? listFilesMatching(
                recoveryDir,
                /^openpra_quantum_importance_comparison_v1\\.json$/
              )
            : [],
        importanceReports:
          recoveryDir !== null
            ? listFilesMatching(
                recoveryDir,
                /^openpra_quantum_importance_comparison_report_v1\\.json$/
              )
            : [],
        logFiles: inspection.files.logFiles
      }
    };
  }

  buildWorkflowReleaseManifestToFilesystem(
    workflowRunDir: string,
    outputDir: string
  ): QuantumWorkflowReleaseManifestWriteResult {
    const result = this.buildWorkflowReleaseManifest(workflowRunDir);
    const resolvedOutputDir = path.resolve(outputDir);
    const workflowReleaseManifestPath = path.join(
      resolvedOutputDir,
      "openpra_quantum_workflow_release_manifest_v1.json"
    );

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(
      workflowReleaseManifestPath,
      JSON.stringify(result, null, 2) + "\\n",
      "utf8"
    );

    return {
      outputDir: resolvedOutputDir,
      workflowReleaseManifestPath
    };
  }

"""

controller_import_old = """  type QuantumWorkflowReleaseSummaryResult,
  type QuantumWorkflowReleaseSummaryWriteResult,
  type QuantumWorkflowRunInspectionResult,"""

controller_import_new = """  type QuantumWorkflowReleaseManifestResult,
  type QuantumWorkflowReleaseManifestWriteResult,
  type QuantumWorkflowReleaseSummaryResult,
  type QuantumWorkflowReleaseSummaryWriteResult,
  type QuantumWorkflowRunInspectionResult,"""

controller_interface_block = """
export interface QuantumWorkflowReleaseManifestRequest {
  workflowRunDir: string;
}

export interface QuantumWorkflowReleaseManifestWriteRequest {
  workflowRunDir: string;
  outputDir: string;
}

"""

controller_endpoint_block = """
  @Post("/release/workflow-manifest")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseManifest(
    @Body() body: QuantumWorkflowReleaseManifestRequest
  ): QuantumWorkflowReleaseManifestResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseManifest(
        body.workflowRunDir
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-manifest/write")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseManifestToFilesystem(
    @Body() body: QuantumWorkflowReleaseManifestWriteRequest
  ): QuantumWorkflowReleaseManifestWriteResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseManifestToFilesystem(
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

if "export interface QuantumWorkflowReleaseManifestResult" not in service:
    service = insert_before_first(
        service,
        "\n@Injectable()\nexport class QuantumReadinessService {",
        "\n" + service_interface_block,
        "ERROR: Could not find service release manifest interface insertion anchor."
    )

if "buildWorkflowReleaseManifest(" not in service:
    service = insert_before_first(
        service,
        "\n  buildWorkflowReleaseSummary(\n",
        "\n" + service_method_block,
        "ERROR: Could not find service release manifest method insertion anchor."
    )

if "type QuantumWorkflowReleaseManifestResult," not in controller:
    if controller_import_old not in controller:
        sys.exit("ERROR: Could not find controller release manifest import insertion anchor.")
    controller = controller.replace(controller_import_old, controller_import_new, 1)

if "export interface QuantumWorkflowReleaseManifestRequest" not in controller:
    controller = insert_before_first(
        controller,
        "\n@Controller()\nexport class QuantumReadinessController {",
        "\n" + controller_interface_block,
        "ERROR: Could not find controller release manifest interface insertion anchor."
    )

if '@Post("/release/workflow-manifest")' not in controller:
    controller = insert_before_first(
        controller,
        '\n  @Post("/release/workflow-summary")\n',
        "\n" + controller_endpoint_block,
        "ERROR: Could not find controller release manifest endpoint insertion anchor."
    )

service_path.write_text(service, encoding="utf-8")
controller_path.write_text(controller, encoding="utf-8")
PY

cat > "${HTTP_SPEC_MANIFEST}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowReleaseManifestHttpResponse {
  workflowRunDir: string;
  artifacts: {
    preparationBundles: string[];
    executionArtifacts: string[];
    executionProvenance: string[];
    recoveryArtifacts: string[];
    importanceComparisons: string[];
    importanceReports: string[];
    logFiles: string[];
  };
  releaseSummary: {
    readiness: {
      releaseReady: boolean;
    };
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow release manifest", () => {
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

  it("POST /api/quantum-readiness/release/workflow-manifest returns release artifact paths", async () => {
    const workflowRunDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-manifest-")
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
      .post("/api/quantum-readiness/release/workflow-manifest")
      .send({
        workflowRunDir
      })
      .expect(200);

    const body = response.body as WorkflowReleaseManifestHttpResponse;

    expect(body.workflowRunDir).toBe(workflowRunDir);
    expect(body.artifacts.preparationBundles.length).toBe(1);
    expect(body.artifacts.executionArtifacts.length).toBe(1);
    expect(body.artifacts.executionProvenance.length).toBe(1);
    expect(body.artifacts.recoveryArtifacts.length).toBe(1);
    expect(body.artifacts.importanceComparisons.length).toBe(1);
    expect(body.artifacts.importanceReports.length).toBe(1);
    expect(body.artifacts.logFiles.length).toBe(1);
    expect(body.releaseSummary.readiness.releaseReady).toBe(true);
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

interface WorkflowReleaseManifestWriteHttpResponse {
  outputDir: string;
  workflowReleaseManifestPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow release manifest write", () => {
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

  it("POST /api/quantum-readiness/release/workflow-manifest/write writes a release manifest artifact", async () => {
    const workflowRunDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-manifest-write-run-")
    );
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-manifest-write-out-")
    );

    writeJson(
      path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json"),
      { ok: true }
    );
    fs.mkdirSync(path.join(workflowRunDir, "artifacts", "recovery"), { recursive: true });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-manifest/write")
      .send({
        workflowRunDir,
        outputDir
      })
      .expect(200);

    const body = response.body as WorkflowReleaseManifestWriteHttpResponse;

    expect(body.outputDir).toBe(outputDir);
    expect(body.workflowReleaseManifestPath).toBe(
      path.join(outputDir, "openpra_quantum_workflow_release_manifest_v1.json")
    );
    expect(fs.existsSync(body.workflowReleaseManifestPath)).toBe(true);
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
