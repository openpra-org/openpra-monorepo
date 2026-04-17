#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")


def read_text(rel: str) -> str:
    return (REPO_ROOT / rel).read_text(encoding="utf-8")


def write_text(rel: str, text: str) -> None:
    (REPO_ROOT / rel).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Could not find expected block for {label}.")
    return text.replace(old, new, 1)


def insert_before(text: str, marker: str, block: str, label: str) -> str:
    if marker not in text:
        raise RuntimeError(f"Could not find marker for {label}.")
    return text.replace(marker, block + marker, 1)


def insert_before_last(text: str, marker: str, block: str, label: str) -> str:
    idx = text.rfind(marker)
    if idx == -1:
        raise RuntimeError(f"Could not find final marker for {label}.")
    return text[:idx] + block + text[idx:]


def main() -> None:
    # -------------------------------------------------------------------------
    # 1) Rewrite index.ts with full current export surface plus WS5/WS6 exports.
    # -------------------------------------------------------------------------
    index_ts = """/**
 * Public exports for the quantum-readiness package.
 */
export * from "./types";
export * from "./quantum-readiness";
export * from "./quantum-preparation";
export * from "./quantum-recovery";
export * from "./openpra-quantum-workflow-run-scaffold";
export * from "./openpra-quantum-artifact-filesystem";
export * from "./openpra-quantum-preparation-artifacts";
export * from "./openpra-quantum-execution-artifacts";
export * from "./openpra-quantum-recovery-artifacts";
export * from "./openpra-quantum-recovery-rollup";
export * from "./openpra-quantum-recovery-batch-artifacts";
export * from "./openpra-quantum-recovery-filesystem";
export * from "./openpra-fault-tree-graph-adapter";
export * from "./openpra-fault-tree-graph-heuristics";
export * from "./openpra-fault-tree-readiness";
export * from "./openpra-quantum-simulator-provider";
export * from "./openpra-quantum-bounded-importance-contract";
export * from "./openpra-quantum-bounded-importance-parity-harness";
export * from "./openpra-quantum-bounded-importance-artifact-store";
export * from "./openpra-quantum-bounded-importance-service-stub";
export * from "./openpra-quantum-bounded-importance-service-facade";
export * from "./openpra-quantum-execution-bridge-contract";
export * from "./openpra-quantum-execution-artifact-store";
export * from "./openpra-quantum-execution-record-service-stub";
"""
    write_text("packages/quantum-readiness/src/lib/index.ts", index_ts)

    # -------------------------------------------------------------------------
    # 2) Update quantumReadiness.service.ts
    # -------------------------------------------------------------------------
    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = replace_once(
        service_text,
        """  buildOpenpraQuantumExecutionArtifactBundleFromRawCounts,
  buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator,
  buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport,
  buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot,
  buildOpenpraQuantumRecoveryFromCandidateDir,
  buildOpenpraQuantumWorkflowRunScaffold,
  buildQuantumPreparationClQuboExport,
  buildQuantumPreparationExport,
  writeOpenpraQuantumExecutionArtifactBundleToFilesystem,
  writeOpenpraQuantumPreparationArtifactBundleToFilesystem,
  type OpenPraFaultTreeReadinessOptions,
  type OpenPraFaultTreeReadinessResult,
  type OpenpraQuantumExecutionArtifactBundle,
  type OpenpraQuantumExecutionArtifactFilesystemWriteResult,
  type OpenpraQuantumExecutionProviderType,
  type OpenpraQuantumLocalSimulatorParameterSource,
  type OpenpraQuantumLocalSimulatorSamplingMode,
  type OpenpraQuantumPreparationArtifact,
  type OpenpraQuantumPreparationArtifactBundle,
  type OpenpraQuantumPreparationArtifactFilesystemWriteResult,
  type OpenpraQuantumRecoveryBatchRollup,
  type OpenpraQuantumRecoveryBatchSelectionMode,
  type OpenpraQuantumWorkflowRunScaffoldRequest,
  type OpenpraQuantumWorkflowRunScaffoldResult,
  type QuantumPreparationExport,
  type QuantumRecoveryLadderResult,
} from "quantum-readiness";
""",
        """  buildOpenPraQuantumBoundedImportanceServiceFacade,
  buildOpenPraQuantumExecutionRecordServiceStub,
  buildOpenpraQuantumExecutionArtifactBundleFromRawCounts,
  buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator,
  buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport,
  buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot,
  buildOpenpraQuantumRecoveryFromCandidateDir,
  buildOpenpraQuantumWorkflowRunScaffold,
  buildQuantumPreparationClQuboExport,
  buildQuantumPreparationExport,
  writeOpenpraQuantumExecutionArtifactBundleToFilesystem,
  writeOpenpraQuantumPreparationArtifactBundleToFilesystem,
  type BuildOpenPraQuantumBoundedImportanceServiceFacadeParams,
  type BuildOpenPraQuantumExecutionRecordServiceStubParams,
  type OpenPraFaultTreeReadinessOptions,
  type OpenPraFaultTreeReadinessResult,
  type OpenPraQuantumBoundedImportanceServiceFacadeResult,
  type OpenPraQuantumExecutionRecordServiceStubResult,
  type OpenpraQuantumExecutionArtifactBundle,
  type OpenpraQuantumExecutionArtifactFilesystemWriteResult,
  type OpenpraQuantumExecutionProviderType,
  type OpenpraQuantumLocalSimulatorParameterSource,
  type OpenpraQuantumLocalSimulatorSamplingMode,
  type OpenpraQuantumPreparationArtifact,
  type OpenpraQuantumPreparationArtifactBundle,
  type OpenpraQuantumPreparationArtifactFilesystemWriteResult,
  type OpenpraQuantumRecoveryBatchRollup,
  type OpenpraQuantumRecoveryBatchSelectionMode,
  type OpenpraQuantumWorkflowRunScaffoldRequest,
  type OpenpraQuantumWorkflowRunScaffoldResult,
  type QuantumPreparationExport,
  type QuantumRecoveryLadderResult,
} from "quantum-readiness";
""",
        "service import block",
    )

    service_text = insert_before(
        service_text,
        """export interface QuantumImportanceComparisonRequest {
""",
        """export type QuantumBoundedImportanceServiceRequest =
  BuildOpenPraQuantumBoundedImportanceServiceFacadeParams;

export type QuantumExecutionRecordServiceStubRequest =
  BuildOpenPraQuantumExecutionRecordServiceStubParams;

""",
        "service request type aliases",
    )

    service_text = insert_before(
        service_text,
        """  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {
""",
        """  buildBoundedImportanceServiceFacade(
    request: QuantumBoundedImportanceServiceRequest,
  ): OpenPraQuantumBoundedImportanceServiceFacadeResult {
    return buildOpenPraQuantumBoundedImportanceServiceFacade(request);
  }

  buildExecutionRecordServiceStub(
    request: QuantumExecutionRecordServiceStubRequest,
  ): OpenPraQuantumExecutionRecordServiceStubResult {
    return buildOpenPraQuantumExecutionRecordServiceStub(request);
  }

""",
        "service methods",
    )

    write_text(service_rel, service_text)

    # -------------------------------------------------------------------------
    # 3) Update quantumReadiness.controller.ts
    # -------------------------------------------------------------------------
    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = replace_once(
        controller_text,
        """import type {
  OpenPraFaultTreeReadinessOptions,
  OpenPraFaultTreeReadinessResult,
  OpenpraQuantumExecutionArtifactBundle,
  OpenpraQuantumExecutionArtifactFilesystemWriteResult,
  OpenpraQuantumPreparationArtifactBundle,
  OpenpraQuantumPreparationArtifactFilesystemWriteResult,
  OpenpraQuantumRecoveryBatchRollup,
  OpenpraQuantumRecoveryBatchSelectionMode,
  OpenpraQuantumWorkflowRunScaffoldResult,
  QuantumPreparationExport,
  QuantumRecoveryLadderResult,
} from "quantum-readiness";
""",
        """import type {
  OpenPraFaultTreeReadinessOptions,
  OpenPraFaultTreeReadinessResult,
  OpenPraQuantumBoundedImportanceServiceFacadeResult,
  OpenPraQuantumExecutionRecordServiceStubResult,
  OpenpraQuantumExecutionArtifactBundle,
  OpenpraQuantumExecutionArtifactFilesystemWriteResult,
  OpenpraQuantumPreparationArtifactBundle,
  OpenpraQuantumPreparationArtifactFilesystemWriteResult,
  OpenpraQuantumRecoveryBatchRollup,
  OpenpraQuantumRecoveryBatchSelectionMode,
  OpenpraQuantumWorkflowRunScaffoldResult,
  QuantumPreparationExport,
  QuantumRecoveryLadderResult,
} from "quantum-readiness";
""",
        "controller quantum-readiness import block",
    )

    controller_text = replace_once(
        controller_text,
        """  type QuantumExecutionWorkflowRunResult,
  type QuantumFullPipelineWorkflowRunResult,
""",
        """  type QuantumBoundedImportanceServiceRequest,
  type QuantumExecutionRecordServiceStubRequest,
  type QuantumExecutionWorkflowRunResult,
  type QuantumFullPipelineWorkflowRunResult,
""",
        "controller service import block",
    )

    controller_text = insert_before(
        controller_text,
        """export interface QuantumRecoveryCandidateDirRequest {
""",
        """export interface QuantumBoundedImportanceServiceRequestBody
  extends QuantumBoundedImportanceServiceRequest {}

export interface QuantumExecutionRecordServiceStubRequestBody
  extends QuantumExecutionRecordServiceStubRequest {}

""",
        "controller request bodies",
    )

    controller_text = insert_before(
        controller_text,
        """  @Post("/importance/compare/write/by-kind")
""",
        """  @Post("/importance/bounded")
  @HttpCode(HttpStatus.OK)
  buildBoundedImportanceServiceFacade(
    @Body() body: QuantumBoundedImportanceServiceRequestBody,
  ): OpenPraQuantumBoundedImportanceServiceFacadeResult {
    try {
      return this.quantumReadinessService.buildBoundedImportanceServiceFacade(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/execution/record-stub")
  @HttpCode(HttpStatus.OK)
  buildExecutionRecordServiceStub(
    @Body() body: QuantumExecutionRecordServiceStubRequestBody,
  ): OpenPraQuantumExecutionRecordServiceStubResult {
    try {
      return this.quantumReadinessService.buildExecutionRecordServiceStub(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller methods",
    )

    write_text(controller_rel, controller_text)

    # -------------------------------------------------------------------------
    # 4) Update quantumReadiness.service.spec.ts
    # -------------------------------------------------------------------------
    service_spec_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.spec.ts"
    service_spec_text = read_text(service_spec_rel)

    service_spec_text = replace_once(
        service_spec_text,
        """import type { FaultTreeGraph } from "shared-types";

import { GraphModelService } from "../graphModels/graphModel.service";
""",
        """import type { FaultTreeGraph } from "shared-types";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
""",
        "service spec import block",
    )

    service_tests_block = """
  it("builds bounded importance service facade outputs to filesystem", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-service-"));
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

    const result = service.buildBoundedImportanceServiceFacade({
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
    });

    expect(result.stubResult.parityAgainstExpected?.allChecksPass).toBe(true);
    expect(fs.existsSync(result.persistedArtifacts.responsePath)).toBe(true);
    expect(fs.existsSync(result.persistedArtifacts.provenanceManifestPath)).toBe(true);
  });

  it("builds execution record service stub outputs to filesystem", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-service-"));

    const result = service.buildExecutionRecordServiceStub({
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
      scriptVersion: "quantum-readiness.service.spec",
    });

    expect(result.executionRecord.jobId).toBe("job-0698");
    expect(result.executionResult?.status).toBe("completed");
    expect(fs.existsSync(result.persistedArtifacts.recordPath)).toBe(true);
    expect(fs.existsSync(result.persistedArtifacts.provenanceManifestPath)).toBe(true);
  });

"""
    service_spec_text = insert_before(
        service_spec_text,
        """  it("throws when no stored graph nodes are found", async () => {
""",
        service_tests_block,
        "service spec tests",
    )

    write_text(service_spec_rel, service_spec_text)

    # -------------------------------------------------------------------------
    # 5) Update quantumReadiness.controller.spec.ts
    # -------------------------------------------------------------------------
    controller_spec_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.spec.ts"
    controller_spec_text = read_text(controller_spec_rel)

    controller_spec_text = replace_once(
        controller_spec_text,
        """import type { FaultTreeGraph } from "shared-types";

import { GraphModelService } from "../graphModels/graphModel.service";
""",
        """import type { FaultTreeGraph } from "shared-types";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
""",
        "controller spec import block",
    )

    controller_tests_block = """
  it("builds bounded importance service facade outputs through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-controller-"));
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

    const result = controller.buildBoundedImportanceServiceFacade({
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
    });

    expect(result.stubResult.parityAgainstExpected?.allChecksPass).toBe(true);
    expect(fs.existsSync(result.persistedArtifacts.responsePath)).toBe(true);
    expect(fs.existsSync(result.persistedArtifacts.provenanceManifestPath)).toBe(true);
  });

  it("builds execution record service stub outputs through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-controller-"));

    const result = controller.buildExecutionRecordServiceStub({
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
      scriptVersion: "quantumReadiness.controller.spec",
    });

    expect(result.executionRecord.jobId).toBe("job-0698");
    expect(result.executionResult?.status).toBe("completed");
    expect(fs.existsSync(result.persistedArtifacts.recordPath)).toBe(true);
    expect(fs.existsSync(result.persistedArtifacts.provenanceManifestPath)).toBe(true);
  });

"""
    controller_spec_text = insert_before_last(
        controller_spec_text,
        "\n});",
        controller_tests_block,
        "controller spec tests",
    )

    write_text(controller_spec_rel, controller_spec_text)

    print("Applied WS5/WS6 backend wiring chunk B successfully.")


if __name__ == "__main__":
    main()
