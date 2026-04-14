#!/usr/bin/env bash
set -euo pipefail

SCRIPT_VERSION="1.0.0"
UTC_NOW="$(date -u +"%Y%m%d_%H%M%SZ")"
UTC_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: This script must be run inside the OpenPRA git repository."
  exit 1
fi

cd "${REPO_ROOT}"

REPORT_DIR="artifacts/quantum_integration/recovery_service_pass1_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

backup_if_exists() {
  local target="$1"
  if [[ -f "${target}" ]]; then
    cp -p "${target}" "${target}.bak.${UTC_NOW}"
  fi
}

CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
HTTP_SPEC_PATH="packages/web-backend/tests/quantumReadiness.recovery.http.spec.ts"

echo "==> Writing quantumReadiness.service.ts"
backup_if_exists "${SERVICE_PATH}"
cat > "${SERVICE_PATH}" <<'EOF'
import { Injectable } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import {
  analyzeLikelyOpenPraFaultTreeGraphReadiness,
  buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot,
  buildOpenpraQuantumRecoveryFromCandidateDir,
  buildQuantumPreparationExport,
  type OpenPraFaultTreeReadinessOptions,
  type OpenPraFaultTreeReadinessResult,
  type OpenpraQuantumRecoveryBatchRollup,
  type OpenpraQuantumRecoveryBatchSelectionMode,
  type QuantumPreparationExport,
  type QuantumRecoveryLadderResult
} from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
import { adaptFaultTreeGraphInput } from "./openPraFaultTreeGraph.adapter";

/**
 * Backend integration service for quantum readiness analysis of fault tree graphs.
 *
 * This is the backend side seam into the quantum readiness package.
 * It supports direct graph analysis, graph lookup by faultTreeId,
 * deterministic preparation export, and filesystem-backed recovery entrypoints.
 */
@Injectable()
export class QuantumReadinessService {
  constructor(private readonly graphModelService: GraphModelService) {}

  analyzeFaultTreeGraph(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): OpenPraFaultTreeReadinessResult {
    return analyzeGraphLikeInputToReadiness(graph, modelName, options);
  }

  analyzeFaultTreeGraphPreparation(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): QuantumPreparationExport {
    const readinessResult = analyzeGraphLikeInputToReadiness(graph, modelName, options);

    return buildQuantumPreparationExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report
    );
  }

  async analyzeFaultTreeGraphById(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): Promise<OpenPraFaultTreeReadinessResult> {
    const graph = (await this.graphModelService.getFaultTreeGraph(
      faultTreeId
    )) as FaultTreeGraph | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    return analyzeGraphLikeInputToReadiness(converted, modelName, options);
  }

  async analyzeFaultTreeGraphByIdPreparation(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): Promise<QuantumPreparationExport> {
    const graph = (await this.graphModelService.getFaultTreeGraph(
      faultTreeId
    )) as FaultTreeGraph | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    const readinessResult = analyzeGraphLikeInputToReadiness(
      converted,
      modelName,
      options
    );

    return buildQuantumPreparationExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report
    );
  }

  analyzeRecoveryCandidateDir(candidateDir: string): QuantumRecoveryLadderResult {
    return buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir);
  }

  analyzeRecoveryBatchRoot(
    batchRoot: string,
    candidateDirs?: string[],
    selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only"
  ): OpenpraQuantumRecoveryBatchRollup {
    return buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot(
      batchRoot,
      candidateDirs,
      selectionMode
    );
  }
}

function analyzeGraphLikeInputToReadiness(
  graph: FaultTreeGraph | Record<string, unknown>,
  modelName?: string,
  options: OpenPraFaultTreeReadinessOptions = {}
): OpenPraFaultTreeReadinessResult {
  const converted = adaptFaultTreeGraphInput(graph);

  return analyzeLikelyOpenPraFaultTreeGraphReadiness(
    {
      faultTreeId: converted.faultTreeId,
      modelName,
      nodes: converted.nodes,
      edges: converted.edges
    },
    options
  );
}
EOF

echo "==> Writing quantumReadiness.controller.ts"
backup_if_exists "${CONTROLLER_PATH}"
cat > "${CONTROLLER_PATH}" <<'EOF'
import { Body, Controller, HttpCode, HttpException, HttpStatus, Post } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import type {
  OpenPraFaultTreeReadinessOptions,
  OpenPraFaultTreeReadinessResult,
  OpenpraQuantumRecoveryBatchRollup,
  OpenpraQuantumRecoveryBatchSelectionMode,
  QuantumPreparationExport,
  QuantumRecoveryLadderResult
} from "quantum-readiness";

import { QuantumReadinessService } from "./quantumReadiness.service";

/**
 * Request body for quantum readiness analysis of a fault tree graph.
 */
export interface QuantumReadinessGraphRequest {
  /**
   * Fault tree graph payload shaped like the shared OpenPRA graph contract,
   * or a normalized OpenPRA graph object.
   */
  graph: FaultTreeGraph | Record<string, unknown>;

  /**
   * Optional human readable model name.
   */
  modelName?: string;

  /**
   * Optional legacy wrapper for heuristics and readiness analysis overrides.
   */
  options?: OpenPraFaultTreeReadinessOptions;

  /**
   * Optional top-level heuristics overrides.
   */
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];

  /**
   * Optional top-level readiness analysis overrides.
   */
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
}

/**
 * Request body for quantum readiness analysis by stored faultTreeId.
 */
export interface QuantumReadinessGraphByIdRequest {
  /**
   * Existing fault tree identifier used by the graph model layer.
   */
  faultTreeId: string;

  /**
   * Optional human readable model name.
   */
  modelName?: string;

  /**
   * Optional legacy wrapper for heuristics and readiness analysis overrides.
   */
  options?: OpenPraFaultTreeReadinessOptions;

  /**
   * Optional top-level heuristics overrides.
   */
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];

  /**
   * Optional top-level readiness analysis overrides.
   */
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
}

/**
 * Request body for filesystem-backed single-case recovery.
 */
export interface QuantumRecoveryCandidateDirRequest {
  candidateDir: string;
}

/**
 * Request body for filesystem-backed batch recovery rollup.
 */
export interface QuantumRecoveryBatchRootRequest {
  batchRoot: string;
  candidateDirs?: string[];
  selectionMode?: OpenpraQuantumRecoveryBatchSelectionMode;
}

/**
 * Controller for quantum readiness analysis endpoints.
 */
@Controller()
export class QuantumReadinessController {
  /**
   * Construct controller with quantum readiness service dependency.
   *
   * @param quantumReadinessService - Service that performs graph readiness analysis
   */
  constructor(private readonly quantumReadinessService: QuantumReadinessService) {}

  /**
   * Analyze a fault tree graph for quantum readiness.
   *
   * Mounted under:
   * /api/quantum-readiness/fault-tree-graph
   */
  @Post("/fault-tree-graph")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraph(
    @Body() body: QuantumReadinessGraphRequest
  ): OpenPraFaultTreeReadinessResult {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraph(
        body.graph,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /**
   * Analyze a fault tree graph and export deterministic preparation payloads.
   *
   * Mounted under:
   * /api/quantum-readiness/fault-tree-graph/preparation
   */
  @Post("/fault-tree-graph/preparation")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraphPreparation(
    @Body() body: QuantumReadinessGraphRequest
  ): QuantumPreparationExport {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraphPreparation(
        body.graph,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /**
   * Retrieve a stored fault tree graph by id and analyze it for readiness.
   *
   * Mounted under:
   * /api/quantum-readiness/fault-tree-graph/by-id
   */
  @Post("/fault-tree-graph/by-id")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphById(
    @Body() body: QuantumReadinessGraphByIdRequest
  ): Promise<OpenPraFaultTreeReadinessResult> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphById(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /**
   * Retrieve a stored fault tree graph by id and export deterministic preparation payloads.
   *
   * Mounted under:
   * /api/quantum-readiness/fault-tree-graph/by-id/preparation
   */
  @Post("/fault-tree-graph/by-id/preparation")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphByIdPreparation(
    @Body() body: QuantumReadinessGraphByIdRequest
  ): Promise<QuantumPreparationExport> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphByIdPreparation(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /**
   * Build a validated quantum recovery result from a single candidate directory.
   *
   * Mounted under:
   * /api/quantum-readiness/recovery/candidate-dir
   */
  @Post("/recovery/candidate-dir")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryCandidateDir(
    @Body() body: QuantumRecoveryCandidateDirRequest
  ): QuantumRecoveryLadderResult {
    try {
      return this.quantumReadinessService.analyzeRecoveryCandidateDir(body.candidateDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /**
   * Build a batch recovery rollup from a batch root.
   *
   * Mounted under:
   * /api/quantum-readiness/recovery/batch-root
   */
  @Post("/recovery/batch-root")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryBatchRoot(
    @Body() body: QuantumRecoveryBatchRootRequest
  ): OpenpraQuantumRecoveryBatchRollup {
    try {
      return this.quantumReadinessService.analyzeRecoveryBatchRoot(
        body.batchRoot,
        body.candidateDirs,
        body.selectionMode ?? "package_result_only"
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private resolveOptions(
    body:
      | QuantumReadinessGraphRequest
      | QuantumReadinessGraphByIdRequest
  ): OpenPraFaultTreeReadinessOptions {
    return {
      ...(body.options ?? {}),
      ...(body.heuristics !== undefined ? { heuristics: body.heuristics } : {}),
      ...(body.analysis !== undefined ? { analysis: body.analysis } : {})
    };
  }

  private toHttpException(error: unknown): HttpException {
    const message = error instanceof Error ? error.message : "Something went wrong";

    if (message.startsWith("No fault tree graph found for faultTreeId")) {
      return new HttpException(message, HttpStatus.NOT_FOUND);
    }

    if (
      message.includes("candidateDir does not exist") ||
      message.includes("batchRoot does not exist") ||
      message.includes("Missing candidate artifact") ||
      message.includes("Missing package recovery result")
    ) {
      return new HttpException(message, HttpStatus.NOT_FOUND);
    }

    return new HttpException(message, HttpStatus.BAD_REQUEST);
  }
}
EOF

echo "==> Writing quantumReadiness.recovery.http.spec.ts"
cat > "${HTTP_SPEC_PATH}" <<'EOF'
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildOpenpraQuantumRecoveryFromCandidateDir } from "quantum-readiness";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface RecoveryHttpResponse {
  modelId: string;
  candidateRootNodeId: string;
  integrationRecommendation: {
    primaryMode: string;
    requiresOperatorAttention: boolean;
  };
  recoveryTier1ExactHardware: {
    recoveredExactCutSetCount: number;
  };
  recoveryTier3UnionSensitivity: {
    unionRecoveredCount: number;
    allRecoveredInUnion: boolean;
  };
}

interface RecoveryBatchHttpResponse {
  caseCount: number;
  exactHardwareRecoveryCaseCount: number;
  unionSensitivityRecoveryCaseCount: number;
  operatorAttentionRequiredCaseCount: number;
  cases: Array<{
    label: string;
    primaryMode: string;
  }>;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function makeCandidateArtifacts(
  candidateDir: string,
  modelId: string,
  candidateRootNodeId: string
): void {
  writeJson(path.join(candidateDir, "package_metadata.json"), {
    model_id: modelId,
    candidate_root_node_id: candidateRootNodeId,
    topology_class: "A",
    basic_event_count: 3,
    required_qubits: 3
  });

  writeJson(path.join(candidateDir, "raw_counts.json"), {
    model_id: modelId,
    candidate_root_node_id: candidateRootNodeId,
    topology_class: "A",
    basic_event_count: 3,
    required_qubits: 3,
    ordered_basic_event_ids: ["A", "B", "C"],
    bitstring_convention: "declared_order",
    counts: {
      "100": 50,
      "011": 30,
      "000": 20
    },
    shots_total: 100
  });

  writeJson(path.join(candidateDir, "classical_reference_mcs.json"), {
    model_id: modelId,
    candidate_root_node_id: candidateRootNodeId,
    frozen_mcs_reference: {
      minimal_cut_set_count: 2,
      basic_event_id_sets: [["A"], ["B", "C"]],
      bitstrings: ["100", "011"]
    }
  });
}

function makePackageRecoveryResult(candidateDir: string): void {
  const result = buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir);
  writeJson(path.join(candidateDir, "openpra_package_recovery_result_v1.json"), result);
}

describe("QuantumReadiness HTTP recovery", () => {
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

  beforeEach(() => {
    graphModelServiceMock.getFaultTreeGraph.mockReset();
  });

  it("POST /api/quantum-readiness/recovery/candidate-dir returns a structured recovery result", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-http-single-"));
    const candidateDir = path.join(tempRoot, "0001_phase2b_row_test");
    fs.mkdirSync(candidateDir, { recursive: true });

    makeCandidateArtifacts(candidateDir, "phase2b_row_test", "G:GTEST");

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/recovery/candidate-dir")
      .send({ candidateDir })
      .expect(200);

    const body = response.body as RecoveryHttpResponse;

    expect(body.modelId).toBe("phase2b_row_test");
    expect(body.candidateRootNodeId).toBe("G:GTEST");
    expect(body.integrationRecommendation.primaryMode).toBe("exact_hardware_recovery");
    expect(body.integrationRecommendation.requiresOperatorAttention).toBe(false);
    expect(body.recoveryTier1ExactHardware.recoveredExactCutSetCount).toBe(2);
    expect(body.recoveryTier3UnionSensitivity.unionRecoveredCount).toBe(2);
    expect(body.recoveryTier3UnionSensitivity.allRecoveredInUnion).toBe(true);
  });

  it("POST /api/quantum-readiness/recovery/batch-root returns a batch rollup from package results", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-http-batch-"));
    const candidateA = path.join(tempRoot, "0001_phase2b_row_a");
    const candidateB = path.join(tempRoot, "0002_phase2b_row_b");
    fs.mkdirSync(candidateA, { recursive: true });
    fs.mkdirSync(candidateB, { recursive: true });

    makeCandidateArtifacts(candidateA, "phase2b_row_a", "G:GA");
    makeCandidateArtifacts(candidateB, "phase2b_row_b", "G:GB");
    makePackageRecoveryResult(candidateA);
    makePackageRecoveryResult(candidateB);

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/recovery/batch-root")
      .send({
        batchRoot: tempRoot,
        selectionMode: "package_result_only"
      })
      .expect(200);

    const body = response.body as RecoveryBatchHttpResponse;

    expect(body.caseCount).toBe(2);
    expect(body.exactHardwareRecoveryCaseCount).toBe(2);
    expect(body.unionSensitivityRecoveryCaseCount).toBe(0);
    expect(body.operatorAttentionRequiredCaseCount).toBe(0);
    expect(body.cases.map((row) => row.label)).toEqual([
      "0001_phase2b_row_a",
      "0002_phase2b_row_b"
    ]);
    expect(body.cases.map((row) => row.primaryMode)).toEqual([
      "exact_hardware_recovery",
      "exact_hardware_recovery"
    ]);
  });

  it("POST /api/quantum-readiness/recovery/candidate-dir returns 404 when the candidate directory is missing", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/recovery/candidate-dir")
      .send({
        candidateDir: "/definitely/not/a/real/candidate/dir"
      })
      .expect(404);

    expect(response.body.message).toMatch(/candidateDir does not exist/i);
  });
});
EOF

echo "==> Running web-backend tests"
if ./node_modules/.bin/nx test web-backend > "${REPORT_DIR}/nx_test_web_backend.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_test_web_backend.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_test_web_backend.status"
fi

echo "==> Running quantum-readiness tests"
if ./node_modules/.bin/nx test quantum-readiness > "${REPORT_DIR}/nx_test_quantum_readiness.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_test_quantum_readiness.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_test_quantum_readiness.status"
fi

echo "==> Running quantum-readiness build"
if ./node_modules/.bin/nx build quantum-readiness > "${REPORT_DIR}/nx_build_quantum_readiness.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_build_quantum_readiness.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_build_quantum_readiness.status"
fi

echo "==> Capturing git status"
git status --short > "${REPORT_DIR}/git_status_short_after_recovery_service_pass1.txt"

echo "==> Writing summary"
cat > "${REPORT_DIR}/recovery_service_pass1_summary.txt" <<EOF
OpenPRA quantum recovery service pass 1 completed.

scriptVersion: ${SCRIPT_VERSION}
createdAtUtc: ${UTC_ISO}
repositoryRoot: ${REPO_ROOT}

Actions:
- extended quantumReadiness.service.ts with filesystem-backed recovery entrypoints
- extended quantumReadiness.controller.ts with recovery endpoints
- added quantumReadiness.recovery.http.spec.ts

Outputs:
- ${REPORT_DIR}/nx_test_web_backend.status
- ${REPORT_DIR}/nx_test_web_backend.log
- ${REPORT_DIR}/nx_test_quantum_readiness.status
- ${REPORT_DIR}/nx_test_quantum_readiness.log
- ${REPORT_DIR}/nx_build_quantum_readiness.status
- ${REPORT_DIR}/nx_build_quantum_readiness.log
- ${REPORT_DIR}/git_status_short_after_recovery_service_pass1.txt
EOF

echo
echo "DONE"
echo "Report directory: ${REPORT_DIR}"
echo "web-backend test status: $(cat "${REPORT_DIR}/nx_test_web_backend.status")"
echo "quantum-readiness test status: $(cat "${REPORT_DIR}/nx_test_quantum_readiness.status")"
echo "quantum-readiness build status: $(cat "${REPORT_DIR}/nx_build_quantum_readiness.status")"
