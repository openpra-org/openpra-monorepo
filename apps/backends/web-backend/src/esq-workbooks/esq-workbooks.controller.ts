import { AnalysisCancellationInterceptor } from "../newly-developed-methods/shared/analysis-cancellation.interceptor";
import type { HclGenerateScenariosResult } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { EsqWorkbooksService, type EsqWorkbookResponse } from "./esq-workbooks.service";
import { parseRevisionedWorkbookPatchBody } from "../workbooks/workbook-mef-patch";
import { parseExpectedWorkbookRevision } from "../workbooks/workbook-revision";
import { WorkbookAnalysisRunsService } from "../newly-developed-methods/shared/workbook-analysis-runs.service";
import { EsqModelRunsService } from "./esq-model-runs.service";
import type {
  AnalysisRunMetadata,
  EsqImportanceRunResult,
  EsqModelRunResult,
  EsqPostRunResult,
  EsqUncertaintyRunResult,
  EventTreeAnalysisResult,
  HclBatchExecuteResult,
  LoadCapacityAnalysisResult,
} from "interfaces-shared-types/newly-developed-methods";

@UseInterceptors(AnalysisCancellationInterceptor)
@Controller("esq-workbooks")
@UseGuards(JwtAuthGuard)
export class EsqWorkbooksController {
  constructor(
    private readonly esqWorkbooksService: EsqWorkbooksService,
    private readonly analysisRunsService: WorkbookAnalysisRunsService,
    private readonly modelRunsService: EsqModelRunsService,
  ) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Get(":id/analysis-runs")
  listAnalysisRuns(@Param("id") id: string, @Req() req: AuthenticatedRequest, @Query("cursor") cursor?: string, @Query("modelId") modelId?: string) {
    return this.analysisRunsService.listRunProvenance("ESQ", id, { username: req.user!.username }, cursor, modelId);
  }

  @Get(":id/analysis-runs/:runId")
  analysisRun(@Param("id") id: string, @Param("runId") runId: string, @Req() req: AuthenticatedRequest) {
    return this.analysisRunsService.getRun("ESQ", id, undefined, runId, { username: req.user!.username });
  }

  @Get(":id/analysis-runs/:runId/details")
  analysisRunDetails(@Param("id") id: string, @Param("runId") runId: string, @Req() req: AuthenticatedRequest) {
    return this.analysisRunsService.getRunDetails("ESQ", id, runId, { username: req.user!.username });
  }

  @Post(":id/event-trees/:treeId/runs")
  @HttpCode(HttpStatus.OK)
  async runEventTree(
    @Param("id") id: string,
    @Param("treeId") treeId: string,
    @Body() body: object,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.modelRunsService.runEventTree(id, treeId, body, { username: req.user!.username }),
    };
  }

  @Get(":id/event-trees/:treeId/runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getEventTreeResult(
    @Param("id") id: string,
    @Param("treeId") treeId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<EventTreeAnalysisResult> {
    return this.modelRunsService.getEventTreeResult(id, treeId, runId, { username: req.user!.username });
  }

  @Post(":id/model-runs")
  @HttpCode(HttpStatus.OK)
  async runModel(
    @Param("id") id: string,
    @Body() body: object,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.modelRunsService.runModel(id, body, { username: req.user!.username }),
    };
  }

  @Get(":id/model-runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getModelResult(
    @Param("id") id: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsqModelRunResult> {
    return this.modelRunsService.getModelResult(id, runId, { username: req.user!.username });
  }

  @Post(":id/post-runs")
  @HttpCode(HttpStatus.OK)
  async runPost(
    @Param("id") id: string,
    @Body() body: object,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.modelRunsService.runPost(id, body, { username: req.user!.username }),
    };
  }

  @Get(":id/post-runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getPostResult(
    @Param("id") id: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsqPostRunResult> {
    return this.modelRunsService.getPostResult(id, runId, { username: req.user!.username });
  }

  @Post(":id/importance-runs")
  @HttpCode(HttpStatus.OK)
  async runImportance(
    @Param("id") id: string,
    @Body() body: object,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.modelRunsService.runImportance(id, body, { username: req.user!.username }),
    };
  }

  @Get(":id/importance-runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getImportanceResult(
    @Param("id") id: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsqImportanceRunResult> {
    return this.modelRunsService.getImportanceResult(id, runId, { username: req.user!.username });
  }

  @Post(":id/uncertainty-runs")
  @HttpCode(HttpStatus.OK)
  async runUncertainty(
    @Param("id") id: string,
    @Body() body: object,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.modelRunsService.runUncertainty(id, body, { username: req.user!.username }),
    };
  }

  @Get(":id/uncertainty-runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getUncertaintyResult(
    @Param("id") id: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsqUncertaintyRunResult> {
    return this.modelRunsService.getUncertaintyResult(id, runId, { username: req.user!.username });
  }

  @Post(":id/sensitivity-cases/:caseId/runs")
  @HttpCode(HttpStatus.OK)
  async runSensitivity(
    @Param("id") id: string,
    @Param("caseId") caseId: string,
    @Body() body: object,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.modelRunsService.runSensitivity(id, caseId, body, { username: req.user!.username }),
    };
  }

  @Get(":id/sensitivity-cases/:caseId/runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getSensitivityResult(
    @Param("id") id: string,
    @Param("caseId") caseId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsqModelRunResult> {
    return this.modelRunsService.getSensitivityResult(id, caseId, runId, { username: req.user!.username });
  }

  @Post(":id/barrier-cells/:cellId/runs")
  @HttpCode(HttpStatus.OK)
  async runBarrierCell(
    @Param("id") id: string,
    @Param("cellId") cellId: string,
    @Body() body: object,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.modelRunsService.runBarrierCell(id, cellId, body, { username: req.user!.username }),
    };
  }

  @Get(":id/barrier-cells/:cellId/runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getBarrierCellResult(
    @Param("id") id: string,
    @Param("cellId") cellId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<LoadCapacityAnalysisResult> {
    return this.modelRunsService.getBarrierCellResult(id, cellId, runId, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.patchMef(id, parseRevisionedWorkbookPatchBody(body), {
      username: req.user!.username,
    });
  }

  @Delete(":id/bayesian-networks/:modelId")
  @HttpCode(HttpStatus.OK)
  deleteBayesianNetwork(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Query("expectedRevision") expectedRevision: string | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.deleteBayesianNetwork(
      id,
      modelId,
      parseExpectedWorkbookRevision(expectedRevision),
      { username: req.user!.username },
    );
  }

  @Delete(":id/hcl-configurations/:modelId")
  @HttpCode(HttpStatus.OK)
  deleteHclConfiguration(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Query("expectedRevision") expectedRevision: string | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.deleteHclConfiguration(
      id,
      modelId,
      parseExpectedWorkbookRevision(expectedRevision),
      { username: req.user!.username },
    );
  }

  @Post(":id/bayesian-networks/:modelId/runs")
  @HttpCode(HttpStatus.OK)
  async runBayesianNetwork(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.analysisRunsService.executeBayesianNetwork(id, modelId, body, {
        username: req.user!.username,
      }),
    };
  }

  @Get(":id/bayesian-networks/:modelId/runs/:runId")
  @HttpCode(HttpStatus.OK)
  getBayesianNetworkRun(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AnalysisRunMetadata> {
    return this.analysisRunsService.getRun("ESQ", id, modelId, runId, {
      username: req.user!.username,
    });
  }

  @Get(":id/bayesian-networks/:modelId/runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getBayesianNetworkResult(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.analysisRunsService.getResult("ESQ", id, modelId, runId, {
      username: req.user!.username,
    });
  }

  @Post(":id/hcl-configurations/:modelId/generate-scenarios")
  @HttpCode(HttpStatus.OK)
  generateHclScenarios(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<HclGenerateScenariosResult> {
    return this.analysisRunsService.generateHclScenarios(id, modelId, body, { username: req.user!.username }, "ESQ");
  }

  @Post(":id/hcl-configurations/:modelId/fault-tree-runs")
  @HttpCode(HttpStatus.OK)
  async runHclFaultTree(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.analysisRunsService.executeHclFaultTree(id, modelId, body, {
        username: req.user!.username,
      }),
    };
  }

  @Post(":id/hcl-configurations/:modelId/fault-tree-batch-runs")
  @HttpCode(HttpStatus.OK)
  runHclFaultTreeBatch(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<HclBatchExecuteResult> {
    return this.analysisRunsService.executeHclFaultTreeBatch(id, modelId, body, {
      username: req.user!.username,
    });
  }

  @Post(":id/hcl-configurations/:modelId/event-tree-runs")
  @HttpCode(HttpStatus.OK)
  async runHclEventTree(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.analysisRunsService.executeHclEventTree(id, modelId, body, {
        username: req.user!.username,
      }),
    };
  }

  @Post(":id/hcl-configurations/:modelId/event-tree-batch-runs")
  @HttpCode(HttpStatus.OK)
  runHclEventTreeBatch(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<HclBatchExecuteResult> {
    return this.analysisRunsService.executeHclEventTreeBatch(id, modelId, body, {
      username: req.user!.username,
    });
  }

  @Get(":id/hcl-configurations/:modelId/runs/:runId")
  @HttpCode(HttpStatus.OK)
  getHclRun(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AnalysisRunMetadata> {
    return this.analysisRunsService.getRun("ESQ", id, modelId, runId, {
      username: req.user!.username,
    });
  }

  @Get(":id/hcl-configurations/:modelId/runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getHclResult(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.analysisRunsService.getResult("ESQ", id, modelId, runId, {
      username: req.user!.username,
    });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(
    @Param("id") id: string,
    @Body() body: { example?: string },
    @Req() req: AuthenticatedRequest,
  ): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.loadExample(id, { username: req.user!.username }, body.example);
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
