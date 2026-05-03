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
        "packages/quantum-readiness/src/lib/openpra-quantum-provider-bridge-scaffold.ts",
        """import * as path from "node:path";

import {
  loadLatestOpenPraQuantumProviderExecutionRequest,
  type OpenPraQuantumProviderExecutionRequestLoadResult,
} from "./openpra-quantum-provider-request-store";
import {
  buildOpenPraQuantumExecutionRecordServiceStub,
  type OpenPraQuantumExecutionRecordServiceStubResult,
} from "./openpra-quantum-execution-record-service-stub";

export interface OpenPraQuantumProviderBridgeSubmissionRequest {
  providerRequestRootDirectoryPath: string;
  executionArtifactsRootDirectoryPath: string;
  caseLabel: string;
  jobId?: string;
  submittedAtUtc?: string;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export interface OpenPraQuantumProviderBridgeSubmissionResult {
  loadedProviderRequest: OpenPraQuantumProviderExecutionRequestLoadResult;
  executionSubmission: OpenPraQuantumExecutionRecordServiceStubResult;
}

export function submitOpenPraQuantumProviderBridgeRequest(
  request: OpenPraQuantumProviderBridgeSubmissionRequest,
): OpenPraQuantumProviderBridgeSubmissionResult {
  const loadedProviderRequest = loadLatestOpenPraQuantumProviderExecutionRequest({
    rootDirectoryPath: request.providerRequestRootDirectoryPath,
    caseLabel: request.caseLabel,
  });

  const providerRequest = loadedProviderRequest.request;

  const executionSubmission = buildOpenPraQuantumExecutionRecordServiceStub({
    rootDirectoryPath: path.join(
      request.executionArtifactsRootDirectoryPath,
      providerRequest.caseLabel,
    ),
    executionRecord: {
      subtreeId: providerRequest.subtreeId,
      providerName: providerRequest.providerName,
      backendName: providerRequest.backendName,
      jobId: request.jobId ?? providerRequest.requestId,
      shots: providerRequest.shots,
      resilienceLevel: providerRequest.resilienceLevel,
      status: "submitted",
      provenanceManifestPath:
        loadedProviderRequest.provenanceManifestPath ?? loadedProviderRequest.requestPath,
      submittedAtUtc: request.submittedAtUtc ?? providerRequest.createdAtUtc,
      caseLabel: providerRequest.caseLabel,
    },
    executionResult: null,
    inputArtifactPaths: [
      loadedProviderRequest.requestPath,
      ...(loadedProviderRequest.provenanceManifestPath
        ? [loadedProviderRequest.provenanceManifestPath]
        : []),
      ...(request.inputArtifactPaths ?? []),
    ],
    scriptVersion:
      request.scriptVersion ?? "openpra-quantum-provider-bridge-scaffold-v1",
  });

  return {
    loadedProviderRequest,
    executionSubmission,
  };
}
""",
    )

    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-provider-bridge-scaffold.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-contract";
import { loadLatestOpenPraQuantumExecutionArtifacts } from "./openpra-quantum-execution-artifact-loader";
import { submitOpenPraQuantumProviderBridgeRequest } from "./openpra-quantum-provider-bridge-scaffold";
import { persistOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-store";

describe("openpra-quantum-provider-bridge-scaffold", () => {
  it("submits a stored provider request into execution artifacts", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-"));
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
      scriptVersion: "openpra-quantum-provider-bridge-scaffold.spec",
    });

    const submitted = submitOpenPraQuantumProviderBridgeRequest({
      providerRequestRootDirectoryPath: providerRequestRoot,
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      scriptVersion: "openpra-quantum-provider-bridge-scaffold.spec",
    });

    expect(submitted.loadedProviderRequest.request.requestId).toBe("provider-request-0698");
    expect(submitted.executionSubmission.executionRecord.jobId).toBe("provider-request-0698");
    expect(submitted.executionSubmission.executionRecord.status).toBe("submitted");
    expect(fs.existsSync(submitted.executionSubmission.persistedArtifacts.recordPath)).toBe(true);

    const loadedExecution = loadLatestOpenPraQuantumExecutionArtifacts({
      rootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loadedExecution.executionRecord.jobId).toBe("provider-request-0698");
    expect(loadedExecution.executionResult).toBeNull();
  });
});
""",
    )

    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-canonical-case-materialization-loader";\n',
        'export * from "./openpra-quantum-provider-bridge-scaffold";\n',
        "index chunk g export",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  persistOpenPraQuantumProviderExecutionRequest,\n",
        "  submitOpenPraQuantumProviderBridgeRequest,\n",
        "service chunk g import function",
    )
    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumProviderExecutionRequestStoreResult,\n",
        "  type OpenPraQuantumProviderBridgeSubmissionRequest,\n  type OpenPraQuantumProviderBridgeSubmissionResult,\n",
        "service chunk g import types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export type QuantumProviderBridgeSubmissionServiceRequest =
  OpenPraQuantumProviderBridgeSubmissionRequest;

""",
        "service chunk g request alias",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  submitProviderBridgeRequest(
    request: QuantumProviderBridgeSubmissionServiceRequest,
  ): OpenPraQuantumProviderBridgeSubmissionResult {
    return submitOpenPraQuantumProviderBridgeRequest(request);
  }

""",
        "service chunk g method",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumProviderExecutionRequestStoreResult,\n",
        "  OpenPraQuantumProviderBridgeSubmissionResult,\n",
        "controller chunk g import result type",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumLoadLatestProviderExecutionRequest,\n",
        "  type QuantumProviderBridgeSubmissionServiceRequest,\n",
        "controller chunk g service type",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumProviderBridgeSubmissionRequestBody
  extends QuantumProviderBridgeSubmissionServiceRequest {}

""",
        "controller chunk g request body",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/execution/provider-bridge/submit")
  @HttpCode(HttpStatus.OK)
  submitProviderBridgeRequest(
    @Body() body: QuantumProviderBridgeSubmissionRequestBody,
  ): OpenPraQuantumProviderBridgeSubmissionResult {
    try {
      return this.quantumReadinessService.submitProviderBridgeRequest(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk g method",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.providerBridge.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService provider bridge submission", () => {
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

  it("submits a stored provider request into execution artifacts", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-service-"));
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
      scriptVersion: "quantumReadiness.providerBridge.service.spec",
    });

    const submitted = service.submitProviderBridgeRequest({
      providerRequestRootDirectoryPath: providerRequestRoot,
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      scriptVersion: "quantumReadiness.providerBridge.service.spec",
    });

    expect(submitted.loadedProviderRequest.request.requestId).toBe("provider-request-0698");
    expect(submitted.executionSubmission.executionRecord.status).toBe("submitted");
    expect(fs.existsSync(submitted.executionSubmission.persistedArtifacts.recordPath)).toBe(true);

    const loadedExecution = service.loadLatestExecutionArtifacts({
      rootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loadedExecution.executionRecord.jobId).toBe("provider-request-0698");
    expect(loadedExecution.executionResult).toBeNull();
  });
});
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.providerBridge.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController provider bridge submission", () => {
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

  it("submits a stored provider request into execution artifacts through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-controller-"));
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
      scriptVersion: "quantumReadiness.providerBridge.controller.spec",
    });

    const submitted = controller.submitProviderBridgeRequest({
      providerRequestRootDirectoryPath: providerRequestRoot,
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      scriptVersion: "quantumReadiness.providerBridge.controller.spec",
    });

    expect(submitted.loadedProviderRequest.request.requestId).toBe("provider-request-0698");
    expect(submitted.executionSubmission.executionRecord.status).toBe("submitted");
    expect(fs.existsSync(submitted.executionSubmission.persistedArtifacts.recordPath)).toBe(true);

    const loadedExecution = controller.loadLatestExecutionArtifacts({
      rootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loadedExecution.executionRecord.jobId).toBe("provider-request-0698");
    expect(loadedExecution.executionResult).toBeNull();
  });
});
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.providerBridge.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.providerBridge.http", () => {
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

  it("submits a stored provider request through the provider bridge route", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-http-"));
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
        scriptVersion: "quantumReadiness.providerBridge.http.spec",
      })
      .expect(200);

    const submitted = await request(app.getHttpServer())
      .post("/execution/provider-bridge/submit")
      .send({
        providerRequestRootDirectoryPath: providerRequestRoot,
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: "phase2b_row_0698__G_G348",
        scriptVersion: "quantumReadiness.providerBridge.http.spec",
      })
      .expect(200);

    expect(submitted.body.loadedProviderRequest.request.requestId).toBe("provider-request-0698");
    expect(submitted.body.executionSubmission.executionRecord.status).toBe("submitted");
    expect(fs.existsSync(submitted.body.executionSubmission.persistedArtifacts.recordPath)).toBe(true);

    const loadedExecution = await request(app.getHttpServer())
      .post("/execution/record-stub/load-latest")
      .send({
        rootDirectoryPath: executionArtifactsRoot,
        caseLabel: "phase2b_row_0698__G_G348",
      })
      .expect(200);

    expect(loadedExecution.body.executionRecord.jobId).toBe("provider-request-0698");
    expect(loadedExecution.body.executionResult).toBeNull();
  });
});
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_ws6_provider_bridge_submission_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_ws6_provider_bridge_submission_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_WS6_PROVIDER_BRIDGE_SUBMISSION_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-provider-bridge-scaffold.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.providerBridge.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.providerBridge.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.providerBridge.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_WS6_PROVIDER_BRIDGE_SUBMISSION_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/execution/provider-bridge/submit",
        "/execution/record-stub/load-latest",
    ],
    "interpretation": (
        "Chunk G adds the first WS6 provider bridge submission path from stored "
        "provider requests into persistent execution record artifacts."
    ),
}

(run_dir / "notes" / "openpra_quantum_ws6_provider_bridge_submission_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum WS6 Provider Bridge Submission Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /execution/provider-bridge/submit
- /execution/record-stub/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_WS6_PROVIDER_BRIDGE_SUBMISSION_CHECKPOINT_MEMO_v1.txt").write_text(
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

    print("Applied WS6 provider bridge submission chunk G successfully.")


if __name__ == "__main__":
    main()
