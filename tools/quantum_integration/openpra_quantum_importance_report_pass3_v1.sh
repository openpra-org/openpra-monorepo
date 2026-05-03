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

REPORT_DIR="artifacts/quantum_integration/importance_report_pass3_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_REPORT="packages/web-backend/tests/quantumReadiness.importanceComparison.report.http.spec.ts"
HTTP_SPEC_REPORT_WRITE="packages/web-backend/tests/quantumReadiness.importanceComparison.report.write.http.spec.ts"

python3 <<'PY'
from pathlib import Path
import sys

service_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts")
controller_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts")

service = service_path.read_text(encoding="utf-8")
controller = controller_path.read_text(encoding="utf-8")

service_interface_block = """
export interface QuantumImportanceComparisonReportEntry {
  basicEventId: string;
  quantumValue: number | null;
  classicalValue: number | null;
  absoluteDifference: number | null;
  quantumRank: number | null;
  classicalRank: number | null;
  rankDelta: number | null;
  status: "common" | "missing_in_quantum" | "missing_in_classical";
}

export interface QuantumImportanceComparisonReportResult {
  modelId: string;
  subtreeId: string;
  measureName: string;
  tolerance: number;
  summary: {
    quantumCount: number;
    classicalCount: number;
    commonCount: number;
    missingInQuantumCount: number;
    missingInClassicalCount: number;
    exactWithinToleranceCount: number;
  };
  stats: {
    meanAbsoluteDifference: number | null;
    maxAbsoluteDifference: number | null;
    spearmanRho: number | null;
  };
  topDisagreements: QuantumImportanceComparisonReportEntry[];
  entries: QuantumImportanceComparisonReportEntry[];
}

export interface QuantumImportanceComparisonReportWriteResult {
  outputDir: string;
  importanceComparisonReportPath: string;
}

"""

service_method_block = """
  buildImportanceComparisonReport(
    request: QuantumImportanceComparisonRequest
  ): QuantumImportanceComparisonReportResult {
    const comparison = this.compareImportanceMeasures(request);

    const quantumIds = Object.keys(request.quantumValues).sort();
    const classicalIds = Object.keys(request.classicalValues).sort();
    const allIds = [...new Set([...quantumIds, ...classicalIds])].sort();

    const quantumRanks = rankDescending(
      quantumIds.map((basicEventId) => request.quantumValues[basicEventId])
    );
    const classicalRanks = rankDescending(
      classicalIds.map((basicEventId) => request.classicalValues[basicEventId])
    );

    const quantumRankMap = new Map<string, number>(
      quantumIds.map((basicEventId, index) => [basicEventId, quantumRanks[index]])
    );
    const classicalRankMap = new Map<string, number>(
      classicalIds.map((basicEventId, index) => [basicEventId, classicalRanks[index]])
    );

    const entries = allIds
      .map((basicEventId) => {
        const quantumPresent = Object.prototype.hasOwnProperty.call(
          request.quantumValues,
          basicEventId
        );
        const classicalPresent = Object.prototype.hasOwnProperty.call(
          request.classicalValues,
          basicEventId
        );

        const quantumValue = quantumPresent
          ? request.quantumValues[basicEventId]
          : null;
        const classicalValue = classicalPresent
          ? request.classicalValues[basicEventId]
          : null;

        const absoluteDifference =
          quantumPresent && classicalPresent
            ? Math.abs(
                request.quantumValues[basicEventId] -
                  request.classicalValues[basicEventId]
              )
            : null;

        const quantumRank = quantumPresent
          ? (quantumRankMap.get(basicEventId) ?? null)
          : null;
        const classicalRank = classicalPresent
          ? (classicalRankMap.get(basicEventId) ?? null)
          : null;

        return {
          basicEventId,
          quantumValue,
          classicalValue,
          absoluteDifference,
          quantumRank,
          classicalRank,
          rankDelta:
            quantumRank !== null && classicalRank !== null
              ? quantumRank - classicalRank
              : null,
          status: quantumPresent && classicalPresent
            ? "common"
            : quantumPresent
              ? "missing_in_classical"
              : "missing_in_quantum"
        } as QuantumImportanceComparisonReportEntry;
      })
      .sort((left, right) => {
        const leftDiff = left.absoluteDifference ?? -1;
        const rightDiff = right.absoluteDifference ?? -1;

        if (rightDiff !== leftDiff) {
          return rightDiff - leftDiff;
        }

        return left.basicEventId.localeCompare(right.basicEventId);
      });

    return {
      modelId: request.modelId,
      subtreeId: request.subtreeId,
      measureName: request.measureName,
      tolerance: comparison.tolerance,
      summary: {
        quantumCount: comparison.counts.quantumCount,
        classicalCount: comparison.counts.classicalCount,
        commonCount: comparison.counts.commonCount,
        missingInQuantumCount: comparison.missingInQuantum.length,
        missingInClassicalCount: comparison.missingInClassical.length,
        exactWithinToleranceCount: comparison.counts.exactWithinToleranceCount
      },
      stats: comparison.stats,
      topDisagreements: entries.filter((entry) => entry.status === "common").slice(0, 10),
      entries
    };
  }

  buildImportanceComparisonReportToFilesystem(
    request: QuantumImportanceComparisonRequest,
    outputDir: string
  ): QuantumImportanceComparisonReportWriteResult {
    const result = this.buildImportanceComparisonReport(request);
    const resolvedOutputDir = path.resolve(outputDir);
    const importanceComparisonReportPath = path.join(
      resolvedOutputDir,
      "openpra_quantum_importance_comparison_report_v1.json"
    );

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(
      importanceComparisonReportPath,
      JSON.stringify(result, null, 2) + "\\n",
      "utf8"
    );

    return {
      outputDir: resolvedOutputDir,
      importanceComparisonReportPath
    };
  }

"""

controller_import_old = """  type QuantumImportanceComparisonRequest,
  type QuantumImportanceComparisonResult,
  type QuantumImportanceComparisonWriteByKindRequest,"""

controller_import_new = """  type QuantumImportanceComparisonReportResult,
  type QuantumImportanceComparisonReportWriteResult,
  type QuantumImportanceComparisonRequest,
  type QuantumImportanceComparisonResult,
  type QuantumImportanceComparisonWriteByKindRequest,"""

controller_interface_block = """
export interface QuantumImportanceComparisonReportWriteRequest
  extends QuantumImportanceComparisonRequest {
  outputDir: string;
}

"""

controller_endpoint_block = """
  @Post("/importance/compare/report")
  @HttpCode(HttpStatus.OK)
  buildImportanceComparisonReport(
    @Body() body: QuantumImportanceComparisonRequest
  ): QuantumImportanceComparisonReportResult {
    try {
      return this.quantumReadinessService.buildImportanceComparisonReport(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/compare/report/write")
  @HttpCode(HttpStatus.OK)
  buildImportanceComparisonReportToFilesystem(
    @Body() body: QuantumImportanceComparisonReportWriteRequest
  ): QuantumImportanceComparisonReportWriteResult {
    try {
      return this.quantumReadinessService.buildImportanceComparisonReportToFilesystem(
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

def insert_before_first(text: str, anchor: str, block: str, err: str) -> str:
    if anchor not in text:
        sys.exit(err)
    return text.replace(anchor, block + anchor, 1)

if "export interface QuantumImportanceComparisonReportEntry" not in service:
    service = insert_before_first(
        service,
        "\n@Injectable()\nexport class QuantumReadinessService {",
        "\n" + service_interface_block,
        "ERROR: Could not find service report interface insertion anchor."
    )

if "buildImportanceComparisonReport(" not in service:
    service = insert_before_first(
        service,
        "\n  compareImportanceMeasuresToFilesystem(\n",
        "\n" + service_method_block,
        "ERROR: Could not find service report method insertion anchor."
    )

if "type QuantumImportanceComparisonReportResult," not in controller:
    if controller_import_old not in controller:
        sys.exit("ERROR: Could not find controller report import insertion anchor.")
    controller = controller.replace(controller_import_old, controller_import_new, 1)

if "export interface QuantumImportanceComparisonReportWriteRequest" not in controller:
    controller = insert_before_first(
        controller,
        "\n@Controller()\nexport class QuantumReadinessController {",
        "\n" + controller_interface_block,
        "ERROR: Could not find controller report interface insertion anchor."
    )

if '@Post("/importance/compare/report")' not in controller:
    controller = insert_before_first(
        controller,
        '\n  @Post("/importance/compare")\n',
        "\n" + controller_endpoint_block,
        "ERROR: Could not find controller report endpoint insertion anchor."
    )

service_path.write_text(service, encoding="utf-8")
controller_path.write_text(controller, encoding="utf-8")
PY

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
    expect(body.topDisagreements[0].basicEventId).toBe("A");
    expect(body.entries.length).toBe(4);
  });
});
EOF

cat > "${HTTP_SPEC_REPORT_WRITE}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonReportWriteHttpResponse {
  outputDir: string;
  importanceComparisonReportPath: string;
}

describe("QuantumReadiness HTTP importance comparison report write", () => {
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

  it("POST /api/quantum-readiness/importance/compare/report/write writes a report artifact", async () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-importance-report-write-")
    );

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare/report/write")
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

    const body = response.body as ImportanceComparisonReportWriteHttpResponse;

    expect(body.outputDir).toBe(outputDir);
    expect(body.importanceComparisonReportPath).toBe(
      path.join(outputDir, "openpra_quantum_importance_comparison_report_v1.json")
    );
    expect(fs.existsSync(body.importanceComparisonReportPath)).toBe(true);
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
