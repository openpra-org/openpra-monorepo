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

REPORT_DIR="artifacts/quantum_integration/importance_write_consolidated_pass2_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_KIND="packages/web-backend/tests/quantumReadiness.importanceComparison.writeByKind.http.spec.ts"
HTTP_SPEC_RUN="packages/web-backend/tests/quantumReadiness.importanceComparison.writeByWorkflowRun.http.spec.ts"

python3 <<'PY'
from pathlib import Path
import sys

service_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts")
controller_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts")

service = service_path.read_text(encoding="utf-8")
controller = controller_path.read_text(encoding="utf-8")

service_interface_block = """
export interface QuantumImportanceComparisonWriteByKindRequest
  extends QuantumImportanceComparisonRequest {
  rootDir: string;
  workflowKind: string;
}

export interface QuantumImportanceComparisonWriteByKindResult {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonPath: string;
}

export interface QuantumImportanceComparisonWriteByWorkflowRunRequest
  extends QuantumImportanceComparisonRequest {
  workflowRunDir: string;
}

export interface QuantumImportanceComparisonWriteByWorkflowRunResult {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonPath: string;
}

"""

service_method_block = """
  compareImportanceMeasuresToLatestWorkflowRunByKind(
    request: QuantumImportanceComparisonWriteByKindRequest
  ): QuantumImportanceComparisonWriteByKindResult {
    const latest = this.getLatestWorkflowRunByKind(
      request.rootDir,
      request.workflowKind
    );

    if (!latest.latest) {
      throw new Error(
        `No workflow run found for workflowKind ${request.workflowKind}.`
      );
    }

    const workflowRunDir = latest.latest.workflowRunDir;
    const outputDir = path.join(workflowRunDir, "artifacts", "recovery");

    const writeResult = this.compareImportanceMeasuresToFilesystem(
      {
        modelId: request.modelId,
        subtreeId: request.subtreeId,
        measureName: request.measureName,
        quantumValues: request.quantumValues,
        classicalValues: request.classicalValues,
        ...(request.tolerance !== undefined ? { tolerance: request.tolerance } : {})
      },
      outputDir
    );

    return {
      workflowRunDir,
      outputDir: writeResult.outputDir,
      importanceComparisonPath: writeResult.importanceComparisonPath
    };
  }

  compareImportanceMeasuresToWorkflowRunDir(
    request: QuantumImportanceComparisonWriteByWorkflowRunRequest
  ): QuantumImportanceComparisonWriteByWorkflowRunResult {
    if (!request.workflowRunDir || request.workflowRunDir.trim().length === 0) {
      throw new Error("workflowRunDir is required.");
    }

    const inspection = this.inspectWorkflowRun(request.workflowRunDir);
    const workflowRunDir = inspection.workflowRunDir;
    const outputDir = path.join(workflowRunDir, "artifacts", "recovery");

    const writeResult = this.compareImportanceMeasuresToFilesystem(
      {
        modelId: request.modelId,
        subtreeId: request.subtreeId,
        measureName: request.measureName,
        quantumValues: request.quantumValues,
        classicalValues: request.classicalValues,
        ...(request.tolerance !== undefined ? { tolerance: request.tolerance } : {})
      },
      outputDir
    );

    return {
      workflowRunDir,
      outputDir: writeResult.outputDir,
      importanceComparisonPath: writeResult.importanceComparisonPath
    };
  }

"""

controller_import_old = """  type QuantumImportanceComparisonRequest,
  type QuantumImportanceComparisonResult,
  type QuantumImportanceComparisonWriteByTargetRequest,
  type QuantumImportanceComparisonWriteByTargetResult,
  type QuantumImportanceComparisonWriteResult,"""

controller_import_new = """  type QuantumImportanceComparisonRequest,
  type QuantumImportanceComparisonResult,
  type QuantumImportanceComparisonWriteByKindRequest,
  type QuantumImportanceComparisonWriteByKindResult,
  type QuantumImportanceComparisonWriteByTargetRequest,
  type QuantumImportanceComparisonWriteByTargetResult,
  type QuantumImportanceComparisonWriteByWorkflowRunRequest,
  type QuantumImportanceComparisonWriteByWorkflowRunResult,
  type QuantumImportanceComparisonWriteResult,"""

controller_interface_block = """
export interface QuantumImportanceComparisonWriteByKindRequestBody
  extends QuantumImportanceComparisonWriteByKindRequest {}

export interface QuantumImportanceComparisonWriteByWorkflowRunRequestBody
  extends QuantumImportanceComparisonWriteByWorkflowRunRequest {}

"""

controller_endpoint_block = """
  @Post("/importance/compare/write/by-kind")
  @HttpCode(HttpStatus.OK)
  compareImportanceMeasuresToLatestWorkflowRunByKind(
    @Body() body: QuantumImportanceComparisonWriteByKindRequestBody
  ): QuantumImportanceComparisonWriteByKindResult {
    try {
      return this.quantumReadinessService.compareImportanceMeasuresToLatestWorkflowRunByKind(
        body
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/compare/write/by-workflow-run")
  @HttpCode(HttpStatus.OK)
  compareImportanceMeasuresToWorkflowRunDir(
    @Body() body: QuantumImportanceComparisonWriteByWorkflowRunRequestBody
  ): QuantumImportanceComparisonWriteByWorkflowRunResult {
    try {
      return this.quantumReadinessService.compareImportanceMeasuresToWorkflowRunDir(
        body
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

if "export interface QuantumImportanceComparisonWriteByKindRequest" not in service:
    service = insert_before_first(
        service,
        "\n@Injectable()\nexport class QuantumReadinessService {",
        "\n" + service_interface_block,
        "ERROR: Could not find service consolidated interface insertion anchor."
    )

if "compareImportanceMeasuresToLatestWorkflowRunByKind(" not in service:
    service = insert_before_first(
        service,
        "\n  compareImportanceMeasuresToLatestWorkflowRunByTarget(\n",
        "\n" + service_method_block,
        "ERROR: Could not find service consolidated method insertion anchor."
    )

if "type QuantumImportanceComparisonWriteByKindRequest," not in controller:
    if controller_import_old not in controller:
      sys.exit("ERROR: Could not find controller consolidated import insertion anchor.")
    controller = controller.replace(controller_import_old, controller_import_new, 1)

if "export interface QuantumImportanceComparisonWriteByKindRequestBody" not in controller:
    controller = insert_before_first(
        controller,
        "\n@Controller()\nexport class QuantumReadinessController {",
        "\n" + controller_interface_block,
        "ERROR: Could not find controller consolidated interface insertion anchor."
    )

if '@Post("/importance/compare/write/by-kind")' not in controller:
    controller = insert_before_first(
        controller,
        '\n  @Post("/importance/compare/write/by-target")\n',
        "\n" + controller_endpoint_block,
        "ERROR: Could not find controller consolidated endpoint insertion anchor."
    )

old_guard = """      message.startsWith("No fault tree graph found for faultTreeId") ||
      message.startsWith("workflowRunDir does not exist") ||
      message.startsWith("rootDir does not exist") ||
      message.startsWith("No workflow run found for modelId")"""

new_guard = """      message.startsWith("No fault tree graph found for faultTreeId") ||
      message.startsWith("workflowRunDir does not exist") ||
      message.startsWith("rootDir does not exist") ||
      message.startsWith("No workflow run found for modelId") ||
      message.startsWith("No workflow run found for workflowKind")"""

if 'message.startsWith("No workflow run found for workflowKind")' not in controller:
    if old_guard not in controller:
        sys.exit("ERROR: Could not find controller consolidated error guard anchor.")
    controller = controller.replace(old_guard, new_guard, 1)

service_path.write_text(service, encoding="utf-8")
controller_path.write_text(controller, encoding="utf-8")
PY

cat > "${HTTP_SPEC_KIND}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonWriteByKindHttpResponse {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP importance comparison write by kind", () => {
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

  it("POST /api/quantum-readiness/importance/compare/write/by-kind writes into the latest matching workflow kind", async () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-importance-write-kind-root-")
    );

    const runPrep = path.join(rootDir, "openpra_quantum_preparation_old");
    const runFullOld = path.join(rootDir, "openpra_quantum_full_pipeline_old");
    const runFullNew = path.join(rootDir, "openpra_quantum_full_pipeline_new");

    fs.mkdirSync(runPrep, { recursive: true });
    fs.mkdirSync(runFullOld, { recursive: true });
    fs.mkdirSync(runFullNew, { recursive: true });

    writeJson(path.join(runPrep, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-15T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP"
    });

    writeJson(path.join(runFullOld, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-15T11:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP"
    });

    writeJson(path.join(runFullNew, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP"
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare/write/by-kind")
      .send({
        rootDir,
        workflowKind: "full_pipeline",
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
        measureName: "birnbaum",
        quantumValues: { A: 0.2, B: 0.1 },
        classicalValues: { A: 0.25, B: 0.05 }
      })
      .expect(200);

    const body = response.body as ImportanceComparisonWriteByKindHttpResponse;

    expect(body.workflowRunDir).toBe(runFullNew);
    expect(body.outputDir).toBe(path.join(runFullNew, "artifacts", "recovery"));
    expect(fs.existsSync(body.importanceComparisonPath)).toBe(true);
  });
});
EOF

cat > "${HTTP_SPEC_RUN}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonWriteByWorkflowRunHttpResponse {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP importance comparison write by workflow run", () => {
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

  it("POST /api/quantum-readiness/importance/compare/write/by-workflow-run writes directly into the requested workflow run", async () => {
    const workflowRunDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-importance-write-run-")
    );

    writeJson(path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP"
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare/write/by-workflow-run")
      .send({
        workflowRunDir,
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
        measureName: "birnbaum",
        quantumValues: { A: 0.2, B: 0.1 },
        classicalValues: { A: 0.25, B: 0.05 }
      })
      .expect(200);

    const body = response.body as ImportanceComparisonWriteByWorkflowRunHttpResponse;

    expect(body.workflowRunDir).toBe(workflowRunDir);
    expect(body.outputDir).toBe(path.join(workflowRunDir, "artifacts", "recovery"));
    expect(fs.existsSync(body.importanceComparisonPath)).toBe(true);
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
