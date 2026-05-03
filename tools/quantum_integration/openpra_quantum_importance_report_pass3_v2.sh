#!/usr/bin/env bash
set -euo pipefail

SCRIPT_VERSION="2.0.0"
UTC_NOW="$(date -u +"%Y%m%d_%H%M%SZ")"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: This script must be run inside the OpenPRA git repository."
  exit 1
fi

cd "${REPO_ROOT}"

REPORT_DIR="artifacts/quantum_integration/importance_report_pass3_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

HTTP_SPEC_REPORT="packages/web-backend/tests/quantumReadiness.importanceComparison.report.http.spec.ts"

cat > "${HTTP_SPEC_REPORT}" <<'EOF'
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonReportHttpResponse {
  modelId: string;
  subtreeId: string;
  measureName: string;
  summary: {
    quantumCount: number;
    classicalCount: number;
    commonCount: number;
    missingInQuantumCount: number;
    missingInClassicalCount: number;
    exactWithinToleranceCount: number;
  };
  topDisagreements: Array<{
    basicEventId: string;
    absoluteDifference: number | null;
    status: string;
  }>;
  entries: Array<{
    basicEventId: string;
    quantumRank: number | null;
    classicalRank: number | null;
    rankDelta: number | null;
    status: string;
  }>;
}

describe("QuantumReadiness HTTP importance comparison report", () => {
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

  it("POST /api/quantum-readiness/importance/compare/report returns a sorted report with rank deltas", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare/report")
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
        }
      })
      .expect(200);

    const body = response.body as ImportanceComparisonReportHttpResponse;

    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.subtreeId).toBe("TOP");
    expect(body.measureName).toBe("birnbaum");

    expect(body.summary.quantumCount).toBe(3);
    expect(body.summary.classicalCount).toBe(3);
    expect(body.summary.commonCount).toBe(2);
    expect(body.summary.missingInQuantumCount).toBe(1);
    expect(body.summary.missingInClassicalCount).toBe(1);

    expect(body.topDisagreements.length).toBe(2);
    expect(
      body.topDisagreements.map((entry) => entry.basicEventId).sort()
    ).toEqual(["A", "B"]);

    for (const entry of body.topDisagreements) {
      expect(entry.status).toBe("common");
      expect(entry.absoluteDifference).not.toBeNull();
      expect(entry.absoluteDifference as number).toBeCloseTo(0.05, 12);
    }

    expect(body.entries.length).toBe(4);
    expect(body.entries.map((entry) => entry.basicEventId).sort()).toEqual([
      "A",
      "B",
      "C",
      "D"
    ]);
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
