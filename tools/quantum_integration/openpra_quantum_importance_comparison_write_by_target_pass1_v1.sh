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

REPORT_DIR="artifacts/quantum_integration/importance_comparison_write_by_target_pass1_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_PATH="packages/web-backend/tests/quantumReadiness.importanceComparison.writeByTarget.http.spec.ts"

python3 <<'PY'
from pathlib import Path
import sys

service_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts")
controller_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts")

service = service_path.read_text(encoding="utf-8")
controller = controller_path.read_text(encoding="utf-8")

service_interface_block = """
export interface QuantumImportanceComparisonWriteByTargetRequest
  extends QuantumImportanceComparisonRequest {
  rootDir: string;
}

export interface QuantumImportanceComparisonWriteByTargetResult {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonPath: string;
}

"""

service_method_block = """
  compareImportanceMeasuresToLatestWorkflowRunByTarget(
    request: QuantumImportanceComparisonWriteByTargetRequest
  ): QuantumImportanceComparisonWriteByTargetResult {
    const latest = this.getLatestWorkflowRunByTarget(
      request.rootDir,
      request.modelId,
      request.subtreeId
    );

    if (!latest.latest) {
      throw new Error(
        `No workflow run found for modelId ${request.modelId} and subtreeId ${request.subtreeId}.`
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

"""

controller_import_anchor_old = """  type QuantumImportanceComparisonRequest,
  type QuantumImportanceComparisonResult,
  type QuantumImportanceComparisonWriteResult,"""

controller_import_anchor_new = """  type QuantumImportanceComparisonRequest,
  type QuantumImportanceComparisonResult,
  type QuantumImportanceComparisonWriteByTargetRequest,
  type QuantumImportanceComparisonWriteByTargetResult,
  type QuantumImportanceComparisonWriteResult,"""

controller_interface_block = """
export interface QuantumImportanceComparisonWriteByTargetRequestBody
  extends QuantumImportanceComparisonWriteByTargetRequest {}

"""

controller_endpoint_block = """
  @Post("/importance/compare/write/by-target")
  @HttpCode(HttpStatus.OK)
  compareImportanceMeasuresToLatestWorkflowRunByTarget(
    @Body() body: QuantumImportanceComparisonWriteByTargetRequestBody
  ): QuantumImportanceComparisonWriteByTargetResult {
    try {
      return this.quantumReadinessService.compareImportanceMeasuresToLatestWorkflowRunByTarget(
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

if "export interface QuantumImportanceComparisonWriteByTargetRequest" not in service:
    service = insert_before_first(
        service,
        "\n@Injectable()\nexport class QuantumReadinessService {",
        "\n" + service_interface_block,
        "ERROR: Could not find service by-target interface insertion anchor."
    )

if "compareImportanceMeasuresToLatestWorkflowRunByTarget(" not in service:
    service = insert_before_first(
        service,
        "\n  compareImportanceMeasuresToFilesystem(\n",
        "\n" + service_method_block,
        "ERROR: Could not find service by-target method insertion anchor."
    )

if "type QuantumImportanceComparisonWriteByTargetRequest," not in controller:
    if controller_import_anchor_old not in controller:
        sys.exit("ERROR: Could not find controller by-target import insertion anchor.")
    controller = controller.replace(
        controller_import_anchor_old,
        controller_import_anchor_new,
        1
    )

if "export interface QuantumImportanceComparisonWriteByTargetRequestBody" not in controller:
    controller = insert_before_first(
        controller,
        "\n@Controller()\nexport class QuantumReadinessController {",
        "\n" + controller_interface_block,
        "ERROR: Could not find controller by-target interface insertion anchor."
    )

if '@Post("/importance/compare/write/by-target")' not in controller:
    controller = insert_before_first(
        controller,
        '\n  @Post("/importance/compare/write")\n',
        "\n" + controller_endpoint_block,
        'ERROR: Could not find controller by-target endpoint insertion anchor.'
    )

old_guard = """      message.startsWith("No fault tree graph found for faultTreeId") ||
      message.startsWith("workflowRunDir does not exist") ||
      message.startsWith("rootDir does not exist")"""

new_guard = """      message.startsWith("No fault tree graph found for faultTreeId") ||
      message.startsWith("workflowRunDir does not exist") ||
      message.startsWith("rootDir does not exist") ||
      message.startsWith("No workflow run found for modelId")"""

if 'message.startsWith("No workflow run found for modelId")' not in controller:
    if old_guard not in controller:
        sys.exit("ERROR: Could not find controller by-target error guard anchor.")
    controller = controller.replace(old_guard, new_guard, 1)

service_path.write_text(service, encoding="utf-8")
controller_path.write_text(controller, encoding="utf-8")
PY

cat > "${HTTP_SPEC_PATH}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonWriteByTargetHttpResponse {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP importance comparison write by target", () => {
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

  it("POST /api/quantum-readiness/importance/compare/write/by-target writes into the latest matching workflow run", async () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-importance-write-target-root-")
    );

    const runOld = path.join(rootDir, "openpra_quantum_target_old");
    const runNew = path.join(rootDir, "openpra_quantum_target_new");
    const runOther = path.join(rootDir, "openpra_quantum_other");

    fs.mkdirSync(runOld, { recursive: true });
    fs.mkdirSync(runNew, { recursive: true });
    fs.mkdirSync(runOther, { recursive: true });

    writeJson(path.join(runOld, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-15T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP"
    });

    writeJson(path.join(runNew, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP"
    });

    writeJson(path.join(runOther, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-17T10:00:00.000Z",
      modelId: "other_model",
      subtreeId: "OTHER"
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare/write/by-target")
      .send({
        rootDir,
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
        measureName: "birnbaum",
        quantumValues: {
          A: 0.2,
          B: 0.1
        },
        classicalValues: {
          A: 0.25,
          B: 0.05
        }
      })
      .expect(200);

    const body = response.body as ImportanceComparisonWriteByTargetHttpResponse;

    expect(body.workflowRunDir).toBe(runNew);
    expect(body.outputDir).toBe(path.join(runNew, "artifacts", "recovery"));
    expect(body.importanceComparisonPath).toBe(
      path.join(
        runNew,
        "artifacts",
        "recovery",
        "openpra_quantum_importance_comparison_v1.json"
      )
    );
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
