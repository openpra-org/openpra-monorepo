import { Body, Controller, HttpCode, HttpException, HttpStatus, Post } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import type {
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

import {
  QuantumExecutionArtifactRawCountsRequest,
  type QuantumExecutionArtifactSimulatorRequest,
  type QuantumExecutionWorkflowRequest,
  QuantumReadinessService,
  type QuantumBoundedImportanceServiceRequest,
  type QuantumExecutionRecordServiceStubRequest,
  type QuantumExecutionWorkflowRunResult,
  type QuantumFullPipelineWorkflowRunResult,
  type QuantumImportanceComparisonReportResult,
  type QuantumImportanceComparisonReportWriteByKindRequest,
  type QuantumImportanceComparisonReportWriteByKindResult,
  type QuantumImportanceComparisonReportWriteByTargetRequest,
  type QuantumImportanceComparisonReportWriteByTargetResult,
  type QuantumImportanceComparisonReportWriteByWorkflowRunRequest,
  type QuantumImportanceComparisonReportWriteByWorkflowRunResult,
  type QuantumImportanceComparisonReportWriteResult,
  type QuantumImportanceComparisonRequest,
  type QuantumImportanceComparisonResult,
  type QuantumImportanceComparisonWriteByKindRequest,
  type QuantumImportanceComparisonWriteByKindResult,
  type QuantumImportanceComparisonWriteByTargetRequest,
  type QuantumImportanceComparisonWriteByTargetResult,
  type QuantumImportanceComparisonWriteByWorkflowRunRequest,
  type QuantumImportanceComparisonWriteByWorkflowRunResult,
  type QuantumImportanceComparisonWriteResult,
  type QuantumLatestWorkflowRunByKindResult,
  type QuantumLatestWorkflowRunByTargetResult,
  type QuantumLatestWorkflowRunResult,
  type QuantumPreparationWorkflowRunResult,
  type QuantumRecoveryArtifactWriteResult,
  type QuantumRecoveryBatchRunInput,
  type QuantumRecoveryBatchRollupWriteResult,
  type QuantumRecoveryBatchWorkflowRunResult,
  type QuantumRecoveryWorkflowRunResult,
  type QuantumWorkflowReleaseSummaryResult,
  type QuantumWorkflowReleaseSummaryWriteResult,
  type QuantumWorkflowReleaseManifestResult,
  type QuantumWorkflowReleaseManifestWriteResult,
  type QuantumWorkflowReleaseBundleWriteResult,
  type QuantumWorkflowReleaseBundleWriteByTargetRequest,
  type QuantumWorkflowReleaseBundleWriteByTargetResult,
  type QuantumWorkflowReleaseBundleWriteByKindRequest,
  type QuantumWorkflowReleaseBundleWriteByKindResult,
  type QuantumWorkflowRunInspectionResult,
  type QuantumWorkflowRunListingResult,
  type QuantumWorkflowHandoffAuditResult,
  type QuantumWorkflowHandoffAuditWriteResult,
  type QuantumReleaseHandoffBundleWriteResult,
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

export interface QuantumPreparationArtifactsWriteRequest extends QuantumReadinessGraphRequest {
  outputDir: string;
}

export interface QuantumPreparationWorkflowRunRequest extends QuantumReadinessGraphRequest {
  rootDir: string;
  modelId: string;
  subtreeId: string;
}

export interface QuantumPreparationWorkflowByIdRequest {
  rootDir: string;
  faultTreeId: string;
  subtreeId: string;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
}

export interface QuantumExecutionArtifactRawCountsWriteRequest extends QuantumExecutionArtifactRawCountsRequest {
  outputDir: string;
}

export interface QuantumExecutionRawCountsRequestBody extends QuantumExecutionArtifactRawCountsRequest {
  inputMode?: "raw_counts";
}

export interface QuantumExecutionSimulatorRequestBody extends QuantumExecutionArtifactSimulatorRequest {
  inputMode: "simulator_local";
}

export type QuantumExecutionRequestBody = QuantumExecutionRawCountsRequestBody | QuantumExecutionSimulatorRequestBody;

export interface QuantumExecutionWorkflowRunRawCountsRequest extends QuantumExecutionRawCountsRequestBody {
  rootDir: string;
}

export interface QuantumExecutionWorkflowRunSimulatorRequest extends QuantumExecutionSimulatorRequestBody {
  rootDir: string;
}

export type QuantumExecutionWorkflowRunRequest =
  | QuantumExecutionWorkflowRunRawCountsRequest
  | QuantumExecutionWorkflowRunSimulatorRequest;

export interface QuantumRecoveryWorkflowRunRequest {
  rootDir: string;
  candidateDir: string;
  modelId: string;
  subtreeId: string;
}

export interface QuantumRecoveryBatchWorkflowRunRequest {
  rootDir: string;
  batchRoot: string;
  modelId: string;
  subtreeId: string;
  candidateDirs?: string[];
  selectionMode?: OpenpraQuantumRecoveryBatchSelectionMode;
}

export interface QuantumFullPipelineWorkflowRunRequest {
  rootDir: string;
  modelId: string;
  subtreeId: string;
  graph?: FaultTreeGraph | Record<string, unknown>;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
  executionRequest?: QuantumExecutionRequestBody;
  recoveryCandidateDir?: string;
  recoveryBatch?: QuantumRecoveryBatchRunInput;
}

export interface QuantumFullPipelineWorkflowByIdRequest {
  rootDir: string;
  faultTreeId: string;
  subtreeId: string;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
  executionRequest?: QuantumExecutionRequestBody;
  recoveryCandidateDir?: string;
  recoveryBatch?: QuantumRecoveryBatchRunInput;
}

export interface QuantumWorkflowRunInspectionRequest {
  workflowRunDir: string;
}

export interface QuantumWorkflowRunListingRequest {
  rootDir: string;
}

export interface QuantumLatestWorkflowRunRequest {
  rootDir: string;
}

export interface QuantumLatestWorkflowRunByKindRequest {
  rootDir: string;
  workflowKind: string;
}

export interface QuantumLatestWorkflowRunByTargetRequest {
  rootDir: string;
  modelId: string;
  subtreeId: string;
}

export interface QuantumBoundedImportanceServiceRequestBody extends QuantumBoundedImportanceServiceRequest {}

export interface QuantumExecutionRecordServiceStubRequestBody extends QuantumExecutionRecordServiceStubRequest {}

export interface QuantumRecoveryCandidateDirRequest {
  candidateDir: string;
}

export interface QuantumRecoveryCandidateDirWriteRequest {
  candidateDir: string;
  outputDir: string;
}

export interface QuantumRecoveryBatchRootRequest {
  batchRoot: string;
  candidateDirs?: string[];
  selectionMode?: OpenpraQuantumRecoveryBatchSelectionMode;
}

export interface QuantumRecoveryBatchRootWriteRequest extends QuantumRecoveryBatchRootRequest {
  outputDir: string;
}

export interface QuantumWorkflowRunScaffoldRequest {
  rootDir: string;
  modelId: string;
  subtreeId: string;
  workflowKind: "preparation" | "execution" | "recovery" | "recovery_batch" | "full_pipeline";
  requestedBy?: string;
  notes?: string[];
  createdAtUtc?: string;
}

export interface QuantumImportanceComparisonWriteRequest extends QuantumImportanceComparisonRequest {
  outputDir: string;
}

export interface QuantumImportanceComparisonWriteByTargetRequestBody
  extends QuantumImportanceComparisonWriteByTargetRequest {}

export interface QuantumImportanceComparisonWriteByKindRequestBody
  extends QuantumImportanceComparisonWriteByKindRequest {}

export interface QuantumImportanceComparisonWriteByWorkflowRunRequestBody
  extends QuantumImportanceComparisonWriteByWorkflowRunRequest {}

export interface QuantumImportanceComparisonReportWriteRequest extends QuantumImportanceComparisonRequest {
  outputDir: string;
}

export interface QuantumImportanceComparisonReportWriteByTargetRequestBody
  extends QuantumImportanceComparisonReportWriteByTargetRequest {}

export interface QuantumImportanceComparisonReportWriteByKindRequestBody
  extends QuantumImportanceComparisonReportWriteByKindRequest {}

export interface QuantumImportanceComparisonReportWriteByWorkflowRunRequestBody
  extends QuantumImportanceComparisonReportWriteByWorkflowRunRequest {}

export interface QuantumWorkflowReleaseSummaryRequest {
  workflowRunDir: string;
}

export interface QuantumWorkflowReleaseSummaryWriteRequest {
  workflowRunDir: string;
  outputDir: string;
}

export interface QuantumWorkflowReleaseManifestRequest {
  workflowRunDir: string;
}

export interface QuantumWorkflowReleaseManifestWriteRequest {
  workflowRunDir: string;
  outputDir: string;
}

export interface QuantumWorkflowReleaseBundleWriteRequest {
  workflowRunDir: string;
  outputDir: string;
}

export interface QuantumWorkflowReleaseBundleWriteByTargetRequestBody
  extends QuantumWorkflowReleaseBundleWriteByTargetRequest {}

export interface QuantumWorkflowReleaseBundleWriteByKindRequestBody
  extends QuantumWorkflowReleaseBundleWriteByKindRequest {}

export interface QuantumWorkflowHandoffAuditRequest {
  workflowRunDir: string;
}

export interface QuantumWorkflowHandoffAuditWriteRequest {
  workflowRunDir: string;
  outputDir: string;
}

export interface QuantumReleaseHandoffBundleWriteRequest {
  workflowRunDir: string;
  outputDir: string;
}

@Controller()
export class QuantumReadinessController {
  constructor(private readonly quantumReadinessService: QuantumReadinessService) {}

  @Post("/release/handoff-bundle/write")
  @HttpCode(HttpStatus.OK)
  buildReleaseHandoffBundleToFilesystem(
    @Body() body: QuantumReleaseHandoffBundleWriteRequest,
  ): QuantumReleaseHandoffBundleWriteResult {
    try {
      return this.quantumReadinessService.buildReleaseHandoffBundleToFilesystem(body.workflowRunDir, body.outputDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-handoff-audit")
  @HttpCode(HttpStatus.OK)
  buildWorkflowHandoffAudit(@Body() body: QuantumWorkflowHandoffAuditRequest): QuantumWorkflowHandoffAuditResult {
    try {
      return this.quantumReadinessService.buildWorkflowHandoffAudit(body.workflowRunDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-handoff-audit/write")
  @HttpCode(HttpStatus.OK)
  buildWorkflowHandoffAuditToFilesystem(
    @Body() body: QuantumWorkflowHandoffAuditWriteRequest,
  ): QuantumWorkflowHandoffAuditWriteResult {
    try {
      return this.quantumReadinessService.buildWorkflowHandoffAuditToFilesystem(body.workflowRunDir, body.outputDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-bundle/write/by-target")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseBundleToLatestWorkflowRunByTarget(
    @Body() body: QuantumWorkflowReleaseBundleWriteByTargetRequestBody,
  ): QuantumWorkflowReleaseBundleWriteByTargetResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseBundleToLatestWorkflowRunByTarget(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-bundle/write/by-kind")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseBundleToLatestWorkflowRunByKind(
    @Body() body: QuantumWorkflowReleaseBundleWriteByKindRequestBody,
  ): QuantumWorkflowReleaseBundleWriteByKindResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseBundleToLatestWorkflowRunByKind(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-bundle/write")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseBundleToFilesystem(
    @Body() body: QuantumWorkflowReleaseBundleWriteRequest,
  ): QuantumWorkflowReleaseBundleWriteResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseBundleToFilesystem(body.workflowRunDir, body.outputDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-manifest")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseManifest(
    @Body() body: QuantumWorkflowReleaseManifestRequest,
  ): QuantumWorkflowReleaseManifestResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseManifest(body.workflowRunDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-manifest/write")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseManifestToFilesystem(
    @Body() body: QuantumWorkflowReleaseManifestWriteRequest,
  ): QuantumWorkflowReleaseManifestWriteResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseManifestToFilesystem(body.workflowRunDir, body.outputDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-summary")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseSummary(@Body() body: QuantumWorkflowReleaseSummaryRequest): QuantumWorkflowReleaseSummaryResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseSummary(body.workflowRunDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/release/workflow-summary/write")
  @HttpCode(HttpStatus.OK)
  buildWorkflowReleaseSummaryToFilesystem(
    @Body() body: QuantumWorkflowReleaseSummaryWriteRequest,
  ): QuantumWorkflowReleaseSummaryWriteResult {
    try {
      return this.quantumReadinessService.buildWorkflowReleaseSummaryToFilesystem(body.workflowRunDir, body.outputDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/run-scaffold")
  @HttpCode(HttpStatus.OK)
  createWorkflowRunScaffold(@Body() body: QuantumWorkflowRunScaffoldRequest): OpenpraQuantumWorkflowRunScaffoldResult {
    try {
      return this.quantumReadinessService.createWorkflowRunScaffold(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/inspect-run")
  @HttpCode(HttpStatus.OK)
  inspectWorkflowRun(@Body() body: QuantumWorkflowRunInspectionRequest): QuantumWorkflowRunInspectionResult {
    try {
      return this.quantumReadinessService.inspectWorkflowRun(body.workflowRunDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/list-runs")
  @HttpCode(HttpStatus.OK)
  listWorkflowRuns(@Body() body: QuantumWorkflowRunListingRequest): QuantumWorkflowRunListingResult {
    try {
      return this.quantumReadinessService.listWorkflowRuns(body.rootDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/latest-run")
  @HttpCode(HttpStatus.OK)
  getLatestWorkflowRun(@Body() body: QuantumLatestWorkflowRunRequest): QuantumLatestWorkflowRunResult {
    try {
      return this.quantumReadinessService.getLatestWorkflowRun(body.rootDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/latest-run/by-kind")
  @HttpCode(HttpStatus.OK)
  getLatestWorkflowRunByKind(
    @Body() body: QuantumLatestWorkflowRunByKindRequest,
  ): QuantumLatestWorkflowRunByKindResult {
    try {
      return this.quantumReadinessService.getLatestWorkflowRunByKind(body.rootDir, body.workflowKind);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/latest-run/by-target")
  @HttpCode(HttpStatus.OK)
  getLatestWorkflowRunByTarget(
    @Body() body: QuantumLatestWorkflowRunByTargetRequest,
  ): QuantumLatestWorkflowRunByTargetResult {
    try {
      return this.quantumReadinessService.getLatestWorkflowRunByTarget(body.rootDir, body.modelId, body.subtreeId);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/bounded")
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

  @Post("/importance/compare/write/by-kind")
  @HttpCode(HttpStatus.OK)
  compareImportanceMeasuresToLatestWorkflowRunByKind(
    @Body() body: QuantumImportanceComparisonWriteByKindRequestBody,
  ): QuantumImportanceComparisonWriteByKindResult {
    try {
      return this.quantumReadinessService.compareImportanceMeasuresToLatestWorkflowRunByKind(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/compare/write/by-workflow-run")
  @HttpCode(HttpStatus.OK)
  compareImportanceMeasuresToWorkflowRunDir(
    @Body() body: QuantumImportanceComparisonWriteByWorkflowRunRequestBody,
  ): QuantumImportanceComparisonWriteByWorkflowRunResult {
    try {
      return this.quantumReadinessService.compareImportanceMeasuresToWorkflowRunDir(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/compare/write/by-target")
  @HttpCode(HttpStatus.OK)
  compareImportanceMeasuresToLatestWorkflowRunByTarget(
    @Body() body: QuantumImportanceComparisonWriteByTargetRequestBody,
  ): QuantumImportanceComparisonWriteByTargetResult {
    try {
      return this.quantumReadinessService.compareImportanceMeasuresToLatestWorkflowRunByTarget(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/compare/write")
  @HttpCode(HttpStatus.OK)
  compareImportanceMeasuresToFilesystem(
    @Body() body: QuantumImportanceComparisonWriteRequest,
  ): QuantumImportanceComparisonWriteResult {
    try {
      return this.quantumReadinessService.compareImportanceMeasuresToFilesystem(
        {
          modelId: body.modelId,
          subtreeId: body.subtreeId,
          measureName: body.measureName,
          quantumValues: body.quantumValues,
          classicalValues: body.classicalValues,
          ...(body.tolerance !== undefined ? { tolerance: body.tolerance } : {}),
        },
        body.outputDir,
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/compare/report/write/by-target")
  @HttpCode(HttpStatus.OK)
  buildImportanceComparisonReportToLatestWorkflowRunByTarget(
    @Body() body: QuantumImportanceComparisonReportWriteByTargetRequestBody,
  ): QuantumImportanceComparisonReportWriteByTargetResult {
    try {
      return this.quantumReadinessService.buildImportanceComparisonReportToLatestWorkflowRunByTarget(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/compare/report/write/by-kind")
  @HttpCode(HttpStatus.OK)
  buildImportanceComparisonReportToLatestWorkflowRunByKind(
    @Body() body: QuantumImportanceComparisonReportWriteByKindRequestBody,
  ): QuantumImportanceComparisonReportWriteByKindResult {
    try {
      return this.quantumReadinessService.buildImportanceComparisonReportToLatestWorkflowRunByKind(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/compare/report/write/by-workflow-run")
  @HttpCode(HttpStatus.OK)
  buildImportanceComparisonReportToWorkflowRunDir(
    @Body() body: QuantumImportanceComparisonReportWriteByWorkflowRunRequestBody,
  ): QuantumImportanceComparisonReportWriteByWorkflowRunResult {
    try {
      return this.quantumReadinessService.buildImportanceComparisonReportToWorkflowRunDir(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/compare/report")
  @HttpCode(HttpStatus.OK)
  buildImportanceComparisonReport(
    @Body() body: QuantumImportanceComparisonRequest,
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
    @Body() body: QuantumImportanceComparisonReportWriteRequest,
  ): QuantumImportanceComparisonReportWriteResult {
    try {
      return this.quantumReadinessService.buildImportanceComparisonReportToFilesystem(
        {
          modelId: body.modelId,
          subtreeId: body.subtreeId,
          measureName: body.measureName,
          quantumValues: body.quantumValues,
          classicalValues: body.classicalValues,
          ...(body.tolerance !== undefined ? { tolerance: body.tolerance } : {}),
        },
        body.outputDir,
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/compare")
  @HttpCode(HttpStatus.OK)
  compareImportanceMeasures(@Body() body: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {
    try {
      return this.quantumReadinessService.compareImportanceMeasures(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/preparation-run")
  @HttpCode(HttpStatus.OK)
  createPreparationWorkflowRun(
    @Body() body: QuantumPreparationWorkflowRunRequest,
  ): QuantumPreparationWorkflowRunResult {
    try {
      return this.quantumReadinessService.createPreparationWorkflowRun(
        body.rootDir,
        body.graph,
        body.modelId,
        body.subtreeId,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/preparation-run/by-id")
  @HttpCode(HttpStatus.OK)
  async createPreparationWorkflowRunById(
    @Body() body: QuantumPreparationWorkflowByIdRequest,
  ): Promise<QuantumPreparationWorkflowRunResult> {
    try {
      return await this.quantumReadinessService.createPreparationWorkflowRunById(
        body.rootDir,
        body.faultTreeId,
        body.subtreeId,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/execution-run")
  @HttpCode(HttpStatus.OK)
  createExecutionWorkflowRun(@Body() body: QuantumExecutionWorkflowRunRequest): QuantumExecutionWorkflowRunResult {
    try {
      return this.quantumReadinessService.createExecutionWorkflowRun(
        body.rootDir,
        this.resolveExecutionRequestBody(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/recovery-run")
  @HttpCode(HttpStatus.OK)
  createRecoveryWorkflowRun(@Body() body: QuantumRecoveryWorkflowRunRequest): QuantumRecoveryWorkflowRunResult {
    try {
      return this.quantumReadinessService.createRecoveryWorkflowRun(
        body.rootDir,
        body.candidateDir,
        body.modelId,
        body.subtreeId,
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/recovery-batch-run")
  @HttpCode(HttpStatus.OK)
  createRecoveryBatchWorkflowRun(
    @Body() body: QuantumRecoveryBatchWorkflowRunRequest,
  ): QuantumRecoveryBatchWorkflowRunResult {
    try {
      return this.quantumReadinessService.createRecoveryBatchWorkflowRun(
        body.rootDir,
        body.batchRoot,
        body.modelId,
        body.subtreeId,
        body.candidateDirs,
        body.selectionMode ?? "package_result_only",
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/full-pipeline-run")
  @HttpCode(HttpStatus.OK)
  createFullPipelineWorkflowRun(
    @Body() body: QuantumFullPipelineWorkflowRunRequest,
  ): QuantumFullPipelineWorkflowRunResult {
    try {
      return this.quantumReadinessService.createFullPipelineWorkflowRun(
        body.rootDir,
        body.modelId,
        body.subtreeId,
        body.graph,
        body.modelName,
        this.resolveOptions(body),
        this.resolveOptionalExecutionRequestBody(body.executionRequest),
        body.recoveryCandidateDir,
        body.recoveryBatch,
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/full-pipeline-run/by-id")
  @HttpCode(HttpStatus.OK)
  async createFullPipelineWorkflowRunById(
    @Body() body: QuantumFullPipelineWorkflowByIdRequest,
  ): Promise<QuantumFullPipelineWorkflowRunResult> {
    try {
      return await this.quantumReadinessService.createFullPipelineWorkflowRunById(
        body.rootDir,
        body.faultTreeId,
        body.subtreeId,
        body.modelName,
        this.resolveOptions(body),
        this.resolveOptionalExecutionRequestBody(body.executionRequest),
        body.recoveryCandidateDir,
        body.recoveryBatch,
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraph(@Body() body: QuantumReadinessGraphRequest): OpenPraFaultTreeReadinessResult {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraph(body.graph, body.modelName, this.resolveOptions(body));
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/preparation")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraphPreparation(@Body() body: QuantumReadinessGraphRequest): QuantumPreparationExport {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraphPreparation(
        body.graph,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/preparation-artifacts")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraphPreparationArtifacts(
    @Body() body: QuantumReadinessGraphRequest,
  ): OpenpraQuantumPreparationArtifactBundle {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraphPreparationArtifacts(
        body.graph,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/preparation-artifacts/write")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
    @Body() body: QuantumPreparationArtifactsWriteRequest,
  ): OpenpraQuantumPreparationArtifactFilesystemWriteResult {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
        body.graph,
        body.outputDir,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/by-id")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphById(
    @Body() body: QuantumReadinessGraphByIdRequest,
  ): Promise<OpenPraFaultTreeReadinessResult> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphById(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/by-id/preparation")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphByIdPreparation(
    @Body() body: QuantumReadinessGraphByIdRequest,
  ): Promise<QuantumPreparationExport> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphByIdPreparation(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/by-id/preparation-artifacts")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphByIdPreparationArtifacts(
    @Body() body: QuantumReadinessGraphByIdRequest,
  ): Promise<OpenpraQuantumPreparationArtifactBundle> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphByIdPreparationArtifacts(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/execution/artifacts/raw-counts")
  @HttpCode(HttpStatus.OK)
  buildExecutionArtifactsFromRawCounts(
    @Body() body: QuantumExecutionArtifactRawCountsRequest,
  ): OpenpraQuantumExecutionArtifactBundle {
    try {
      return this.quantumReadinessService.buildExecutionArtifactsFromRawCounts(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/execution/artifacts/raw-counts/write")
  @HttpCode(HttpStatus.OK)
  buildExecutionArtifactsFromRawCountsToFilesystem(
    @Body() body: QuantumExecutionArtifactRawCountsWriteRequest,
  ): OpenpraQuantumExecutionArtifactFilesystemWriteResult {
    try {
      return this.quantumReadinessService.buildExecutionArtifactsFromRawCountsToFilesystem(
        {
          modelId: body.modelId,
          subtreeId: body.subtreeId,
          sourcePreparationArtifactId: body.sourcePreparationArtifactId,
          providerType: body.providerType,
          providerName: body.providerName,
          backendName: body.backendName,
          executionMode: body.executionMode,
          shots: body.shots,
          rawCounts: body.rawCounts,
          ...(body.jobIdOrRunId ? { jobIdOrRunId: body.jobIdOrRunId } : {}),
          ...(body.status ? { status: body.status } : {}),
          ...(body.metadata ? { metadata: body.metadata } : {}),
        },
        body.outputDir,
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/candidate-dir")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryCandidateDir(@Body() body: QuantumRecoveryCandidateDirRequest): QuantumRecoveryLadderResult {
    try {
      return this.quantumReadinessService.analyzeRecoveryCandidateDir(body.candidateDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/candidate-dir/write")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryCandidateDirToFilesystem(
    @Body() body: QuantumRecoveryCandidateDirWriteRequest,
  ): QuantumRecoveryArtifactWriteResult {
    try {
      return this.quantumReadinessService.analyzeRecoveryCandidateDirToFilesystem(body.candidateDir, body.outputDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/batch-root")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryBatchRoot(@Body() body: QuantumRecoveryBatchRootRequest): OpenpraQuantumRecoveryBatchRollup {
    try {
      return this.quantumReadinessService.analyzeRecoveryBatchRoot(
        body.batchRoot,
        body.candidateDirs,
        body.selectionMode ?? "package_result_only",
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/batch-root/write")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryBatchRootToFilesystem(
    @Body() body: QuantumRecoveryBatchRootWriteRequest,
  ): QuantumRecoveryBatchRollupWriteResult {
    try {
      return this.quantumReadinessService.analyzeRecoveryBatchRootToFilesystem(
        body.batchRoot,
        body.outputDir,
        body.candidateDirs,
        body.selectionMode ?? "package_result_only",
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private resolveOptions(
    body:
      | QuantumReadinessGraphRequest
      | QuantumReadinessGraphByIdRequest
      | QuantumPreparationWorkflowRunRequest
      | QuantumPreparationWorkflowByIdRequest
      | QuantumFullPipelineWorkflowRunRequest
      | QuantumFullPipelineWorkflowByIdRequest,
  ): OpenPraFaultTreeReadinessOptions {
    return {
      ...(body.options ?? {}),
      ...(body.heuristics !== undefined ? { heuristics: body.heuristics } : {}),
      ...(body.analysis !== undefined ? { analysis: body.analysis } : {}),
    };
  }

  private resolveOptionalExecutionRequestBody(
    body?: QuantumExecutionRequestBody,
  ): QuantumExecutionWorkflowRequest | undefined {
    if (!body) {
      return undefined;
    }

    return this.resolveExecutionRequestBody(body);
  }

  private resolveExecutionRequestBody(body: QuantumExecutionRequestBody): QuantumExecutionWorkflowRequest {
    if (body.inputMode === "simulator_local") {
      return {
        modelId: body.modelId,
        subtreeId: body.subtreeId,
        ...(body.sourcePreparationArtifactId ? { sourcePreparationArtifactId: body.sourcePreparationArtifactId } : {}),
        ...(body.preparationArtifactPath ? { preparationArtifactPath: body.preparationArtifactPath } : {}),
        ...(body.preparationArtifact ? { preparationArtifact: body.preparationArtifact } : {}),
        shots: body.shots,
        ...(body.samplingMode ? { samplingMode: body.samplingMode } : {}),
        ...(body.providerName ? { providerName: body.providerName } : {}),
        ...(body.backendName ? { backendName: body.backendName } : {}),
        ...(body.executionMode ? { executionMode: body.executionMode } : {}),
        ...(body.jobIdOrRunId ? { jobIdOrRunId: body.jobIdOrRunId } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.parameterSource ? { parameterSource: body.parameterSource } : {}),
        ...(body.beta !== undefined ? { beta: body.beta } : {}),
        ...(body.gamma !== undefined ? { gamma: body.gamma } : {}),
        ...(body.seed !== undefined ? { seed: body.seed } : {}),
        ...(body.metadata ? { metadata: body.metadata } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
      };
    }

    return {
      modelId: body.modelId,
      subtreeId: body.subtreeId,
      sourcePreparationArtifactId: body.sourcePreparationArtifactId,
      providerType: body.providerType,
      providerName: body.providerName,
      backendName: body.backendName,
      executionMode: body.executionMode,
      shots: body.shots,
      rawCounts: body.rawCounts,
      ...(body.jobIdOrRunId ? { jobIdOrRunId: body.jobIdOrRunId } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.metadata ? { metadata: body.metadata } : {}),
    };
  }

  private toHttpException(error: unknown): HttpException {
    const message = error instanceof Error ? error.message : "Something went wrong";

    if (
      message.startsWith("No fault tree graph found for faultTreeId") ||
      message.startsWith("workflowRunDir does not exist") ||
      message.startsWith("rootDir does not exist") ||
      message.startsWith("No workflow run found for modelId") ||
      message.startsWith("No workflow run found for workflowKind")
    ) {
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
