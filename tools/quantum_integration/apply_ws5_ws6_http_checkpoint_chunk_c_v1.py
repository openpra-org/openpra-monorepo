#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")


def write_text(rel: str, text: str) -> None:
    path = REPO_ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    importance_http_spec = """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.importanceBounded.http", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("writes bounded importance artifacts through the HTTP route", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-http-"));
    const generatedAtUtc = "2026-04-17T17:03:17.743Z";

    const expectedResponse = {
      subtreeId: "G:G348",
      topologyClass: "A",
      recoveryMode: "exact_hardware_recovery",
      operatorAttentionRequired: false,
      boundednessStatement: SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
      quantumImportance: [
        {
          basicEventId: "BE_A",
          fussellVesely: 0.5,
          riskAchievementWorth: 2.0,
          birnbaum: 0.1,
        },
      ],
      classicalBaseline: [
        {
          basicEventId: "BE_A",
          fussellVesely: 0.5,
          riskAchievementWorth: 2.0,
          birnbaum: 0.1,
        },
      ],
      comparisonStatistics: {
        sharedBasicEventCount: 1,
        fvCorrelation: 1,
        rawCorrelation: 1,
        birnbaumCorrelation: 1,
        fvMaxAbsoluteDeviation: 0,
        rawMaxAbsoluteDeviation: 0,
        birnbaumMaxAbsoluteDeviation: 0,
        disagreementCount: 0,
      },
      provenanceManifestPath: "/provenance/ws5/phase2b_row_0698__G_G348.json",
      sourceRecoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      generatedAtUtc,
      caseLabel: "phase2b_row_0698__G_G348",
    };

    const response = await request(app.getHttpServer())
      .post("/importance/bounded")
      .send({
        rootDirectoryPath: tempDir,
        subtreeId: expectedResponse.subtreeId,
        topologyClass: expectedResponse.topologyClass,
        recoveryMode: expectedResponse.recoveryMode,
        operatorAttentionRequired: expectedResponse.operatorAttentionRequired,
        quantumImportance: expectedResponse.quantumImportance,
        classicalBaseline: expectedResponse.classicalBaseline,
        comparisonStatistics: expectedResponse.comparisonStatistics,
        provenanceManifestPath: expectedResponse.provenanceManifestPath,
        sourceRecoveryArtifactPath: expectedResponse.sourceRecoveryArtifactPath,
        generatedAtUtc: expectedResponse.generatedAtUtc,
        caseLabel: expectedResponse.caseLabel,
        expectedResponse,
      })
      .expect(200);

    expect(response.body.stubResult.parityAgainstExpected.allChecksPass).toBe(true);
    expect(fs.existsSync(response.body.persistedArtifacts.responsePath)).toBe(true);
    expect(fs.existsSync(response.body.persistedArtifacts.provenanceManifestPath)).toBe(true);
  });

  it("returns 400 when bounded importance input is invalid", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-http-bad-"));
    const response = await request(app.getHttpServer())
      .post("/importance/bounded")
      .send({
        rootDirectoryPath: tempDir,
        subtreeId: "",
        topologyClass: "A",
        recoveryMode: "exact_hardware_recovery",
        operatorAttentionRequired: false,
        quantumImportance: [],
        classicalBaseline: [],
        comparisonStatistics: {
          sharedBasicEventCount: 0,
          fvCorrelation: null,
          rawCorrelation: null,
          birnbaumCorrelation: null,
          fvMaxAbsoluteDeviation: null,
          rawMaxAbsoluteDeviation: null,
          birnbaumMaxAbsoluteDeviation: null,
          disagreementCount: null,
        },
        provenanceManifestPath: "/provenance/ws5/invalid.json",
      })
      .expect(400);

    expect(String(response.body.message)).toContain("subtreeId");
  });
});
"""

    execution_http_spec = """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.executionRecordStub.http", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("writes execution record artifacts through the HTTP route", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-http-"));

    const response = await request(app.getHttpServer())
      .post("/execution/record-stub")
      .send({
        rootDirectoryPath: tempDir,
        executionRecord: {
          subtreeId: "G:G348",
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          jobId: "job-0698",
          shots: 8192,
          resilienceLevel: 0,
          status: "submitted",
          provenanceManifestPath: "/provenance/ws6/job-0698.json",
          submittedAtUtc: "2026-04-17T17:03:17.743Z",
          caseLabel: "phase2b_row_0698__G_G348",
        },
        executionResult: {
          jobId: "job-0698",
          status: "completed",
          rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
          recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
          provenanceManifestPath: "/provenance/ws6/job-0698.json",
          completedAtUtc: "2026-04-17T17:05:00.000Z",
          failureReason: null,
        },
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.executionRecordStub.http.spec",
      })
      .expect(200);

    expect(response.body.executionRecord.jobId).toBe("job-0698");
    expect(response.body.executionResult.status).toBe("completed");
    expect(fs.existsSync(response.body.persistedArtifacts.recordPath)).toBe(true);
    expect(fs.existsSync(response.body.persistedArtifacts.provenanceManifestPath)).toBe(true);
  });

  it("returns 400 when execution result jobId mismatches execution record jobId", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-http-bad-"));

    const response = await request(app.getHttpServer())
      .post("/execution/record-stub")
      .send({
        rootDirectoryPath: tempDir,
        executionRecord: {
          subtreeId: "G:G348",
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          jobId: "job-0698",
          shots: 8192,
          resilienceLevel: 0,
          status: "submitted",
          provenanceManifestPath: "/provenance/ws6/job-0698.json",
          submittedAtUtc: "2026-04-17T17:03:17.743Z",
          caseLabel: "phase2b_row_0698__G_G348",
        },
        executionResult: {
          jobId: "job-other",
          status: "completed",
          rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
          recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
          provenanceManifestPath: "/provenance/ws6/job-0698.json",
          completedAtUtc: "2026-04-17T17:05:00.000Z",
          failureReason: null,
        },
        inputArtifactPaths: [],
      })
      .expect(400);

    expect(String(response.body.message)).toContain("jobId");
  });
});
"""

    checkpoint_script = """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_ws5_ws6_backend_http_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_WS5_WS6_BACKEND_HTTP_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{tests,notes}

cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.importanceBounded.http.spec.ts" "$RUN_DIR/tests/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.executionRecordStub.http.spec.ts" "$RUN_DIR/tests/"

COMMIT_HASH="$(git -C "$REPO_ROOT" rev-parse HEAD)"
BRANCH_NAME="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"

python3 - <<'PY' "$RUN_DIR" "$COMMIT_HASH" "$BRANCH_NAME"
from pathlib import Path
import json
import sys
from datetime import datetime, timezone

run_dir = Path(sys.argv[1])
commit_hash = sys.argv[2]
branch_name = sys.argv[3]

summary = {
    "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
    "checkpointName": "OPENPRA_QUANTUM_WS5_WS6_BACKEND_HTTP_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/importance/bounded",
        "/execution/record-stub",
    ],
    "testFiles": [
        "packages/web-backend/tests/quantumReadiness.importanceBounded.http.spec.ts",
        "packages/web-backend/tests/quantumReadiness.executionRecordStub.http.spec.ts",
    ],
    "interpretation": (
        "Chunk C adds route-level coverage for the new WS5 bounded importance "
        "and WS6 execution record stub surfaces."
    ),
}

(run_dir / "notes" / "openpra_quantum_ws5_ws6_backend_http_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum WS5 WS6 Backend HTTP Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /importance/bounded
- /execution/record-stub

Test files
- packages/web-backend/tests/quantumReadiness.importanceBounded.http.spec.ts
- packages/web-backend/tests/quantumReadiness.executionRecordStub.http.spec.ts

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_WS5_WS6_BACKEND_HTTP_CHECKPOINT_MEMO_v1.txt").write_text(
    memo,
    encoding="utf-8",
)
PY

tar -C "$OUT_ROOT" -czf "$TAR_PATH" "$(basename "$RUN_DIR")"
sha256sum "$TAR_PATH" > "$SHA_PATH"

echo "$RUN_DIR"
echo "$TAR_PATH"
echo "$SHA_PATH"
"""

    write_text(
        "packages/web-backend/tests/quantumReadiness.importanceBounded.http.spec.ts",
        importance_http_spec,
    )
    write_text(
        "packages/web-backend/tests/quantumReadiness.executionRecordStub.http.spec.ts",
        execution_http_spec,
    )
    write_text(
        "tools/quantum_integration/openpra_quantum_build_ws5_ws6_backend_http_checkpoint_v1.sh",
        checkpoint_script,
    )

    print("Applied WS5/WS6 HTTP checkpoint chunk C successfully.")


if __name__ == "__main__":
    main()
