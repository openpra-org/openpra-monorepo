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

REPORT_DIR="artifacts/quantum_integration/preparation_artifact_pass1_${UTC_NOW}"
BACKUP_DIR="_work/manual_preparation_artifact_pass1_backup_${UTC_NOW}"
mkdir -p "${REPORT_DIR}" "${BACKUP_DIR}"

backup_to_workdir() {
  local target="$1"
  if [[ -f "${target}" ]]; then
    mkdir -p "${BACKUP_DIR}/$(dirname "${target}")"
    cp -p "${target}" "${BACKUP_DIR}/${target}"
  fi
}

INDEX_PATH="packages/quantum-readiness/src/lib/index.ts"
ARTIFACT_PATH="packages/quantum-readiness/src/lib/openpra-quantum-preparation-artifacts.ts"
ARTIFACT_SPEC_PATH="packages/quantum-readiness/src/lib/openpra-quantum-preparation-artifacts.spec.ts"
SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_PATH="packages/web-backend/tests/quantumReadiness.preparationArtifacts.http.spec.ts"

backup_to_workdir "${INDEX_PATH}"
backup_to_workdir "${SERVICE_PATH}"
backup_to_workdir "${CONTROLLER_PATH}"

echo "==> Writing openpra-quantum-preparation-artifacts.ts"
cat > "${ARTIFACT_PATH}" <<'EOF'
import type {
  QuantumClQuboStatevectorVerificationPlan,
  QuantumPreparationClQuboCandidateExport,
  QuantumPreparationClQuboExport,
  QuantumReadinessRequirementsAssessment,
  QuantumReadinessTopologyClassification
} from "./types";

const SCHEMA_VERSION = "1.0.0";
const MODULE_VERSION = "openpra-quantum-preparation-artifacts-v1";

type CandidateWithRecipe = QuantumPreparationClQuboCandidateExport & {
  qaoaCircuitRecipe?: unknown;
};

export interface OpenpraQuantumPreparationArtifactBuildOptions {
  artifactId?: string;
  createdBy?: string;
  inputReferences?: string[];
  sourceHashes?: Record<string, string>;
  notes?: string[];
}

export interface OpenpraQuantumPreparationBackendEligibilityRow {
  platformId: string;
  platformLabel: string;
  publishedQubitCount: number;
  qubitFit: boolean;
  caveat: string;
}

export interface OpenpraQuantumPreparationArtifact {
  schemaVersion: string;
  artifactType: "preparation";
  artifactId: string;
  createdAtUtc: string;
  createdBy: string;
  inputReferences: string[];
  sourceHashes: Record<string, string>;
  notes: string[];

  modelId: string;
  modelName: string;
  sourceFormat: string;
  subtreeId: string;
  rootGateId: string;
  topologyClass: string;

  orderedBasicEventIds: string[];
  variableMap: QuantumPreparationClQuboCandidateExport["variableMapping"];
  clQuboEncoding: {
    exportSliceVersion: string;
    costMatrix: QuantumPreparationClQuboCandidateExport["costMatrix"];
    frozenMcsReference: QuantumPreparationClQuboCandidateExport["frozenMcsReference"];
    fullClQuboModel?: QuantumPreparationClQuboCandidateExport["fullClQuboModel"];
  };
  qaoaRecipe?: unknown;
  backendEligibility: OpenpraQuantumPreparationBackendEligibilityRow[];
  statevectorVerificationResult: QuantumClQuboStatevectorVerificationPlan;

  topologyClassification?: QuantumReadinessTopologyClassification;
  requirementsAssessment?: QuantumReadinessRequirementsAssessment;

  moduleVersion: string;
}

export interface OpenpraQuantumPreparationArtifactBundle {
  schemaVersion: string;
  artifactType: "preparation_bundle";
  artifactId: string;
  createdAtUtc: string;
  createdBy: string;
  inputReferences: string[];
  sourceHashes: Record<string, string>;
  notes: string[];

  modelId: string;
  modelName: string;
  sourceFormat: string;
  totalCandidateSubtrees: number;
  totalQuantumTractableCandidates: number;

  preparationArtifacts: OpenpraQuantumPreparationArtifact[];
}

export function buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(
  clQuboExport: QuantumPreparationClQuboExport,
  options: OpenpraQuantumPreparationArtifactBuildOptions = {}
): OpenpraQuantumPreparationArtifactBundle {
  const createdAtUtc = new Date().toISOString();
  const createdBy = options.createdBy ?? MODULE_VERSION;
  const bundleArtifactId =
    options.artifactId ?? buildBundleArtifactId(clQuboExport.modelId, createdAtUtc);

  return {
    schemaVersion: SCHEMA_VERSION,
    artifactType: "preparation_bundle",
    artifactId: bundleArtifactId,
    createdAtUtc,
    createdBy,
    inputReferences: [...(options.inputReferences ?? [])],
    sourceHashes: { ...(options.sourceHashes ?? {}) },
    notes: [...(options.notes ?? [])],

    modelId: clQuboExport.modelId,
    modelName: clQuboExport.modelName,
    sourceFormat: clQuboExport.sourceFormat,
    totalCandidateSubtrees: clQuboExport.totalCandidateSubtrees,
    totalQuantumTractableCandidates: clQuboExport.totalQuantumTractableCandidates,

    preparationArtifacts: clQuboExport.clQuboCandidates
      .map((candidate) =>
        buildOpenpraQuantumPreparationArtifactFromCandidate(
          candidate,
          createdAtUtc,
          createdBy,
          options
        )
      )
      .sort((left, right) => left.rootGateId.localeCompare(right.rootGateId))
  };
}

export function buildOpenpraQuantumPreparationArtifactFromCandidate(
  candidate: QuantumPreparationClQuboCandidateExport,
  createdAtUtc: string = new Date().toISOString(),
  createdBy: string = MODULE_VERSION,
  options: OpenpraQuantumPreparationArtifactBuildOptions = {}
): OpenpraQuantumPreparationArtifact {
  const typedCandidate = candidate as CandidateWithRecipe;

  return {
    schemaVersion: SCHEMA_VERSION,
    artifactType: "preparation",
    artifactId: buildCandidateArtifactId(
      candidate.modelId,
      candidate.candidateRootNodeId,
      createdAtUtc
    ),
    createdAtUtc,
    createdBy,
    inputReferences: [...(options.inputReferences ?? [])],
    sourceHashes: { ...(options.sourceHashes ?? {}) },
    notes: [...(options.notes ?? [])],

    modelId: candidate.modelId,
    modelName: candidate.modelName,
    sourceFormat: candidate.sourceFormat,
    subtreeId: candidate.candidateRootNodeId,
    rootGateId: candidate.candidateRootNodeId,
    topologyClass: candidate.topologyClassification?.topologyClass ?? "unclassified",

    orderedBasicEventIds: [...candidate.orderedBasicEventIds],
    variableMap: candidate.variableMapping.map((row) => ({ ...row })),
    clQuboEncoding: {
      exportSliceVersion: candidate.exportSliceVersion,
      costMatrix: {
        format: candidate.costMatrix.format,
        dimension: candidate.costMatrix.dimension,
        diagonalWeights: [...candidate.costMatrix.diagonalWeights],
        objective: candidate.costMatrix.objective
      },
      frozenMcsReference: {
        minimalCutSetCount: candidate.frozenMcsReference.minimalCutSetCount,
        basicEventIdSets: candidate.frozenMcsReference.basicEventIdSets.map((set) => [...set]),
        bitstrings: [...candidate.frozenMcsReference.bitstrings]
      },
      ...(candidate.fullClQuboModel
        ? {
            fullClQuboModel: {
              ...candidate.fullClQuboModel,
              vars: candidate.fullClQuboModel.vars.map((row) => ({ ...row })),
              qubo: {
                const: candidate.fullClQuboModel.qubo.const,
                lin: { ...candidate.fullClQuboModel.qubo.lin },
                quad: { ...candidate.fullClQuboModel.qubo.quad }
              },
              ising: {
                const: candidate.fullClQuboModel.ising.const,
                h: { ...candidate.fullClQuboModel.ising.h },
                J: { ...candidate.fullClQuboModel.ising.J }
              }
            }
          }
        : {})
    },
    ...(typedCandidate.qaoaCircuitRecipe
      ? {
          qaoaRecipe: typedCandidate.qaoaCircuitRecipe
        }
      : {}),
    backendEligibility: candidate.requirementsAssessment
      ? candidate.requirementsAssessment.hardwareCompatibility.map((row) => ({
          platformId: row.platformId,
          platformLabel: row.platformLabel,
          publishedQubitCount: row.publishedQubitCount,
          qubitFit: row.qubitFit,
          caveat: row.caveat
        }))
      : [],
    statevectorVerificationResult: {
      eligible: candidate.statevectorVerificationPlan.eligible,
      mode: candidate.statevectorVerificationPlan.mode,
      note: candidate.statevectorVerificationPlan.note
    },

    ...(candidate.topologyClassification
      ? {
          topologyClassification: {
            topologyClass: candidate.topologyClassification.topologyClass,
            classificationRuleVersion:
              candidate.topologyClassification.classificationRuleVersion,
            reasons: [...candidate.topologyClassification.reasons],
            rootChildNodeIds: [...candidate.topologyClassification.rootChildNodeIds],
            rootChildBasicEventCount:
              candidate.topologyClassification.rootChildBasicEventCount,
            rootChildAndGateCount:
              candidate.topologyClassification.rootChildAndGateCount,
            rootChildOrGateCount:
              candidate.topologyClassification.rootChildOrGateCount,
            rootChildOtherGateCount:
              candidate.topologyClassification.rootChildOtherGateCount
          }
        }
      : {}),
    ...(candidate.requirementsAssessment
      ? {
          requirementsAssessment: {
            requiredQubits: candidate.requirementsAssessment.requiredQubits,
            matrixEntryMatched: candidate.requirementsAssessment.matrixEntryMatched,
            ...(candidate.requirementsAssessment.matrixEntry
              ? {
                  matrixEntry: { ...candidate.requirementsAssessment.matrixEntry }
                }
              : {}),
            hardwareCompatibility:
              candidate.requirementsAssessment.hardwareCompatibility.map((row) => ({
                ...row
              })),
            preferredDepthP: candidate.requirementsAssessment.preferredDepthP,
            avoidRL1: candidate.requirementsAssessment.avoidRL1,
            preferredAlgorithm: candidate.requirementsAssessment.preferredAlgorithm,
            executionPriority: candidate.requirementsAssessment.executionPriority,
            guidanceNotes: [...candidate.requirementsAssessment.guidanceNotes]
          }
        }
      : {}),
    moduleVersion: candidate.moduleVersion
  };
}

function buildBundleArtifactId(modelId: string, createdAtUtc: string): string {
  return `preparation_bundle:${sanitizeToken(modelId)}:${sanitizeToken(createdAtUtc)}`;
}

function buildCandidateArtifactId(
  modelId: string,
  candidateRootNodeId: string,
  createdAtUtc: string
): string {
  return `preparation:${sanitizeToken(modelId)}:${sanitizeToken(
    candidateRootNodeId
  )}:${sanitizeToken(createdAtUtc)}`;
}

function sanitizeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
EOF

echo "==> Writing openpra-quantum-preparation-artifacts.spec.ts"
cat > "${ARTIFACT_SPEC_PATH}" <<'EOF'
import {
  buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport
} from "./openpra-quantum-preparation-artifacts";
import { buildQuantumPreparationClQuboExport } from "./quantum-preparation";
import { analyzeFaultTreeReadiness } from "./quantum-readiness";
import type { NormalizedFaultTree } from "./types";

describe("openpra-quantum-preparation-artifacts", () => {
  function buildProofTree(): NormalizedFaultTree {
    return {
      id: "prep-artifact-proof",
      name: "Preparation Artifact Proof Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G1", "E"]
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"]
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        E: { id: "E", kind: "basicEvent" }
      }
    };
  }

  it("wraps CL-QUBO preparation export into artifact-contract-shaped preparation artifacts", () => {
    const tree = buildProofTree();
    const report = analyzeFaultTreeReadiness(tree, {
      includeRequirementsMatrix: true
    });
    const clQuboExport = buildQuantumPreparationClQuboExport(tree, report);

    const bundle = buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(
      clQuboExport,
      {
        createdBy: "jest:test"
      }
    );

    expect(bundle.schemaVersion).toBe("1.0.0");
    expect(bundle.artifactType).toBe("preparation_bundle");
    expect(bundle.modelId).toBe("prep-artifact-proof");
    expect(bundle.totalQuantumTractableCandidates).toBe(2);
    expect(bundle.preparationArtifacts.map((row) => row.rootGateId)).toEqual([
      "G1",
      "TOP"
    ]);

    const top = bundle.preparationArtifacts.find((row) => row.rootGateId === "TOP");
    expect(top).toBeDefined();
    expect(top?.artifactType).toBe("preparation");
    expect(top?.subtreeId).toBe("TOP");
    expect(top?.clQuboEncoding.exportSliceVersion).toBe("phase4-bounded-clqubo-v1");
    expect(top?.orderedBasicEventIds).toEqual(["A", "B", "E"]);
    expect(top?.statevectorVerificationResult.eligible).toBe(true);
    expect(top?.backendEligibility.length).toBeGreaterThanOrEqual(0);
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
  buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport,
  buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot,
  buildOpenpraQuantumRecoveryFromCandidateDir,
  buildQuantumPreparationClQuboExport,
  buildQuantumPreparationExport,
  type OpenPraFaultTreeReadinessOptions,
  type OpenPraFaultTreeReadinessResult,
  type OpenpraQuantumPreparationArtifactBundle,
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
 * deterministic preparation export, artifact-wrapped preparation export,
 * and filesystem-backed recovery entrypoints.
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
  OpenpraQuantumPreparationArtifactBundle,
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
  graph: FaultTreeGraph | Record<string, unknown>;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
}

/**
 * Request body for quantum readiness analysis by stored faultTreeId.
 */
export interface QuantumReadinessGraphByIdRequest {
  faultTreeId: string;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
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

echo "==> Writing quantumReadiness.preparationArtifacts.http.spec.ts"
cat > "${HTTP_SPEC_PATH}" <<'EOF'
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import {
  cloneOpenPraFixture,
  openPraNormalizedCase1,
  openPraNormalizedCase2UnsupportedNot
} from "../src/quantumReadiness/openPraFaultTreeGraph.fixtures";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface PreparationArtifactBundleHttpResponse {
  schemaVersion: string;
  artifactType: string;
  modelId: string;
  totalCandidateSubtrees: number;
  totalQuantumTractableCandidates: number;
  preparationArtifacts: Array<{
    artifactType: string;
    rootGateId: string;
    subtreeId: string;
    orderedBasicEventIds: string[];
    topologyClass: string;
    clQuboEncoding: {
      exportSliceVersion: string;
    };
    statevectorVerificationResult: {
      eligible: boolean;
    };
  }>;
}

describe("QuantumReadiness HTTP preparation artifacts", () => {
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

  it("POST /api/quantum-readiness/fault-tree-graph/preparation-artifacts returns contract-shaped preparation artifacts", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/preparation-artifacts")
      .send({
        graph: cloneOpenPraFixture(openPraNormalizedCase1),
        modelName: "HTTP Preparation Artifact Graph"
      })
      .expect(200);

    const body = response.body as PreparationArtifactBundleHttpResponse;

    expect(body.schemaVersion).toBe("1.0.0");
    expect(body.artifactType).toBe("preparation_bundle");
    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.totalQuantumTractableCandidates).toBe(2);
    expect(body.preparationArtifacts.map((candidate) => candidate.rootGateId)).toEqual([
      "G1",
      "TOP"
    ]);

    const top = body.preparationArtifacts.find((candidate) => candidate.rootGateId === "TOP");
    expect(top?.artifactType).toBe("preparation");
    expect(top?.subtreeId).toBe("TOP");
    expect(top?.clQuboEncoding.exportSliceVersion).toBe("phase4-bounded-clqubo-v1");
    expect(top?.orderedBasicEventIds.length).toBeGreaterThan(0);
    expect(top?.statevectorVerificationResult.eligible).toBe(true);
  });

  it("POST /api/quantum-readiness/fault-tree-graph/by-id/preparation-artifacts returns stored contract-shaped preparation artifacts", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue(
      cloneOpenPraFixture(openPraNormalizedCase1)
    );

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/by-id/preparation-artifacts")
      .send({
        faultTreeId: "openpra_graph_case_1",
        modelName: "Stored HTTP Preparation Artifact Graph"
      })
      .expect(200);

    const body = response.body as PreparationArtifactBundleHttpResponse;

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith(
      "openpra_graph_case_1"
    );
    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.totalQuantumTractableCandidates).toBe(2);
    expect(body.preparationArtifacts.map((candidate) => candidate.rootGateId)).toEqual([
      "G1",
      "TOP"
    ]);
  });

  it("POST /api/quantum-readiness/fault-tree-graph/preparation-artifacts exports no candidates for unsupported NOT", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/preparation-artifacts")
      .send({
        graph: cloneOpenPraFixture(openPraNormalizedCase2UnsupportedNot),
        modelName: "HTTP Preparation Artifact Unsupported Graph"
      })
      .expect(200);

    const body = response.body as PreparationArtifactBundleHttpResponse;

    expect(body.modelId).toBe("openpra_graph_case_2");
    expect(body.totalCandidateSubtrees).toBe(1);
    expect(body.totalQuantumTractableCandidates).toBe(0);
    expect(body.preparationArtifacts).toEqual([]);
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
git status --short > "${REPORT_DIR}/git_status_short_after_preparation_artifact_pass1.txt"

echo "DONE"
echo "Report directory: ${REPORT_DIR}"
echo "quantum-readiness test: $(cat "${REPORT_DIR}/nx_test_quantum_readiness.status")"
echo "web-backend test: $(cat "${REPORT_DIR}/nx_test_web_backend.status")"
echo "quantum-readiness build: $(cat "${REPORT_DIR}/nx_build_quantum_readiness.status")"
