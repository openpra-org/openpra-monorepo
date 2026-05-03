#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")


def read_text(rel: str) -> str:
    return (REPO_ROOT / rel).read_text(encoding="utf-8")


def write_text(rel: str, text: str) -> None:
    path = REPO_ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def insert_after(text: str, marker: str, block: str, label: str) -> str:
    if marker not in text:
        raise RuntimeError(f"Could not find marker for {label}.")
    return text.replace(marker, marker + block, 1)


def insert_before(text: str, marker: str, block: str, label: str) -> str:
    if marker not in text:
        raise RuntimeError(f"Could not find marker for {label}.")
    return text.replace(marker, block + marker, 1)


def main() -> None:
    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-provider-bridge-completion.ts",
        """import * as path from "node:path";

import {
  loadLatestOpenPraQuantumExecutionArtifacts,
  type OpenPraQuantumExecutionArtifactLoadResult,
} from "./openpra-quantum-execution-artifact-loader";
import {
  buildOpenPraQuantumExecutionRecordServiceStub,
  type OpenPraQuantumExecutionRecordServiceStubResult,
} from "./openpra-quantum-execution-record-service-stub";

export interface OpenPraQuantumProviderBridgeCompletionRequest {
  executionArtifactsRootDirectoryPath: string;
  caseLabel: string;
  rawCountsArtifactPath?: string | null;
  recoveryArtifactPath?: string | null;
  completedAtUtc?: string;
  failureReason?: string | null;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export interface OpenPraQuantumProviderBridgeCompletionResult {
  loadedExecutionArtifacts: OpenPraQuantumExecutionArtifactLoadResult;
  completedExecutionSubmission: OpenPraQuantumExecutionRecordServiceStubResult;
}

export function completeOpenPraQuantumProviderBridgeSubmission(
  request: OpenPraQuantumProviderBridgeCompletionRequest,
): OpenPraQuantumProviderBridgeCompletionResult {
  const loadedExecutionArtifacts = loadLatestOpenPraQuantumExecutionArtifacts({
    rootDirectoryPath: request.executionArtifactsRootDirectoryPath,
    caseLabel: request.caseLabel,
  });

  const executionRecord = loadedExecutionArtifacts.executionRecord;
  const isFailure = Boolean(request.failureReason);

  const completedExecutionSubmission = buildOpenPraQuantumExecutionRecordServiceStub({
    rootDirectoryPath: path.join(
      request.executionArtifactsRootDirectoryPath,
      executionRecord.caseLabel ?? request.caseLabel,
    ),
    executionRecord: {
      subtreeId: executionRecord.subtreeId,
      providerName: executionRecord.providerName,
      backendName: executionRecord.backendName,
      jobId: executionRecord.jobId,
      shots: executionRecord.shots,
      resilienceLevel: executionRecord.resilienceLevel,
      status: isFailure ? "failed" : "completed",
      provenanceManifestPath:
        loadedExecutionArtifacts.provenanceManifestPath ??
        executionRecord.provenanceManifestPath,
      submittedAtUtc: executionRecord.submittedAtUtc,
      caseLabel: executionRecord.caseLabel,
    },
    executionResult: {
      jobId: executionRecord.jobId,
      status: isFailure ? "failed" : "completed",
      rawCountsArtifactPath: isFailure
        ? null
        : request.rawCountsArtifactPath ??
          `/raw-counts/${executionRecord.caseLabel ?? request.caseLabel}.json`,
      recoveryArtifactPath: isFailure
        ? null
        : request.recoveryArtifactPath ??
          `/recovery/${executionRecord.caseLabel ?? request.caseLabel}.json`,
      provenanceManifestPath:
        loadedExecutionArtifacts.provenanceManifestPath ??
        executionRecord.provenanceManifestPath,
      completedAtUtc: request.completedAtUtc ?? new Date().toISOString(),
      failureReason: request.failureReason ?? null,
    },
    inputArtifactPaths: [
      loadedExecutionArtifacts.executionRecordPath,
      ...(loadedExecutionArtifacts.executionResultPath
        ? [loadedExecutionArtifacts.executionResultPath]
        : []),
      ...(loadedExecutionArtifacts.provenanceManifestPath
        ? [loadedExecutionArtifacts.provenanceManifestPath]
        : []),
      ...(request.inputArtifactPaths ?? []),
    ],
    scriptVersion:
      request.scriptVersion ?? "openpra-quantum-provider-bridge-completion-v1",
  });

  return {
    loadedExecutionArtifacts,
    completedExecutionSubmission,
  };
}
""",
    )

    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-provider-bridge-completion.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-contract";
import { persistOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-store";
import { submitOpenPraQuantumProviderBridgeRequest } from "./openpra-quantum-provider-bridge-scaffold";
import { completeOpenPraQuantumProviderBridgeSubmission } from "./openpra-quantum-provider-bridge-completion";
import { loadLatestOpenPraQuantumExecutionArtifacts } from "./openpra-quantum-execution-artifact-loader";

describe("openpra-quantum-provider-bridge-completion", () => {
  it("completes a submitted provider bridge execution into completed execution artifacts", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-complete-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");

    const providerRequest = createOpenPraQuantumProviderExecutionRequest({
      requestId: "provider-request-0698",
      subtreeId: "G:G348",
      caseLabel: "phase2b_row_0698__G_G348",
      providerName: "ibm_runtime",
      backendName: "ibm_torino",
      shots: 8192,
      resilienceLevel: 0,
      createdAtUtc: "2026-04-17T17:03:17.743Z",
      notes: "WS6 exact path request",
    });

    persistOpenPraQuantumProviderExecutionRequest({
      rootDirectoryPath: providerRequestRoot,
      request: providerRequest,
      inputArtifactPaths: [],
      scriptVersion: "openpra-quantum-provider-bridge-completion.spec",
    });

    submitOpenPraQuantumProviderBridgeRequest({
      providerRequestRootDirectoryPath: providerRequestRoot,
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      scriptVersion: "openpra-quantum-provider-bridge-completion.spec",
    });

    const completed = completeOpenPraQuantumProviderBridgeSubmission({
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
      recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      completedAtUtc: "2026-04-17T17:05:00.000Z",
      failureReason: null,
      scriptVersion: "openpra-quantum-provider-bridge-completion.spec",
    });

    expect(completed.completedExecutionSubmission.executionRecord.status).toBe("completed");
    expect(completed.completedExecutionSubmission.executionResult?.status).toBe("completed");
    expect(fs.existsSync(completed.completedExecutionSubmission.persistedArtifacts.recordPath)).toBe(true);
    expect(fs.existsSync(completed.completedExecutionSubmission.persistedArtifacts.resultPath ?? "")).toBe(true);

    const loadedExecution = loadLatestOpenPraQuantumExecutionArtifacts({
      rootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loadedExecution.executionRecord.status).toBe("completed");
    expect(loadedExecution.executionResult?.rawCountsArtifactPath).toBe(
      "/raw-counts/phase2b_row_0698__G_G348.json",
    );
  });
});
""",
    )

    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-provider-bridge-scaffold";\n',
        'export * from "./openpra-quantum-provider-bridge-completion";\n',
        "index chunk h export",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  submitOpenPraQuantumProviderBridgeRequest,\n",
        "  completeOpenPraQuantumProviderBridgeSubmission,\n",
        "service chunk h import function",
    )
    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumProviderBridgeSubmissionResult,\n",
        "  type OpenPraQuantumProviderBridgeCompletionRequest,\n  type OpenPraQuantumProviderBridgeCompletionResult,\n",
        "service chunk h import types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export type QuantumProviderBridgeCompletionServiceRequest =
  OpenPraQuantumProviderBridgeCompletionRequest;

""",
        "service chunk h request alias",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  completeProviderBridgeSubmission(
    request: QuantumProviderBridgeCompletionServiceRequest,
  ): OpenPraQuantumProviderBridgeCompletionResult {
    return completeOpenPraQuantumProviderBridgeSubmission(request);
  }

""",
        "service chunk h method",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumProviderBridgeSubmissionResult,\n",
        "  OpenPraQuantumProviderBridgeCompletionResult,\n",
        "controller chunk h import result type",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumProviderBridgeSubmissionServiceRequest,\n",
        "  type QuantumProviderBridgeCompletionServiceRequest,\n",
        "controller chunk h service type",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumProviderBridgeCompletionRequestBody
  extends QuantumProviderBridgeCompletionServiceRequest {}

""",
        "controller chunk h request body",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/execution/provider-bridge/complete")
  @HttpCode(HttpStatus.OK)
  completeProviderBridgeSubmission(
    @Body() body: QuantumProviderBridgeCompletionRequestBody,
  ): OpenPraQuantumProviderBridgeCompletionResult {
    try {
      return this.quantumReadinessService.completeProviderBridgeSubmission(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk h method",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.providerBridgeCompletion.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService provider bridge completion", () => {
  let service: QuantumReadinessService;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(() => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    service = new QuantumReadinessService(
      graphModelServiceMock as unknown as GraphModelService,
    );
  });

  it("completes a submitted provider request into completed execution artifacts", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-completion-service-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");

    service.buildProviderExecutionRequest({
      rootDirectoryPath: providerRequestRoot,
      executionRequest: {
        requestId: "provider-request-0698",
        subtreeId: "G:G348",
        caseLabel: "phase2b_row_0698__G_G348",
        providerName: "ibm_runtime",
        backendName: "ibm_torino",
        shots: 8192,
        resilienceLevel: 0,
        createdAtUtc: "2026-04-17T17:03:17.743Z",
        notes: "WS6 exact path request",
      },
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.providerBridgeCompletion.service.spec",
    });

    service.submitProviderBridgeRequest({
      providerRequestRootDirectoryPath: providerRequestRoot,
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      scriptVersion: "quantumReadiness.providerBridgeCompletion.service.spec",
    });

    const completed = service.completeProviderBridgeSubmission({
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
      recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      completedAtUtc: "2026-04-17T17:05:00.000Z",
      failureReason: null,
      scriptVersion: "quantumReadiness.providerBridgeCompletion.service.spec",
    });

    expect(completed.completedExecutionSubmission.executionRecord.status).toBe("completed");
    expect(completed.completedExecutionSubmission.executionResult?.status).toBe("completed");
    expect(fs.existsSync(completed.completedExecutionSubmission.persistedArtifacts.recordPath)).toBe(true);
    expect(fs.existsSync(completed.completedExecutionSubmission.persistedArtifacts.resultPath ?? "")).toBe(true);

    const loadedExecution = service.loadLatestExecutionArtifacts({
      rootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loadedExecution.executionRecord.status).toBe("completed");
    expect(loadedExecution.executionResult?.rawCountsArtifactPath).toBe(
      "/raw-counts/phase2b_row_0698__G_G348.json",
    );
  });
});
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.providerBridgeCompletion.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController provider bridge completion", () => {
  let controller: QuantumReadinessController;
  let service: QuantumReadinessService;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(() => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    service = new QuantumReadinessService(
      graphModelServiceMock as unknown as GraphModelService,
    );

    controller = new QuantumReadinessController(service);
  });

  it("completes a submitted provider request into completed execution artifacts through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-completion-controller-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");

    controller.buildProviderExecutionRequest({
      rootDirectoryPath: providerRequestRoot,
      executionRequest: {
        requestId: "provider-request-0698",
        subtreeId: "G:G348",
        caseLabel: "phase2b_row_0698__G_G348",
        providerName: "ibm_runtime",
        backendName: "ibm_torino",
        shots: 8192,
        resilienceLevel: 0,
        createdAtUtc: "2026-04-17T17:03:17.743Z",
        notes: "WS6 exact path request",
      },
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.providerBridgeCompletion.controller.spec",
    });

    controller.submitProviderBridgeRequest({
      providerRequestRootDirectoryPath: providerRequestRoot,
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      scriptVersion: "quantumReadiness.providerBridgeCompletion.controller.spec",
    });

    const completed = controller.completeProviderBridgeSubmission({
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
      recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      completedAtUtc: "2026-04-17T17:05:00.000Z",
      failureReason: null,
      scriptVersion: "quantumReadiness.providerBridgeCompletion.controller.spec",
    });

    expect(completed.completedExecutionSubmission.executionRecord.status).toBe("completed");
    expect(completed.completedExecutionSubmission.executionResult?.status).toBe("completed");
    expect(fs.existsSync(completed.completedExecutionSubmission.persistedArtifacts.recordPath)).toBe(true);

    const loadedExecution = controller.loadLatestExecutionArtifacts({
      rootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loadedExecution.executionRecord.status).toBe("completed");
    expect(loadedExecution.executionResult?.rawCountsArtifactPath).toBe(
      "/raw-counts/phase2b_row_0698__G_G348.json",
    );
  });
});
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.providerBridgeCompletion.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.providerBridgeCompletion.http", () => {
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

  it("completes a provider bridge submission through the HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-completion-http-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");

    await request(app.getHttpServer())
      .post("/execution/provider-request")
      .send({
        rootDirectoryPath: providerRequestRoot,
        executionRequest: {
          requestId: "provider-request-0698",
          subtreeId: "G:G348",
          caseLabel: "phase2b_row_0698__G_G348",
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          shots: 8192,
          resilienceLevel: 0,
          createdAtUtc: "2026-04-17T17:03:17.743Z",
          notes: "WS6 exact path request",
        },
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.providerBridgeCompletion.http.spec",
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/execution/provider-bridge/submit")
      .send({
        providerRequestRootDirectoryPath: providerRequestRoot,
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: "phase2b_row_0698__G_G348",
        scriptVersion: "quantumReadiness.providerBridgeCompletion.http.spec",
      })
      .expect(200);

    const completed = await request(app.getHttpServer())
      .post("/execution/provider-bridge/complete")
      .send({
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: "phase2b_row_0698__G_G348",
        rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
        recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
        scriptVersion: "quantumReadiness.providerBridgeCompletion.http.spec",
      })
      .expect(200);

    expect(completed.body.completedExecutionSubmission.executionRecord.status).toBe("completed");
    expect(completed.body.completedExecutionSubmission.executionResult.status).toBe("completed");
    expect(fs.existsSync(completed.body.completedExecutionSubmission.persistedArtifacts.recordPath)).toBe(true);

    const loadedExecution = await request(app.getHttpServer())
      .post("/execution/record-stub/load-latest")
      .send({
        rootDirectoryPath: executionArtifactsRoot,
        caseLabel: "phase2b_row_0698__G_G348",
      })
      .expect(200);

    expect(loadedExecution.body.executionRecord.status).toBe("completed");
    expect(loadedExecution.body.executionResult.rawCountsArtifactPath).toBe(
      "/raw-counts/phase2b_row_0698__G_G348.json",
    );
  });
});
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_ws6_provider_bridge_completion_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_ws6_provider_bridge_completion_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_WS6_PROVIDER_BRIDGE_COMPLETION_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-provider-bridge-completion.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.providerBridgeCompletion.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.providerBridgeCompletion.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.providerBridgeCompletion.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_WS6_PROVIDER_BRIDGE_COMPLETION_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/execution/provider-bridge/submit",
        "/execution/provider-bridge/complete",
        "/execution/record-stub/load-latest",
    ],
    "interpretation": (
        "Chunk H adds the first WS6 provider bridge completion path from submitted "
        "execution records into completed execution artifacts with result metadata."
    ),
}

(run_dir / "notes" / "openpra_quantum_ws6_provider_bridge_completion_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum WS6 Provider Bridge Completion Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /execution/provider-bridge/submit
- /execution/provider-bridge/complete
- /execution/record-stub/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_WS6_PROVIDER_BRIDGE_COMPLETION_CHECKPOINT_MEMO_v1.txt").write_text(
    memo,
    encoding="utf-8",
)
PY

tar -C "$OUT_ROOT" -czf "$TAR_PATH" "$(basename "$RUN_DIR")"
sha256sum "$TAR_PATH" > "$SHA_PATH"

echo "$RUN_DIR"
echo "$TAR_PATH"
echo "$SHA_PATH"
""",
    )

    print("Applied WS6 provider bridge completion chunk H successfully.")


if __name__ == "__main__":
    main()
