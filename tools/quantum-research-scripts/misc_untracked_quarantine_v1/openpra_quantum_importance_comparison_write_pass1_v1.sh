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

REPORT_DIR="artifacts/quantum_integration/importance_comparison_write_pass1_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_PATH="packages/web-backend/tests/quantumReadiness.importanceComparison.write.http.spec.ts"

python3 <<'PY'
from pathlib import Path
import sys

service_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts")
controller_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts")

service = service_path.read_text(encoding="utf-8")
controller = controller_path.read_text(encoding="utf-8")

service_interface_block = """
export interface QuantumImportanceComparisonWriteResult {
  outputDir: string;
  importanceComparisonPath: string;
}

"""

service_method_block = """
  compareImportanceMeasuresToFilesystem(
    request: QuantumImportanceComparisonRequest,
    outputDir: string
  ): QuantumImportanceComparisonWriteResult {
    const result = this.compareImportanceMeasures(request);
    const resolvedOutputDir = path.resolve(outputDir);
    const importanceComparisonPath = path.join(
      resolvedOutputDir,
      "openpra_quantum_importance_comparison_v1.json"
    );

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(
      importanceComparisonPath,
      JSON.stringify(result, null, 2) + "\\n",
      "utf8"
    );

    return {
      outputDir: resolvedOutputDir,
      importanceComparisonPath
    };
  }

"""

controller_import_replace_old = """  type QuantumImportanceComparisonRequest,
  type QuantumImportanceComparisonResult,
  type QuantumLatestWorkflowRunByKindResult,"""

controller_import_replace_new = """  type QuantumImportanceComparisonRequest,
  type QuantumImportanceComparisonResult,
  type QuantumImportanceComparisonWriteResult,
  type QuantumLatestWorkflowRunByKindResult,"""

controller_interface_block = """
export interface QuantumImportanceComparisonWriteRequest
  extends QuantumImportanceComparisonRequest {
  outputDir: string;
}

"""

controller_endpoint_block = """
  @Post("/importance/compare/write")
  @HttpCode(HttpStatus.OK)
  compareImportanceMeasuresToFilesystem(
    @Body() body: QuantumImportanceComparisonWriteRequest
  ): QuantumImportanceComparisonWriteResult {
    try {
      return this.quantumReadinessService.compareImportanceMeasuresToFilesystem(
        {
          modelId: body.modelId,
          subtreeId: body.subtreeId,
          measureName: body.measureName,
          quantumValues: body.quantumValues,
          classicalValues: body.classicalValues,
          ...(body.tolerance !== undefined ? { tolerance: body.tolerance } : {})
        },
        body.outputDir
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

"""

if "export interface QuantumImportanceComparisonWriteResult {" not in service:
    anchor = "\n@Injectable()\nexport class QuantumReadinessService {"
    if anchor not in service:
        sys.exit("ERROR: Could not find service write interface insertion anchor.")
    service = service.replace(anchor, "\n" + service_interface_block + anchor, 1)

if "compareImportanceMeasuresToFilesystem(" not in service:
    anchor = "\n  analyzeFaultTreeGraph(\n"
    if anchor not in service:
        sys.exit("ERROR: Could not find service write method insertion anchor.")
    service = service.replace(anchor, "\n" + service_method_block + anchor, 1)

if "type QuantumImportanceComparisonWriteResult," not in controller:
    if controller_import_replace_old not in controller:
        sys.exit("ERROR: Could not find controller write import insertion anchor.")
    controller = controller.replace(
        controller_import_replace_old,
        controller_import_replace_new,
        1
    )

if "export interface QuantumImportanceComparisonWriteRequest" not in controller:
    anchor = "\nexport interface QuantumPreparationArtifactsWriteRequest\n"
    if anchor not in controller:
        sys.exit("ERROR: Could not find controller write interface insertion anchor.")
    controller = controller.replace(anchor, "\n" + controller_interface_block + anchor, 1)

if '@Post("/importance/compare/write")' not in controller:
    anchor = '\n  @Post("/importance/compare")\n'
    if anchor not in controller:
        sys.exit("ERROR: Could not find controller write endpoint insertion anchor.")
    controller = controller.replace(anchor, "\n" + controller_endpoint_block + anchor, 1)

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

interface ImportanceComparisonWriteHttpResponse {
  outputDir: string;
  importanceComparisonPath: string;
}

describe("QuantumReadiness HTTP importance comparison write", () => {
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

  it("POST /api/quantum-readiness/importance/compare/write writes an importance comparison artifact", async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-importance-compare-write-")
    );

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare/write")
      .send({
        outputDir,
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

    const body = response.body as ImportanceComparisonWriteHttpResponse;

    expect(body.outputDir).toBe(outputDir);
    expect(body.importanceComparisonPath).toBe(
      path.join(outputDir, "openpra_quantum_importance_comparison_v1.json")
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
