import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { EsqWorkbooksService, type EsqWorkbookResponse } from "./esq-workbooks.service";
import { parseRevisionedWorkbookPatchBody } from "../workbooks/workbook-mef-patch";
import { parseExpectedWorkbookRevision } from "../workbooks/workbook-revision";
import { WorkbookAnalysisRunsService } from "../newly-developed-methods/shared/workbook-analysis-runs.service";
import type {
  AnalysisRunMetadata,
  AnalysisRunProvenanceList,
  HclBatchExecuteResult,
} from "interfaces-shared-types/newly-developed-methods";

@Controller("esq-workbooks")
@UseGuards(JwtAuthGuard)
export class EsqWorkbooksController {
  constructor(
    private readonly esqWorkbooksService: EsqWorkbooksService,
    private readonly analysisRunsService: WorkbookAnalysisRunsService,
  ) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Get(":id/analysis-runs")
  @HttpCode(HttpStatus.OK)
  listAnalysisRuns(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AnalysisRunProvenanceList> {
    return this.analysisRunsService.listRunProvenance("ESQ", id, {
      username: req.user!.username,
    });
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
  loadExample(@Param("id") id: string, @Body() body: { example?: string }, @Req() req: AuthenticatedRequest): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.loadExample(id, { username: req.user!.username }, body.example);
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
