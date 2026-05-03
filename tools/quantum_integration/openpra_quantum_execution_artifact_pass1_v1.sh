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

REPORT_DIR="artifacts/quantum_integration/execution_artifact_pass1_${UTC_NOW}"
BACKUP_DIR="_work/manual_execution_artifact_pass1_backup_${UTC_NOW}"
mkdir -p "${REPORT_DIR}" "${BACKUP_DIR}" "tools/quantum_research_scripts/phase5"

backup_to_workdir() {
  local target="$1"
  if [[ -f "${target}" ]]; then
    mkdir -p "${BACKUP_DIR}/$(dirname "${target}")"
    cp -p "${target}" "${BACKUP_DIR}/${target}"
  fi
}

INDEX_PATH="packages/quantum-readiness/src/lib/index.ts"
EXEC_ARTIFACT_PATH="packages/quantum-readiness/src/lib/openpra-quantum-execution-artifacts.ts"
EXEC_ARTIFACT_SPEC_PATH="packages/quantum-readiness/src/lib/openpra-quantum-execution-artifacts.spec.ts"
SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_PATH="packages/web-backend/tests/quantumReadiness.executionArtifacts.http.spec.ts"

backup_to_workdir "${INDEX_PATH}"
backup_to_workdir "${SERVICE_PATH}"
backup_to_workdir "${CONTROLLER_PATH}"

echo "==> Relocating stray research scripts and helper capture script if present"
if [[ -f "scripts/openpra_phase5_build_paper_strengthening_tranche_v1.py" ]]; then
  mv "scripts/openpra_phase5_build_paper_strengthening_tranche_v1.py" "tools/quantum_research_scripts/phase5/"
fi
if [[ -f "scripts/openpra_phase5_build_true_new_structure_tranche_v1.py" ]]; then
  mv "scripts/openpra_phase5_build_true_new_structure_tranche_v1.py" "tools/quantum_research_scripts/phase5/"
fi

echo "==> Writing openpra-quantum-execution-artifacts.ts"
cat > "${EXEC_ARTIFACT_PATH}" <<'EOF'
export type OpenpraQuantumExecutionProviderType =
  | "simulator"
  | "emulator"
  | "real_hardware";

export interface OpenpraQuantumExecutionArtifactBuildOptions {
  artifactId?: string;
  createdBy?: string;
  submittedAtUtc?: string;
  completedAtUtc?: string;
  inputReferences?: string[];
  sourceHashes?: Record<string, string>;
  notes?: string[];
}

export interface OpenpraQuantumExecutionRawCountsInput {
  modelId: string;
  subtreeId: string;
  sourcePreparationArtifactId: string;
  providerType: OpenpraQuantumExecutionProviderType;
  providerName: string;
  backendName: string;
  executionMode: string;
  shots: number;
  rawCounts: Record<string, number>;
  jobIdOrRunId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface OpenpraQuantumExecutionArtifact {
  schemaVersion: string;
  artifactType: "execution";
  artifactId: string;
  createdAtUtc: string;
  createdBy: string;
  inputReferences: string[];
  sourceHashes: Record<string, string>;
  notes: string[];

  modelId: string;
  subtreeId: string;
  sourcePreparationArtifactId: string;
  providerType: OpenpraQuantumExecutionProviderType;
  providerName: string;
  backendName: string;
  executionMode: string;
  jobIdOrRunId: string;
  status: string;
  shots: number;
  submittedAtUtc: string;
  completedAtUtc: string;
  rawCounts: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface OpenpraQuantumProvenanceManifest {
  schemaVersion: string;
  artifactType: "provenance_manifest";
  artifactId: string;
  createdAtUtc: string;
  createdBy: string;
  inputReferences: string[];
  sourceHashes: Record<string, string>;
  notes: string[];

  workflowInstanceId: string;
  relatedArtifactIds: string[];
  scriptOrPackageVersions: Record<string, string>;
  timestamps: {
    createdAtUtc: string;
    submittedAtUtc: string;
    completedAtUtc: string;
  };
  acceptanceGateResults: Record<string, boolean | string | number>;
}

export interface OpenpraQuantumExecutionArtifactBundle {
  executionArtifact: OpenpraQuantumExecutionArtifact;
  provenanceManifest: OpenpraQuantumProvenanceManifest;
}

const SCHEMA_VERSION = "1.0.0";
const MODULE_VERSION = "openpra-quantum-execution-artifacts-v1";

export function buildOpenpraQuantumExecutionArtifactBundleFromRawCounts(
  input: OpenpraQuantumExecutionRawCountsInput,
  options: OpenpraQuantumExecutionArtifactBuildOptions = {}
): OpenpraQuantumExecutionArtifactBundle {
  const createdAtUtc = new Date().toISOString();
  const submittedAtUtc = options.submittedAtUtc ?? createdAtUtc;
  const completedAtUtc = options.completedAtUtc ?? createdAtUtc;
  const createdBy = options.createdBy ?? MODULE_VERSION;

  const artifactId =
    options.artifactId ??
    buildExecutionArtifactId(input.modelId, input.subtreeId, createdAtUtc);

  const executionArtifact: OpenpraQuantumExecutionArtifact = {
    schemaVersion: SCHEMA_VERSION,
    artifactType: "execution",
    artifactId,
    createdAtUtc,
    createdBy,
    inputReferences: [...(options.inputReferences ?? [])],
    sourceHashes: { ...(options.sourceHashes ?? {}) },
    notes: [...(options.notes ?? [])],

    modelId: input.modelId,
    subtreeId: input.subtreeId,
    sourcePreparationArtifactId: input.sourcePreparationArtifactId,
    providerType: input.providerType,
    providerName: input.providerName,
    backendName: input.backendName,
    executionMode: input.executionMode,
    jobIdOrRunId:
      input.jobIdOrRunId ??
      `run:${sanitizeToken(input.modelId)}:${sanitizeToken(input.subtreeId)}:${sanitizeToken(createdAtUtc)}`,
    status: input.status ?? "completed",
    shots: input.shots,
    submittedAtUtc,
    completedAtUtc,
    rawCounts: cloneRawCounts(input.rawCounts),
    ...(input.metadata ? { metadata: { ...input.metadata } } : {})
  };

  const provenanceManifest: OpenpraQuantumProvenanceManifest = {
    schemaVersion: SCHEMA_VERSION,
    artifactType: "provenance_manifest",
    artifactId: buildProvenanceArtifactId(input.modelId, input.subtreeId, createdAtUtc),
    createdAtUtc,
    createdBy,
    inputReferences: [...(options.inputReferences ?? [])],
    sourceHashes: { ...(options.sourceHashes ?? {}) },
    notes: [...(options.notes ?? [])],

    workflowInstanceId: buildWorkflowInstanceId(input.modelId, input.subtreeId, createdAtUtc),
    relatedArtifactIds: [executionArtifact.artifactId, input.sourcePreparationArtifactId],
    scriptOrPackageVersions: {
      quantumReadinessExecutionArtifacts: MODULE_VERSION
    },
    timestamps: {
      createdAtUtc,
      submittedAtUtc,
      completedAtUtc
    },
    acceptanceGateResults: {
      hasPreparationArtifactReference: input.sourcePreparationArtifactId.length > 0,
      hasRawCounts: Object.keys(input.rawCounts).length > 0,
      shotsMatchRawCountsTotal:
        sumCounts(input.rawCounts) === input.shots
    }
  };

  return {
    executionArtifact,
    provenanceManifest
  };
}

function cloneRawCounts(rawCounts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(rawCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([bitstring, count]) => [bitstring, count])
  );
}

function sumCounts(rawCounts: Record<string, number>): number {
  return Object.values(rawCounts).reduce((sum, value) => sum + value, 0);
}

function buildExecutionArtifactId(
  modelId: string,
  subtreeId: string,
  createdAtUtc: string
): string {
  return `execution:${sanitizeToken(modelId)}:${sanitizeToken(subtreeId)}:${sanitizeToken(createdAtUtc)}`;
}

function buildProvenanceArtifactId(
  modelId: string,
  subtreeId: string,
  createdAtUtc: string
): string {
  return `provenance:${sanitizeToken(modelId)}:${sanitizeToken(subtreeId)}:${sanitizeToken(createdAtUtc)}`;
}

function buildWorkflowInstanceId(
  modelId: string,
  subtreeId: string,
  createdAtUtc: string
): string {
  return `workflow:${sanitizeToken(modelId)}:${sanitizeToken(subtreeId)}:${sanitizeToken(createdAtUtc)}`;
}

function sanitizeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
EOF

echo "==> Writing openpra-quantum-execution-artifacts.spec.ts"
cat > "${EXEC_ARTIFACT_SPEC_PATH}" <<'EOF'
import {
  buildOpenpraQuantumExecutionArtifactBundleFromRawCounts
} from "./openpra-quantum-execution-artifacts";

describe("openpra-quantum-execution-artifacts", () => {
  it("wraps raw counts into execution artifact and provenance manifest", () => {
    const bundle = buildOpenpraQuantumExecutionArtifactBundleFromRawCounts(
      {
        modelId: "phase2b_row_0001",
        subtreeId: "TOP",
        sourcePreparationArtifactId: "preparation:phase2b_row_0001:TOP:abc",
        providerType: "simulator",
        providerName: "qiskit-aer",
        backendName: "aer_simulator",
        executionMode: "counts_only",
        shots: 100,
        rawCounts: {
          "000": 10,
          "011": 30,
          "100": 60
        }
      },
      {
        createdBy: "jest:test"
      }
    );

    expect(bundle.executionArtifact.schemaVersion).toBe("1.0.0");
    expect(bundle.executionArtifact.artifactType).toBe("execution");
    expect(bundle.executionArtifact.providerType).toBe("simulator");
    expect(bundle.executionArtifact.providerName).toBe("qiskit-aer");
    expect(bundle.executionArtifact.backendName).toBe("aer_simulator");
    expect(bundle.executionArtifact.shots).toBe(100);
    expect(bundle.executionArtifact.rawCounts).toEqual({
      "000": 10,
      "011": 30,
      "100": 60
    });

    expect(bundle.provenanceManifest.artifactType).toBe("provenance_manifest");
    expect(bundle.provenanceManifest.relatedArtifactIds).toContain(
      bundle.executionArtifact.artifactId
    );
    expect(bundle.provenanceManifest.relatedArtifactIds).toContain(
      "preparation:phase2b_row_0001:TOP:abc"
    );
    expect(bundle.provenanceManifest.acceptanceGateResults).toEqual({
      hasPreparationArtifactReference: true,
      hasRawCounts: true,
      shotsMatchRawCountsTotal: true
    });
  });
});
EOF

echo "==> Writing index.ts"
cat > "${INDEX_PATH}" <<'EOF'
/**
 * Public exports for the quantum-readiness package.
 */
export * from "./types";
export * from "./quantum-readiness";
export * from "./quantum-preparation";
export * from "./quantum-recovery";
export * from "./openpra-quantum-preparation-artifacts";
export * from "./openpra-quantum-execution-artifacts";
export * from "./openpra-quantum-recovery-artifacts";
export * from "./openpra-quantum-recovery-rollup";
export * from "./openpra-quantum-recovery-batch-artifacts";
export * from "./openpra-quantum-recovery-filesystem";
export * from "./openpra-fault-tree-graph-adapter";
export * from "./openpra-fault-tree-graph-heuristics";
export * from "./openpra-fault-tree-readiness";
EOF

echo "==> Writing quantumReadiness.service.ts"
cat > "${SERVICE_PATH}" <<'EOF'
import { Injectable } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import {
  analyzeLikelyOpenPraFaultTreeGraphReadiness,
  buildOpenpraQuantumExecutionArtifactBundleFromRawCounts,
  buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport,
  buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot,
  buildOpenpraQuantumRecoveryFromCandidateDir,
  buildQuantumPreparationClQuboExport,
  buildQuantumPreparationExport,
  type OpenPraFaultTreeReadinessOptions,
  type OpenPraFaultTreeReadinessResult,
  type OpenpraQuantumExecutionArtifactBundle,
  type OpenpraQuantumExecutionProviderType,
  type OpenpraQuantumPreparationArtifactBundle,
  type OpenpraQuantumRecoveryBatchRollup,
  type OpenpraQuantumRecoveryBatchSelectionMode,
  type QuantumPreparationExport,
  type QuantumRecoveryLadderResult
} from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
import { adaptFaultTreeGraphInput } from "./openPraFaultTreeGraph.adapter";

export interface QuantumExecutionArtifactRawCountsRequest {
  modelId: string;
  subtreeId: string;
  sourcePreparationArtifactId: string;
  providerType: OpenpraQuantumExecutionProviderType;
  providerName: string;
  backendName: string;
  executionMode: string;
  shots: number;
  rawCounts: Record<string, number>;
  jobIdOrRunId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

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

  analyzeFaultTreeGraphPreparationArtifacts(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): OpenpraQuantumPreparationArtifactBundle {
    const readinessResult = analyzeGraphLikeInputToReadiness(graph, modelName, options);
    const clQuboExport = buildQuantumPreparationClQuboExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report
    );

    return buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(
      clQuboExport,
      {
        createdBy: "web-backend:quantumReadiness.service"
      }
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

  async analyzeFaultTreeGraphByIdPreparationArtifacts(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): Promise<OpenpraQuantumPreparationArtifactBundle> {
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
    const clQuboExport = buildQuantumPreparationClQuboExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report
    );

    return buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(
      clQuboExport,
      {
        createdBy: "web-backend:quantumReadiness.service"
      }
    );
  }

  buildExecutionArtifactsFromRawCounts(
    request: QuantumExecutionArtifactRawCountsRequest
  ): OpenpraQuantumExecutionArtifactBundle {
    return buildOpenpraQuantumExecutionArtifactBundleFromRawCounts(request, {
      createdBy: "web-backend:quantumReadiness.service"
    });
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
cat > "${CONTROLLER_PATH}" <<'EOF'
import { Body, Controller, HttpCode, HttpException, HttpStatus, Post } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import type {
  OpenPraFaultTreeReadinessOptions,
  OpenPraFaultTreeReadinessResult,
  OpenpraQuantumExecutionArtifactBundle,
  OpenpraQuantumPreparationArtifactBundle,
  OpenpraQuantumRecoveryBatchRollup,
  OpenpraQuantumRecoveryBatchSelectionMode,
  QuantumPreparationExport,
  QuantumRecoveryLadderResult
} from "quantum-readiness";

import {
  QuantumExecutionArtifactRawCountsRequest,
  QuantumReadinessService
} from "./quantumReadiness.service";

export interface QuantumReadinessGraphRequest {
  graph: FaultTreeGraph | Record<string, unknown>;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
}

export interface QuantumReadinessGraphByIdRequest {
  faultTreeId: string;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
}

export interface QuantumRecoveryCandidateDirRequest {
  candidateDir: string;
}

export interface QuantumRecoveryBatchRootRequest {
  batchRoot: string;
  candidateDirs?: string[];
  selectionMode?: OpenpraQuantumRecoveryBatchSelectionMode;
}

@Controller()
export class QuantumReadinessController {
  constructor(private readonly quantumReadinessService: QuantumReadinessService) {}

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

  @Post("/fault-tree-graph/preparation-artifacts")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraphPreparationArtifacts(
    @Body() body: QuantumReadinessGraphRequest
  ): OpenpraQuantumPreparationArtifactBundle {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraphPreparationArtifacts(
        body.graph,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

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

  @Post("/fault-tree-graph/by-id/preparation-artifacts")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphByIdPreparationArtifacts(
    @Body() body: QuantumReadinessGraphByIdRequest
  ): Promise<OpenpraQuantumPreparationArtifactBundle> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphByIdPreparationArtifacts(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/execution/artifacts/raw-counts")
  @HttpCode(HttpStatus.OK)
  buildExecutionArtifactsFromRawCounts(
    @Body() body: QuantumExecutionArtifactRawCountsRequest
  ): OpenpraQuantumExecutionArtifactBundle {
    try {
      return this.quantumReadinessService.buildExecutionArtifactsFromRawCounts(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

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
    body: QuantumReadinessGraphRequest | QuantumReadinessGraphByIdRequest
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

echo "==> Writing quantumReadiness.executionArtifacts.http.spec.ts"
cat > "${HTTP_SPEC_PATH}" <<'EOF'
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ExecutionArtifactHttpResponse {
  executionArtifact: {
    schemaVersion: string;
    artifactType: string;
    modelId: string;
    subtreeId: string;
    sourcePreparationArtifactId: string;
    providerType: string;
    providerName: string;
    backendName: string;
    executionMode: string;
    shots: number;
    rawCounts: Record<string, number>;
  };
  provenanceManifest: {
    artifactType: string;
    relatedArtifactIds: string[];
    acceptanceGateResults: {
      hasPreparationArtifactReference: boolean;
      hasRawCounts: boolean;
      shotsMatchRawCountsTotal: boolean;
    };
  };
}

describe("QuantumReadiness HTTP execution artifacts", () => {
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

  it("POST /api/quantum-readiness/execution/artifacts/raw-counts returns contract-shaped execution and provenance artifacts", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/execution/artifacts/raw-counts")
      .send({
        modelId: "phase2b_row_0001",
        subtreeId: "TOP",
        sourcePreparationArtifactId: "preparation:phase2b_row_0001:TOP:abc",
        providerType: "simulator",
        providerName: "qiskit-aer",
        backendName: "aer_simulator",
        executionMode: "counts_only",
        shots: 100,
        rawCounts: {
          "000": 10,
          "011": 30,
          "100": 60
        }
      })
      .expect(200);

    const body = response.body as ExecutionArtifactHttpResponse;

    expect(body.executionArtifact.schemaVersion).toBe("1.0.0");
    expect(body.executionArtifact.artifactType).toBe("execution");
    expect(body.executionArtifact.modelId).toBe("phase2b_row_0001");
    expect(body.executionArtifact.subtreeId).toBe("TOP");
    expect(body.executionArtifact.sourcePreparationArtifactId).toBe(
      "preparation:phase2b_row_0001:TOP:abc"
    );
    expect(body.executionArtifact.providerType).toBe("simulator");
    expect(body.executionArtifact.providerName).toBe("qiskit-aer");
    expect(body.executionArtifact.backendName).toBe("aer_simulator");
    expect(body.executionArtifact.executionMode).toBe("counts_only");
    expect(body.executionArtifact.shots).toBe(100);
    expect(body.executionArtifact.rawCounts).toEqual({
      "000": 10,
      "011": 30,
      "100": 60
    });

    expect(body.provenanceManifest.artifactType).toBe("provenance_manifest");
    expect(body.provenanceManifest.relatedArtifactIds).toContain(
      body.executionArtifact.artifactId
    );
    expect(body.provenanceManifest.relatedArtifactIds).toContain(
      "preparation:phase2b_row_0001:TOP:abc"
    );
    expect(body.provenanceManifest.acceptanceGateResults).toEqual({
      hasPreparationArtifactReference: true,
      hasRawCounts: true,
      shotsMatchRawCountsTotal: true
    });
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

echo "==> Capturing git status"
git status --short > "${REPORT_DIR}/git_status_short_after_execution_artifact_pass1.txt"

echo "DONE"
echo "Report directory: ${REPORT_DIR}"
echo "quantum-readiness test: $(cat "${REPORT_DIR}/nx_test_quantum_readiness.status")"
echo "web-backend test: $(cat "${REPORT_DIR}/nx_test_web_backend.status")"
echo "quantum-readiness build: $(cat "${REPORT_DIR}/nx_build_quantum_readiness.status")"
