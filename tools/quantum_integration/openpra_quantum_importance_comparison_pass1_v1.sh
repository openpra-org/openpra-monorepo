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

REPORT_DIR="artifacts/quantum_integration/importance_comparison_pass1_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_PATH="packages/web-backend/tests/quantumReadiness.importanceComparison.http.spec.ts"

python3 <<'PY'
from pathlib import Path
import sys

service_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts")
controller_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts")

service = service_path.read_text(encoding="utf-8")
controller = controller_path.read_text(encoding="utf-8")

service_interface_block = """
export interface QuantumImportanceComparisonRequest {
  modelId: string;
  subtreeId: string;
  measureName: string;
  quantumValues: Record<string, number>;
  classicalValues: Record<string, number>;
  tolerance?: number;
}

export interface QuantumImportanceComparisonResult {
  modelId: string;
  subtreeId: string;
  measureName: string;
  tolerance: number;
  counts: {
    quantumCount: number;
    classicalCount: number;
    commonCount: number;
    exactWithinToleranceCount: number;
  };
  missingInQuantum: string[];
  missingInClassical: string[];
  stats: {
    meanAbsoluteDifference: number | null;
    maxAbsoluteDifference: number | null;
    spearmanRho: number | null;
  };
}

"""

service_method_block = """
  compareImportanceMeasures(
    request: QuantumImportanceComparisonRequest
  ): QuantumImportanceComparisonResult {
    const tolerance = request.tolerance ?? 1e-9;

    assertNumericRecord("quantumValues", request.quantumValues);
    assertNumericRecord("classicalValues", request.classicalValues);

    const quantumIds = Object.keys(request.quantumValues).sort();
    const classicalIds = Object.keys(request.classicalValues).sort();

    const quantumSet = new Set(quantumIds);
    const classicalSet = new Set(classicalIds);

    const commonIds = quantumIds.filter((basicEventId) =>
      classicalSet.has(basicEventId)
    );
    const missingInQuantum = classicalIds.filter(
      (basicEventId) => !quantumSet.has(basicEventId)
    );
    const missingInClassical = quantumIds.filter(
      (basicEventId) => !classicalSet.has(basicEventId)
    );

    const differences = commonIds.map((basicEventId) =>
      Math.abs(
        request.quantumValues[basicEventId] -
          request.classicalValues[basicEventId]
      )
    );

    const quantumCommonValues = commonIds.map(
      (basicEventId) => request.quantumValues[basicEventId]
    );
    const classicalCommonValues = commonIds.map(
      (basicEventId) => request.classicalValues[basicEventId]
    );

    return {
      modelId: request.modelId,
      subtreeId: request.subtreeId,
      measureName: request.measureName,
      tolerance,
      counts: {
        quantumCount: quantumIds.length,
        classicalCount: classicalIds.length,
        commonCount: commonIds.length,
        exactWithinToleranceCount: differences.filter(
          (difference) => difference <= tolerance
        ).length
      },
      missingInQuantum,
      missingInClassical,
      stats: {
        meanAbsoluteDifference:
          differences.length > 0
            ? differences.reduce((sum, value) => sum + value, 0) /
              differences.length
            : null,
        maxAbsoluteDifference:
          differences.length > 0 ? Math.max(...differences) : null,
        spearmanRho: computeSpearmanRho(
          quantumCommonValues,
          classicalCommonValues
        )
      }
    };
  }

"""

service_helper_block = """
function assertNumericRecord(
  name: string,
  values: Record<string, number>
): void {
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) {
      throw new Error(`${name} contains a non-finite value for key ${key}.`);
    }
  }
}

function computeSpearmanRho(
  left: number[],
  right: number[]
): number | null {
  if (left.length !== right.length) {
    throw new Error("Spearman inputs must have equal length.");
  }

  if (left.length < 2) {
    return null;
  }

  const leftRanks = rankDescending(left);
  const rightRanks = rankDescending(right);

  const leftMean =
    leftRanks.reduce((sum, value) => sum + value, 0) / leftRanks.length;
  const rightMean =
    rightRanks.reduce((sum, value) => sum + value, 0) / rightRanks.length;

  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < leftRanks.length; index += 1) {
    const leftCentered = leftRanks[index] - leftMean;
    const rightCentered = rightRanks[index] - rightMean;
    numerator += leftCentered * rightCentered;
    leftVariance += leftCentered * leftCentered;
    rightVariance += rightCentered * rightCentered;
  }

  const denominator = Math.sqrt(leftVariance * rightVariance);

  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function rankDescending(values: number[]): number[] {
  const uniqueDescending = [...new Set(values)].sort((a, b) => b - a);
  const rankByValue = new Map<number, number>();

  uniqueDescending.forEach((value, index) => {
    rankByValue.set(value, index + 1);
  });

  return values.map((value) => {
    const rank = rankByValue.get(value);

    if (rank === undefined) {
      throw new Error("Unable to compute rank.");
    }

    return rank;
  });
}

"""

controller_import_replace_old = """  type QuantumLatestWorkflowRunByKindResult,
  type QuantumLatestWorkflowRunByTargetResult,
  type QuantumLatestWorkflowRunResult,"""

controller_import_replace_new = """  type QuantumImportanceComparisonRequest,
  type QuantumImportanceComparisonResult,
  type QuantumLatestWorkflowRunByKindResult,
  type QuantumLatestWorkflowRunByTargetResult,
  type QuantumLatestWorkflowRunResult,"""

controller_endpoint_block = """
  @Post("/importance/compare")
  @HttpCode(HttpStatus.OK)
  compareImportanceMeasures(
    @Body() body: QuantumImportanceComparisonRequest
  ): QuantumImportanceComparisonResult {
    try {
      return this.quantumReadinessService.compareImportanceMeasures(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

"""

if "export interface QuantumImportanceComparisonRequest {" not in service:
    anchor = "\n@Injectable()\nexport class QuantumReadinessService {"
    if anchor not in service:
        sys.exit("ERROR: Could not find service interface insertion anchor.")
    service = service.replace(anchor, "\n" + service_interface_block + anchor, 1)

if "compareImportanceMeasures(" not in service:
    anchor = "\n  analyzeFaultTreeGraph(\n"
    if anchor not in service:
        sys.exit("ERROR: Could not find service method insertion anchor.")
    service = service.replace(anchor, "\n" + service_method_block + anchor, 1)

if "function computeSpearmanRho(" not in service:
    anchor = "\nfunction analyzeGraphLikeInputToReadiness(\n"
    if anchor not in service:
        sys.exit("ERROR: Could not find service helper insertion anchor.")
    service = service.replace(anchor, "\n" + service_helper_block + anchor, 1)

if "type QuantumImportanceComparisonRequest," not in controller:
    if controller_import_replace_old not in controller:
        sys.exit("ERROR: Could not find controller import insertion anchor.")
    controller = controller.replace(
        controller_import_replace_old,
        controller_import_replace_new,
        1
    )

if '@Post("/importance/compare")' not in controller:
    anchor = '\n  @Post("/workflow/preparation-run")\n'
    if anchor not in controller:
        sys.exit("ERROR: Could not find controller endpoint insertion anchor.")
    controller = controller.replace(anchor, "\n" + controller_endpoint_block + anchor, 1)

service_path.write_text(service, encoding="utf-8")
controller_path.write_text(controller, encoding="utf-8")
PY

cat > "${HTTP_SPEC_PATH}" <<'EOF'
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonHttpResponse {
  modelId: string;
  subtreeId: string;
  measureName: string;
  tolerance: number;
  counts: {
    quantumCount: number;
    classicalCount: number;
    commonCount: number;
    exactWithinToleranceCount: number;
  };
  missingInQuantum: string[];
  missingInClassical: string[];
  stats: {
    meanAbsoluteDifference: number | null;
    maxAbsoluteDifference: number | null;
    spearmanRho: number | null;
  };
}

describe("QuantumReadiness HTTP importance comparison", () => {
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

  it("POST /api/quantum-readiness/importance/compare returns agreement metrics against a classical baseline", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare")
      .send({
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
        measureName: "birnbaum",
        quantumValues: {
          A: 0.2,
          B: 0.1,
          C: 0.4
        },
        classicalValues: {
          A: 0.25,
          B: 0.05,
          D: 0.3
        },
        tolerance: 1e-12
      })
      .expect(200);

    const body = response.body as ImportanceComparisonHttpResponse;

    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.subtreeId).toBe("TOP");
    expect(body.measureName).toBe("birnbaum");
    expect(body.counts.quantumCount).toBe(3);
    expect(body.counts.classicalCount).toBe(3);
    expect(body.counts.commonCount).toBe(2);
    expect(body.counts.exactWithinToleranceCount).toBe(0);
    expect(body.missingInQuantum).toEqual(["D"]);
    expect(body.missingInClassical).toEqual(["C"]);
    expect(body.stats.meanAbsoluteDifference).toBeCloseTo(0.05, 12);
    expect(body.stats.maxAbsoluteDifference).toBeCloseTo(0.05, 12);
    expect(body.stats.spearmanRho).toBeCloseTo(1, 12);
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
