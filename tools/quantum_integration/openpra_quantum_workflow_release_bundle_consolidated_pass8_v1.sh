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

REPORT_DIR="artifacts/quantum_integration/workflow_release_bundle_consolidated_pass8_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_TARGET="packages/web-backend/tests/quantumReadiness.workflowReleaseBundle.writeByTarget.http.spec.ts"
HTTP_SPEC_KIND="packages/web-backend/tests/quantumReadiness.workflowReleaseBundle.writeByKind.http.spec.ts"

python3 <<'PY'
from pathlib import Path
import sys

service_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts")
controller_path = Path("packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts")

service = service_path.read_text(encoding="utf-8")
controller = controller_path.read_text(encoding="utf-8")

service_interface_block = """
export interface QuantumWorkflowReleaseBundleWriteByTargetRequest {
  rootDir: string;
  modelId: string;
  subtreeId: string;
  outputDir: string;
}

export interface QuantumWorkflowReleaseBundleWriteByTargetResult
  extends QuantumWorkflowReleaseBundleWriteResult {
  workflowRunDir: string;
}

export interface QuantumWorkflowReleaseBundleWriteByKindRequest {
  rootDir: string;
  workflowKind: string;
  outputDir: string;
}

export interface QuantumWorkflowReleaseBundleWriteByKindResult
  extends QuantumWorkflowReleaseBundleWriteResult {
  workflowRunDir: string;
}

"""

service_method_block = """
  buildWorkflowReleaseBundleToLatestWorkflowRunByTarget(
    request: QuantumWorkflowReleaseBundleWriteByTargetRequest
  ): QuantumWorkflowReleaseBundleWriteByTargetResult {
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
    const writeResult = this.buildWorkflowReleaseBundleToFilesystem(
      workflowRunDir,
      request.outputDir
    );

    return {
      workflowRunDir,
      ...writeResult
    };
  }

  buildWorkflowReleaseBundleToLatestWorkflowRunByKind(
    request: QuantumWorkflowReleaseBundleWriteByKindRequest
  ): QuantumWorkflowReleaseBundleWriteByKindResult {
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
    const writeResult = this.buildWorkflowReleaseBundleToFilesystem(
      workflowRunDir,
      request.outputDir
    );

    return {
      workflowRunDir,
      ...writeResult
    };
  }

"""

controller_interface_block = """
export interface QuantumWorkflowReleaseBundleWriteByTargetRequestBody
  extends QuantumWorkflowReleaseBundleWriteByTargetRequest {}

export interface QuantumWorkflowReleaseBundleWriteByKindRequestBody
  extends QuantumWorkflowReleaseBundleWriteByKindRequest {}

"""

controller_endpoint_block = """
  @Post("/release/workflow-bundle/write/by-target")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseBundleToLatestWorkflowRunByTarget(
    @Body() body: QuantumWorkflowReleaseBundleWriteByTargetRequestBody
  ): QuantumWorkflowReleaseBundleWriteByTargetResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseBundleToLatestWorkflowRunByTarget(
        body
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-bundle/write/by-kind")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseBundleToLatestWorkflowRunByKind(
    @Body() body: QuantumWorkflowReleaseBundleWriteByKindRequestBody
  ): QuantumWorkflowReleaseBundleWriteByKindResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseBundleToLatestWorkflowRunByKind(
        body
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

"""

def insert_before_first(text: str, anchors: list[str], block: str, err: str) -> str:
    for anchor in anchors:
        if anchor in text:
            return text.replace(anchor, block + anchor, 1)
    sys.exit(err)

if "export interface QuantumWorkflowReleaseBundleWriteByTargetRequest" not in service:
    service = insert_before_first(
        service,
        ["\n@Injectable()\nexport class QuantumReadinessService {"],
        "\n" + service_interface_block,
        "ERROR: Could not find service release bundle consolidated interface insertion anchor."
    )

if "buildWorkflowReleaseBundleToLatestWorkflowRunByTarget(" not in service:
    service = insert_before_first(
        service,
        [
            "\n  buildWorkflowReleaseBundleToFilesystem(\n",
            "\n  buildWorkflowReleaseManifestToFilesystem(\n"
        ],
        "\n" + service_method_block,
        "ERROR: Could not find service release bundle consolidated method insertion anchor."
    )

if "type QuantumWorkflowReleaseBundleWriteByTargetResult," not in controller:
    import_anchor = "  type QuantumWorkflowReleaseBundleWriteResult,"
    if import_anchor not in controller:
        sys.exit("ERROR: Could not find controller release bundle consolidated import insertion anchor.")
    controller = controller.replace(
        import_anchor,
        import_anchor
        + "\n  type QuantumWorkflowReleaseBundleWriteByTargetRequest,"
        + "\n  type QuantumWorkflowReleaseBundleWriteByTargetResult,"
        + "\n  type QuantumWorkflowReleaseBundleWriteByKindRequest,"
        + "\n  type QuantumWorkflowReleaseBundleWriteByKindResult,",
        1
    )

if "export interface QuantumWorkflowReleaseBundleWriteByTargetRequestBody" not in controller:
    controller = insert_before_first(
        controller,
        ["\n@Controller()\nexport class QuantumReadinessController {"],
        "\n" + controller_interface_block,
        "ERROR: Could not find controller release bundle consolidated interface insertion anchor."
    )

if '@Post("/release/workflow-bundle/write/by-target")' not in controller:
    controller = insert_before_first(
        controller,
        ['\n  @Post("/release/workflow-bundle/write")\n'],
        "\n" + controller_endpoint_block,
        "ERROR: Could not find controller release bundle consolidated endpoint insertion anchor."
    )

service_path.write_text(service, encoding="utf-8")
controller_path.write_text(controller, encoding="utf-8")
PY

cat > "${HTTP_SPEC_TARGET}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowReleaseBundleWriteByTargetHttpResponse {
  workflowRunDir: string;
  outputDir: string;
  bundleDir: string;
  releaseSummaryPath: string;
  releaseManifestPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8")
}

describe("QuantumReadiness HTTP workflow release bundle write by target", () => {
  let app: INestApplication
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock }

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn()
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock
        }
      ]
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix("api/quantum-readiness")
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it("POST /api/quantum-readiness/release/workflow-bundle/write/by-target writes a bundle for the latest matching target", async () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-bundle-target-root-")
    )
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-bundle-target-out-")
    )

    const runOld = path.join(rootDir, "openpra_quantum_target_old")
    const runNew = path.join(rootDir, "openpra_quantum_target_new")
    const runOther = path.join(rootDir, "openpra_quantum_other")

    for (const dir of [runOld, runNew, runOther]) {
      fs.mkdirSync(dir, { recursive: true })
      writeJson(path.join(dir, "openpra_quantum_workflow_run_manifest_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "preparation", "openpra_quantum_preparation_bundle_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "execution", "openpra_quantum_execution_artifact_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "execution", "openpra_quantum_execution_provenance_manifest_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "recovery", "openpra_quantum_recovery_artifact_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "recovery", "openpra_quantum_importance_comparison_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "recovery", "openpra_quantum_importance_comparison_report_v1.json"), { ok: true })
    }

    writeJson(path.join(runOld, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-15T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP"
    })
    writeJson(path.join(runNew, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP"
    })
    writeJson(path.join(runOther, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-17T10:00:00.000Z",
      modelId: "other_model",
      subtreeId: "OTHER"
    })

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-bundle/write/by-target")
      .send({
        rootDir,
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
        outputDir
      })
      .expect(200)

    const body = response.body as WorkflowReleaseBundleWriteByTargetHttpResponse

    expect(body.workflowRunDir).toBe(runNew)
    expect(fs.existsSync(body.bundleDir)).toBe(true)
    expect(fs.existsSync(body.releaseSummaryPath)).toBe(true)
    expect(fs.existsSync(body.releaseManifestPath)).toBe(true)
  })
})
EOF

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

interface WorkflowReleaseBundleWriteByKindHttpResponse {
  workflowRunDir: string;
  outputDir: string;
  bundleDir: string;
  releaseSummaryPath: string;
  releaseManifestPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8")
}

describe("QuantumReadiness HTTP workflow release bundle write by kind", () => {
  let app: INestApplication
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock }

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn()
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock
        }
      ]
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix("api/quantum-readiness")
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it("POST /api/quantum-readiness/release/workflow-bundle/write/by-kind writes a bundle for the latest matching workflow kind", async () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-bundle-kind-root-")
    )
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-release-bundle-kind-out-")
    )

    const runPrep = path.join(rootDir, "openpra_quantum_preparation_old")
    const runFullOld = path.join(rootDir, "openpra_quantum_full_pipeline_old")
    const runFullNew = path.join(rootDir, "openpra_quantum_full_pipeline_new")

    for (const dir of [runPrep, runFullOld, runFullNew]) {
      fs.mkdirSync(dir, { recursive: true })
      writeJson(path.join(dir, "openpra_quantum_workflow_run_manifest_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "preparation", "openpra_quantum_preparation_bundle_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "execution", "openpra_quantum_execution_artifact_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "execution", "openpra_quantum_execution_provenance_manifest_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "recovery", "openpra_quantum_recovery_artifact_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "recovery", "openpra_quantum_importance_comparison_v1.json"), { ok: true })
      writeJson(path.join(dir, "artifacts", "recovery", "openpra_quantum_importance_comparison_report_v1.json"), { ok: true })
    }

    writeJson(path.join(runPrep, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-15T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP"
    })
    writeJson(path.join(runFullOld, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-15T11:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP"
    })
    writeJson(path.join(runFullNew, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP"
    })

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-bundle/write/by-kind")
      .send({
        rootDir,
        workflowKind: "full_pipeline",
        outputDir
      })
      .expect(200)

    const body = response.body as WorkflowReleaseBundleWriteByKindHttpResponse

    expect(body.workflowRunDir).toBe(runFullNew)
    expect(fs.existsSync(body.bundleDir)).toBe(true)
    expect(fs.existsSync(body.releaseSummaryPath)).toBe(true)
    expect(fs.existsSync(body.releaseManifestPath)).toBe(true)
  })
})
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
