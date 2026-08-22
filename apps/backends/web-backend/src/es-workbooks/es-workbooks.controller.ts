import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { EsWorkbooksService, type EsWorkbookResponse } from "./es-workbooks.service";
import { parseRevisionedWorkbookPatchBody } from "../workbooks/workbook-mef-patch";
import { parseExpectedWorkbookRevision } from "../workbooks/workbook-revision";
import { WorkbookAnalysisRunsService } from "../newly-developed-methods/shared/workbook-analysis-runs.service";
import type { AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods";

@Controller("es-workbooks")
@UseGuards(JwtAuthGuard)
export class EsWorkbooksController {
  constructor(
    private readonly esWorkbooksService: EsWorkbooksService,
    private readonly analysisRunsService: WorkbookAnalysisRunsService,
  ) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsWorkbookResponse> {
    return this.esWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsWorkbookResponse> {
    return this.esWorkbooksService.patchMef(id, parseRevisionedWorkbookPatchBody(body), {
      username: req.user!.username,
    });
  }

  @Delete(":id/event-trees/:modelId")
  @HttpCode(HttpStatus.OK)
  deleteEventTree(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Query("expectedRevision") expectedRevision: string | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsWorkbookResponse> {
    return this.esWorkbooksService.deleteEventTree(
      id,
      modelId,
      parseExpectedWorkbookRevision(expectedRevision),
      { username: req.user!.username },
    );
  }

  @Post(":id/event-trees/:modelId/runs")
  @HttpCode(HttpStatus.OK)
  async runEventTree(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ schemaVersion: "1.0.0"; run: AnalysisRunMetadata }> {
    return {
      schemaVersion: "1.0.0",
      run: await this.analysisRunsService.executeEventTree(id, modelId, body, {
        username: req.user!.username,
      }),
    };
  }

  @Get(":id/event-trees/:modelId/runs/:runId")
  @HttpCode(HttpStatus.OK)
  getEventTreeRun(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AnalysisRunMetadata> {
    return this.analysisRunsService.getRun("ES", id, modelId, runId, {
      username: req.user!.username,
    });
  }

  @Get(":id/event-trees/:modelId/runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getEventTreeResult(
    @Param("id") id: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.analysisRunsService.getResult("ES", id, modelId, runId, {
      username: req.user!.username,
    });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Body() body: { example?: string }, @Req() req: AuthenticatedRequest): Promise<EsWorkbookResponse> {
    return this.esWorkbooksService.loadExample(id, { username: req.user!.username }, body.example);
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsWorkbookResponse> {
    return this.esWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
