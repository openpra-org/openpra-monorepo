import fs from "node:fs";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import {
  analyzeLikelyOpenPraFaultTreeGraphReadiness,
  buildOpenPraQuantumBoundedImportanceServiceFacade,
  buildOpenPraQuantumExecutionRecordServiceStub,
  loadLatestOpenPraQuantumBoundedImportanceArtifacts,
  loadLatestOpenPraQuantumExecutionArtifacts,
  createOpenPraQuantumProviderExecutionRequest,
  getOpenPraQuantumCanonicalCasePackSummary,
  loadLatestOpenPraQuantumProviderExecutionRequest,
  persistOpenPraQuantumProviderExecutionRequest,
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
  type OpenPraQuantumBoundedImportanceArtifactLoadResult,
  type OpenPraQuantumExecutionArtifactLoadResult,
  type OpenPraQuantumCanonicalCasePackSummary,
  type OpenPraQuantumProviderExecutionRequestLoadResult,
  type OpenPraQuantumProviderExecutionRequestStoreResult,
  type CreateOpenPraQuantumProviderExecutionRequestParams,
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

export interface QuantumExecutionArtifactSimulatorRequest {
  modelId: string;
  subtreeId: string;
  sourcePreparationArtifactId?: string;
  preparationArtifactPath?: string;
  preparationArtifact?: OpenpraQuantumPreparationArtifact;
  shots: number;
  samplingMode?: OpenpraQuantumLocalSimulatorSamplingMode;
  providerName?: string;
  backendName?: string;
  executionMode?: string;
  jobIdOrRunId?: string;
  status?: string;
  parameterSource?: OpenpraQuantumLocalSimulatorParameterSource;
  beta?: number;
  gamma?: number;
  seed?: number;
  metadata?: Record<string, unknown>;
  notes?: string[];
}

export type QuantumExecutionWorkflowRequest =
  | QuantumExecutionArtifactRawCountsRequest
  | QuantumExecutionArtifactSimulatorRequest;

export interface QuantumRecoveryBatchRunInput {
  batchRoot: string;
  candidateDirs?: string[];
  selectionMode?: OpenpraQuantumRecoveryBatchSelectionMode;
}

export interface QuantumRecoveryArtifactWriteResult {
  outputDir: string;
  recoveryArtifactPath: string;
}

export interface QuantumRecoveryBatchRollupWriteResult {
  outputDir: string;
  recoveryBatchRollupPath: string;
}

export interface QuantumPreparationWorkflowRunResult {
  workflowRun: OpenpraQuantumWorkflowRunScaffoldResult;
  preparationWrite: OpenpraQuantumPreparationArtifactFilesystemWriteResult;
}

export interface QuantumExecutionWorkflowRunResult {
  workflowRun: OpenpraQuantumWorkflowRunScaffoldResult;
  executionWrite: OpenpraQuantumExecutionArtifactFilesystemWriteResult;
}

export interface QuantumRecoveryWorkflowRunResult {
  workflowRun: OpenpraQuantumWorkflowRunScaffoldResult;
  recoveryWrite: QuantumRecoveryArtifactWriteResult;
}

export interface QuantumRecoveryBatchWorkflowRunResult {
  workflowRun: OpenpraQuantumWorkflowRunScaffoldResult;
  batchWrite: QuantumRecoveryBatchRollupWriteResult;
}

export interface QuantumFullPipelineWorkflowRunResult {
  workflowRun: OpenpraQuantumWorkflowRunScaffoldResult;
  preparationWrite?: OpenpraQuantumPreparationArtifactFilesystemWriteResult;
  executionWrite?: OpenpraQuantumExecutionArtifactFilesystemWriteResult;
  recoveryWrite?: QuantumRecoveryArtifactWriteResult;
  batchWrite?: QuantumRecoveryBatchRollupWriteResult;
}

export interface QuantumWorkflowRunInspectionResult {
  workflowRunDir: string;
  manifestPath: string | null;
  directories: {
    artifacts: string | null;
    preparation: string | null;
    execution: string | null;
    recovery: string | null;
    batch: string | null;
    logs: string | null;
  };
  files: {
    preparationBundles: string[];
    preparationArtifacts: string[];
    executionArtifacts: string[];
    executionProvenance: string[];
    recoveryArtifacts: string[];
    recoveryBatchRollups: string[];
    logFiles: string[];
  };
}

export interface QuantumWorkflowRunListingEntry {
  workflowRunDir: string;
  workflowKind: string | null;
  createdAtUtc: string | null;
  manifestPath: string | null;
  modelId: string | null;
  subtreeId: string | null;
}

export interface QuantumWorkflowRunListingResult {
  rootDir: string;
  entries: QuantumWorkflowRunListingEntry[];
}

export interface QuantumLatestWorkflowRunResult {
  rootDir: string;
  latest: QuantumWorkflowRunListingEntry | null;
  inspection: QuantumWorkflowRunInspectionResult | null;
}

export interface QuantumLatestWorkflowRunByKindResult {
  rootDir: string;
  workflowKind: string;
  latest: QuantumWorkflowRunListingEntry | null;
  inspection: QuantumWorkflowRunInspectionResult | null;
}

export interface QuantumLatestWorkflowRunByTargetResult {
  rootDir: string;
  modelId: string;
  subtreeId: string;
  latest: QuantumWorkflowRunListingEntry | null;
  inspection: QuantumWorkflowRunInspectionResult | null;
}

export type QuantumBoundedImportanceServiceRequest = BuildOpenPraQuantumBoundedImportanceServiceFacadeParams;

export type QuantumExecutionRecordServiceStubRequest = BuildOpenPraQuantumExecutionRecordServiceStubParams;

export interface QuantumLoadLatestBoundedImportanceRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

export interface QuantumLoadLatestExecutionArtifactsRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

export interface QuantumBuildProviderExecutionRequest {
  rootDirectoryPath: string;
  executionRequest: CreateOpenPraQuantumProviderExecutionRequestParams;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export interface QuantumLoadLatestProviderExecutionRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

export interface QuantumImportanceComparisonRequest {
  modelId: string;
  subtreeId: string;
  measureName: string;
  quantumValues: Record<string, number>;
  classicalValues: Record<string, number>;
  tolerance?: number;
}

export interface QuantumImportanceComparisonResult {
  modelId: string;
  subtreeId: string;
  measureName: string;
  tolerance: number;
  counts: {
    quantumCount: number;
    classicalCount: number;
    commonCount: number;
    exactWithinToleranceCount: number;
  };
  missingInQuantum: string[];
  missingInClassical: string[];
  stats: {
    meanAbsoluteDifference: number | null;
    maxAbsoluteDifference: number | null;
    spearmanRho: number | null;
  };
}

export interface QuantumImportanceComparisonWriteResult {
  outputDir: string;
  importanceComparisonPath: string;
}

export interface QuantumImportanceComparisonWriteByTargetRequest extends QuantumImportanceComparisonRequest {
  rootDir: string;
}

export interface QuantumImportanceComparisonWriteByTargetResult {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonPath: string;
}

export interface QuantumImportanceComparisonWriteByKindRequest extends QuantumImportanceComparisonRequest {
  rootDir: string;
  workflowKind: string;
}

export interface QuantumImportanceComparisonWriteByKindResult {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonPath: string;
}

export interface QuantumImportanceComparisonWriteByWorkflowRunRequest extends QuantumImportanceComparisonRequest {
  workflowRunDir: string;
}

export interface QuantumImportanceComparisonWriteByWorkflowRunResult {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonPath: string;
}

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

export interface QuantumImportanceComparisonReportWriteByTargetRequest extends QuantumImportanceComparisonRequest {
  rootDir: string;
}

export interface QuantumImportanceComparisonReportWriteByTargetResult {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonReportPath: string;
}

export interface QuantumImportanceComparisonReportWriteByKindRequest extends QuantumImportanceComparisonRequest {
  rootDir: string;
  workflowKind: string;
}

export interface QuantumImportanceComparisonReportWriteByKindResult {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonReportPath: string;
}

export interface QuantumImportanceComparisonReportWriteByWorkflowRunRequest extends QuantumImportanceComparisonRequest {
  workflowRunDir: string;
}

export interface QuantumImportanceComparisonReportWriteByWorkflowRunResult {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonReportPath: string;
}

export interface QuantumWorkflowReleaseSummaryResult {
  workflowRunDir: string;
  manifestPath: string | null;
  directories: {
    preparation: string | null;
    execution: string | null;
    recovery: string | null;
    batch: string | null;
    logs: string | null;
  };
  counts: {
    preparationBundles: number;
    preparationArtifacts: number;
    executionArtifacts: number;
    executionProvenance: number;
    recoveryArtifacts: number;
    recoveryBatchRollups: number;
    importanceComparisons: number;
    importanceReports: number;
    logFiles: number;
  };
  readiness: {
    hasPreparation: boolean;
    hasExecution: boolean;
    hasRecovery: boolean;
    hasImportanceComparison: boolean;
    hasImportanceReport: boolean;
    releaseReady: boolean;
  };
}

export interface QuantumWorkflowReleaseSummaryWriteResult {
  outputDir: string;
  workflowReleaseSummaryPath: string;
}

export interface QuantumWorkflowReleaseManifestResult {
  workflowRunDir: string;
  manifestPath: string | null;
  releaseSummary: QuantumWorkflowReleaseSummaryResult;
  artifacts: {
    preparationBundles: string[];
    preparationArtifacts: string[];
    executionArtifacts: string[];
    executionProvenance: string[];
    recoveryArtifacts: string[];
    recoveryBatchRollups: string[];
    importanceComparisons: string[];
    importanceReports: string[];
    logFiles: string[];
  };
}

export interface QuantumWorkflowReleaseManifestWriteResult {
  outputDir: string;
  workflowReleaseManifestPath: string;
}

export interface QuantumWorkflowReleaseBundleWriteResult {
  outputDir: string;
  bundleDir: string;
  summaryPath: string;
  manifestCopyPath: string | null;
  releaseSummaryPath: string;
  releaseManifestPath: string;
}

export interface QuantumWorkflowReleaseBundleWriteByTargetRequest {
  rootDir: string;
  modelId: string;
  subtreeId: string;
  outputDir: string;
}

export interface QuantumWorkflowReleaseBundleWriteByTargetResult extends QuantumWorkflowReleaseBundleWriteResult {
  workflowRunDir: string;
}

export interface QuantumWorkflowReleaseBundleWriteByKindRequest {
  rootDir: string;
  workflowKind: string;
  outputDir: string;
}

export interface QuantumWorkflowReleaseBundleWriteByKindResult extends QuantumWorkflowReleaseBundleWriteResult {
  workflowRunDir: string;
}

export interface QuantumWorkflowHandoffAuditResult {
  workflowRunDir: string;
  status: "ready" | "not_ready";
  checks: {
    hasWorkflowManifest: boolean;
    hasPreparation: boolean;
    hasExecution: boolean;
    hasRecovery: boolean;
    hasImportanceComparison: boolean;
    hasImportanceReport: boolean;
    releaseReady: boolean;
  };
  missingArtifacts: string[];
  nextActions: string[];
  releaseSummary: QuantumWorkflowReleaseSummaryResult;
  releaseManifest: QuantumWorkflowReleaseManifestResult;
}

export interface QuantumWorkflowHandoffAuditWriteResult {
  outputDir: string;
  workflowHandoffAuditPath: string;
}

export interface QuantumReleaseHandoffBundleWriteResult {
  outputDir: string;
  bundleDir: string;
  workflowBundleDir: string;
  handoffAuditPath: string;
  releaseSummaryPath: string;
  releaseManifestPath: string;
  workflowManifestCopyPath: string | null;
}

@Injectable()
export class QuantumReadinessService {
  constructor(private readonly graphModelService: GraphModelService) {}

  createWorkflowRunScaffold(
    request: OpenpraQuantumWorkflowRunScaffoldRequest,
  ): OpenpraQuantumWorkflowRunScaffoldResult {
    return buildOpenpraQuantumWorkflowRunScaffold(request);
  }

  createPreparationWorkflowRun(
    rootDir: string,
    graph: FaultTreeGraph | Record<string, unknown>,
    modelId: string,
    subtreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): QuantumPreparationWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "preparation",
      requestedBy: "web-backend:quantumReadiness.service",
    });

    const preparationWrite = this.analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
      graph,
      workflowRun.directories.preparation,
      modelName,
      options,
    );

    return {
      workflowRun,
      preparationWrite,
    };
  }

  async createPreparationWorkflowRunById(
    rootDir: string,
    faultTreeId: string,
    subtreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): Promise<QuantumPreparationWorkflowRunResult> {
    const graph = (await this.graphModelService.getFaultTreeGraph(faultTreeId)) as
      | FaultTreeGraph
      | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    return this.createPreparationWorkflowRun(rootDir, converted, faultTreeId, subtreeId, modelName, options);
  }

  createExecutionWorkflowRun(
    rootDir: string,
    request: QuantumExecutionWorkflowRequest,
  ): QuantumExecutionWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId: request.modelId,
      subtreeId: request.subtreeId,
      workflowKind: "execution",
      requestedBy: "web-backend:quantumReadiness.service",
    });

    const executionWrite = this.buildExecutionArtifactsFromWorkflowRequestToFilesystem(
      request,
      workflowRun.directories.execution,
    );

    return {
      workflowRun,
      executionWrite,
    };
  }

  createRecoveryWorkflowRun(
    rootDir: string,
    candidateDir: string,
    modelId: string,
    subtreeId: string,
  ): QuantumRecoveryWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "recovery",
      requestedBy: "web-backend:quantumReadiness.service",
    });

    const recoveryWrite = this.analyzeRecoveryCandidateDirToFilesystem(candidateDir, workflowRun.directories.recovery);

    return {
      workflowRun,
      recoveryWrite,
    };
  }

  createRecoveryBatchWorkflowRun(
    rootDir: string,
    batchRoot: string,
    modelId: string,
    subtreeId: string,
    candidateDirs?: string[],
    selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only",
  ): QuantumRecoveryBatchWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "recovery_batch",
      requestedBy: "web-backend:quantumReadiness.service",
    });

    const batchWrite = this.analyzeRecoveryBatchRootToFilesystem(
      batchRoot,
      workflowRun.directories.batch,
      candidateDirs,
      selectionMode,
    );

    return {
      workflowRun,
      batchWrite,
    };
  }

  createFullPipelineWorkflowRun(
    rootDir: string,
    modelId: string,
    subtreeId: string,
    graph?: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
    executionRequest?: QuantumExecutionWorkflowRequest,
    recoveryCandidateDir?: string,
    recoveryBatch?: QuantumRecoveryBatchRunInput,
  ): QuantumFullPipelineWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "full_pipeline",
      requestedBy: "web-backend:quantumReadiness.service",
    });

    const result: QuantumFullPipelineWorkflowRunResult = {
      workflowRun,
    };

    if (graph) {
      result.preparationWrite = this.analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
        graph,
        workflowRun.directories.preparation,
        modelName,
        options,
      );
    }

    if (executionRequest) {
      result.executionWrite = this.buildExecutionArtifactsFromWorkflowRequestToFilesystem(
        executionRequest,
        workflowRun.directories.execution,
      );
    }

    if (recoveryCandidateDir) {
      result.recoveryWrite = this.analyzeRecoveryCandidateDirToFilesystem(
        recoveryCandidateDir,
        workflowRun.directories.recovery,
      );
    }

    if (recoveryBatch) {
      result.batchWrite = this.analyzeRecoveryBatchRootToFilesystem(
        recoveryBatch.batchRoot,
        workflowRun.directories.batch,
        recoveryBatch.candidateDirs,
        recoveryBatch.selectionMode ?? "package_result_only",
      );
    }

    return result;
  }

  async createFullPipelineWorkflowRunById(
    rootDir: string,
    faultTreeId: string,
    subtreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
    executionRequest?: QuantumExecutionWorkflowRequest,
    recoveryCandidateDir?: string,
    recoveryBatch?: QuantumRecoveryBatchRunInput,
  ): Promise<QuantumFullPipelineWorkflowRunResult> {
    const graph = (await this.graphModelService.getFaultTreeGraph(faultTreeId)) as
      | FaultTreeGraph
      | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    return this.createFullPipelineWorkflowRun(
      rootDir,
      faultTreeId,
      subtreeId,
      converted,
      modelName,
      options,
      executionRequest,
      recoveryCandidateDir,
      recoveryBatch,
    );
  }

  inspectWorkflowRun(workflowRunDir: string): QuantumWorkflowRunInspectionResult {
    const resolvedRunDir = path.resolve(workflowRunDir);

    if (!fs.existsSync(resolvedRunDir)) {
      throw new Error(`workflowRunDir does not exist: ${resolvedRunDir}`);
    }

    const artifactsDir = path.join(resolvedRunDir, "artifacts");
    const preparationDir = path.join(artifactsDir, "preparation");
    const executionDir = path.join(artifactsDir, "execution");
    const recoveryDir = path.join(artifactsDir, "recovery");
    const batchDir = path.join(artifactsDir, "batch");
    const logsDir = path.join(resolvedRunDir, "logs");
    const manifestPath = path.join(resolvedRunDir, "openpra_quantum_workflow_run_manifest_v1.json");

    return {
      workflowRunDir: resolvedRunDir,
      manifestPath: fs.existsSync(manifestPath) ? manifestPath : null,
      directories: {
        artifacts: fs.existsSync(artifactsDir) ? artifactsDir : null,
        preparation: fs.existsSync(preparationDir) ? preparationDir : null,
        execution: fs.existsSync(executionDir) ? executionDir : null,
        recovery: fs.existsSync(recoveryDir) ? recoveryDir : null,
        batch: fs.existsSync(batchDir) ? batchDir : null,
        logs: fs.existsSync(logsDir) ? logsDir : null,
      },
      files: {
        preparationBundles: listFilesMatching(preparationDir, /^openpra_quantum_preparation_bundle_v1\.json$/),
        preparationArtifacts: listFilesMatching(preparationDir, /^openpra_quantum_preparation_artifact_.*\.json$/),
        executionArtifacts: listFilesMatching(executionDir, /^openpra_quantum_execution_artifact_v1\.json$/),
        executionProvenance: listFilesMatching(
          executionDir,
          /^openpra_quantum_execution_provenance_manifest_v1\.json$/,
        ),
        recoveryArtifacts: listFilesMatching(recoveryDir, /^openpra_quantum_recovery_artifact_v1\.json$/),
        recoveryBatchRollups: listFilesMatching(batchDir, /^openpra_quantum_recovery_batch_rollup_v1\.json$/),
        logFiles: listAllFiles(logsDir),
      },
    };
  }

  listWorkflowRuns(rootDir: string): QuantumWorkflowRunListingResult {
    const resolvedRootDir = path.resolve(rootDir);

    if (!fs.existsSync(resolvedRootDir)) {
      throw new Error(`rootDir does not exist: ${resolvedRootDir}`);
    }

    const entries = fs
      .readdirSync(resolvedRootDir)
      .map((entry) => path.join(resolvedRootDir, entry))
      .filter((entryPath) => fs.statSync(entryPath).isDirectory())
      .filter((entryPath) => path.basename(entryPath).startsWith("openpra_quantum_"))
      .map((entryPath) => {
        const manifestPath = path.join(entryPath, "openpra_quantum_workflow_run_manifest_v1.json");

        let workflowKind: string | null = null;
        let createdAtUtc: string | null = null;
        let modelId: string | null = null;
        let subtreeId: string | null = null;

        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
            workflowKind?: string;
            createdAtUtc?: string;
            modelId?: string;
            subtreeId?: string;
          };
          workflowKind = manifest.workflowKind ?? null;
          createdAtUtc = manifest.createdAtUtc ?? null;
          modelId = manifest.modelId ?? null;
          subtreeId = manifest.subtreeId ?? null;
        }

        return {
          workflowRunDir: entryPath,
          workflowKind,
          createdAtUtc,
          manifestPath: fs.existsSync(manifestPath) ? manifestPath : null,
          modelId,
          subtreeId,
        };
      })
      .sort((a, b) => {
        const left = a.createdAtUtc ?? "";
        const right = b.createdAtUtc ?? "";
        return right.localeCompare(left);
      });

    return {
      rootDir: resolvedRootDir,
      entries,
    };
  }

  getLatestWorkflowRun(rootDir: string): QuantumLatestWorkflowRunResult {
    const listing = this.listWorkflowRuns(rootDir);
    const latest = listing.entries.length > 0 ? listing.entries[0] : null;

    return {
      rootDir: listing.rootDir,
      latest,
      inspection: latest ? this.inspectWorkflowRun(latest.workflowRunDir) : null,
    };
  }

  getLatestWorkflowRunByKind(rootDir: string, workflowKind: string): QuantumLatestWorkflowRunByKindResult {
    const listing = this.listWorkflowRuns(rootDir);
    const latest = listing.entries.find((entry) => entry.workflowKind === workflowKind) ?? null;

    return {
      rootDir: listing.rootDir,
      workflowKind,
      latest,
      inspection: latest ? this.inspectWorkflowRun(latest.workflowRunDir) : null,
    };
  }

  getLatestWorkflowRunByTarget(
    rootDir: string,
    modelId: string,
    subtreeId: string,
  ): QuantumLatestWorkflowRunByTargetResult {
    const listing = this.listWorkflowRuns(rootDir);
    const latest = listing.entries.find((entry) => entry.modelId === modelId && entry.subtreeId === subtreeId) ?? null;

    return {
      rootDir: listing.rootDir,
      modelId,
      subtreeId,
      latest,
      inspection: latest ? this.inspectWorkflowRun(latest.workflowRunDir) : null,
    };
  }

  buildBoundedImportanceServiceFacade(
    request: QuantumBoundedImportanceServiceRequest,
  ): OpenPraQuantumBoundedImportanceServiceFacadeResult {
    return buildOpenPraQuantumBoundedImportanceServiceFacade(request);
  }

  buildExecutionRecordServiceStub(
    request: QuantumExecutionRecordServiceStubRequest,
  ): OpenPraQuantumExecutionRecordServiceStubResult {
    return buildOpenPraQuantumExecutionRecordServiceStub(request);
  }

  loadLatestBoundedImportanceArtifacts(
    request: QuantumLoadLatestBoundedImportanceRequest,
  ): OpenPraQuantumBoundedImportanceArtifactLoadResult {
    return loadLatestOpenPraQuantumBoundedImportanceArtifacts(request);
  }

  loadLatestExecutionArtifacts(
    request: QuantumLoadLatestExecutionArtifactsRequest,
  ): OpenPraQuantumExecutionArtifactLoadResult {
    return loadLatestOpenPraQuantumExecutionArtifacts(request);
  }

  getCanonicalCasePackSummary(): OpenPraQuantumCanonicalCasePackSummary {
    return getOpenPraQuantumCanonicalCasePackSummary();
  }

  buildProviderExecutionRequest(
    request: QuantumBuildProviderExecutionRequest,
  ): OpenPraQuantumProviderExecutionRequestStoreResult {
    const executionRequest = createOpenPraQuantumProviderExecutionRequest(request.executionRequest);

    return persistOpenPraQuantumProviderExecutionRequest({
      rootDirectoryPath: request.rootDirectoryPath,
      request: executionRequest,
      inputArtifactPaths: request.inputArtifactPaths ?? [],
      scriptVersion: request.scriptVersion ?? "quantum-readiness.service.buildProviderExecutionRequest",
    });
  }

  loadLatestProviderExecutionRequest(
    request: QuantumLoadLatestProviderExecutionRequest,
  ): OpenPraQuantumProviderExecutionRequestLoadResult {
    return loadLatestOpenPraQuantumProviderExecutionRequest(request);
  }

  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {
    const tolerance = request.tolerance ?? 1e-9;

    assertNumericRecord("quantumValues", request.quantumValues);
    assertNumericRecord("classicalValues", request.classicalValues);

    const quantumIds = Object.keys(request.quantumValues).sort();
    const classicalIds = Object.keys(request.classicalValues).sort();

    const quantumSet = new Set(quantumIds);
    const classicalSet = new Set(classicalIds);

    const commonIds = quantumIds.filter((basicEventId) => classicalSet.has(basicEventId));
    const missingInQuantum = classicalIds.filter((basicEventId) => !quantumSet.has(basicEventId));
    const missingInClassical = quantumIds.filter((basicEventId) => !classicalSet.has(basicEventId));

    const differences = commonIds.map((basicEventId) =>
      Math.abs(request.quantumValues[basicEventId] - request.classicalValues[basicEventId]),
    );

    const quantumCommonValues = commonIds.map((basicEventId) => request.quantumValues[basicEventId]);
    const classicalCommonValues = commonIds.map((basicEventId) => request.classicalValues[basicEventId]);

    return {
      modelId: request.modelId,
      subtreeId: request.subtreeId,
      measureName: request.measureName,
      tolerance,
      counts: {
        quantumCount: quantumIds.length,
        classicalCount: classicalIds.length,
        commonCount: commonIds.length,
        exactWithinToleranceCount: differences.filter((difference) => difference <= tolerance).length,
      },
      missingInQuantum,
      missingInClassical,
      stats: {
        meanAbsoluteDifference:
          differences.length > 0 ? differences.reduce((sum, value) => sum + value, 0) / differences.length : null,
        maxAbsoluteDifference: differences.length > 0 ? Math.max(...differences) : null,
        spearmanRho: computeSpearmanRho(quantumCommonValues, classicalCommonValues),
      },
    };
  }

  compareImportanceMeasuresToLatestWorkflowRunByKind(
    request: QuantumImportanceComparisonWriteByKindRequest,
  ): QuantumImportanceComparisonWriteByKindResult {
    const latest = this.getLatestWorkflowRunByKind(request.rootDir, request.workflowKind);

    if (!latest.latest) {
      throw new Error(`No workflow run found for workflowKind ${request.workflowKind}.`);
    }

    const workflowRunDir = latest.latest.workflowRunDir;
    const outputDir = path.join(workflowRunDir, "artifacts", "recovery");

    const writeResult = this.compareImportanceMeasuresToFilesystem(
      {
        modelId: request.modelId,
        subtreeId: request.subtreeId,
        measureName: request.measureName,
        quantumValues: request.quantumValues,
        classicalValues: request.classicalValues,
        ...(request.tolerance !== undefined ? { tolerance: request.tolerance } : {}),
      },
      outputDir,
    );

    return {
      workflowRunDir,
      outputDir: writeResult.outputDir,
      importanceComparisonPath: writeResult.importanceComparisonPath,
    };
  }

  compareImportanceMeasuresToWorkflowRunDir(
    request: QuantumImportanceComparisonWriteByWorkflowRunRequest,
  ): QuantumImportanceComparisonWriteByWorkflowRunResult {
    if (!request.workflowRunDir || request.workflowRunDir.trim().length === 0) {
      throw new Error("workflowRunDir is required.");
    }

    const inspection = this.inspectWorkflowRun(request.workflowRunDir);
    const workflowRunDir = inspection.workflowRunDir;
    const outputDir = path.join(workflowRunDir, "artifacts", "recovery");

    const writeResult = this.compareImportanceMeasuresToFilesystem(
      {
        modelId: request.modelId,
        subtreeId: request.subtreeId,
        measureName: request.measureName,
        quantumValues: request.quantumValues,
        classicalValues: request.classicalValues,
        ...(request.tolerance !== undefined ? { tolerance: request.tolerance } : {}),
      },
      outputDir,
    );

    return {
      workflowRunDir,
      outputDir: writeResult.outputDir,
      importanceComparisonPath: writeResult.importanceComparisonPath,
    };
  }

  compareImportanceMeasuresToLatestWorkflowRunByTarget(
    request: QuantumImportanceComparisonWriteByTargetRequest,
  ): QuantumImportanceComparisonWriteByTargetResult {
    const latest = this.getLatestWorkflowRunByTarget(request.rootDir, request.modelId, request.subtreeId);

    if (!latest.latest) {
      throw new Error(`No workflow run found for modelId ${request.modelId} and subtreeId ${request.subtreeId}.`);
    }

    const workflowRunDir = latest.latest.workflowRunDir;
    const outputDir = path.join(workflowRunDir, "artifacts", "recovery");

    const writeResult = this.compareImportanceMeasuresToFilesystem(
      {
        modelId: request.modelId,
        subtreeId: request.subtreeId,
        measureName: request.measureName,
        quantumValues: request.quantumValues,
        classicalValues: request.classicalValues,
        ...(request.tolerance !== undefined ? { tolerance: request.tolerance } : {}),
      },
      outputDir,
    );

    return {
      workflowRunDir,
      outputDir: writeResult.outputDir,
      importanceComparisonPath: writeResult.importanceComparisonPath,
    };
  }

  buildImportanceComparisonReportToLatestWorkflowRunByTarget(
    request: QuantumImportanceComparisonReportWriteByTargetRequest,
  ): QuantumImportanceComparisonReportWriteByTargetResult {
    const latest = this.getLatestWorkflowRunByTarget(request.rootDir, request.modelId, request.subtreeId);

    if (!latest.latest) {
      throw new Error(`No workflow run found for modelId ${request.modelId} and subtreeId ${request.subtreeId}.`);
    }

    const workflowRunDir = latest.latest.workflowRunDir;
    const outputDir = path.join(workflowRunDir, "artifacts", "recovery");

    const writeResult = this.buildImportanceComparisonReportToFilesystem(
      {
        modelId: request.modelId,
        subtreeId: request.subtreeId,
        measureName: request.measureName,
        quantumValues: request.quantumValues,
        classicalValues: request.classicalValues,
        ...(request.tolerance !== undefined ? { tolerance: request.tolerance } : {}),
      },
      outputDir,
    );

    return {
      workflowRunDir,
      outputDir: writeResult.outputDir,
      importanceComparisonReportPath: writeResult.importanceComparisonReportPath,
    };
  }

  buildImportanceComparisonReportToLatestWorkflowRunByKind(
    request: QuantumImportanceComparisonReportWriteByKindRequest,
  ): QuantumImportanceComparisonReportWriteByKindResult {
    const latest = this.getLatestWorkflowRunByKind(request.rootDir, request.workflowKind);

    if (!latest.latest) {
      throw new Error(`No workflow run found for workflowKind ${request.workflowKind}.`);
    }

    const workflowRunDir = latest.latest.workflowRunDir;
    const outputDir = path.join(workflowRunDir, "artifacts", "recovery");

    const writeResult = this.buildImportanceComparisonReportToFilesystem(
      {
        modelId: request.modelId,
        subtreeId: request.subtreeId,
        measureName: request.measureName,
        quantumValues: request.quantumValues,
        classicalValues: request.classicalValues,
        ...(request.tolerance !== undefined ? { tolerance: request.tolerance } : {}),
      },
      outputDir,
    );

    return {
      workflowRunDir,
      outputDir: writeResult.outputDir,
      importanceComparisonReportPath: writeResult.importanceComparisonReportPath,
    };
  }

  buildImportanceComparisonReportToWorkflowRunDir(
    request: QuantumImportanceComparisonReportWriteByWorkflowRunRequest,
  ): QuantumImportanceComparisonReportWriteByWorkflowRunResult {
    if (!request.workflowRunDir || request.workflowRunDir.trim().length === 0) {
      throw new Error("workflowRunDir is required.");
    }

    const inspection = this.inspectWorkflowRun(request.workflowRunDir);
    const workflowRunDir = inspection.workflowRunDir;
    const outputDir = path.join(workflowRunDir, "artifacts", "recovery");

    const writeResult = this.buildImportanceComparisonReportToFilesystem(
      {
        modelId: request.modelId,
        subtreeId: request.subtreeId,
        measureName: request.measureName,
        quantumValues: request.quantumValues,
        classicalValues: request.classicalValues,
        ...(request.tolerance !== undefined ? { tolerance: request.tolerance } : {}),
      },
      outputDir,
    );

    return {
      workflowRunDir,
      outputDir: writeResult.outputDir,
      importanceComparisonReportPath: writeResult.importanceComparisonReportPath,
    };
  }

  buildImportanceComparisonReport(
    request: QuantumImportanceComparisonRequest,
  ): QuantumImportanceComparisonReportResult {
    const comparison = this.compareImportanceMeasures(request);

    const quantumIds = Object.keys(request.quantumValues).sort();
    const classicalIds = Object.keys(request.classicalValues).sort();
    const allIds = [...new Set([...quantumIds, ...classicalIds])].sort();

    const quantumRanks = rankDescending(quantumIds.map((basicEventId) => request.quantumValues[basicEventId]));
    const classicalRanks = rankDescending(classicalIds.map((basicEventId) => request.classicalValues[basicEventId]));

    const quantumRankMap = new Map<string, number>(
      quantumIds.map((basicEventId, index) => [basicEventId, quantumRanks[index]]),
    );
    const classicalRankMap = new Map<string, number>(
      classicalIds.map((basicEventId, index) => [basicEventId, classicalRanks[index]]),
    );

    const entries = allIds
      .map((basicEventId) => {
        const quantumPresent = Object.prototype.hasOwnProperty.call(request.quantumValues, basicEventId);
        const classicalPresent = Object.prototype.hasOwnProperty.call(request.classicalValues, basicEventId);

        const quantumValue = quantumPresent ? request.quantumValues[basicEventId] : null;
        const classicalValue = classicalPresent ? request.classicalValues[basicEventId] : null;

        const absoluteDifference =
          quantumPresent && classicalPresent ?
            Math.abs(request.quantumValues[basicEventId] - request.classicalValues[basicEventId])
          : null;

        const quantumRank = quantumPresent ? (quantumRankMap.get(basicEventId) ?? null) : null;
        const classicalRank = classicalPresent ? (classicalRankMap.get(basicEventId) ?? null) : null;

        return {
          basicEventId,
          quantumValue,
          classicalValue,
          absoluteDifference,
          quantumRank,
          classicalRank,
          rankDelta: quantumRank !== null && classicalRank !== null ? quantumRank - classicalRank : null,
          status:
            quantumPresent && classicalPresent ? "common"
            : quantumPresent ? "missing_in_classical"
            : "missing_in_quantum",
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
        exactWithinToleranceCount: comparison.counts.exactWithinToleranceCount,
      },
      stats: comparison.stats,
      topDisagreements: entries.filter((entry) => entry.status === "common").slice(0, 10),
      entries,
    };
  }

  buildImportanceComparisonReportToFilesystem(
    request: QuantumImportanceComparisonRequest,
    outputDir: string,
  ): QuantumImportanceComparisonReportWriteResult {
    const result = this.buildImportanceComparisonReport(request);
    const resolvedOutputDir = path.resolve(outputDir);
    const importanceComparisonReportPath = path.join(
      resolvedOutputDir,
      "openpra_quantum_importance_comparison_report_v1.json",
    );

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(importanceComparisonReportPath, JSON.stringify(result, null, 2) + "\n", "utf8");

    return {
      outputDir: resolvedOutputDir,
      importanceComparisonReportPath,
    };
  }

  compareImportanceMeasuresToFilesystem(
    request: QuantumImportanceComparisonRequest,
    outputDir: string,
  ): QuantumImportanceComparisonWriteResult {
    const result = this.compareImportanceMeasures(request);
    const resolvedOutputDir = path.resolve(outputDir);
    const importanceComparisonPath = path.join(resolvedOutputDir, "openpra_quantum_importance_comparison_v1.json");

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(importanceComparisonPath, JSON.stringify(result, null, 2) + "\n", "utf8");

    return {
      outputDir: resolvedOutputDir,
      importanceComparisonPath,
    };
  }

  buildWorkflowReleaseSummary(workflowRunDir: string): QuantumWorkflowReleaseSummaryResult {
    const inspection = this.inspectWorkflowRun(workflowRunDir);
    const recoveryDir = inspection.directories.recovery;
    const importanceComparisons =
      recoveryDir !== null ?
        listFilesMatching(recoveryDir, /^openpra_quantum_importance_comparison_v1\.json$/).length
      : 0;
    const importanceReports =
      recoveryDir !== null ?
        listFilesMatching(recoveryDir, /^openpra_quantum_importance_comparison_report_v1\.json$/).length
      : 0;

    const counts = {
      preparationBundles: inspection.files.preparationBundles.length,
      preparationArtifacts: inspection.files.preparationArtifacts.length,
      executionArtifacts: inspection.files.executionArtifacts.length,
      executionProvenance: inspection.files.executionProvenance.length,
      recoveryArtifacts: inspection.files.recoveryArtifacts.length,
      recoveryBatchRollups: inspection.files.recoveryBatchRollups.length,
      importanceComparisons,
      importanceReports,
      logFiles: inspection.files.logFiles.length,
    };

    const readiness = {
      hasPreparation: counts.preparationBundles > 0,
      hasExecution: counts.executionArtifacts > 0 && counts.executionProvenance > 0,
      hasRecovery: counts.recoveryArtifacts > 0 || counts.recoveryBatchRollups > 0,
      hasImportanceComparison: counts.importanceComparisons > 0,
      hasImportanceReport: counts.importanceReports > 0,
      releaseReady:
        counts.preparationBundles > 0 &&
        counts.executionArtifacts > 0 &&
        counts.executionProvenance > 0 &&
        (counts.recoveryArtifacts > 0 || counts.recoveryBatchRollups > 0) &&
        counts.importanceComparisons > 0 &&
        counts.importanceReports > 0,
    };

    return {
      workflowRunDir: inspection.workflowRunDir,
      manifestPath: inspection.manifestPath,
      directories: {
        preparation: inspection.directories.preparation,
        execution: inspection.directories.execution,
        recovery: inspection.directories.recovery,
        batch: inspection.directories.batch,
        logs: inspection.directories.logs,
      },
      counts,
      readiness,
    };
  }

  buildWorkflowReleaseManifest(workflowRunDir: string): QuantumWorkflowReleaseManifestResult {
    const inspection = this.inspectWorkflowRun(workflowRunDir);
    const releaseSummary = this.buildWorkflowReleaseSummary(workflowRunDir);
    const recoveryDir = inspection.directories.recovery;

    return {
      workflowRunDir: inspection.workflowRunDir,
      manifestPath: inspection.manifestPath,
      releaseSummary,
      artifacts: {
        preparationBundles: inspection.files.preparationBundles,
        preparationArtifacts: inspection.files.preparationArtifacts,
        executionArtifacts: inspection.files.executionArtifacts,
        executionProvenance: inspection.files.executionProvenance,
        recoveryArtifacts: inspection.files.recoveryArtifacts,
        recoveryBatchRollups: inspection.files.recoveryBatchRollups,
        importanceComparisons:
          recoveryDir !== null ?
            listFilesMatching(recoveryDir, /^openpra_quantum_importance_comparison_v1\.json$/)
          : [],
        importanceReports:
          recoveryDir !== null ?
            listFilesMatching(recoveryDir, /^openpra_quantum_importance_comparison_report_v1\.json$/)
          : [],
        logFiles: inspection.files.logFiles,
      },
    };
  }

  buildWorkflowHandoffAudit(workflowRunDir: string): QuantumWorkflowHandoffAuditResult {
    const releaseSummary = this.buildWorkflowReleaseSummary(workflowRunDir);
    const releaseManifest = this.buildWorkflowReleaseManifest(workflowRunDir);

    const checks = {
      hasWorkflowManifest: releaseManifest.manifestPath !== null,
      hasPreparation: releaseSummary.readiness.hasPreparation,
      hasExecution: releaseSummary.readiness.hasExecution,
      hasRecovery: releaseSummary.readiness.hasRecovery,
      hasImportanceComparison: releaseSummary.readiness.hasImportanceComparison,
      hasImportanceReport: releaseSummary.readiness.hasImportanceReport,
      releaseReady: releaseSummary.readiness.releaseReady,
    };

    const missingArtifacts: string[] = [];

    if (!checks.hasWorkflowManifest) {
      missingArtifacts.push("openpra_quantum_workflow_run_manifest_v1.json");
    }
    if (!checks.hasPreparation) {
      missingArtifacts.push("openpra_quantum_preparation_bundle_v1.json");
    }
    if (!checks.hasExecution) {
      missingArtifacts.push("execution artifact and provenance manifest");
    }
    if (!checks.hasRecovery) {
      missingArtifacts.push("recovery artifact or recovery batch rollup");
    }
    if (!checks.hasImportanceComparison) {
      missingArtifacts.push("openpra_quantum_importance_comparison_v1.json");
    }
    if (!checks.hasImportanceReport) {
      missingArtifacts.push("openpra_quantum_importance_comparison_report_v1.json");
    }

    const nextActions =
      missingArtifacts.length === 0 ?
        ["Ready for handoff, review, and merge readiness assessment."]
      : missingArtifacts.map((artifact) => `Add or regenerate ${artifact}.`);

    return {
      workflowRunDir: releaseSummary.workflowRunDir,
      status: checks.releaseReady ? "ready" : "not_ready",
      checks,
      missingArtifacts,
      nextActions,
      releaseSummary,
      releaseManifest,
    };
  }

  buildReleaseHandoffBundleToFilesystem(
    workflowRunDir: string,
    outputDir: string,
  ): QuantumReleaseHandoffBundleWriteResult {
    const workflowBundle = this.buildWorkflowReleaseBundleToFilesystem(workflowRunDir, outputDir);
    const handoffAudit = this.buildWorkflowHandoffAuditToFilesystem(workflowRunDir, outputDir);

    const resolvedOutputDir = path.resolve(outputDir);
    const bundleDir = path.join(resolvedOutputDir, "openpra_quantum_release_handoff_bundle_v1");
    fs.mkdirSync(bundleDir, { recursive: true });

    const releaseSummaryPath = path.join(bundleDir, "openpra_quantum_workflow_release_summary_v1.json");
    const releaseManifestPath = path.join(bundleDir, "openpra_quantum_workflow_release_manifest_v1.json");
    const handoffAuditPath = path.join(bundleDir, "openpra_quantum_workflow_handoff_audit_v1.json");

    fs.copyFileSync(workflowBundle.releaseSummaryPath, releaseSummaryPath);
    fs.copyFileSync(workflowBundle.releaseManifestPath, releaseManifestPath);
    fs.copyFileSync(handoffAudit.workflowHandoffAuditPath, handoffAuditPath);

    let workflowManifestCopyPath: string | null = null;
    if (workflowBundle.manifestCopyPath) {
      workflowManifestCopyPath = path.join(bundleDir, "openpra_quantum_workflow_run_manifest_v1.json");
      fs.copyFileSync(workflowBundle.manifestCopyPath, workflowManifestCopyPath);
    }

    return {
      outputDir: resolvedOutputDir,
      bundleDir,
      workflowBundleDir: workflowBundle.bundleDir,
      handoffAuditPath,
      releaseSummaryPath,
      releaseManifestPath,
      workflowManifestCopyPath,
    };
  }

  buildWorkflowHandoffAuditToFilesystem(
    workflowRunDir: string,
    outputDir: string,
  ): QuantumWorkflowHandoffAuditWriteResult {
    const result = this.buildWorkflowHandoffAudit(workflowRunDir);
    const resolvedOutputDir = path.resolve(outputDir);
    const workflowHandoffAuditPath = path.join(resolvedOutputDir, "openpra_quantum_workflow_handoff_audit_v1.json");

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(workflowHandoffAuditPath, JSON.stringify(result, null, 2) + "\n", "utf8");

    return {
      outputDir: resolvedOutputDir,
      workflowHandoffAuditPath,
    };
  }

  buildWorkflowReleaseBundleToLatestWorkflowRunByTarget(
    request: QuantumWorkflowReleaseBundleWriteByTargetRequest,
  ): QuantumWorkflowReleaseBundleWriteByTargetResult {
    const latest = this.getLatestWorkflowRunByTarget(request.rootDir, request.modelId, request.subtreeId);

    if (!latest.latest) {
      throw new Error(`No workflow run found for modelId ${request.modelId} and subtreeId ${request.subtreeId}.`);
    }

    const workflowRunDir = latest.latest.workflowRunDir;
    const writeResult = this.buildWorkflowReleaseBundleToFilesystem(workflowRunDir, request.outputDir);

    return {
      workflowRunDir,
      ...writeResult,
    };
  }

  buildWorkflowReleaseBundleToLatestWorkflowRunByKind(
    request: QuantumWorkflowReleaseBundleWriteByKindRequest,
  ): QuantumWorkflowReleaseBundleWriteByKindResult {
    const latest = this.getLatestWorkflowRunByKind(request.rootDir, request.workflowKind);

    if (!latest.latest) {
      throw new Error(`No workflow run found for workflowKind ${request.workflowKind}.`);
    }

    const workflowRunDir = latest.latest.workflowRunDir;
    const writeResult = this.buildWorkflowReleaseBundleToFilesystem(workflowRunDir, request.outputDir);

    return {
      workflowRunDir,
      ...writeResult,
    };
  }

  buildWorkflowReleaseBundleToFilesystem(
    workflowRunDir: string,
    outputDir: string,
  ): QuantumWorkflowReleaseBundleWriteResult {
    const inspection = this.inspectWorkflowRun(workflowRunDir);
    const summaryWrite = this.buildWorkflowReleaseSummaryToFilesystem(workflowRunDir, outputDir);
    const manifestWrite = this.buildWorkflowReleaseManifestToFilesystem(workflowRunDir, outputDir);

    const resolvedOutputDir = path.resolve(outputDir);
    const bundleDir = path.join(resolvedOutputDir, "openpra_quantum_release_bundle_v1");
    fs.mkdirSync(bundleDir, { recursive: true });

    const releaseSummaryPath = path.join(bundleDir, "openpra_quantum_workflow_release_summary_v1.json");
    const releaseManifestPath = path.join(bundleDir, "openpra_quantum_workflow_release_manifest_v1.json");

    fs.copyFileSync(summaryWrite.workflowReleaseSummaryPath, releaseSummaryPath);
    fs.copyFileSync(manifestWrite.workflowReleaseManifestPath, releaseManifestPath);

    let manifestCopyPath: string | null = null;

    if (inspection.manifestPath) {
      manifestCopyPath = path.join(bundleDir, "openpra_quantum_workflow_run_manifest_v1.json");
      fs.copyFileSync(inspection.manifestPath, manifestCopyPath);
    }

    return {
      outputDir: resolvedOutputDir,
      bundleDir,
      summaryPath: summaryWrite.workflowReleaseSummaryPath,
      manifestCopyPath,
      releaseSummaryPath,
      releaseManifestPath,
    };
  }

  buildWorkflowReleaseManifestToFilesystem(
    workflowRunDir: string,
    outputDir: string,
  ): QuantumWorkflowReleaseManifestWriteResult {
    const result = this.buildWorkflowReleaseManifest(workflowRunDir);
    const resolvedOutputDir = path.resolve(outputDir);
    const workflowReleaseManifestPath = path.join(
      resolvedOutputDir,
      "openpra_quantum_workflow_release_manifest_v1.json",
    );

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(workflowReleaseManifestPath, JSON.stringify(result, null, 2) + "\n", "utf8");

    return {
      outputDir: resolvedOutputDir,
      workflowReleaseManifestPath,
    };
  }

  buildWorkflowReleaseSummaryToFilesystem(
    workflowRunDir: string,
    outputDir: string,
  ): QuantumWorkflowReleaseSummaryWriteResult {
    const result = this.buildWorkflowReleaseSummary(workflowRunDir);
    const resolvedOutputDir = path.resolve(outputDir);
    const workflowReleaseSummaryPath = path.join(resolvedOutputDir, "openpra_quantum_workflow_release_summary_v1.json");

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(workflowReleaseSummaryPath, JSON.stringify(result, null, 2) + "\n", "utf8");

    return {
      outputDir: resolvedOutputDir,
      workflowReleaseSummaryPath,
    };
  }

  analyzeFaultTreeGraph(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): OpenPraFaultTreeReadinessResult {
    return analyzeGraphLikeInputToReadiness(graph, modelName, options);
  }

  analyzeFaultTreeGraphPreparation(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): QuantumPreparationExport {
    const readinessResult = analyzeGraphLikeInputToReadiness(graph, modelName, options);

    return buildQuantumPreparationExport(readinessResult.normalizedFaultTree, readinessResult.report);
  }

  analyzeFaultTreeGraphPreparationArtifacts(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): OpenpraQuantumPreparationArtifactBundle {
    const readinessResult = analyzeGraphLikeInputToReadiness(graph, modelName, options);
    const clQuboExport = buildQuantumPreparationClQuboExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report,
    );

    return buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(clQuboExport, {
      createdBy: "web-backend:quantumReadiness.service",
    });
  }

  analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
    graph: FaultTreeGraph | Record<string, unknown>,
    outputDir: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): OpenpraQuantumPreparationArtifactFilesystemWriteResult {
    const bundle = this.analyzeFaultTreeGraphPreparationArtifacts(graph, modelName, options);

    return writeOpenpraQuantumPreparationArtifactBundleToFilesystem(bundle, outputDir);
  }

  async analyzeFaultTreeGraphById(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): Promise<OpenPraFaultTreeReadinessResult> {
    const graph = (await this.graphModelService.getFaultTreeGraph(faultTreeId)) as
      | FaultTreeGraph
      | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    return analyzeGraphLikeInputToReadiness(converted, modelName, options);
  }

  async analyzeFaultTreeGraphByIdPreparation(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): Promise<QuantumPreparationExport> {
    const graph = (await this.graphModelService.getFaultTreeGraph(faultTreeId)) as
      | FaultTreeGraph
      | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    const readinessResult = analyzeGraphLikeInputToReadiness(converted, modelName, options);

    return buildQuantumPreparationExport(readinessResult.normalizedFaultTree, readinessResult.report);
  }

  async analyzeFaultTreeGraphByIdPreparationArtifacts(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): Promise<OpenpraQuantumPreparationArtifactBundle> {
    const graph = (await this.graphModelService.getFaultTreeGraph(faultTreeId)) as
      | FaultTreeGraph
      | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    const readinessResult = analyzeGraphLikeInputToReadiness(converted, modelName, options);
    const clQuboExport = buildQuantumPreparationClQuboExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report,
    );

    return buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(clQuboExport, {
      createdBy: "web-backend:quantumReadiness.service",
    });
  }

  buildExecutionArtifactsFromRawCounts(
    request: QuantumExecutionArtifactRawCountsRequest,
  ): OpenpraQuantumExecutionArtifactBundle {
    return buildOpenpraQuantumExecutionArtifactBundleFromRawCounts(request, {
      createdBy: "web-backend:quantumReadiness.service",
    });
  }

  buildExecutionArtifactsFromRawCountsToFilesystem(
    request: QuantumExecutionArtifactRawCountsRequest,
    outputDir: string,
  ): OpenpraQuantumExecutionArtifactFilesystemWriteResult {
    const bundle = this.buildExecutionArtifactsFromRawCounts(request);

    return writeOpenpraQuantumExecutionArtifactBundleToFilesystem(bundle, outputDir);
  }

  buildExecutionArtifactsFromSimulator(
    request: QuantumExecutionArtifactSimulatorRequest,
  ): OpenpraQuantumExecutionArtifactBundle {
    const preparationArtifact = this.resolvePreparationArtifactForSimulator(request);

    const simulatorResult = buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator({
      preparationArtifact,
      shots: request.shots,
      ...(request.samplingMode ? { samplingMode: request.samplingMode } : {}),
      ...(request.providerName ? { providerName: request.providerName } : {}),
      ...(request.backendName ? { backendName: request.backendName } : {}),
      ...(request.executionMode ? { executionMode: request.executionMode } : {}),
      ...(request.jobIdOrRunId ? { jobIdOrRunId: request.jobIdOrRunId } : {}),
      ...(request.status ? { status: request.status } : {}),
      ...(request.parameterSource ? { parameterSource: request.parameterSource } : {}),
      ...(request.beta !== undefined ? { beta: request.beta } : {}),
      ...(request.gamma !== undefined ? { gamma: request.gamma } : {}),
      ...(request.seed !== undefined ? { seed: request.seed } : {}),
      ...(request.metadata ? { metadata: request.metadata } : {}),
      ...(request.notes ? { notes: request.notes } : {}),
    });

    return this.buildExecutionArtifactsFromRawCounts(simulatorResult.executionInput);
  }

  buildExecutionArtifactsFromSimulatorToFilesystem(
    request: QuantumExecutionArtifactSimulatorRequest,
    outputDir: string,
  ): OpenpraQuantumExecutionArtifactFilesystemWriteResult {
    const bundle = this.buildExecutionArtifactsFromSimulator(request);

    return writeOpenpraQuantumExecutionArtifactBundleToFilesystem(bundle, outputDir);
  }

  buildExecutionArtifactsFromWorkflowRequest(
    request: QuantumExecutionWorkflowRequest,
  ): OpenpraQuantumExecutionArtifactBundle {
    return isQuantumExecutionArtifactRawCountsRequest(request) ?
        this.buildExecutionArtifactsFromRawCounts(request)
      : this.buildExecutionArtifactsFromSimulator(request);
  }

  buildExecutionArtifactsFromWorkflowRequestToFilesystem(
    request: QuantumExecutionWorkflowRequest,
    outputDir: string,
  ): OpenpraQuantumExecutionArtifactFilesystemWriteResult {
    return isQuantumExecutionArtifactRawCountsRequest(request) ?
        this.buildExecutionArtifactsFromRawCountsToFilesystem(request, outputDir)
      : this.buildExecutionArtifactsFromSimulatorToFilesystem(request, outputDir);
  }

  private resolvePreparationArtifactForSimulator(
    request: QuantumExecutionArtifactSimulatorRequest,
  ): OpenpraQuantumPreparationArtifact {
    if (request.preparationArtifact) {
      assertPreparationArtifactMatchesExecutionTarget(
        request.preparationArtifact,
        request.modelId,
        request.subtreeId,
        request.sourcePreparationArtifactId,
      );

      return request.preparationArtifact;
    }

    if (!request.preparationArtifactPath || request.preparationArtifactPath.trim().length === 0) {
      throw new Error("Simulator execution request requires preparationArtifact or preparationArtifactPath.");
    }

    const resolvedArtifactPath = path.resolve(request.preparationArtifactPath);

    if (!fs.existsSync(resolvedArtifactPath)) {
      throw new Error(`preparationArtifactPath does not exist: ${resolvedArtifactPath}`);
    }

    const parsed = JSON.parse(fs.readFileSync(resolvedArtifactPath, "utf8")) as OpenpraQuantumPreparationArtifact;

    assertPreparationArtifactMatchesExecutionTarget(
      parsed,
      request.modelId,
      request.subtreeId,
      request.sourcePreparationArtifactId,
    );

    return parsed;
  }

  analyzeRecoveryCandidateDir(candidateDir: string): QuantumRecoveryLadderResult {
    return buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir);
  }

  analyzeRecoveryCandidateDirToFilesystem(candidateDir: string, outputDir: string): QuantumRecoveryArtifactWriteResult {
    const result = this.analyzeRecoveryCandidateDir(candidateDir);
    const resolvedOutputDir = path.resolve(outputDir);
    const recoveryArtifactPath = path.join(resolvedOutputDir, "openpra_quantum_recovery_artifact_v1.json");

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(recoveryArtifactPath, JSON.stringify(result, null, 2) + "\n", "utf8");

    return {
      outputDir: resolvedOutputDir,
      recoveryArtifactPath,
    };
  }

  analyzeRecoveryBatchRoot(
    batchRoot: string,
    candidateDirs?: string[],
    selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only",
  ): OpenpraQuantumRecoveryBatchRollup {
    return buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot(batchRoot, candidateDirs, selectionMode);
  }

  analyzeRecoveryBatchRootToFilesystem(
    batchRoot: string,
    outputDir: string,
    candidateDirs?: string[],
    selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only",
  ): QuantumRecoveryBatchRollupWriteResult {
    const rollup = this.analyzeRecoveryBatchRoot(batchRoot, candidateDirs, selectionMode);
    const resolvedOutputDir = path.resolve(outputDir);
    const recoveryBatchRollupPath = path.join(resolvedOutputDir, "openpra_quantum_recovery_batch_rollup_v1.json");

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(recoveryBatchRollupPath, JSON.stringify(rollup, null, 2) + "\n", "utf8");

    return {
      outputDir: resolvedOutputDir,
      recoveryBatchRollupPath,
    };
  }
}

function isQuantumExecutionArtifactRawCountsRequest(
  request: QuantumExecutionWorkflowRequest,
): request is QuantumExecutionArtifactRawCountsRequest {
  return Object.prototype.hasOwnProperty.call(request, "rawCounts");
}

function assertPreparationArtifactMatchesExecutionTarget(
  preparationArtifact: OpenpraQuantumPreparationArtifact,
  modelId: string,
  subtreeId: string,
  sourcePreparationArtifactId?: string,
): void {
  if (!preparationArtifact || preparationArtifact.artifactType !== "preparation") {
    throw new Error("Simulator execution request requires a preparation artifact.");
  }

  if (preparationArtifact.modelId !== modelId) {
    throw new Error(
      `Preparation artifact modelId ${preparationArtifact.modelId} does not match execution request modelId ${modelId}.`,
    );
  }

  if (preparationArtifact.subtreeId !== subtreeId) {
    throw new Error(
      `Preparation artifact subtreeId ${preparationArtifact.subtreeId} does not match execution request subtreeId ${subtreeId}.`,
    );
  }

  if (sourcePreparationArtifactId && preparationArtifact.artifactId !== sourcePreparationArtifactId) {
    throw new Error(
      `Preparation artifact artifactId ${preparationArtifact.artifactId} does not match sourcePreparationArtifactId ${sourcePreparationArtifactId}.`,
    );
  }
}

function assertNumericRecord(name: string, values: Record<string, number>): void {
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) {
      throw new Error(`${name} contains a non-finite value for key ${key}.`);
    }
  }
}

function computeSpearmanRho(left: number[], right: number[]): number | null {
  if (left.length !== right.length) {
    throw new Error("Spearman inputs must have equal length.");
  }

  if (left.length < 2) {
    return null;
  }

  const leftRanks = rankDescending(left);
  const rightRanks = rankDescending(right);

  const leftMean = leftRanks.reduce((sum, value) => sum + value, 0) / leftRanks.length;
  const rightMean = rightRanks.reduce((sum, value) => sum + value, 0) / rightRanks.length;

  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < leftRanks.length; index += 1) {
    const leftCentered = leftRanks[index] - leftMean;
    const rightCentered = rightRanks[index] - rightMean;
    numerator += leftCentered * rightCentered;
    leftVariance += leftCentered * leftCentered;
    rightVariance += rightCentered * rightCentered;
  }

  const denominator = Math.sqrt(leftVariance * rightVariance);

  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function rankDescending(values: number[]): number[] {
  const uniqueDescending = [...new Set(values)].sort((a, b) => b - a);
  const rankByValue = new Map<number, number>();

  uniqueDescending.forEach((value, index) => {
    rankByValue.set(value, index + 1);
  });

  return values.map((value) => {
    const rank = rankByValue.get(value);

    if (rank === undefined) {
      throw new Error("Unable to compute rank.");
    }

    return rank;
  });
}

function analyzeGraphLikeInputToReadiness(
  graph: FaultTreeGraph | Record<string, unknown>,
  modelName?: string,
  options: OpenPraFaultTreeReadinessOptions = {},
): OpenPraFaultTreeReadinessResult {
  const converted = adaptFaultTreeGraphInput(graph);

  return analyzeLikelyOpenPraFaultTreeGraphReadiness(
    {
      faultTreeId: converted.faultTreeId,
      modelName,
      nodes: converted.nodes,
      edges: converted.edges,
    },
    options,
  );
}

function listFilesMatching(dirPath: string, pattern: RegExp): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((entry) => pattern.test(entry))
    .map((entry) => path.join(dirPath, entry))
    .sort();
}

function listAllFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .map((entry) => path.join(dirPath, entry))
    .filter((entryPath) => fs.statSync(entryPath).isFile())
    .sort();
}
