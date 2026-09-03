import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { SyWorkbooksService, type SyWorkbookResponse } from "./sy-workbooks.service";
import { parseRevisionedWorkbookPatchBody } from "../workbooks/workbook-mef-patch";
import { parseExpectedWorkbookRevision } from "../workbooks/workbook-revision";
import { WorkbookAnalysisRunsService } from "../newly-developed-methods/shared/workbook-analysis-runs.service";
import type { AnalysisRunMetadata, HclBatchExecuteResult } from "interfaces-shared-types/newly-developed-methods";
import type { FaultTreeValidateResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";

@Controller("sy-workbooks")
@UseGuards(JwtAuthGuard)
export class SyWorkbooksController {
  constructor(
    private readonly syWorkbooksService: SyWorkbooksService,
    private readonly analysisRunsService: WorkbookAnalysisRunsService,
  ) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.patchMef(id, parseRevisionedWorkbookPatchBody(body), {
      username: req.user!.username,
    });
  }

  @Delete(":id/fault-trees/:modelId")
  @HttpCode(HttpStatus.OK)
  deleteFaultTree(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Query("expectedRevision") expectedRevision: string | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.deleteFaultTree(
      id,
      modelId,
      parseExpectedWorkbookRevision(expectedRevision),
      { username: req.user!.username },
    );
  }

  @Post(":id/fault-trees/:modelId/runs")
  @HttpCode(HttpStatus.OK)
  async runFaultTree(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.analysisRunsService.executeFaultTree(id, modelId, body, {
        username: req.user!.username,
      }),
    };
  }

  @Post(":id/fault-trees/:modelId/validate")
  @HttpCode(HttpStatus.OK)
  validateFaultTree(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<FaultTreeValidateResult> {
    return this.syWorkbooksService.validateFaultTree(id, modelId, body, {
      username: req.user!.username,
    });
  }

  @Get(":id/fault-trees/:modelId/runs/:runId")
  @HttpCode(HttpStatus.OK)
  getFaultTreeRun(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AnalysisRunMetadata> {
    return this.analysisRunsService.getRun("SY", id, modelId, runId, {
      username: req.user!.username,
    });
  }

  @Get(":id/fault-trees/:modelId/runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getFaultTreeResult(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.analysisRunsService.getResult("SY", id, modelId, runId, {
      username: req.user!.username,
    });
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
      run: await this.analysisRunsService.executeBayesianNetwork(
        id,
        modelId,
        body,
        { username: req.user!.username },
        "SY",
      ),
    };
  }

  @Get(":id/bayesian-networks/:modelId/runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getBayesianNetworkResult(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.analysisRunsService.getResult("SY", id, modelId, runId, {
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
      run: await this.analysisRunsService.executeHclFaultTree(
        id,
        modelId,
        body,
        { username: req.user!.username },
        null,
        "SY",
      ),
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
    return this.analysisRunsService.executeHclFaultTreeBatch(
      id,
      modelId,
      body,
      { username: req.user!.username },
      "SY",
    );
  }

  @Get(":id/hcl-configurations/:modelId/runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getHclResult(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.analysisRunsService.getResult("SY", id, modelId, runId, {
      username: req.user!.username,
    });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Body() body: { example?: string }, @Req() req: AuthenticatedRequest): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.loadExample(id, { username: req.user!.username }, body.example);
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
